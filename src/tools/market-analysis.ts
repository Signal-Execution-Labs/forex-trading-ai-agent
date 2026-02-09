/**
 * K.I.T. Market Analysis Tool
 * 
 * Issue #4: Market-Analysis Tool
 * 
 * Provides comprehensive market analysis capabilities:
 * - Technical indicators (RSI, MACD, Bollinger Bands, etc.)
 * - Price action analysis
 * - Support/Resistance detection
 * - Trend identification
 * - Signal generation
 */

import ccxt, { Exchange } from 'ccxt';
import {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  ATR,
  ADX,
  OBV,
} from 'technicalindicators';
import {
  OHLCV,
  TechnicalIndicators,
  MarketAnalysis,
  ExchangeConfig,
  Ticker,
} from './types';

// Helper to safely convert ccxt values
const toNum = (val: number | string | undefined, def: number = 0): number => {
  if (val === undefined || val === null) return def;
  return typeof val === 'string' ? parseFloat(val) : val;
};

export interface AnalysisParams {
  symbol: string;
  timeframe?: string;
  limit?: number;
  indicators?: string[];
}

export interface PriceData {
  symbol: string;
  timeframe: string;
  ohlcv: OHLCV[];
  ticker?: Ticker;
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
  pivotPoint?: number;
}

export interface TrendAnalysis {
  direction: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  description: string;
}

export interface SignalResult {
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  confidence: number;
  reasons: string[];
}

export class MarketAnalyzer {
  private exchange: Exchange | null = null;
  private exchangeId: string = 'binance';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout: number = 60000;

  constructor(exchangeConfig?: ExchangeConfig) {
    if (exchangeConfig) this.exchangeId = exchangeConfig.id;
  }

  async connect(exchangeConfig?: ExchangeConfig): Promise<boolean> {
    try {
      const cfg = exchangeConfig || { id: this.exchangeId };
      const exchangeId = cfg.id.toLowerCase();
      
      if (!(exchangeId in ccxt)) {
        throw new Error(`Exchange ${cfg.id} not supported`);
      }

      const ExchangeClass = (ccxt as any)[exchangeId];
      this.exchange = new ExchangeClass({
        apiKey: cfg.apiKey,
        secret: cfg.secret,
        sandbox: cfg.sandbox,
        enableRateLimit: true,
      }) as Exchange;

      await this.exchange.loadMarkets();
      return true;
    } catch (error: any) {
      console.error('Failed to connect:', error.message);
      return false;
    }
  }

