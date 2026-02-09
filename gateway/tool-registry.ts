/**
 * K.I.T. Tool Registry
 * 
 * Manages available tools that AI agents can use.
 * Tools are actions like trade, market, portfolio, backtest.
 */

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description?: string;
  optional?: boolean;
  default?: any;
  enum?: any[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
  handler: (args: any) => Promise<any>;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      console.warn(`Tool ${tool.name} already registered, overwriting`);
    }
    
    this.tools.set(tool.name, tool);
    console.log(`  🔧 Registered tool: ${tool.name}`);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  async invoke(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    // Validate parameters
    this.validateArgs(tool, args);

    // Execute handler
    try {
      return await tool.handler(args);
    } catch (error: any) {
      throw new Error(`Tool ${name} failed: ${error.message}`);
    }
  }

  private validateArgs(tool: ToolDefinition, args: any): void {
    for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
      const value = args[paramName];
      
      // Check required parameters
      if (value === undefined) {
        if (!paramDef.optional) {
          throw new Error(`Missing required parameter: ${paramName}`);
        }
        continue;
      }

      // Check type
      const actualType = Array.isArray(value) ? 'array' : typeof value;
      if (actualType !== paramDef.type && paramDef.type !== 'object') {
        throw new Error(`Parameter ${paramName} must be ${paramDef.type}, got ${actualType}`);
      }

      // Check enum
      if (paramDef.enum && !paramDef.enum.includes(value)) {
        throw new Error(`Parameter ${paramName} must be one of: ${paramDef.enum.join(', ')}`);
      }
    }
  }

  listTools(): ToolInfo[] {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  getToolSchema(name: string): ToolInfo | undefined {
    const tool = this.tools.get(name);
    if (!tool) return undefined;
    
    return {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    };
  }

  /**
   * Generate JSON Schema for all tools (for AI agent consumption)
   */
  generateSchema(): any {
    const tools = [];
    
    for (const tool of this.tools.values()) {
      tools.push({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: {
            type: 'object',
            properties: this.convertParameters(tool.parameters),
            required: Object.entries(tool.parameters)
              .filter(([_, param]) => !param.optional)
              .map(([name]) => name),
          },
        },
      });
    }
    
    return tools;
  }

  private convertParameters(params: Record<string, ToolParameter>): Record<string, any> {
    const properties: Record<string, any> = {};
    
    for (const [name, param] of Object.entries(params)) {
      const prop: any = {
        type: param.type,
      };
      
      if (param.description) {
        prop.description = param.description;
      }
      
      if (param.enum) {
        prop.enum = param.enum;
      }
      
      if (param.default !== undefined) {
        prop.default = param.default;
      }
      
      properties[name] = prop;
    }
    
    return properties;
  }
}

/**
 * Default trading tools that K.I.T. provides
 */
export function createDefaultTools(): ToolDefinition[] {
  return [
    {
      name: 'trade',
      description: 'Execute a trade on connected exchanges',
      parameters: {
        action: {
          type: 'string',
          description: 'Buy or sell',
          enum: ['buy', 'sell'],
        },
        pair: {
          type: 'string',
          description: 'Trading pair (e.g., BTC/USDT)',
        },
        amount: {
          type: 'number',
          description: 'Amount to trade',
        },
        type: {
          type: 'string',
          description: 'Order type',
          enum: ['market', 'limit', 'stop-limit'],
          default: 'market',
          optional: true,
        },
        price: {
          type: 'number',
          description: 'Limit price (required for limit orders)',
          optional: true,
        },
        exchange: {
          type: 'string',
          description: 'Exchange to use (defaults to primary)',
          optional: true,
        },
      },
      handler: async (args) => {
        // Placeholder - would delegate to auto-trader skill
        return { orderId: `order-${Date.now()}`, status: 'pending' };
      },
    },
    {
      name: 'market',
      description: 'Get market data for a trading pair',
      parameters: {
        action: {
          type: 'string',
          description: 'Type of data to retrieve',
          enum: ['price', 'ohlcv', 'orderbook', 'ticker', 'analyze'],
        },
        pair: {
          type: 'string',
          description: 'Trading pair (e.g., BTC/USDT)',
        },
        timeframe: {
          type: 'string',
          description: 'Timeframe for OHLCV data',
          optional: true,
          default: '1h',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return',
          optional: true,
          default: 100,
        },
      },
      handler: async (args) => {
        // Placeholder - would delegate to market-analysis skill
        return { price: 50000, change24h: 2.5 };
      },
    },
    {
      name: 'portfolio',
      description: 'Get portfolio information',
      parameters: {
        action: {
          type: 'string',
          description: 'Type of portfolio data',
          enum: ['snapshot', 'balance', 'positions', 'pnl', 'history'],
        },
        exchange: {
          type: 'string',
          description: 'Filter by exchange',
          optional: true,
        },
        asset: {
          type: 'string',
          description: 'Filter by asset',
          optional: true,
        },
      },
      handler: async (args) => {
        // Placeholder - would delegate to portfolio-tracker skill
        return { totalValue: 10000, change24h: 2.5 };
      },
    },
    {
      name: 'backtest',
      description: 'Run a backtest on historical data',
      parameters: {
        strategy: {
          type: 'string',
          description: 'Strategy name or definition',
        },
        pair: {
          type: 'string',
          description: 'Trading pair to test',
        },
        start: {
          type: 'string',
          description: 'Start date (YYYY-MM-DD)',
        },
        end: {
          type: 'string',
          description: 'End date (YYYY-MM-DD)',
        },
        capital: {
          type: 'number',
          description: 'Initial capital',
          optional: true,
          default: 10000,
        },
        timeframe: {
          type: 'string',
          description: 'Candle timeframe',
          optional: true,
          default: '4h',
        },
      },
      handler: async (args) => {
        // Placeholder - would delegate to backtester skill
        return { 
          totalReturn: 25,
          maxDrawdown: 15,
          sharpeRatio: 1.5,
        };
      },
    },
    {
      name: 'alert',
      description: 'Manage price and indicator alerts',
      parameters: {
        action: {
          type: 'string',
          description: 'Alert action',
          enum: ['create', 'list', 'delete', 'pause', 'resume'],
        },
        type: {
          type: 'string',
          description: 'Alert type',
          enum: ['price', 'rsi', 'macd', 'portfolio'],
          optional: true,
        },
        pair: {
          type: 'string',
          description: 'Trading pair',
          optional: true,
        },
        condition: {
          type: 'string',
          description: 'Alert condition (above, below, cross)',
          optional: true,
        },
        value: {
          type: 'number',
          description: 'Threshold value',
          optional: true,
        },
        alertId: {
          type: 'string',
          description: 'Alert ID (for delete/pause/resume)',
          optional: true,
        },
      },
      handler: async (args) => {
        // Placeholder - would delegate to alert-system skill
        return { alertId: `alert-${Date.now()}`, status: 'created' };
      },
    },
    {
      name: 'analyze',
      description: 'Get technical analysis for a trading pair',
      parameters: {
        pair: {
          type: 'string',
          description: 'Trading pair to analyze',
        },
        timeframe: {
          type: 'string',
          description: 'Analysis timeframe',
          optional: true,
          default: '4h',
        },
        indicators: {
          type: 'array',
          description: 'Specific indicators to calculate',
          optional: true,
        },
      },
      handler: async (args) => {
        // Placeholder - would delegate to market-analysis skill
        return {
          trend: 'bullish',
          signal: 'hold',
          confidence: 0.65,
          indicators: {
            rsi: 55,
            macd: { value: 123, signal: 110, histogram: 13 },
          },
        };
      },
    },
  ];
}
