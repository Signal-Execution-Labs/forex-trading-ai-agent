/**
 * Bybit API Service
 * Real integration for fetching trades from Bybit
 */

import crypto from 'crypto';

const BYBIT_API_URL = 'https://api.bybit.com';
const BYBIT_TESTNET_URL = 'https://api-testnet.bybit.com';

interface BybitCredentials {
  apiKey: string;
  apiSecret: string;
  testnet?: boolean;
}

export class BybitService {
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(credentials: BybitCredentials) {
    this.apiKey = credentials.apiKey;
    this.apiSecret = credentials.apiSecret;
    this.baseUrl = credentials.testnet ? BYBIT_TESTNET_URL : BYBIT_API_URL;
  }

  /**
   * Generate HMAC SHA256 signature for authenticated requests
   */
  private sign(timestamp: string, params: string): string {
    const signStr = timestamp + this.apiKey + '5000' + params;
    return crypto
      .createHmac('sha256', this.apiSecret)
      .update(signStr)
      .digest('hex');
  }

  /**
   * Make authenticated request to Bybit API
   */
  private async signedRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
    const timestamp = Date.now().toString();
    const queryString = new URLSearchParams(params).toString();
    const signature = this.sign(timestamp, queryString);

    const url = `${this.baseUrl}${endpoint}${queryString ? '?' + queryString : ''}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': this.apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': '5000',
        'X-BAPI-SIGN': signature,
      },
    });

    const data = await response.json();
    
    if (data.retCode !== 0) {
      throw new Error(`Bybit API error: ${data.retMsg}`);
    }

    return data.result;
  }

  /**
   * Test connection and validate credentials
   */
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      await this.signedRequest('/v5/account/wallet-balance', { accountType: 'UNIFIED' });
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get trade history
   */
  async getTrades(category: string = 'spot', limit: number = 50): Promise<any[]> {
    const result = await this.signedRequest('/v5/execution/list', {
      category,
      limit: limit.toString(),
    });
    return result.list || [];
  }

  /**
   * Get closed P&L (for futures)
   */
  async getClosedPnL(category: string = 'linear', limit: number = 50): Promise<any[]> {
    const result = await this.signedRequest('/v5/position/closed-pnl', {
      category,
      limit: limit.toString(),
    });
    return result.list || [];
  }
}

/**
 * Validate Bybit credentials
 */
export async function validateBybitCredentials(apiKey: string, apiSecret: string, testnet: boolean = false): Promise<{
  valid: boolean;
  error?: string;
}> {
  const service = new BybitService({ apiKey, apiSecret, testnet });
  return service.testConnection();
}

/**
 * Fetch trades from Bybit
 */
export async function fetchBybitTrades(apiKey: string, apiSecret: string, testnet: boolean = false): Promise<{
  success: boolean;
  trades?: any[];
  error?: string;
}> {
  try {
    const service = new BybitService({ apiKey, apiSecret, testnet });
    
    const test = await service.testConnection();
    if (!test.success) {
      return { success: false, error: test.error };
    }

    const spotTrades = await service.getTrades('spot');
    const linearTrades = await service.getTrades('linear');
    
    const allTrades = [...spotTrades, ...linearTrades].map(trade => ({
      symbol: trade.symbol,
      direction: trade.side === 'Buy' ? 'long' : 'short',
      entry_date: new Date(parseInt(trade.execTime)).toISOString(),
      entry_price: parseFloat(trade.execPrice),
      quantity: parseFloat(trade.execQty),
      fees: parseFloat(trade.execFee || '0'),
      status: 'closed',
      notes: `Bybit Trade | ${trade.execType} | Order #${trade.orderId}`,
    }));

    return { success: true, trades: allTrades };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
