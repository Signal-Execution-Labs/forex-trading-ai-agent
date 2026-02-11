import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// SENTIMENT ANALYSIS - Market sentiment tracking from AI agents
// ============================================================================

interface SentimentVote {
  id: string;
  agentId: string;
  symbol: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  timeframe: '1h' | '4h' | '1d' | '1w' | '1m';
  reason?: string;
  createdAt: string;
  expiresAt: string;
}

interface SentimentSnapshot {
  symbol: string;
  timestamp: string;
  bullishPercent: number;
  bearishPercent: number;
  neutralPercent: number;
  totalVotes: number;
  avgConfidence: number;
  dominantSentiment: 'bullish' | 'bearish' | 'neutral';
  sentimentScore: number;
  trend: 'improving' | 'declining' | 'stable';
}

function generateMockVotes(): SentimentVote[] {
  const symbols = ['BTC/USD', 'ETH/USD', 'EUR/USD', 'GBP/USD', 'NVDA', 'AAPL', 'SOL/USD', 'XAU/USD'];
  const sentiments: Array<'bullish' | 'bearish' | 'neutral'> = ['bullish', 'bearish', 'neutral'];
  const timeframes: Array<'1h' | '4h' | '1d' | '1w' | '1m'> = ['1h', '4h', '1d', '1w', '1m'];
  const votes: SentimentVote[] = [];
  const now = Date.now();
  
  for (let i = 0; i < 200; i++) {
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const timeframe = timeframes[Math.floor(Math.random() * timeframes.length)];
    let sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
    if ((symbol === 'BTC/USD' || symbol === 'NVDA') && Math.random() > 0.4) sentiment = 'bullish';
    
    const hoursAgo = Math.floor(Math.random() * 48);
    const createdAt = new Date(now - hoursAgo * 3600000);
    const expiryHours = { '1h': 1, '4h': 4, '1d': 24, '1w': 168, '1m': 720 }[timeframe];
    
    votes.push({
      id: uuidv4(),
      agentId: `agent_${Math.floor(Math.random() * 100)}`,
      symbol, sentiment,
      confidence: 50 + Math.floor(Math.random() * 50),
      timeframe,
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + expiryHours * 3600000).toISOString(),
    });
  }
  return votes;
}

let sentimentVotes = generateMockVotes();

function calculateSentiment(symbol: string, timeframe?: string): SentimentSnapshot {
  const now = new Date();
  let votes = sentimentVotes.filter(v => v.symbol.toUpperCase() === symbol.toUpperCase() && new Date(v.expiresAt) > now);
  if (timeframe) votes = votes.filter(v => v.timeframe === timeframe);
  
  const totalVotes = votes.length;
  if (totalVotes === 0) {
    return { symbol, timestamp: now.toISOString(), bullishPercent: 0, bearishPercent: 0, neutralPercent: 0, totalVotes: 0, avgConfidence: 0, dominantSentiment: 'neutral', sentimentScore: 0, trend: 'stable' };
  }
  
  const bullishVotes = votes.filter(v => v.sentiment === 'bullish');
  const bearishVotes = votes.filter(v => v.sentiment === 'bearish');
  const neutralVotes = votes.filter(v => v.sentiment === 'neutral');
  
  const bullishPercent = (bullishVotes.length / totalVotes) * 100;
  const bearishPercent = (bearishVotes.length / totalVotes) * 100;
  const neutralPercent = (neutralVotes.length / totalVotes) * 100;
  const avgConfidence = votes.reduce((sum, v) => sum + v.confidence, 0) / totalVotes;
  
  let weightedBullish = 0, weightedBearish = 0, totalWeight = 0;
  votes.forEach(v => {
    if (v.sentiment === 'bullish') weightedBullish += v.confidence;
    else if (v.sentiment === 'bearish') weightedBearish += v.confidence;
    totalWeight += v.confidence;
  });
  const sentimentScore = totalWeight > 0 ? ((weightedBullish - weightedBearish) / totalWeight) * 100 : 0;
  
  const dominantSentiment = bullishPercent > bearishPercent && bullishPercent > neutralPercent ? 'bullish' : bearishPercent > bullishPercent && bearishPercent > neutralPercent ? 'bearish' : 'neutral';
  
  const sixHoursAgo = new Date(now.getTime() - 6 * 3600000);
  const recentVotes = votes.filter(v => new Date(v.createdAt) > sixHoursAgo);
  const olderVotes = votes.filter(v => new Date(v.createdAt) <= sixHoursAgo);
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (recentVotes.length >= 3 && olderVotes.length >= 3) {
    const recentBullish = recentVotes.filter(v => v.sentiment === 'bullish').length / recentVotes.length;
    const olderBullish = olderVotes.filter(v => v.sentiment === 'bullish').length / olderVotes.length;
    if (recentBullish > olderBullish + 0.1) trend = 'improving';
    else if (recentBullish < olderBullish - 0.1) trend = 'declining';
  }
  
  return {
    symbol, timestamp: now.toISOString(),
    bullishPercent: Math.round(bullishPercent * 10) / 10,
    bearishPercent: Math.round(bearishPercent * 10) / 10,
    neutralPercent: Math.round(neutralPercent * 10) / 10,
    totalVotes, avgConfidence: Math.round(avgConfidence), dominantSentiment,
    sentimentScore: Math.round(sentimentScore), trend,
  };
}

