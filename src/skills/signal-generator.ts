/**
 * K.I.T. Signal Generator Skill
 * TradingView-inspired signal generation with stops and targets
 * 
 * Features:
 * - Multi-indicator signal generation
 * - Automatic stop loss and take profit calculation
 * - Risk/reward ratio optimization
 * - Signal confidence scoring
 * - JSON output for automation
 * - Webhook delivery with full trade details
 * - Signal history and performance tracking
 */

import { Tool, ToolResult } from '../types/tools.js';

// Signal types
type SignalType = 'BUY' | 'SELL' | 'LONG' | 'SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT';
type SignalStrength = 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';

interface Signal {
  id: string;
  timestamp: Date;
  symbol: string;
  timeframe: string;
  type: SignalType;
  strength: SignalStrength;
  confidence: number; // 0-100
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  riskReward: number;
  indicators: {
    name: string;
    value: number;
    signal: 'bullish' | 'bearish' | 'neutral';
  }[];
  reasoning: string;
  expiresAt?: Date;
}

interface SignalConfig {
  symbol: string;
  timeframe: string;
  indicators: string[];
  riskPercent?: number;
  minConfidence?: number;
  tpLevels?: number;
}

// Signal history storage
const signalHistory: Signal[] = [];

// Indicator calculations (simplified)
function calculateIndicators(symbol: string, timeframe: string): Signal['indicators'] {
  // Mock calculations - in production, fetch real data
  const rsi = 30 + Math.random() * 40; // RSI between 30-70
  const macd = (Math.random() - 0.5) * 10;
  const ema = Math.random() > 0.5;
  const volume = 1 + Math.random();
  const adx = 20 + Math.random() * 30;
  
  return [
    { 
      name: 'RSI(14)', 
      value: rsi, 
      signal: rsi < 30 ? 'bullish' : rsi > 70 ? 'bearish' : 'neutral' 
    },
    { 
      name: 'MACD', 
      value: macd, 
      signal: macd > 0 ? 'bullish' : 'bearish' 
    },
    { 
      name: 'EMA Cross', 
      value: ema ? 1 : -1, 
      signal: ema ? 'bullish' : 'bearish' 
    },
    { 
      name: 'Volume Ratio', 
      value: volume, 
      signal: volume > 1.5 ? 'bullish' : 'neutral' 
    },
    { 
      name: 'ADX', 
      value: adx, 
      signal: adx > 25 ? 'bullish' : 'neutral' 
    }
  ];
}

// Calculate confidence score based on indicator agreement
function calculateConfidence(indicators: Signal['indicators']): number {
  const bullishCount = indicators.filter(i => i.signal === 'bullish').length;
  const bearishCount = indicators.filter(i => i.signal === 'bearish').length;
  const total = indicators.length;
  
  const agreementRatio = Math.max(bullishCount, bearishCount) / total;
  return Math.round(agreementRatio * 100);
}

// Determine signal type based on indicators
function determineSignalType(indicators: Signal['indicators']): { type: SignalType; strength: SignalStrength } {
  const bullishCount = indicators.filter(i => i.signal === 'bullish').length;
  const bearishCount = indicators.filter(i => i.signal === 'bearish').length;
  
  const isBullish = bullishCount > bearishCount;
  const ratio = Math.max(bullishCount, bearishCount) / indicators.length;
  
  let strength: SignalStrength;
  if (ratio >= 0.8) strength = 'VERY_STRONG';
  else if (ratio >= 0.6) strength = 'STRONG';
  else if (ratio >= 0.4) strength = 'MODERATE';
  else strength = 'WEAK';
  
  return {
    type: isBullish ? 'LONG' : 'SHORT',
    strength
  };
}

// Calculate stop loss and take profit levels
function calculateLevels(entry: number, type: SignalType, riskPercent: number, tpLevels: number): { stopLoss: number; takeProfit: number[] } {
  const isLong = type === 'LONG' || type === 'BUY';
  const stopDistance = entry * (riskPercent / 100);
  
  const stopLoss = isLong ? entry - stopDistance : entry + stopDistance;
  
  // Take profit levels at 1R, 2R, 3R (configurable)
  const takeProfit: number[] = [];
  for (let i = 1; i <= tpLevels; i++) {
    const tp = isLong 
      ? entry + (stopDistance * i * 1.5) // 1.5R, 3R, 4.5R
      : entry - (stopDistance * i * 1.5);
    takeProfit.push(Number(tp.toFixed(2)));
  }
  
  return { stopLoss: Number(stopLoss.toFixed(2)), takeProfit };
}

