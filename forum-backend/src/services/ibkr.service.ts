/**
 * Interactive Brokers (IBKR) Service
 * Integration via Client Portal API (Web API Gateway)
 * 
 * IBKR requires either:
 * 1. TWS (Trader Workstation) running locally
 * 2. IB Gateway running locally
 * 3. Client Portal API (cpapi) - web-based, more accessible
 * 
 * This implementation uses Client Portal API for easier cloud deployment.
 * Reference: https://interactivebrokers.github.io/cpwebapi/
 */

interface IBKRCredentials {
  gatewayHost?: string;   // localhost:5000 for local, or IBKR's gateway URL
  accountId?: string;     // IBKR account ID (e.g., U1234567)
  isLive?: boolean;       // Live vs Paper trading
}

interface IBKRExecution {
  execution_id: string;
  symbol: string;
  side: 'BUY' | 'SELL' | 'BOT' | 'SLD';
  size: number;
  price: number;
  time: string;
  exchange: string;
  commission: number;
  realizedPnl: number;
  acctNumber: string;
  conid: number;
}

interface IBKRPosition {
  acctId: string;
  conid: number;
  contractDesc: string;
  position: number;
  mktPrice: number;
  mktValue: number;
  currency: string;
  avgCost: number;
  avgPrice: number;
  realizedPnl: number;
  unrealizedPnl: number;
}

interface IBKRTrade {
  execution_id: string;
  symbol: string;
  conidex: string;
  side: string;
  orderRef: string;
  submitter: string;
  exchange: string;
  companyName: string;
  contractDescription1: string;
  sec_type: string;
  listing_exchange: string;
  is_event_trading: string;
  lastLiquidityInd: string;
  order_description: string;
  trade_time: string;
  trade_time_r: number;
  size: string;
  price: string;
  order_ref: string;
  commission: string;
  net_amount: string;
  account: string;
  acctCode: string;
  acctName: string;
  position: string;
  clearing_id: string;
  clearing_name: string;
  direction: string;
}

// Default gateway URL (localhost for TWS/Gateway)
const DEFAULT_GATEWAY = 'https://localhost:5000';
// IBKR Client Portal Gateway (requires authentication)
const IBKR_PORTAL_GATEWAY = 'https://api.ibkr.com/v1/api';

export class IBKRService {
  private baseUrl: string;
  private accountId?: string;

  constructor(credentials: IBKRCredentials) {
    // Use provided gateway or default
    this.baseUrl = credentials.gatewayHost || DEFAULT_GATEWAY;
    this.accountId = credentials.accountId;
  }

  /**
   * Make request to IBKR API
   * Note: IBKR Client Portal requires session authentication
   */
  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'KIT-Trading-Journal/1.0',
        },
        body: body ? JSON.stringify(body) : undefined,
        // Important: IBKR uses self-signed certs locally
        // In Node.js, you may need to handle SSL differently
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`IBKR API error: ${response.status} - ${errorText}`);
      }

      return response.json();
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Cannot connect to IBKR Gateway. Make sure TWS or IB Gateway is running.');
      }
      throw error;
    }
  }

  /**
   * Test connection and authentication status
   */
  async testConnection(): Promise<{ success: boolean; error?: string; authenticated?: boolean; accounts?: any[] }> {
    try {
      // Check authentication status
      const status = await this.request('/iserver/auth/status', 'POST');
      
      if (!status.authenticated) {
        return {
          success: false,
          authenticated: false,
          error: 'Not authenticated. Please log in to TWS/IB Gateway.',
        };
      }

      // Get accounts
      const accounts = await this.request('/portfolio/accounts');
      
      return {
        success: true,
        authenticated: true,
        accounts: accounts || [],
      };
    } catch (error: any) {
      return {
        success: false,
        authenticated: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<any[]> {
    return this.request('/portfolio/accounts');
  }

  /**
   * Get positions for an account
   */
  async getPositions(accountId?: string): Promise<IBKRPosition[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    const positions = await this.request(`/portfolio/${accId}/positions/0`);
    return positions || [];
  }

  /**
   * Get trade history/executions
   */
  async getTrades(days: number = 7): Promise<IBKRTrade[]> {
    // IBKR trades endpoint
    const trades = await this.request('/iserver/account/trades');
    return trades || [];
  }

  /**
   * Get order history
   */
  async getOrders(filters?: { days?: number }): Promise<any[]> {
    const orders = await this.request('/iserver/account/orders');
    return orders?.orders || orders || [];
  }

  /**
   * Get P&L data
   */
  async getPnL(accountId?: string): Promise<any> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    return this.request(`/portfolio/${accId}/summary`);
  }

  /**
   * Keep session alive (required to prevent timeout)
   */
  async tickle(): Promise<boolean> {
    try {
      await this.request('/tickle', 'POST');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert IBKR trade to journal entry format
   */
  static toJournalEntry(trade: IBKRTrade): {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entry_date: string;
    entry_price: number;
    quantity: number;
    fees: number;
    notes: string;
    external_id: string;
    source: string;
  } {
    const side = trade.side || trade.direction;
    const isBuy = side.toUpperCase().includes('BUY') || side.toUpperCase() === 'BOT';
    
    return {
      symbol: trade.symbol || trade.contractDescription1,
      direction: isBuy ? 'LONG' : 'SHORT',
      entry_date: new Date(trade.trade_time_r || trade.trade_time).toISOString(),
      entry_price: parseFloat(trade.price),
      quantity: Math.abs(parseFloat(trade.size)),
      fees: parseFloat(trade.commission) || 0,
      notes: `IBKR ${trade.companyName || trade.symbol} | ${trade.exchange} | Order: ${trade.order_ref || 'N/A'}`,
      external_id: trade.execution_id,
      source: 'ibkr',
    };
  }
}

/**
 * Validate IBKR connection
 */
export async function validateIBKRConnection(gatewayHost?: string, accountId?: string): Promise<{
  valid: boolean;
  error?: string;
  accounts?: any[];
}> {
  const service = new IBKRService({ gatewayHost, accountId });
  const result = await service.testConnection();
  return {
    valid: result.success,
    error: result.error,
    accounts: result.accounts,
  };
}

/**
 * Fetch trades from IBKR
 */
export async function fetchIBKRTrades(gatewayHost?: string, accountId?: string): Promise<{
  success: boolean;
  trades?: any[];
  error?: string;
}> {
  try {
    const service = new IBKRService({ gatewayHost, accountId });
    
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    const trades = await service.getTrades(30); // Last 30 days
    const journalEntries = trades.map(t => IBKRService.toJournalEntry(t));

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
 * NOTE: IBKR Integration Requirements
 * 
 * Option 1: TWS/IB Gateway (Local)
 * - Install TWS or IB Gateway
 * - Enable API in settings (Edit > Global Config > API > Settings)
 * - Allow API connections from localhost
 * - Gateway runs on localhost:5000 by default
 * 
 * Option 2: Client Portal API (Web)
 * - More complex authentication (requires manual login)
 * - Better for web-based applications
 * - Session needs periodic refresh
 * 
 * Limitations:
 * - IBKR requires local software running for most API access
 * - Paper trading account needed for testing
 * - Rate limits apply
 */
