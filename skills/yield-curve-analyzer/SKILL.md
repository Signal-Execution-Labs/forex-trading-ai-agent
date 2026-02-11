# Yield Curve Analyzer

Monitor and analyze yield curves across 40+ global economies. Identify inversions, predict recessions, and find fixed income opportunities.

## Category
Analysis

## Inspired By
- TradingView Yield Curve
- FRED Economic Data
- Bloomberg Terminal
- Gurufocus Yield Curve

## Features

### Global Coverage
- **40+ Countries**: US, UK, Germany, Japan, China, Australia, etc.
- **Real-Time Updates**: Live yield data
- **Historical Data**: 20+ years of history
- **Multiple Tenors**: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y

### Yield Curve Analysis
- **Current Shape**: Normal, Flat, Inverted
- **Spread Analysis**: 2s10s, 3m10y spreads
- **Steepness**: Measure of curve slope
- **Convexity**: Curvature analysis
- **Term Premium**: Risk compensation

### Inversion Detection
- **Alert on Inversion**: 2s10s, 3m10y crossovers
- **Historical Inversions**: Past events and outcomes
- **Recession Indicator**: Lead time analysis
- **Uninversion Alert**: Signal when curve normalizes

### Comparison Tools
- **Cross-Country**: Compare US vs Germany vs Japan
- **Time Travel**: View any historical date
- **Animation**: Watch curve evolve over time
- **Spread Charts**: Track spreads historically

### Trading Signals
- **Curve Steepener**: Long short-end, short long-end
- **Curve Flattener**: Opposite trade
- **Carry Trade**: Cross-currency opportunities
- **Duration Management**: When to extend/reduce

### Macro Integration
- **Fed Funds Expectations**: Implied rate path
- **Inflation Breakevens**: TIPS spread analysis
- **Real Yields**: Nominal minus inflation
- **Central Bank Meetings**: Policy impact prediction

## Usage

```typescript
import { YieldCurveAnalyzer } from 'kit-trading/skills/yield-curve-analyzer';

const analyzer = new YieldCurveAnalyzer();

// Get current US yield curve
const curve = await analyzer.getCurve('US');
// {
//   tenors: ['3M', '2Y', '5Y', '10Y', '30Y'],
//   yields: [5.25, 4.85, 4.55, 4.65, 4.80],
//   shape: 'inverted',
//   spread2s10s: -0.20
// }

// Check for inversions
const inversions = await analyzer.checkInversions('US');
// { inverted: true, spreads: { '2s10s': -0.20, '3m10y': -0.60 } }

// Compare countries
const comparison = await analyzer.compare(['US', 'DE', 'JP', 'UK']);

// Get recession probability
const recession = await analyzer.recessionProbability('US');
// { probability: 0.45, model: 'NY Fed', leadTime: '12-18 months' }
```

## API Endpoints

- `GET /api/yields/:country` - Current yield curve
- `GET /api/yields/:country/history` - Historical curves
- `GET /api/yields/compare` - Multi-country comparison
- `GET /api/yields/inversions` - Active inversions
- `GET /api/yields/spreads` - Key spread monitoring
- `GET /api/yields/recession-indicator` - Recession probability
