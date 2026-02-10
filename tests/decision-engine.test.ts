import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionEngine, createDecisionEngine, PriceProvider } from '../src/brain/decision-engine';
import { Signal, Asset, UserGoal, MarketOpportunity } from '../src/brain/types';

// Mock price provider for testing
class MockPriceProvider implements PriceProvider {
  private prices: Record<string, number> = {
    'BTC/USDT': 95000,
    'ETH/USDT': 3200,
    'AAPL': 230,
    'EUR/USD': 1.04,
  };

  async getPrice(symbol: string, _market: string): Promise<number> {
    return this.prices[symbol] || 100;
  }

  setPrice(symbol: string, price: number): void {
    this.prices[symbol] = price;
  }
}

describe('DecisionEngine', () => {
  let engine: DecisionEngine;
  let mockPriceProvider: MockPriceProvider;

  beforeEach(() => {
    mockPriceProvider = new MockPriceProvider();
    engine = new DecisionEngine(
      { minConfidence: 60, maxRiskScore: 70, paperTrade: true, verbose: false },
      mockPriceProvider
    );
  });

  describe('Signal Analysis', () => {
    const btcAsset: Asset = {
      symbol: 'BTC/USDT',
      name: 'Bitcoin',
      market: 'crypto',
    };

    it('should create opportunity from bullish signals', () => {
      const signals: Signal[] = [
        { source: 'rsi', type: 'technical', direction: 'bullish', strength: 75, details: 'RSI oversold', timestamp: new Date() },
        { source: 'macd', type: 'technical', direction: 'bullish', strength: 70, details: 'MACD crossover', timestamp: new Date() },
      ];

      const opportunity = engine.analyzeSignals(signals, btcAsset);

      expect(opportunity).not.toBeNull();
      expect(opportunity?.action).toBe('buy');
      expect(opportunity?.confidence).toBeDefined();
      expect(opportunity?.asset.symbol).toBe('BTC/USDT');
    });

    it('should create opportunity from bearish signals', () => {
      const signals: Signal[] = [
        { source: 'rsi', type: 'technical', direction: 'bearish', strength: 80, details: 'RSI overbought', timestamp: new Date() },
        { source: 'macd', type: 'technical', direction: 'bearish', strength: 75, details: 'MACD crossunder', timestamp: new Date() },
      ];

      const opportunity = engine.analyzeSignals(signals, btcAsset);

      expect(opportunity).not.toBeNull();
      expect(opportunity?.action).toBe('sell');
    });

    it('should return null for mixed/weak signals', () => {
      const signals: Signal[] = [
        { source: 'rsi', type: 'technical', direction: 'bullish', strength: 55, details: 'Weak', timestamp: new Date() },
        { source: 'macd', type: 'technical', direction: 'bearish', strength: 55, details: 'Weak', timestamp: new Date() },
      ];

      const opportunity = engine.analyzeSignals(signals, btcAsset);

      expect(opportunity).toBeNull();
    });

    it('should return null for empty signals', () => {
      const opportunity = engine.analyzeSignals([], btcAsset);
      expect(opportunity).toBeNull();
    });
  });

  describe('Yield Opportunities', () => {
    const ethAsset: Asset = {
      symbol: 'ETH',
      name: 'Ethereum',
      market: 'defi',
      chain: 'ethereum',
    };

    it('should create yield opportunity', () => {
      const opportunity = engine.createYieldOpportunity(
        'Aave',
        ethAsset,
        5.5,
        500_000_000,
        []
      );

      expect(opportunity).toBeDefined();
      expect(opportunity.type).toBe('yield');
      expect(opportunity.action).toBe('stake');
      expect(opportunity.expectedReturnPercent).toBe(5.5);
    });

    it('should increase risk score for high APY', () => {
      const lowApyOpp = engine.createYieldOpportunity('Aave', ethAsset, 5, 100_000_000, []);
      const highApyOpp = engine.createYieldOpportunity('RiskyDeFi', ethAsset, 100, 100_000_000, []);

      expect(highApyOpp.riskScore).toBeGreaterThan(lowApyOpp.riskScore);
    });

    it('should increase risk score for low TVL', () => {
      const highTvlOpp = engine.createYieldOpportunity('Aave', ethAsset, 5, 1_000_000_000, []);
      const lowTvlOpp = engine.createYieldOpportunity('SmallProtocol', ethAsset, 5, 500_000, []);

      expect(lowTvlOpp.riskScore).toBeGreaterThan(highTvlOpp.riskScore);
    });
  });

  describe('Decision Making', () => {
    let opportunityId: string;

    beforeEach(() => {
      const signals: Signal[] = [
        { source: 'rsi', type: 'technical', direction: 'bullish', strength: 85, details: 'Strong buy', timestamp: new Date() },
        { source: 'macd', type: 'technical', direction: 'bullish', strength: 80, details: 'Bullish', timestamp: new Date() },
      ];

      const btcAsset: Asset = { symbol: 'BTC/USDT', name: 'Bitcoin', market: 'crypto' };
      const opportunity = engine.analyzeSignals(signals, btcAsset);
      opportunityId = opportunity!.id;
    });

    it('should make decision on opportunity', async () => {
      const decision = await engine.makeDecision(opportunityId, 1, 10000);

      expect(decision).not.toBeNull();
      expect(decision?.opportunityId).toBe(opportunityId);
      expect(decision?.status).toBeDefined();
    });

    it('should require approval at autonomy level 1', async () => {
      const decision = await engine.makeDecision(opportunityId, 1, 10000);

      expect(decision?.requiresApproval).toBe(true);
      expect(decision?.status).toBe('pending');
    });

    it('should calculate proper position size', async () => {
      const decision = await engine.makeDecision(opportunityId, 1, 10000);

      expect(decision?.action.amount).toBeGreaterThan(0);
      expect(decision?.action.price).toBe(95000); // Mock BTC price
    });

    it('should return null for non-existent opportunity', async () => {
      const decision = await engine.makeDecision('non-existent-id', 1, 10000);
      expect(decision).toBeNull();
    });
  });

  describe('Goal-based Risk Management', () => {
    it('should respect low risk tolerance', async () => {
      const lowRiskGoal: UserGoal = {
        id: 'goal-1',
        type: 'preservation',
        riskTolerance: 'low',
        timeHorizon: 'long',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.setGoals([lowRiskGoal]);

      // Create a high-risk opportunity
      const riskySignals: Signal[] = [
        { source: 'momentum', type: 'technical', direction: 'bullish', strength: 90, details: 'High momentum', timestamp: new Date() },
      ];
      
      const riskyAsset: Asset = { symbol: 'MEME', name: 'MemeCoin', market: 'crypto' };
      const opportunity = engine.analyzeSignals(riskySignals, riskyAsset);
      
      if (opportunity) {
        const decision = await engine.makeDecision(opportunity.id, 2, 10000);
        // High risk opportunity with low risk tolerance should fail risk check
        expect(decision?.riskCheckPassed).toBe(false);
      }
    });

    it('should allow high risk at high tolerance', async () => {
      const highRiskGoal: UserGoal = {
        id: 'goal-2',
        type: 'aggressive',
        riskTolerance: 'very-high',
        timeHorizon: 'short',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.setGoals([highRiskGoal]);

      const signals: Signal[] = [
        { source: 'trend', type: 'technical', direction: 'bullish', strength: 80, details: 'Uptrend', timestamp: new Date() },
      ];
      
      const btcAsset: Asset = { symbol: 'BTC/USDT', name: 'Bitcoin', market: 'crypto' };
      const opportunity = engine.analyzeSignals(signals, btcAsset);
      
      if (opportunity) {
        const decision = await engine.makeDecision(opportunity.id, 2, 10000);
        // Normal opportunity with high risk tolerance should pass
        expect(decision?.riskCheckPassed).toBe(true);
      }
    });
  });

  describe('Decision Approval/Rejection', () => {
    let opportunityId: string;

    beforeEach(() => {
      const signals: Signal[] = [
        { source: 'test', type: 'technical', direction: 'bullish', strength: 75, details: 'Test', timestamp: new Date() },
      ];
      const asset: Asset = { symbol: 'ETH/USDT', name: 'Ethereum', market: 'crypto' };
      const opportunity = engine.analyzeSignals(signals, asset);
      opportunityId = opportunity!.id;
    });

    it('should approve pending decision', async () => {
      const decision = await engine.makeDecision(opportunityId, 1, 10000);
      expect(decision?.status).toBe('pending');

      const approved = engine.approveDecision(decision!.id);
      expect(approved?.approved).toBe(true);
      expect(approved?.status).toBe('approved');
      expect(approved?.approvedAt).toBeDefined();
    });

    it('should reject pending decision', async () => {
      const decision = await engine.makeDecision(opportunityId, 1, 10000);
      
      const rejected = engine.rejectDecision(decision!.id);
      expect(rejected?.approved).toBe(false);
      expect(rejected?.status).toBe('rejected');
    });

    it('should return null for non-existent decision', () => {
      const result = engine.approveDecision('non-existent');
      expect(result).toBeNull();
    });
  });

  describe('createDecisionEngine factory', () => {
    it('should create engine with default config', () => {
      const engine = createDecisionEngine();
      expect(engine).toBeInstanceOf(DecisionEngine);
    });

    it('should create engine with custom config', () => {
      const engine = createDecisionEngine({ minConfidence: 80 });
      expect(engine).toBeInstanceOf(DecisionEngine);
    });
  });
});
