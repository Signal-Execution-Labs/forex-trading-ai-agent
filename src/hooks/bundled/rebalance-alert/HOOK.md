---
name: rebalance-alert
description: "Alerts when portfolio allocations drift from target weights"
metadata: { "openclaw": { "emoji": "⚖️", "events": ["portfolio_update", "price_tick"] } }
---

# Rebalance Alert Hook

Monitors portfolio allocations and alerts when they drift from targets.

## What It Does

- Tracks asset allocations vs target weights
- Alerts when any asset drifts >5% from target
- Critical alert at >10% drift
- Suggests rebalancing actions

## Events

- `portfolio_update` - When holdings change
- `price_tick` - On price updates (checks drift)

## Configuration

Set target weights in ~/.kit/rebalance-targets.json
