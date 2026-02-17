/**
 * K.I.T. Binary Options Tools
 * 
 * Real trading tools for BinaryFaster.com platform
 * Based on working Python implementation
 */

import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';
import { getAutonomousAgent } from '../core/autonomous-agent';

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
// Background Auto-Trade Function
// ============================================================================

async function runAutoTradesInBackground(
  assetId: number,
  assetName: string,
  baseAmount: number,
  duration: number,
  totalTrades: number,
  useMartingale: boolean,
  directionStrategy: string,
  agent: ReturnType<typeof getAutonomousAgent> | null
): Promise<void> {
  // Run in next tick to not block
  setImmediate(async () => {
    let currentAmount = baseAmount;
    let wins = 0;
    let losses = 0;
    let totalProfit = 0;

    for (let i = 0; i < totalTrades; i++) {
      // Determine direction
      let direction: 'call' | 'put';
      if (directionStrategy === 'call') {
        direction = 'call';
      } else if (directionStrategy === 'put') {
        direction = 'put';
      } else if (directionStrategy === 'alternate') {
        direction = i % 2 === 0 ? 'call' : 'put';
      } else {
        direction = Math.random() > 0.5 ? 'call' : 'put';
      }

      console.log(`[BinaryFaster] Trade ${i + 1}/${totalTrades}: ${direction.toUpperCase()} $${currentAmount} on ${assetName}`);

      // Place trade
      const tradeResult = await placeTrade(direction, assetId, currentAmount, duration);
      
      if (!tradeResult.success) {
        console.log(`[BinaryFaster] ❌ Trade ${i + 1} failed: ${tradeResult.message}`);
        if (agent) {
          agent.emit('notification', `❌ Trade ${i + 1}/${totalTrades} FAILED\n${tradeResult.message}`);
        }
        continue;
      }

      // Notify trade opened
      if (agent) {
        agent.emit('notification', `📊 Trade ${i + 1}/${totalTrades} GEÖFFNET\n\n${direction.toUpperCase()} $${currentAmount} ${assetName}\nTrade ID: ${tradeResult.tradeId}\n⏳ Warte ${duration}s auf Ergebnis...`);
      }

      // Wait for trade to expire + buffer
      const waitTime = (duration + 10) * 1000;
      console.log(`[BinaryFaster] ⏳ Waiting ${duration + 10}s for trade result...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Check actual result from trade history
      let isWin = false;
      try {
        const historyResponse = await fetch('https://wsauto.binaryfaster.com/automation/trades/history', {
          method: 'GET',
          headers: {
            'x-api-key': session.apiKey!,
            'User-Agent': 'K.I.T./2.0 TradingAgent',
          },
        });
        
        if (historyResponse.ok) {
          const history = await historyResponse.json() as Array<{
            id?: number;
            trade_id?: number;
            result?: string;
            profit?: number;
            status?: string;
          }>;
          
          const ourTrade = Array.isArray(history) ? history.find(t => 
            String(t.id || t.trade_id) === tradeResult.tradeId
          ) : null;
          
          if (ourTrade) {
            isWin = Boolean(
              (ourTrade.profit && ourTrade.profit > 0) || 
              (ourTrade.result && ourTrade.result.toLowerCase().includes('win')) ||
              (ourTrade.status && ourTrade.status.toLowerCase().includes('win'))
            );
            console.log(`[BinaryFaster] Trade ${tradeResult.tradeId} result: ${isWin ? 'WIN' : 'LOSS'}`);
          }
        }
      } catch (histError) {
        console.error('[BinaryFaster] Error checking trade result:', histError);
      }
      
      if (isWin) {
        wins++;
        const profit = currentAmount * 0.85;
        totalProfit += profit;
        console.log(`[BinaryFaster] ✅ Trade ${i + 1} WON! +$${profit.toFixed(2)}`);
        
        if (agent) {
          agent.emit('notification', `✅ Trade ${i + 1}/${totalTrades} GEWONNEN!\n\n${direction.toUpperCase()} $${currentAmount} ${assetName}\n💰 Profit: +$${profit.toFixed(2)}\n\n📈 Gesamt: ${wins}W/${losses}L ($${totalProfit.toFixed(2)})`);
        }
        
        if (useMartingale) {
          currentAmount = baseAmount;
        }
      } else {
        losses++;
        totalProfit -= currentAmount;
        console.log(`[BinaryFaster] ❌ Trade ${i + 1} LOST! -$${currentAmount.toFixed(2)}`);
        
        if (agent) {
          const nextAmount = useMartingale ? currentAmount * 2 : currentAmount;
          agent.emit('notification', `❌ Trade ${i + 1}/${totalTrades} VERLOREN!\n\n${direction.toUpperCase()} $${currentAmount} ${assetName}\n💸 Verlust: -$${currentAmount.toFixed(2)}\n\n📉 Gesamt: ${wins}W/${losses}L ($${totalProfit.toFixed(2)})${useMartingale ? `\n📈 Martingale: Nächster Trade $${nextAmount}` : ''}`);
        }
        
        if (useMartingale) {
          currentAmount *= 2;
        }
      }
    }

    // Final summary
    const winRate = ((wins / totalTrades) * 100).toFixed(1);
    const summaryMsg = `🏁 **AUTO-TRADE ABGESCHLOSSEN**

📊 Asset: ${assetName}
🔢 Trades: ${totalTrades}
✅ Gewonnen: ${wins}
❌ Verloren: ${losses}
📈 Win Rate: ${winRate}%
💰 Gesamt P&L: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}
💵 Mode: ${session.demoMode ? 'DEMO' : 'REAL 💰'}`;

    console.log(`[BinaryFaster] 🏁 Auto-trade complete: ${wins}W/${losses}L, Profit: $${totalProfit.toFixed(2)}`);
    
    if (agent) {
      agent.emit('notification', summaryMsg);
    }
  });
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
    name: 'binary_assets',
    description: 'Get list of all available assets/currency pairs on BinaryFaster with their IDs',
    parameters: {
      type: 'object',
      properties: {},
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
    description: 'Execute multiple trades automatically with Martingale strategy. This will place trades, wait for results, and continue.',
    parameters: {
      type: 'object',
      properties: {
        asset: {
          type: 'string',
          description: 'Asset to trade - MUST use exactly what user specified (e.g., EUR/USD)',
        },
        baseAmount: {
          type: 'number',
          description: 'Starting trade amount in USD',
        },
        duration: {
          type: 'number',
          description: 'Trade duration in seconds (120 = 2 min)',
          default: 120,
        },
        trades: {
          type: 'number',
          description: 'Number of trades to execute',
          default: 5,
        },
        martingale: {
          type: 'boolean',
          description: 'Use Martingale (double after loss, reset after win)',
          default: true,
        },
        direction: {
          type: 'string',
          enum: ['call', 'put', 'alternate', 'random'],
          description: 'Trade direction strategy',
          default: 'alternate',
        },
      },
      required: ['asset', 'baseAmount'],
    },
  },
];

// ============================================================================
// Asset ID Mapping (dynamic from API)
// ============================================================================

let cachedAssets: Array<{ id: number; name: string; symbol?: string }> = [];

async function fetchAssets(): Promise<void> {
  if (cachedAssets.length > 0) return;
  
  try {
    const response = await fetch('https://wsauto.binaryfaster.com/automation/traderoom/currency/all', {
      method: 'GET',
      headers: { 'User-Agent': 'K.I.T./2.0 TradingAgent' },
    });
    
    if (response.ok) {
      const data = await response.json() as Array<{ id: number; name: string; symbol?: string }>;
      if (Array.isArray(data)) {
        cachedAssets = data;
        console.log(`[BinaryFaster] Cached ${data.length} assets`);
      }
    }
  } catch (error) {
    console.error('[BinaryFaster] Failed to fetch assets:', error);
  }
}

function getAssetId(asset: string): number {
  const normalized = asset.toUpperCase().replace(/[\s\/\-]/g, '');
  
  // First try cached assets from API
  for (const a of cachedAssets) {
    const assetName = (a.name || a.symbol || '').toUpperCase().replace(/[\s\/\-]/g, '');
    if (assetName === normalized || assetName.includes(normalized) || normalized.includes(assetName)) {
      console.log(`[BinaryFaster] Found asset: ${a.name} = ID ${a.id}`);
      return a.id;
    }
  }
  
  // Fallback: search by partial match
  for (const a of cachedAssets) {
    const assetName = (a.name || a.symbol || '').toUpperCase();
    const parts = normalized.match(/.{3}/g) || [normalized];
    for (const part of parts) {
      if (assetName.includes(part)) {
        console.log(`[BinaryFaster] Partial match: ${a.name} = ID ${a.id}`);
        return a.id;
      }
    }
  }
  
  console.log(`[BinaryFaster] ⚠️ Asset "${asset}" not found, using first available`);
  return cachedAssets.length > 0 ? cachedAssets[0].id : 1;
}

function getAssetName(id: number): string {
  for (const a of cachedAssets) {
    if (a.id === id) {
      return a.name || a.symbol || `Asset ${id}`;
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
      // Fetch available assets after login
      await fetchAssets();
      
      const balance = await getBalance();
      
      // Register with autonomous agent so platform is tracked
      try {
        const agent = getAutonomousAgent();
        await agent.addPlatform({
          platform: 'binaryfaster',
          credentials: { email, password },
          enabled: true,
          balance: session.demoMode ? balance.demo : balance.real,
          lastSync: new Date().toISOString(),
        });
        console.log('[BinaryFaster] Registered with autonomous agent');
      } catch (e) {
        console.log('[BinaryFaster] Warning: Could not register with autonomous agent:', e);
      }
      
      return {
        success: true,
        message: `✅ Logged in to BinaryFaster as ${email}`,
        balance,
        mode: session.demoMode ? 'DEMO' : 'REAL',
        assetsLoaded: cachedAssets.length,
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
    
    // Ensure assets are loaded
    await fetchAssets();
    
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
    
    // Ensure assets are loaded
    await fetchAssets();
    
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

  binary_assets: async () => {
    try {
      const response = await fetch('https://wsauto.binaryfaster.com/automation/traderoom/currency/all', {
        method: 'GET',
        headers: {
          'User-Agent': 'K.I.T./2.0 TradingAgent',
        },
      });

      if (!response.ok) {
        return { success: false, message: `Failed to fetch assets: ${response.status}` };
      }

      const data = await response.json() as Array<{ id: number; name: string; symbol?: string; payout?: number }>;
      
      // Cache the assets for later use
      if (Array.isArray(data)) {
        cachedAssets = data;
        console.log(`[BinaryFaster] Loaded ${data.length} assets`);
      }

      return {
        success: true,
        count: Array.isArray(data) ? data.length : 0,
        assets: Array.isArray(data) ? data.slice(0, 30).map(a => ({
          id: a.id,
          name: a.name || a.symbol,
          payout: a.payout,
        })) : data,
        message: 'Use the asset ID when placing trades',
      };
    } catch (error) {
      console.error('[BinaryFaster] Assets error:', error);
      return { success: false, message: `Error: ${error}` };
    }
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

    // Ensure assets are loaded
    await fetchAssets();

    const asset = args.asset as string;
    const baseAmount = args.baseAmount as number;
    const duration = (args.duration as number) || 120;
    const totalTrades = (args.trades as number) || 5;
    const useMartingale = args.martingale !== false;
    const directionStrategy = (args.direction as string) || 'alternate';
    const assetId = getAssetId(asset);
    const assetName = getAssetName(assetId);

    console.log(`[BinaryFaster] 🚀 Starting auto-trade: ${totalTrades} trades on ${assetName}`);
    console.log(`[BinaryFaster] Base amount: $${baseAmount}, Duration: ${duration}s, Martingale: ${useMartingale}`);

    // Get agent for notifications
    let agent: ReturnType<typeof getAutonomousAgent> | null = null;
    try {
      agent = getAutonomousAgent();
    } catch (e) {
      console.log('[BinaryFaster] Could not get agent for notifications');
    }

    // Send immediate confirmation
    const startMsg = `🚀 **AUTO-TRADE GESTARTET**

📊 Asset: ${assetName}
💰 Startbetrag: $${baseAmount}
⏱️ Duration: ${duration}s (${duration / 60} min)
🔢 Trades: ${totalTrades}
📈 Martingale: ${useMartingale ? 'JA' : 'NEIN'}
🎯 Strategie: ${directionStrategy}
💵 Mode: ${session.demoMode ? 'DEMO' : 'REAL 💰'}

Ich sende Updates nach jedem Trade...`;

    if (agent) {
      agent.emit('notification', startMsg);
    }

    // Run trades in background
    runAutoTradesInBackground(assetId, assetName, baseAmount, duration, totalTrades, useMartingale, directionStrategy, agent);

    // Return immediately
    return {
      success: true,
      message: startMsg,
      status: 'STARTED',
      asset: assetName,
      trades: totalTrades,
      mode: session.demoMode ? 'DEMO' : 'REAL',
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

/**
 * Get current BinaryFaster session state for dashboard
 */
export function getBinaryFasterState(): {
  loggedIn: boolean;
  email?: string;
  balance: { real: number; demo: number };
  demoMode: boolean;
} {
  return {
    loggedIn: session.loggedIn,
    email: session.email,
    balance: session.balance || { real: 0, demo: 0 },
    demoMode: session.demoMode,
  };
}
