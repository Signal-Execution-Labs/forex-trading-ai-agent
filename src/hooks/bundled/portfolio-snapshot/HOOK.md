---
name: portfolio-snapshot
description: "Saves portfolio snapshots when significant changes occur"
version: "1.0.0"
metadata:
  kit:
    emoji: "📸"
    events: ["portfolio:changed"]
    priority: 90
---

# Portfolio Snapshot Hook

Captures portfolio state whenever significant changes occur.

## What It Does

- Saves full portfolio snapshot to JSON files
- Stores in `~/.kit/snapshots/portfolio_TIMESTAMP.json`
- Includes all positions, balances, and metrics
