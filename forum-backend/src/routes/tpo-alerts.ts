/**
 * TPO (Time Price Opportunity) Alerts - Market Profile Alerts
 * Based on TradingView's new TPO alerts feature (Feb 2025)
 * 
 * Features:
 * - POC (Point of Control) alerts
 * - VAH (Value Area High) alerts  
 * - VAL (Value Area Low) alerts
 * - Initial Balance alerts
 * - Single Print alerts
 * - Poor High/Low alerts
 * - Profile shape change alerts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// Types
// ============================================================================

interface TPOLevel {
  id: string;
  symbol: string;
  timeframe: 'daily' | 'weekly' | 'monthly' | 'session' | 'custom';
  sessionDate: string;
  poc: number;
  vah: number;
  val: number;
  ibHigh: number;
  ibLow: number;
  profileHigh: number;
  profileLow: number;
  tpoCount: number;
  volumeAtPoc: number;
  valueAreaPercent: number;
  singlePrints: number[];
  poorHighs: number[];
  poorLows: number[];
  profileShape: 'p-shape' | 'd-shape' | 'b-shape' | 'normal' | 'double-distribution';
  createdAt: Date;
}

interface TPOAlert {
  id: string;
  userId: string;
  symbol: string;
  alertType: string;
  condition: string;
  level?: number;
  extendedLevel: boolean;
  status: 'active' | 'triggered' | 'expired' | 'disabled';
  notification: { email: boolean; push: boolean; webhook?: string };
  lastTriggered?: Date;
  triggerCount: number;
  maxTriggers?: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Mock data stores
const tpoLevels: Map<string, TPOLevel[]> = new Map();
const tpoAlerts: Map<string, TPOAlert> = new Map();
const triggeredAlerts: Array<{ alert: TPOAlert; triggeredAt: Date; price: number }> = [];

// ============================================================================
// Route Registration
// ============================================================================

export async function tpoAlertRoutes(fastify: FastifyInstance) {
  
  // Get TPO levels for a symbol
  fastify.get('/levels/:symbol', {
    schema: {
      description: 'Get TPO (Market Profile) levels for a symbol',
      tags: ['TPO Alerts'],
      params: {
        type: 'object',
        properties: { symbol: { type: 'string' } },
        required: ['symbol']
      },
      querystring: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          days: { type: 'number', default: 5 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Params: { symbol: string }; Querystring: { timeframe?: string; days?: number } }>) => {
    const { symbol } = request.params;
    const { timeframe = 'daily', days = 5 } = request.query;
    
    const levels = tpoLevels.get(symbol) || generateMockTPOLevels(symbol, days);
    
    return {
      success: true,
      symbol,
      timeframe,
      levels: levels.slice(0, days),
      currentSession: levels[0] || null
    };
  });

  // Get full TPO analysis for a symbol
  fastify.get('/analysis/:symbol', {
    schema: {
      description: 'Get comprehensive TPO analysis with trading recommendations',
      tags: ['TPO Alerts'],
      params: {
        type: 'object',
        properties: { symbol: { type: 'string' } },
        required: ['symbol']
      }
    }
  }, async (request: FastifyRequest<{ Params: { symbol: string } }>) => {
    const { symbol } = request.params;
    return { success: true, analysis: generateTPOAnalysis(symbol) };
  });

  // Get all unfilled POCs
  fastify.get('/naked-pocs', {
    schema: {
      description: 'Get unfilled POCs across all watched symbols',
      tags: ['TPO Alerts'],
      querystring: {
        type: 'object',
        properties: {
          symbols: { type: 'string' },
          maxDays: { type: 'number', default: 20 }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { symbols?: string; maxDays?: number } }>) => {
    const { symbols, maxDays = 20 } = request.query;
    const symbolList = symbols ? symbols.split(',') : ['BTCUSD', 'ETHUSD', 'EURUSD', 'ES'];
    
    const nakedPocs = symbolList.map(symbol => ({
      symbol,
      nakedPocs: [
        { date: '2026-02-13', level: 42150.50, distance: 250, ageInDays: 2 },
        { date: '2026-02-10', level: 41800.00, distance: 600, ageInDays: 5 }
      ].filter(p => p.ageInDays <= maxDays)
    }));
    
    return { success: true, nakedPocs };
  });

  // Create a TPO alert
  fastify.post('/alerts', {
    schema: {
      description: 'Create a new TPO/Market Profile alert',
      tags: ['TPO Alerts'],
      body: {
        type: 'object',
        required: ['symbol', 'alertType'],
        properties: {
          symbol: { type: 'string' },
          alertType: { type: 'string', enum: ['poc_touch', 'poc_cross', 'vah_touch', 'vah_cross', 'val_touch', 'val_cross', 'ib_breakout', 'ib_breakdown', 'single_print_fill', 'poor_high_test', 'poor_low_test', 'profile_change', 'poc_migration', 'naked_poc'] },
          condition: { type: 'string', enum: ['crosses_above', 'crosses_below', 'touches', 'enters_value_area', 'exits_value_area'] },
          level: { type: 'number' },
          extendedLevel: { type: 'boolean', default: true },
          notification: { type: 'object' },
          maxTriggers: { type: 'number' },
          expiresAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { symbol, alertType, condition, level, extendedLevel = true, notification, maxTriggers, expiresAt } = request.body;
    
    const alert: TPOAlert = {
      id: `tpo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user_1',
      symbol,
      alertType,
      condition: condition || 'touches',
      level,
      extendedLevel,
      status: 'active',
      notification: notification || { email: false, push: true },
      triggerCount: 0,
      maxTriggers,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    tpoAlerts.set(alert.id, alert);
    return reply.code(201).send({ success: true, message: 'TPO alert created', alert });
  });

  // List TPO alerts
  fastify.get('/alerts', {
    schema: {
      description: 'List all TPO alerts for user',
      tags: ['TPO Alerts'],
      querystring: {
        type: 'object',
        properties: {
          symbol: { type: 'string' },
          status: { type: 'string' },
          type: { type: 'string' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: { symbol?: string; status?: string; type?: string } }>) => {
    const { symbol, status, type } = request.query;
    let alerts = Array.from(tpoAlerts.values());
    
    if (symbol) alerts = alerts.filter(a => a.symbol === symbol);
    if (status) alerts = alerts.filter(a => a.status === status);
    if (type) alerts = alerts.filter(a => a.alertType === type);
    
    return { success: true, count: alerts.length, alerts };
  });

  // Delete TPO alert
  fastify.delete('/alerts/:id', {
    schema: {
      description: 'Delete a TPO alert',
      tags: ['TPO Alerts'],
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id']
      }
    }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    if (!tpoAlerts.has(id)) {
      return reply.code(404).send({ error: 'Alert not found' });
    }
    tpoAlerts.delete(id);
    return { success: true, message: 'Alert deleted' };
  });

  // Bulk create TPO alerts
  fastify.post('/alerts/bulk', {
    schema: {
      description: 'Create multiple TPO alerts for all key levels',
      tags: ['TPO Alerts'],
      body: {
        type: 'object',
        required: ['symbol'],
        properties: {
          symbol: { type: 'string' },
          alertTypes: { type: 'array', items: { type: 'string' } },
          notification: { type: 'object' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { symbol, alertTypes, notification } = request.body;
    const types = alertTypes || ['poc_touch', 'vah_touch', 'val_touch', 'ib_breakout', 'ib_breakdown'];
    const createdAlerts: TPOAlert[] = [];
    
    for (const alertType of types) {
      const alert: TPOAlert = {
        id: `tpo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: 'user_1',
        symbol,
        alertType,
        condition: alertType.includes('cross') ? 'crosses_above' : 'touches',
        extendedLevel: true,
        status: 'active',
        notification: notification || { email: false, push: true },
        triggerCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      tpoAlerts.set(alert.id, alert);
      createdAlerts.push(alert);
    }
    
    return reply.code(201).send({ success: true, message: `Created ${createdAlerts.length} TPO alerts`, alerts: createdAlerts });
  });

  // Get profile shapes info
  fastify.get('/shapes', {
    schema: {
      description: 'Get Market Profile shape interpretations',
      tags: ['TPO Alerts']
    }
  }, async () => {
    return {
      success: true,
      shapes: [
        { shape: 'p-shape', description: 'Short covering rally', implication: 'Bearish - often seen at tops', tradeBias: 'Look for shorts at highs' },
        { shape: 'd-shape', description: 'Long liquidation', implication: 'Bullish - often seen at bottoms', tradeBias: 'Look for longs at lows' },
        { shape: 'b-shape', description: 'Balanced profile', implication: 'Neutral - consolidation', tradeBias: 'Range trading, fade extremes' },
        { shape: 'normal', description: 'Bell curve distribution', implication: 'Balanced market', tradeBias: 'Trade towards value area' },
        { shape: 'double-distribution', description: 'Two value areas', implication: 'Market indecision', tradeBias: 'Trade breakout of range' }
      ]
    };
  });

  // Get market type analysis
  fastify.get('/market-type/:symbol', {
    schema: {
      description: 'Determine market type for today based on TPO structure',
      tags: ['TPO Alerts'],
      params: {
        type: 'object',
        properties: { symbol: { type: 'string' } },
        required: ['symbol']
      }
    }
  }, async (request: FastifyRequest<{ Params: { symbol: string } }>) => {
    const { symbol } = request.params;
    const marketTypes = [
      { type: 'trend_day', description: 'Strong directional move', tradingApproach: 'Trade with trend, add on pullbacks' },
      { type: 'normal_day', description: 'Opens inside previous value, rotates around POC', tradingApproach: 'Fade extremes, target POC' },
      { type: 'neutral_day', description: 'Narrow range, low conviction', tradingApproach: 'Small positions or sit out' },
      { type: 'double_distribution', description: 'Two value areas develop', tradingApproach: 'Trade breakout, avoid chop zone' }
    ];
    
    return {
      success: true,
      symbol,
      date: new Date().toISOString().split('T')[0],
      marketType: marketTypes[Math.floor(Math.random() * marketTypes.length)]
    };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function generateMockTPOLevels(symbol: string, days: number): TPOLevel[] {
  const levels: TPOLevel[] = [];
  const basePrice = symbol.includes('BTC') ? 42000 : symbol.includes('ETH') ? 2800 : 1.0850;
  
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const volatility = basePrice * 0.02;
    const poc = basePrice + (Math.random() - 0.5) * volatility;
    const vaRange = volatility * 0.7;
    
    levels.push({
      id: `tpo_${symbol}_${date.toISOString().split('T')[0]}`,
      symbol,
      timeframe: 'daily',
      sessionDate: date.toISOString().split('T')[0],
      poc: Number(poc.toFixed(2)),
      vah: Number((poc + vaRange / 2).toFixed(2)),
      val: Number((poc - vaRange / 2).toFixed(2)),
      ibHigh: Number((poc + vaRange * 0.3).toFixed(2)),
      ibLow: Number((poc - vaRange * 0.3).toFixed(2)),
      profileHigh: Number((poc + volatility).toFixed(2)),
      profileLow: Number((poc - volatility).toFixed(2)),
      tpoCount: Math.floor(Math.random() * 20) + 30,
      volumeAtPoc: Math.floor(Math.random() * 10000) + 5000,
      valueAreaPercent: 70,
      singlePrints: [Number((poc + vaRange * 0.8).toFixed(2))],
      poorHighs: [],
      poorLows: [],
      profileShape: ['p-shape', 'd-shape', 'b-shape', 'normal', 'double-distribution'][Math.floor(Math.random() * 5)] as any,
      createdAt: date
    });
  }
  return levels;
}

function generateTPOAnalysis(symbol: string) {
  const levels = generateMockTPOLevels(symbol, 5);
  const today = levels[0];
  const basePrice = symbol.includes('BTC') ? 42400 : symbol.includes('ETH') ? 2850 : 1.0855;
  
  return {
    symbol,
    currentPrice: basePrice,
    todayProfile: today,
    nakedPocs: [{ date: '2026-02-13', level: today.poc - 200, distance: 200 }],
    marketContext: 'normal_day',
    biasDirection: basePrice > today.poc ? 'bullish' : 'bearish',
    tradingRecommendation: basePrice > today.vah 
      ? 'Price above value - look for pullback to VAH for long entry'
      : 'Price inside value - trade rotations between VAH and VAL'
  };
}
