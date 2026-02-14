---
name: weekly-report
description: "Generates comprehensive weekly trading performance report every Sunday"
metadata:
  openclaw:
    emoji: "📊"
    events: ["schedule:weekly"]
    requires:
      config: ["workspace.dir"]
---

# Weekly Report Hook

Generates a comprehensive weekly performance report including:
- Total P&L for the week
- Trading statistics (wins, losses, win rate)
- Best and worst performing assets
- Risk metrics (max drawdown, Sharpe ratio approximation)
- Comparison with previous week

## Output

Reports are saved to `<workspace>/reports/weekly-YYYY-WW.md` and optionally sent as a notification.

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "weekly-report": {
          "enabled": true,
          "dayOfWeek": 0,
          "hour": 20,
          "notify": true
        }
      }
    }
  }
}
```

## Report Contents

- Week-over-week P&L comparison
- Top 5 winning trades
- Top 5 losing trades
- Asset allocation breakdown
- Strategy performance comparison
- Risk-adjusted returns
