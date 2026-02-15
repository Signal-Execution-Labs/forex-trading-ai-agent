/**
 * K.I.T. Pine Screener Skill
 * TradingView-inspired custom screener with Pine Script-like filtering
 * 
 * Features:
 * - Custom indicator-based screening
 * - Multi-timeframe support (1m, 5m, 15m, 30m, 1H, 2H, 4H, 1D, 1W, 1M)
 * - Plot-based filters with comparison operators
 * - JSON output for automation
 * - Watchlist integration
 * - Favorite indicator presets
 */

import { Tool, ToolSchema, ToolResult } from '../types/tools.js';

// Supported timeframes matching TradingView
const SUPPORTED_TIMEFRAMES = ['1', '5', '15', '30', '60', '120', '240', 'D', 'W', 'M'];

// Built-in indicator templates
const INDICATOR_TEMPLATES = {
  rsi: {
    name: 'RSI',
    plots: ['rsi'],
    params: { length: 14, overbought: 70, oversold: 30 }
  },
  macd: {
    name: 'MACD',
    plots: ['macd', 'signal', 'histogram'],
    params: { fast: 12, slow: 26, signal: 9 }
  },
  bollinger: {
    name: 'Bollinger Bands',
    plots: ['upper', 'middle', 'lower', 'width', 'percentB'],
    params: { length: 20, mult: 2 }
  },
  ema: {
    name: 'EMA',
    plots: ['ema'],
    params: { length: 20 }
  },
  sma: {
    name: 'SMA',
    plots: ['sma'],
    params: { length: 50 }
  },
  stochastic: {
    name: 'Stochastic',
    plots: ['k', 'd'],
    params: { kLength: 14, kSmooth: 1, dSmooth: 3 }
  },
  atr: {
    name: 'ATR',
    plots: ['atr'],
    params: { length: 14 }
  },
  adx: {
    name: 'ADX',
    plots: ['adx', 'diPlus', 'diMinus'],
    params: { length: 14 }
  },
  volume: {
    name: 'Volume',
    plots: ['volume', 'volumeSMA', 'volumeRatio'],
    params: { smaLength: 20 }
  },
  supertrend: {
    name: 'Supertrend',
    plots: ['supertrend', 'direction'],
    params: { atrLength: 10, factor: 3 }
  },
  ichimoku: {
    name: 'Ichimoku Cloud',
    plots: ['tenkan', 'kijun', 'senkouA', 'senkouB', 'chikou'],
    params: { tenkanLen: 9, kijunLen: 26, senkouLen: 52 }
  },
  vwap: {
    name: 'VWAP',
    plots: ['vwap', 'upper1', 'lower1', 'upper2', 'lower2'],
    params: { stdDev1: 1, stdDev2: 2 }
  }
};

// Filter operators
type FilterOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'crosses_above' | 'crosses_below' | 'between' | 'outside';

interface ScreenerFilter {
  indicator: string;
  plot: string;
  operator: FilterOperator;
  value: number | [number, number];
  timeframe?: string;
}

interface ScreenerPreset {
  id: string;
  name: string;
  description: string;
  filters: ScreenerFilter[];
  sortBy?: { indicator: string; plot: string; order: 'asc' | 'desc' };
  limit?: number;
}

