/**
 * K.I.T. Skill #99: Crypto Heat Map
 * 
 * TradingView-inspired visual market analysis:
 * - Sector performance heat maps
 * - Market cap weighted views
 * - Performance by timeframe
 * - Correlation matrices
 * - Relative strength analysis
 * - Category breakdowns (L1, L2, DeFi, Gaming, etc.)
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// Interfaces
interface HeatMapAsset {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change1h: number;
  change24h: number;
  change7d: number;
  change30d: number;
  category: string;
  heatScore: number;      // -100 to 100
  relativeStrength: number;
}

interface SectorPerformance {
  sector: string;
  avgChange24h: number;
  avgChange7d: number;
  marketCap: number;
  volume24h: number;
  topPerformer: string;
  worstPerformer: string;
  assetCount: number;
  momentum: 'bullish' | 'bearish' | 'neutral';
}

interface CorrelationMatrix {
  assets: string[];
  matrix: number[][];     // Correlation coefficients
  strongPositive: Array<{ pair: string[]; correlation: number }>;
  strongNegative: Array<{ pair: string[]; correlation: number }>;
}

interface MarketOverview {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  altcoinSeason: boolean;
  fearGreedIndex: number;
  topGainers: HeatMapAsset[];
  topLosers: HeatMapAsset[];
  trending: HeatMapAsset[];
}

// Mock data
const categories = [
  'Layer 1', 'Layer 2', 'DeFi', 'Gaming', 'Meme', 'AI', 'RWA', 
  'Infrastructure', 'Exchange', 'Privacy', 'Storage', 'Oracle'
];

const mockAssets: HeatMapAsset[] = [
  // Layer 1s
  { symbol: 'BTC', name: 'Bitcoin', category: 'Layer 1', price: 97500, marketCap: 1920000000000, volume24h: 45000000000, change1h: 0.3, change24h: 2.1, change7d: 5.4, change30d: 12.3, heatScore: 65, relativeStrength: 78 },
  { symbol: 'ETH', name: 'Ethereum', category: 'Layer 1', price: 3850, marketCap: 462000000000, volume24h: 18000000000, change1h: 0.5, change24h: 3.2, change7d: 8.1, change30d: 15.6, heatScore: 72, relativeStrength: 82 },
  { symbol: 'SOL', name: 'Solana', category: 'Layer 1', price: 245, marketCap: 115000000000, volume24h: 8500000000, change1h: 1.2, change24h: 5.8, change7d: 12.4, change30d: 28.9, heatScore: 85, relativeStrength: 91 },
  { symbol: 'ADA', name: 'Cardano', category: 'Layer 1', price: 1.05, marketCap: 37000000000, volume24h: 1200000000, change1h: -0.2, change24h: -1.5, change7d: -3.2, change30d: -8.5, heatScore: -25, relativeStrength: 35 },
  { symbol: 'AVAX', name: 'Avalanche', category: 'Layer 1', price: 52, marketCap: 21000000000, volume24h: 950000000, change1h: 0.8, change24h: 4.2, change7d: 9.3, change30d: 22.1, heatScore: 68, relativeStrength: 75 },
  
  // Layer 2s
  { symbol: 'ARB', name: 'Arbitrum', category: 'Layer 2', price: 1.85, marketCap: 7400000000, volume24h: 450000000, change1h: 0.6, change24h: 3.8, change7d: 7.2, change30d: 18.5, heatScore: 58, relativeStrength: 68 },
  { symbol: 'OP', name: 'Optimism', category: 'Layer 2', price: 3.20, marketCap: 4200000000, volume24h: 320000000, change1h: 0.4, change24h: 2.9, change7d: 6.1, change30d: 14.2, heatScore: 52, relativeStrength: 62 },
  { symbol: 'MATIC', name: 'Polygon', category: 'Layer 2', price: 0.68, marketCap: 6800000000, volume24h: 380000000, change1h: -0.1, change24h: 1.2, change7d: 2.8, change30d: 5.3, heatScore: 28, relativeStrength: 45 },
  
  // DeFi
  { symbol: 'UNI', name: 'Uniswap', category: 'DeFi', price: 18.50, marketCap: 11100000000, volume24h: 620000000, change1h: 0.9, change24h: 4.5, change7d: 11.2, change30d: 25.8, heatScore: 72, relativeStrength: 79 },
  { symbol: 'AAVE', name: 'Aave', category: 'DeFi', price: 385, marketCap: 5770000000, volume24h: 280000000, change1h: 1.1, change24h: 5.2, change7d: 13.8, change30d: 32.1, heatScore: 78, relativeStrength: 85 },
  { symbol: 'MKR', name: 'Maker', category: 'DeFi', price: 2850, marketCap: 2650000000, volume24h: 125000000, change1h: 0.3, change24h: 2.1, change7d: 4.8, change30d: 9.2, heatScore: 42, relativeStrength: 55 },
  
  // Gaming
  { symbol: 'IMX', name: 'Immutable', category: 'Gaming', price: 2.45, marketCap: 4165000000, volume24h: 180000000, change1h: 1.5, change24h: 6.8, change7d: 15.2, change30d: 38.5, heatScore: 82, relativeStrength: 88 },
  { symbol: 'GALA', name: 'Gala', category: 'Gaming', price: 0.065, marketCap: 2400000000, volume24h: 320000000, change1h: 2.1, change24h: 8.5, change7d: 22.3, change30d: 45.6, heatScore: 88, relativeStrength: 92 },
  
  // AI
  { symbol: 'FET', name: 'Fetch.ai', category: 'AI', price: 2.85, marketCap: 7125000000, volume24h: 520000000, change1h: 1.8, change24h: 7.2, change7d: 18.5, change30d: 42.3, heatScore: 85, relativeStrength: 90 },
  { symbol: 'RNDR', name: 'Render', category: 'AI', price: 12.50, marketCap: 6500000000, volume24h: 380000000, change1h: 1.2, change24h: 5.8, change7d: 14.2, change30d: 35.8, heatScore: 78, relativeStrength: 84 },
  { symbol: 'TAO', name: 'Bittensor', category: 'AI', price: 580, marketCap: 4350000000, volume24h: 185000000, change1h: 2.5, change24h: 9.2, change7d: 25.4, change30d: 58.2, heatScore: 92, relativeStrength: 95 },
  
  // Meme
  { symbol: 'DOGE', name: 'Dogecoin', category: 'Meme', price: 0.42, marketCap: 62000000000, volume24h: 3200000000, change1h: -0.5, change24h: -2.3, change7d: -5.8, change30d: 8.5, heatScore: -15, relativeStrength: 52 },
  { symbol: 'SHIB', name: 'Shiba Inu', category: 'Meme', price: 0.000032, marketCap: 18900000000, volume24h: 850000000, change1h: -0.8, change24h: -3.5, change7d: -8.2, change30d: -12.5, heatScore: -42, relativeStrength: 28 },
  { symbol: 'PEPE', name: 'Pepe', category: 'Meme', price: 0.000022, marketCap: 9200000000, volume24h: 1200000000, change1h: 3.2, change24h: 12.5, change7d: 28.3, change30d: 65.2, heatScore: 92, relativeStrength: 96 },
];

// Helper functions
function calculateHeatScore(change24h: number, change7d: number, volume: number, avgVolume: number): number {
  const priceScore = (change24h * 2 + change7d) / 3;
  const volumeMultiplier = volume > avgVolume * 1.5 ? 1.2 : volume < avgVolume * 0.5 ? 0.8 : 1;
  return Math.round(Math.max(-100, Math.min(100, priceScore * 10 * volumeMultiplier)));
}

function getHeatColor(score: number): string {
  if (score >= 60) return '#00E676';      // Bright green
  if (score >= 30) return '#69F0AE';      // Light green
  if (score >= 10) return '#B9F6CA';      // Pale green
  if (score >= -10) return '#FFFFFF';     // White/neutral
  if (score >= -30) return '#FFCDD2';     // Pale red
  if (score >= -60) return '#EF5350';     // Light red
  return '#D50000';                        // Bright red
}

// Routes
export default async function cryptoHeatMapRoutes(fastify: FastifyInstance) {

  // Get full heat map
  fastify.get('/api/heatmap', async (request: FastifyRequest, reply: FastifyReply) => {
    const { 
      category = 'all', 
      sortBy = 'marketCap', 
      minMarketCap = 0,
      timeframe = '24h'
    } = request.query as { 
      category?: string; 
      sortBy?: string; 
      minMarketCap?: number;
      timeframe?: string;
    };
    
    let assets = [...mockAssets];
    
    // Add some randomness for live feel
    assets = assets.map(a => ({
      ...a,
      change1h: a.change1h + (Math.random() - 0.5) * 0.5,
      change24h: a.change24h + (Math.random() - 0.5) * 2,
      heatScore: Math.round(a.heatScore + (Math.random() - 0.5) * 10)
    }));
    
    // Filter by category
    if (category !== 'all') {
      assets = assets.filter(a => a.category.toLowerCase() === category.toLowerCase());
    }
    
    // Filter by market cap
    assets = assets.filter(a => a.marketCap >= minMarketCap);
    
    // Sort
    const sortKey = timeframe === '1h' ? 'change1h' : 
                    timeframe === '7d' ? 'change7d' : 
                    timeframe === '30d' ? 'change30d' : 'change24h';
    
    if (sortBy === 'performance') {
      assets.sort((a, b) => (b as any)[sortKey] - (a as any)[sortKey]);
    } else if (sortBy === 'heatScore') {
      assets.sort((a, b) => b.heatScore - a.heatScore);
    } else {
      assets.sort((a, b) => b.marketCap - a.marketCap);
    }
    
    return {
      success: true,
      timestamp: new Date(),
      timeframe,
      assetCount: assets.length,
      assets: assets.map(a => ({
        ...a,
        color: getHeatColor(a.heatScore)
      })),
      categories: [...new Set(assets.map(a => a.category))]
    };
  });

  // Get sector performance
  fastify.get('/api/heatmap/sectors', async (request: FastifyRequest, reply: FastifyReply) => {
    const sectorMap = new Map<string, HeatMapAsset[]>();
    
    mockAssets.forEach(asset => {
      if (!sectorMap.has(asset.category)) {
        sectorMap.set(asset.category, []);
      }
      sectorMap.get(asset.category)!.push(asset);
    });
    
    const sectors: SectorPerformance[] = Array.from(sectorMap.entries()).map(([sector, assets]) => {
      const avgChange24h = assets.reduce((sum, a) => sum + a.change24h, 0) / assets.length;
      const avgChange7d = assets.reduce((sum, a) => sum + a.change7d, 0) / assets.length;
      const sorted = [...assets].sort((a, b) => b.change24h - a.change24h);
      
      return {
        sector,
        avgChange24h: Math.round(avgChange24h * 100) / 100,
        avgChange7d: Math.round(avgChange7d * 100) / 100,
        marketCap: assets.reduce((sum, a) => sum + a.marketCap, 0),
        volume24h: assets.reduce((sum, a) => sum + a.volume24h, 0),
        topPerformer: sorted[0].symbol,
        worstPerformer: sorted[sorted.length - 1].symbol,
        assetCount: assets.length,
        momentum: avgChange24h > 3 ? 'bullish' : avgChange24h < -3 ? 'bearish' : 'neutral'
      };
    });
    
    return {
      success: true,
      timestamp: new Date(),
      sectors: sectors.sort((a, b) => b.avgChange24h - a.avgChange24h)
    };
  });

  // Get market overview
  fastify.get('/api/heatmap/overview', async (request: FastifyRequest, reply: FastifyReply) => {
    const totalMarketCap = mockAssets.reduce((sum, a) => sum + a.marketCap, 0);
    const btcMarketCap = mockAssets.find(a => a.symbol === 'BTC')?.marketCap || 0;
    const ethMarketCap = mockAssets.find(a => a.symbol === 'ETH')?.marketCap || 0;
    
    const sorted = [...mockAssets].sort((a, b) => b.change24h - a.change24h);
    
    // Calculate fear/greed based on market performance
    const avgChange = mockAssets.reduce((sum, a) => sum + a.change24h, 0) / mockAssets.length;
    const fearGreedIndex = Math.round(50 + avgChange * 5);
    
    const overview: MarketOverview = {
      totalMarketCap,
      totalVolume24h: mockAssets.reduce((sum, a) => sum + a.volume24h, 0),
      btcDominance: Math.round(btcMarketCap / totalMarketCap * 1000) / 10,
      ethDominance: Math.round(ethMarketCap / totalMarketCap * 1000) / 10,
      altcoinSeason: (btcMarketCap / totalMarketCap) < 0.45,
      fearGreedIndex: Math.max(0, Math.min(100, fearGreedIndex)),
      topGainers: sorted.slice(0, 5),
      topLosers: sorted.slice(-5).reverse(),
      trending: mockAssets.filter(a => a.volume24h > 500000000).slice(0, 5)
    };
    
    return {
      success: true,
      timestamp: new Date(),
      data: overview,
      sentiment: overview.fearGreedIndex > 70 ? 'Extreme Greed' :
                 overview.fearGreedIndex > 55 ? 'Greed' :
                 overview.fearGreedIndex > 45 ? 'Neutral' :
                 overview.fearGreedIndex > 30 ? 'Fear' : 'Extreme Fear'
    };
  });

  // Get correlation matrix
  fastify.get('/api/heatmap/correlation', async (request: FastifyRequest, reply: FastifyReply) => {
    const { assets: assetList = 'BTC,ETH,SOL,AVAX,ARB' } = request.query as { assets?: string };
    const symbols = assetList.split(',').map(s => s.trim().toUpperCase());
    
    // Generate mock correlation matrix
    const matrix: number[][] = symbols.map((_, i) => 
      symbols.map((_, j) => {
        if (i === j) return 1;
        // Mock correlations - in reality would be calculated from price history
        return Math.round((Math.random() * 1.4 - 0.2) * 100) / 100; // -0.2 to 1.2, rounded
      })
    );
    
    // Find strong correlations
    const strongPositive: Array<{ pair: string[]; correlation: number }> = [];
    const strongNegative: Array<{ pair: string[]; correlation: number }> = [];
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const corr = matrix[i][j];
        if (corr > 0.7) {
          strongPositive.push({ pair: [symbols[i], symbols[j]], correlation: corr });
        } else if (corr < -0.3) {
          strongNegative.push({ pair: [symbols[i], symbols[j]], correlation: corr });
        }
      }
    }
    
    const result: CorrelationMatrix = {
      assets: symbols,
      matrix,
      strongPositive: strongPositive.sort((a, b) => b.correlation - a.correlation),
      strongNegative: strongNegative.sort((a, b) => a.correlation - b.correlation)
    };
    
    return {
      success: true,
      timestamp: new Date(),
      data: result,
      tradingInsight: strongNegative.length > 0 
        ? `Consider hedging: ${strongNegative[0].pair.join('/')} shows negative correlation`
        : 'Most assets are positively correlated - diversify carefully'
    };
  });

  // Get relative strength comparison
  fastify.get('/api/heatmap/strength/:symbol', async (request: FastifyRequest, reply: FastifyReply) => {
    const { symbol } = request.params as { symbol: string };
    const { vs = 'BTC' } = request.query as { vs?: string };
    
    const asset = mockAssets.find(a => a.symbol === symbol.toUpperCase());
    const benchmark = mockAssets.find(a => a.symbol === vs.toUpperCase());
    
    if (!asset || !benchmark) {
      return reply.status(404).send({ error: 'Asset not found' });
    }
    
    const relativePerformance = {
      symbol: asset.symbol,
      vs: benchmark.symbol,
      ratio: Math.round((asset.price / benchmark.price) * 100000) / 100000,
      relativeChange24h: Math.round((asset.change24h - benchmark.change24h) * 100) / 100,
      relativeChange7d: Math.round((asset.change7d - benchmark.change7d) * 100) / 100,
      relativeChange30d: Math.round((asset.change30d - benchmark.change30d) * 100) / 100,
      outperforming: asset.change24h > benchmark.change24h,
      strengthScore: asset.relativeStrength - benchmark.relativeStrength
    };
    
    return {
      success: true,
      timestamp: new Date(),
      data: relativePerformance,
      signal: relativePerformance.strengthScore > 10 ? 'Strong outperformance' :
              relativePerformance.strengthScore > 0 ? 'Slight outperformance' :
              relativePerformance.strengthScore > -10 ? 'Slight underperformance' :
              'Strong underperformance'
    };
  });

  // Get trending assets
  fastify.get('/api/heatmap/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    const { limit = 10 } = request.query as { limit?: number };
    
    // Score by combination of price change, volume, and heat score
    const trending = [...mockAssets]
      .map(a => ({
        ...a,
        trendScore: a.heatScore * 0.4 + (a.volume24h / 1000000000) * 30 + a.change24h * 2
      }))
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
    
    return {
      success: true,
      timestamp: new Date(),
      trending: trending.map((a, i) => ({
        rank: i + 1,
        ...a,
        color: getHeatColor(a.heatScore)
      }))
    };
  });

  // Get movers (gainers/losers)
  fastify.get('/api/heatmap/movers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { timeframe = '24h', limit = 5 } = request.query as { timeframe?: string; limit?: number };
    
    const changeKey = timeframe === '1h' ? 'change1h' : 
                      timeframe === '7d' ? 'change7d' : 
                      timeframe === '30d' ? 'change30d' : 'change24h';
    
    const sorted = [...mockAssets].sort((a, b) => (b as any)[changeKey] - (a as any)[changeKey]);
    
    return {
      success: true,
      timestamp: new Date(),
      timeframe,
      gainers: sorted.slice(0, limit).map(a => ({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        change: (a as any)[changeKey],
        color: getHeatColor(a.heatScore)
      })),
      losers: sorted.slice(-limit).reverse().map(a => ({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        change: (a as any)[changeKey],
        color: getHeatColor(a.heatScore)
      }))
    };
  });
}

export const skillInfo = {
  id: 'crypto-heat-map',
  name: 'Crypto Heat Map',
  version: '1.0.0',
  description: 'Visual market analysis with sector heat maps, correlations, and relative strength',
  author: 'K.I.T. Finance Research',
  category: 'analysis',
  keywords: ['heatmap', 'crypto', 'sectors', 'correlation', 'strength', 'market'],
  endpoints: [
    'GET /api/heatmap',
    'GET /api/heatmap/sectors',
    'GET /api/heatmap/overview',
    'GET /api/heatmap/correlation',
    'GET /api/heatmap/strength/:symbol',
    'GET /api/heatmap/trending',
    'GET /api/heatmap/movers'
  ]
};
