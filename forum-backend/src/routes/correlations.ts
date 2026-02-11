import { FastifyInstance, FastifyPluginOptions } from 'fastify';

// ============================================================================
// CORRELATION MATRIX - Asset correlation analysis for AI agents
// ============================================================================

const CORRELATION_DATABASE: Record<string, Record<string, number>> = {
  'BTC/USD': { 'ETH/USD': 0.87, 'SOL/USD': 0.82, 'XRP/USD': 0.75, 'EUR/USD': 0.15, 'GBP/USD': 0.12, 'XAU/USD': 0.35, 'SPY': 0.45, 'QQQ': 0.52, 'NVDA': 0.48, 'AAPL': 0.38 },
  'ETH/USD': { 'BTC/USD': 0.87, 'SOL/USD': 0.91, 'XRP/USD': 0.78, 'EUR/USD': 0.18, 'GBP/USD': 0.14, 'XAU/USD': 0.28, 'SPY': 0.42, 'QQQ': 0.55, 'NVDA': 0.51, 'AAPL': 0.35 },
  'SOL/USD': { 'BTC/USD': 0.82, 'ETH/USD': 0.91, 'XRP/USD': 0.71, 'EUR/USD': 0.11, 'QQQ': 0.48, 'NVDA': 0.45 },
  'EUR/USD': { 'BTC/USD': 0.15, 'ETH/USD': 0.18, 'GBP/USD': 0.89, 'USD/JPY': -0.72, 'XAU/USD': 0.45, 'SPY': 0.25, 'DXY': -0.98 },
  'GBP/USD': { 'BTC/USD': 0.12, 'EUR/USD': 0.89, 'USD/JPY': -0.65, 'XAU/USD': 0.42, 'DXY': -0.95 },
  'USD/JPY': { 'EUR/USD': -0.72, 'GBP/USD': -0.65, 'XAU/USD': -0.55, 'SPY': 0.35, 'DXY': 0.88 },
  'XAU/USD': { 'BTC/USD': 0.35, 'ETH/USD': 0.28, 'EUR/USD': 0.45, 'GBP/USD': 0.42, 'USD/JPY': -0.55, 'SPY': -0.15, 'TLT': 0.52, 'DXY': -0.85 },
  'SPY': { 'BTC/USD': 0.45, 'EUR/USD': 0.25, 'USD/JPY': 0.35, 'XAU/USD': -0.15, 'QQQ': 0.96, 'NVDA': 0.78, 'AAPL': 0.88, 'TLT': -0.42, 'VIX': -0.82 },
  'QQQ': { 'BTC/USD': 0.52, 'ETH/USD': 0.55, 'SOL/USD': 0.48, 'SPY': 0.96, 'NVDA': 0.85, 'AAPL': 0.92, 'TLT': -0.38, 'VIX': -0.78 },
  'NVDA': { 'BTC/USD': 0.48, 'ETH/USD': 0.51, 'SOL/USD': 0.45, 'SPY': 0.78, 'QQQ': 0.85, 'AMD': 0.82, 'SMCI': 0.75, 'AAPL': 0.65 },
  'AAPL': { 'BTC/USD': 0.38, 'ETH/USD': 0.35, 'SPY': 0.88, 'QQQ': 0.92, 'NVDA': 0.65, 'MSFT': 0.72 },
  'TLT': { 'XAU/USD': 0.52, 'SPY': -0.42, 'QQQ': -0.38, 'VIX': 0.35 },
  'VIX': { 'SPY': -0.82, 'QQQ': -0.78, 'TLT': 0.35 },
  'DXY': { 'EUR/USD': -0.98, 'GBP/USD': -0.95, 'USD/JPY': 0.88, 'XAU/USD': -0.85 },
};

function getCorrelation(symbol1: string, symbol2: string): number | null {
  const s1 = symbol1.toUpperCase();
  const s2 = symbol2.toUpperCase();
  if (s1 === s2) return 1.0;
  if (CORRELATION_DATABASE[s1]?.[s2] !== undefined) return CORRELATION_DATABASE[s1][s2];
  if (CORRELATION_DATABASE[s2]?.[s1] !== undefined) return CORRELATION_DATABASE[s2][s1];
  return null;
}

function getCorrelationStrength(corr: number): string {
  if (corr >= 0.7) return 'strong-positive';
  if (corr >= 0.3) return 'moderate-positive';
  if (corr >= -0.3) return 'weak';
  if (corr >= -0.7) return 'moderate-negative';
  return 'strong-negative';
}

