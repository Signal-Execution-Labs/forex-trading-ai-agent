---
name: session-pnl-reset
description: "Automatically resets daily P&L tracking at market open"
homepage: https://github.com/kayzaa/k.i.t.-bot/hooks
metadata:
  {
    "openclaw": {
      "emoji": "🔄",
      "events": ["gateway:heartbeat", "gateway:tick"],
      "requires": {},
      "install": [{ "id": "bundled", "kind": "bundled" }]
    }
  }
---

# 🔄 Session P&L Reset Hook

Automatically resets daily P&L tracking at configurable times (typically market open).

## What It Does

- Resets session P&L counters at configured time
- Archives previous day's P&L to history file
- Supports multiple market sessions (NY, London, Tokyo)
- Creates daily snapshots for analysis

## Configuration

Set in `workspace/pnl-reset.json`:

```json
{
  "resetTimes": [
    { "hour": 9, "minute": 30, "timezone": "America/New_York", "label": "NYSE Open" },
    { "hour": 8, "minute": 0, "timezone": "Europe/London", "label": "London Open" }
  ],
  "archivePath": "workspace/pnl-history/",
  "retainDays": 90
}
```

## How It Works

1. Monitors gateway heartbeats
2. Checks if current time matches any reset time
3. Archives current P&L to history file
4. Resets trading_brain.json session counters
5. Logs the reset event

## Archive Format

Creates files like `pnl-history/2026-02-15-NYSE.json`:

```json
{
  "date": "2026-02-15",
  "session": "NYSE Open",
  "closingPnL": 1234.56,
  "trades": 47,
  "winRate": 0.68
}
```
