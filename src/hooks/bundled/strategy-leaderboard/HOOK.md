---
name: strategy-leaderboard
description: "Tracks and ranks strategy performance over time with weekly reports"
metadata:
  kit:
    emoji: "🏆"
    events: ["trade:closed", "gateway:heartbeat"]
    requires:
      config: ["strategies"]
---

# Strategy Leaderboard Hook

Automatically tracks the performance of all your trading strategies and generates competitive leaderboard rankings.

## Features

- 🏆 Real-time strategy rankings by multiple metrics
- 📊 Sharpe ratio, win rate, profit factor tracking
- 📈 Weekly performance reports
- 🥇 Top 3 strategy announcements
- 📉 Underperforming strategy alerts
- 🔄 Strategy comparison over time

## What It Does

1. **On trade closed**: Updates strategy stats with trade result
2. **On heartbeat**: Recalculates rankings, checks for weekly report
3. **Rankings**: Sorts strategies by configurable metric
4. **Reports**: Generates weekly performance summaries

## Ranking Metrics

Strategies are ranked by (configurable):
- **Sharpe Ratio** (default) - Risk-adjusted returns
- **Total Return** - Raw percentage gain
- **Win Rate** - Percentage of winning trades
- **Profit Factor** - Gross profit / gross loss
- **Max Drawdown** - Smallest drawdown wins

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "strategy-leaderboard": {
          "enabled": true,
          "env": {
            "RANKING_METRIC": "sharpe",
            "WEEKLY_REPORT_DAY": "sunday",
            "ANNOUNCE_TOP_N": "3",
            "ALERT_BOTTOM_PERCENT": "20"
          }
        }
      }
    }
  }
}
```

## Output

- Strategy stats: `~/.kit/data/strategy-stats.json`
- Weekly reports: `~/.kit/reports/leaderboard-YYYY-WW.json`
- Notifications via configured channels