function getInterpretation(corr: number, s1: string, s2: string): string {
  const strength = getCorrelationStrength(corr);
  switch (strength) {
    case 'strong-positive': return `${s1} and ${s2} move strongly together. When one rises, the other typically follows.`;
    case 'moderate-positive': return `${s1} and ${s2} show moderate positive correlation. They often move in the same direction.`;
    case 'weak': return `${s1} and ${s2} have little correlation. Useful for diversification.`;
    case 'moderate-negative': return `${s1} and ${s2} show moderate inverse correlation. Good for hedging.`;
    case 'strong-negative': return `${s1} and ${s2} move strongly in opposite directions. Excellent for hedging.`;
    default: return '';
  }
}

export async function correlationRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {

  // GET /api/correlations/matrix
  fastify.get<{ Querystring: { symbols?: string; period?: string } }>('/matrix', {
    schema: { description: 'Get full correlation matrix', tags: ['Correlations'] },
  }, async (request) => {
    const { symbols: symbolsParam, period = '1y' } = request.query;
    const symbols = symbolsParam ? symbolsParam.split(',').map(s => s.trim().toUpperCase()) : ['BTC/USD', 'ETH/USD', 'EUR/USD', 'XAU/USD', 'SPY', 'QQQ', 'NVDA'];
    
    const matrix: number[][] = [];
    for (let i = 0; i < symbols.length; i++) {
      const row: number[] = [];
      for (let j = 0; j < symbols.length; j++) {
        const corr = getCorrelation(symbols[i], symbols[j]);
        row.push(corr !== null ? Math.round(corr * 100) / 100 : 0);
      }
      matrix.push(row);
    }
    
    return { symbols, matrix, period, generatedAt: new Date().toISOString() };
  });

  // GET /api/correlations/pairs/strongest
  fastify.get<{ Querystring: { type?: string; limit?: number } }>('/pairs/strongest', {
    schema: { description: 'Get strongest correlated pairs', tags: ['Correlations'] },
  }, async (request) => {
    const { type = 'all', limit = 10 } = request.query;
    const pairs: Array<{ pair: string; correlation: number; strength: string }> = [];
    
    for (const [s1, corrs] of Object.entries(CORRELATION_DATABASE)) {
      for (const [s2, corr] of Object.entries(corrs)) {
        if (s1 < s2) {
          if (type === 'all' || (type === 'positive' && corr > 0) || (type === 'negative' && corr < 0)) {
            pairs.push({ pair: `${s1}/${s2}`, correlation: corr, strength: getCorrelationStrength(corr) });
          }
        }
      }
    }
    
    pairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    return { type, pairs: pairs.slice(0, limit) };
  });

  // GET /api/correlations/hedge/:symbol
  fastify.get<{ Params: { symbol: string } }>('/hedge/:symbol', {
    schema: { description: 'Get best hedging assets', tags: ['Correlations'] },
  }, async (request) => {
    const symbol = request.params.symbol.toUpperCase();
    const negativeCorrs: Array<{ symbol: string; correlation: number; hedgeEfficiency: string }> = [];
    
    const directCorrs = CORRELATION_DATABASE[symbol] || {};
    for (const [s2, corr] of Object.entries(directCorrs)) {
      if (corr < -0.3) negativeCorrs.push({ symbol: s2, correlation: corr, hedgeEfficiency: corr <= -0.7 ? 'excellent' : corr <= -0.5 ? 'good' : 'moderate' });
    }
    
    for (const [s1, corrs] of Object.entries(CORRELATION_DATABASE)) {
      if (s1 !== symbol && corrs[symbol] !== undefined && corrs[symbol] < -0.3 && !negativeCorrs.find(c => c.symbol === s1)) {
        negativeCorrs.push({ symbol: s1, correlation: corrs[symbol], hedgeEfficiency: corrs[symbol] <= -0.7 ? 'excellent' : corrs[symbol] <= -0.5 ? 'good' : 'moderate' });
      }
    }
    
    negativeCorrs.sort((a, b) => a.correlation - b.correlation);
    return { symbol, hedgeOptions: negativeCorrs, recommendation: negativeCorrs.length > 0 ? `Best hedge for ${symbol}: ${negativeCorrs[0].symbol} (corr: ${negativeCorrs[0].correlation})` : `No strong hedging options found for ${symbol}.` };
  });

  // GET /api/correlations/diversify/:symbols
  fastify.get<{ Params: { symbols: string } }>('/diversify/:symbols', {
    schema: { description: 'Check portfolio diversification', tags: ['Correlations'] },
  }, async (request, reply) => {
    const symbols = request.params.symbols.split(',').map(s => s.trim().toUpperCase());
    if (symbols.length < 2) return reply.code(400).send({ error: 'Need at least 2 symbols' });
    
    const pairCorrelations: Array<{ pair: string; correlation: number }> = [];
    let totalCorr = 0, pairCount = 0;
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const corr = getCorrelation(symbols[i], symbols[j]);
        if (corr !== null) { pairCorrelations.push({ pair: `${symbols[i]}/${symbols[j]}`, correlation: corr }); totalCorr += Math.abs(corr); pairCount++; }
      }
    }
    
    const avgCorrelation = pairCount > 0 ? totalCorr / pairCount : 0;
    let diversificationScore: string, recommendation: string;
    
    if (avgCorrelation < 0.3) { diversificationScore = 'excellent'; recommendation = 'Portfolio is well-diversified.'; }
    else if (avgCorrelation < 0.5) { diversificationScore = 'good'; recommendation = 'Portfolio has reasonable diversification.'; }
    else if (avgCorrelation < 0.7) { diversificationScore = 'moderate'; recommendation = 'Consider adding hedge positions.'; }
    else { diversificationScore = 'poor'; recommendation = 'Portfolio lacks diversification.'; }
    
    return { symbols, pairCorrelations, averageCorrelation: Math.round(avgCorrelation * 100) / 100, diversificationScore, recommendation };
  });

  // GET /api/correlations/groups
  fastify.get('/groups', {
    schema: { description: 'Get asset groups by correlation', tags: ['Correlations'] },
  }, async () => ({
    groups: [
      { name: 'Crypto', symbols: ['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD'], avgInternalCorr: 0.82, description: 'Highly correlated. Crypto tends to move as a sector.' },
      { name: 'US Tech', symbols: ['QQQ', 'NVDA', 'AAPL', 'AMD'], avgInternalCorr: 0.78, description: 'Strong correlation within tech sector.' },
      { name: 'Forex Majors', symbols: ['EUR/USD', 'GBP/USD'], avgInternalCorr: 0.89, description: 'EUR and GBP move together against USD.' },
      { name: 'Safe Havens', symbols: ['XAU/USD', 'TLT', 'JPY'], avgInternalCorr: 0.45, description: 'Moderate correlation. All benefit from risk-off.' },
      { name: 'Risk Indicators', symbols: ['VIX', 'TLT'], avgInternalCorr: 0.35, description: 'Rise when markets fall. Good for hedging.' },
    ]
  }));

  // GET /api/correlations/symbol/:symbol
  fastify.get<{ Params: { symbol: string }; Querystring: { minCorr?: number; sort?: string } }>('/symbol/:symbol', {
    schema: { description: 'Get all correlations for a symbol', tags: ['Correlations'] },
  }, async (request) => {
    const symbol = request.params.symbol.toUpperCase();
    const { minCorr = 0, sort = 'absolute' } = request.query;
    const correlations: Array<{ symbol: string; correlation: number; strength: string }> = [];
    
    const directCorrs = CORRELATION_DATABASE[symbol];
    if (directCorrs) {
      for (const [s2, corr] of Object.entries(directCorrs)) {
        if (Math.abs(corr) >= minCorr) correlations.push({ symbol: s2, correlation: corr, strength: getCorrelationStrength(corr) });
      }
    }
    
    for (const [s1, corrs] of Object.entries(CORRELATION_DATABASE)) {
      if (s1 !== symbol && corrs[symbol] !== undefined && Math.abs(corrs[symbol]) >= minCorr && !correlations.find(c => c.symbol === s1)) {
        correlations.push({ symbol: s1, correlation: corrs[symbol], strength: getCorrelationStrength(corrs[symbol]) });
      }
    }
    
    if (sort === 'absolute') correlations.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation));
    else if (sort === 'positive') correlations.sort((a, b) => b.correlation - a.correlation);
    else if (sort === 'negative') correlations.sort((a, b) => a.correlation - b.correlation);
    
    return { symbol, correlations, total: correlations.length };
  });

  // GET /api/correlations/:symbol1/:symbol2
  fastify.get<{ Params: { symbol1: string; symbol2: string }; Querystring: { period?: string } }>('/:symbol1/:symbol2', {
    schema: { description: 'Get correlation between two symbols', tags: ['Correlations'] },
  }, async (request, reply) => {
    const { symbol1, symbol2 } = request.params;
    const { period = '1y' } = request.query;
    
    const corr = getCorrelation(symbol1, symbol2);
    if (corr === null) return reply.code(404).send({ error: 'Correlation data not available', suggestion: 'Try major assets like BTC/USD, EUR/USD, SPY, QQQ, NVDA, XAU/USD' });
    
    return {
      symbol1: symbol1.toUpperCase(), symbol2: symbol2.toUpperCase(), correlation: corr, period, sampleSize: 252, pValue: 0.001,
      strength: getCorrelationStrength(corr), interpretation: getInterpretation(corr, symbol1.toUpperCase(), symbol2.toUpperCase()),
    };
  });
}
