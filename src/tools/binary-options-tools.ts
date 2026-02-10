/**
 * K.I.T. Binary Options Tools
 * 
 * Real trading tools for BinaryFaster.com platform
 */

import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// BinaryFaster Client
// ============================================================================

interface BinaryFasterSession {
  cookies: string[];
  ssid?: string;
  loggedIn: boolean;
  balance?: { real: number; demo: number };
  demoMode: boolean;
}

let session: BinaryFasterSession = {
  cookies: [],
  loggedIn: false,
  demoMode: false,
};

async function httpRequest(
  method: string,
  hostname: string,
  path: string,
  data?: string,
  headers?: Record<string, string>
): Promise<{ statusCode: number; body: string; headers: Record<string, string | string[] | undefined> }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path,
      method,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...(session.cookies.length > 0 ? { Cookie: session.cookies.join('; ') } : {}),
        ...headers,
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        // Store cookies
        const setCookies = res.headers['set-cookie'];
        if (setCookies) {
          setCookies.forEach((cookie) => {
            const [nameValue] = cookie.split(';');
            const existingIndex = session.cookies.findIndex((c) =>
              c.startsWith(nameValue.split('=')[0] + '=')
            );
            if (existingIndex >= 0) {
              session.cookies[existingIndex] = nameValue;
            } else {
              session.cookies.push(nameValue);
            }
          });
        }
        resolve({ statusCode: res.statusCode || 0, body, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function binaryFasterLogin(email: string, password: string): Promise<boolean> {
  try {
    // Step 1: Get initial page for SSID
    const initResponse = await httpRequest('GET', 'wsauto.binaryfaster.com', '/');
    
    // Extract SSID from cookies
    const ssidCookie = session.cookies.find((c) => c.startsWith('ssid='));
    if (ssidCookie) {
      session.ssid = ssidCookie.split('=')[1];
    }

    // Step 2: Login
    const loginData = `login=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const loginResponse = await httpRequest(
      'POST',
      'wsauto.binaryfaster.com',
      '/login/ajax',
      loginData
    );

    if (loginResponse.body.includes('success') || loginResponse.body.includes('"result":1')) {
      session.loggedIn = true;
      console.log('[BinaryFaster] ✅ Login successful');
      return true;
    }

    console.log('[BinaryFaster] ❌ Login failed:', loginResponse.body);
    return false;
  } catch (error) {
    console.error('[BinaryFaster] Login error:', error);
    return false;
  }
}

async function getBalance(): Promise<{ real: number; demo: number }> {
  try {
    const response = await httpRequest('GET', 'wsauto.binaryfaster.com', '/api/profile/balance');
    const data = JSON.parse(response.body);
    session.balance = {
      real: parseFloat(data.real || data.balance || 0),
      demo: parseFloat(data.demo || data.demo_balance || 0),
    };
    return session.balance;
  } catch (error) {
    console.error('[BinaryFaster] Balance error:', error);
    return { real: 0, demo: 0 };
  }
}

async function setDemoMode(demo: boolean): Promise<boolean> {
  try {
    const response = await httpRequest(
      'POST',
      'wsauto.binaryfaster.com',
      '/api/profile/demo',
      `demo=${demo ? 1 : 0}`
    );
    session.demoMode = demo;
    console.log(`[BinaryFaster] Mode: ${demo ? 'DEMO' : 'REAL'}`);
    return true;
  } catch (error) {
    console.error('[BinaryFaster] Demo mode error:', error);
    return false;
  }
}

async function placeTrade(
  direction: 'call' | 'put',
  assetId: number,
  amount: number,
  duration: number
): Promise<{ success: boolean; tradeId?: string; message: string }> {
  try {
    const endpoint = direction === 'call' ? '/api/trade/call' : '/api/trade/put';
    const tradeData = `asset_id=${assetId}&amount=${amount}&duration=${duration}`;
    
    const response = await httpRequest(
      'POST',
      'wsauto.binaryfaster.com',
      endpoint,
      tradeData
    );

    const data = JSON.parse(response.body);
    
    if (data.success || data.result === 1 || data.trade_id) {
      console.log(`[BinaryFaster] ✅ ${direction.toUpperCase()} trade placed: $${amount}`);
      return {
        success: true,
        tradeId: data.trade_id || data.id,
        message: `${direction.toUpperCase()} trade of $${amount} placed successfully`,
      };
    }

    return {
      success: false,
      message: data.message || data.error || 'Trade failed',
    };
  } catch (error) {
    console.error('[BinaryFaster] Trade error:', error);
    return {
      success: false,
      message: `Trade error: ${error}`,
    };
  }
}

async function getTradeHistory(limit: number = 20): Promise<unknown[]> {
  try {
    const response = await httpRequest(
      'GET',
      'wsauto.binaryfaster.com',
      `/api/trade/history?limit=${limit}`
    );
    const data = JSON.parse(response.body);
    return data.trades || data.history || data || [];
  } catch (error) {
    console.error('[BinaryFaster] History error:', error);
    return [];
  }
}

// ============================================================================
// Tool Definitions (for LLM)
// ============================================================================

export const BINARY_OPTIONS_TOOLS: ChatToolDef[] = [
  {
    name: 'binary_login',
    description: 'Login to BinaryFaster.com trading platform',
    parameters: {
      type: 'object',
      properties: {
        email: {
          type: 'string',
          description: 'Account email',
        },
        password: {
          type: 'string',
          description: 'Account password',
        },
      },
      required: ['email', 'password'],
    },
  },
  {
    name: 'binary_balance',
    description: 'Get current BinaryFaster account balance (real and demo)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'binary_set_mode',
    description: 'Switch between DEMO and REAL trading mode on BinaryFaster',
    parameters: {
      type: 'object',
      properties: {
        demo: {
          type: 'boolean',
          description: 'true for demo mode, false for real money',
        },
      },
      required: ['demo'],
    },
  },
  {
    name: 'binary_call',
    description: 'Place a CALL (UP) trade on BinaryFaster - betting the price will go UP',
    parameters: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          description: 'Asset to trade (e.g., EUR/USD, GBP/USD, BTC/USD)',
        },
        amount: {
          type: 'number',
          description: 'Trade amount in USD',
        },
        duration: {
          type: 'number',
          description: 'Trade duration in seconds (60, 120, 180, 300 for 1-5 min)',
          default: 120,
        },
      },
      required: ['asset', 'amount'],
    },
  },
  {
    name: 'binary_put',
    description: 'Place a PUT (DOWN) trade on BinaryFaster - betting the price will go DOWN',
    parameters: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          description: 'Asset to trade (e.g., EUR/USD, GBP/USD, BTC/USD)',
        },
        amount: {
          type: 'number',
          description: 'Trade amount in USD',
        },
        duration: {
          type: 'number',
          description: 'Trade duration in seconds (60, 120, 180, 300 for 1-5 min)',
          default: 120,
        },
      },
      required: ['asset', 'amount'],
    },
  },
  {
    name: 'binary_history',
    description: 'Get recent trade history from BinaryFaster',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of trades to retrieve',
          default: 20,
        },
      },
    },
  },
  {
    name: 'binary_auto_trade',
    description: 'Start autonomous binary options trading with specified parameters',
    parameters: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          description: 'Asset to trade (e.g., EUR/USD)',
        },
        amount: {
          type: 'number',
          description: 'Base trade amount in USD',
        },
        duration: {
          type: 'number',
          description: 'Trade duration in seconds',
          default: 120,
        },
        trades: {
          type: 'number',
          description: 'Number of trades to execute',
          default: 10,
        },
        strategy: {
          type: 'string',
          enum: ['trend', 'martingale', 'random'],
          description: 'Trading strategy to use',
          default: 'trend',
        },
      },
      required: ['asset', 'amount'],
    },
  },
];

// ============================================================================
// Asset ID Mapping
// ============================================================================

const ASSET_IDS: Record<string, number> = {
  'EUR/USD': 159,
  'EURUSD': 159,
  'GBP/USD': 160,
  'GBPUSD': 160,
  'USD/JPY': 161,
  'USDJPY': 161,
  'AUD/USD': 162,
  'AUDUSD': 162,
  'USD/CAD': 163,
  'USDCAD': 163,
  'NZD/USD': 164,
  'NZDUSD': 164,
  'BTC/USD': 200,
  'BTCUSD': 200,
  'ETH/USD': 201,
  'ETHUSD': 201,
  'GOLD': 250,
  'XAU/USD': 250,
  'SILVER': 251,
  'XAG/USD': 251,
};

function getAssetId(asset: string): number {
  const normalized = asset.toUpperCase().replace(/\s+/g, '');
  return ASSET_IDS[normalized] || 159; // Default to EUR/USD
}

// ============================================================================
// Tool Handlers
// ============================================================================

export const BINARY_OPTIONS_HANDLERS: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  binary_login: async (args) => {
    const email = args.email as string;
    const password = args.password as string;
    
    const success = await binaryFasterLogin(email, password);
    
    if (success) {
      const balance = await getBalance();
      return {
        success: true,
        message: `✅ Logged in to BinaryFaster as ${email}`,
        balance,
        mode: session.demoMode ? 'DEMO' : 'REAL',
      };
    }
    
    return {
      success: false,
      message: '❌ Login failed. Please check your credentials.',
    };
  },

  binary_balance: async () => {
    if (!session.loggedIn) {
      return {
        success: false,
        message: '❌ Not logged in. Use binary_login first.',
      };
    }
    
    const balance = await getBalance();
    return {
      success: true,
      real: balance.real,
      demo: balance.demo,
      mode: session.demoMode ? 'DEMO' : 'REAL',
      activeBalance: session.demoMode ? balance.demo : balance.real,
    };
  },

  binary_set_mode: async (args) => {
    if (!session.loggedIn) {
      return {
        success: false,
        message: '❌ Not logged in. Use binary_login first.',
      };
    }
    
    const demo = args.demo as boolean;
    await setDemoMode(demo);
    
    return {
      success: true,
      mode: demo ? 'DEMO' : 'REAL',
      message: `✅ Switched to ${demo ? 'DEMO' : 'REAL'} mode`,
    };
  },

  binary_call: async (args) => {
    if (!session.loggedIn) {
      return {
        success: false,
        message: '❌ Not logged in. Use binary_login first.',
      };
    }
    
    const asset = args.asset as string;
    const amount = args.amount as number;
    const duration = (args.duration as number) || 120;
    const assetId = getAssetId(asset);
    
    const result = await placeTrade('call', assetId, amount, duration);
    
    return {
      ...result,
      direction: 'CALL (UP)',
      asset,
      amount,
      duration: `${duration} seconds`,
      mode: session.demoMode ? 'DEMO' : 'REAL',
    };
  },

  binary_put: async (args) => {
    if (!session.loggedIn) {
      return {
        success: false,
        message: '❌ Not logged in. Use binary_login first.',
      };
    }
    
    const asset = args.asset as string;
    const amount = args.amount as number;
    const duration = (args.duration as number) || 120;
    const assetId = getAssetId(asset);
    
    const result = await placeTrade('put', assetId, amount, duration);
    
    return {
      ...result,
      direction: 'PUT (DOWN)',
      asset,
      amount,
      duration: `${duration} seconds`,
      mode: session.demoMode ? 'DEMO' : 'REAL',
    };
  },

  binary_history: async (args) => {
    if (!session.loggedIn) {
      return {
        success: false,
        message: '❌ Not logged in. Use binary_login first.',
      };
    }
    
    const limit = (args.limit as number) || 20;
    const history = await getTradeHistory(limit);
    
    return {
      success: true,
      trades: history,
      count: Array.isArray(history) ? history.length : 0,
    };
  },

  binary_auto_trade: async (args) => {
    if (!session.loggedIn) {
      return {
        success: false,
        message: '❌ Not logged in. Use binary_login first.',
      };
    }
    
    const asset = args.asset as string;
    const amount = args.amount as number;
    const duration = (args.duration as number) || 120;
    const trades = (args.trades as number) || 10;
    const strategy = (args.strategy as string) || 'trend';
    const assetId = getAssetId(asset);
    
    const results: unknown[] = [];
    let wins = 0;
    let losses = 0;
    let currentAmount = amount;
    
    for (let i = 0; i < trades; i++) {
      // Simple strategy logic
      let direction: 'call' | 'put' = 'call';
      
      if (strategy === 'random') {
        direction = Math.random() > 0.5 ? 'call' : 'put';
      } else if (strategy === 'martingale') {
        // Double after loss
        if (results.length > 0) {
          const lastResult = results[results.length - 1] as { success: boolean };
          if (!lastResult.success) {
            currentAmount *= 2;
          } else {
            currentAmount = amount;
          }
        }
        direction = Math.random() > 0.5 ? 'call' : 'put';
      } else {
        // Trend following - alternate
        direction = i % 2 === 0 ? 'call' : 'put';
      }
      
      const result = await placeTrade(direction, assetId, currentAmount, duration);
      results.push({
        trade: i + 1,
        direction,
        amount: currentAmount,
        ...result,
      });
      
      // Wait for trade duration + buffer before next trade
      await new Promise((resolve) => setTimeout(resolve, (duration + 5) * 1000));
    }
    
    return {
      success: true,
      message: `✅ Completed ${trades} trades on ${asset}`,
      strategy,
      asset,
      duration: `${duration} seconds`,
      mode: session.demoMode ? 'DEMO' : 'REAL',
      results,
      summary: {
        totalTrades: trades,
        wins,
        losses,
      },
    };
  },
};

// ============================================================================
// Export
// ============================================================================

export function getBinaryOptionsTools(): ChatToolDef[] {
  return BINARY_OPTIONS_TOOLS;
}

export function getBinaryOptionsHandlers(): Record<string, (args: Record<string, unknown>) => Promise<unknown>> {
  return BINARY_OPTIONS_HANDLERS;
}
