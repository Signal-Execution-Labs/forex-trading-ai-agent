# Baseline Analysis

> Explore price movements relative to a selected baseline for fluctuation analysis

## Overview

Powerful tool to analyze how price moves relative to any baseline (price level, moving average, indicator value, or custom reference). Essential for understanding deviation patterns and mean reversion opportunities.

## Features

### Baseline Types
- **Fixed Price:** Set any price level as baseline
- **Moving Average:** SMA, EMA, WMA as dynamic baseline
- **VWAP:** Volume-weighted average price
- **Previous Close:** Daily/weekly/monthly close
- **Custom Formula:** Any indicator or calculation

### Analysis Modes
- **Deviation %:** How far price is from baseline
- **Standard Deviation:** Sigma bands from baseline
- **ATR Multiple:** Deviation in ATR units
- **Pip/Point:** Absolute distance measurement

### Visualization
- **Baseline Line:** Horizontal or dynamic line
- **Deviation Bands:** ±1σ, ±2σ, ±3σ zones
- **Heat Map:** Color intensity by deviation
- **Histogram:** Deviation over time

### Alerts
- **Cross Above/Below:** Baseline crossing alerts
- **Deviation Threshold:** Alert at X% deviation
- **Return to Baseline:** Mean reversion signals
- **Extended Move:** Prolonged deviation alerts

## Usage

```typescript
// Create baseline analysis
const analysis = kit.baseline.create({
  symbol: 'EURUSD',
  baseline: { type: 'ema', period: 200 },
  deviationMode: 'percentage',
  bands: [1, 2, 3]  // sigma levels
});

// Get current deviation
const deviation = await analysis.getCurrentDeviation();
console.log(`Price is ${deviation.percent}% from 200 EMA`);

// Set up mean reversion alert
kit.alerts.create({
  condition: 'baseline_return',
  symbol: 'EURUSD',
  baseline: 'ema200',
  threshold: 0.5  // within 0.5%
});
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/baseline/create | Create baseline analysis |
| GET | /api/baseline/:id/deviation | Get current deviation |
| GET | /api/baseline/:id/history | Historical deviation data |
| POST | /api/baseline/:id/alert | Create deviation alert |

## Trading Applications

1. **Mean Reversion:** Enter when price deviates >2σ from VWAP
2. **Trend Following:** Stay in trade while above baseline
3. **Range Trading:** Trade bounces off deviation bands
4. **Position Sizing:** Larger size near baseline, smaller at extremes

## Inspired By

TradingView's baseline analysis tool for exploring price movements relative to selected reference points.
