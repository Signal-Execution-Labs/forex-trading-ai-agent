---
name: trade-streak-tracker
description: "Tracks winning and losing streaks, alerts on notable patterns"
homepage: https://github.com/kayzaa/k.i.t.-bot/hooks
metadata:
  {
    "openclaw": {
      "emoji": "📈",
      "events": ["trading:position_closed", "trading:trade_complete"],
      "requires": {},
      "install": [{ "id": "bundled", "kind": "bundled" }]
    }
  }
---

# 📈 Trade Streak Tracker Hook

Monitors trading performance patterns and alerts on significant streaks.

## What It Does

- Tracks consecutive wins/losses
- Alerts on new personal bests
- Warns on losing streaks (risk management)
- Celebrates win streaks (positive reinforcement)
- Stores streak history for analysis

## Why It Matters

Psychology is crucial in trading:
- **Winning streaks** can lead to overconfidence
- **Losing streaks** can trigger revenge trading
- **Awareness** helps maintain discipline

## Configuration

Set in `workspace/streak-config.json`:

```json
{
  "winStreakAlert": 5,
  "loseStreakWarn": 3,
  "loseStreakPause": 5,
  "trackBestStreaks": true,
  "notifications": {
    "telegram": true,
    "dashboard": true
  }
}
```

## Alerts

- **🎉 Win Streak**: "5 wins in a row! 🔥 Stay disciplined."
- **⚠️ Lose Streak**: "3 losses in a row. Consider taking a break."
- **🛑 Auto-Pause**: "5 consecutive losses. Trading paused for 1 hour."
- **🏆 New Record**: "New best win streak: 12! Previous: 10"
