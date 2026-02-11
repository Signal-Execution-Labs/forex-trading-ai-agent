import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// NEWS/EVENTS FEED - Financial news aggregation for AI agents
// ============================================================================

interface NewsArticle {
  id: string;
  source: string;
  sourceIcon: string;
  title: string;
  summary: string;
  url: string;
  imageUrl?: string;
  publishedAt: string;
  symbols: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  impact: 'high' | 'medium' | 'low';
  categories: string[];
  readCount: number;
  bookmarkCount: number;
  aiSummary?: string;
}

interface NewsBookmark {
  id: string;
  agentId: string;
  articleId: string;
  createdAt: string;
  notes?: string;
}

const NEWS_SOURCES = [
  { id: 'reuters', name: 'Reuters', icon: '📰', reliability: 0.95 },
  { id: 'bloomberg', name: 'Bloomberg', icon: '💼', reliability: 0.93 },
  { id: 'coindesk', name: 'CoinDesk', icon: '₿', reliability: 0.85 },
  { id: 'forex_factory', name: 'Forex Factory', icon: '💱', reliability: 0.88 },
  { id: 'wsj', name: 'Wall Street Journal', icon: '📊', reliability: 0.92 },
  { id: 'tradingview', name: 'TradingView Ideas', icon: '📈', reliability: 0.75 },
  { id: 'kit_signals', name: 'K.I.T. Signal Feed', icon: '🤖', reliability: 0.90 },
];

function generateMockNews(): NewsArticle[] {
  const now = new Date();
  return [
    {
      id: uuidv4(),
      source: 'reuters',
      sourceIcon: '📰',
      title: 'Fed Signals Potential Rate Cut in Q2 2026',
      summary: 'Federal Reserve officials hint at potential interest rate cuts as inflation shows signs of cooling.',
      url: 'https://reuters.com/fed-rate-cut-q2-2026',
      publishedAt: new Date(now.getTime() - 30 * 60000).toISOString(),
      symbols: ['EUR/USD', 'GBP/USD', 'SPY', 'QQQ'],
      sentiment: 'bullish',
      sentimentScore: 0.72,
      impact: 'high',
      categories: ['forex', 'stocks', 'macro'],
      readCount: 1523,
      bookmarkCount: 234,
      aiSummary: 'Fed dovish pivot likely. Expect USD weakness, risk-on assets to rally.',
    },
    {
      id: uuidv4(),
      source: 'coindesk',
      sourceIcon: '₿',
      title: 'Bitcoin ETF Inflows Hit New Record at $2.1B Weekly',
      summary: 'Institutional demand for Bitcoin continues to surge as spot ETF products see unprecedented capital inflows.',
      url: 'https://coindesk.com/btc-etf-record',
      publishedAt: new Date(now.getTime() - 2 * 3600000).toISOString(),
      symbols: ['BTC/USD', 'ETH/USD', 'MSTR', 'COIN'],
      sentiment: 'bullish',
      sentimentScore: 0.85,
      impact: 'high',
      categories: ['crypto', 'institutional'],
      readCount: 3421,
      bookmarkCount: 567,
      aiSummary: 'Strong institutional accumulation. Next targets: $75K, then $80K.',
    },
    {
      id: uuidv4(),
      source: 'bloomberg',
      sourceIcon: '💼',
      title: 'NVIDIA Beats Earnings, Raises Guidance on AI Demand',
      summary: 'NVIDIA reports Q4 earnings 15% above estimates, raises full-year guidance.',
      url: 'https://bloomberg.com/nvda-earnings',
      publishedAt: new Date(now.getTime() - 5 * 3600000).toISOString(),
      symbols: ['NVDA', 'AMD', 'SMCI', 'QQQ'],
      sentiment: 'bullish',
      sentimentScore: 0.91,
      impact: 'high',
      categories: ['stocks', 'tech', 'earnings'],
      readCount: 5678,
      bookmarkCount: 892,
      aiSummary: 'AI infrastructure play intact. NVDA remains leader.',
    },
    {
      id: uuidv4(),
      source: 'forex_factory',
      sourceIcon: '💱',
      title: 'ECB Hawks Push Back on Rate Cut Expectations',
      summary: 'ECB governing council members express concern about cutting rates too quickly.',
      url: 'https://forexfactory.com/ecb-hawks',
      publishedAt: new Date(now.getTime() - 8 * 3600000).toISOString(),
      symbols: ['EUR/USD', 'EUR/GBP', 'EUR/JPY'],
      sentiment: 'bearish',
      sentimentScore: -0.45,
      impact: 'medium',
      categories: ['forex', 'macro', 'central-banks'],
      readCount: 987,
      bookmarkCount: 156,
      aiSummary: 'EUR strength expected short-term.',
    },
    {
      id: uuidv4(),
      source: 'kit_signals',
      sourceIcon: '🤖',
      title: 'K.I.T. AI Agents Report 72% Win Rate on EUR/USD',
      summary: 'Aggregated data from 500+ K.I.T. agents shows strong predictive performance.',
      url: 'https://kitbot.finance/reports/eurusd',
      publishedAt: new Date(now.getTime() - 1 * 3600000).toISOString(),
      symbols: ['EUR/USD'],
      sentiment: 'neutral',
      sentimentScore: 0.15,
      impact: 'medium',
      categories: ['ai-signals', 'forex', 'performance'],
      readCount: 2341,
      bookmarkCount: 445,
      aiSummary: 'Mean reversion working well in range-bound market.',
    },
    {
      id: uuidv4(),
      source: 'wsj',
      sourceIcon: '📊',
      title: 'Oil Prices Surge on Middle East Supply Concerns',
      summary: 'Crude oil jumps 4% as geopolitical tensions raise concerns.',
      url: 'https://wsj.com/oil-surge',
      publishedAt: new Date(now.getTime() - 12 * 3600000).toISOString(),
      symbols: ['CL', 'XLE', 'USO', 'CVX', 'XOM'],
      sentiment: 'bullish',
      sentimentScore: 0.65,
      impact: 'high',
      categories: ['commodities', 'energy', 'geopolitical'],
      readCount: 4123,
      bookmarkCount: 678,
      aiSummary: 'Supply risk premium building. Energy stocks benefit.',
    },
  ];
}

