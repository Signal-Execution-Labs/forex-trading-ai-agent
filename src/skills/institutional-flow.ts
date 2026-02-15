/**
 * K.I.T. Skill #97: Institutional Flow Analyzer
 * 
 * TradingView-inspired institutional tracking with:
 * - Institutional Buying % indicator
 * - Large order detection
 * - Dark pool activity estimation
 * - Block trade identification
 * - Whale wallet tracking (crypto)
 * - Smart money flow index
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Interfaces
interface InstitutionalFlow {
  id: string;
  symbol: string;
  timestamp: Date;
  buyingPercent: number;       // 0-100
  sellingPercent: number;      // 0-100
  netFlow: number;             // positive = accumulation
  largeOrderCount: number;
  blockTradeVolume: number;
  darkPoolPercent: number;
  smartMoneyIndex: number;     // -100 to 100
  whaleActivity: WhaleActivity[];
}

interface WhaleActivity {
  address?: string;            // crypto wallet
  action: 'accumulation' | 'distribution' | 'neutral';
  amount: number;
  estimatedUSD: number;
  timestamp: Date;
}

interface FlowAlert {
  id: string;
  symbol: string;
  type: 'accumulation' | 'distribution' | 'whale_buy' | 'whale_sell' | 'dark_pool_spike';
  threshold: number;
  currentValue: number;
  triggered: boolean;
  triggeredAt?: Date;
}

interface InstitutionalStats {
  symbol: string;
  period: '1h' | '4h' | '1d' | '1w';
  avgBuyingPercent: number;
  avgSellingPercent: number;
  netAccumulation: number;
  largeOrderRatio: number;
  institutionalSentiment: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
}

// Mock data stores
const flowData = new Map<string, InstitutionalFlow[]>();
const flowAlerts = new Map<string, FlowAlert[]>();

// Helper functions
function generateFlowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateAlertId(): string {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateSmartMoneyIndex(data: any): number {
  // Smart Money Index: First hour vs last hour of trading
  // Institutions trade early, retail trades late
  const firstHourFlow = data.firstHourVolume || 0;
  const lastHourFlow = data.lastHourVolume || 0;
  const totalFlow = firstHourFlow + lastHourFlow || 1;
  return Math.round(((firstHourFlow - lastHourFlow) / totalFlow) * 100);
}

function estimateDarkPoolActivity(volume: number, exchangeVolume: number): number {
  // Estimate dark pool % based on volume discrepancy
  const ratio = exchangeVolume > 0 ? (volume - exchangeVolume) / volume : 0;
  return Math.max(0, Math.min(100, ratio * 100 + 30)); // Base ~30% dark pool
}

function detectWhaleActivity(transactions: any[]): WhaleActivity[] {
  return transactions
    .filter(tx => tx.amount > 100000) // > $100k
    .map(tx => ({
      address: tx.from || tx.to,
      action: tx.type === 'buy' ? 'accumulation' : tx.type === 'sell' ? 'distribution' : 'neutral',
      amount: tx.amount,
      estimatedUSD: tx.usdValue || tx.amount * tx.price,
      timestamp: new Date(tx.timestamp)
    }));
}

function generateMockFlow(symbol: string): InstitutionalFlow {
  const buyingPercent = Math.random() * 100;
  const sellingPercent = 100 - buyingPercent;
  
  return {
    id: generateFlowId(),
    symbol,
    timestamp: new Date(),
    buyingPercent: Math.round(buyingPercent * 100) / 100,
    sellingPercent: Math.round(sellingPercent * 100) / 100,
    netFlow: Math.round((buyingPercent - 50) * 1000000), // Net USD flow
    largeOrderCount: Math.floor(Math.random() * 50) + 5,
    blockTradeVolume: Math.floor(Math.random() * 10000000) + 500000,
    darkPoolPercent: Math.round(Math.random() * 40 + 20), // 20-60%
    smartMoneyIndex: Math.floor(Math.random() * 200 - 100), // -100 to 100
    whaleActivity: Array.from({ length: Math.floor(Math.random() * 5) }, () => ({
      address: `0x${Math.random().toString(16).substr(2, 40)}`,
      action: Math.random() > 0.5 ? 'accumulation' : 'distribution',
      amount: Math.floor(Math.random() * 1000000) + 100000,
      estimatedUSD: Math.floor(Math.random() * 5000000) + 100000,
      timestamp: new Date()
    })) as WhaleActivity[]
  };
}

// Route handlers
export default async function institutionalFlowRoutes(fastify: FastifyInstance) {
  
  // Get current institutional flow for a symbol
  fastify.get('/api/institutional/flow/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    
    // Generate real-time mock data
    const flow = generateMockFlow(symbol.toUpperCase());
    
    // Store in history
    if (!flowData.has(symbol)) {
      flowData.set(symbol, []);
    }
    flowData.get(symbol)!.push(flow);
    
    return {
      success: true,
      data: flow,
      interpretation: {
        signal: flow.netFlow > 0 ? 'bullish' : flow.netFlow < 0 ? 'bearish' : 'neutral',
        strength: Math.abs(flow.buyingPercent - 50) / 50, // 0-1
        recommendation: flow.buyingPercent > 60 ? 'Strong institutional buying detected' :
                        flow.buyingPercent < 40 ? 'Institutional distribution in progress' :
                        'Mixed institutional activity'
      }
    };
  });

  // Get historical flow data
  fastify.get('/api/institutional/flow/:symbol/history', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { period = '1d', limit = 100 } = request.query as { period?: string; limit?: number };
    
    const history = flowData.get(symbol.toUpperCase()) || [];
    
    return {
      success: true,
      symbol: symbol.toUpperCase(),
      period,
      count: Math.min(history.length, limit),
      data: history.slice(-limit)
    };
  });

  // Get institutional statistics
  fastify.get('/api/institutional/stats/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { period = '1d' } = request.query as { period?: '1h' | '4h' | '1d' | '1w' };
    
    const history = flowData.get(symbol.toUpperCase()) || [];
    
    if (history.length === 0) {
      // Generate some mock history
      for (let i = 0; i < 24; i++) {
        const flow = generateMockFlow(symbol.toUpperCase());
        flow.timestamp = new Date(Date.now() - i * 3600000);
        history.push(flow);
      }
      flowData.set(symbol.toUpperCase(), history);
    }
    
    const avgBuying = history.reduce((sum, f) => sum + f.buyingPercent, 0) / history.length;
    const avgSelling = history.reduce((sum, f) => sum + f.sellingPercent, 0) / history.length;
    const netAccum = history.reduce((sum, f) => sum + f.netFlow, 0);
    
    const stats: InstitutionalStats = {
      symbol: symbol.toUpperCase(),
      period,
      avgBuyingPercent: Math.round(avgBuying * 100) / 100,
      avgSellingPercent: Math.round(avgSelling * 100) / 100,
      netAccumulation: netAccum,
      largeOrderRatio: Math.round(Math.random() * 30 + 10), // 10-40%
      institutionalSentiment: avgBuying > 55 ? 'bullish' : avgBuying < 45 ? 'bearish' : 'neutral',
      confidence: Math.round(Math.min(100, Math.abs(avgBuying - 50) * 2))
    };
    
    return { success: true, data: stats };
  });

  // Smart Money Index
  fastify.get('/api/institutional/smi/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    
    const smi = Math.floor(Math.random() * 200 - 100); // -100 to 100
    
    return {
      success: true,
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      smartMoneyIndex: smi,
      interpretation: smi > 30 ? 'Strong institutional accumulation' :
                      smi > 0 ? 'Mild institutional buying' :
                      smi > -30 ? 'Mild institutional selling' :
                      'Strong institutional distribution',
      signal: smi > 20 ? 'buy' : smi < -20 ? 'sell' : 'hold'
    };
  });

  // Whale activity tracker
  fastify.get('/api/institutional/whales/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { minAmount = 100000 } = request.query as { minAmount?: number };
    
    // Generate mock whale activity
    const whales: WhaleActivity[] = Array.from({ length: Math.floor(Math.random() * 10) + 3 }, () => ({
      address: `0x${Math.random().toString(16).substr(2, 40)}`,
      action: Math.random() > 0.5 ? 'accumulation' : Math.random() > 0.5 ? 'distribution' : 'neutral',
      amount: Math.floor(Math.random() * 5000000) + minAmount,
      estimatedUSD: Math.floor(Math.random() * 10000000) + minAmount * 2,
      timestamp: new Date(Date.now() - Math.random() * 86400000)
    }));
    
    const totalBuying = whales.filter(w => w.action === 'accumulation').reduce((sum, w) => sum + w.estimatedUSD, 0);
    const totalSelling = whales.filter(w => w.action === 'distribution').reduce((sum, w) => sum + w.estimatedUSD, 0);
    
    return {
      success: true,
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      whaleCount: whales.length,
      totalBuyVolume: totalBuying,
      totalSellVolume: totalSelling,
      netFlow: totalBuying - totalSelling,
      sentiment: totalBuying > totalSelling ? 'bullish' : 'bearish',
      activities: whales.sort((a, b) => b.estimatedUSD - a.estimatedUSD)
    };
  });

  // Dark pool activity
  fastify.get('/api/institutional/darkpool/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    
    const darkPoolPercent = Math.round(Math.random() * 40 + 25); // 25-65%
    const shortInterest = Math.round(Math.random() * 20 + 5); // 5-25%
    
    return {
      success: true,
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      darkPoolPercent,
      shortInterest,
      daysToeCover: Math.round(Math.random() * 5 + 1),
      institutionalOwnership: Math.round(Math.random() * 60 + 20), // 20-80%
      recentDarkPoolPrints: Array.from({ length: 5 }, () => ({
        time: new Date(Date.now() - Math.random() * 3600000),
        price: Math.round(Math.random() * 100 + 50) + Math.random(),
        volume: Math.floor(Math.random() * 100000) + 10000,
        type: Math.random() > 0.5 ? 'buy' : 'sell'
      }))
    };
  });

  // Create flow alert
  fastify.post('/api/institutional/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol, type, threshold } = request.body as {
      symbol: string;
      type: 'accumulation' | 'distribution' | 'whale_buy' | 'whale_sell' | 'dark_pool_spike';
      threshold: number;
    };
    
    const alert: FlowAlert = {
      id: generateAlertId(),
      symbol: symbol.toUpperCase(),
      type,
      threshold,
      currentValue: 0,
      triggered: false
    };
    
    if (!flowAlerts.has(symbol)) {
      flowAlerts.set(symbol, []);
    }
    flowAlerts.get(symbol)!.push(alert);
    
    return { success: true, alert };
  });

  // Get alerts
  fastify.get('/api/institutional/alerts', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.query as { symbol?: string };
    
    if (symbol) {
      return { success: true, alerts: flowAlerts.get(symbol.toUpperCase()) || [] };
    }
    
    const allAlerts: FlowAlert[] = [];
    flowAlerts.forEach((alerts) => allAlerts.push(...alerts));
    
    return { success: true, alerts: allAlerts };
  });

  // Delete alert
  fastify.delete('/api/institutional/alerts/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    flowAlerts.forEach((alerts, symbol) => {
      const index = alerts.findIndex(a => a.id === id);
      if (index !== -1) {
        alerts.splice(index, 1);
      }
    });
    
    return { success: true, message: 'Alert deleted' };
  });

  // Institutional screener - find accumulation/distribution
  fastify.get('/api/institutional/screener', async (request: FastifyRequest, reply: FastifyReply) => {
    const { minBuyingPercent = 60, minVolume = 1000000, market = 'all' } = request.query as {
      minBuyingPercent?: number;
      minVolume?: number;
      market?: string;
    };
    
    // Mock screener results
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'BTC', 'ETH', 'SOL', 'TSLA', 'META'];
    
    const results = symbols.map(symbol => {
      const flow = generateMockFlow(symbol);
      return {
        symbol,
        buyingPercent: flow.buyingPercent,
        netFlow: flow.netFlow,
        smartMoneyIndex: flow.smartMoneyIndex,
        whaleCount: flow.whaleActivity.length,
        signal: flow.buyingPercent > 60 ? 'accumulation' : flow.buyingPercent < 40 ? 'distribution' : 'neutral'
      };
    }).filter(r => r.buyingPercent >= minBuyingPercent);
    
    return {
      success: true,
      filters: { minBuyingPercent, minVolume, market },
      count: results.length,
      results: results.sort((a, b) => b.buyingPercent - a.buyingPercent)
    };
  });
}

export const skillInfo = {
  id: 'institutional-flow',
  name: 'Institutional Flow Analyzer',
  version: '1.0.0',
  description: 'Track institutional buying/selling, whale activity, dark pools, and smart money flow',
  author: 'K.I.T. Finance Research',
  category: 'analysis',
  keywords: ['institutional', 'whale', 'dark pool', 'smart money', 'flow', 'accumulation'],
  endpoints: [
    'GET /api/institutional/flow/:symbol',
    'GET /api/institutional/flow/:symbol/history',
    'GET /api/institutional/stats/:symbol',
    'GET /api/institutional/smi/:symbol',
    'GET /api/institutional/whales/:symbol',
    'GET /api/institutional/darkpool/:symbol',
    'POST /api/institutional/alerts',
    'GET /api/institutional/alerts',
    'DELETE /api/institutional/alerts/:id',
    'GET /api/institutional/screener'
  ]
};
