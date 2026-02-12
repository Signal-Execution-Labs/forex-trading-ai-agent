---
name: risk-alert
description: "Handles risk warning events with high priority notifications"
version: "1.0.0"
metadata:
  kit:
    emoji: "⚠️"
    events: ["risk:warning"]
    priority: 200
---

# Risk Alert Hook

Handles risk warning events with high priority. Perfect for critical notifications when risk limits are approached.

## What It Does

- Captures risk warning events
- Logs warnings with full context
- Can integrate with Telegram/Discord notifications (TODO)

## Priority

This hook runs with priority 200 (highest) to ensure risk alerts are processed first.
