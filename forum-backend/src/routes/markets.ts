import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import db from '../db/database.ts';

/**
 * Market Data API - OHLCV candles, quotes, and symbol data
 * TradingView UDF-compatible endpoints for chart integration
 */

const TIMEFRAMES = {
  '1': 60, '5': 300, '15': 900, '30': 1800, '60': 3600, '240': 14400,
  'D': 86400, 'W': 604800, 'M': 2592000,
} as const;

const SYMBOLS_DB: Record<string, {
  symbol: string;
  name: string;
  description: string;
  type: string;
  exchange: string;
  currency: string;
  pricescale: number;
  minmov: number;
  has_intraday: boolean;
  has_daily: boolean;
  session: string;
}> = {
  'BTC/USD': { symbol: 'BTC/USD', name: 'Bitcoin', description: 'Bitcoin / US Dollar', type: 'crypto', exchange: 'Crypto', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '24x7' },
  'ETH/USD': { symbol: 'ETH/USD', name: 'Ethereum', description: 'Ethereum / US Dollar', type: 'crypto', exchange: 'Crypto', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '24x7' },
  'SOL/USD': { symbol: 'SOL/USD', name: 'Solana', description: 'Solana / US Dollar', type: 'crypto', exchange: 'Crypto', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '24x7' },
  'EUR/USD': { symbol: 'EUR/USD', name: 'EURUSD', description: 'Euro / US Dollar', type: 'forex', exchange: 'Forex', currency: 'USD', pricescale: 100000, minmov: 1, has_intraday: true, has_daily: true, session: '0000-2400:23456' },
  'GBP/USD': { symbol: 'GBP/USD', name: 'GBPUSD', description: 'British Pound / US Dollar', type: 'forex', exchange: 'Forex', currency: 'USD', pricescale: 100000, minmov: 1, has_intraday: true, has_daily: true, session: '0000-2400:23456' },
  'AAPL': { symbol: 'AAPL', name: 'Apple Inc.', description: 'Apple Inc. Common Stock', type: 'stock', exchange: 'NASDAQ', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '0930-1600' },
  'NVDA': { symbol: 'NVDA', name: 'NVIDIA Corp.', description: 'NVIDIA Corporation Common Stock', type: 'stock', exchange: 'NASDAQ', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '0930-1600' },
  'TSLA': { symbol: 'TSLA', name: 'Tesla Inc.', description: 'Tesla Inc. Common Stock', type: 'stock', exchange: 'NASDAQ', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '0930-1600' },
  'GOLD': { symbol: 'GOLD', name: 'Gold', description: 'Gold Spot / US Dollar', type: 'commodity', exchange: 'Commodity', currency: 'USD', pricescale: 100, minmov: 1, has_intraday: true, has_daily: true, session: '0000-2400:23456' },
};

function generateMockCandles(symbol: string, resolution: string, from: number, to: number) {
  const timeframe = TIMEFRAMES[resolution as keyof typeof TIMEFRAMES] || 86400;
  const candles = { t: [] as number[], o: [] as number[], h: [] as number[], l: [] as number[], c: [] as number[], v: [] as number[] };

  const basePrices: Record<string, number> = {
    'BTC/USD': 67500, 'ETH/USD': 3450, 'SOL/USD': 178, 'EUR/USD': 1.0845, 'GBP/USD': 1.2678,
    'AAPL': 185.42, 'NVDA': 876.50, 'TSLA': 245.80, 'GOLD': 2018.50,
  };

  let price = basePrices[symbol] || 100;
  const volatility = symbol.includes('BTC') ? 0.02 : symbol.includes('USD') ? 0.001 : 0.015;
  const decimals = symbol.includes('USD') && !symbol.includes('BTC') ? 5 : 2;

  for (let time = from; time <= to; time += timeframe) {
    const change = (Math.random() - 0.5) * 2 * volatility;
    const open = price;
    const close = price * (1 + change);
    const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
    const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);

    candles.t.push(time);
    candles.o.push(parseFloat(open.toFixed(decimals)));
    candles.h.push(parseFloat(high.toFixed(decimals)));
    candles.l.push(parseFloat(low.toFixed(decimals)));
    candles.c.push(parseFloat(close.toFixed(decimals)));
    candles.v.push(Math.floor(Math.random() * 1000000) + 100000);

    price = close;
  }

  return candles;
}

