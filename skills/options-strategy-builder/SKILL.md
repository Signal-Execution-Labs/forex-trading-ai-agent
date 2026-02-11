# Options Strategy Builder

Design, test, and refine options strategies before executing. Build spreads from scratch or use pre-made templates with real-time P&L and Greeks visualization.

## Category
Trading

## Inspired By
- TradingView Options Strategy Builder
- OptionStrat
- Thinkorswim Strategy Roller
- Tastytrade

## Features

### Strategy Templates (30+)
**Bullish:**
- Long Call, Bull Call Spread, Bull Put Spread
- Call Ratio Backspread, Synthetic Long
- Poor Man's Covered Call (PMCC)

**Bearish:**
- Long Put, Bear Put Spread, Bear Call Spread
- Put Ratio Backspread, Synthetic Short

**Neutral:**
- Iron Condor, Iron Butterfly, Straddle, Strangle
- Calendar Spread, Diagonal Spread
- Jade Lizard, Big Lizard

**Income:**
- Covered Call, Cash-Secured Put
- Wheel Strategy, Collar

### Visual Builder
- **Drag & Drop**: Add legs visually on option chain
- **P&L Diagram**: Real-time profit/loss chart
- **Break-Even Points**: Automatic calculation
- **Max Profit/Loss**: Risk visualization
- **Greeks Profile**: Delta, Gamma, Theta, Vega curves

### What-If Scenarios
- **Price Movement**: How does P&L change with underlying?
- **Time Decay**: Theta impact over days/weeks
- **IV Changes**: Vega exposure simulation
- **Assignment Risk**: Early exercise probability
- **Roll Analysis**: Compare roll options

### Advanced Features
- **Multi-Leg Support**: Up to 8 legs per strategy
- **Custom Ratios**: Unbalanced spreads
- **Different Expirations**: Diagonal strategies
- **Index vs ETF**: Compare SPX vs SPY options
- **IV Rank/Percentile**: Context for current volatility

### Execution Integration
- **One-Click Trade**: Send strategy to broker
- **Limit Order**: Calculate mid-price
- **Adjustment Alerts**: When to roll or close
- **Auto-Management**: Profit/loss targets

## Usage

```typescript
import { OptionsStrategyBuilder } from 'kit-trading/skills/options-strategy-builder';

const builder = new OptionsStrategyBuilder();

// Build an Iron Condor
const strategy = await builder.create('AAPL', {
  template: 'iron-condor',
  expiration: '2026-03-21',
  width: 5,
  delta: 0.15
});

// Analyze the strategy
console.log(strategy.analysis);
// {
//   maxProfit: 245,
//   maxLoss: 255,
//   breakEvens: [177.55, 192.45],
//   probabilityOfProfit: 0.68,
//   greeks: { delta: 0.02, theta: 12.5, vega: -45 }
// }

// What-if analysis
const scenarios = await builder.whatIf(strategy, {
  priceChange: [-5, 0, 5],
  ivChange: [-10, 0, 10],
  daysForward: [7, 14, 21]
});
```

## API Endpoints

- `GET /api/options/:symbol/chain` - Full options chain
- `POST /api/options/strategy` - Build strategy
- `GET /api/options/templates` - Available templates
- `POST /api/options/analyze` - P&L and Greeks analysis
- `POST /api/options/whatif` - Scenario analysis
- `POST /api/options/execute` - Send to broker
