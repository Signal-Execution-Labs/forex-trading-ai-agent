---
name: volatility-monitor
description: "Monitors real-time market volatility and regime changes"
metadata:
  kit:
    emoji: "🌊"
    events: ["market:tick", "session:start"]
    priority: 40
    category: "risk"
---

# Volatility Monitor

Tracks realized volatility and detects regime changes in real-time.

## What It Does

- Calculates rolling volatility (1H, 4H, 24H windows)
- Detects volatility regime changes (low/medium/high/extreme)
- Alerts when volatility spikes or drops significantly
- Compares current vol to historical percentile

## Configuration

```json
{
  "volatility-monitor": {
    "assets": ["BTC", "ETH"],
    "alertOnRegimeChange": true,
    "extremeVolThreshold": 80
  }
}
```

## Use Cases

- Adjust position sizes based on volatility regime
- Pause trading during extreme volatility
- Optimize entry/exit timing
