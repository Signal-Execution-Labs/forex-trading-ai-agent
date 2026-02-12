/**
 * Technical Rating - TradingView-style aggregate indicator rating
 * Skill #79 | Inspired by TradingView Technical Rating
 */

export type Signal = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';

export interface IndicatorResult {
  name: string;
  value: number;
  signal: Signal;
  weight: number;
}

export interface RatingCategory {
  rating: number;
  signal: Signal;
  buy: number;
  sell: number;
  neutral: number;
  indicators: IndicatorResult[];
}

export interface TechnicalRating {
  symbol: string;
  timeframe: string;
  timestamp: Date;
  rating: number;
  signal: Signal;
  oscillators: RatingCategory;
  movingAverages: RatingCategory;
  summary: string;
  aiConfidence: number;
}

// Signal thresholds
const STRONG_BUY = 0.5;
const BUY = 0.1;
const SELL = -0.1;
const STRONG_SELL = -0.5;

function valueToSignal(value: number): Signal {
  if (value >= STRONG_BUY) return 'Strong Buy';
  if (value >= BUY) return 'Buy';
  if (value > SELL) return 'Neutral';
  if (value > STRONG_SELL) return 'Sell';
  return 'Strong Sell';
}

/**
 * Calculate RSI indicator signal
 */
function calculateRSI(rsi: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (rsi < 30) {
    signal = 'Buy';
    value = (30 - rsi) / 30; // 0 to 1
  } else if (rsi > 70) {
    signal = 'Sell';
    value = -((rsi - 70) / 30); // 0 to -1
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'RSI(14)', value, signal, weight: 1 };
}

/**
 * Calculate Stochastic %K signal
 */
function calculateStochastic(k: number, d: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (k < 20 && k > d) {
    signal = 'Buy';
    value = 0.5;
  } else if (k > 80 && k < d) {
    signal = 'Sell';
    value = -0.5;
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'Stoch %K(14,3,3)', value, signal, weight: 1 };
}

/**
 * Calculate CCI signal
 */
function calculateCCI(cci: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (cci < -100) {
    signal = 'Buy';
    value = Math.min(1, (-100 - cci) / 100);
  } else if (cci > 100) {
    signal = 'Sell';
    value = -Math.min(1, (cci - 100) / 100);
  } else {
    signal = 'Neutral';
    value = cci / 200; // -0.5 to 0.5
  }
  
  return { name: 'CCI(20)', value, signal, weight: 1 };
}

/**
 * Calculate ADX signal (trend strength)
 */
function calculateADX(adx: number, plusDI: number, minusDI: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (adx > 25) {
    if (plusDI > minusDI) {
      signal = 'Buy';
      value = Math.min(1, (plusDI - minusDI) / 50);
    } else {
      signal = 'Sell';
      value = -Math.min(1, (minusDI - plusDI) / 50);
    }
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'ADX(14)', value, signal, weight: 1 };
}

/**
 * Calculate MACD signal
 */
function calculateMACD(macd: number, signal: number, hist: number): IndicatorResult {
  let sig: Signal;
  let value: number;
  
  if (macd > signal && hist > 0) {
    sig = 'Buy';
    value = Math.min(1, hist / 0.001);
  } else if (macd < signal && hist < 0) {
    sig = 'Sell';
    value = Math.max(-1, hist / 0.001);
  } else {
    sig = 'Neutral';
    value = 0;
  }
  
  return { name: 'MACD(12,26,9)', value, signal: sig, weight: 1.5 };
}

/**
 * Calculate Moving Average signal
 */
function calculateMA(price: number, maValue: number, name: string): IndicatorResult {
  const diff = (price - maValue) / maValue;
  let signal: Signal;
  
  if (diff > 0.02) {
    signal = 'Buy';
  } else if (diff < -0.02) {
    signal = 'Sell';
  } else {
    signal = 'Neutral';
  }
  
  return { name, value: Math.max(-1, Math.min(1, diff * 10)), signal, weight: 1 };
}

/**
 * Calculate Williams %R signal
 */
function calculateWilliamsR(wr: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (wr < -80) {
    signal = 'Buy';
    value = (-80 - wr) / 20;
  } else if (wr > -20) {
    signal = 'Sell';
    value = (wr + 20) / -20;
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'Williams %R', value, signal, weight: 1 };
}

/**
 * Calculate Momentum signal
 */
function calculateMomentum(mom: number): IndicatorResult {
  let signal: Signal;
  
  if (mom > 0) {
    signal = 'Buy';
  } else if (mom < 0) {
    signal = 'Sell';
  } else {
    signal = 'Neutral';
  }
  
  return { name: 'Mom(10)', value: Math.max(-1, Math.min(1, mom / 5)), signal, weight: 1 };
}

