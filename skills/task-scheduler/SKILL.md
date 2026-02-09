---
name: task-scheduler
description: "Schedule and automate trading tasks: DCA, rebalancing, reports, alerts. Full auto-pilot support."
metadata:
  {
    "openclaw":
      {
        "emoji": "⏰",
        "requires": { "bins": ["node"], "npm": ["cron-parser"] }
      }
  }
---

# Task Scheduler

Automatisiere wiederkehrende Trading-Aufgaben mit K.I.T.

## Overview

- **DCA (Dollar Cost Averaging)** - Automatische regelmäßige Käufe
- **Rebalancing** - Portfolio automatisch ausbalancieren
- **Reports** - Tägliche/wöchentliche Berichte
- **Alerts** - Regelmäßige Preis-/Portfolio-Checks

## 🤖 AUTO-PILOT MODE

```json
// ~/.kit/config/scheduler.json
{
  "auto_pilot": {
    "enabled": true,
    "timezone": "Europe/Berlin",
    "tasks": {
      "dca": {
        "enabled": true,
        "default_frequency": "weekly"
      },
      "rebalance": {
        "enabled": true,
        "check_frequency": "daily",
        "deviation_threshold_pct": 5
      },
      "reports": {
        "daily_summary": true,
        "weekly_performance": true,
        "send_to": ["telegram"]
      }
    }
  }
}
```

## Task Types

| Type | Description | Frequencies |
|------|-------------|-------------|
| `dca` | Dollar Cost Averaging | hourly, daily, weekly, monthly |
| `rebalance` | Portfolio Rebalancing | daily, weekly |
| `report` | Generate Reports | daily, weekly, monthly |
| `alert-check` | Check Alert Conditions | hourly, custom |
| `price-check` | Monitor Prices | continuous |
| `custom` | User-defined Actions | any |

## Commands

### Create DCA Task

```bash
# Via K.I.T. CLI (wenn implementiert)
kit scheduler create-dca \
  --name "Weekly BTC Buy" \
  --symbol BTC/USDT \
  --amount 100 \
  --frequency weekly \
  --day monday \
  --time 09:00
```

### Create Rebalance Task

```bash
kit scheduler create-rebalance \
  --name "Monthly Rebalance" \
  --frequency monthly \
  --threshold 5 \
  --targets "BTC:50,ETH:30,USDC:20"
```

### Create Report Task

```bash
kit scheduler create-report \
  --name "Daily Summary" \
  --type daily \
  --frequency daily \
  --time 20:00 \
  --send-to telegram
```

### List Tasks

```bash
kit scheduler list
kit scheduler list --type dca
kit scheduler list --enabled
```

### Enable/Disable Task

```bash
kit scheduler enable <task-id>
kit scheduler disable <task-id>
```

### Delete Task

```bash
kit scheduler delete <task-id>
```

### Run Task Manually

```bash
kit scheduler run <task-id>
```

### Scheduler Status

```bash
kit scheduler status
```

## DCA Strategies

### Conservative DCA

```json
{
  "name": "Conservative BTC DCA",
  "type": "dca",
  "frequency": "weekly",
  "config": {
    "symbol": "BTC/USDT",
    "amount": 50,
    "side": "buy",
    "time": "09:00",
    "day": "monday"
  }
}
```

### Smart DCA (Buy the Dip)

```json
{
  "name": "Smart DCA",
  "type": "dca",
  "frequency": "daily",
  "config": {
    "symbol": "BTC/USDT",
    "base_amount": 20,
    "max_amount": 100,
    "strategy": "buy_the_dip",
    "dip_threshold_pct": -5,
    "multiplier": 2
  }
}
```

## Rebalancing

### Target Allocation

```json
{
  "name": "Quarterly Rebalance",
  "type": "rebalance",
  "frequency": "monthly",
  "config": {
    "targetAllocations": {
      "BTC": 40,
      "ETH": 30,
      "SOL": 15,
      "USDC": 15
    },
    "threshold": 5,
    "minTradeSize": 50
  }
}
```

### Rebalancing Process

1. **Check Deviation** - Compare current vs target allocation
2. **Calculate Trades** - Determine buys/sells needed
3. **Execute** - Place orders (with approval if configured)
4. **Report** - Send summary

## Report Types

| Report | Content |
|--------|---------|
| `daily` | P&L, trades, portfolio snapshot |
| `weekly` | Performance, win rate, best/worst |
| `monthly` | Full analysis, tax implications |
| `performance` | Detailed strategy performance |

## Cron Expressions

For advanced scheduling:

| Expression | Description |
|------------|-------------|
| `0 9 * * *` | Daily at 9:00 |
| `0 9 * * 1` | Weekly Monday 9:00 |
| `0 9 1 * *` | Monthly 1st at 9:00 |
| `0 */4 * * *` | Every 4 hours |
| `0 9,21 * * *` | Twice daily 9:00 & 21:00 |

## Workflow

### Setup DCA

1. Decide on asset(s) and amounts
2. Choose frequency (weekly recommended for beginners)
3. Set time (avoid high-volatility periods)
4. Create task and enable

### Setup Rebalancing

1. Define target allocation (should sum to 100%)
2. Set deviation threshold (5% is common)
3. Choose frequency (monthly or quarterly)
4. Enable with or without approval requirement

### Monitoring

- Check `kit scheduler status` regularly
- Review task execution history
- Adjust amounts based on market conditions

## Best Practices

- **DCA**: Consistent timing reduces timing risk
- **Rebalance**: Don't over-rebalance (tax implications)
- **Reports**: Daily for active trading, weekly for passive
- **Alerts**: Set meaningful thresholds to avoid alert fatigue
