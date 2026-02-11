/**
 * Smart Order Router (SOR) Skill
 * 
 * Optimizes trade execution by routing orders across multiple venues
 * to achieve best price, lowest fees, and minimal slippage.
 */

import type { SkillHandler, SkillContext, SkillResult } from '../../src/skills/types';

// ============================================================================
// Types
// ============================================================================

interface Venue {
  id: string;
  name: string;
  type: 'cex' | 'dex';
  price: number;
  available: number;
  fee: number;
  latency: number;
}

interface RouteSegment {
  venue: Venue;
  amount: number;
  price: number;
  fee: number;
  estimatedFill: number;
}

interface ExecutionPlan {
  strategy: 'best-price' | 'split' | 'twap' | 'vwap' | 'iceberg' | 'sniper';
  segments: RouteSegment[];
  totalAmount: number;
  avgPrice: number;
  totalFees: number;
  estimatedSavings: number;
  estimatedSlippage: number;
}

type ExecutionStrategy = ExecutionPlan['strategy'];

// ============================================================================
// Mock Data (replace with real API calls)
// ============================================================================

function getVenueQuotes(asset: string, side: 'buy' | 'sell', amount: number): Venue[] {
  // Mock venue data - in production, fetch from actual APIs
  const basePrice = asset === 'ETH' ? 2485 : asset === 'BTC' ? 97500 : 100;
  const spread = basePrice * 0.001; // 0.1% spread
  
  return [
    { id: 'binance', name: 'Binance', type: 'cex', price: basePrice + (side === 'buy' ? spread : -spread) * 0.5, available: amount * 5, fee: 0.001, latency: 50 },
    { id: 'coinbase', name: 'Coinbase', type: 'cex', price: basePrice + (side === 'buy' ? spread : -spread) * 0.8, available: amount * 3, fee: 0.002, latency: 80 },
    { id: 'kraken', name: 'Kraken', type: 'cex', price: basePrice + (side === 'buy' ? spread : -spread) * 0.6, available: amount * 2, fee: 0.0016, latency: 100 },
    { id: '1inch', name: '1inch', type: 'dex', price: basePrice + (side === 'buy' ? spread : -spread) * 0.3, available: amount * 10, fee: 0.003, latency: 30 },
    { id: 'uniswap', name: 'Uniswap', type: 'dex', price: basePrice + (side === 'buy' ? spread : -spread) * 0.4, available: amount * 8, fee: 0.003, latency: 25 },
  ];
}

// ============================================================================
// Routing Logic
// ============================================================================

function createExecutionPlan(
  asset: string,
  side: 'buy' | 'sell',
  amount: number,
  strategy: ExecutionStrategy,
  options: { maxSlippage?: number; preferredVenues?: string[] } = {}
): ExecutionPlan {
  const venues = getVenueQuotes(asset, side, amount);
  
  // Sort by price (ascending for buy, descending for sell)
  const sortedVenues = [...venues].sort((a, b) => 
    side === 'buy' ? a.price - b.price : b.price - a.price
  );
  
  const segments: RouteSegment[] = [];
  let remaining = amount;
  
  switch (strategy) {
    case 'best-price':
      // Route everything to best venue
      const best = sortedVenues[0];
      segments.push({
        venue: best,
        amount,
        price: best.price,
        fee: amount * best.price * best.fee,
        estimatedFill: 1,
      });
      break;
      
    case 'split':
      // Distribute across top 3 venues
      for (const venue of sortedVenues.slice(0, 3)) {
        if (remaining <= 0) break;
        const alloc = Math.min(remaining, amount / 3);
        segments.push({
          venue,
          amount: alloc,
          price: venue.price,
          fee: alloc * venue.price * venue.fee,
          estimatedFill: 0.99,
        });
        remaining -= alloc;
      }
      break;
      
    case 'twap':
    case 'vwap':
      // Split into 5 time slices, best venue each
      const sliceAmount = amount / 5;
      for (let i = 0; i < 5; i++) {
        const venue = sortedVenues[i % sortedVenues.length];
        segments.push({
          venue,
          amount: sliceAmount,
          price: venue.price * (1 + (Math.random() - 0.5) * 0.001), // Price variance
          fee: sliceAmount * venue.price * venue.fee,
          estimatedFill: 0.98,
        });
      }
      break;
      
    case 'iceberg':
      // 10 small chunks to hide size
      const chunkAmount = amount / 10;
      for (let i = 0; i < 10; i++) {
        const venue = sortedVenues[Math.floor(Math.random() * 3)];
        segments.push({
          venue,
          amount: chunkAmount,
          price: venue.price,
          fee: chunkAmount * venue.price * venue.fee,
          estimatedFill: 0.95,
        });
      }
      break;
      
    case 'sniper':
      // Fastest venues only
      const fastestVenues = [...venues].sort((a, b) => a.latency - b.latency).slice(0, 2);
      for (const venue of fastestVenues) {
        if (remaining <= 0) break;
        const alloc = Math.min(remaining, amount / 2);
        segments.push({
          venue,
          amount: alloc,
          price: venue.price,
          fee: alloc * venue.price * venue.fee,
          estimatedFill: 0.97,
        });
        remaining -= alloc;
      }
      break;
  }
  
  // Calculate totals
  const totalAmount = segments.reduce((sum, s) => sum + s.amount, 0);
  const avgPrice = segments.reduce((sum, s) => sum + s.amount * s.price, 0) / totalAmount;
  const totalFees = segments.reduce((sum, s) => sum + s.fee, 0);
  
  // Estimate savings vs worst venue
  const worstPrice = sortedVenues[sortedVenues.length - 1].price;
  const estimatedSavings = Math.abs(avgPrice - worstPrice) * totalAmount;
  
  return {
    strategy,
    segments,
    totalAmount,
    avgPrice,
    totalFees,
    estimatedSavings,
    estimatedSlippage: 0.001, // 0.1% estimated
  };
}

