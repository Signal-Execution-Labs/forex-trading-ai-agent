# Alert Combiner

Combine multiple conditions into powerful composite alerts.

## Overview
Inspired by TradingView's ability to combine up to 5 alert settings, this skill creates sophisticated multi-condition alerts.

## Condition Types

### 1. Price Conditions
- Price crosses above/below level
- Price enters/exits zone (rectangle)
- Price % change in timeframe
- Gap up/down detection

### 2. Indicator Conditions
- RSI above/below level
- MACD cross
- Moving average cross
- Bollinger Band touch/break
- Custom indicator values

### 3. Drawing Conditions
- Trendline break
- Support/resistance zone touch
- Fibonacci level hit
- Horizontal line cross

### 4. Volume Conditions
- Volume spike (X times average)
- OBV divergence
- Volume profile level test

### 5. Time Conditions
- Market open/close
- Session start/end
- Custom time windows
- Day of week filter

## Logical Operators
```
AND - All conditions must be true
OR  - Any condition can be true
NOT - Condition must be false
THEN - Sequential (A happens, then B within X bars)
```

## Configuration
```yaml
alertCombiner:
  name: "Golden Cross + Volume + RSI"
  conditions:
    - type: "ma_cross"
      fast: 50
      slow: 200
      direction: "above"
    - operator: "AND"
    - type: "volume"
      comparison: "above"
      value: 2.0  # 2x average
    - operator: "AND"
    - type: "rsi"
      period: 14
      comparison: "below"
      value: 70
  actions:
    - alert: "telegram"
    - alert: "webhook"
    - autoTrade: false
  cooldown: 3600  # 1 hour between alerts
```

## Watchlist Alerts
Apply one composite alert to entire watchlist:
- Scan hundreds of symbols simultaneously
- Trigger when ANY symbol matches
- Include symbol name in alert

## Actions
- Push notification
- Telegram/Discord message
- Email
- Webhook (for automation)
- Auto-trade (optional)
- Log to journal

## Use Cases
- "Alert me when BTC breaks $100k AND volume > 2x AND it's not overbought"
- "Alert on any watchlist stock breaking 52-week high with volume"
- "Alert when trendline breaks THEN RSI confirms within 3 bars"
