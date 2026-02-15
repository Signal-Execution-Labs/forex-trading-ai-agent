/**
 * Portfolio Rebalancer - Automated Portfolio Rebalancing
 * Inspired by Wealthfront, Betterment, and 3Commas SmartPortfolio
 * 
 * Features:
 * - Target allocation setting
 * - Threshold-based rebalancing
 * - Calendar-based rebalancing
 * - Tax-loss harvesting
 * - Dollar-cost averaging integration
 * - Multi-asset class support
 * - Drift analysis and alerts
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

// ============================================================================
// Types
// ============================================================================

interface Portfolio {
  id: string;
  userId: string;
  name: string;
  description?: string;
  assets: PortfolioAsset[];
  targetAllocations: TargetAllocation[];
  rebalanceSettings: RebalanceSettings;
  taxSettings?: TaxSettings;
  dcaSettings?: DCASettings;
  performance: PortfolioPerformance;
  lastRebalance?: Date;
  status: 'active' | 'paused' | 'rebalancing';
  createdAt: Date;
  updatedAt: Date;
}

interface PortfolioAsset {
  symbol: string;
  name: string;
  assetClass: string;
  quantity: number;
  avgCostBasis: number;
  currentPrice: number;
  currentValue: number;
  currentPercent: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  holdingPeriod: 'short' | 'long';
  acquiredAt: Date;
}

interface TargetAllocation {
  assetClass?: string;
  symbol?: string;
  targetPercent: number;
  minPercent?: number;
  maxPercent?: number;
  locked?: boolean;
}

interface RebalanceSettings {
  strategy: 'threshold' | 'calendar' | 'hybrid' | 'cash_flow' | 'tactical' | 'tax_optimized';
  thresholdPercent?: number;
  calendarFrequency?: 'weekly' | 'monthly' | 'quarterly' | 'annually';
  minTradeValue?: number;
  considerFees: boolean;
  considerTaxes: boolean;
  executionMode: 'immediate' | 'scheduled' | 'approval_required';
  smartRouting: boolean;
}

interface TaxSettings {
  enabled: boolean;
  taxBracket: number;
  shortTermRate: number;
  longTermRate: number;
  harvestLosses: boolean;
  washSaleAvoidance: boolean;
}

interface DCASettings {
  enabled: boolean;
  amount: number;
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  useForRebalancing: boolean;
}

interface PortfolioPerformance {
  totalValue: number;
  totalCost: number;
  totalPnL: number;
  totalPnLPercent: number;
  dailyChange: number;
  dailyChangePercent: number;
  allTimeHigh: number;
  drawdownFromATH: number;
}

interface RebalanceExecution {
  id: string;
  portfolioId: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  trades: Array<{ symbol: string; side: string; quantity: number; value: number; fee: number; status: string }>;
  totalValue: number;
  totalFees: number;
  startedAt: Date;
  completedAt?: Date;
}

// Mock data stores
const portfolios: Map<string, Portfolio> = new Map();
const rebalanceHistory: Map<string, RebalanceExecution[]> = new Map();

// ============================================================================
// Route Registration
// ============================================================================

export async function portfolioRebalancerRoutes(fastify: FastifyInstance) {

  // Create portfolio
  fastify.post('/portfolios', {
    schema: {
      description: 'Create a new rebalancing portfolio',
      tags: ['Portfolio Rebalancer'],
      body: {
        type: 'object',
        required: ['name', 'targetAllocations'],
        properties: {
          name: { type: 'string', maxLength: 100 },
          description: { type: 'string' },
          targetAllocations: { type: 'array', items: { type: 'object' } },
          rebalanceSettings: { type: 'object' },
          taxSettings: { type: 'object' },
          dcaSettings: { type: 'object' }
        }
      }
    }
  }, async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { name, description, targetAllocations, rebalanceSettings, taxSettings, dcaSettings } = request.body;
    
    const totalAllocation = targetAllocations.reduce((sum: number, a: TargetAllocation) => sum + a.targetPercent, 0);
    if (Math.abs(totalAllocation - 100) > 0.1) {
      return reply.code(400).send({ error: `Allocations must sum to 100%, got ${totalAllocation}%` });
    }
    
    const portfolio: Portfolio = {
      id: `pf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: 'user_1',
      name,
      description,
      assets: [],
      targetAllocations,
      rebalanceSettings: rebalanceSettings || { strategy: 'threshold', thresholdPercent: 5, considerFees: true, considerTaxes: true, executionMode: 'approval_required', smartRouting: true },
      taxSettings,
      dcaSettings,
      performance: { totalValue: 0, totalCost: 0, totalPnL: 0, totalPnLPercent: 0, dailyChange: 0, dailyChangePercent: 0, allTimeHigh: 0, drawdownFromATH: 0 },
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    portfolios.set(portfolio.id, portfolio);
    return reply.code(201).send({ success: true, portfolio });
  });

  // List portfolios
  fastify.get('/portfolios', {
    schema: { description: 'List all rebalancing portfolios', tags: ['Portfolio Rebalancer'] }
  }, async () => {
    return { success: true, count: portfolios.size, portfolios: Array.from(portfolios.values()) };
  });

  // Get portfolio
  fastify.get('/portfolios/:id', {
    schema: { description: 'Get a specific portfolio', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    return { success: true, portfolio };
  });

  // Update portfolio
  fastify.put('/portfolios/:id', {
    schema: { description: 'Update portfolio settings', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    
    if (request.body.targetAllocations) {
      const total = request.body.targetAllocations.reduce((sum: number, a: TargetAllocation) => sum + a.targetPercent, 0);
      if (Math.abs(total - 100) > 0.1) return reply.code(400).send({ error: `Allocations must sum to 100%` });
    }
    
    Object.assign(portfolio, request.body, { updatedAt: new Date() });
    return { success: true, portfolio };
  });

  // Delete portfolio
  fastify.delete('/portfolios/:id', {
    schema: { description: 'Delete a portfolio', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    if (!portfolios.has(request.params.id)) return reply.code(404).send({ error: 'Portfolio not found' });
    portfolios.delete(request.params.id);
    return { success: true, message: 'Portfolio deleted' };
  });

  // Add assets
  fastify.post('/portfolios/:id/assets', {
    schema: {
      description: 'Add assets to portfolio',
      tags: ['Portfolio Rebalancer'],
      body: { type: 'object', properties: { assets: { type: 'array', items: { type: 'object' } } } }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { assets: any[] } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    
    for (const asset of request.body.assets) {
      const currentPrice = asset.currentPrice || getAssetPrice(asset.symbol);
      const currentValue = asset.quantity * currentPrice;
      
      const portfolioAsset: PortfolioAsset = {
        symbol: asset.symbol,
        name: asset.name || asset.symbol,
        assetClass: asset.assetClass || 'crypto_large_cap',
        quantity: asset.quantity,
        avgCostBasis: asset.avgCostBasis || currentPrice,
        currentPrice,
        currentValue,
        currentPercent: 0,
        unrealizedPnL: currentValue - (asset.quantity * (asset.avgCostBasis || currentPrice)),
        unrealizedPnLPercent: 0,
        holdingPeriod: 'short',
        acquiredAt: new Date(asset.acquiredAt || Date.now())
      };
      
      const existingIdx = portfolio.assets.findIndex(a => a.symbol === asset.symbol);
      if (existingIdx >= 0) portfolio.assets[existingIdx] = portfolioAsset;
      else portfolio.assets.push(portfolioAsset);
    }
    
    recalculatePortfolio(portfolio);
    return { success: true, portfolio };
  });

  // Analyze drift
  fastify.get('/portfolios/:id/drift', {
    schema: { description: 'Analyze portfolio drift from targets', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    return { success: true, analysis: analyzePortfolioDrift(portfolio) };
  });

  // Simulate rebalance
  fastify.post('/portfolios/:id/simulate', {
    schema: {
      description: 'Simulate a rebalance without executing',
      tags: ['Portfolio Rebalancer'],
      body: { type: 'object', properties: { additionalCash: { type: 'number', default: 0 } } }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { additionalCash?: number } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    
    const simulation = simulateRebalance(portfolio, request.body.additionalCash || 0);
    return { success: true, simulation };
  });

  // Execute rebalance
  fastify.post('/portfolios/:id/rebalance', {
    schema: {
      description: 'Execute a rebalance',
      tags: ['Portfolio Rebalancer'],
      body: { type: 'object', properties: { additionalCash: { type: 'number' }, confirm: { type: 'boolean' } } }
    }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: { additionalCash?: number; confirm?: boolean } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    
    const { additionalCash = 0, confirm = false } = request.body;
    const simulation = simulateRebalance(portfolio, additionalCash);
    
    if (!confirm) {
      return { success: true, message: 'Set confirm=true to execute', simulation };
    }
    
    const execution: RebalanceExecution = {
      id: `rb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      portfolioId: portfolio.id,
      status: 'executing',
      trades: simulation.trades.map(t => ({ symbol: t.symbol, side: t.side, quantity: t.quantity, value: t.estimatedValue, fee: t.estimatedValue * 0.001, status: 'pending' })),
      totalValue: simulation.trades.reduce((sum, t) => sum + t.estimatedValue, 0),
      totalFees: simulation.trades.reduce((sum, t) => sum + t.estimatedValue * 0.001, 0),
      startedAt: new Date()
    };
    
    const history = rebalanceHistory.get(portfolio.id) || [];
    history.push(execution);
    rebalanceHistory.set(portfolio.id, history);
    
    portfolio.lastRebalance = new Date();
    portfolio.status = 'rebalancing';
    
    // Simulate completion
    setTimeout(() => {
      execution.status = 'completed';
      execution.completedAt = new Date();
      portfolio.status = 'active';
    }, 2000);
    
    return { success: true, message: 'Rebalance started', execution };
  });

  // Get rebalance history
  fastify.get('/portfolios/:id/history', {
    schema: { description: 'Get rebalance history', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    return { success: true, history: rebalanceHistory.get(portfolio.id) || [] };
  });

  // Tax-loss harvesting
  fastify.get('/portfolios/:id/tax-loss-harvest', {
    schema: { description: 'Find tax-loss harvesting opportunities', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    
    const opportunities = portfolio.assets
      .filter(a => a.unrealizedPnL < 0)
      .map(a => ({
        symbol: a.symbol,
        unrealizedLoss: a.unrealizedPnL,
        currentValue: a.currentValue,
        taxSavings: Math.abs(a.unrealizedPnL) * 0.22,
        washSaleEndDate: new Date(Date.now() + 30 * 86400000),
        replacementOptions: getSimilarAssets(a.symbol)
      }));
    
    return {
      success: true,
      opportunities,
      summary: {
        totalHarvestable: opportunities.reduce((sum, o) => sum + Math.abs(o.unrealizedLoss), 0),
        totalTaxSavings: opportunities.reduce((sum, o) => sum + o.taxSavings, 0)
      }
    };
  });

  // Get templates
  fastify.get('/templates', {
    schema: { description: 'Get portfolio allocation templates', tags: ['Portfolio Rebalancer'] }
  }, async () => {
    return {
      success: true,
      templates: [
        { id: 'conservative', name: 'Conservative', riskLevel: 3, expectedReturn: '6-8%', allocations: [{ assetClass: 'crypto_large_cap', targetPercent: 20 }, { assetClass: 'crypto_stablecoin', targetPercent: 30 }, { assetClass: 'stocks_us_large', targetPercent: 30 }, { assetClass: 'bonds_govt', targetPercent: 20 }] },
        { id: 'balanced', name: 'Balanced', riskLevel: 5, expectedReturn: '10-15%', allocations: [{ assetClass: 'crypto_large_cap', targetPercent: 35 }, { assetClass: 'crypto_mid_cap', targetPercent: 15 }, { assetClass: 'stocks_us_large', targetPercent: 30 }, { assetClass: 'stocks_intl', targetPercent: 20 }] },
        { id: 'aggressive', name: 'Aggressive Growth', riskLevel: 8, expectedReturn: '20-40%', allocations: [{ assetClass: 'crypto_large_cap', targetPercent: 40 }, { assetClass: 'crypto_mid_cap', targetPercent: 25 }, { assetClass: 'crypto_defi', targetPercent: 15 }, { assetClass: 'stocks_emerging', targetPercent: 20 }] },
        { id: 'crypto_degen', name: 'Crypto Degen', riskLevel: 10, expectedReturn: '50%+ or -80%', allocations: [{ assetClass: 'crypto_large_cap', targetPercent: 50 }, { assetClass: 'crypto_mid_cap', targetPercent: 25 }, { assetClass: 'crypto_defi', targetPercent: 15 }, { assetClass: 'crypto_small_cap', targetPercent: 10 }] },
        { id: 'all_weather', name: 'All Weather', riskLevel: 4, expectedReturn: '8-12%', allocations: [{ assetClass: 'crypto_large_cap', targetPercent: 15 }, { assetClass: 'stocks_us_large', targetPercent: 30 }, { assetClass: 'bonds_govt', targetPercent: 30 }, { assetClass: 'commodities', targetPercent: 15 }, { assetClass: 'cash', targetPercent: 10 }] }
      ]
    };
  });

  // Configure DCA
  fastify.put('/portfolios/:id/dca', {
    schema: { description: 'Configure DCA for a portfolio', tags: ['Portfolio Rebalancer'] }
  }, async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const portfolio = portfolios.get(request.params.id);
    if (!portfolio) return reply.code(404).send({ error: 'Portfolio not found' });
    
    portfolio.dcaSettings = {
      enabled: request.body.enabled ?? true,
      amount: request.body.amount || 100,
      frequency: request.body.frequency || 'weekly',
      useForRebalancing: request.body.useForRebalancing ?? true
    };
    
    return { success: true, dcaSettings: portfolio.dcaSettings };
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAssetPrice(symbol: string): number {
  const prices: Record<string, number> = { BTC: 42500, ETH: 2850, SOL: 145, USDT: 1, USDC: 1, SPY: 485, GLD: 188 };
  return prices[symbol] || 100;
}

function recalculatePortfolio(portfolio: Portfolio): void {
  const totalValue = portfolio.assets.reduce((sum, a) => sum + a.currentValue, 0);
  portfolio.assets.forEach(a => {
    a.currentPercent = totalValue > 0 ? (a.currentValue / totalValue) * 100 : 0;
    a.unrealizedPnLPercent = a.avgCostBasis > 0 ? ((a.currentPrice - a.avgCostBasis) / a.avgCostBasis) * 100 : 0;
  });
  portfolio.performance.totalValue = totalValue;
  portfolio.performance.totalPnL = portfolio.assets.reduce((sum, a) => sum + a.unrealizedPnL, 0);
}

function analyzePortfolioDrift(portfolio: Portfolio) {
  const driftByAsset = portfolio.targetAllocations.map(target => {
    const asset = portfolio.assets.find(a => a.symbol === target.symbol || a.assetClass === target.assetClass);
    const currentPercent = asset?.currentPercent || 0;
    const driftPercent = currentPercent - target.targetPercent;
    return {
      symbol: target.symbol || target.assetClass || 'Unknown',
      targetPercent: target.targetPercent,
      currentPercent,
      driftPercent,
      driftDirection: driftPercent > 1 ? 'overweight' : driftPercent < -1 ? 'underweight' : 'on_target',
      valueToTrade: (driftPercent / 100) * portfolio.performance.totalValue
    };
  });
  
  const maxDrift = Math.max(...driftByAsset.map(d => Math.abs(d.driftPercent)));
  const threshold = portfolio.rebalanceSettings.thresholdPercent || 5;
  
  return {
    portfolioId: portfolio.id,
    analyzedAt: new Date(),
    maxDrift,
    driftByAsset,
    rebalanceRecommended: maxDrift >= threshold,
    estimatedTrades: driftByAsset.filter(d => Math.abs(d.driftPercent) > 1).map(d => ({
      symbol: d.symbol,
      side: d.driftDirection === 'overweight' ? 'sell' : 'buy',
      quantity: Math.abs(d.valueToTrade / getAssetPrice(d.symbol)),
      estimatedValue: Math.abs(d.valueToTrade),
      currentPercent: d.currentPercent,
      targetPercent: d.targetPercent,
      afterPercent: d.targetPercent
    }))
  };
}

function simulateRebalance(portfolio: Portfolio, additionalCash: number) {
  return analyzePortfolioDrift(portfolio);
}

function getSimilarAssets(symbol: string): string[] {
  const map: Record<string, string[]> = { BTC: ['WBTC', 'BTCB'], ETH: ['STETH', 'WETH'], SOL: ['AVAX', 'NEAR'] };
  return map[symbol] || [];
}
