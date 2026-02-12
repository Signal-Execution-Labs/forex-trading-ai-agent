# Volume Footprint Analysis

Advanced volume analysis at each price level within candles.

## Overview
Inspired by TradingView's Pine v6 footprint API (Premium feature), this skill analyzes buy/sell volume at discrete price levels within each bar.

## Features
- **Footprint Charts:** Volume profile within each candle
- **Delta Analysis:** Buy vs sell volume imbalance
- **Point of Control (POC):** Highest volume price level per bar
- **Value Area:** 70% of volume concentration (VAH/VAL)
- **Imbalance Detection:** Aggressive buying/selling zones
- **Absorption Detection:** Large orders absorbing price movement
- **Volume Clusters:** Multi-bar volume accumulation zones

## Metrics
- Delta (buy - sell volume)
- Delta %
- Cumulative Delta
- Total volume
- POC price
- Value Area High/Low
- Imbalance ratio

## Configuration
```yaml
footprint:
  tickSize: 10          # Ticks per row
  method: "time"        # time, tick, volume, range
  showDelta: true
  showPOC: true
  showValueArea: true
  showImbalance: true
  imbalanceRatio: 300   # 3:1 ratio for imbalance
```

## Alerts
- POC break
- Delta divergence
- Volume imbalance detected
- Absorption pattern

## Use Cases
- Identify institutional order flow
- Find support/resistance via volume clusters
- Detect hidden buying/selling pressure
- Confirm breakouts with volume