/**
 * Calculate Awesome Oscillator signal
 */
function calculateAO(ao: number, prevAo: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (ao > 0 && ao > prevAo) {
    signal = 'Buy';
    value = Math.min(1, ao / 100);
  } else if (ao < 0 && ao < prevAo) {
    signal = 'Sell';
    value = Math.max(-1, ao / 100);
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'AO', value, signal, weight: 1 };
}

/**
 * Calculate Bull Bear Power signal
 */
function calculateBBP(bull: number, bear: number): IndicatorResult {
  const power = bull + bear;
  let signal: Signal;
  
  if (power > 0) {
    signal = 'Buy';
  } else if (power < 0) {
    signal = 'Sell';
  } else {
    signal = 'Neutral';
  }
  
  return { name: 'Bull Bear Power', value: Math.max(-1, Math.min(1, power / 10)), signal, weight: 1 };
}

/**
 * Calculate Ultimate Oscillator signal
 */
function calculateUO(uo: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (uo < 30) {
    signal = 'Buy';
    value = (30 - uo) / 30;
  } else if (uo > 70) {
    signal = 'Sell';
    value = -((uo - 70) / 30);
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'UO', value, signal, weight: 1 };
}

/**
 * Calculate Rate of Change signal
 */
function calculateROC(roc: number): IndicatorResult {
  let signal: Signal;
  
  if (roc > 0) {
    signal = 'Buy';
  } else if (roc < 0) {
    signal = 'Sell';
  } else {
    signal = 'Neutral';
  }
  
  return { name: 'ROC', value: Math.max(-1, Math.min(1, roc / 10)), signal, weight: 1 };
}

/**
 * Calculate StochRSI signal
 */
function calculateStochRSI(k: number, d: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (k < 20 && k > d) {
    signal = 'Buy';
    value = (20 - k) / 20;
  } else if (k > 80 && k < d) {
    signal = 'Sell';
    value = -((k - 80) / 20);
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'Stoch RSI', value, signal, weight: 1 };
}

/**
 * Calculate WaveTrend signal (LazyBear)
 */
function calculateWaveTrend(wt1: number, wt2: number): IndicatorResult {
  let signal: Signal;
  let value: number;
  
  if (wt1 < -60 && wt1 > wt2) {
    signal = 'Buy';
    value = Math.min(1, (-60 - wt1) / 40 + 0.5);
  } else if (wt1 > 60 && wt1 < wt2) {
    signal = 'Sell';
    value = Math.max(-1, -(wt1 - 60) / 40 - 0.5);
  } else if (wt1 > wt2) {
    signal = 'Buy';
    value = 0.3;
  } else if (wt1 < wt2) {
    signal = 'Sell';
    value = -0.3;
  } else {
    signal = 'Neutral';
    value = 0;
  }
  
  return { name: 'WaveTrend', value, signal, weight: 1.2 };
}

/**
 * Aggregate category results
 */
function aggregateCategory(indicators: IndicatorResult[]): RatingCategory {
  let totalWeight = 0;
  let weightedSum = 0;
  let buy = 0, sell = 0, neutral = 0;
  
  for (const ind of indicators) {
    weightedSum += ind.value * ind.weight;
    totalWeight += ind.weight;
    
    if (ind.signal === 'Buy' || ind.signal === 'Strong Buy') buy++;
    else if (ind.signal === 'Sell' || ind.signal === 'Strong Sell') sell++;
    else neutral++;
  }
  
  const rating = totalWeight > 0 ? weightedSum / totalWeight : 0;
  
  return {
    rating,
    signal: valueToSignal(rating),
    buy,
    sell,
    neutral,
    indicators
  };
}

/**
 * Get technical rating for a symbol
 */
