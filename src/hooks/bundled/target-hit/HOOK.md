---
name: target-hit
description: "Alerts when price targets or stop losses are hit"
metadata: { "openclaw": { "emoji": "🎯", "events": ["price_tick"] } }
---

# Target Hit Hook

Monitors prices and alerts when targets/stops are hit.

## What It Does

- Tracks user-defined price targets
- Alerts when take-profit levels reached
- Alerts when stop-loss levels triggered
- Supports multiple targets per asset

## Events

- `price_tick` - Checks against defined targets

## Configuration

Set targets in ~/.kit/price-targets.json
