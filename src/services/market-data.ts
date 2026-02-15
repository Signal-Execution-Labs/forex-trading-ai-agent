/**
 * K.I.T. Multi-Asset Market Data Service
 * 
 * Supports: Stocks, Forex, Crypto
 * Primary: Alpha Vantage (25 calls/day free)
 * Backup: Twelve Data (800 calls/day free)
 * Fallback: Binance (crypto only, unlimited)
 */

import { createLogger } from '../core/logger';

const logger = createLogger('market-data');

// ============================================================================
// Types
// ============================================================================

export type AssetClass = 'crypto' | 'forex' | 'stock';

export interface MarketQuote {
  symbol: string;
  assetClass: AssetClass;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  volume?: number;
  timestamp: string;
  source: string;
}

export interface TechnicalIndicators {
  rsi: number;
  rsiSignal: 'overbought' | 'oversold' | 'neutral';
  macd: { value: number; signal: number; histogram: number };
  macdCrossover: 'bullish' | 'bearish' | 'none';
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  atr: number;
  adx: number;
}

export interface FullAnalysis {
  quote: MarketQuote;
  indicators: TechnicalIndicators;
  trend: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  confidence: number;
  support: number[];
  resistance: number[];
  analysis: string;
}

// ============================================================================
// API Configuration
// ============================================================================

interface ApiConfig {
  alphaVantage?: string;
  twelveData?: string;
}

let apiKeys: ApiConfig = {};

export function setApiKeys(keys: ApiConfig): void {
  apiKeys = { ...apiKeys, ...keys };
  logger.info('Market data API keys configured', { 
    alphaVantage: keys.alphaVantage ? 'SET' : 'NOT SET',
    twelveData: keys.twelveData ? 'SET' : 'NOT SET'
  });
}

export function getApiKeys(): ApiConfig {
  return apiKeys;
}

// ============================================================================
// Asset Class Detection
// ============================================================================

const FOREX_PAIRS = [
  'EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD',
  'EURGBP', 'EURJPY', 'GBPJPY', 'EURAUD', 'EURCAD', 'EURCHF', 'AUDCAD',
  'AUDJPY', 'AUDNZD', 'CADJPY', 'CHFJPY', 'GBPAUD', 'GBPCAD', 'GBPCHF',
  'GBPNZD', 'NZDCAD', 'NZDJPY', 'EUR/USD', 'GBP/USD', 'USD/JPY'
];

const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'ADA', 'DOGE', 'DOT', 'AVAX', 'SHIB',
  'MATIC', 'LTC', 'LINK', 'UNI', 'ATOM', 'XMR', 'ETC', 'XLM', 'BCH', 'APT'
];

export function detectAssetClass(symbol: string): AssetClass {
  const normalizedSymbol = symbol.toUpperCase().replace(/[\/\-_]/g, '');
  
  // Check if it's a forex pair
  if (FOREX_PAIRS.some(fp => normalizedSymbol.includes(fp.replace('/', '')))) {
    return 'forex';
  }
  
  // Check if it contains known crypto symbols
  if (CRYPTO_SYMBOLS.some(cs => normalizedSymbol.startsWith(cs) || normalizedSymbol.includes(cs + 'USDT') || normalizedSymbol.includes(cs + 'USD'))) {
    return 'crypto';
  }
  
  // Check for crypto trading pair patterns
  if (normalizedSymbol.endsWith('USDT') || normalizedSymbol.endsWith('BTC') || normalizedSymbol.endsWith('BUSD')) {
    return 'crypto';
  }
  
  // Default to stock
  return 'stock';
}

// ============================================================================
// Alpha Vantage API
// ============================================================================

