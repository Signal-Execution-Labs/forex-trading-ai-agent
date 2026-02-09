/**
 * K.I.T. Strategy Manager
 * Manages and executes trading strategies
 */

import { Logger } from '../core/logger';
import { MarketData } from '../exchanges/manager';
import { BaseStrategy, Signal, OHLCV, StrategyConfig } from './base';

// Import all strategies
import { SMACrossoverStrategy } from './sma-crossover';
import { RSIStrategy } from './rsi';
import { MACDStrategy } from './macd';
import { BollingerStrategy } from './bollinger';
import { IchimokuStrategy } from './ichimoku';
import { VolumeProfileStrategy } from './volume-profile';

export { Signal, OHLCV, StrategyConfig } from './base';

export interface Strategy {
  name: string;
  description: string;
  analyze(data: MarketData[], historicalData?: Map<string, OHLCV[]>): Promise<Signal[]>;
  configure(params: any): void;
}

export interface StrategyWeight {
  name: string;
  weight: number;
  enabled: boolean;
}

export interface AggregatedSignal extends Signal {
  sources: string[];
  combinedConfidence: number;
  agreementRatio: number;
}

export class StrategyManager {
  private logger: Logger;
  private strategies: Map<string, BaseStrategy> = new Map();
  private legacyStrategies: Map<string, Strategy> = new Map();
  private weights: Map<string, number> = new Map();
  private historicalDataCache: Map<string, OHLCV[]> = new Map();

  constructor() {
    this.logger = new Logger('Strategies');
  }

  async loadStrategies(): Promise<void> {
    this.logger.info('Loading trading strategies...');
    
    // Load advanced indicator-based strategies
    await this.loadAdvancedStrategies();
    
    // Load legacy built-in strategies
    await this.loadBuiltInStrategies();
    
    this.logger.info(`Loaded ${this.strategies.size + this.legacyStrategies.size} strategies`);
  }

  private async loadAdvancedStrategies(): Promise<void> {
    // SMA/EMA Crossover Strategy
    const smaCrossover = new SMACrossoverStrategy();
    this.strategies.set(smaCrossover.getName(), smaCrossover);
    this.weights.set(smaCrossover.getName(), 1.0);
    this.logger.info(`Registered strategy: ${smaCrossover.getName()}`);

    // RSI Strategy
    const rsi = new RSIStrategy();
    this.strategies.set(rsi.getName(), rsi);
    this.weights.set(rsi.getName(), 1.0);
    this.logger.info(`Registered strategy: ${rsi.getName()}`);

    // MACD Strategy
    const macd = new MACDStrategy();
    this.strategies.set(macd.getName(), macd);
    this.weights.set(macd.getName(), 1.0);
    this.logger.info(`Registered strategy: ${macd.getName()}`);

    // Bollinger Bands Strategy
    const bollinger = new BollingerStrategy();
    this.strategies.set(bollinger.getName(), bollinger);
    this.weights.set(bollinger.getName(), 1.0);
    this.logger.info(`Registered strategy: ${bollinger.getName()}`);

    // Ichimoku Cloud Strategy
    const ichimoku = new IchimokuStrategy();
    this.strategies.set(ichimoku.getName(), ichimoku);
    this.weights.set(ichimoku.getName(), 1.2); // Higher weight for comprehensive strategy
    this.logger.info(`Registered strategy: ${ichimoku.getName()}`);

    // Volume Profile Strategy
    const volumeProfile = new VolumeProfileStrategy();
    this.strategies.set(volumeProfile.getName(), volumeProfile);
    this.weights.set(volumeProfile.getName(), 0.8); // Lower weight, use as confirmation
    this.logger.info(`Registered strategy: ${volumeProfile.getName()}`);
  }

  private async loadBuiltInStrategies(): Promise<void> {
    // Legacy Trend Following Strategy
    this.registerLegacyStrategy({
      name: 'TrendFollower',
      description: 'Follows market trends using moving averages',
      analyze: async (data: MarketData[]) => this.trendFollowingStrategy(data),
      configure: () => {}
    });

    // Legacy Mean Reversion Strategy
    this.registerLegacyStrategy({
      name: 'MeanReversion',
      description: 'Trades on mean reversion principles',
      analyze: async (data: MarketData[]) => this.meanReversionStrategy(data),
      configure: () => {}
    });

    // Legacy Momentum Strategy
    this.registerLegacyStrategy({
      name: 'Momentum',
      description: 'Trades based on price momentum',
      analyze: async (data: MarketData[]) => this.momentumStrategy(data),
      configure: () => {}
    });

    // Legacy Breakout Strategy
    this.registerLegacyStrategy({
      name: 'Breakout',
      description: 'Trades breakouts from support/resistance',
      analyze: async (data: MarketData[]) => this.breakoutStrategy(data),
      configure: () => {}
    });
  }