export async function marketRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // TradingView UDF: GET /api/markets/config
  fastify.get('/config', {
    schema: { description: 'TradingView UDF-compatible server configuration', tags: ['Markets'] },
  }, async (_request, reply) => {
    return reply.send({
      supports_search: true,
      supports_group_request: false,
      supports_marks: true,
      supports_timescale_marks: true,
      supports_time: true,
      exchanges: [
        { value: '', name: 'All', desc: '' },
        { value: 'Crypto', name: 'Cryptocurrency', desc: 'All crypto assets' },
        { value: 'Forex', name: 'Forex', desc: 'Currency pairs' },
        { value: 'NASDAQ', name: 'NASDAQ', desc: 'NASDAQ stocks' },
        { value: 'Commodity', name: 'Commodities', desc: 'Gold, Silver, Oil' },
      ],
      symbols_types: [
        { name: 'All types', value: '' },
        { name: 'Crypto', value: 'crypto' },
        { name: 'Forex', value: 'forex' },
        { name: 'Stock', value: 'stock' },
        { name: 'Commodity', value: 'commodity' },
      ],
      supported_resolutions: Object.keys(TIMEFRAMES),
    });
  });

  // TradingView UDF: GET /api/markets/time
  fastify.get('/time', {
    schema: { description: 'Current server time (Unix timestamp)', tags: ['Markets'] },
  }, async (_request, reply) => {
    return reply.send(Math.floor(Date.now() / 1000));
  });

  // TradingView UDF: GET /api/markets/symbols
  fastify.get<{ Querystring: { symbol: string } }>('/symbols', {
    schema: {
      description: 'Get symbol information (TradingView UDF compatible)',
      tags: ['Markets'],
      querystring: { type: 'object', required: ['symbol'], properties: { symbol: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { symbol } = request.query;
    const info = SYMBOLS_DB[symbol];

    if (!info) return reply.send({ s: 'error', errmsg: 'Unknown symbol' });

    return reply.send({
      name: info.symbol,
      ticker: info.symbol,
      description: info.description,
      type: info.type,
      exchange: info.exchange,
      listed_exchange: info.exchange,
      timezone: 'Etc/UTC',
      session: info.session,
      minmov: info.minmov,
      pricescale: info.pricescale,
      has_intraday: info.has_intraday,
      has_daily: info.has_daily,
      has_weekly_and_monthly: true,
      supported_resolutions: Object.keys(TIMEFRAMES),
      currency_code: info.currency,
      data_status: 'streaming',
    });
  });

  // TradingView UDF: GET /api/markets/search
  fastify.get<{ Querystring: { query?: string; type?: string; exchange?: string; limit?: number } }>('/search', {
    schema: { description: 'Search for symbols', tags: ['Markets'] },
  }, async (request, reply) => {
    const { query = '', type, exchange, limit = 30 } = request.query;

    let results = Object.values(SYMBOLS_DB);

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(s => 
        s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
      );
    }

    if (type) results = results.filter(s => s.type === type);
    if (exchange) results = results.filter(s => s.exchange === exchange);

    return reply.send(results.slice(0, limit).map(s => ({
      symbol: s.symbol,
      full_name: s.symbol,
      description: s.description,
      exchange: s.exchange,
      type: s.type,
    })));
  });

  // TradingView UDF: GET /api/markets/history
  fastify.get<{ Querystring: { symbol: string; resolution: string; from: number; to: number } }>('/history', {
    schema: {
      description: 'Get historical OHLCV data (TradingView UDF compatible)',
      tags: ['Markets'],
      querystring: {
        type: 'object',
        required: ['symbol', 'resolution', 'from', 'to'],
        properties: { symbol: { type: 'string' }, resolution: { type: 'string' }, from: { type: 'integer' }, to: { type: 'integer' } },
      },
    },
  }, async (request, reply) => {
    const { symbol, resolution, from, to } = request.query;

    if (!SYMBOLS_DB[symbol]) return reply.send({ s: 'error', errmsg: 'Unknown symbol' });

    const candles = generateMockCandles(symbol, resolution, from, to);
    if (candles.t.length === 0) return reply.send({ s: 'no_data' });

    return reply.send({ s: 'ok', ...candles });
  });

  // GET /api/markets/quotes
  fastify.get<{ Querystring: { symbols: string } }>('/quotes', {
    schema: {
      description: 'Get real-time quotes for multiple symbols',
      tags: ['Markets'],
      querystring: { type: 'object', required: ['symbols'], properties: { symbols: { type: 'string' } } },
    },
  }, async (request, reply) => {
    const { symbols } = request.query;
    const symbolList = symbols.split(',').map(s => s.trim());

    const basePrices: Record<string, number> = {
      'BTC/USD': 67500, 'ETH/USD': 3450, 'SOL/USD': 178, 'EUR/USD': 1.0845, 'GBP/USD': 1.2678,
      'AAPL': 185.42, 'NVDA': 876.50, 'TSLA': 245.80, 'GOLD': 2018.50,
    };

    const quotes = symbolList.map(symbol => {
      const info = SYMBOLS_DB[symbol];
      if (!info) return null;

      const price = basePrices[symbol] || 100;
      const change = (Math.random() - 0.5) * 0.02;

      return {
        symbol,
        name: info.name,
        exchange: info.exchange,
        type: info.type,
        price: parseFloat((price * (1 + change)).toFixed(info.pricescale > 1000 ? 5 : 2)),
        change: parseFloat((change * 100).toFixed(2)),
        changePercent: parseFloat((change * 100).toFixed(2)),
        high: parseFloat((price * 1.01).toFixed(2)),
        low: parseFloat((price * 0.99).toFixed(2)),
        volume: Math.floor(Math.random() * 10000000),
        timestamp: Date.now(),
      };
    }).filter(Boolean);

    return reply.send({ success: true, data: quotes });
  });

  // GET /api/markets/symbols/list
  fastify.get<{ Querystring: { type?: string; exchange?: string } }>('/symbols/list', {
    schema: { description: 'List all available symbols', tags: ['Markets'] },
  }, async (request, reply) => {
    const { type, exchange } = request.query;
    
    let symbols = Object.values(SYMBOLS_DB);
    if (type) symbols = symbols.filter(s => s.type === type);
    if (exchange) symbols = symbols.filter(s => s.exchange === exchange);

    return reply.send({ success: true, data: symbols, total: symbols.length });
  });

  // GET /api/markets/marks - Chart marks (K.I.T. signals on chart)
  fastify.get<{ Querystring: { symbol: string; from: number; to: number; resolution: string } }>('/marks', {
    schema: { description: 'Get chart marks (K.I.T. signals on chart)', tags: ['Markets'] },
  }, async (request, reply) => {
    const { symbol, from, to } = request.query;
    const symbolClean = symbol.replace('/', '');

    const signals = db.data!.signals.filter(s => {
      const sigTime = new Date(s.created_at || '').getTime() / 1000;
      return s.asset === symbolClean && sigTime >= from && sigTime <= to;
    }).slice(0, 50);

    const marks = signals.map((s, i) => ({
      id: s.id || i,
      time: new Date(s.created_at || '').getTime() / 1000,
      color: s.direction === 'LONG' ? 'green' : 'red',
      text: `${s.direction} - ${s.agent_id}`,
      label: s.direction === 'LONG' ? 'L' : 'S',
      labelFontColor: 'white',
      minSize: 20,
    }));

    return reply.send(marks);
  });

  // GET /api/markets/timescale_marks
  fastify.get('/timescale_marks', {
    schema: { description: 'Get timescale marks (events below chart)', tags: ['Markets'] },
  }, async (_request, reply) => {
    return reply.send([]);
  });
}
