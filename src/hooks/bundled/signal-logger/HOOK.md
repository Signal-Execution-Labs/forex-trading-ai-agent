---
name: signal-logger
description: "Logs all received trading signals for analysis"
version: "1.0.0"
metadata:
  kit:
    emoji: "📡"
    events: ["signal:received"]
    priority: 85
---

# Signal Logger Hook

Tracks all incoming trading signals for later analysis and backtesting.

## What It Does

- Logs every signal with full details
- Stores as JSONL in `~/.kit/logs/signals.log`
- Perfect for signal performance analysis