// Built-in screener presets
const SCREENER_PRESETS: ScreenerPreset[] = [
  {
    id: 'oversold_rsi',
    name: 'Oversold RSI',
    description: 'Find assets with RSI below 30',
    filters: [
      { indicator: 'rsi', plot: 'rsi', operator: 'lt', value: 30 }
    ],
    sortBy: { indicator: 'rsi', plot: 'rsi', order: 'asc' }
  },
  {
    id: 'overbought_rsi',
    name: 'Overbought RSI',
    description: 'Find assets with RSI above 70',
    filters: [
      { indicator: 'rsi', plot: 'rsi', operator: 'gt', value: 70 }
    ],
    sortBy: { indicator: 'rsi', plot: 'rsi', order: 'desc' }
  },
  {
    id: 'golden_cross',
    name: 'Golden Cross Setup',
    description: 'EMA 50 crossing above EMA 200',
    filters: [
      { indicator: 'ema', plot: 'ema', operator: 'crosses_above', value: 200 }
    ]
  },
  {
    id: 'macd_bullish',
    name: 'MACD Bullish Crossover',
    description: 'MACD line crossing above signal line',
    filters: [
      { indicator: 'macd', plot: 'histogram', operator: 'crosses_above', value: 0 }
    ]
  },
  {
    id: 'bollinger_squeeze',
    name: 'Bollinger Squeeze',
    description: 'Tight Bollinger Bands indicating potential breakout',
    filters: [
      { indicator: 'bollinger', plot: 'width', operator: 'lt', value: 0.05 }
    ]
  },
  {
    id: 'strong_trend',
    name: 'Strong Trend',
    description: 'ADX above 25 indicating strong trend',
    filters: [
      { indicator: 'adx', plot: 'adx', operator: 'gt', value: 25 }
    ],
    sortBy: { indicator: 'adx', plot: 'adx', order: 'desc' }
  },
  {
    id: 'volume_spike',
    name: 'Volume Spike',
    description: 'Volume 2x above average',
    filters: [
      { indicator: 'volume', plot: 'volumeRatio', operator: 'gt', value: 2 }
    ],
    sortBy: { indicator: 'volume', plot: 'volumeRatio', order: 'desc' }
  },
  {
    id: 'supertrend_buy',
    name: 'Supertrend Buy Signal',
    description: 'Supertrend flipping bullish',
    filters: [
      { indicator: 'supertrend', plot: 'direction', operator: 'crosses_above', value: 0 }
    ]
  }
];

interface ScreenerResult {
  symbol: string;
  name?: string;
  price: number;
  change24h: number;
  volume24h: number;
  indicators: Record<string, Record<string, number>>;
  matchedFilters: string[];
  score: number;
}

// Simulated market data for demo
function generateMockData(symbols: string[]): ScreenerResult[] {
  return symbols.map(symbol => {
    const price = Math.random() * 1000 + 10;
    const rsiValue = Math.random() * 100;
    const macdValue = (Math.random() - 0.5) * 20;
    
    return {
      symbol,
      price,
      change24h: (Math.random() - 0.5) * 20,
      volume24h: Math.random() * 10000000,
      indicators: {
        rsi: { rsi: rsiValue },
        macd: { macd: macdValue, signal: macdValue * 0.8, histogram: macdValue * 0.2 },
        bollinger: { width: Math.random() * 0.1, percentB: Math.random() * 100 },
        adx: { adx: Math.random() * 50, diPlus: Math.random() * 30, diMinus: Math.random() * 30 },
        volume: { volumeRatio: Math.random() * 3 },
        supertrend: { direction: Math.random() > 0.5 ? 1 : -1 }
      },
      matchedFilters: [],
      score: 0
    };
  });
}

// Filter evaluation
function evaluateFilter(result: ScreenerResult, filter: ScreenerFilter): boolean {
  const indicatorData = result.indicators[filter.indicator];
  if (!indicatorData) return false;
  
  const plotValue = indicatorData[filter.plot];
  if (plotValue === undefined) return false;
  
  switch (filter.operator) {
    case 'gt': return plotValue > (filter.value as number);
    case 'gte': return plotValue >= (filter.value as number);
    case 'lt': return plotValue < (filter.value as number);
    case 'lte': return plotValue <= (filter.value as number);
    case 'eq': return plotValue === (filter.value as number);
    case 'neq': return plotValue !== (filter.value as number);
    case 'between': {
      const [min, max] = filter.value as [number, number];
      return plotValue >= min && plotValue <= max;
    }
    case 'outside': {
      const [min, max] = filter.value as [number, number];
      return plotValue < min || plotValue > max;
    }
    case 'crosses_above':
    case 'crosses_below':
      // Simplified: check current position relative to value
      return filter.operator === 'crosses_above' 
        ? plotValue > (filter.value as number)
        : plotValue < (filter.value as number);
    default:
      return false;
  }
}

