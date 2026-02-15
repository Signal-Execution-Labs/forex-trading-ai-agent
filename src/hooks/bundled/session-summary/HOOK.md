---
name: session-summary
description: "Provides end-of-trading-session summaries with key performance metrics"
version: "1.0.0"
metadata:
  kit:
    emoji: "📋"
    events: ["trade:closed", "session:end"]
    priority: 80
---

# Session Summary Hook

Automatically tracks trades throughout the day and generates comprehensive session summaries.

## What It Does

- Tracks all closed trades during the trading session
- Calculates win rate, profit factor, and P&L metrics
- Generates grade (A+ to F) based on performance
- Shows equity curve sparkline
- Compares with historical average

## Grading System

| Grade | Win Rate | Profit Factor |
|-------|----------|---------------|
| A+ 🏆 | ≥60% | ≥2.0 |
| A ⭐ | ≥55% | ≥1.5 |
| B 👍 | ≥50% | ≥1.2 |
| C 📊 | ≥45% | ≥1.0 |
| D ⚠️ | ≥40% | <1.0 |
| F 🔴 | <40% | <1.0 |

## Output Example

```
📋 Trading Session Summary 🏆
━━━━━━━━━━━━━━━━━━━━━━
📅 Date: 2026-02-15
🎯 Grade: A+

💰 P&L Performance
• Net P&L: +$1,234.56
• Peak: +$1,500.00 | Trough: -$200.00
• Max Drawdown: $1,700.00

📊 Statistics
• Trades: 12 (67% win rate)
• Profit Factor: 2.15
• Avg Win: $156.78 | Avg Loss: $73.21
```
