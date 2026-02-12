/**
 * Binance API Service
 * Real integration for fetching trades from Binance
 */

import crypto from 'crypto';

const BINANCE_API_URL = 'https://api.binance.com';
const BINANCE_TESTNET_URL = 'https://testnet.binance.vision';

interface BinanceCredentials {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
}

interface BinanceTrade {
  symbol: string;
  id: number;
  orderId: number;
  side: 'BUY' | 'SELL';
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  isBuyer: boolean;
  isMaker: boolean;
}

interface BinanceAccountInfo {
  balances: Array<{ asset: string; free: string; locked: string }>;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
}

export class BinanceService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(credentials: BinanceCredentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.baseUrl = credentials.testnet ? BINANCE_TESTNET_URL : BINANCE_API_URL;
  }

  /**
   * Generate HMAC SHA256 signature for authenticated requests
   */
  private sign(queryString: string): string {
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
  }

  /**
   * Make authenticated request to Binance API
   */
  private async signedRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const timestamp = Date.now();
    const queryParams = new URLSearchParams({
      ...params,
      timestamp: timestamp.toString(),
      recvWindow: '5000',
    });
    
    const signature = this.sign(queryParams.toString());
    queryParams.append('signature', signature);

    const url = `${this.baseUrl}${endpoint}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ msg: 'Unknown error' }));
      throw new Error(`Binance API error: ${error.msg || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test connection and validate credentials
   */
  async testConnection(): Promise<{ success: boolean; error?: string; canTrade?: boolean }> {
    try {
      const info = await this.signedRequest('/api/v3/account') as BinanceAccountInfo;
      return {
        success: true,
        canTrade: info.canTrade,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get account balances
   */
  async getBalances(): Promise<Array<{ asset: string; free: number; locked: number }>> {
    const info = await this.signedRequest('/api/v3/account') as BinanceAccountInfo;
    return info.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: parseFloat(b.free),
        locked: parseFloat(b.locked),
      }));
  }

  /**
   * Get trade history for a symbol
   */
  async getTrades(symbol: string, limit: number = 500): Promise<BinanceTrade[]> {
    return this.signedRequest('/api/v3/myTrades', { symbol, limit });
  }

  /**
   * Get all trades across multiple symbols
   */
  async getAllTrades(symbols: string[] = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT']): Promise<BinanceTrade[]> {
    const allTrades: BinanceTrade[] = [];
    
    for (const symbol of symbols) {
      try {
        const trades = await this.getTrades(symbol);
        allTrades.push(...trades);
      } catch (error) {
        console.error(`Failed to fetch trades for ${symbol}:`, error);
      }
    }

    // Sort by time descending
    return allTrades.sort((a, b) => b.time - a.time);
  }

  /**
   * Convert Binance trade to Journal entry format
   */
  static toJournalEntry(trade: BinanceTrade): {
    symbol: string;
    direction: 'long' | 'short';
    entry_date: string;
    entry_price: number;
    quantity: number;
    fees: number;
    status: 'closed';
    notes: string;
  } {
    return {
      symbol: trade.symbol,
      direction: trade.side === 'BUY' ? 'long' : 'short',
      entry_date: new Date(trade.time).toISOString(),
      entry_price: parseFloat(trade.price),
      quantity: parseFloat(trade.qty),
      fees: parseFloat(trade.commission),
      status: 'closed',
      notes: `Binance Trade #${trade.id} | Order #${trade.orderId} | ${trade.isMaker ? 'Maker' : 'Taker'}`,
    };
  }
}

/**
 * Validate Binance credentials without storing them
 */
export async function validateBinanceCredentials(apiKey: string, apiSecret: string, testnet: boolean = false): Promise<{
  valid: boolean;
  error?: string;
  canTrade?: boolean;
}> {
  const service = new BinanceService({ apiKey, apiSecret, testnet });
  const result = await service.testConnection();
  return {
    valid: result.success,
    error: result.error,
    canTrade: result.canTrade,
  };
}

/**
 * Fetch trades from Binance for syncing to Journal
 */
export async function fetchBinanceTrades(apiKey: string, apiSecret: string, testnet: boolean = false): Promise<{
  success: boolean;
  trades?: any[];
  error?: string;
}> {
  try {
    const service = new BinanceService({ apiKey, apiSecret, testnet });
    
    // Test connection first
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    // Fetch trades for common pairs
    const commonPairs = [
      'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
      'DOGEUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT'
    ];
    
    const trades = await service.getAllTrades(commonPairs);
    const journalEntries = trades.map(t => BinanceService.toJournalEntry(t));

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