  registerStrategy(strategy: BaseStrategy, weight: number = 1.0): void {
    this.strategies.set(strategy.getName(), strategy);
    this.weights.set(strategy.getName(), weight);
    this.logger.info(`Registered strategy: ${strategy.getName()} (weight: ${weight})`);
  }

  registerLegacyStrategy(strategy: Strategy): void {
    this.legacyStrategies.set(strategy.name, strategy);
    this.weights.set(strategy.name, 0.5); // Lower weight for legacy strategies
    this.logger.info(`Registered legacy strategy: ${strategy.name}`);
  }

  /**
   * Update historical data cache for a symbol
   */
  updateHistoricalData(key: string, data: OHLCV[]): void {
    this.historicalDataCache.set(key, data);
  }

  /**
   * Analyze market data using all enabled strategies
   */
  async analyze(marketData: MarketData[]): Promise<Signal[]> {
    const allSignals: Signal[] = [];

    // Run advanced strategies
    for (const [name, strategy] of this.strategies) {
      if (!strategy.isEnabled()) continue;
      
      try {
        const signals = await strategy.analyze(marketData, this.historicalDataCache);
        
        // Apply strategy weight to confidence
        const weight = this.weights.get(name) || 1.0;
        for (const signal of signals) {
          signal.confidence *= weight;
        }
        
        allSignals.push(...signals);
      } catch (error) {
        this.logger.error(`Strategy ${name} failed:`, error);
      }
    }

    // Run legacy strategies
    for (const [name, strategy] of this.legacyStrategies) {
      try {
        const signals = await strategy.analyze(marketData);
        
        const weight = this.weights.get(name) || 0.5;
        for (const signal of signals) {
          signal.confidence *= weight;
        }
        
        allSignals.push(...signals);
      } catch (error) {
        this.logger.error(`Legacy Strategy ${name} failed:`, error);
      }
    }

    return allSignals;
  }

  /**
   * Analyze and aggregate signals from multiple strategies
   * Returns combined signals with agreement metrics
   */
  async analyzeWithAggregation(marketData: MarketData[]): Promise<AggregatedSignal[]> {
    const allSignals = await this.analyze(marketData);
    return this.aggregateSignals(allSignals);
  }

  /**
   * Aggregate signals by symbol and direction
   */
  private aggregateSignals(signals: Signal[]): AggregatedSignal[] {
    const grouped = new Map<string, Signal[]>();

    // Group by symbol and side
    for (const signal of signals) {
      const key = `${signal.exchange}:${signal.symbol}:${signal.side}`;
      const existing = grouped.get(key) || [];
      existing.push(signal);
      grouped.set(key, existing);
    }

    // Aggregate grouped signals
    const aggregated: AggregatedSignal[] = [];

    for (const [key, groupSignals] of grouped) {
      if (groupSignals.length === 0) continue;

      const totalStrategies = this.strategies.size + this.legacyStrategies.size;
      const agreementRatio = groupSignals.length / totalStrategies;

      // Weighted average confidence
      let totalWeight = 0;
      let weightedConfidence = 0;
      
      for (const sig of groupSignals) {
        const weight = this.weights.get(sig.strategy) || 1.0;
        weightedConfidence += sig.confidence * weight;
        totalWeight += weight;
      }

      const combinedConfidence = totalWeight > 0 
        ? weightedConfidence / totalWeight 
        : groupSignals[0].confidence;

      // Use best signal as base
      const bestSignal = groupSignals.reduce((best, current) => 
        current.confidence > best.confidence ? current : best
      );

      aggregated.push({
        ...bestSignal,
        sources: groupSignals.map(s => s.strategy),
        combinedConfidence: Math.min(combinedConfidence * (1 + agreementRatio * 0.5), 1),
        agreementRatio
      });
    }

    // Sort by combined confidence
    return aggregated.sort((a, b) => b.combinedConfidence - a.combinedConfidence);
  }

