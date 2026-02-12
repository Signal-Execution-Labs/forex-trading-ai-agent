# Technical Rating

**Skill #79** | Category: Analysis | Inspired by: TradingView Technical Rating

Calculate aggregate buy/sell ratings from multiple indicators - just like TradingView's Technical Rating system.

## Overview

TradingView shows a "Technical Rating" from Strong Sell to Strong Buy based on 13 indicators. K.I.T. replicates this AND adds more:

- **TradingView:** 13 indicators
- **K.I.T.:** 26+ indicators with AI weighting

## Rating Scale

| Rating | Value Range | Meaning |
|--------|-------------|---------|
| Strong Buy | 0.5 to 1.0 | Strongly bullish |
| Buy | 0.1 to 0.5 | Moderately bullish |
| Neutral | -0.1 to 0.1 | No clear direction |
| Sell | -0.5 to -0.1 | Moderately bearish |
| Strong Sell | -1.0 to -0.5 | Strongly bearish |

## Indicators Included

### Oscillators (13)
1. RSI(14) - Oversold/Overbought
2. Stochastic %K(14,3,3)
3. CCI(20) - Commodity Channel Index
4. ADX(14) - Trend strength
5. AO - Awesome Oscillator
6. Mom(10) - Momentum
7. MACD(12,26,9) - Signal line crossover
8. Stoch RSI(14)
9. Williams %R
10. Bull Bear Power
11. UO - Ultimate Oscillator
12. ROC - Rate of Change
13. WaveTrend - LazyBear's popular indicator

### Moving Averages (13)
1. EMA 5, 10, 20, 50, 100, 200
2. SMA 5, 10, 20, 50, 100, 200
3. Hull MA 9

## Usage

```typescript
import { getTechnicalRating } from 'kit/skills/technical-rating';

// Get rating for a symbol
const rating = await getTechnicalRating('BTCUSDT', '1h');

console.log(rating);
// {
//   symbol: 'BTCUSDT',
//   timeframe: '1h',
//   rating: 0.62,
//   signal: 'Buy',
//   oscillators: { rating: 0.45, buy: 7, sell: 3, neutral: 3 },
//   movingAverages: { rating: 0.78, buy: 10, sell: 2, neutral: 1 },
//   summary: 'Buy (10 of 13 MAs bullish, RSI 58 neutral)',
//   indicators: { ... }
// }
```

## Multi-Timeframe Analysis

```typescript
const mtf = await getMultiTimeframeRating('BTCUSDT', ['15m', '1h', '4h', '1d']);
// Aggregates ratings across timeframes
```

## AI Enhancement

K.I.T. goes beyond TradingView by:

1. **Dynamic Weighting**: AI adjusts indicator weights based on market conditions
2. **Trend Context**: Gives more weight to momentum in trends, oscillators in ranges
3. **Volatility Adjustment**: Modifies signals during high volatility
4. **Historical Accuracy**: Tracks which indicators work best for each symbol

## API

### Functions

- `getTechnicalRating(symbol, timeframe)` - Single symbol rating
- `getMultiTimeframeRating(symbol, timeframes)` - MTF analysis
- `getBatchRatings(symbols, timeframe)` - Rate multiple symbols
- `getTopRated(market, count)` - Top N rated symbols

### Webhook

```json
POST /api/technical-rating
{
  "symbol": "BTCUSDT",
  "timeframe": "1h"
}
```

## Alerts

Set alerts when rating changes:

```typescript
import { setRatingAlert } from 'kit/skills/technical-rating';

setRatingAlert({
  symbol: 'BTCUSDT',
  condition: 'crosses_above',
  threshold: 0.5, // Strong Buy
  notify: ['telegram', 'webhook']
});
```

## Comparison

| Feature | TradingView | K.I.T. |
|---------|-------------|--------|
| Indicator count | 13 | 26+ |
| AI weighting | ❌ | ✅ |
| Historical accuracy | ❌ | ✅ |
| Custom indicators | ❌ | ✅ |
| Multi-timeframe | Manual | ✅ Automated |
| Alerts | ✅ Paid | ✅ Free |
| API access | ❌ | ✅ |
| Price | $12.95+/mo | **Free** |
