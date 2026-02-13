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
  // Old API format
  currency_id?: number;
  trend?: 'up' | 'down';
  lot?: number;
  binarytime?: number;
  status?: string;
  created_at?: string;
  open_price?: number;
  close_price?: number;
  // New API format (actual)
  symbol?: string;
  direction?: 'call' | 'put';
  amount?: number;
  entry_price?: number;
  exit_price?: number;
  result?: 'win' | 'loss' | 'lose' | 'tie' | 'draw';
  profit?: number;
  is_demo?: boolean;
  closed_at?: string;
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
      console.log('[BinaryFaster] Attempting login for:', this.email);
      const response = await fetch(`${BINARYFASTER_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.email, password: this.password }),
      });

      console.log('[BinaryFaster] Login response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[BinaryFaster] Login failed:', errorText);
        throw new Error(`Login failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.apiKey = data.api_key;
      console.log('[BinaryFaster] Got API key:', this.apiKey ? 'YES' : 'NO');
      
      if (!this.apiKey) {
        throw new Error('No API key in response');
      }

      // Switch to REAL mode (not demo) - CRITICAL for getting real trades!
      await this.setRealMode();

      return true;
    } catch (error: any) {
      console.error('[BinaryFaster] Login error:', error.message);
      return false;
    }
  }

  /**
   * Switch trading mode (demo or real)
   * @param demo - true for demo mode, false for real mode
   */
  async setMode(demo: boolean): Promise<void> {
    try {
      await fetch(`${BINARYFASTER_API_URL}/traderoom/setdemo/${demo ? '1' : '0'}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey!,
        },
      });
      console.log(`[BinaryFaster] Switched to ${demo ? 'DEMO' : 'REAL'} mode`);
    } catch (error: any) {
      console.error(`[BinaryFaster] Failed to switch to ${demo ? 'DEMO' : 'REAL'} mode:`, error.message);
    }
  }
  
  /**
   * Switch to REAL trading mode (not demo)
   * This is required to fetch real trades from history!
   */
  private async setRealMode(): Promise<void> {
    await this.setMode(false);
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
    console.log('[BinaryFaster] Fetching trade history...');
    const data = await this.authRequest('/trades/history');
    console.log('[BinaryFaster] Raw response type:', typeof data);
    console.log('[BinaryFaster] Is array:', Array.isArray(data));
    console.log('[BinaryFaster] Data keys:', data ? Object.keys(data) : 'null');
    console.log('[BinaryFaster] First item:', Array.isArray(data) && data.length > 0 ? JSON.stringify(data[0]) : 'none');
    // API might return array directly or { trades: [...] }
    const trades = Array.isArray(data) ? data : (data.trades || data.history || []);
    console.log('[BinaryFaster] Parsed trades count:', trades.length);
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
   * Handles both old API format (currency_id, trend) and new format (symbol, direction)
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
    // Handle symbol - new API uses string like "eurusd", old uses currency_id
    let symbol: string;
    if (trade.symbol) {
      symbol = trade.symbol.toUpperCase().replace(/([a-z]{3})([a-z]{3})/i, '$1/$2'); // eurusd -> EUR/USD
    } else if (trade.currency_id) {
      symbol = ASSET_NAMES[trade.currency_id] || `Asset_${trade.currency_id}`;
    } else {
      symbol = 'UNKNOWN';
    }

    // Handle direction - new API uses call/put, old uses up/down
    let direction: 'long' | 'short';
    if (trade.direction) {
      direction = trade.direction === 'call' ? 'long' : 'short';
    } else if (trade.trend) {
      direction = trade.trend === 'up' ? 'long' : 'short';
    } else {
      direction = 'long';
    }

    // Handle result
    const isWin = trade.result === 'win';
    const isLose = trade.result === 'lose' || trade.result === 'loss';
    const isTie = trade.result === 'tie' || trade.result === 'draw';
    
    // P&L from API or calculate
    let pnl: number | undefined;
    if (trade.profit !== undefined) {
      pnl = trade.profit;
    }

    // Amount/lot
    const quantity = trade.amount || trade.lot || 0;

    // Entry/exit prices
    const entryPrice = trade.entry_price || trade.open_price || 0;
    const exitPrice = trade.exit_price || trade.close_price;

    // Date - new API uses closed_at, old uses created_at
    const entryDate = trade.closed_at || trade.created_at || new Date().toISOString();

    // Direction display for notes
    const dirDisplay = trade.direction?.toUpperCase() || trade.trend?.toUpperCase() || 'UNKNOWN';

    return {
      symbol,
      direction,
      entry_date: entryDate,
      entry_price: entryPrice,
      exit_price: exitPrice,
      quantity,
      pnl,
      fees: 0, // Binary options typically no fees
      status: 'closed', // Historical trades are always closed
      notes: `BinaryFaster #${trade.id} | ${dirDisplay} | ${trade.result?.toUpperCase() || 'UNKNOWN'}`,
      setup: 'Binary Option',
      outcome: isWin ? 'win' : (isLose ? 'loss' : (isTie ? 'breakeven' : undefined)),
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
 * @param email - BinaryFaster account email
 * @param password - BinaryFaster account password
 * @param mode - 'demo' or 'live' (default: 'live')
 */
export async function fetchBinaryFasterTrades(email: string, password: string, mode: 'demo' | 'live' = 'live'): Promise<{
  success: boolean;
  trades?: any[];
  balance?: { real: number; demo: number };
  error?: string;
  mode?: string;
}> {
  try {
    const service = new BinaryFasterService({ email, password });
    
    // Test connection first
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    // Set the correct mode before fetching trades
    const isDemo = mode === 'demo';
    await service.setMode(isDemo);
    console.log(`[BinaryFaster] Fetching ${mode.toUpperCase()} trades...`);

    // Get balance
    const balance = await service.getBalance();

    // Fetch trade history
    const trades = await service.getTradeHistory(100);
    const journalEntries = trades.map(t => BinaryFasterService.toJournalEntry(t));

    return {
      success: true,
      trades: journalEntries,
      balance,
      mode,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}
