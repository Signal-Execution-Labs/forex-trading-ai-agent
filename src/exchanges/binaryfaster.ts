/**
 * BinaryFaster API Integration
 * Binary Options Trading Platform
 * 
 * API Base: https://wsauto.binaryfaster.com
 */

import axios, { AxiosInstance } from 'axios';

const API_BASE = 'https://wsauto.binaryfaster.com';

export interface BinaryFasterConfig {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface TradeParams {
  trend: 'up' | 'down';  // up = CALL, down = PUT
  lot: number;           // Amount in USD
  currency_id: number;   // Asset ID
  binarytime: number;    // Duration in seconds (60, 120, 180, 300, etc.)
}

export interface Balance {
  real: number;
  demo: number;
  currency: string;
}

export interface Asset {
  id: number;
  name: string;
  symbol: string;
  payout: number;
  is_active: boolean;
}

export interface Trade {
  id: number;
  trend: string;
  lot: number;
  currency_id: number;
  binarytime: number;
  open_price: number;
  close_price?: number;
  result?: 'win' | 'loss' | 'tie';
  pnl?: number;
  created_at: string;
}

export class BinaryFasterClient {
  private apiKey: string | null = null;
  private client: AxiosInstance;
  private isDemo: boolean = true;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
    });
  }

  /**
   * Login to BinaryFaster
   * Returns true if 2FA is required
   */
  async login(email: string, password: string): Promise<{ success: boolean; requires2FA: boolean; error?: string }> {
    try {
      const response = await this.client.post('/automation/auth/login', {
        email,
        password,
      });

      const data = response.data;

      // Check if 2FA is required
      if (data.requires_2fa || data.two_factor_required) {
        return { success: false, requires2FA: true };
      }

      if (data.api_key) {
        this.apiKey = data.api_key;
        this.setAuthHeader();
        return { success: true, requires2FA: false };
      }

      return { success: false, requires2FA: false, error: data.message || 'Login failed' };
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      
      // Check for 2FA in error response
      if (message.includes('2FA') || message.includes('two-factor') || error.response?.data?.requires_2fa) {
        return { success: false, requires2FA: true };
      }
      
      return { success: false, requires2FA: false, error: message };
    }
  }

  /**
   * Complete login with 2FA code
   */
  async login2FA(email: string, password: string, twoFactorCode: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.client.post('/automation/auth/login', {
        email,
        password,
        two_factor_code: twoFactorCode,
        totp_code: twoFactorCode, // Try both field names
      });

      const data = response.data;

      if (data.api_key) {
        this.apiKey = data.api_key;
        this.setAuthHeader();
        return { success: true };
      }

      return { success: false, error: data.message || 'Login failed' };
    } catch (error: any) {
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  private setAuthHeader(): void {
    this.client.defaults.headers.common['x-api-key'] = this.apiKey;
  }

  /**
   * Get user info
   */
  async getUserInfo(): Promise<any> {
    this.ensureAuthenticated();
    const response = await this.client.get('/automation/user/info');
    return response.data;
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<Balance> {
    this.ensureAuthenticated();
    const response = await this.client.get('/automation/user/balance');
    return response.data;
  }

  /**
   * Switch to demo account
   */
  async setDemoMode(demo: boolean = true): Promise<void> {
    this.ensureAuthenticated();
    const endpoint = demo ? '/automation/traderoom/setdemo/1' : '/automation/traderoom/setdemo/0';
    await this.client.get(endpoint);
    this.isDemo = demo;
  }

  /**
   * Get all available assets
   */
  async getAssets(): Promise<Asset[]> {
    const response = await this.client.get('/automation/traderoom/currency/all');
    return response.data;
  }

  /**
   * Get asset info by ID
   */
  async getAssetInfo(assetId: number): Promise<Asset> {
    const response = await this.client.get(`/automation/traderoom/currency/info/${assetId}`);
    return response.data;
  }

  /**
   * Get active (open) trades
   */
  async getActiveTrades(): Promise<Trade[]> {
    this.ensureAuthenticated();
    const response = await this.client.get('/automation/trades/active');
    return response.data;
  }

  /**
   * Get trade history (last 50)
   */
  async getTradeHistory(): Promise<Trade[]> {
    this.ensureAuthenticated();
    const response = await this.client.get('/automation/trades/history');
    return response.data;
  }

  /**
   * Open a new trade
   */
  async openTrade(params: TradeParams): Promise<Trade> {
    this.ensureAuthenticated();
    
    const response = await this.client.post('/automation/trades/open', {
      trend: params.trend,
      lot: params.lot,
      currency_id: params.currency_id,
      binarytime: params.binarytime,
    });

    return response.data;
  }

  /**
   * Open a CALL trade (price goes UP)
   */
  async call(assetId: number, amount: number, duration: number = 60): Promise<Trade> {
    return this.openTrade({
      trend: 'up',
      lot: amount,
      currency_id: assetId,
      binarytime: duration,
    });
  }

  /**
   * Open a PUT trade (price goes DOWN)
   */
  async put(assetId: number, amount: number, duration: number = 60): Promise<Trade> {
    return this.openTrade({
      trend: 'down',
      lot: amount,
      currency_id: assetId,
      binarytime: duration,
    });
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.apiKey !== null;
  }

  /**
   * Get current mode
   */
  isDemoMode(): boolean {
    return this.isDemo;
  }

  private ensureAuthenticated(): void {
    if (!this.apiKey) {
      throw new Error('Not authenticated. Call login() first.');
    }
  }
}

// Common asset IDs for reference
export const ASSETS = {
  // Forex
  EUR_USD: 159,
  GBP_USD: 160,
  USD_JPY: 161,
  AUD_USD: 162,
  USD_CAD: 163,
  EUR_GBP: 164,
  
  // Crypto
  BTC_USD: 200,
  ETH_USD: 201,
  
  // Commodities
  GOLD: 250,
  SILVER: 251,
};

// Trade durations
export const DURATIONS = {
  ONE_MINUTE: 60,
  TWO_MINUTES: 120,
  THREE_MINUTES: 180,
  FIVE_MINUTES: 300,
  FIFTEEN_MINUTES: 900,
  THIRTY_MINUTES: 1800,
  ONE_HOUR: 3600,
};

export default BinaryFasterClient;