export async function getTechnicalRating(
  symbol: string,
  timeframe: string = '1h',
  data?: any
): Promise<TechnicalRating> {
  // In production, fetch real market data
  // For now, simulate with reasonable values
  const price = data?.price ?? 100;
  const rsi = data?.rsi ?? 55;
  const stochK = data?.stochK ?? 50;
  const stochD = data?.stochD ?? 48;
  const cci = data?.cci ?? 25;
  const adx = data?.adx ?? 28;
  const plusDI = data?.plusDI ?? 26;
  const minusDI = data?.minusDI ?? 22;
  const macd = data?.macd ?? 0.5;
  const macdSignal = data?.macdSignal ?? 0.3;
  const macdHist = data?.macdHist ?? 0.2;
  const williamsR = data?.williamsR ?? -45;
  const mom = data?.momentum ?? 2.5;
  const ao = data?.ao ?? 15;
  const prevAo = data?.prevAo ?? 10;
  const bullPower = data?.bullPower ?? 5;
  const bearPower = data?.bearPower ?? -3;
  const uo = data?.uo ?? 52;
  const roc = data?.roc ?? 3.5;
  const stochRsiK = data?.stochRsiK ?? 45;
  const stochRsiD = data?.stochRsiD ?? 42;
  const wt1 = data?.wt1 ?? 15;
  const wt2 = data?.wt2 ?? 12;
  
  // Calculate oscillators
  const oscillators = aggregateCategory([
    calculateRSI(rsi),
    calculateStochastic(stochK, stochD),
    calculateCCI(cci),
    calculateADX(adx, plusDI, minusDI),
    calculateMACD(macd, macdSignal, macdHist),
    calculateWilliamsR(williamsR),
    calculateMomentum(mom),
    calculateAO(ao, prevAo),
    calculateBBP(bullPower, bearPower),
    calculateUO(uo),
    calculateROC(roc),
    calculateStochRSI(stochRsiK, stochRsiD),
    calculateWaveTrend(wt1, wt2)
  ]);
  
  // Calculate moving averages
  const ema5 = data?.ema5 ?? price * 0.99;
  const ema10 = data?.ema10 ?? price * 0.985;
  const ema20 = data?.ema20 ?? price * 0.98;
  const ema50 = data?.ema50 ?? price * 0.96;
  const ema100 = data?.ema100 ?? price * 0.94;
  const ema200 = data?.ema200 ?? price * 0.92;
  const sma5 = data?.sma5 ?? price * 0.99;
  const sma10 = data?.sma10 ?? price * 0.985;
  const sma20 = data?.sma20 ?? price * 0.98;
  const sma50 = data?.sma50 ?? price * 0.96;
  const sma100 = data?.sma100 ?? price * 0.94;
  const sma200 = data?.sma200 ?? price * 0.92;
  const hma9 = data?.hma9 ?? price * 0.995;
  
  const movingAverages = aggregateCategory([
    calculateMA(price, ema5, 'EMA(5)'),
    calculateMA(price, ema10, 'EMA(10)'),
    calculateMA(price, ema20, 'EMA(20)'),
    calculateMA(price, ema50, 'EMA(50)'),
    calculateMA(price, ema100, 'EMA(100)'),
    calculateMA(price, ema200, 'EMA(200)'),
    calculateMA(price, sma5, 'SMA(5)'),
    calculateMA(price, sma10, 'SMA(10)'),
    calculateMA(price, sma20, 'SMA(20)'),
    calculateMA(price, sma50, 'SMA(50)'),
    calculateMA(price, sma100, 'SMA(100)'),
    calculateMA(price, sma200, 'SMA(200)'),
    calculateMA(price, hma9, 'HMA(9)')
  ]);
  
  // Combined rating (equal weight oscillators + MAs)
  const combinedRating = (oscillators.rating + movingAverages.rating) / 2;
  
  // AI confidence based on agreement
  const agreement = Math.abs(oscillators.rating - movingAverages.rating);
  const aiConfidence = Math.max(0.5, 1 - agreement);
  
  // Generate summary
  const totalBuy = oscillators.buy + movingAverages.buy;
  const totalSell = oscillators.sell + movingAverages.sell;
  const summary = `${valueToSignal(combinedRating)} (${movingAverages.buy}/13 MAs bullish, RSI ${rsi.toFixed(0)} ${rsi < 30 ? 'oversold' : rsi > 70 ? 'overbought' : 'neutral'})`;
  
  return {
    symbol,
    timeframe,
    timestamp: new Date(),
    rating: combinedRating,
    signal: valueToSignal(combinedRating),
    oscillators,
    movingAverages,
    summary,
    aiConfidence
  };
}

/**
 * Get multi-timeframe rating
 */
export async function getMultiTimeframeRating(
  symbol: string,
  timeframes: string[] = ['15m', '1h', '4h', '1d']
): Promise<{ symbol: string; ratings: TechnicalRating[]; consensus: Signal }> {
  const ratings = await Promise.all(
    timeframes.map(tf => getTechnicalRating(symbol, tf))
  );
  
  // Weight longer timeframes more
  const weights = [1, 2, 3, 4];
  let weightedSum = 0;
  let totalWeight = 0;
  
  ratings.forEach((r, i) => {
    weightedSum += r.rating * weights[i];
    totalWeight += weights[i];
  });
  
  const consensus = valueToSignal(weightedSum / totalWeight);
  
  return { symbol, ratings, consensus };
}

/**
 * Get batch ratings for multiple symbols
 */
export async function getBatchRatings(
  symbols: string[],
  timeframe: string = '1h'
): Promise<TechnicalRating[]> {
  return Promise.all(symbols.map(s => getTechnicalRating(s, timeframe)));
}

// Export default
export default {
  getTechnicalRating,
  getMultiTimeframeRating,
  getBatchRatings
};
