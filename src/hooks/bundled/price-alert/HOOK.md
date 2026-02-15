---
name: price-alert
description: "Monitors price levels and sends alerts when targets are hit"
homepage: https://github.com/kayzaa/k.i.t.-bot/hooks
metadata:
  {
    "openclaw": {
      "emoji": "🎯",
      "events": ["gateway:tick", "trading:price_update"],
      "requires": {},
      "install": [{ "id": "bundled", "kind": "bundled" }]
    }
  }
---

# 🎯 Price Alert Hook

Monitors configurable price levels and triggers alerts when targets are reached.

## What It Does

- Tracks multiple price alerts per symbol
- Supports above/below/cross conditions
- Sends notifications via configured channels
- Auto-removes triggered alerts (optional)
- Supports percentage-based targets

## Configuration

Set alerts in `workspace/price-alerts.json`:

```json
{
  "alerts": [
    {
      "symbol": "BTCUSDT",
      "condition": "above",
      "price": 100000,
      "message": "BTC broke 100K! 🚀",
      "repeat": false
    },
    {
      "symbol": "EURUSD",
      "condition": "below",
      "price": 1.05,
      "message": "EUR weakness alert",
      "repeat": true
    }
  ]
}
```

## Conditions

- `above` - Triggers when price goes above target
- `below` - Triggers when price drops below target
- `cross` - Triggers on any cross (either direction)
- `percent_up` - Price rises X% from entry
- `percent_down` - Price drops X% from entry
