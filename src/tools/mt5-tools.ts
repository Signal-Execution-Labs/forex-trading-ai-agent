/**
 * K.I.T. MetaTrader 5 Tools
 * 
 * Auto-connects to running MT5 terminal - NO CREDENTIALS NEEDED!
 * The MT5 terminal must be running and logged in already.
 */

import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';

// ============================================================================
// MT5 Tool Definitions (for LLM)
// ============================================================================

export const MT5_TOOLS: ChatToolDef[] = [
  {
    name: 'mt5_connect',
    description: 'Connect to the running MetaTrader 5 terminal. NO credentials needed - connects to already logged-in terminal. Returns account info.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_account_info',
    description: 'Get account information from MT5 (balance, equity, margin, leverage)',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_positions',
    description: 'Get all open positions from MT5',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'mt5_market_order',
    description: 'Place a market order on MT5',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g., EURUSD, GBPUSD)',
        },
        order_type: {
          type: 'string',
          enum: ['buy', 'sell'],
          description: 'Order type',
        },
        volume: {
          type: 'number',
          description: 'Lot size (e.g., 0.1)',
        },
        sl: {
          type: 'number',
          description: 'Stop loss price (optional)',
        },
        tp: {
          type: 'number',
          description: 'Take profit price (optional)',
        },
      },
      required: ['symbol', 'order_type', 'volume'],
    },
  },
  {
    name: 'mt5_close_position',
    description: 'Close a position by ticket number',
    parameters: {
      type: 'object',
      properties: {
        ticket: {
          type: 'number',
          description: 'Position ticket number to close',
        },
      },
      required: ['ticket'],
    },
  },
  {
    name: 'mt5_price',
    description: 'Get current bid/ask price for a symbol',
    parameters: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Trading symbol (e.g., EURUSD)',
        },
      },
      required: ['symbol'],
    },
  },
];

// ============================================================================
// MT5 Tool Handlers
// ============================================================================

/**
 * Execute Python MT5 script and return JSON result
 */
function execMT5Python(command: string): any {
  const scriptPath = path.join(__dirname, '../../skills/metatrader/scripts/auto_connect.py');
  
  // Check if script exists
  if (!fs.existsSync(scriptPath)) {
    return { success: false, error: 'MT5 script not found. Please ensure skills/metatrader is installed.' };
  }
  
  try {
    const result = execSync(`python "${scriptPath}" ${command}`, {
      encoding: 'utf-8',
      timeout: 30000,
      windowsHide: true,
    });
    return JSON.parse(result.trim());
  } catch (error: any) {
    // Check if MT5 module is installed
    if (error.message?.includes('ModuleNotFoundError') || error.message?.includes('MetaTrader5')) {
      return { 
        success: false, 
        error: 'MetaTrader5 Python module not installed. Run: pip install MetaTrader5' 
      };
    }
    // Check if MT5 terminal is running
    if (error.message?.includes('IPC') || error.message?.includes('initialize')) {
      return { 
        success: false, 
        error: 'MT5 Terminal not running. Please start MetaTrader 5 and log in first.' 
      };
    }
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export const MT5_TOOL_HANDLERS: Record<string, (args: any) => Promise<any>> = {
  mt5_connect: async () => {
    const result = execMT5Python('connect');
    if (result.success) {
      return {
        connected: true,
        account: result.account,
        message: `✅ Connected to MT5! Account: ${result.account.login} | Balance: ${result.account.balance} ${result.account.currency}`
      };
    }
    return result;
  },
  
  mt5_account_info: async () => {
    return execMT5Python('connect');
  },
  
  mt5_positions: async () => {
    return execMT5Python('positions');
  },
  
  mt5_market_order: async (args: { symbol: string; order_type: string; volume: number; sl?: number; tp?: number }) => {
    const { symbol, order_type, volume, sl, tp } = args;
    let cmd = `${order_type} ${symbol} ${volume}`;
    // Note: SL/TP would need script enhancement to support
    return execMT5Python(cmd);
  },
  
  mt5_close_position: async (args: { ticket: number }) => {
    return execMT5Python(`close ${args.ticket}`);
  },
  
  mt5_price: async (args: { symbol: string }) => {
    // Get price via connect (includes tick info)
    const scriptPath = path.join(__dirname, '../../skills/metatrader/scripts/auto_connect.py');
    
    const priceScript = `
import MetaTrader5 as mt5
import json
if mt5.initialize():
    tick = mt5.symbol_info_tick("${args.symbol}")
    if tick:
        print(json.dumps({"success": True, "symbol": "${args.symbol}", "bid": tick.bid, "ask": tick.ask, "spread": round((tick.ask - tick.bid) * 10000, 1)}))
    else:
        print(json.dumps({"success": False, "error": "Symbol not found"}))
    mt5.shutdown()
else:
    print(json.dumps({"success": False, "error": "MT5 not connected"}))
`;
    
    try {
      const result = execSync(`python -c "${priceScript.replace(/"/g, '\\"').replace(/\n/g, ';')}"`, {
        encoding: 'utf-8',
        timeout: 10000,
        windowsHide: true,
      });
      return JSON.parse(result.trim());
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

/**
 * Register MT5 tools with the tool registry
 */
export function registerMT5Tools(registry: Map<string, any>): void {
  for (const tool of MT5_TOOLS) {
    registry.set(tool.name, {
      definition: tool,
      handler: MT5_TOOL_HANDLERS[tool.name],
      category: 'trading',
      enabled: true,
    });
  }
}
