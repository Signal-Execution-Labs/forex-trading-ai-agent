/**
 * AI Strategy Generator Skill (#71)
 * Generate trading strategies from natural language descriptions
 * Outputs K.I.T.-compatible, backtestable strategies
 */

import { Skill, SkillContext, SkillResult } from '../../types/skill.js';

interface StrategyCondition {
  indicator: string;
  period?: number;
  direction?: string;
  crosses?: string;
  above?: number;
  below?: number;
  value?: number;
}

interface GeneratedStrategy {
  name: string;
  version: string;
  type: 'scalping' | 'day_trading' | 'swing' | 'position';
  timeframe: string;
  description: string;
  entry: {
    conditions: StrategyCondition[];
    type: 'market' | 'limit';
    offset?: string;
  };
  exit: {
    conditions: StrategyCondition[];
    stopLoss: string;
    takeProfit: string;
    trailingStop?: string;
  };
  risk: {
    perTrade: string;
    maxPositions: number;
    maxDrawdown: string;
  };
  metadata: {
    generated: string;
    verified: boolean;
    paperTradingRequired: boolean;
    aiModel: string;
    confidence: number;
  };
}

interface GeneratorConfig {
  aiModel: string;
  outputFormats: ('kit_native' | 'python' | 'pinescript')[];
  autoFeatures: {
    riskManagement: boolean;
    positionSizing: boolean;
    stopLoss: boolean;
    takeProfit: boolean;
  };
  constraints: {
    maxIndicators: number;
    minTradesBacktest: number;
    maxDrawdown: string;
  };
}

const DEFAULT_CONFIG: GeneratorConfig = {
  aiModel: 'claude-opus-4.5',
  outputFormats: ['kit_native', 'python', 'pinescript'],
  autoFeatures: {
    riskManagement: true,
    positionSizing: true,
    stopLoss: true,
    takeProfit: true,
  },
  constraints: {
    maxIndicators: 5,
    minTradesBacktest: 100,
    maxDrawdown: '20%',
  },
};

// Indicator templates for parsing natural language
const INDICATOR_PATTERNS: Record<string, (params: string) => StrategyCondition> = {
  rsi: (params) => ({
    indicator: 'rsi',
    period: parseInt(params.match(/\d+/)?.[0] || '14'),
    ...(params.includes('overbought') || params.includes('above 70') ? { above: 70 } : {}),
    ...(params.includes('oversold') || params.includes('below 30') ? { below: 30 } : {}),
  }),
  macd: (params) => ({
    indicator: 'macd',
    ...(params.includes('cross up') ? { crosses: 'signal', direction: 'up' } : {}),
    ...(params.includes('cross down') ? { crosses: 'signal', direction: 'down' } : {}),
  }),
  ema: (params) => ({
    indicator: 'ema',
    period: parseInt(params.match(/\d+/)?.[0] || '20'),
    ...(params.includes('above') ? { direction: 'above' } : {}),
    ...(params.includes('below') ? { direction: 'below' } : {}),
  }),
  sma: (params) => ({
    indicator: 'sma',
    period: parseInt(params.match(/\d+/)?.[0] || '50'),
  }),
  bollinger: (params) => ({
    indicator: 'bollinger_bands',
    period: 20,
    ...(params.includes('upper') ? { crosses: 'upper' } : {}),
    ...(params.includes('lower') ? { crosses: 'lower' } : {}),
  }),
  volume: (params) => ({
    indicator: 'volume',
    ...(params.includes('spike') || params.includes('high') ? { above: 150 } : {}),
  }),
};

export class StrategyGeneratorSkill implements Skill {
  name = 'strategy-generator';
  description = 'Generate trading strategies from natural language';
  version = '1.0.0';

  private _config: GeneratorConfig;
  private logger: any;

