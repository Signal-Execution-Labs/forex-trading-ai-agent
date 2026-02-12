# 👁️ Position Monitor Hook

Monitors open positions and alerts on significant P&L changes, SL/TP proximity, and long-duration holds.

## Events
- `agent:tick` - Periodic position check (every minute)
- `trade:opened` - When a new position opens
- `trade:closed` - When a position closes

## Features
- Tracks real-time P&L changes per position
- Alerts when position approaches stop loss or take profit
- Warns about positions held longer than expected
- Detects rapid drawdowns

## Alerts
- 🔴 Position approaching stop loss (within 10%)
- 🟢 Position approaching take profit (within 10%)
- ⏰ Position held longer than 4 hours (configurable)
- 📉 Position drawdown exceeds 5% in last 5 minutes

## Configuration
```json
{
  "hooks": {
    "position-monitor": {
      "enabled": true,
      "slProximityPct": 10,
      "tpProximityPct": 10,
      "maxHoldHours": 4,
      "drawdownAlertPct": 5,
      "checkIntervalMs": 60000
    }
  }
}
```