export const pineScreenerTools: Tool[] = [
  {
    name: 'screener_run',
    description: 'Run custom screener with Pine Script-like filters across markets',
    schema: {
      type: 'object',
      properties: {
        market: {
          type: 'string',
          enum: ['crypto', 'stocks', 'forex', 'all'],
          description: 'Market to screen'
        },
        filters: {
          type: 'array',
          description: 'Array of filter conditions',
          items: {
            type: 'object',
            properties: {
              indicator: { type: 'string' },
              plot: { type: 'string' },
              operator: { 
                type: 'string',
                enum: ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'crosses_above', 'crosses_below', 'between', 'outside']
              },
              value: { oneOf: [{ type: 'number' }, { type: 'array', items: { type: 'number' } }] }
            },
            required: ['indicator', 'plot', 'operator', 'value']
          }
        },
        timeframe: {
          type: 'string',
          enum: SUPPORTED_TIMEFRAMES,
          description: 'Timeframe for indicator calculation'
        },
        sortBy: {
          type: 'object',
          properties: {
            indicator: { type: 'string' },
            plot: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] }
          }
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 50
        }
      },
      required: ['market', 'filters']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { market, filters, timeframe = 'D', sortBy, limit = 50 } = params;
      
      // Get symbols based on market
      const symbols = market === 'crypto' 
        ? ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'ADA', 'AVAX', 'DOT', 'MATIC', 'LINK']
        : market === 'stocks'
        ? ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'JPM', 'V', 'JNJ']
        : market === 'forex'
        ? ['EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', 'USDCAD', 'NZDUSD', 'EURGBP', 'EURJPY']
        : [...'BTC,ETH,SOL,AAPL,MSFT,GOOGL,EURUSD,GBPUSD'.split(',')];
      
      // Generate mock data (in production, this would fetch real data)
      let results = generateMockData(symbols);
      
      // Apply filters
      results = results.filter(result => {
        const matched = filters.filter((f: ScreenerFilter) => evaluateFilter(result, f));
        result.matchedFilters = matched.map((f: ScreenerFilter) => `${f.indicator}.${f.plot} ${f.operator} ${f.value}`);
        result.score = matched.length / filters.length;
        return matched.length === filters.length; // All filters must match
      });
      
      // Sort results
      if (sortBy) {
        results.sort((a, b) => {
          const aVal = a.indicators[sortBy.indicator]?.[sortBy.plot] || 0;
          const bVal = b.indicators[sortBy.indicator]?.[sortBy.plot] || 0;
          return sortBy.order === 'asc' ? aVal - bVal : bVal - aVal;
        });
      }
      
      // Limit results
      results = results.slice(0, limit);
      
      return {
        success: true,
        data: {
          market,
          timeframe,
          filtersApplied: filters.length,
          resultsFound: results.length,
          results: results.map(r => ({
            symbol: r.symbol,
            price: r.price.toFixed(2),
            change24h: r.change24h.toFixed(2) + '%',
            matchedFilters: r.matchedFilters,
            score: (r.score * 100).toFixed(0) + '%',
            indicators: r.indicators
          }))
        }
      };
    }
  },
  
  {
    name: 'screener_presets',
    description: 'List available screener presets or get details of a specific preset',
    schema: {
      type: 'object',
      properties: {
        presetId: {
          type: 'string',
          description: 'Get details of specific preset (optional)'
        }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { presetId } = params;
      
      if (presetId) {
        const preset = SCREENER_PRESETS.find(p => p.id === presetId);
        if (!preset) {
          return { success: false, error: `Preset '${presetId}' not found` };
        }
        return { success: true, data: preset };
      }
      
      return {
        success: true,
        data: {
          presets: SCREENER_PRESETS.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            filterCount: p.filters.length
          }))
        }
      };
    }
  },
  
  {
    name: 'screener_run_preset',
    description: 'Run a predefined screener preset',
    schema: {
      type: 'object',
      properties: {
        presetId: {
          type: 'string',
          description: 'Preset ID to run'
        },
        market: {
          type: 'string',
          enum: ['crypto', 'stocks', 'forex', 'all'],
          description: 'Market to screen'
        },
        timeframe: {
          type: 'string',
          enum: SUPPORTED_TIMEFRAMES
        },
        limit: {
          type: 'number',
          default: 50
        }
      },
      required: ['presetId', 'market']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { presetId, market, timeframe = 'D', limit = 50 } = params;
      
      const preset = SCREENER_PRESETS.find(p => p.id === presetId);
      if (!preset) {
        return { success: false, error: `Preset '${presetId}' not found` };
      }
      
      // Reuse the main screener logic
      const screenerTool = pineScreenerTools.find(t => t.name === 'screener_run');
      if (!screenerTool) {
        return { success: false, error: 'Screener tool not found' };
      }
      
      const result = await screenerTool.handler({
        market,
        filters: preset.filters,
        timeframe,
        sortBy: preset.sortBy,
        limit: preset.limit || limit
      });
      
      return {
        ...result,
        data: {
          preset: preset.name,
          ...result.data
        }
      };
    }
  },
  
  {
    name: 'screener_indicators',
    description: 'List available indicators and their plots for screening',
    schema: {
      type: 'object',
      properties: {
        indicator: {
          type: 'string',
          description: 'Get details of specific indicator (optional)'
        }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { indicator } = params;
      
      if (indicator) {
        const ind = INDICATOR_TEMPLATES[indicator as keyof typeof INDICATOR_TEMPLATES];
        if (!ind) {
          return { success: false, error: `Indicator '${indicator}' not found` };
        }
        return { success: true, data: ind };
      }
      
      return {
        success: true,
        data: {
          indicators: Object.entries(INDICATOR_TEMPLATES).map(([key, val]) => ({
            id: key,
            name: val.name,
            plots: val.plots,
            defaultParams: val.params
          }))
        }
      };
    }
  },
  
  {
    name: 'screener_create_preset',
    description: 'Create a custom screener preset',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Preset name' },
        description: { type: 'string', description: 'Preset description' },
        filters: {
          type: 'array',
          description: 'Filter conditions',
          items: {
            type: 'object',
            properties: {
              indicator: { type: 'string' },
              plot: { type: 'string' },
              operator: { type: 'string' },
              value: { oneOf: [{ type: 'number' }, { type: 'array' }] }
            }
          }
        },
        sortBy: {
          type: 'object',
          properties: {
            indicator: { type: 'string' },
            plot: { type: 'string' },
            order: { type: 'string', enum: ['asc', 'desc'] }
          }
        }
      },
      required: ['name', 'filters']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { name, description, filters, sortBy } = params;
      
      const newPreset: ScreenerPreset = {
        id: name.toLowerCase().replace(/\s+/g, '_'),
        name,
        description: description || '',
        filters,
        sortBy
      };
      
      // In production, this would persist to database
      SCREENER_PRESETS.push(newPreset);
      
      return {
        success: true,
        data: {
          message: `Preset '${name}' created successfully`,
          preset: newPreset
        }
      };
    }
  },
  
  {
    name: 'screener_export',
    description: 'Export screener results in JSON format for automation',
    schema: {
      type: 'object',
      properties: {
        market: { type: 'string', enum: ['crypto', 'stocks', 'forex', 'all'] },
        presetId: { type: 'string' },
        filters: { type: 'array' },
        format: { type: 'string', enum: ['json', 'csv', 'webhook'] },
        webhookUrl: { type: 'string', description: 'Webhook URL for automation' }
      },
      required: ['market', 'format']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { market, presetId, filters, format, webhookUrl } = params;
      
      // Get results
      const screenerFilters = presetId 
        ? SCREENER_PRESETS.find(p => p.id === presetId)?.filters 
        : filters;
      
      if (!screenerFilters) {
        return { success: false, error: 'No filters specified' };
      }
      
      const symbols = market === 'crypto' 
        ? ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']
        : ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
      
      let results = generateMockData(symbols);
      results = results.filter(r => screenerFilters.every((f: ScreenerFilter) => evaluateFilter(r, f)));
      
      const exportData = {
        timestamp: new Date().toISOString(),
        market,
        filters: screenerFilters.length,
        count: results.length,
        results: results.map(r => ({
          ticker: r.symbol,
          signal: 'MATCH',
          period: 'D',
          price: r.price.toFixed(2),
          indicators: r.indicators
        }))
      };
      
      if (format === 'webhook' && webhookUrl) {
        // In production, this would POST to webhook
        return {
          success: true,
          data: {
            message: `Sent ${results.length} results to webhook`,
            webhookUrl,
            payload: exportData
          }
        };
      }
      
      return {
        success: true,
        data: {
          format,
          export: exportData
        }
      };
    }
  }
];

export default pineScreenerTools;
