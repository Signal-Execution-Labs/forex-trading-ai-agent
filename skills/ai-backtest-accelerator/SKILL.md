# AI Backtest Accelerator

> LuxAlgo-inspired AI platform that accelerates trading strategy development

## Overview

Combines AI-powered strategy analysis with high-speed backtesting to rapidly iterate on trading ideas. Test hundreds of parameter combinations in minutes, with AI suggesting optimizations.

## Features

### Speed Optimization
- **Parallel Execution:** Test multiple param sets simultaneously
- **GPU Acceleration:** Optional CUDA support for complex calcs
- **Incremental Updates:** Only recalculate changed portions
- **Cached Indicators:** Pre-compute common indicators

### AI-Powered Analysis
- **Strategy Critique:** AI reviews your strategy logic
- **Parameter Suggestions:** AI recommends optimal ranges
- **Pattern Recognition:** Find similar historical setups
- **Risk Assessment:** AI evaluates strategy risk profile

### Multi-Factor Testing
- **Walk-Forward:** Rolling window validation
- **Monte Carlo:** Randomized trade ordering
- **Stress Testing:** Test against flash crashes, gaps
- **Regime Analysis:** Performance by market condition

### Optimization Algorithms
- **Grid Search:** Exhaustive parameter sweep
- **Genetic Algorithm:** Evolutionary optimization
- **Bayesian Optimization:** Smart parameter exploration
- **Random Forest:** Feature importance for params

## Usage

```typescript
// Create accelerated backtest
const backtest = kit.backtest.accelerate({
  strategy: 'momentum_cross',
  symbol: 'BTCUSD',
  timeframe: '1h',
  period: { start: '2024-01-01', end: '2025-12-31' },
  params: {
    fastMA: { min: 5, max: 50, step: 5 },
    slowMA: { min: 20, max: 200, step: 10 },
    stopLoss: { min: 0.5, max: 3, step: 0.5 }
  },
  optimization: 'genetic',
  aiCritique: true
});

// Run with progress callback
const results = await backtest.run((progress) => {
  console.log(`${progress.tested}/${progress.total} combinations tested`);
});

// Get AI analysis
const analysis = await results.getAIAnalysis();
console.log(analysis.suggestions);
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/backtest/accelerate | Start accelerated backtest |
| GET | /api/backtest/:id/progress | Check progress |
| GET | /api/backtest/:id/results | Get results |
| POST | /api/backtest/:id/analyze | Get AI analysis |
| POST | /api/backtest/compare | Compare multiple strategies |

## Performance Metrics

| Metric | Description |
|--------|-------------|
| Sharpe Ratio | Risk-adjusted returns |
| Sortino Ratio | Downside risk-adjusted |
| Calmar Ratio | Return vs max drawdown |
| Profit Factor | Gross profit / gross loss |
| Win Rate | Percentage of winning trades |
| Max Drawdown | Largest peak-to-trough decline |
| Recovery Factor | Net profit / max drawdown |
| Expectancy | Average profit per trade |

## Inspired By

LuxAlgo's AI backtesting platform that accelerates trading strategy development through intelligent optimization.
