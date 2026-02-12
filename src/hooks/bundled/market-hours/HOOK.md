---
name: market-hours
description: "Logs market open/close events for session analysis"
version: "1.0.0"
metadata:
  kit:
    emoji: "🕐"
    events: ["market:open", "market:close"]
    priority: 75
---

# Market Hours Hook

Tracks market open and close events to help with session analysis.

## What It Does

- Logs market open events with 🟢 indicator
- Logs market close events with 🔴 indicator
- Stores in `~/.kit/logs/market-hours.log`
- Includes timezone information
