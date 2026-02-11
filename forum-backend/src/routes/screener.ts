import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import db from '../db/database.ts';

// Screening metrics
const SCREENING_METRICS = {
  price: { name: 'Current Price', category: 'price', type: 'number' },
  change_1h: { name: '1H Change %', category: 'price', type: 'percent' },
  change_24h: { name: '24H Change %', category: 'price', type: 'percent' },
  change_7d: { name: '7D Change %', category: 'price', type: 'percent' },
  change_30d: { name: '30D Change %', category: 'price', type: 'percent' },
  high_24h: { name: '24H High', category: 'price', type: 'number' },
  low_24h: { name: '24H Low', category: 'price', type: 'number' },
  ath: { name: 'All-Time High', category: 'price', type: 'number' },
  ath_change: { name: 'From ATH %', category: 'price', type: 'percent' },
  volume_24h: { name: '24H Volume', category: 'volume', type: 'number' },
  volume_change_24h: { name: 'Volume Change %', category: 'volume', type: 'percent' },
  market_cap: { name: 'Market Cap', category: 'market', type: 'number' },
  fdv: { name: 'Fully Diluted Valuation', category: 'market', type: 'number' },
  circulating_supply: { name: 'Circulating Supply', category: 'market', type: 'number' },
  rsi_14: { name: 'RSI (14)', category: 'technical', type: 'number' },
  macd: { name: 'MACD', category: 'technical', type: 'number' },
  macd_signal: { name: 'MACD Signal', category: 'technical', type: 'number' },
  ema_20: { name: 'EMA (20)', category: 'technical', type: 'number' },
  ema_50: { name: 'EMA (50)', category: 'technical', type: 'number' },
  ema_200: { name: 'EMA (200)', category: 'technical', type: 'number' },
  bb_upper: { name: 'Bollinger Upper', category: 'technical', type: 'number' },
  bb_lower: { name: 'Bollinger Lower', category: 'technical', type: 'number' },
  atr_14: { name: 'ATR (14)', category: 'technical', type: 'number' },
  kit_signal_count: { name: 'K.I.T. Signal Count', category: 'kit', type: 'number' },
  kit_win_rate: { name: 'K.I.T. Win Rate %', category: 'kit', type: 'percent' },
  kit_confidence: { name: 'K.I.T. Avg Confidence', category: 'kit', type: 'percent' },
  kit_sentiment: { name: 'K.I.T. Sentiment', category: 'kit', type: 'number' },
} as const;

const FILTER_OPERATORS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'in', 'not_in', 'crosses_above', 'crosses_below'] as const;

const QUICK_SCREENS = {
  gainers: { name: 'Top Gainers (24H)', filters: [{ metric: 'change_24h', operator: 'gt', value: 0 }], sort: 'change_24h', order: 'desc' },
  losers: { name: 'Top Losers (24H)', filters: [{ metric: 'change_24h', operator: 'lt', value: 0 }], sort: 'change_24h', order: 'asc' },
  overbought: { name: 'Overbought (RSI > 70)', filters: [{ metric: 'rsi_14', operator: 'gt', value: 70 }], sort: 'rsi_14', order: 'desc' },
  oversold: { name: 'Oversold (RSI < 30)', filters: [{ metric: 'rsi_14', operator: 'lt', value: 30 }], sort: 'rsi_14', order: 'asc' },
  high_volume: { name: 'High Volume Movers', filters: [{ metric: 'volume_change_24h', operator: 'gt', value: 50 }], sort: 'volume_change_24h', order: 'desc' },
  kit_high_confidence: { name: 'K.I.T. High Confidence', filters: [{ metric: 'kit_confidence', operator: 'gt', value: 80 }], sort: 'kit_confidence', order: 'desc' },
  trending: { name: 'Trending Now', filters: [{ metric: 'kit_signal_count', operator: 'gt', value: 5 }], sort: 'kit_signal_count', order: 'desc' },
} as const;

