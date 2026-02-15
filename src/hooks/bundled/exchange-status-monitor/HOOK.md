---
name: exchange-status-monitor
description: "Monitors exchange API status and alerts on outages/maintenance"
metadata: { "kit": { "emoji": "🏛️", "events": ["gateway:heartbeat", "gateway:startup"], "category": "infrastructure" } }
---

# Exchange Status Monitor Hook

Monitors the operational status of connected exchanges and alerts on issues.

## What It Does

- Checks exchange API health on heartbeat
- Detects maintenance windows, degraded performance, outages
- Pauses trading signals during exchange issues
- Tracks API latency and error rates
- Alerts on status changes

## Monitored Exchanges

- **Binance** - status.binance.com
- **Coinbase** - status.coinbase.com
- **Kraken** - status.kraken.com
- **FTX** - ftx.com/status
- **KuCoin** - status.kucoin.com
- **Bybit** - status.bybit.com
- **Custom** - Any exchange with status endpoint

## Status Levels

| Level | Action | Description |
|-------|--------|-------------|
| 🟢 Operational | Normal trading | All systems working |
| 🟡 Degraded | Reduce activity | Some issues reported |
| 🟠 Maintenance | Pause trading | Scheduled maintenance |
| 🔴 Outage | Stop trading | Major incident |

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "exchange-status-monitor": {
          "enabled": true,
          "env": {
            "ESM_EXCHANGES": "binance,coinbase,kraken",
            "ESM_CHECK_INTERVAL": "300",
            "ESM_PAUSE_ON_DEGRADED": "true",
            "ESM_ALERT_CHANNEL": "telegram"
          }
        }
      }
    }
  }
}
```

## Output Files

- `~/.kit/data/exchange-status.json` - Current status of all exchanges
- `~/.kit/reports/exchange-incidents.log` - Historical incident log
