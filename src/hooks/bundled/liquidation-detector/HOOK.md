---
name: liquidation-detector
description: "Monitors leveraged positions for liquidation risk and sends early warnings"
metadata: { "openclaw": { "emoji": "💀", "events": ["position_update", "price_tick"] } }
---

# Liquidation Detector Hook

Monitors leveraged positions and alerts before liquidation.

## What It Does

- Tracks margin ratios on leveraged positions
- Warning at 80% to liquidation price
- Critical alert at 90% to liquidation price
- Emergency at 95% - suggests reducing position

## Events

- `position_update` - When position changes
- `price_tick` - On price updates for tracked assets

## Configuration

No configuration needed. Automatically monitors all leveraged positions.