// Generate unique ID
function generateSignalId(): string {
  return `sig_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

export const signalGeneratorTools: Tool[] = [
  {
    name: 'signal_generate',
    description: 'Generate a trading signal with entry, stop loss, and take profit levels',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Trading symbol (e.g., BTCUSDT)' },
        timeframe: { 
          type: 'string', 
          enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'],
          description: 'Analysis timeframe'
        },
        indicators: {
          type: 'array',
          items: { type: 'string' },
          description: 'Indicators to use (default: RSI, MACD, EMA, Volume, ADX)'
        },
        riskPercent: {
          type: 'number',
          default: 2,
          description: 'Risk percentage for stop loss calculation'
        },
        tpLevels: {
          type: 'number',
          default: 3,
          description: 'Number of take profit levels'
        },
        minConfidence: {
          type: 'number',
          default: 50,
          description: 'Minimum confidence score to generate signal'
        }
      },
      required: ['symbol', 'timeframe']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { 
        symbol, 
        timeframe, 
        indicators: requestedIndicators,
        riskPercent = 2,
        tpLevels = 3,
        minConfidence = 50
      } = params;
      
      // Mock current price
      const currentPrice = symbol.includes('BTC') ? 65000 + Math.random() * 5000 :
                          symbol.includes('ETH') ? 3000 + Math.random() * 500 :
                          100 + Math.random() * 50;
      
      // Calculate indicators
      const calculatedIndicators = calculateIndicators(symbol, timeframe);
      
      // Calculate confidence
      const confidence = calculateConfidence(calculatedIndicators);
      
      // Check minimum confidence
      if (confidence < minConfidence) {
        return {
          success: true,
          data: {
            message: 'No clear signal detected',
            symbol,
            timeframe,
            confidence: confidence + '%',
            minRequired: minConfidence + '%',
            indicators: calculatedIndicators.map(i => ({
              name: i.name,
              value: i.value.toFixed(2),
              signal: i.signal
            })),
            recommendation: 'Wait for better setup'
          }
        };
      }
      
      // Determine signal type and strength
      const { type, strength } = determineSignalType(calculatedIndicators);
      
      // Calculate levels
      const { stopLoss, takeProfit } = calculateLevels(currentPrice, type, riskPercent, tpLevels);
      
      // Calculate risk/reward ratio
      const riskAmount = Math.abs(currentPrice - stopLoss);
      const rewardAmount = Math.abs(takeProfit[0] - currentPrice);
      const riskReward = rewardAmount / riskAmount;
      
      // Generate reasoning
      const bullishIndicators = calculatedIndicators.filter(i => i.signal === 'bullish').map(i => i.name);
      const bearishIndicators = calculatedIndicators.filter(i => i.signal === 'bearish').map(i => i.name);
      
      const reasoning = type === 'LONG' || type === 'BUY'
        ? `Bullish signals from: ${bullishIndicators.join(', ')}. ${bearishIndicators.length > 0 ? `Caution: ${bearishIndicators.join(', ')} showing weakness.` : ''}`
        : `Bearish signals from: ${bearishIndicators.join(', ')}. ${bullishIndicators.length > 0 ? `Note: ${bullishIndicators.join(', ')} showing strength.` : ''}`;
      
      // Create signal
      const signal: Signal = {
        id: generateSignalId(),
        timestamp: new Date(),
        symbol: symbol.toUpperCase(),
        timeframe,
        type,
        strength,
        confidence,
        entry: Number(currentPrice.toFixed(2)),
        stopLoss,
        takeProfit,
        riskReward: Number(riskReward.toFixed(2)),
        indicators: calculatedIndicators,
        reasoning,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h expiry
      };
      
      // Store in history
      signalHistory.push(signal);
      
      // Generate JSON output for automation
      const jsonOutput = {
        timestamp: signal.timestamp.toISOString(),
        ticker: signal.symbol,
        signalType: signal.type,
        period: signal.timeframe,
        price: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit1: signal.takeProfit[0],
        takeProfit2: signal.takeProfit[1],
        takeProfit3: signal.takeProfit[2],
        confidence: signal.confidence,
        strength: signal.strength,
        riskReward: signal.riskReward
      };
      
      return {
        success: true,
        data: {
          signal: {
            id: signal.id,
            symbol: signal.symbol,
            timeframe: signal.timeframe,
            type: signal.type,
            strength: signal.strength,
            confidence: signal.confidence + '%',
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit,
            riskReward: signal.riskReward + ':1',
            reasoning: signal.reasoning,
            expiresAt: signal.expiresAt?.toISOString()
          },
          indicators: calculatedIndicators.map(i => ({
            name: i.name,
            value: i.value.toFixed(2),
            signal: i.signal === 'bullish' ? '🟢' : i.signal === 'bearish' ? '🔴' : '⚪'
          })),
          jsonOutput,
          webhookPayload: JSON.stringify(jsonOutput)
        }
      };
    }
  },
  
  {
    name: 'signal_history',
    description: 'Get signal history with optional filters',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        type: { type: 'string', enum: ['LONG', 'SHORT', 'BUY', 'SELL', 'all'] },
        limit: { type: 'number', default: 20 }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { symbol, type = 'all', limit = 20 } = params;
      
      let signals = [...signalHistory];
      
      if (symbol) {
        signals = signals.filter(s => s.symbol === symbol.toUpperCase());
      }
      if (type !== 'all') {
        signals = signals.filter(s => s.type === type);
      }
      
      signals = signals
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, limit);
      
      return {
        success: true,
        data: {
          signalCount: signals.length,
          signals: signals.map(s => ({
            id: s.id,
            symbol: s.symbol,
            timeframe: s.timeframe,
            type: s.type,
            strength: s.strength,
            confidence: s.confidence + '%',
            entry: s.entry,
            stopLoss: s.stopLoss,
            takeProfit: s.takeProfit,
            riskReward: s.riskReward + ':1',
            timestamp: s.timestamp.toISOString()
          }))
        }
      };
    }
  },
  
  {
    name: 'signal_batch',
    description: 'Generate signals for multiple symbols at once',
    schema: {
      type: 'object',
      properties: {
        symbols: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of symbols to analyze'
        },
        timeframe: { type: 'string', enum: ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'] },
        minConfidence: { type: 'number', default: 60 },
        riskPercent: { type: 'number', default: 2 }
      },
      required: ['symbols', 'timeframe']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { symbols, timeframe, minConfidence = 60, riskPercent = 2 } = params;
      
      const results: any[] = [];
      const signalTool = signalGeneratorTools.find(t => t.name === 'signal_generate');
      
      for (const symbol of symbols) {
        const result = await signalTool!.handler({
          symbol,
          timeframe,
          riskPercent,
          minConfidence
        });
        
        if (result.success && result.data?.signal) {
          results.push({
            symbol,
            ...result.data.signal
          });
        }
      }
      
      // Sort by confidence
      results.sort((a, b) => parseInt(b.confidence) - parseInt(a.confidence));
      
      return {
        success: true,
        data: {
          analyzed: symbols.length,
          signalsFound: results.length,
          signals: results,
          summary: {
            longSignals: results.filter(r => r.type === 'LONG').length,
            shortSignals: results.filter(r => r.type === 'SHORT').length,
            avgConfidence: results.length > 0 
              ? (results.reduce((sum, r) => sum + parseInt(r.confidence), 0) / results.length).toFixed(1) + '%'
              : 'N/A'
          }
        }
      };
    }
  },
  
  {
    name: 'signal_webhook_format',
    description: 'Get webhook payload format for different platforms',
    schema: {
      type: 'object',
      properties: {
        platform: {
          type: 'string',
          enum: ['tradingview', '3commas', 'alertatron', 'custom'],
          description: 'Target platform for webhook'
        },
        signalId: { type: 'string', description: 'Signal ID to format (optional)' }
      },
      required: ['platform']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { platform, signalId } = params;
      
      // Get signal or use example
      const signal = signalId 
        ? signalHistory.find(s => s.id === signalId)
        : {
            symbol: 'BTCUSDT',
            type: 'LONG',
            entry: 65000,
            stopLoss: 63700,
            takeProfit: [66300, 67600, 68900],
            confidence: 75
          };
      
      if (!signal) {
        return { success: false, error: 'Signal not found' };
      }
      
      let payload: any;
      
      switch (platform) {
        case 'tradingview':
          payload = {
            ticker: signal.symbol,
            action: signal.type === 'LONG' ? 'buy' : 'sell',
            price: signal.entry,
            sl: signal.stopLoss,
            tp: signal.takeProfit[0]
          };
          break;
          
        case '3commas':
          payload = {
            message_type: 'bot',
            bot_id: '{{bot_id}}',
            email_token: '{{email_token}}',
            delay_seconds: 0,
            pair: signal.symbol,
            action: signal.type === 'LONG' ? 'start_long_deal' : 'start_short_deal'
          };
          break;
          
        case 'alertatron':
          payload = {
            exchange: 'binance',
            symbol: signal.symbol,
            side: signal.type === 'LONG' ? 'buy' : 'sell',
            type: 'limit',
            price: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit: signal.takeProfit[0]
          };
          break;
          
        case 'custom':
        default:
          payload = {
            timestamp: new Date().toISOString(),
            symbol: signal.symbol,
            signal: signal.type,
            entry: signal.entry,
            stopLoss: signal.stopLoss,
            takeProfit1: signal.takeProfit[0],
            takeProfit2: signal.takeProfit[1],
            takeProfit3: signal.takeProfit[2],
            confidence: signal.confidence,
            source: 'K.I.T. Signal Generator'
          };
      }
      
      return {
        success: true,
        data: {
          platform,
          payload,
          jsonString: JSON.stringify(payload, null, 2),
          note: platform !== 'custom' 
            ? `Replace {{placeholders}} with your ${platform} credentials`
            : 'Use this format for custom webhook integrations'
        }
      };
    }
  },
  
  {
    name: 'signal_performance',
    description: 'Get performance statistics for past signals',
    schema: {
      type: 'object',
      properties: {
        symbol: { type: 'string' },
        period: { type: 'string', enum: ['day', 'week', 'month', 'all'] }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { symbol, period = 'all' } = params;
      
      // Filter signals
      let signals = [...signalHistory];
      if (symbol) {
        signals = signals.filter(s => s.symbol === symbol.toUpperCase());
      }
      
      // Period filter
      const now = Date.now();
      const periodMs = {
        day: 24 * 60 * 60 * 1000,
        week: 7 * 24 * 60 * 60 * 1000,
        month: 30 * 24 * 60 * 60 * 1000,
        all: Infinity
      };
      
      signals = signals.filter(s => now - s.timestamp.getTime() < periodMs[period as keyof typeof periodMs]);
      
      // Calculate stats (mock performance for demo)
      const totalSignals = signals.length;
      const longSignals = signals.filter(s => s.type === 'LONG').length;
      const shortSignals = signals.filter(s => s.type === 'SHORT').length;
      const avgConfidence = totalSignals > 0
        ? signals.reduce((sum, s) => sum + s.confidence, 0) / totalSignals
        : 0;
      const avgRR = totalSignals > 0
        ? signals.reduce((sum, s) => sum + s.riskReward, 0) / totalSignals
        : 0;
      
      // Mock win rate based on confidence (higher confidence = better win rate)
      const estimatedWinRate = Math.min(95, 50 + avgConfidence * 0.4);
      
      return {
        success: true,
        data: {
          period,
          symbol: symbol || 'All',
          totalSignals,
          breakdown: {
            long: longSignals,
            short: shortSignals
          },
          averageConfidence: avgConfidence.toFixed(1) + '%',
          averageRiskReward: avgRR.toFixed(2) + ':1',
          estimatedWinRate: estimatedWinRate.toFixed(1) + '%',
          strengthDistribution: {
            veryStrong: signals.filter(s => s.strength === 'VERY_STRONG').length,
            strong: signals.filter(s => s.strength === 'STRONG').length,
            moderate: signals.filter(s => s.strength === 'MODERATE').length,
            weak: signals.filter(s => s.strength === 'WEAK').length
          }
        }
      };
    }
  }
];

export default signalGeneratorTools;