  constructor(config: Partial<GeneratorConfig> = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute(context: SkillContext): Promise<SkillResult> {
    if (!context.input) {
      return { success: false, error: 'No input provided' };
    }

    this.logger = context.logger;
    const { action, params } = context.input;

    switch (action) {
      case 'generate':
        return this.generateStrategy(params);
      case 'improve':
        return this.improveStrategy(params);
      case 'convert':
        return this.convertFormat(params);
      case 'validate':
        return this.validateStrategy(params);
      case 'explain':
        return this.explainStrategy(params);
      default:
        return this.generateStrategy(params);
    }
  }

  private async generateStrategy(params: any): Promise<SkillResult> {
    const { 
      describe, 
      description,
      asset = 'crypto',
      targetSharpe,
      targetWinRate,
      riskPerTrade = '2%',
    } = params || {};

    const descText = describe || description;
    
    if (!descText) {
      return { success: false, error: 'Strategy description is required (use describe or description param)' };
    }

    try {
      // Parse the natural language description
      const parsed = this.parseDescription(descText);
      
      // Generate strategy name
      const name = this.generateStrategyName(parsed);
      
      // Determine strategy type and timeframe
      const type = this.inferStrategyType(descText);
      const timeframe = this.inferTimeframe(descText, type);
      
      // Build entry conditions
      const entryConditions = this.buildConditions(parsed.entrySignals);
      
      // Build exit conditions
      const exitConditions = this.buildConditions(parsed.exitSignals);
      
      // Calculate risk parameters
      const risk = this.calculateRiskParams(descText, riskPerTrade);
      
      // Build the strategy
      const strategy: GeneratedStrategy = {
        name,
        version: '1.0.0',
        type,
        timeframe,
        description: descText,
        entry: {
          conditions: entryConditions,
          type: type === 'scalping' ? 'market' : 'limit',
          offset: type === 'scalping' ? undefined : '0.1%',
        },
        exit: {
          conditions: exitConditions.length > 0 ? exitConditions : [{ indicator: 'time', value: 20 }],
          stopLoss: this.inferStopLoss(type, riskPerTrade),
          takeProfit: this.inferTakeProfit(type),
          trailingStop: type === 'swing' || type === 'position' ? '1.5%' : undefined,
        },
        risk: {
          perTrade: riskPerTrade,
          maxPositions: type === 'scalping' ? 1 : type === 'day_trading' ? 3 : 5,
          maxDrawdown: this._config.constraints.maxDrawdown,
        },
        metadata: {
          generated: new Date().toISOString(),
          verified: false,
          paperTradingRequired: true,
          aiModel: this._config.aiModel,
          confidence: this.calculateConfidence(entryConditions, exitConditions),
        },
      };

      // Add auto features if enabled
      if (this._config.autoFeatures.riskManagement && !strategy.exit.stopLoss) {
        strategy.exit.stopLoss = '2%';
      }

      this.logger?.info(`Generated strategy: ${name} (${type})`);

      return {
        success: true,
        data: {
          strategy,
          formats: {
            kit_native: strategy,
            python: this._config.outputFormats.includes('python') 
              ? this.convertToPython(strategy)
              : undefined,
            pinescript: this._config.outputFormats.includes('pinescript')
              ? this.convertToPineScript(strategy)
              : undefined,
          },
          suggestions: this.generateSuggestions(strategy),
          warnings: this.generateWarnings(strategy),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Strategy generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async improveStrategy(params: any): Promise<SkillResult> {
    const { strategy, feedback, targetMetric } = params || {};
    
    if (!strategy) {
      return { success: false, error: 'Strategy object is required' };
    }

    if (!feedback && !targetMetric) {
      return { success: false, error: 'Feedback or target metric is required' };
    }

    const improvements: string[] = [];
    const modifiedStrategy = { ...strategy };

    // Parse feedback and apply improvements
    const feedbackLower = (feedback || '').toLowerCase();

    if (feedbackLower.includes('drawdown') || targetMetric === 'reduce_drawdown') {
      modifiedStrategy.exit.stopLoss = this.reduceStopLoss(strategy.exit.stopLoss);
      modifiedStrategy.risk.perTrade = this.reduceRiskPerTrade(strategy.risk.perTrade);
      improvements.push('Tightened stop loss to reduce drawdown');
      improvements.push('Reduced position size for lower drawdown');
    }

    if (feedbackLower.includes('more trades') || targetMetric === 'increase_frequency') {
      modifiedStrategy.timeframe = this.lowerTimeframe(strategy.timeframe);
      improvements.push('Lowered timeframe for more trading opportunities');
    }

    if (feedbackLower.includes('win rate') || targetMetric === 'improve_winrate') {
      modifiedStrategy.entry.conditions.push({
        indicator: 'volume',
        above: 120,
      });
      improvements.push('Added volume confirmation filter');
    }

    if (feedbackLower.includes('profit') || targetMetric === 'increase_profit') {
      modifiedStrategy.exit.takeProfit = this.increaseTakeProfit(strategy.exit.takeProfit);
      modifiedStrategy.exit.trailingStop = '2%';
      improvements.push('Increased take profit target');
      improvements.push('Added trailing stop for trend riding');
    }

    // Increment version
    const versionParts = strategy.version.split('.');
    versionParts[2] = String(parseInt(versionParts[2]) + 1);
    modifiedStrategy.version = versionParts.join('.');
    modifiedStrategy.metadata.generated = new Date().toISOString();

    return {
      success: true,
      data: {
        original: strategy,
        improved: modifiedStrategy,
        improvements,
        changelog: `v${modifiedStrategy.version}: ${improvements.join('; ')}`,
      },
    };
  }

  private async convertFormat(params: any): Promise<SkillResult> {
    const { strategy, format } = params || {};
    
    if (!strategy) {
      return { success: false, error: 'Strategy object is required' };
    }

    if (!format) {
      return { success: false, error: 'Target format is required (python, pinescript, kit_native)' };
    }

    let converted: string;

    switch (format) {
      case 'python':
        converted = this.convertToPython(strategy);
        break;
      case 'pinescript':
        converted = this.convertToPineScript(strategy);
        break;
      case 'kit_native':
        converted = JSON.stringify(strategy, null, 2);
        break;
      default:
        return { success: false, error: `Unknown format: ${format}` };
    }

    return {
      success: true,
      data: {
        format,
        code: converted,
      },
    };
  }

  private async validateStrategy(params: any): Promise<SkillResult> {
    const { strategy } = params || {};
    
    if (!strategy) {
      return { success: false, error: 'Strategy object is required' };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields
    if (!strategy.name) errors.push('Strategy name is required');
    if (!strategy.entry?.conditions?.length) errors.push('At least one entry condition is required');
    if (!strategy.exit?.stopLoss) warnings.push('No stop loss defined - high risk!');
    if (!strategy.risk?.perTrade) warnings.push('No risk per trade defined');

    // Check logical issues
    if (strategy.entry?.conditions?.length > this._config.constraints.maxIndicators) {
      warnings.push(`Too many indicators (${strategy.entry.conditions.length}). Consider simplifying.`);
    }

    // Check risk parameters
    const riskNum = parseFloat(strategy.risk?.perTrade?.replace('%', '') || '0');
    if (riskNum > 5) warnings.push('Risk per trade exceeds 5% - very aggressive');
    if (riskNum > 10) errors.push('Risk per trade exceeds 10% - not recommended');

    // Check stop loss vs take profit ratio
    const sl = parseFloat(strategy.exit?.stopLoss?.replace('%', '') || '2');
    const tp = parseFloat(strategy.exit?.takeProfit?.replace('%', '') || '4');
    if (tp / sl < 1.5) warnings.push('Risk/reward ratio below 1.5:1 - consider widening TP');

    return {
      success: errors.length === 0,
      data: {
        valid: errors.length === 0,
        errors,
        warnings,
        score: Math.max(0, 100 - (errors.length * 25) - (warnings.length * 10)),
      },
    };
  }

  private async explainStrategy(params: any): Promise<SkillResult> {
    const { strategy } = params || {};
    
    if (!strategy) {
      return { success: false, error: 'Strategy object is required' };
    }

    const explanation: string[] = [];

    explanation.push(`## ${strategy.name}\n`);
    explanation.push(`**Type:** ${strategy.type} strategy on ${strategy.timeframe} timeframe\n`);
    
    explanation.push(`### Entry Logic`);
    strategy.entry?.conditions?.forEach((c: StrategyCondition, i: number) => {
      explanation.push(`${i + 1}. ${this.explainCondition(c)}`);
    });

    explanation.push(`\n### Exit Logic`);
    strategy.exit?.conditions?.forEach((c: StrategyCondition, i: number) => {
      explanation.push(`${i + 1}. ${this.explainCondition(c)}`);
    });
    explanation.push(`- Stop Loss: ${strategy.exit?.stopLoss}`);
    explanation.push(`- Take Profit: ${strategy.exit?.takeProfit}`);
    if (strategy.exit?.trailingStop) {
      explanation.push(`- Trailing Stop: ${strategy.exit.trailingStop}`);
    }

    explanation.push(`\n### Risk Management`);
    explanation.push(`- Risk per trade: ${strategy.risk?.perTrade}`);
    explanation.push(`- Max positions: ${strategy.risk?.maxPositions}`);
    explanation.push(`- Max drawdown: ${strategy.risk?.maxDrawdown}`);

    return {
      success: true,
      data: {
        markdown: explanation.join('\n'),
        summary: `${strategy.name} is a ${strategy.type} strategy using ${strategy.entry?.conditions?.length || 0} entry conditions and ${strategy.exit?.conditions?.length || 0} exit conditions with ${strategy.risk?.perTrade} risk per trade.`,
      },
    };
  }

  // Helper methods
  private parseDescription(desc: string): { entrySignals: string[]; exitSignals: string[] } {
    const lower = desc.toLowerCase();
    const entrySignals: string[] = [];
    const exitSignals: string[] = [];

    // Split by common separators
    const entrySections = ['buy when', 'enter when', 'long when', 'entry:'];
    const exitSections = ['sell when', 'exit when', 'close when', 'exit:'];

    let inEntry = true;
    const sentences = desc.split(/[.!?]/);

    for (const sentence of sentences) {
      const sentLower = sentence.toLowerCase();
      
      if (exitSections.some(s => sentLower.includes(s))) {
        inEntry = false;
      } else if (entrySections.some(s => sentLower.includes(s))) {
        inEntry = true;
      }

      // Extract indicator mentions
      for (const [indicator, builder] of Object.entries(INDICATOR_PATTERNS)) {
        if (sentLower.includes(indicator)) {
          if (inEntry) {
            entrySignals.push(sentence);
          } else {
            exitSignals.push(sentence);
          }
        }
      }

      // Check for price action mentions
      if (sentLower.includes('pullback') || sentLower.includes('support') || sentLower.includes('resistance')) {
        if (inEntry) entrySignals.push(sentence);
        else exitSignals.push(sentence);
      }
    }

    return { entrySignals, exitSignals };
  }

  private buildConditions(signals: string[]): StrategyCondition[] {
    const conditions: StrategyCondition[] = [];

    for (const signal of signals) {
      const signalLower = signal.toLowerCase();
      
      for (const [indicator, builder] of Object.entries(INDICATOR_PATTERNS)) {
        if (signalLower.includes(indicator)) {
          conditions.push(builder(signalLower));
        }
      }

      // Price pullback to EMA
      if (signalLower.includes('pullback') && signalLower.includes('ema')) {
        const period = parseInt(signalLower.match(/\d+/)?.[0] || '20');
        conditions.push({
          indicator: 'price',
          crosses: `ema_${period}`,
          direction: 'up',
        });
      }

      // Support/resistance levels
      if (signalLower.includes('support')) {
        conditions.push({
          indicator: 'support_resistance',
          direction: 'bounce_support',
        });
      }
    }

    // Deduplicate
    return conditions.filter((c, i, arr) => 
      arr.findIndex(x => x.indicator === c.indicator && x.period === c.period) === i
    );
  }

  private generateStrategyName(parsed: { entrySignals: string[]; exitSignals: string[] }): string {
    const indicators: string[] = [];
    
    for (const signal of [...parsed.entrySignals, ...parsed.exitSignals]) {
      const lower = signal.toLowerCase();
      if (lower.includes('rsi')) indicators.push('RSI');
      if (lower.includes('macd')) indicators.push('MACD');
      if (lower.includes('ema')) indicators.push('EMA');
      if (lower.includes('sma')) indicators.push('SMA');
      if (lower.includes('bollinger')) indicators.push('BB');
      if (lower.includes('pullback')) indicators.push('Pullback');
      if (lower.includes('momentum')) indicators.push('Momentum');
    }

    const unique = [...new Set(indicators)].slice(0, 3);
    return unique.length > 0 ? `${unique.join(' ')} Strategy` : 'AI Generated Strategy';
  }

  private inferStrategyType(desc: string): GeneratedStrategy['type'] {
    const lower = desc.toLowerCase();
    if (lower.includes('scalp')) return 'scalping';
    if (lower.includes('day trad') || lower.includes('intraday')) return 'day_trading';
    if (lower.includes('swing')) return 'swing';
    if (lower.includes('position') || lower.includes('long term')) return 'position';
    return 'swing'; // default
  }

  private inferTimeframe(desc: string, type: GeneratedStrategy['type']): string {
    const lower = desc.toLowerCase();
    
    // Check for explicit timeframe
    const tfMatch = lower.match(/(\d+[mh]|daily|weekly)/);
    if (tfMatch) {
      const tf = tfMatch[1];
      if (tf === 'daily') return '1d';
      if (tf === 'weekly') return '1w';
      return tf;
    }

    // Default by strategy type
    switch (type) {
      case 'scalping': return '5m';
      case 'day_trading': return '15m';
      case 'swing': return '4h';
      case 'position': return '1d';
      default: return '1h';
    }
  }

  private inferStopLoss(type: GeneratedStrategy['type'], riskPerTrade: string): string {
    switch (type) {
      case 'scalping': return '0.5%';
      case 'day_trading': return '1%';
      case 'swing': return '2%';
      case 'position': return '3%';
      default: return '2%';
    }
  }

  private inferTakeProfit(type: GeneratedStrategy['type']): string {
    switch (type) {
      case 'scalping': return '1%';
      case 'day_trading': return '2%';
      case 'swing': return '5%';
      case 'position': return '10%';
      default: return '4%';
    }
  }

  private calculateRiskParams(desc: string, defaultRisk: string): GeneratedStrategy['risk'] {
    const lower = desc.toLowerCase();
    
    // Check for explicit risk mention
    const riskMatch = lower.match(/risk\s*(\d+(?:\.\d+)?)\s*%/);
    const perTrade = riskMatch ? `${riskMatch[1]}%` : defaultRisk;

    return {
      perTrade,
      maxPositions: lower.includes('conservative') ? 2 : lower.includes('aggressive') ? 5 : 3,
      maxDrawdown: lower.includes('conservative') ? '10%' : this._config.constraints.maxDrawdown,
    };
  }

  private calculateConfidence(entry: StrategyCondition[], exit: StrategyCondition[]): number {
    let confidence = 0.5;
    
    if (entry.length >= 2) confidence += 0.15;
    if (entry.length >= 3) confidence += 0.1;
    if (exit.length >= 1) confidence += 0.1;
    if (entry.some(c => c.indicator === 'volume')) confidence += 0.1;
    
    return Math.min(0.95, confidence);
  }

  private generateSuggestions(strategy: GeneratedStrategy): string[] {
    const suggestions: string[] = [];
    
    if (strategy.entry.conditions.length < 2) {
      suggestions.push('Consider adding volume confirmation to filter false signals');
    }
    
    if (!strategy.entry.conditions.some(c => c.indicator === 'volume')) {
      suggestions.push('Volume analysis can improve signal quality');
    }

    if (strategy.type === 'swing' && !strategy.exit.trailingStop) {
      suggestions.push('Trailing stop could help capture larger moves');
    }

    suggestions.push('Backtest on at least 2 years of data before live trading');
    suggestions.push('Paper trade for 7 days minimum before deploying capital');

    return suggestions;
  }

  private generateWarnings(strategy: GeneratedStrategy): string[] {
    const warnings: string[] = [];
    
    if (strategy.entry.conditions.length > 4) {
      warnings.push('Many conditions may result in few trade signals');
    }

    warnings.push('Strategy is unverified - requires backtest validation');
    
    return warnings;
  }

  private convertToPython(strategy: GeneratedStrategy): string {
    return `# ${strategy.name}
# Generated by K.I.T. Strategy Generator
# Type: ${strategy.type} | Timeframe: ${strategy.timeframe}

import pandas as pd
import numpy as np
from kit_trading import Strategy, Signal

class ${strategy.name.replace(/\s+/g, '')}(Strategy):
    """${strategy.description}"""
    
    def __init__(self):
        super().__init__(
            name="${strategy.name}",
            timeframe="${strategy.timeframe}",
            risk_per_trade=${parseFloat(strategy.risk.perTrade.replace('%', '')) / 100},
            max_positions=${strategy.risk.maxPositions}
        )
    
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        # Add your indicators here
${strategy.entry.conditions.map(c => `        # ${c.indicator}: ${JSON.stringify(c)}`).join('\n')}
        return df
    
    def generate_signal(self, df: pd.DataFrame) -> Signal:
        # Entry conditions
        entry = True
        # Exit conditions
        exit = False
        
        if entry:
            return Signal.LONG
        elif exit:
            return Signal.CLOSE
        return Signal.HOLD
    
    def get_stop_loss(self, entry_price: float) -> float:
        return entry_price * (1 - ${parseFloat(strategy.exit.stopLoss.replace('%', '')) / 100})
    
    def get_take_profit(self, entry_price: float) -> float:
        return entry_price * (1 + ${parseFloat(strategy.exit.takeProfit.replace('%', '')) / 100})
`;
  }

  private convertToPineScript(strategy: GeneratedStrategy): string {
    return `//@version=5
// ${strategy.name}
// Generated by K.I.T. Strategy Generator
strategy("${strategy.name}", overlay=true, default_qty_type=strategy.percent_of_equity, default_qty_value=${parseFloat(strategy.risk.perTrade.replace('%', ''))})

// === INPUTS ===
stopLossPercent = input.float(${parseFloat(strategy.exit.stopLoss.replace('%', ''))}, "Stop Loss %")
takeProfitPercent = input.float(${parseFloat(strategy.exit.takeProfit.replace('%', ''))}, "Take Profit %")

// === INDICATORS ===
${strategy.entry.conditions.map(c => {
  if (c.indicator === 'rsi') return `rsiValue = ta.rsi(close, ${c.period || 14})`;
  if (c.indicator === 'macd') return `[macdLine, signalLine, _] = ta.macd(close, 12, 26, 9)`;
  if (c.indicator === 'ema') return `ema${c.period || 20} = ta.ema(close, ${c.period || 20})`;
  return `// ${c.indicator}`;
}).join('\n')}

// === ENTRY CONDITIONS ===
longCondition = true // Add your conditions

// === EXIT CONDITIONS ===
shortCondition = false // Add your conditions

// === EXECUTE ===
if (longCondition)
    strategy.entry("Long", strategy.long)
    strategy.exit("Exit", "Long", stop=close * (1 - stopLossPercent/100), limit=close * (1 + takeProfitPercent/100))

if (shortCondition)
    strategy.close("Long")

// === PLOTS ===
plot(ema20, color=color.blue, title="EMA 20")
`;
  }

  private explainCondition(c: StrategyCondition): string {
    switch (c.indicator) {
      case 'rsi':
        if (c.below) return `RSI(${c.period || 14}) is below ${c.below} (oversold)`;
        if (c.above) return `RSI(${c.period || 14}) is above ${c.above} (overbought)`;
        return `RSI(${c.period || 14}) indicator check`;
      case 'macd':
        if (c.direction === 'up') return 'MACD crosses above signal line (bullish)';
        if (c.direction === 'down') return 'MACD crosses below signal line (bearish)';
        return 'MACD indicator check';
      case 'ema':
        return `EMA(${c.period}) price relationship`;
      case 'price':
        return `Price ${c.direction === 'up' ? 'crosses above' : 'crosses below'} ${c.crosses}`;
      case 'volume':
        return `Volume is ${c.above}% above average (confirmation)`;
      default:
        return `${c.indicator} condition`;
    }
  }

  private reduceStopLoss(sl: string): string {
    const val = parseFloat(sl.replace('%', ''));
    return `${Math.max(0.5, val * 0.7).toFixed(1)}%`;
  }

  private reduceRiskPerTrade(risk: string): string {
    const val = parseFloat(risk.replace('%', ''));
    return `${Math.max(0.5, val * 0.7).toFixed(1)}%`;
  }

  private lowerTimeframe(tf: string): string {
    const map: Record<string, string> = {
      '1d': '4h',
      '4h': '1h',
      '1h': '30m',
      '30m': '15m',
      '15m': '5m',
    };
    return map[tf] || tf;
  }

  private increaseTakeProfit(tp: string): string {
    const val = parseFloat(tp.replace('%', ''));
    return `${(val * 1.5).toFixed(1)}%`;
  }
}

// Export singleton instance
export const strategyGenerator = new StrategyGeneratorSkill();
export default strategyGenerator;