  async getData(params: AnalysisParams): Promise<PriceData> {
    await this.ensureConnected();
    const timeframe = params.timeframe || '1h';
    const limit = params.limit || 100;

    const cacheKey = `data_${params.symbol}_${timeframe}_${limit}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const [ohlcvRaw, tickerRaw] = await Promise.all([
      this.exchange!.fetchOHLCV(params.symbol, timeframe, undefined, limit),
      this.exchange!.fetchTicker(params.symbol),
    ]);

    const ohlcv: OHLCV[] = ohlcvRaw.map((candle: any) => ({
      timestamp: candle[0] as number,
      open: toNum(candle[1]),
      high: toNum(candle[2]),
      low: toNum(candle[3]),
      close: toNum(candle[4]),
      volume: toNum(candle[5]),
    }));

    const ticker: Ticker = {
      symbol: tickerRaw.symbol,
      last: toNum(tickerRaw.last),
      bid: toNum(tickerRaw.bid),
      ask: toNum(tickerRaw.ask),
      high: toNum(tickerRaw.high),
      low: toNum(tickerRaw.low),
      volume: toNum(tickerRaw.baseVolume),
      change: toNum(tickerRaw.change),
      percentage: toNum(tickerRaw.percentage),
      timestamp: tickerRaw.timestamp || Date.now(),
    };

    const result: PriceData = { symbol: params.symbol, timeframe, ohlcv, ticker };
    this.setCache(cacheKey, result);
    return result;
  }

  async analyze(params: AnalysisParams): Promise<MarketAnalysis> {
    const data = await this.getData(params);
    const indicators = await this.calculateIndicators(data, params.indicators);
    const trend = this.analyzeTrend(data, indicators);
    const sr = this.findSupportResistance(data);
    const signal = this.generateSignal(indicators, trend);

    return {
      symbol: params.symbol,
      timeframe: params.timeframe || '1h',
      price: data.ticker?.last || data.ohlcv[data.ohlcv.length - 1].close,
      change24h: data.ticker?.percentage || 0,
      trend: trend.direction,
      strength: trend.strength,
      signal: signal.signal,
      indicators,
      support: sr.supports,
      resistance: sr.resistances,
      timestamp: Date.now(),
    };
  }

  async calculateIndicators(data: PriceData, requestedIndicators?: string[]): Promise<TechnicalIndicators> {
    const closes = data.ohlcv.map(c => c.close);
    const highs = data.ohlcv.map(c => c.high);
    const lows = data.ohlcv.map(c => c.low);
    const volumes = data.ohlcv.map(c => c.volume);

    const indicators: TechnicalIndicators = {};

    if (!requestedIndicators || requestedIndicators.includes('rsi')) {
      const rsiValues = RSI.calculate({ period: 14, values: closes });
      indicators.rsi = rsiValues[rsiValues.length - 1];
    }

    if (!requestedIndicators || requestedIndicators.includes('macd')) {
      const macdValues = MACD.calculate({
        fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        values: closes, SimpleMAOscillator: false, SimpleMASignal: false,
      });
      const lastMacd = macdValues[macdValues.length - 1];
      if (lastMacd) {
        indicators.macd = {
          macd: lastMacd.MACD || 0,
          signal: lastMacd.signal || 0,
          histogram: lastMacd.histogram || 0,
        };
      }
    }

    if (!requestedIndicators || requestedIndicators.includes('bollinger')) {
      const bbValues = BollingerBands.calculate({ period: 20, values: closes, stdDev: 2 });
      const lastBB = bbValues[bbValues.length - 1];
      if (lastBB) {
        indicators.bollinger = { upper: lastBB.upper, middle: lastBB.middle, lower: lastBB.lower };
      }
    }

    if (!requestedIndicators || requestedIndicators.includes('sma')) {
      indicators.sma = {};
      for (const period of [20, 50, 200]) {
        if (closes.length >= period) {
          const smaValues = SMA.calculate({ period, values: closes });
          indicators.sma[period] = smaValues[smaValues.length - 1];
        }
      }
    }

    if (!requestedIndicators || requestedIndicators.includes('ema')) {
      indicators.ema = {};
      for (const period of [12, 26, 50]) {
        if (closes.length >= period) {
          const emaValues = EMA.calculate({ period, values: closes });
          indicators.ema[period] = emaValues[emaValues.length - 1];
        }
      }
    }

    if (!requestedIndicators || requestedIndicators.includes('atr')) {
      const atrValues = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
      indicators.atr = atrValues[atrValues.length - 1];
    }

    if (!requestedIndicators || requestedIndicators.includes('adx')) {
      const adxValues = ADX.calculate({ period: 14, high: highs, low: lows, close: closes });
      const lastAdx = adxValues[adxValues.length - 1];
      indicators.adx = lastAdx?.adx;
    }

    if (!requestedIndicators || requestedIndicators.includes('obv')) {
      const obvValues = OBV.calculate({ close: closes, volume: volumes });
      indicators.obv = obvValues[obvValues.length - 1];
    }

    indicators.volume = volumes[volumes.length - 1];
    const volumeSma = SMA.calculate({ period: 20, values: volumes });
    indicators.volumeSma = volumeSma[volumeSma.length - 1];

    return indicators;
  }

  analyzeTrend(data: PriceData, indicators: TechnicalIndicators): TrendAnalysis {
    const closes = data.ohlcv.map(c => c.close);
    const currentPrice = closes[closes.length - 1];
    let bullishScore = 0;
    let totalChecks = 0;

    if (indicators.sma) {
      if (indicators.sma[20] && currentPrice > indicators.sma[20]) bullishScore++;
      if (indicators.sma[50] && currentPrice > indicators.sma[50]) bullishScore++;
      if (indicators.sma[200] && currentPrice > indicators.sma[200]) bullishScore++;
      totalChecks += 3;
    }

    if (indicators.ema && indicators.ema[12] && indicators.ema[26]) {
      if (indicators.ema[12] > indicators.ema[26]) bullishScore += 2;
      totalChecks += 2;
    }

    if (indicators.macd) {
      if (indicators.macd.histogram > 0) bullishScore++;
      if (indicators.macd.macd > indicators.macd.signal) bullishScore++;
      totalChecks += 2;
    }

    if (indicators.rsi) {
      if (indicators.rsi > 50) bullishScore++;
      if (indicators.rsi > 30 && indicators.rsi < 70) bullishScore += 0.5;
      totalChecks += 1.5;
    }

    const recentCandles = data.ohlcv.slice(-10);
    let higherHighs = 0, higherLows = 0;
    for (let i = 1; i < recentCandles.length; i++) {
      if (recentCandles[i].high > recentCandles[i - 1].high) higherHighs++;
      if (recentCandles[i].low > recentCandles[i - 1].low) higherLows++;
    }
    if (higherHighs > 5) bullishScore++;
    if (higherLows > 5) bullishScore++;
    totalChecks += 2;

    const strength = Math.round((bullishScore / totalChecks) * 100);
    let direction: 'bullish' | 'bearish' | 'neutral';
    let description: string;

    if (strength >= 65) { direction = 'bullish'; description = 'Strong uptrend'; }
    else if (strength >= 55) { direction = 'bullish'; description = 'Moderate uptrend'; }
    else if (strength >= 45) { direction = 'neutral'; description = 'Sideways'; }
    else if (strength >= 35) { direction = 'bearish'; description = 'Moderate downtrend'; }
    else { direction = 'bearish'; description = 'Strong downtrend'; }

    return { direction, strength, description };
  }

  findSupportResistance(data: PriceData): SupportResistance {
    const highs = data.ohlcv.map(c => c.high);
    const lows = data.ohlcv.map(c => c.low);
    const resistanceLevels: number[] = [];
    const supportLevels: number[] = [];

    for (let i = 2; i < data.ohlcv.length - 2; i++) {
      if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
        resistanceLevels.push(highs[i]);
      }
      if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
        supportLevels.push(lows[i]);
      }
    }

    const lastCandle = data.ohlcv[data.ohlcv.length - 1];
    const pivotPoint = (lastCandle.high + lastCandle.low + lastCandle.close) / 3;

    return {
      supports: this.clusterLevels(supportLevels).slice(-3),
      resistances: this.clusterLevels(resistanceLevels).slice(-3),
      pivotPoint,
    };
  }

  generateSignal(indicators: TechnicalIndicators, trend: TrendAnalysis): SignalResult {
    const reasons: string[] = [];
    let score = 0;

    if (indicators.rsi) {
      if (indicators.rsi < 30) { score += 2; reasons.push('RSI oversold'); }
      else if (indicators.rsi < 40) { score += 1; reasons.push('RSI low'); }
      else if (indicators.rsi > 70) { score -= 2; reasons.push('RSI overbought'); }
      else if (indicators.rsi > 60) { score -= 1; reasons.push('RSI high'); }
    }

    if (indicators.macd) {
      if (indicators.macd.histogram > 0 && indicators.macd.macd > indicators.macd.signal) {
        score += 2; reasons.push('MACD bullish');
      } else if (indicators.macd.histogram < 0 && indicators.macd.macd < indicators.macd.signal) {
        score -= 2; reasons.push('MACD bearish');
      }
    }

    if (trend.direction === 'bullish' && trend.strength > 60) {
      score += 2; reasons.push('Strong bullish trend');
    } else if (trend.direction === 'bearish' && trend.strength < 40) {
      score -= 2; reasons.push('Strong bearish trend');
    }

    if (indicators.volume && indicators.volumeSma && indicators.volume > indicators.volumeSma * 1.5) {
      reasons.push('High volume');
    }

    let signal: SignalResult['signal'];
    let confidence: number;

    if (score >= 5) { signal = 'strong_buy'; confidence = Math.min(90, 60 + score * 5); }
    else if (score >= 2) { signal = 'buy'; confidence = Math.min(75, 50 + score * 5); }
    else if (score <= -5) { signal = 'strong_sell'; confidence = Math.min(90, 60 + Math.abs(score) * 5); }
    else if (score <= -2) { signal = 'sell'; confidence = Math.min(75, 50 + Math.abs(score) * 5); }
    else { signal = 'hold'; confidence = 50; }

    return { signal, confidence, reasons };
  }

  async getPrice(symbol: string): Promise<number> {
    await this.ensureConnected();
    const ticker = await this.exchange!.fetchTicker(symbol);
    return toNum(ticker.last);
  }

  async getOrderbook(symbol: string, limit: number = 20): Promise<{ bids: number[][]; asks: number[][] }> {
    await this.ensureConnected();
    const ob = await this.exchange!.fetchOrderBook(symbol, limit);
    return {
      bids: ob.bids.map(b => [toNum(b[0]), toNum(b[1])]),
      asks: ob.asks.map(a => [toNum(a[0]), toNum(a[1])]),
    };
  }

  private async ensureConnected(): Promise<void> {
    if (!this.exchange) await this.connect();
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) return cached.data;
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private clusterLevels(levels: number[], tolerance: number = 0.02): number[] {
    if (levels.length === 0) return [];
    const sorted = [...levels].sort((a, b) => a - b);
    const clusters: number[][] = [[sorted[0]]];

    for (let i = 1; i < sorted.length; i++) {
      const lastCluster = clusters[clusters.length - 1];
      if (Math.abs(sorted[i] - lastCluster[lastCluster.length - 1]) / lastCluster[lastCluster.length - 1] < tolerance) {
        lastCluster.push(sorted[i]);
      } else {
        clusters.push([sorted[i]]);
      }
    }
    return clusters.map(c => c.reduce((a, b) => a + b, 0) / c.length);
  }
}

export function createMarketAnalyzer(config?: ExchangeConfig): MarketAnalyzer {
  return new MarketAnalyzer(config);
}

export default MarketAnalyzer;