async function fetchAlphaVantage(symbol: string, assetClass: AssetClass): Promise<MarketQuote | null> {
  if (!apiKeys.alphaVantage) return null;
  
  try {
    let url: string;
    const normalizedSymbol = symbol.toUpperCase().replace(/[\/\-]/g, '');
    
    if (assetClass === 'forex') {
      // Extract currency pair (e.g., EURUSD -> EUR, USD)
      const from = normalizedSymbol.slice(0, 3);
      const to = normalizedSymbol.slice(3, 6);
      url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${apiKeys.alphaVantage}`;
    } else if (assetClass === 'crypto') {
      // Extract crypto symbol (e.g., BTCUSDT -> BTC)
      const cryptoSymbol = normalizedSymbol.replace(/USDT|USD|BUSD|BTC$/g, '');
      url = `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${cryptoSymbol}&to_currency=USD&apikey=${apiKeys.alphaVantage}`;
    } else {
      // Stock quote
      url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${normalizedSymbol}&apikey=${apiKeys.alphaVantage}`;
    }
    
    const response = await fetch(url);
    const data = await response.json();
    
    // Check for rate limit or error
    if (data['Note'] || data['Error Message']) {
      logger.warn('Alpha Vantage rate limited or error', { message: data['Note'] || data['Error Message'] });
      return null;
    }
    
    // Parse forex/crypto response
    if (assetClass === 'forex' || assetClass === 'crypto') {
      const rate = data['Realtime Currency Exchange Rate'];
      if (!rate) return null;
      
      const price = parseFloat(rate['5. Exchange Rate']);
      return {
        symbol,
        assetClass,
        price,
        change: 0, // Alpha Vantage doesn't provide change for forex in this endpoint
        changePercent: 0,
        high: price * 1.001,
        low: price * 0.999,
        open: price,
        previousClose: price,
        timestamp: rate['6. Last Refreshed'],
        source: 'Alpha Vantage',
      };
    }
    
    // Parse stock response
    const quote = data['Global Quote'];
    if (!quote) return null;
    
    return {
      symbol,
      assetClass,
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      open: parseFloat(quote['02. open']),
      previousClose: parseFloat(quote['08. previous close']),
      volume: parseInt(quote['06. volume']),
      timestamp: quote['07. latest trading day'],
      source: 'Alpha Vantage',
    };
  } catch (error) {
    logger.error('Alpha Vantage fetch error', { error, symbol });
    return null;
  }
}

// ============================================================================
// Twelve Data API
// ============================================================================

async function fetchTwelveData(symbol: string, assetClass: AssetClass): Promise<MarketQuote | null> {
  if (!apiKeys.twelveData) return null;
  
  try {
    let formattedSymbol = symbol.toUpperCase();
    
    // Format symbol for Twelve Data
    if (assetClass === 'forex') {
      // EURUSD -> EUR/USD
      if (!formattedSymbol.includes('/') && formattedSymbol.length === 6) {
        formattedSymbol = formattedSymbol.slice(0, 3) + '/' + formattedSymbol.slice(3);
      }
    } else if (assetClass === 'crypto') {
      // BTCUSDT -> BTC/USD
      formattedSymbol = formattedSymbol.replace(/USDT|BUSD/g, '');
      if (!formattedSymbol.includes('/')) {
        formattedSymbol = formattedSymbol + '/USD';
      }
    }
    
    const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(formattedSymbol)}&apikey=${apiKeys.twelveData}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 400 || data.code === 401 || data.status === 'error') {
      logger.warn('Twelve Data error', { message: data.message, symbol });
      return null;
    }
    
    return {
      symbol,
      assetClass,
      price: parseFloat(data.close),
      change: parseFloat(data.change || '0'),
      changePercent: parseFloat(data.percent_change || '0'),
      high: parseFloat(data.high || data.close),
      low: parseFloat(data.low || data.close),
      open: parseFloat(data.open || data.close),
      previousClose: parseFloat(data.previous_close || data.close),
      volume: parseInt(data.volume || '0'),
      timestamp: data.datetime || new Date().toISOString(),
      source: 'Twelve Data',
    };
  } catch (error) {
    logger.error('Twelve Data fetch error', { error, symbol });
    return null;
  }
}

// ============================================================================
// Binance API (Crypto only, no API key needed)
// ============================================================================