// ============================================================================
// Skill Handler
// ============================================================================

const handler: SkillHandler = async (context: SkillContext): Promise<SkillResult> => {
  const { message, config } = context;
  
  // Parse message for order details
  const buyMatch = message.match(/(?:buy|purchase|acquire)\s+(\d+(?:\.\d+)?)\s+(\w+)/i);
  const sellMatch = message.match(/(?:sell|offload)\s+(\d+(?:\.\d+)?)\s+(\w+)/i);
  const swapMatch = message.match(/swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for)\s+(\w+)/i);
  
  let side: 'buy' | 'sell' = 'buy';
  let amount = 1;
  let asset = 'ETH';
  
  if (buyMatch) {
    amount = parseFloat(buyMatch[1]);
    asset = buyMatch[2].toUpperCase();
    side = 'buy';
  } else if (sellMatch) {
    amount = parseFloat(sellMatch[1]);
    asset = sellMatch[2].toUpperCase();
    side = 'sell';
  } else if (swapMatch) {
    amount = parseFloat(swapMatch[1]);
    asset = swapMatch[3].toUpperCase(); // Target asset
    side = 'buy';
  }
  
  // Determine strategy
  let strategy: ExecutionStrategy = 'best-price';
  if (message.toLowerCase().includes('twap')) strategy = 'twap';
  else if (message.toLowerCase().includes('vwap')) strategy = 'vwap';
  else if (message.toLowerCase().includes('iceberg')) strategy = 'iceberg';
  else if (message.toLowerCase().includes('sniper') || message.toLowerCase().includes('fast')) strategy = 'sniper';
  else if (amount * (asset === 'BTC' ? 97500 : asset === 'ETH' ? 2485 : 100) > 10000) strategy = 'split';
  
  // Create execution plan
  const plan = createExecutionPlan(asset, side, amount, strategy);
  
  // Format response
  const segmentLines = plan.segments.map((s, i) => {
    const icon = s.venue.type === 'cex' ? '🏛️' : '🔗';
    return `${i === plan.segments.length - 1 ? '└──' : '├──'} ${icon} ${s.venue.name}: ${s.amount.toFixed(4)} ${asset} @ $${s.price.toFixed(2)} (fee: $${s.fee.toFixed(2)})`;
  }).join('\n');
  
  const savingsEmoji = plan.estimatedSavings > 0 ? '💰' : '';
  
  const response = `📊 **Smart Order Router**
━━━━━━━━━━━━━━━━━━━━━━━━
**Order:** ${side.toUpperCase()} ${amount} ${asset}
**Strategy:** ${strategy.toUpperCase()}

**Execution Plan:**
${segmentLines}

**Summary:**
• Avg Price: $${plan.avgPrice.toFixed(2)}
• Total Fees: $${plan.totalFees.toFixed(2)}
• Est. Slippage: ${(plan.estimatedSlippage * 100).toFixed(2)}%
${plan.estimatedSavings > 0 ? `• ${savingsEmoji} Savings: $${plan.estimatedSavings.toFixed(2)}` : ''}

_Ready to execute? Reply "confirm" to proceed._`;
  
  return {
    success: true,
    message: response,
    data: {
      plan,
      requiresConfirmation: true,
    },
  };
};

export default handler;
