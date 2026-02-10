/**
 * TradingView Realtime Skill
 * Real-time market data from TradingView
 */

export { 
  TradingViewClient, 
  getQuote, 
  getScreener,
  TVQuote,
  TVBar,
  TVIndicatorValue,
  ScreenerOptions,
  ScreenerFilter
} from './tradingview-client';

// Skill metadata
export const metadata = {
  name: 'tradingview-realtime',
  description: 'Real-time market data, indicators, and screeners from TradingView',
  version: '1.0.0',
  triggers: ['tradingview', 'tv price', 'screener', 'market scan', 'indicator value'],
  capabilities: [
    'realtime-quotes',
    'historical-bars',
    'indicator-values',
    'market-screener',
    'watchlist'
  ]
};

// Quick functions for K.I.T. agent
import { TradingViewClient, TVQuote } from './tradingview-client';

let sharedClient: TradingViewClient | null = null;

export async function getClient(): Promise<TradingViewClient> {
  if (!sharedClient) {
    sharedClient = new TradingViewClient();
    await sharedClient.connect();
  }
  return sharedClient;
}

export async function quickQuote(symbol: string): Promise<string> {
  const client = await getClient();
  const quote = await client.getQuote(symbol);
  
  if (!quote.lp) return `Could not fetch price for ${symbol}`;
  
  const changeEmoji = (quote.chp || 0) >= 0 ? '📈' : '📉';
  const changeStr = (quote.chp || 0) >= 0 ? `+${quote.chp?.toFixed(2)}` : quote.chp?.toFixed(2);
  
  return `${changeEmoji} ${symbol}: $${quote.lp?.toFixed(quote.lp > 100 ? 2 : 4)} (${changeStr}%)`;
}

export async function cryptoTop10(): Promise<string> {
  const client = await getClient();
  const results = await client.getScreener('crypto', {
    sort: { sortBy: 'market_cap_calc', sortOrder: 'desc' },
    columns: ['name', 'close', 'change'],
    limit: 10
  });
  
  return results.map((r: any, i: number) => 
    `${i + 1}. ${r.d[0]}: $${r.d[1]?.toFixed(2)} (${r.d[2] >= 0 ? '+' : ''}${r.d[2]?.toFixed(2)}%)`
  ).join('\n');
}

export async function oversoldStocks(): Promise<string> {
  const client = await getClient();
  const results = await client.getScreener('america', {
    filter: {
      'RSI': { lte: 30 },
      'market_cap_basic': { gte: 1e9 }
    },
    columns: ['name', 'close', 'RSI', 'change'],
    sort: { sortBy: 'RSI', sortOrder: 'asc' },
    limit: 20
  });
  
  if (results.length === 0) return 'No oversold large-cap stocks found';
  
  return `🔻 Oversold Stocks (RSI < 30):\n` + results.map((r: any) => 
    `• ${r.d[0]}: $${r.d[1]?.toFixed(2)} | RSI: ${r.d[2]?.toFixed(1)} | ${r.d[3]?.toFixed(2)}%`
  ).join('\n');
}
