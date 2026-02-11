# Seasonality Scanner

Uncover recurring annual patterns in any asset. Track price movements over years to find seasonal trends and time your trades with confidence.

## Category
Analysis

## Inspired By
- TradingView Seasonals
- Seasonax
- Moore Research Center

## Features

### Seasonal Pattern Analysis
- **Multi-Year Overlay**: Compare 5, 10, 20 years of data
- **Monthly Patterns**: Best/worst months historically
- **Weekly Patterns**: Day-of-week tendencies
- **Hourly Patterns**: Intraday seasonality (forex sessions)
- **Pattern Strength**: Statistical confidence scoring

### Pattern Detection
- **Strong Seasons**: 70%+ win rate over 10+ years
- **Weak Seasons**: Historical underperformance periods
- **Seasonal Ranges**: Typical high-low ranges by month
- **Anomaly Detection**: Current year vs historical average

### Calendar Events
- **Earnings Season**: Q1/Q2/Q3/Q4 patterns
- **Tax Season**: April selling/buying patterns
- **Holiday Effects**: Santa Rally, January Effect, Sell in May
- **Expiration Effects**: Monthly/quarterly options expiry
- **FOMC/NFP Effects**: Rate decision and jobs report patterns

### Commodities Specialization
- **Crop Cycles**: Planting/harvest seasonality
- **Energy Patterns**: Summer/winter demand cycles
- **Metals**: Industrial vs safe-haven cycles
- **Soft Commodities**: Weather-based patterns

### Signal Generation
- **Seasonal Entries**: Buy/sell at optimal seasonal points
- **Confirmation**: Combine with technical analysis
- **Risk Adjustment**: Position size by confidence level
- **Exit Timing**: Optimal seasonal exit points

## Usage

```typescript
import { SeasonalityScanner } from 'kit-trading/skills/seasonality-scanner';

const scanner = new SeasonalityScanner();

// Analyze monthly seasonality
const patterns = await scanner.analyze('AAPL', {
  years: 15,
  granularity: 'monthly'
});

// Get best months to buy
const bestMonths = patterns.filter(m => m.winRate > 0.7);

// Get current seasonal signal
const signal = await scanner.getSignal('SPY');
// { direction: 'bullish', confidence: 0.78, reason: 'December historically +1.5%' }
```

## API Endpoints

- `GET /api/seasonality/:symbol` - Full seasonal analysis
- `GET /api/seasonality/:symbol/monthly` - Monthly breakdown
- `GET /api/seasonality/:symbol/weekly` - Day-of-week analysis
- `GET /api/seasonality/calendar` - Upcoming seasonal events
- `GET /api/seasonality/screener` - Filter by seasonal strength
