/**
 * cTrader Open API Service
 * Integration with cTrader platform via Open API
 * 
 * cTrader uses OAuth2 for authentication:
 * 1. User authorizes app via OAuth
 * 2. Get access_token and refresh_token
 * 3. Use tokens to access cTrader Open API
 * 
 * Reference: https://connect.spotware.com/docs
 */

interface CTraderCredentials {
  accessToken: string;
  refreshToken?: string;
  accountId?: string;  // cTrader account ID
}

interface CTraderPosition {
  positionId: string;
  entryTimestamp: number;
  utcLastUpdateTimestamp: number;
  symbolId: string;
  symbolName: string;
  volume: number;
  entryPrice: number;
  swap: number;
  commission: number;
  marginRate: number;
  profit: number;
  pnl: number;
  pnlConverted: number;
  usedMargin: number;
  tradeSide: 'BUY' | 'SELL';
  tradeData: {
    closePrice?: number;
    closedVolume?: number;
    closedBalance?: number;
    closedTimestamp?: number;
  };
}

interface CTraderDeal {
  dealId: string;
  orderId: string;
  positionId: string;
  volume: number;
  filledVolume: number;
  symbolId: string;
  createTimestamp: number;
  executionTimestamp: number;
  utcLastUpdateTimestamp: number;
  executionPrice: number;
  tradeSide: 'BUY' | 'SELL';
  dealStatus: string;
  marginRate: number;
  commission: number;
  closePositionDetail?: {
    entryPrice: number;
    profit: number;
    swap: number;
    commission: number;
    balance: number;
    balanceVersion: number;
    quoteToDepositConversionRate: number;
  };
}

// cTrader Open API endpoints
const CTRADER_OPEN_API = 'https://api.ctrader.com';
const CTRADER_DEMO_API = 'https://demo-api.ctrader.com';

export class CTraderService {
  private accessToken: string;
  private baseUrl: string;
  private accountId?: string;

  constructor(credentials: CTraderCredentials, demo: boolean = false) {
    this.accessToken = credentials.accessToken;
    this.accountId = credentials.accountId;
    this.baseUrl = demo ? CTRADER_DEMO_API : CTRADER_OPEN_API;
  }

