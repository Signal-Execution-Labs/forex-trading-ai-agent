/**
 * BinaryFaster API Service
 * Real integration for fetching trades from BinaryFaster binary options platform
 */

const BINARYFASTER_API_URL = 'https://wsauto.binaryfaster.com/automation';

interface BinaryFasterCredentials {
  email: string;
  password: string;
}

interface BinaryFasterTrade {
  id: string | number;
  trade_id?: string;
  currency_id: number;
  trend: 'up' | 'down';
  lot: number;
  binarytime: number;
  status: string;
  result?: 'win' | 'lose' | 'draw';
  profit?: number;
  created_at?: string;
  closed_at?: string;
  open_price?: number;
  close_price?: number;
}

interface BinaryFasterBalance {
  balance?: number;
  real?: number;
  demo?: number;
  amount?: number;
}

// Asset ID to name mapping
const ASSET_NAMES: Record<number, string> = {
  159: 'EUR/USD',
  160: 'GBP/USD',
  161: 'AUD/USD',
  162: 'USD/JPY',
  163: 'USD/CHF',
  164: 'USD/CAD',
  165: 'NZD/USD',
  166: 'EUR/GBP',
  167: 'EUR/JPY',
  168: 'GBP/JPY',
};

export class BinaryFasterService {
  private email: string;
  private password: string;
  private apiKey: string | null = null;

  constructor(credentials: BinaryFasterCredentials) {
    this.email = credentials.email;
    this.password = credentials.password;
  }

  /**
   * Login and get API key
   */
  private async login(): Promise<boolean> {
    try {
      const response = await fetch(`${BINARYFASTER_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
      });

      if (!response.ok) {
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.apiKey = data.api_key;
      
      if (!this.apiKey) {
        throw new Error('No API key in response');
      }

      return true;
    } catch (error: any) {
      console.error('BinaryFaster login error:', error.message);
      return false;
    }
  }

  /**
   * Make authenticated request
   */
  private async authRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    if (!this.apiKey) {
      const loggedIn = await this.login();
      if (!loggedIn) {
        throw new Error('Failed to authenticate with BinaryFaster');
      }
    }

    const response = await fetch(`${BINARYFASTER_API_URL}${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey!,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      // Try re-login on auth failure
      if (response.status === 401) {
        this.apiKey = null;
        const loggedIn = await this.login();
        if (!loggedIn) {
          throw new Error('Re-authentication failed');
        }
        // Retry request
        return this.authRequest(endpoint, method, body);
      }
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test connection and validate credentials
   */
  async testConnection(): Promise<{ success: boolean; error?: string; balance?: number }> {
    try {
      const loggedIn = await this.login();
      if (!loggedIn) {
        return { success: false, error: 'Invalid email or password' };
      }

      // Try to get balance to verify full access
      const balanceData = await this.authRequest('/user/balance') as BinaryFasterBalance;
      const balance = balanceData.real || balanceData.balance || balanceData.amount || 0;

      return {
        success: true,
        balance: Number(balance),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<{ real: number; demo: number }> {
    const data = await this.authRequest('/user/balance') as BinaryFasterBalance;
    return {
      real: Number(data.real || data.balance || data.amount || 0),
      demo: Number(data.demo || 0),
    };
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<any> {
    return this.authRequest('/user/info');
  }

  /**
   * Get trade history
   */
  async getTradeHistory(limit: number = 100): Promise<BinaryFasterTrade[]> {
    const data = await this.authRequest('/trades/history');
    // API might return array directly or { trades: [...] }
    const trades = Array.isArray(data) ? data : (data.trades || data.history || []);
    return trades.slice(0, limit);
  }

  /**
   * Get active/open trades
   */
  async getActiveTrades(): Promise<BinaryFasterTrade[]> {
    const data = await this.authRequest('/trades/active');
    return Array.isArray(data) ? data : (data.trades || []);
  }

  /**
   * Convert BinaryFaster trade to Journal entry format
   */
  static toJournalEntry(trade: BinaryFasterTrade): {
    symbol: string;
    direction: 'long' | 'short';
    entry_date: string;
    entry_price: number;
    exit_price?: number;
    quantity: number;
    pnl?: number;
    fees: number;
    status: 'open' | 'closed';
    notes: string;
    setup?: string;
    outcome?: 'win' | 'loss' | 'breakeven';
  } {
    const symbol = ASSET_NAMES[trade.currency_id] || `Asset_${trade.currency_id}`;
    const isWin = trade.result === 'win';
    const isLose = trade.result === 'lose';
    
    // Binary options: CALL = expecting price up = long, PUT = expecting price down = short
    const direction = trade.trend === 'up' ? 'long' : 'short';
    
    // Calculate P&L: win = +lot*payout(~80%), lose = -lot
    let pnl: number | undefined;
    if (trade.profit !== undefined) {
      pnl = trade.profit;
    } else if (isWin) {
      pnl = trade.lot * 0.8; // Approximate 80% payout
    } else if (isLose) {
      pnl = -trade.lot;
    }

    return {
      symbol,
      direction,
      entry_date: trade.created_at || new Date().toISOString(),
      entry_price: trade.open_price || 0,
      exit_price: trade.close_price,
      quantity: trade.lot,
      pnl,
      fees: 0, // Binary options typically no fees
      status: trade.status === 'closed' || trade.result ? 'closed' : 'open',
      notes: `BinaryFaster #${trade.id || trade.trade_id} | ${trade.trend.toUpperCase()} | ${trade.binarytime}s expiry`,
      setup: 'Binary Option',
      outcome: isWin ? 'win' : (isLose ? 'loss' : undefined),
    };
  }
}

/**
 * Validate BinaryFaster credentials without storing them
 */
export async function validateBinaryFasterCredentials(email: string, password: string): Promise<{
  valid: boolean;
  error?: string;
  balance?: number;
}> {
  const service = new BinaryFasterService({ email, password });
  const result = await service.testConnection();
  return {
    valid: result.success,
    error: result.error,
    balance: result.balance,
  };
}

/**
 * Fetch trades from BinaryFaster for syncing to Journal
 */
export async function fetchBinaryFasterTrades(email: string, password: string): Promise<{
  success: boolean;
  trades?: any[];
  balance?: { real: number; demo: number };
  error?: string;
}> {
  try {
    const service = new BinaryFasterService({ email, password });
    
    // Test connection first
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    // Get balance
    const balance = await service.getBalance();

    // Fetch trade history
    const trades = await service.getTradeHistory(100);
    const journalEntries = trades.map(t => BinaryFasterService.toJournalEntry(t));

    return {
      success: true,
      trades: journalEntries,
      balance,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
