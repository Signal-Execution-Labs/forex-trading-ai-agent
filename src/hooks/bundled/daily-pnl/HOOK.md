# 📊 Daily P&L Hook

Sends a daily summary of your trading performance at market close.

## Events
- `cron:daily` - Triggered at end of trading day

## Features
- Summarizes all trades for the day
- Calculates total P&L, win rate, best/worst trade
- Sends notification via configured channels
- Logs summary to ~/.kit/logs/daily-pnl.log

## Configuration
```json
{
  "hooks": {
    "daily-pnl": {
      "enabled": true,
      "triggerTime": "22:00",
      "timezone": "UTC"
    }
  }
}
```

## Output
Logs entries like:
```
{"date":"2026-02-12","pnl":145.50,"trades":8,"wins":6,"losses":2,"winRate":"75%","bestTrade":89.50,"worstTrade":-25.00}
```
