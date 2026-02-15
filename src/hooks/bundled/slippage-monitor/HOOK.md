---
name: slippage-monitor
description: "Monitors execution slippage and alerts on significant price deviation"
metadata:
  kit:
    emoji: "📉"
    events: ["trade:executed"]
    priority: 50
    category: "risk"
---

# Slippage Monitor

Tracks the difference between expected and actual execution prices.

## What It Does

- Calculates slippage for every executed trade
- Alerts when slippage exceeds configurable threshold (default: 0.5%)
- Tracks average slippage per exchange and asset
- Logs slippage statistics to workspace

## Configuration

Set in hooks.json:
```json
{
  "slippage-monitor": {
    "threshold": 0.5,
    "alertOnPositive": false
  }
}
```

## Output

Creates `workspace/slippage-log.json` with historical data.
