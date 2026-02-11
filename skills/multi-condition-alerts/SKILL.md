# Multi-Condition Alert Builder

**Inspired by:** TradingView Advanced Alerts, 3Commas Condition Groups

Build complex trading alerts by combining unlimited conditions with AND/OR logic.

## Overview

TradingView allows combining up to 5 settings in alerts. K.I.T. goes further - unlimited conditions with nested logic, cross-symbol alerts, and AI-powered condition suggestions.

## Features

### Condition Types
- **Price Conditions**: Above/below/crosses price levels
- **Indicator Conditions**: RSI, MACD, Bollinger, moving averages, etc.
- **Drawing Conditions**: Trendline touches, support/resistance levels
- **Pattern Conditions**: Double tops, breakouts, candlestick patterns
- **Volume Conditions**: Volume spikes, VWAP crosses
- **Time Conditions**: Session times, weekday filters
- **Cross-Symbol**: Compare ratios, correlations, spread conditions

### Logical Operators
- **AND**: All conditions must be true
- **OR**: Any condition must be true
- **NOT**: Invert a condition
- **THEN**: Sequential conditions (A happens, then B within X time)
- **Nested Groups**: `(A AND B) OR (C AND D)`

### Delivery Methods
- Webhook (execute trades)
- Telegram notification
- Discord notification
- Email
- In-app popup
- SMS (via Twilio)

### AI Features
- **Condition Suggestions**: AI recommends conditions based on your strategy description
- **Backtest Verification**: Test alert would have triggered in historical data
- **False Positive Analysis**: Estimate alert frequency and quality
- **Auto-Optimization**: Suggest parameter tweaks to improve signal quality

## Example Alerts

### 1. RSI Divergence with Volume Confirmation
```json
{
  "name": "RSI Bull Divergence + Volume",
  "symbol": "BTCUSDT",
  "logic": {
    "operator": "AND",
    "conditions": [
      { "type": "indicator", "indicator": "RSI", "period": 14, "condition": "below", "value": 30 },
      { "type": "pattern", "pattern": "bullish_divergence", "indicator": "RSI" },
      { "type": "volume", "condition": "above_average", "multiplier": 1.5 }
    ]
  },
  "actions": [
    { "type": "webhook", "url": "{{KIT_WEBHOOK}}/signal", "payload": { "action": "BUY" } },
    { "type": "telegram", "message": "🟢 RSI Divergence Alert: {{symbol}} - Buy Signal" }
  ]
}
```

### 2. Multi-Timeframe Trend Alignment
```json
{
  "name": "Triple Screen Buy",
  "symbol": "EURUSD",
  "logic": {
    "operator": "AND",
    "conditions": [
      { "type": "indicator", "timeframe": "1D", "indicator": "EMA", "period": 20, "condition": "price_above" },
      { "type": "indicator", "timeframe": "4H", "indicator": "MACD", "condition": "histogram_positive" },
      { "type": "indicator", "timeframe": "1H", "indicator": "stochastic", "condition": "oversold_cross" }
    ]
  }
}
```

### 3. Cross-Symbol Spread Alert
```json
{
  "name": "BTC/ETH Ratio Extreme",
  "logic": {
    "operator": "OR",
    "conditions": [
      { "type": "spread", "symbol1": "BTCUSDT", "symbol2": "ETHUSDT", "condition": "above", "value": 25 },
      { "type": "spread", "symbol1": "BTCUSDT", "symbol2": "ETHUSDT", "condition": "below", "value": 15 }
    ]
  },
  "message": "BTC/ETH ratio at extreme - reversion trade opportunity"
}
```

### 4. Sequential Alert (A then B)
```json
{
  "name": "Breakout Confirmation",
  "symbol": "AAPL",
  "logic": {
    "operator": "THEN",
    "windowMs": 3600000,
    "conditions": [
      { "type": "price", "condition": "crosses_above", "value": "{{resistance}}" },
      { "type": "volume", "condition": "above", "value": "{{avg_volume * 2}}" }
    ]
  },
  "message": "Confirmed breakout! Price broke resistance and volume confirmed"
}
```

### 5. Watchlist Alert
```json
{
  "name": "Top Crypto Oversold Scanner",
  "watchlist": ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "DOTUSDT"],
  "logic": {
    "operator": "AND",
    "conditions": [
      { "type": "indicator", "indicator": "RSI", "period": 14, "condition": "below", "value": 25 },
      { "type": "indicator", "indicator": "BB", "condition": "below_lower" }
    ]
  },
  "message": "{{triggered_symbols}} oversold - potential bounce"
}
```

## CLI Usage

```bash
# Create alert from JSON file
kit alert create --file my-alert.json

# Create alert interactively
kit alert create --interactive

# AI-assisted alert creation
kit alert create --describe "Alert me when BTC RSI goes oversold and there's a bullish divergence"

# List active alerts
kit alert list

# Test alert against historical data
kit alert backtest --id alert_123 --days 30

# Pause/resume alert
kit alert pause --id alert_123
kit alert resume --id alert_123

# Delete alert
kit alert delete --id alert_123
```

## API

```typescript
import { MultiConditionAlert, AlertBuilder } from 'kit/skills/multi-condition-alerts';

// Fluent builder API
const alert = new AlertBuilder()
  .name('My Complex Alert')
  .symbol('BTCUSDT')
  .when('RSI', { period: 14 }).below(30)
  .and('MACD').crossesAbove('signal')
  .and('volume').aboveAverage(1.5)
  .then()
    .webhook('https://my-api.com/trade')
    .telegram('Buy signal triggered!')
  .build();

// Create and activate
const alertId = await alert.create();
await alert.activate(alertId);

// Backtest
const results = await alert.backtest(alertId, { days: 30 });
console.log(`Would have triggered ${results.triggerCount} times`);
console.log(`Win rate: ${results.winRate}%`);
```

## K.I.T. Advantages

| Feature | TradingView | 3Commas | K.I.T. |
|---------|-------------|---------|--------|
| Max conditions | 5 | 3 | Unlimited |
| Nested logic | No | No | Yes |
| Cross-symbol | No | No | Yes |
| Sequential (THEN) | No | No | Yes |
| AI suggestions | No | No | Yes |
| Backtest alerts | No | Limited | Full |
| Self-hosted | No | No | Yes |
| Price | $12.95-59.95/mo | $29-99/mo | Free |

## Integration

Alerts integrate with all K.I.T. systems:
- **Auto-Trader**: Execute trades on alert
- **Signal-Copier**: Broadcast signals to followers
- **Trade-Journal**: Log alert triggers
- **Risk-AI**: Validate trades before execution
- **Telegram/Discord**: Instant notifications
