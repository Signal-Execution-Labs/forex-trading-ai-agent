---
name: balance-tracker
description: "Tracks portfolio balance changes and alerts on significant movements"
metadata:
  kit:
    emoji: "💰"
    events: ["gateway:heartbeat", "trade:executed"]
    requires:
      config: ["exchanges"]
---

# Balance Tracker Hook

Monitors your portfolio balance across all connected exchanges and alerts you when significant changes occur.

## Features

- 📊 Tracks total portfolio value in USD
- 🔔 Alerts on balance changes > 5% (configurable)
- 📈 Daily/weekly balance summaries
- ⚠️ Large deposit/withdrawal detection
- 💾 Historical balance snapshots

## What It Does

1. **On heartbeat**: Fetches current balances from all exchanges
2. **On trade execution**: Updates balance and checks for significant changes
3. **Comparison**: Compares with last snapshot
4. **Alert**: If change exceeds threshold, sends notification

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "balance-tracker": {
          "enabled": true,
          "env": {
            "BALANCE_THRESHOLD_PERCENT": "5",
            "SNAPSHOT_INTERVAL_MINUTES": "60",
            "ALERT_ON_DECREASE_ONLY": "false"
          }
        }
      }
    }
  }
}
```

## Requirements

- At least one exchange connected
- Balance read permissions on exchange API keys

## Output

Balance snapshots are saved to:
- `~/.kit/data/balance-history.json`
- Daily summaries in `~/.kit/reports/balance-YYYY-MM-DD.json`
