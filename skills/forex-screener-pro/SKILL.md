# Forex Screener Pro

> Professional FX screener with TradingView-level filtering and technical ratings

## Overview

Comprehensive forex pair screener combining real-time quotes, technical analysis ratings, and advanced filtering. Screen all major, minor, and exotic pairs with 50+ criteria.

## Features

### Data Points
- **Price Data:** Bid, Ask, Spread, High, Low, Change
- **Technical Rating:** Strong Buy/Buy/Neutral/Sell/Strong Sell
- **Volatility:** ATR, standard deviation, Bollinger width
- **Momentum:** RSI, MACD, Stochastic, CCI
- **Trend:** ADX, moving average positions, trend strength

### Screening Criteria

#### Price Filters
- Current price range
- Spread (pips)
- Daily/weekly/monthly change %
- Distance from high/low

#### Technical Filters
- RSI overbought/oversold
- MACD signal (bullish/bearish)
- Moving average crossovers
- Bollinger Band position
- Support/resistance proximity

#### Fundamental Filters
- Interest rate differential
- Economic calendar events
- Correlation to USD/EUR
- Carry trade potential

### Technical Ratings System
Aggregate rating from 26 indicators:
- **Oscillators (11):** RSI, Stoch, CCI, ADX, AO, Momentum, MACD, Stoch RSI, Williams %R, Bull/Bear Power, UO
- **Moving Averages (15):** 5 SMA periods, 5 EMA periods, Ichimoku, VWMA, HMA, Hull MA, DEMA, TEMA

### Alert Types
- Technical rating change
- Spread spike/drop
- Correlation breakdown
- Breakout from range

## Usage

```typescript
// Basic forex screening
const pairs = await kit.screener.forex({
  filters: [
    { field: 'rsi_14', operator: 'lt', value: 30 },
    { field: 'technicalRating', operator: 'eq', value: 'STRONG_BUY' },
    { field: 'spread', operator: 'lt', value: 2 }
  ],
  sort: { field: 'change_percent', order: 'desc' },
  limit: 20
});

// Quick screens
const oversold = await kit.screener.forex.oversold();
const trending = await kit.screener.forex.strongTrend();
const lowSpread = await kit.screener.forex.lowSpread(1.5);

// Get technical rating breakdown
const rating = await kit.screener.forex.technicalRating('EURUSD');
console.log(rating);
// { overall: 'BUY', oscillators: 'NEUTRAL', movingAverages: 'STRONG_BUY' }
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/screener/forex | Run forex screener |
| GET | /api/screener/forex/pairs | List all FX pairs |
| GET | /api/screener/forex/:pair/rating | Technical rating |
| GET | /api/screener/forex/quick/:type | Quick screen |
| POST | /api/screener/forex/presets | Save custom preset |

## Pair Coverage

| Category | Count | Examples |
|----------|-------|----------|
| Majors | 7 | EUR/USD, GBP/USD, USD/JPY |
| Minors | 21 | EUR/GBP, AUD/NZD, GBP/JPY |
| Exotics | 40+ | USD/TRY, EUR/PLN, USD/ZAR |

## Inspired By

TradingView Forex Screener with its comprehensive filtering, technical ratings, and real-time data capabilities.