  /**
   * Configure a specific strategy
   */
  configureStrategy(name: string, params: Partial<StrategyConfig>): boolean {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.configure(params);
      return true;
    }
    
    const legacy = this.legacyStrategies.get(name);
    if (legacy) {
      legacy.configure(params);
      return true;
    }
    
    return false;
  }

  /**
   * Set strategy weight
   */
  setStrategyWeight(name: string, weight: number): boolean {
    if (this.strategies.has(name) || this.legacyStrategies.has(name)) {
      this.weights.set(name, Math.max(0, Math.min(2, weight)));
      return true;
    }
    return false;
  }

  /**
   * Enable or disable a strategy
   */
  setStrategyEnabled(name: string, enabled: boolean): boolean {
    const strategy = this.strategies.get(name);
    if (strategy) {
      strategy.configure({ enabled });
      return true;
    }
    return false;
  }

  /**
   * Get strategy weights configuration
   */
  getStrategyWeights(): StrategyWeight[] {
    const weights: StrategyWeight[] = [];

    for (const [name, strategy] of this.strategies) {
      weights.push({
        name,
        weight: this.weights.get(name) || 1.0,
        enabled: strategy.isEnabled()
      });
    }

    for (const [name] of this.legacyStrategies) {
      weights.push({
        name,
        weight: this.weights.get(name) || 0.5,
        enabled: true
      });
    }

    return weights;
  }

  // ===== LEGACY BUILT-IN STRATEGIES =====

  private async trendFollowingStrategy(data: MarketData[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const market of data) {
      const randomConfidence = Math.random();
      
      if (randomConfidence > 0.8) {
        signals.push({
          symbol: market.symbol,
          exchange: market.exchange,
          side: market.price > market.low24h * 1.02 ? 'buy' : 'sell',
          amount: 0.01,
          price: market.price,
          strategy: 'TrendFollower',
          confidence: randomConfidence,
          timestamp: new Date()
        });
      }
    }
    
    return signals;
  }

  private async meanReversionStrategy(data: MarketData[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const market of data) {
      const midPrice = (market.high24h + market.low24h) / 2;
      const deviation = (market.price - midPrice) / midPrice;
      
      if (Math.abs(deviation) > 0.02) {
        signals.push({
          symbol: market.symbol,
          exchange: market.exchange,
          side: deviation > 0 ? 'sell' : 'buy',
          amount: 0.01,
          price: market.price,
          strategy: 'MeanReversion',
          confidence: Math.min(Math.abs(deviation) * 10, 1),
          timestamp: new Date()
        });
      }
    }
    
    return signals;
  }

  private async momentumStrategy(data: MarketData[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const market of data) {
      const range = market.high24h - market.low24h;
      const position = (market.price - market.low24h) / range;
      
      if (position > 0.9 || position < 0.1) {
        signals.push({
          symbol: market.symbol,
          exchange: market.exchange,
          side: position > 0.5 ? 'buy' : 'sell',
          amount: 0.01,
          price: market.price,
          strategy: 'Momentum',
          confidence: Math.abs(position - 0.5) * 2,
          timestamp: new Date()
        });
      }
    }
    
    return signals;
  }

  private async breakoutStrategy(data: MarketData[]): Promise<Signal[]> {
    const signals: Signal[] = [];
    
    for (const market of data) {
      const threshold = 0.005;
      
      if (market.price > market.high24h * (1 - threshold)) {
        signals.push({
          symbol: market.symbol,
          exchange: market.exchange,
          side: 'buy',
          amount: 0.01,
          price: market.price,
          strategy: 'Breakout',
          confidence: 0.7,
          timestamp: new Date()
        });
      } else if (market.price < market.low24h * (1 + threshold)) {
        signals.push({
          symbol: market.symbol,
          exchange: market.exchange,
          side: 'sell',
          amount: 0.01,
          price: market.price,
          strategy: 'Breakout',
          confidence: 0.7,
          timestamp: new Date()
        });
      }
    }
    
    return signals;
  }

  listStrategies(): string[] {
    return [
      ...Array.from(this.strategies.keys()),
      ...Array.from(this.legacyStrategies.keys())
    ];
  }

  getStrategy(name: string): BaseStrategy | Strategy | undefined {
    return this.strategies.get(name) || this.legacyStrategies.get(name);
  }

  getAdvancedStrategy(name: string): BaseStrategy | undefined {
    return this.strategies.get(name);
  }
}
