/**
 * Risk Analytics API Routes (Fastify Plugin)
 * Portfolio risk metrics and analysis
 */

import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { riskAnalyticsService } from '../services/risk-analytics.service.ts';

export async function riskAnalyticsRoutes(fastify: FastifyInstance, opts: FastifyPluginOptions) {
  // Get full risk metrics
  fastify.get('/metrics', {
    schema: {
      description: 'Calculate comprehensive risk metrics for an agent',
      tags: ['Risk Analytics'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          period: { type: 'number', default: 30 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalReturn: { type: 'number' },
            sharpeRatio: { type: 'number' },
            sortinoRatio: { type: 'number' },
            maxDrawdown: { type: 'number' },
            var95: { type: 'number' },
            var99: { type: 'number' },
            winRate: { type: 'number' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = (request.headers['x-agent-id'] as string) || (request.query as any).agentId;
    if (!agentId) {
      return reply.code(400).send({ error: 'Agent ID required' });
    }
    
    const period = (request.query as any).period || 30;
    const metrics = await riskAnalyticsService.calculateRiskMetrics(agentId, period);
    return metrics;
  });

  // Get risk summary with grade
  fastify.get('/summary', {
    schema: {
      description: 'Get risk summary with grade (A-F) and warnings',
      tags: ['Risk Analytics'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = (request.headers['x-agent-id'] as string) || (request.query as any).agentId;
    if (!agentId) {
      return reply.code(400).send({ error: 'Agent ID required' });
    }
    
    const summary = await riskAnalyticsService.getRiskSummary(agentId);
    return summary;
  });

  // Get equity curve
  fastify.get('/equity', {
    schema: {
      description: 'Get equity curve snapshots for an agent',
      tags: ['Risk Analytics'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          period: { type: 'number', default: 30 }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = (request.headers['x-agent-id'] as string) || (request.query as any).agentId;
    if (!agentId) {
      return reply.code(400).send({ error: 'Agent ID required' });
    }
    
    const period = (request.query as any).period || 30;
    const snapshots = await riskAnalyticsService.getEquitySnapshots(agentId, period);
    return { snapshots };
  });

  // Analyze position risk
  fastify.post('/positions', {
    schema: {
      description: 'Analyze risk for open positions',
      tags: ['Risk Analytics'],
      body: {
        type: 'object',
        required: ['positions'],
        properties: {
          positions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                asset: { type: 'string' },
                direction: { type: 'string', enum: ['long', 'short'] },
                size: { type: 'number' },
                entryPrice: { type: 'number' },
                currentPrice: { type: 'number' },
                stopLoss: { type: 'number' },
                takeProfit: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { positions } = request.body as any;
    const analysis = await riskAnalyticsService.analyzePositionRisk(agentId, positions);
    return { positions: analysis };
  });

  // Store portfolio snapshot
  fastify.post('/snapshot', {
    schema: {
      description: 'Store a daily portfolio snapshot',
      tags: ['Risk Analytics'],
      body: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          equity: { type: 'number' },
          dailyPnl: { type: 'number' },
          dailyReturn: { type: 'number' },
          drawdown: { type: 'number' },
          trades: { type: 'number' },
          cumulativePnl: { type: 'number' }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const body = request.body as any;
    await riskAnalyticsService.storeSnapshot({
      agentId,
      date: body.date || new Date().toISOString().split('T')[0],
      equity: body.equity || 0,
      dailyPnl: body.dailyPnl || 0,
      dailyReturn: body.dailyReturn || 0,
      drawdown: body.drawdown || 0,
      trades: body.trades || 0,
      cumulativePnl: body.cumulativePnl || 0
    });
    
    return reply.code(201).send({ success: true });
  });

  // Compare risk metrics between agents
  fastify.get('/compare', {
    schema: {
      description: 'Compare risk metrics between multiple agents',
      tags: ['Risk Analytics'],
      querystring: {
        type: 'object',
        required: ['agents'],
        properties: {
          agents: { type: 'string', description: 'Comma-separated agent IDs' },
          period: { type: 'number', default: 30 }
        }
      }
    }
  }, async (request, reply) => {
    const { agents, period } = request.query as any;
    const agentIds = agents?.split(',');
    
    if (!agentIds || agentIds.length < 2) {
      return reply.code(400).send({ error: 'At least 2 agent IDs required (comma-separated)' });
    }
    
    const comparisons = await Promise.all(
      agentIds.map(async (agentId: string) => ({
        agentId: agentId.trim(),
        metrics: await riskAnalyticsService.calculateRiskMetrics(agentId.trim(), period || 30)
      }))
    );
    
    return { comparisons };
  });

  // Get VaR analysis
  fastify.get('/var', {
    schema: {
      description: 'Get Value at Risk (VaR) analysis with interpretation',
      tags: ['Risk Analytics'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          period: { type: 'number', default: 30 }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = (request.headers['x-agent-id'] as string) || (request.query as any).agentId;
    if (!agentId) {
      return reply.code(400).send({ error: 'Agent ID required' });
    }
    
    const period = (request.query as any).period || 30;
    const metrics = await riskAnalyticsService.calculateRiskMetrics(agentId, period);
    
    return {
      var95: metrics.var95,
      var99: metrics.var99,
      cvar95: metrics.cvar95,
      cvar99: metrics.cvar99,
      interpretation: {
        var95_desc: `With 95% confidence, daily loss won't exceed ${Math.abs(metrics.var95).toFixed(2)}%`,
        var99_desc: `With 99% confidence, daily loss won't exceed ${Math.abs(metrics.var99).toFixed(2)}%`,
        cvar95_desc: `Expected loss in worst 5% scenarios: ${Math.abs(metrics.cvar95).toFixed(2)}%`,
        cvar99_desc: `Expected loss in worst 1% scenarios: ${Math.abs(metrics.cvar99).toFixed(2)}%`
      }
    };
  });

  // Get drawdown analysis
  fastify.get('/drawdowns', {
    schema: {
      description: 'Get detailed drawdown analysis with historical periods',
      tags: ['Risk Analytics'],
      querystring: {
        type: 'object',
        properties: {
          agentId: { type: 'string' },
          period: { type: 'number', default: 90 }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = (request.headers['x-agent-id'] as string) || (request.query as any).agentId;
    if (!agentId) {
      return reply.code(400).send({ error: 'Agent ID required' });
    }
    
    const summary = await riskAnalyticsService.getRiskSummary(agentId);
    
    return {
      maxDrawdown: summary.metrics.maxDrawdown,
      maxDrawdownDuration: summary.metrics.maxDrawdownDuration,
      currentDrawdown: summary.metrics.currentDrawdown,
      avgDrawdown: summary.metrics.avgDrawdown,
      recoveryFactor: summary.metrics.recoveryFactor,
      drawdownPeriods: summary.drawdowns
    };
  });

  // Monte Carlo simulation
  fastify.post('/monte-carlo', {
    schema: {
      description: 'Run Monte Carlo simulation for future projections',
      tags: ['Risk Analytics'],
      body: {
        type: 'object',
        properties: {
          simulations: { type: 'number', default: 1000 },
          days: { type: 'number', default: 30 },
          initialEquity: { type: 'number', default: 10000 }
        }
      }
    }
  }, async (request, reply) => {
    const agentId = request.headers['x-agent-id'] as string;
    if (!agentId) {
      return reply.code(401).send({ error: 'Agent ID required' });
    }
    
    const { simulations = 1000, days = 30, initialEquity = 10000 } = request.body as any;
    
    // Get historical returns
    const metrics = await riskAnalyticsService.calculateRiskMetrics(agentId, 60);
    const avgReturn = metrics.avgDailyReturn / 100;
    const volatility = metrics.volatility / 100;
    
    // Run simulations
    const results: number[] = [];
    for (let s = 0; s < simulations; s++) {
      let equity = initialEquity;
      for (let d = 0; d < days; d++) {
        // Random return from normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const dailyReturn = avgReturn + volatility * z;
        equity *= (1 + dailyReturn);
      }
      results.push(equity);
    }
    
    // Calculate percentiles
    results.sort((a, b) => a - b);
    const percentile = (p: number) => results[Math.floor((p / 100) * results.length)];
    
    return {
      simulations,
      days,
      initialEquity,
      projections: {
        worstCase: percentile(1),
        pessimistic: percentile(10),
        median: percentile(50),
        optimistic: percentile(90),
        bestCase: percentile(99)
      },
      probabilities: {
        profitProbability: (results.filter(r => r > initialEquity).length / simulations) * 100,
        doubleEquityProbability: (results.filter(r => r > initialEquity * 2).length / simulations) * 100,
        ruin50Probability: (results.filter(r => r < initialEquity * 0.5).length / simulations) * 100
      }
    };
  });
}
