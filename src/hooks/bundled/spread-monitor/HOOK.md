---
name: spread-monitor
description: "Monitors bid-ask spreads and alerts on widening"
metadata:
  kit:
    emoji: "↔️"
    events: ["market:tick", "trade:executed"]
    priority: 45
    category: "risk"
---

# Spread Monitor

Tracks bid-ask spreads to identify liquidity changes and optimal execution times.

## What It Does

- Monitors spreads on watchlist assets
- Alerts when spread exceeds normal range (2 std deviations)
- Identifies best/worst times to trade by spread
- Tracks spread trends per exchange/pair

## Configuration

Set in hooks.json:
```json
{
  "spread-monitor": {
    "alertThreshold": 0.3,
    "trackPairs": ["BTC/USDT", "ETH/USDT"]
  }
}
```

## Output

Spread data available via `kit spread-report` command.