let newsArticles: NewsArticle[] = generateMockNews();
let bookmarks: NewsBookmark[] = [];

export async function newsRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {
  
  // GET /api/news - Get news feed
  fastify.get<{
    Querystring: {
      symbol?: string;
      source?: string;
      sentiment?: string;
      impact?: string;
      category?: string;
      limit?: number;
      offset?: number;
      sort?: string;
    }
  }>('/', {
    schema: {
      description: 'Get financial news feed with filters',
      tags: ['News'],
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          source: { type: 'string' },
          sentiment: { type: 'string', enum: ['bullish', 'bearish', 'neutral'] },
          impact: { type: 'string', enum: ['high', 'medium', 'low'] },
          category: { type: 'string' },
          limit: { type: 'integer', default: 20 },
          offset: { type: 'integer', default: 0 },
          sort: { type: 'string', default: 'newest' },
        },
      },
    },
  }, async (request) => {
    const { symbol, source, sentiment, impact, category, limit = 20, offset = 0, sort = 'newest' } = request.query;
    
    let filtered = [...newsArticles];
    
    if (symbol) {
      const sym = symbol.toUpperCase();
      filtered = filtered.filter(a => a.symbols.some(s => s.toUpperCase().includes(sym)));
    }
    if (source) filtered = filtered.filter(a => a.source === source);
    if (sentiment) filtered = filtered.filter(a => a.sentiment === sentiment);
    if (impact) filtered = filtered.filter(a => a.impact === impact);
    if (category) filtered = filtered.filter(a => a.categories.includes(category));
    
    switch (sort) {
      case 'newest': filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()); break;
      case 'oldest': filtered.sort((a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()); break;
      case 'impact': filtered.sort((a, b) => ({ high: 3, medium: 2, low: 1 }[b.impact] - { high: 3, medium: 2, low: 1 }[a.impact])); break;
      case 'popular': filtered.sort((a, b) => b.readCount - a.readCount); break;
    }
    
    const total = filtered.length;
    const results = filtered.slice(offset, offset + limit);
    
    return { news: results, total, limit, offset, hasMore: offset + results.length < total };
  });

  // GET /api/news/trending
  fastify.get('/trending', {
    schema: { description: 'Get trending news', tags: ['News'] },
  }, async () => {
    const now = Date.now();
    const scored = newsArticles.map(a => {
      const ageHours = (now - new Date(a.publishedAt).getTime()) / 3600000;
      const impactScore = { high: 3, medium: 2, low: 1 }[a.impact];
      const recencyScore = Math.max(0, 24 - ageHours) / 24;
      const popularityScore = Math.min(1, a.readCount / 5000);
      return { ...a, trendingScore: (impactScore * 0.3) + (recencyScore * 0.5) + (popularityScore * 0.2) };
    });
    scored.sort((a, b) => b.trendingScore - a.trendingScore);
    return { trending: scored.slice(0, 5) };
  });

  // GET /api/news/sources
  fastify.get('/sources', {
    schema: { description: 'Get available news sources', tags: ['News'] },
  }, async () => ({ sources: NEWS_SOURCES }));

  // GET /api/news/categories
  fastify.get('/categories', {
    schema: { description: 'Get news categories', tags: ['News'] },
  }, async () => {
    const categories = new Map<string, number>();
    newsArticles.forEach(a => a.categories.forEach(cat => categories.set(cat, (categories.get(cat) || 0) + 1)));
    return { categories: Array.from(categories.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count) };
  });

  // GET /api/news/:id
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { description: 'Get single article', tags: ['News'] },
  }, async (request, reply) => {
    const article = newsArticles.find(a => a.id === request.params.id);
    if (!article) return reply.code(404).send({ error: 'Article not found' });
    article.readCount++;
    return { article };
  });

  // POST /api/news/:id/bookmark
  fastify.post<{ Params: { id: string }; Body: { agentId: string; notes?: string } }>('/:id/bookmark', {
    schema: { description: 'Bookmark article', tags: ['News'] },
  }, async (request, reply) => {
    const { agentId, notes } = request.body;
    if (!agentId) return reply.code(400).send({ error: 'agentId required' });
    
    const article = newsArticles.find(a => a.id === request.params.id);
    if (!article) return reply.code(404).send({ error: 'Article not found' });
    
    if (bookmarks.find(b => b.agentId === agentId && b.articleId === request.params.id)) {
      return reply.code(400).send({ error: 'Already bookmarked' });
    }
    
    const bookmark: NewsBookmark = { id: uuidv4(), agentId, articleId: request.params.id, createdAt: new Date().toISOString(), notes };
    bookmarks.push(bookmark);
    article.bookmarkCount++;
    return { bookmark };
  });

  // DELETE /api/news/:id/bookmark
  fastify.delete<{ Params: { id: string }; Body: { agentId: string } }>('/:id/bookmark', {
    schema: { description: 'Remove bookmark', tags: ['News'] },
  }, async (request, reply) => {
    const { agentId } = request.body;
    const idx = bookmarks.findIndex(b => b.agentId === agentId && b.articleId === request.params.id);
    if (idx === -1) return reply.code(404).send({ error: 'Bookmark not found' });
    bookmarks.splice(idx, 1);
    const article = newsArticles.find(a => a.id === request.params.id);
    if (article) article.bookmarkCount = Math.max(0, article.bookmarkCount - 1);
    return { success: true };
  });

  // GET /api/news/bookmarks/:agentId
  fastify.get<{ Params: { agentId: string } }>('/bookmarks/:agentId', {
    schema: { description: 'Get agent bookmarks', tags: ['News'] },
  }, async (request) => {
    const agentBookmarks = bookmarks.filter(b => b.agentId === request.params.agentId);
    const articles = agentBookmarks.map(b => {
      const article = newsArticles.find(a => a.id === b.articleId);
      return article ? { ...article, bookmarkNotes: b.notes, bookmarkedAt: b.createdAt } : null;
    }).filter(Boolean);
    return { bookmarks: articles };
  });

  // GET /api/news/symbol/:symbol
  fastify.get<{ Params: { symbol: string }; Querystring: { limit?: number } }>('/symbol/:symbol', {
    schema: { description: 'Get news for symbol', tags: ['News'] },
  }, async (request) => {
    const symbol = request.params.symbol.toUpperCase();
    const { limit = 10 } = request.query;
    const matching = newsArticles
      .filter(a => a.symbols.some(s => s.toUpperCase().includes(symbol)))
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, limit);
    const avgSentiment = matching.length > 0 ? matching.reduce((sum, a) => sum + a.sentimentScore, 0) / matching.length : 0;
    return { symbol, news: matching, aggregateSentiment: avgSentiment, sentimentLabel: avgSentiment > 0.3 ? 'bullish' : avgSentiment < -0.3 ? 'bearish' : 'neutral', articleCount: matching.length };
  });
}
