/**
 * K.I.T. Skill #98: Liquidity Zone Detector
 * 
 * TradingView-inspired liquidity analysis with:
 * - 16 simultaneous liquidity zones (vs TV's basic swing)
 * - Stop hunt detection
 * - Sweep trigger alerts
 * - Support/resistance clusters
 * - Order block identification
 * - Imbalance/Fair Value Gap detection
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Interfaces
interface LiquidityZone {
  id: string;
  symbol: string;
  type: 'support' | 'resistance' | 'order_block' | 'fair_value_gap';
  priceLevel: number;
  strength: number;           // 1-10
  touchCount: number;
  lastTouched?: Date;
  createdAt: Date;
  status: 'active' | 'swept' | 'broken';
  estimatedLiquidity: number; // USD value of stops at this level
}

interface SweepEvent {
  id: string;
  symbol: string;
  zoneId: string;
  sweepType: 'stop_hunt' | 'liquidity_grab' | 'break_of_structure';
  priceLevel: number;
  wickHigh?: number;
  wickLow?: number;
  timestamp: Date;
  volume: number;
  recovered: boolean;         // Did price recover after sweep?
  tradingSignal: 'buy' | 'sell' | 'neutral';
}

interface FairValueGap {
  id: string;
  symbol: string;
  type: 'bullish' | 'bearish';
  highPrice: number;
  lowPrice: number;
  midPrice: number;
  gapSize: number;
  filledPercent: number;
  status: 'open' | 'partially_filled' | 'filled';
  createdAt: Date;
}

interface OrderBlock {
  id: string;
  symbol: string;
  type: 'bullish' | 'bearish';
  high: number;
  low: number;
  origin: 'break_of_structure' | 'market_structure_shift' | 'displacement';
  strength: number;
  tested: boolean;
  brokenAt?: Date;
  createdAt: Date;
}

// Data stores
const liquidityZones = new Map<string, LiquidityZone[]>();
const sweepEvents = new Map<string, SweepEvent[]>();
const fvgData = new Map<string, FairValueGap[]>();
const orderBlocks = new Map<string, OrderBlock[]>();

// Helpers
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function calculateZoneStrength(zone: LiquidityZone): number {
  // Strength based on touch count, time, and volume
  const touchFactor = Math.min(zone.touchCount * 2, 6);
  const ageFactor = zone.status === 'active' ? 2 : 0;
  const liquidityFactor = zone.estimatedLiquidity > 1000000 ? 2 : 1;
  return Math.min(10, touchFactor + ageFactor + liquidityFactor);
}

function generateMockZones(symbol: string, currentPrice: number): LiquidityZone[] {
  const zones: LiquidityZone[] = [];
  
  // Generate 16 zones around current price
  for (let i = 0; i < 16; i++) {
    const offset = (i - 8) * (currentPrice * 0.01); // 1% increments
    const priceLevel = Math.round((currentPrice + offset) * 100) / 100;
    
    zones.push({
      id: generateId('zone'),
      symbol,
      type: i % 4 === 0 ? 'order_block' : i % 3 === 0 ? 'fair_value_gap' : offset > 0 ? 'resistance' : 'support',
      priceLevel,
      strength: Math.floor(Math.random() * 7) + 3,
      touchCount: Math.floor(Math.random() * 5) + 1,
      lastTouched: new Date(Date.now() - Math.random() * 86400000 * 7),
      createdAt: new Date(Date.now() - Math.random() * 86400000 * 30),
      status: Math.random() > 0.8 ? 'swept' : 'active',
      estimatedLiquidity: Math.floor(Math.random() * 5000000) + 100000
    });
  }
  
  return zones.sort((a, b) => b.priceLevel - a.priceLevel);
}

function generateMockSweep(symbol: string, zone: LiquidityZone): SweepEvent {
  const recovered = Math.random() > 0.4;
  return {
    id: generateId('sweep'),
    symbol,
    zoneId: zone.id,
    sweepType: Math.random() > 0.6 ? 'stop_hunt' : Math.random() > 0.5 ? 'liquidity_grab' : 'break_of_structure',
    priceLevel: zone.priceLevel,
    wickHigh: zone.type === 'resistance' ? zone.priceLevel * 1.002 : undefined,
    wickLow: zone.type === 'support' ? zone.priceLevel * 0.998 : undefined,
    timestamp: new Date(),
    volume: Math.floor(Math.random() * 10000000) + 500000,
    recovered,
    tradingSignal: recovered ? (zone.type === 'support' ? 'buy' : 'sell') : 'neutral'
  };
}

// Routes
export default async function liquidityZoneRoutes(fastify: FastifyInstance) {

  // Get all liquidity zones for a symbol
  fastify.get('/api/liquidity/zones/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { status = 'all', minStrength = 1 } = request.query as { status?: string; minStrength?: number };
    
    const upperSymbol = symbol.toUpperCase();
    const currentPrice = Math.random() * 1000 + 100; // Mock price
    
    // Initialize zones if not exists
    if (!liquidityZones.has(upperSymbol)) {
      liquidityZones.set(upperSymbol, generateMockZones(upperSymbol, currentPrice));
    }
    
    let zones = liquidityZones.get(upperSymbol)!;
    
    if (status !== 'all') {
      zones = zones.filter(z => z.status === status);
    }
    
    zones = zones.filter(z => z.strength >= minStrength);
    
    return {
      success: true,
      symbol: upperSymbol,
      currentPrice,
      zoneCount: zones.length,
      zones,
      summary: {
        supportZones: zones.filter(z => z.type === 'support').length,
        resistanceZones: zones.filter(z => z.type === 'resistance').length,
        orderBlocks: zones.filter(z => z.type === 'order_block').length,
        fvgs: zones.filter(z => z.type === 'fair_value_gap').length,
        totalLiquidity: zones.reduce((sum, z) => sum + z.estimatedLiquidity, 0)
      }
    };
  });

  // Get sweep events
  fastify.get('/api/liquidity/sweeps/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { limit = 20, sweepType } = request.query as { limit?: number; sweepType?: string };
    
    const upperSymbol = symbol.toUpperCase();
    let sweeps = sweepEvents.get(upperSymbol) || [];
    
    if (sweepType) {
      sweeps = sweeps.filter(s => s.sweepType === sweepType);
    }
    
    return {
      success: true,
      symbol: upperSymbol,
      sweepCount: sweeps.length,
      sweeps: sweeps.slice(-limit),
      stats: {
        totalSweeps: sweeps.length,
        stopHunts: sweeps.filter(s => s.sweepType === 'stop_hunt').length,
        liquidityGrabs: sweeps.filter(s => s.sweepType === 'liquidity_grab').length,
        recoveryRate: sweeps.length > 0 
          ? Math.round(sweeps.filter(s => s.recovered).length / sweeps.length * 100)
          : 0
      }
    };
  });

  // Detect sweep in real-time (simulate)
  fastify.post('/api/liquidity/detect-sweep', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol, currentPrice, high, low, volume } = request.body as {
      symbol: string;
      currentPrice: number;
      high: number;
      low: number;
      volume: number;
    };
    
    const upperSymbol = symbol.toUpperCase();
    const zones = liquidityZones.get(upperSymbol) || generateMockZones(upperSymbol, currentPrice);
    
    // Check if any zones were swept
    const sweptZones = zones.filter(zone => {
      if (zone.status === 'swept') return false;
      if (zone.type === 'support' && low <= zone.priceLevel && currentPrice > zone.priceLevel) return true;
      if (zone.type === 'resistance' && high >= zone.priceLevel && currentPrice < zone.priceLevel) return true;
      return false;
    });
    
    const detectedSweeps: SweepEvent[] = sweptZones.map(zone => {
      const sweep = generateMockSweep(upperSymbol, zone);
      zone.status = 'swept';
      
      // Store sweep
      if (!sweepEvents.has(upperSymbol)) {
        sweepEvents.set(upperSymbol, []);
      }
      sweepEvents.get(upperSymbol)!.push(sweep);
      
      return sweep;
    });
    
    return {
      success: true,
      symbol: upperSymbol,
      sweepsDetected: detectedSweeps.length,
      sweeps: detectedSweeps,
      tradingOpportunity: detectedSweeps.find(s => s.recovered)
        ? detectedSweeps.find(s => s.recovered)!.tradingSignal
        : 'none'
    };
  });

  // Get Fair Value Gaps
  fastify.get('/api/liquidity/fvg/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { status = 'all', type } = request.query as { status?: string; type?: string };
    
    const upperSymbol = symbol.toUpperCase();
    
    // Generate mock FVGs if not exists
    if (!fvgData.has(upperSymbol)) {
      const fvgs: FairValueGap[] = Array.from({ length: 8 }, () => {
        const isBullish = Math.random() > 0.5;
        const basePrice = Math.random() * 1000 + 100;
        const gapSize = basePrice * (Math.random() * 0.02 + 0.005);
        
        return {
          id: generateId('fvg'),
          symbol: upperSymbol,
          type: isBullish ? 'bullish' : 'bearish',
          highPrice: basePrice + gapSize,
          lowPrice: basePrice,
          midPrice: basePrice + gapSize / 2,
          gapSize,
          filledPercent: Math.round(Math.random() * 80),
          status: Math.random() > 0.7 ? 'filled' : Math.random() > 0.5 ? 'partially_filled' : 'open',
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 14)
        };
      });
      fvgData.set(upperSymbol, fvgs);
    }
    
    let fvgs = fvgData.get(upperSymbol)!;
    
    if (status !== 'all') {
      fvgs = fvgs.filter(f => f.status === status);
    }
    if (type) {
      fvgs = fvgs.filter(f => f.type === type);
    }
    
    return {
      success: true,
      symbol: upperSymbol,
      fvgCount: fvgs.length,
      fvgs: fvgs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      tradingNote: 'FVGs often act as magnets - price tends to return to fill them'
    };
  });

  // Get Order Blocks
  fastify.get('/api/liquidity/orderblocks/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { type, tested } = request.query as { type?: string; tested?: string };
    
    const upperSymbol = symbol.toUpperCase();
    
    // Generate mock order blocks
    if (!orderBlocks.has(upperSymbol)) {
      const blocks: OrderBlock[] = Array.from({ length: 6 }, () => {
        const isBullish = Math.random() > 0.5;
        const basePrice = Math.random() * 1000 + 100;
        const range = basePrice * (Math.random() * 0.01 + 0.003);
        
        return {
          id: generateId('ob'),
          symbol: upperSymbol,
          type: isBullish ? 'bullish' : 'bearish',
          high: basePrice + range,
          low: basePrice,
          origin: Math.random() > 0.6 ? 'break_of_structure' : Math.random() > 0.5 ? 'market_structure_shift' : 'displacement',
          strength: Math.floor(Math.random() * 7) + 3,
          tested: Math.random() > 0.6,
          createdAt: new Date(Date.now() - Math.random() * 86400000 * 21)
        };
      });
      orderBlocks.set(upperSymbol, blocks);
    }
    
    let blocks = orderBlocks.get(upperSymbol)!;
    
    if (type) {
      blocks = blocks.filter(b => b.type === type);
    }
    if (tested !== undefined) {
      blocks = blocks.filter(b => b.tested === (tested === 'true'));
    }
    
    return {
      success: true,
      symbol: upperSymbol,
      orderBlockCount: blocks.length,
      orderBlocks: blocks.sort((a, b) => b.strength - a.strength),
      tradingNote: 'Untested order blocks are higher probability trade zones'
    };
  });

  // Create custom zone
  fastify.post('/api/liquidity/zones', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol, type, priceLevel, strength = 5, estimatedLiquidity = 500000 } = request.body as {
      symbol: string;
      type: 'support' | 'resistance' | 'order_block' | 'fair_value_gap';
      priceLevel: number;
      strength?: number;
      estimatedLiquidity?: number;
    };
    
    const upperSymbol = symbol.toUpperCase();
    
    const zone: LiquidityZone = {
      id: generateId('zone'),
      symbol: upperSymbol,
      type,
      priceLevel,
      strength,
      touchCount: 0,
      createdAt: new Date(),
      status: 'active',
      estimatedLiquidity
    };
    
    if (!liquidityZones.has(upperSymbol)) {
      liquidityZones.set(upperSymbol, []);
    }
    liquidityZones.get(upperSymbol)!.push(zone);
    
    return { success: true, zone };
  });

  // Delete zone
  fastify.delete('/api/liquidity/zones/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    
    liquidityZones.forEach((zones, symbol) => {
      const index = zones.findIndex(z => z.id === id);
      if (index !== -1) {
        zones.splice(index, 1);
      }
    });
    
    return { success: true, message: 'Zone deleted' };
  });

  // Liquidity heatmap
  fastify.get('/api/liquidity/heatmap/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { range = 5 } = request.query as { range?: number }; // % range
    
    const upperSymbol = symbol.toUpperCase();
    const currentPrice = Math.random() * 1000 + 100;
    const zones = liquidityZones.get(upperSymbol) || generateMockZones(upperSymbol, currentPrice);
    
    // Create heatmap levels
    const levels = 20;
    const priceRange = currentPrice * (range / 100);
    const step = (priceRange * 2) / levels;
    
    const heatmap = Array.from({ length: levels }, (_, i) => {
      const price = currentPrice - priceRange + (i * step);
      const zonesAtLevel = zones.filter(z => 
        Math.abs(z.priceLevel - price) < step / 2
      );
      
      return {
        price: Math.round(price * 100) / 100,
        liquidityEstimate: zonesAtLevel.reduce((sum, z) => sum + z.estimatedLiquidity, 0),
        zoneCount: zonesAtLevel.length,
        intensity: Math.min(10, zonesAtLevel.length * 2 + zonesAtLevel.reduce((sum, z) => sum + z.strength, 0) / 3)
      };
    });
    
    return {
      success: true,
      symbol: upperSymbol,
      currentPrice,
      priceRange: `±${range}%`,
      heatmap,
      hotZones: heatmap.filter(h => h.intensity >= 7).map(h => h.price)
    };
  });
}

export const skillInfo = {
  id: 'liquidity-zone-detector',
  name: 'Liquidity Zone Detector',
  version: '1.0.0',
  description: 'Track 16+ liquidity zones, detect sweeps, find fair value gaps and order blocks',
  author: 'K.I.T. Finance Research',
  category: 'analysis',
  keywords: ['liquidity', 'sweep', 'stop hunt', 'fvg', 'order block', 'smart money'],
  endpoints: [
    'GET /api/liquidity/zones/:symbol',
    'GET /api/liquidity/sweeps/:symbol',
    'POST /api/liquidity/detect-sweep',
    'GET /api/liquidity/fvg/:symbol',
    'GET /api/liquidity/orderblocks/:symbol',
    'POST /api/liquidity/zones',
    'DELETE /api/liquidity/zones/:id',
    'GET /api/liquidity/heatmap/:symbol'
  ]
};
