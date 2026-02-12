# Drawing Alerts

> Create alerts from chart drawings - trendlines, rectangles, channels, and more.

## Overview

Unlike basic price alerts, Drawing Alerts trigger when price interacts with your visual analysis:
- **Trendlines:** Alert on touch, break, or retest
- **Rectangles:** Alert when price enters/exits zones
- **Channels:** Alert on channel boundaries
- **Fibonacci:** Alert at key levels (38.2%, 50%, 61.8%)

## Features

### Supported Drawings
- **Trendlines:** Diagonal support/resistance
- **Horizontal Lines:** Key levels
- **Rectangles:** Supply/demand zones
- **Parallel Channels:** Trend channels
- **Fibonacci Retracement:** Key pullback levels
- **Fibonacci Extension:** Target levels
- **Pitchfork:** Andrews' Pitchfork median lines
- **Custom Shapes:** Any user-drawn area

### Alert Conditions
- **Touch:** Price touches the drawing
- **Break:** Price closes beyond the drawing
- **Retest:** Price returns to touch after breaking
- **Enter Zone:** Price enters a rectangle/area
- **Exit Zone:** Price leaves a rectangle/area
- **Approach:** Price within X% of drawing

### Smart Features
- **Auto-extend:** Trendlines extend into future
- **Dynamic Levels:** Drawings update with new pivots
- **Multi-touch Tracking:** Count touches for strength
- **Breakout Confirmation:** Wait for candle close
- **False Break Filter:** Minimum break distance

## Configuration

```yaml
drawing_alerts:
  drawings:
    - type: trendline
      points: [[2024-01-15, 42000], [2024-02-01, 45000]]
      conditions: [touch, break]
      confirmation: close  # wick, close, or time
      
    - type: rectangle
      bounds: [44000, 46000]
      conditions: [enter, exit]
      
    - type: fib_retracement
      swing_high: 48000
      swing_low: 38000
      alert_levels: [0.618, 0.5, 0.382]
      
  global_settings:
    min_break_pct: 0.5
    retest_window_bars: 10
    alert_cooldown_minutes: 60
```

## Auto-Detection Mode

Automatically create alerts from significant levels:
- Recent swing highs/lows
- Volume profile POC and value area
- Moving average dynamic levels
- Detected trendlines from pivots

```yaml
auto_detection:
  enabled: true
  swing_lookback: 50
  min_touches: 2
  include_volume_profile: true
```

## Actions

Beyond notifications, trigger trades:
- Open position on break
- Scale in at fib levels
- Close position on zone exit
- Adjust stop to drawing level

## Visual Dashboard

- See all active drawing alerts
- Color-coded by condition (touch, break, retest)
- Distance to each alert level
- Historical triggers

## Integration

Works with all K.I.T. assets:
- Crypto (CEX/DEX)
- Forex (MT5)
- Stocks (Alpaca, IBKR)
- Futures (CME, Bybit)