  /**
   * Make authenticated request to cTrader API
   */
  private async request(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(`cTrader API error: ${error.message || error.errorCode || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test connection and validate credentials
   */
  async testConnection(): Promise<{ success: boolean; error?: string; accounts?: any[] }> {
    try {
      // Get trading accounts
      const accounts = await this.request('/v2/trading-accounts');
      return {
        success: true,
        accounts: accounts.data || [],
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all trading accounts for the user
   */
  async getAccounts(): Promise<any[]> {
    const response = await this.request('/v2/trading-accounts');
    return response.data || [];
  }

  /**
   * Get open positions for an account
   */
  async getOpenPositions(accountId?: string): Promise<CTraderPosition[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');
    
    const response = await this.request(`/v2/trading-accounts/${accId}/positions`);
    return response.data || [];
  }

  /**
   * Get closed positions (deals) for an account
   */
  async getClosedDeals(accountId?: string, fromTimestamp?: number, toTimestamp?: number): Promise<CTraderDeal[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');

    // Default to last 30 days
    const from = fromTimestamp || Date.now() - 30 * 24 * 60 * 60 * 1000;
    const to = toTimestamp || Date.now();
    
    const response = await this.request(
      `/v2/trading-accounts/${accId}/deals?from=${from}&to=${to}`
    );
    return response.data || [];
  }

  /**
   * Get historical deals (closed trades)
   */
  async getHistoricalTrades(accountId?: string, days: number = 30): Promise<any[]> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');

    const fromTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
    const deals = await this.getClosedDeals(accId, fromTimestamp);

    // Group deals by position to get complete trades
    const positionMap = new Map<string, CTraderDeal[]>();
    
    for (const deal of deals) {
      const posId = deal.positionId;
      if (!positionMap.has(posId)) {
        positionMap.set(posId, []);
      }
      positionMap.get(posId)!.push(deal);
    }

    // Convert to trade format
    const trades: any[] = [];
    
    for (const [positionId, posDeals] of positionMap) {
      // Sort by execution time
      posDeals.sort((a, b) => a.executionTimestamp - b.executionTimestamp);
      
      // Find entry and exit deals
      const entryDeal = posDeals.find(d => 
        d.dealStatus === 'FILLED' && !d.closePositionDetail
      );
      const exitDeal = posDeals.find(d => 
        d.dealStatus === 'FILLED' && d.closePositionDetail
      );

      if (entryDeal) {
        trades.push({
          symbol: `Symbol_${entryDeal.symbolId}`, // Need to map symbol ID to name
          direction: entryDeal.tradeSide === 'BUY' ? 'LONG' : 'SHORT',
          entry_price: entryDeal.executionPrice,
          exit_price: exitDeal?.executionPrice || null,
          quantity: entryDeal.filledVolume / 100000000, // Convert from volume units
          entry_time: new Date(entryDeal.executionTimestamp).toISOString(),
          exit_time: exitDeal ? new Date(exitDeal.executionTimestamp).toISOString() : null,
          fees: entryDeal.commission + (exitDeal?.commission || 0),
          pnl: exitDeal?.closePositionDetail?.profit || null,
          external_id: positionId,
          source: 'ctrader',
          notes: `cTrader Position #${positionId}`,
        });
      }
    }

    return trades;
  }

  /**
   * Get account balance
   */
  async getBalance(accountId?: string): Promise<{ balance: number; equity: number; freeMargin: number }> {
    const accId = accountId || this.accountId;
    if (!accId) throw new Error('Account ID required');

    const response = await this.request(`/v2/trading-accounts/${accId}`);
    const account = response.data;
    
    return {
      balance: account.balance / 100, // Convert from cents
      equity: account.equity / 100,
      freeMargin: account.freeMargin / 100,
    };
  }

  /**
   * Convert cTrader deal to journal entry format
   */
  static toJournalEntry(deal: CTraderDeal, symbolName: string): {
    symbol: string;
    direction: 'LONG' | 'SHORT';
    entry_date: string;
    entry_price: number;
    exit_price?: number;
    quantity: number;
    fees: number;
    pnl?: number;
    status: 'open' | 'closed';
    notes: string;
    external_id: string;
  } {
    return {
      symbol: symbolName,
      direction: deal.tradeSide === 'BUY' ? 'LONG' : 'SHORT',
      entry_date: new Date(deal.executionTimestamp).toISOString(),
      entry_price: deal.executionPrice,
      exit_price: deal.closePositionDetail ? deal.executionPrice : undefined,
      quantity: deal.filledVolume / 100000000,
      fees: deal.commission,
      pnl: deal.closePositionDetail?.profit,
      status: deal.closePositionDetail ? 'closed' : 'open',
      notes: `cTrader Deal #${deal.dealId} | Order #${deal.orderId}`,
      external_id: deal.positionId,
    };
  }
}

/**
 * Validate cTrader credentials
 */
export async function validateCTraderCredentials(accessToken: string, demo: boolean = false): Promise<{
  valid: boolean;
  error?: string;
  accounts?: any[];
}> {
  const service = new CTraderService({ accessToken }, demo);
  return service.testConnection();
}

/**
 * Fetch trades from cTrader
 */
export async function fetchCTraderTrades(
  accessToken: string, 
  accountId: string, 
  demo: boolean = false
): Promise<{
  success: boolean;
  trades?: any[];
  error?: string;
}> {
  try {
    const service = new CTraderService({ accessToken, accountId }, demo);
    
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    const trades = await service.getHistoricalTrades(accountId, 90);

    return {
      success: true,
      trades,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * NOTE: cTrader OAuth Flow
 * 
 * To implement full OAuth:
 * 1. Register app at connect.spotware.com
 * 2. Redirect user to authorize URL:
 *    https://connect.spotware.com/apps/auth?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_REDIRECT&scope=trading
 * 3. After authorization, exchange code for tokens at:
 *    POST https://connect.spotware.com/apps/token
 * 4. Store refresh_token to get new access_token when expired
 * 
 * For now, users need to provide their cTrader access token directly.
 */