// Mock assets
const MOCK_ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', price: 67500, change_24h: 2.4, volume_24h: 25000000000, market_cap: 1320000000000, rsi_14: 58, kit_confidence: 85, kit_signal_count: 42 },
  { symbol: 'ETH', name: 'Ethereum', type: 'crypto', price: 3450, change_24h: 3.1, volume_24h: 12000000000, market_cap: 415000000000, rsi_14: 62, kit_confidence: 82, kit_signal_count: 38 },
  { symbol: 'SOL', name: 'Solana', type: 'crypto', price: 178, change_24h: 5.8, volume_24h: 3500000000, market_cap: 78000000000, rsi_14: 71, kit_confidence: 78, kit_signal_count: 28 },
  { symbol: 'DOGE', name: 'Dogecoin', type: 'crypto', price: 0.182, change_24h: -1.2, volume_24h: 890000000, market_cap: 26000000000, rsi_14: 45, kit_confidence: 55, kit_signal_count: 15 },
  { symbol: 'EURUSD', name: 'EUR/USD', type: 'forex', price: 1.0845, change_24h: 0.15, volume_24h: 180000000000, rsi_14: 52, kit_confidence: 72, kit_signal_count: 31 },
  { symbol: 'GBPUSD', name: 'GBP/USD', type: 'forex', price: 1.2678, change_24h: -0.22, volume_24h: 95000000000, rsi_14: 48, kit_confidence: 68, kit_signal_count: 24 },
  { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', price: 185.42, change_24h: 1.2, volume_24h: 65000000, market_cap: 2900000000000, rsi_14: 55, kit_confidence: 76, kit_signal_count: 19 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', price: 876.50, change_24h: 4.5, volume_24h: 42000000, market_cap: 2150000000000, rsi_14: 74, kit_confidence: 88, kit_signal_count: 35 },
  { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', price: 245.80, change_24h: -2.1, volume_24h: 98000000, market_cap: 780000000000, rsi_14: 38, kit_confidence: 62, kit_signal_count: 27 },
  { symbol: 'XRP', name: 'Ripple', type: 'crypto', price: 0.62, change_24h: 1.8, volume_24h: 1200000000, market_cap: 34000000000, rsi_14: 56, kit_confidence: 71, kit_signal_count: 22 },
];

interface ScreenerPreset {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  filters: any[];
  sort?: string;
  sortOrder: 'asc' | 'desc';
  isPublic: boolean;
  forkCount: number;
  createdAt: string;
  updatedAt: string;
}

// Extend db schema
declare module '../db/database.ts' {
  interface DbSchema {
    screenerPresets?: ScreenerPreset[];
  }
}

