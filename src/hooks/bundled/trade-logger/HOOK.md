---
name: trade-logger
description: "Logs all executed and closed trades to ~/.kit/logs/trades.log"
version: "1.0.0"
metadata:
  kit:
    emoji: "📝"
    events: ["trade:executed", "trade:closed"]
    priority: 100
---

# Trade Logger Hook

Automatically logs all executed and closed trades to a JSONL log file for analysis and auditing.

## What It Does

- Logs every trade execution with full details (symbol, direction, volume, price)
- Logs trade closures with P&L information
- Stores logs in `~/.kit/logs/trades.log` as JSON lines

## Configuration

No configuration needed. Enable and it works automatically.

## Log Format

```json
{"event":"trade:executed","timestamp":"2026-02-12T10:30:00.000Z","symbol":"EURUSD","direction":"buy","volume":0.1,"price":1.0850}
{"event":"trade:closed","timestamp":"2026-02-12T11:45:00.000Z","symbol":"EURUSD","pnl":45.50,"closePrice":1.0895}
```