export async function sentimentRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {

  // GET /api/sentiment - Get sentiment for all symbols
  fastify.get<{ Querystring: { timeframe?: string; sort?: string } }>('/', {
    schema: { description: 'Get sentiment for all tracked symbols', tags: ['Sentiment'] },
  }, async (request) => {
    const { timeframe, sort = 'bullish' } = request.query;
    const symbols = [...new Set(sentimentVotes.map(v => v.symbol))];
    let results = symbols.map(s => calculateSentiment(s, timeframe)).filter(r => r.totalVotes > 0);
    
    switch (sort) {
      case 'bullish': results.sort((a, b) => b.sentimentScore - a.sentimentScore); break;
      case 'bearish': results.sort((a, b) => a.sentimentScore - b.sentimentScore); break;
      case 'votes': results.sort((a, b) => b.totalVotes - a.totalVotes); break;
      case 'confidence': results.sort((a, b) => b.avgConfidence - a.avgConfidence); break;
    }
    return { sentiments: results };
  });

  // GET /api/sentiment/extremes
  fastify.get('/extremes', {
    schema: { description: 'Get most bullish/bearish assets', tags: ['Sentiment'] },
  }, async () => {
    const symbols = [...new Set(sentimentVotes.map(v => v.symbol))];
    const results = symbols.map(s => calculateSentiment(s)).filter(r => r.totalVotes >= 5);
    return {
      mostBullish: [...results].sort((a, b) => b.sentimentScore - a.sentimentScore).slice(0, 5),
      mostBearish: [...results].sort((a, b) => a.sentimentScore - b.sentimentScore).slice(0, 5),
      mostContested: [...results].filter(r => r.bullishPercent > 30 && r.bearishPercent > 30).sort((a, b) => b.totalVotes - a.totalVotes).slice(0, 5),
    };
  });

  // GET /api/sentiment/leaderboard
  fastify.get('/leaderboard', {
    schema: { description: 'Agents with best sentiment accuracy', tags: ['Sentiment'] },
  }, async () => ({
    leaderboard: [
      { agentId: 'agent_12', accuracy: 78.5, votes: 156, avgConfidence: 82 },
      { agentId: 'agent_45', accuracy: 76.2, votes: 234, avgConfidence: 75 },
      { agentId: 'agent_7', accuracy: 74.8, votes: 98, avgConfidence: 88 },
      { agentId: 'agent_89', accuracy: 73.1, votes: 312, avgConfidence: 71 },
      { agentId: 'agent_23', accuracy: 71.9, votes: 187, avgConfidence: 79 },
    ]
  }));

  // POST /api/sentiment/vote
  fastify.post<{ Body: { agentId: string; symbol: string; sentiment: string; confidence?: number; timeframe: string; reason?: string } }>('/vote', {
    schema: { description: 'Submit sentiment vote', tags: ['Sentiment'] },
  }, async (request, reply) => {
    const { agentId, symbol, sentiment, confidence, timeframe, reason } = request.body;
    
    if (!agentId || !symbol || !sentiment || !timeframe) return reply.code(400).send({ error: 'Required: agentId, symbol, sentiment, timeframe' });
    if (!['bullish', 'bearish', 'neutral'].includes(sentiment)) return reply.code(400).send({ error: 'sentiment must be bullish, bearish, or neutral' });
    if (!['1h', '4h', '1d', '1w', '1m'].includes(timeframe)) return reply.code(400).send({ error: 'timeframe must be 1h, 4h, 1d, 1w, or 1m' });
    
    const existingIdx = sentimentVotes.findIndex(v => v.agentId === agentId && v.symbol.toUpperCase() === symbol.toUpperCase() && v.timeframe === timeframe && new Date(v.expiresAt) > new Date());
    const now = new Date();
    const expiryHours = { '1h': 1, '4h': 4, '1d': 24, '1w': 168, '1m': 720 }[timeframe as '1h'];
    
    const vote: SentimentVote = {
      id: uuidv4(), agentId, symbol: symbol.toUpperCase(),
      sentiment: sentiment as 'bullish' | 'bearish' | 'neutral',
      confidence: Math.min(100, Math.max(0, confidence || 70)),
      timeframe: timeframe as '1h', reason,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + expiryHours * 3600000).toISOString(),
    };
    
    if (existingIdx >= 0) sentimentVotes[existingIdx] = vote;
    else sentimentVotes.push(vote);
    
    return { vote, updated: existingIdx >= 0 };
  });

  // GET /api/sentiment/votes/:agentId
  fastify.get<{ Params: { agentId: string } }>('/votes/:agentId', {
    schema: { description: 'Get agent votes', tags: ['Sentiment'] },
  }, async (request) => ({
    votes: sentimentVotes.filter(v => v.agentId === request.params.agentId && new Date(v.expiresAt) > new Date())
  }));

  // DELETE /api/sentiment/vote/:id
  fastify.delete<{ Params: { id: string } }>('/vote/:id', {
    schema: { description: 'Delete a vote', tags: ['Sentiment'] },
  }, async (request, reply) => {
    const idx = sentimentVotes.findIndex(v => v.id === request.params.id);
    if (idx === -1) return reply.code(404).send({ error: 'Vote not found' });
    sentimentVotes.splice(idx, 1);
    return { success: true };
  });

  // GET /api/sentiment/history/:symbol
  fastify.get<{ Params: { symbol: string }; Querystring: { hours?: number } }>('/history/:symbol', {
    schema: { description: 'Get sentiment history', tags: ['Sentiment'] },
  }, async (request) => {
    const { hours = 24 } = request.query;
    const symbol = request.params.symbol.toUpperCase();
    const cutoff = new Date(Date.now() - hours * 3600000);
    const relevantVotes = sentimentVotes.filter(v => v.symbol.toUpperCase() === symbol && new Date(v.createdAt) > cutoff);
    
    const hourlySnapshots: Array<{ hour: string; score: number; votes: number }> = [];
    for (let h = 0; h < hours; h++) {
      const hourStart = new Date(Date.now() - (hours - h) * 3600000);
      const hourEnd = new Date(hourStart.getTime() + 3600000);
      const hourVotes = relevantVotes.filter(v => { const t = new Date(v.createdAt); return t >= hourStart && t < hourEnd; });
      let score = 0;
      if (hourVotes.length > 0) {
        const bullish = hourVotes.filter(v => v.sentiment === 'bullish').length;
        const bearish = hourVotes.filter(v => v.sentiment === 'bearish').length;
        score = ((bullish - bearish) / hourVotes.length) * 100;
      }
      hourlySnapshots.push({ hour: hourStart.toISOString(), score: Math.round(score), votes: hourVotes.length });
    }
    return { symbol, history: hourlySnapshots, timeRange: `${hours}h` };
  });

  // GET /api/sentiment/:symbol - Must be last (catch-all pattern)
  fastify.get<{ Params: { symbol: string }; Querystring: { timeframe?: string } }>('/:symbol', {
    schema: { description: 'Get sentiment for symbol', tags: ['Sentiment'] },
  }, async (request) => calculateSentiment(request.params.symbol, request.query.timeframe));
}