export async function screenerRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  // Ensure collection exists
  db.data!.screenerPresets ||= [];
  await db.write();

  // GET /api/screener/metrics
  fastify.get('/metrics', {
    schema: { description: 'List all available screening metrics', tags: ['Screener'] },
  }, async (_request, reply) => {
    const byCategory = Object.entries(SCREENING_METRICS).reduce((acc, [key, metric]) => {
      if (!acc[metric.category]) acc[metric.category] = [];
      acc[metric.category].push({ key, ...metric });
      return acc;
    }, {} as Record<string, any[]>);

    return reply.send({
      success: true,
      data: { metrics: SCREENING_METRICS, byCategory, totalMetrics: Object.keys(SCREENING_METRICS).length },
    });
  });

  // GET /api/screener/operators
  fastify.get('/operators', {
    schema: { description: 'List filter operators', tags: ['Screener'] },
  }, async (_request, reply) => {
    return reply.send({ success: true, data: FILTER_OPERATORS });
  });

  // GET /api/screener/quick
  fastify.get('/quick', {
    schema: { description: 'List available quick screens', tags: ['Screener'] },
  }, async (_request, reply) => {
    return reply.send({ success: true, data: QUICK_SCREENS });
  });

  // GET /api/screener/quick/:type
  fastify.get<{ Params: { type: string }; Querystring: { assetType?: string; limit?: number } }>('/quick/:type', {
    schema: {
      description: 'Run a quick screen by type',
      tags: ['Screener'],
      params: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'] },
    },
  }, async (request, reply) => {
    const { type } = request.params;
    const { assetType, limit = 20 } = request.query;
    
    const screen = QUICK_SCREENS[type as keyof typeof QUICK_SCREENS];
    if (!screen) {
      return reply.code(404).send({ success: false, error: 'Quick screen not found' });
    }

    let results = [...MOCK_ASSETS];
    if (assetType) results = results.filter(a => a.type === assetType);

    for (const filter of screen.filters) {
      results = results.filter(asset => {
        const value = (asset as any)[filter.metric];
        if (value === undefined) return true;
        const op = filter.operator as string;
        const target = filter.value as number;
        if (op === 'gt') return value > target;
        if (op === 'lt') return value < target;
        if (op === 'gte') return value >= target;
        if (op === 'lte') return value <= target;
        if (op === 'eq') return value === target;
        return true;
      });
    }

    results.sort((a, b) => {
      const aVal = (a as any)[screen.sort] || 0;
      const bVal = (b as any)[screen.sort] || 0;
      return screen.order === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return reply.send({ success: true, data: { screen: screen.name, results: results.slice(0, limit), total: results.length } });
  });

  // POST /api/screener - Custom screen
  fastify.post<{ Body: { filters: any[]; assetTypes?: string[]; sort?: string; order?: string; limit?: number } }>('/', {
    schema: {
      description: 'Run a custom screener with filters',
      tags: ['Screener'],
      body: {
        type: 'object',
        properties: {
          filters: { type: 'array' },
          assetTypes: { type: 'array', items: { type: 'string' } },
          sort: { type: 'string' },
          order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        },
      },
    },
  }, async (request, reply) => {
    const { filters = [], assetTypes, sort, order = 'desc', limit = 100 } = request.body;

    let results = [...MOCK_ASSETS];
    if (assetTypes?.length) results = results.filter(a => assetTypes.includes(a.type));

    for (const filter of filters) {
      results = results.filter(asset => {
        const value = (asset as any)[filter.metric];
        if (value === undefined) return true;
        switch (filter.operator) {
          case 'eq': return value === filter.value;
          case 'neq': return value !== filter.value;
          case 'gt': return value > filter.value;
          case 'gte': return value >= filter.value;
          case 'lt': return value < filter.value;
          case 'lte': return value <= filter.value;
          case 'between': return value >= filter.value && value <= filter.value2;
          case 'in': return Array.isArray(filter.value) && filter.value.includes(value);
          case 'not_in': return Array.isArray(filter.value) && !filter.value.includes(value);
          default: return true;
        }
      });
    }

    if (sort) {
      results.sort((a, b) => {
        const aVal = (a as any)[sort] || 0;
        const bVal = (b as any)[sort] || 0;
        return order === 'desc' ? bVal - aVal : aVal - bVal;
      });
    }

    return reply.send({ success: true, data: { results: results.slice(0, limit), total: results.length, filtersApplied: filters.length } });
  });

  // GET /api/screener/presets
  fastify.get<{ Querystring: { agentId?: string; publicOnly?: boolean } }>('/presets', {
    schema: { description: 'List saved screener presets', tags: ['Screener'] },
  }, async (request, reply) => {
    const { agentId, publicOnly } = request.query;
    let presets = db.data!.screenerPresets!;

    if (agentId) {
      presets = presets.filter(p => p.agentId === agentId || p.isPublic);
    } else if (publicOnly) {
      presets = presets.filter(p => p.isPublic);
    }

    presets.sort((a, b) => b.forkCount - a.forkCount);
    return reply.send({ success: true, data: presets });
  });

  // POST /api/screener/presets
  fastify.post<{ Body: { name: string; description?: string; filters: any[]; sort?: string; sortOrder?: string; isPublic?: boolean } }>('/presets', {
    schema: { description: 'Save a screener preset', tags: ['Screener'] },
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    const { name, description, filters, sort, sortOrder = 'desc', isPublic = false } = request.body;

    const preset: ScreenerPreset = {
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      name,
      description,
      filters,
      sort,
      sortOrder: sortOrder as 'asc' | 'desc',
      isPublic,
      forkCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.data!.screenerPresets!.push(preset);
    await db.write();

    return reply.code(201).send({ success: true, data: preset });
  });

  // POST /api/screener/presets/:id/fork
  fastify.post<{ Params: { id: string } }>('/presets/:id/fork', {
    schema: { description: 'Fork a screener preset', tags: ['Screener'] },
  }, async (request, reply) => {
    const { id } = request.params;
    const agentId = request.headers['x-agent-id'] as string;

    const preset = db.data!.screenerPresets!.find(p => p.id === id);
    if (!preset) {
      return reply.code(404).send({ success: false, error: 'Preset not found' });
    }

    preset.forkCount++;

    const forked: ScreenerPreset = {
      ...preset,
      id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId,
      name: `${preset.name} (forked)`,
      isPublic: false,
      forkCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.data!.screenerPresets!.push(forked);
    await db.write();

    return reply.code(201).send({ success: true, data: { id: forked.id, forkedFrom: id, name: forked.name } });
  });

  // DELETE /api/screener/presets/:id
  fastify.delete<{ Params: { id: string } }>('/presets/:id', {
    schema: { description: 'Delete a screener preset', tags: ['Screener'] },
  }, async (request, reply) => {
    const { id } = request.params;
    const agentId = request.headers['x-agent-id'] as string;

    const index = db.data!.screenerPresets!.findIndex(p => p.id === id && p.agentId === agentId);
    if (index === -1) {
      return reply.code(404).send({ success: false, error: 'Preset not found or unauthorized' });
    }

    db.data!.screenerPresets!.splice(index, 1);
    await db.write();

    return reply.send({ success: true });
  });
}
