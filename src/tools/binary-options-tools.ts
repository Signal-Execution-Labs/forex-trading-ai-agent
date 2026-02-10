/**
 * K.I.T. Binary Options Tools
 * 
 * Real trading tools for BinaryFaster.com platform
 * Based on working Python implementation
 */

import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';

// ============================================================================
// BinaryFaster Client (using fetch)
// ============================================================================

const API_BASE_URL = 'https://wsauto.binaryfaster.com/automation';

interface BinaryFasterSession {
  apiKey?: string;
  loggedIn: boolean;
  balance?: { real: number; demo: number };
  demoMode: boolean;
  email?: string;
}

let session: BinaryFasterSession = {
  loggedIn: false,
  demoMode: false,
};

async function binaryFasterLogin(email: string, password: string): Promise<boolean> {
  try {
    console.log(`[BinaryFaster] Logging in as ${email}...`);
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'K.I.T./2.0 TradingAgent',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      console.log(`[BinaryFaster] ❌ Login failed: ${response.status}`);
      return false;
    }

    const data = await response.json() as { api_key?: string };
    
    if (data.api_key) {
      session.apiKey = data.api_key;
      session.loggedIn = true;
      session.email = email;
      console.log('[BinaryFaster] ✅ Login successful');
      
      // Switch to REAL mode by default
      await setDemoMode(false);
      
      return true;
    }

    console.log('[BinaryFaster] ❌ Login failed: No API key in response');
    return false;
  } catch (error) {
    console.error('[BinaryFaster] Login error:', error);
    return false;
  }
}

async function getBalance(): Promise<{ real: number; demo: number }> {
  if (!session.apiKey) {
    return { real: 0, demo: 0 };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/user/balance`, {
      method: 'GET',
      headers: {
        'x-api-key': session.apiKey,
        'User-Agent': 'K.I.T./2.0 TradingAgent',
      },
    });

    if (!response.ok) {
      console.log(`[BinaryFaster] Balance error: ${response.status}`);
      return { real: 0, demo: 0 };
    }

    const data = await response.json() as { balance?: number; real?: number; amount?: number; demo?: number; demo_balance?: number };
    session.balance = {
      real: parseFloat(String(data.balance || data.real || data.amount || 0)),
      demo: parseFloat(String(data.demo || data.demo_balance || 0)),
    };
    
    console.log(`[BinaryFaster] Balance: Real=$${session.balance.real}, Demo=$${session.balance.demo}`);
    return session.balance;
  } catch (error) {
    console.error('[BinaryFaster] Balance error:', error);
    return { real: 0, demo: 0 };
  }
}

async function setDemoMode(demo: boolean): Promise<boolean> {
  if (!session.apiKey) {
    return false;
  }

  try {
    const endpoint = demo ? '/traderoom/setdemo/1' : '/traderoom/setdemo/0';
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'x-api-key': session.apiKey,
        'User-Agent': 'K.I.T./2.0 TradingAgent',
      },
    });

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
  if (!session.apiKey) {
    return { success: false, message: 'Not logged in' };
  }

  try {
    const payload = {
      trend: direction === 'call' ? 'up' : 'down',
      lot: amount,
      currency_id: assetId,
      binarytime: duration,
    };

    console.log(`[BinaryFaster] Opening ${direction.toUpperCase()} trade: $${amount} on asset ${assetId}`);

    const response = await fetch(`${API_BASE_URL}/trades/open`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': session.apiKey,
        'User-Agent': 'K.I.T./2.0 TradingAgent',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`[BinaryFaster] Trade error: ${response.status} - ${errorText}`);
      return { success: false, message: `Trade failed: ${response.status}` };
    }

    const data = await response.json() as { trade_id?: string | number; id?: string | number };
    const tradeId = data.trade_id || data.id;

    console.log(`[BinaryFaster] ✅ Trade opened: ID=${tradeId}`);
    return {
      success: true,
      tradeId: String(tradeId),
      message: `${direction.toUpperCase()} trade of $${amount} placed successfully`,
    };
  } catch (error) {
    console.error('[BinaryFaster] Trade error:', error);
    return { success: false, message: `Trade error: ${error}` };
  }
}

async function getTradeHistory(limit: number = 20): Promise<unknown[]> {
  if (!session.apiKey) {
    return [];
  }

  try {
    const response = await fetch(`${API_BASE_URL}/trades/history`, {
      method: 'GET',
      headers: {
        'x-api-key': session.apiKey,
        'User-Agent': 'K.I.T./2.0 TradingAgent',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data.slice(0, limit) : [];
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
          description: 'Trade duration in seconds (60=1min, 120=2min, 180=3min, 300=5min)',
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
          description: 'Trade duration in seconds (60=1min, 120=2min, 180=3min, 300=5min)',
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
];

// ============================================================================
// Asset ID Mapping
// ============================================================================

const ASSET_IDS: Record<string, number> = {
  'EUR/USD': 159,
  'EURUSD': 159,
  'GBP/USD': 160,
  'GBPUSD': 160,
  'AUD/USD': 161,
  'AUDUSD': 161,
  'USD/JPY': 162,
  'USDJPY': 162,
  'USD/CHF': 163,
  'USDCHF': 163,
  'USD/CAD': 164,
  'USDCAD': 164,
  'BTC/USD': 200,
  'BTCUSD': 200,
  'ETH/USD': 201,
  'ETHUSD': 201,
  'GOLD': 250,
  'XAU/USD': 250,
};

function getAssetId(asset: string): number {
  const normalized = asset.toUpperCase().replace(/\s+/g, '');
  return ASSET_IDS[normalized] || 159; // Default to EUR/USD
}

function getAssetName(id: number): string {
  for (const [name, assetId] of Object.entries(ASSET_IDS)) {
    if (assetId === id && name.includes('/')) {
      return name;
    }
  }
  return `Asset ${id}`;
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
    const balance = await getBalance();
    
    return {
      success: true,
      mode: demo ? 'DEMO' : 'REAL',
      activeBalance: demo ? balance.demo : balance.real,
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
      direction: 'CALL (UP) 📈',
      asset: getAssetName(assetId),
      assetId,
      amount,
      duration: `${duration} seconds (${duration / 60} min)`,
      mode: session.demoMode ? 'DEMO' : 'REAL 💰',
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
      direction: 'PUT (DOWN) 📉',
      asset: getAssetName(assetId),
      assetId,
      amount,
      duration: `${duration} seconds (${duration / 60} min)`,
      mode: session.demoMode ? 'DEMO' : 'REAL 💰',
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