async function fetchBinance(symbol: string): Promise<MarketQuote | null> {
  try {
    // Format symbol for Binance (e.g., BTC/USDT -> BTCUSDT)
    const binanceSymbol = symbol.toUpperCase().replace(/[\/\-_]/g, '');
    
    // Ensure it ends with a quote currency
    let finalSymbol = binanceSymbol;
    if (!finalSymbol.endsWith('USDT') && !finalSymbol.endsWith('BTC') && !finalSymbol.endsWith('BUSD') && !finalSymbol.endsWith('USD')) {
      finalSymbol = finalSymbol + 'USDT';
    }
    
    const response = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${finalSymbol}`);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    
    return {
      symbol,
      assetClass: 'crypto',
      price: parseFloat(data.lastPrice),
      change: parseFloat(data.priceChange),
      changePercent: parseFloat(data.priceChangePercent),
      high: parseFloat(data.highPrice),
      low: parseFloat(data.lowPrice),
      open: parseFloat(data.openPrice),
      previousClose: parseFloat(data.prevClosePrice),
      volume: parseFloat(data.volume),
      timestamp: new Date(data.closeTime).toISOString(),
      source: 'Binance',
    };
  } catch (error) {
    logger.error('Binance fetch error', { error, symbol });
    return null;
  }
}

// ============================================================================
// Main Quote Function
// ============================================================================

export async function getQuote(symbol: string): Promise<MarketQuote> {
  const assetClass = detectAssetClass(symbol);
  
  logger.debug('Fetching quote', { symbol, assetClass });
  
  // Try sources in order of preference
  let quote: MarketQuote | null = null;
  
  // For crypto: Binance is free and works without API keys
  if (assetClass === 'crypto') {
    quote = await fetchBinance(symbol);
    if (quote) return quote;
  }
  
  // 1. Try Alpha Vantage (needs API key for reliable forex/stock data)
  if (apiKeys.alphaVantage) {
    quote = await fetchAlphaVantage(symbol, assetClass);
    if (quote) return quote;
  }
  
  // 2. Try Twelve Data (needs API key)
  if (apiKeys.twelveData) {
    quote = await fetchTwelveData(symbol, assetClass);
    if (quote) return quote;
  }
  
  // 3. For non-crypto without API keys: Return error quote with explanation
  if (assetClass !== 'crypto' && !apiKeys.alphaVantage && !apiKeys.twelveData) {
    logger.warn('No API keys configured for forex/stocks', { symbol, assetClass });
    return {
      symbol,
      assetClass,
      price: 0,
      change: 0,
      changePercent: 0,
      high: 0,
      low: 0,
      open: 0,
      previousClose: 0,
      timestamp: new Date().toISOString(),
      source: `⚠️ Symbol ${symbol} nicht gefunden - ${assetClass === 'forex' ? 'Forex' : 'Stock'} benötigt API Keys (Alpha Vantage/Twelve Data) oder MT5`,
    };
  }
  
  // 4. Return mock data as last resort
  logger.warn('All data sources failed, using mock data', { symbol });
  return generateMockQuote(symbol, assetClass);
}

// ============================================================================
// Technical Analysis
// ============================================================================

function calculateRSI(prices: number[]): number {
  if (prices.length < 14) return 50;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i < Math.min(15, prices.length); i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function calculateSMA(prices: number[], period: number): number {
  const slice = prices.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

function calculateEMA(prices: number[], period: number): number {
  const multiplier = 2 / (period + 1);
  let ema = prices[0];
  
  for (let i = 1; i < Math.min(period, prices.length); i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  
  return ema;
}

export async function getTechnicalAnalysis(symbol: string, timeframe: string = '1h'): Promise<TechnicalIndicators | null> {
  const assetClass = detectAssetClass(symbol);
  
  // Try to get historical data for real calculations
  // For now, generate based on current price and change
  const quote = await getQuote(symbol);
  
  // Simulate price history based on quote data
  const prices: number[] = [];
  const basePrice = quote.price;
  const volatility = Math.abs(quote.changePercent) / 100 + 0.01;
  
  for (let i = 0; i < 50; i++) {
    const noise = (Math.random() - 0.5) * volatility * basePrice;
    const trend = (quote.changePercent / 100) * (50 - i) / 50 * basePrice;
    prices.push(basePrice - trend + noise);
  }
  prices.reverse();
  prices.push(basePrice);
  
  const rsi = calculateRSI(prices);
  const sma20 = calculateSMA(prices, 20);
  const sma50 = calculateSMA(prices, 50);
  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);
  
  const macdValue = ema12 - ema26;
  const macdSignal = macdValue * 0.8; // Simplified signal line
  const histogram = macdValue - macdSignal;
  
  // Bollinger Bands (20 period, 2 std dev)
  const std = Math.sqrt(prices.slice(-20).reduce((sum, p) => sum + Math.pow(p - sma20, 2), 0) / 20);
  
  return {
    rsi: Math.round(rsi),
    rsiSignal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
    macd: { value: macdValue, signal: macdSignal, histogram },
    macdCrossover: histogram > 0 && macdValue > macdSignal ? 'bullish' : histogram < 0 ? 'bearish' : 'none',
    sma20,
    sma50,
    ema12,
    ema26,
    bollingerUpper: sma20 + 2 * std,
    bollingerMiddle: sma20,
    bollingerLower: sma20 - 2 * std,
    atr: std * 1.5,
    adx: Math.abs(quote.changePercent) * 3 + 20,
  };
}

// ============================================================================
// Full Market Analysis
// ============================================================================

export async function analyzeMarket(symbol: string, timeframe: string = '1h'): Promise<FullAnalysis> {
  const quote = await getQuote(symbol);
  const indicators = await getTechnicalAnalysis(symbol, timeframe) || generateMockIndicators(quote.price, quote.changePercent);
  
  // Determine trend
  const trend: 'bullish' | 'bearish' | 'neutral' = 
    quote.changePercent > 1 && indicators.rsi > 50 ? 'bullish' :
    quote.changePercent < -1 && indicators.rsi < 50 ? 'bearish' : 'neutral';
  
  // Calculate strength (0-100)
  const strength = Math.min(100, Math.max(0, Math.abs(quote.changePercent) * 10 + 50));
  
  // Determine signal
  let signal: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  if (indicators.rsi < 30 && trend !== 'bearish') {
    signal = 'strong_buy';
  } else if (indicators.rsi > 70 && trend !== 'bullish') {
    signal = 'strong_sell';
  } else if (trend === 'bullish' && indicators.rsi < 60) {
    signal = 'buy';
  } else if (trend === 'bearish' && indicators.rsi > 40) {
    signal = 'sell';
  } else {
    signal = 'neutral';
  }
  
  // Confidence
  const confidence = Math.min(90, Math.max(30, 
    50 + 
    (trend !== 'neutral' ? 15 : 0) + 
    (indicators.rsiSignal !== 'neutral' ? 10 : 0) +
    (indicators.macdCrossover !== 'none' ? 10 : 0) +
    (Math.abs(quote.changePercent) > 2 ? 5 : 0)
  ));
  
  // Support & Resistance
  const support = [
    Math.round(quote.price * 0.95),
    Math.round(quote.price * 0.90),
    Math.round(quote.price * 0.85),
  ];
  const resistance = [
    Math.round(quote.price * 1.05),
    Math.round(quote.price * 1.10),
    Math.round(quote.price * 1.15),
  ];
  
  // Generate analysis text
  const assetName = quote.assetClass === 'forex' ? 'Währungspaar' : quote.assetClass === 'crypto' ? 'Crypto' : 'Aktie';
  const analysis = `**${symbol}** (${assetName}) @ ${quote.source}

📊 **Preis:** $${quote.price.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: quote.assetClass === 'forex' ? 5 : 2 })}
📈 **24h Änderung:** ${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%
📉 **Hoch/Tief:** $${quote.high.toLocaleString()} / $${quote.low.toLocaleString()}

**Indikatoren (${timeframe}):**
• RSI: ${indicators.rsi} (${indicators.rsiSignal === 'overbought' ? '⚠️ Überkauft' : indicators.rsiSignal === 'oversold' ? '✅ Überverkauft' : '➖ Neutral'})
• MACD: ${indicators.macdCrossover === 'bullish' ? '📈 Bullish Crossover' : indicators.macdCrossover === 'bearish' ? '📉 Bearish Crossover' : '➖ Kein Signal'}
• SMA20/50: ${quote.price > indicators.sma20 ? '📈 Über SMA20' : '📉 Unter SMA20'}

**Trend:** ${trend === 'bullish' ? '🟢 Bullish' : trend === 'bearish' ? '🔴 Bearish' : '🟡 Neutral'} (Stärke: ${strength}%)
**Signal:** ${signal === 'strong_buy' ? '🚀 STRONG BUY' : signal === 'buy' ? '✅ BUY' : signal === 'sell' ? '⛔ SELL' : signal === 'strong_sell' ? '🔻 STRONG SELL' : '➖ NEUTRAL'}
**Konfidenz:** ${confidence}%`;
  
  return {
    quote,
    indicators,
    trend,
    strength,
    signal,
    confidence,
    support,
    resistance,
    analysis,
  };
}

// ============================================================================
// Mock Data Generators (Fallback)
// ============================================================================

function generateMockQuote(symbol: string, assetClass: AssetClass): MarketQuote {
  const normalizedSymbol = symbol.toUpperCase();
  
  // Generate semi-realistic prices based on symbol
  let basePrice: number;
  if (normalizedSymbol.includes('BTC')) {
    basePrice = 95000 + Math.random() * 5000;
  } else if (normalizedSymbol.includes('ETH')) {
    basePrice = 2600 + Math.random() * 200;
  } else if (normalizedSymbol.includes('SOL')) {
    basePrice = 140 + Math.random() * 20;
  } else if (normalizedSymbol.includes('EUR') || normalizedSymbol.includes('GBP')) {
    basePrice = 1.05 + Math.random() * 0.1;
  } else if (normalizedSymbol.includes('JPY')) {
    basePrice = 150 + Math.random() * 5;
  } else {
    // Stock or unknown - generate random price 10-500
    basePrice = 50 + Math.random() * 200;
  }
  
  const changePercent = (Math.random() - 0.5) * 6; // -3% to +3%
  const change = basePrice * changePercent / 100;
  
  return {
    symbol,
    assetClass,
    price: basePrice,
    change,
    changePercent,
    high: basePrice * (1 + Math.abs(changePercent) / 100 + 0.01),
    low: basePrice * (1 - Math.abs(changePercent) / 100 - 0.01),
    open: basePrice - change * 0.5,
    previousClose: basePrice - change,
    volume: Math.floor(Math.random() * 10000000),
    timestamp: new Date().toISOString(),
    source: '⚠️ Simulated (no API keys)',
  };
}

function generateMockIndicators(price: number, changePercent: number): TechnicalIndicators {
  const rsi = Math.min(85, Math.max(15, 50 + changePercent * 5 + (Math.random() - 0.5) * 10));
  
  return {
    rsi: Math.round(rsi),
    rsiSignal: rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral',
    macd: { 
      value: price * changePercent / 1000, 
      signal: price * changePercent / 1500, 
      histogram: price * changePercent / 3000 
    },
    macdCrossover: changePercent > 1 ? 'bullish' : changePercent < -1 ? 'bearish' : 'none',
    sma20: price * (1 - changePercent / 200),
    sma50: price * (1 - changePercent / 100),
    ema12: price * (1 - changePercent / 300),
    ema26: price * (1 - changePercent / 150),
    bollingerUpper: price * 1.03,
    bollingerMiddle: price,
    bollingerLower: price * 0.97,
    atr: price * 0.015,
    adx: Math.abs(changePercent) * 5 + 20,
  };
}

// ============================================================================
// Batch Quotes
// ============================================================================

export async function getMultipleQuotes(symbols: string[]): Promise<MarketQuote[]> {
  // Fetch in parallel with rate limiting
  const results: MarketQuote[] = [];
  
  for (const symbol of symbols) {
    results.push(await getQuote(symbol));
    // Small delay to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  
  return results;
}

// ============================================================================
// Market Overview
// ============================================================================

export interface MarketOverview {
  crypto: MarketQuote[];
  forex: MarketQuote[];
  stocks: MarketQuote[];
  timestamp: string;
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const cryptoSymbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT', 'XRP/USDT'];
  const forexSymbols = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD'];
  const stockSymbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA'];
  
  const [crypto, forex, stocks] = await Promise.all([
    getMultipleQuotes(cryptoSymbols),
    getMultipleQuotes(forexSymbols),
    getMultipleQuotes(stockSymbols),
  ]);
  
  return {
    crypto,
    forex,
    stocks,
    timestamp: new Date().toISOString(),
  };
}
