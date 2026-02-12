/**
 * TradeLocker API Service
 * Integration with TradeLocker platform (popular prop firm platform)
 * 
 * TradeLocker uses JWT authentication:
 * 1. Login with email/password to get access token
 * 2. Use token to access API endpoints
 * 
 * Reference: https://tradelocker.com/docs/api
 */

interface TradeLockerCredentials {
  email: string;
  password: string;
  server?: string;  // e.g., 'demo.tradelocker.com' or 'live.tradelocker.com'
  accountId?: string;
}

interface TradeLockerSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

interface TradeLockerPosition {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  swap: number;
  commission: number;
  openTime: string;
  stopLoss?: number;
  takeProfit?: number;
}

interface TradeLockerOrder {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop';
  quantity: number;
  price: number;
  status: 'pending' | 'filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  avgFillPrice: number;
  createdAt: string;
  updatedAt: string;
}

interface TradeLockerTrade {
  id: string;
  positionId: string;
  symbol: string;
  side: 'long' | 'short';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  commission: number;
  swap: number;
  openTime: string;
  closeTime: string;
}

// TradeLocker API endpoints
const TRADELOCKER_API = 'https://api.tradelocker.com';
const TRADELOCKER_DEMO_API = 'https://demo-api.tradelocker.com';

export class TradeLockerService {
  private email: string;
  private password: string;
  private baseUrl: string;
  private accountId?: string;
  private session?: TradeLockerSession;

  constructor(credentials: TradeLockerCredentials, demo: boolean = true) {
    this.email = credentials.email;
    this.password = credentials.password;
    this.accountId = credentials.accountId;
    
    // Determine base URL
    if (credentials.server) {
      this.baseUrl = `https://${credentials.server}`;
    } else {
      this.baseUrl = demo ? TRADELOCKER_DEMO_API : TRADELOCKER_API;
    }
  }

  /**
   * Authenticate and get session token
   */
  private async authenticate(): Promise<void> {
    if (this.session && this.session.expiresAt > Date.now()) {
      return; // Still valid
    }

    const response = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: this.email,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Authentication failed' }));
      throw new Error(`TradeLocker auth error: ${error.message || response.statusText}`);
    }

    const data = await response.json();
    
    this.session = {
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || data.refresh_token,
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    };
  }

  /**
   * Make authenticated request
   */
  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    await this.authenticate();
    
    if (!this.session) {
      throw new Error('Not authenticated');
    }

    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.session.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      // Try to refresh token if expired
      if (response.status === 401 && this.session.refreshToken) {
        await this.refreshToken();
        return this.request(endpoint, method, body); // Retry
      }
      
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`TradeLocker API error: ${error.message || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Refresh access token
   */
  private async refreshToken(): Promise<void> {
    if (!this.session?.refreshToken) {
      this.session = undefined;
      await this.authenticate();
      return;
    }

    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: this.session.refreshToken,
      }),
    });

    if (!response.ok) {
      this.session = undefined;
      await this.authenticate();
      return;
    }

    const data = await response.json();
    this.session = {
      accessToken: data.accessToken || data.access_token,
      refreshToken: data.refreshToken || this.session.refreshToken,
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    };
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<{ success: boolean; error?: string; accounts?: any[] }> {
    try {
      await this.authenticate();
      const accounts = await this.getAccounts();
      return {
        success: true,
        accounts,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get trading accounts
   */
  async getAccounts(): Promise<any[]> {
    const response = await this.request('/accounts');
    return response.data || response.accounts || response || [];
  }

  /**
   * Get account info
   */
  async getAccountInfo(accountId?: string): Promise<any> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    return this.request(`/accounts/${accId}`);
  }

  /**
   * Get open positions
   */
  async getPositions(accountId?: string): Promise<TradeLockerPosition[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    const response = await this.request(`/accounts/${accId}/positions`);
    return response.data || response.positions || response || [];
  }

  /**
   * Get trade history
   */
  async getTrades(accountId?: string, options?: { from?: string; to?: string; limit?: number }): Promise<TradeLockerTrade[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');

    let endpoint = `/accounts/${accId}/history`;
    const params = new URLSearchParams();
    
    if (options?.from) params.append('from', options.from);
    if (options?.to) params.append('to', options.to);
    if (options?.limit) params.append('limit', options.limit.toString());
    
    if (params.toString()) {
      endpoint += `?${params.toString()}`;
    }

    const response = await this.request(endpoint);
    return response.data || response.trades || response.history || response || [];
  }

  /**
   * Get orders
   */
  async getOrders(accountId?: string): Promise<TradeLockerOrder[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    const response = await this.request(`/accounts/${accId}/orders`);
    return response.data || response.orders || response || [];
  }

  /**
   * Get account balance
   */
  async getBalance(accountId?: string): Promise<{ balance: number; equity: number; margin: number; freeMargin: number }> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    const info = await this.getAccountInfo(accId);
    
    return {
      balance: info.balance || 0,
      equity: info.equity || 0,
      margin: info.margin || info.usedMargin || 0,
      freeMargin: info.freeMargin || (info.equity - info.margin) || 0,
    };
  }

  /**
   * Convert trade to journal entry format
   */
  static toJournalEntry(trade: TradeLockerTrade): {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entry_price: number;
    exit_price: number;
    quantity: number;
    entry_time: string;
    exit_time: string;
    fees: number;
    pnl: number;
    status: 'closed';
    notes: string;
    external_id: string;
    source: string;
  } {
    return {
      symbol: trade.symbol,
      direction: trade.side === 'long' ? 'LONG' : 'SHORT',
      entry_price: trade.entryPrice,
      exit_price: trade.exitPrice,
      quantity: trade.quantity,
      entry_time: trade.openTime,
      exit_time: trade.closeTime,
      fees: trade.commission + trade.swap,
      pnl: trade.pnl,
      status: 'closed',
      notes: `TradeLocker Position #${trade.positionId}`,
      external_id: trade.id,
      source: 'tradelocker',
    };
  }
}

/**
 * Validate TradeLocker credentials
 */
export async function validateTradeLockerCredentials(
  email: string, 
  password: string, 
  demo: boolean = true
): Promise<{
  valid: boolean;
  error?: string;
  accounts?: any[];
}> {
  const service = new TradeLockerService({ email, password }, demo);
  return service.testConnection();
}

/**
 * Fetch trades from TradeLocker
 */
export async function fetchTradeLockerTrades(
  email: string,
  password: string,
  accountId: string,
  demo: boolean = true
): Promise<{
  success: boolean;
  trades?: any[];
  error?: string;
}> {
  try {
    const service = new TradeLockerService({ email, password, accountId }, demo);
    
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    // Fetch last 90 days
    const from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const trades = await service.getTrades(accountId, { from });
    const journalEntries = trades.map(t => TradeLockerService.toJournalEntry(t));

    return {
      success: true,
      trades: journalEntries,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * NOTE: TradeLocker Integration
 * 
 * TradeLocker is used by many prop firms:
 * - The5%ers
 * - E8 Funding
 * - True Forex Funds
 * - And others
 * 
 * API might vary slightly between prop firms using TradeLocker.
 * Users need to check their specific prop firm's API documentation.
 * 
 * Authentication:
 * - Email/password login
 * - JWT tokens with refresh
 * - Some firms may use different auth methods
 */
