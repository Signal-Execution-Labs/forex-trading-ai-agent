# Cron vs Heartbeat: When to Use Each

Both heartbeats and cron jobs let you run tasks on a schedule. This guide helps you choose the right mechanism for your trading automation.

## Quick Decision Guide

| Use Case                                | Recommended         | Why                                      |
| --------------------------------------- | ------------------- | ---------------------------------------- |
| Check portfolio every 30 min            | Heartbeat           | Batches with other checks, context-aware |
| Send daily P&L report at 6pm sharp      | Cron (isolated)     | Exact timing needed                      |
| Monitor open positions                  | Heartbeat           | Natural fit for periodic awareness       |
| Run weekly strategy backtest            | Cron (isolated)     | Standalone task, can use different model |
| Alert me in 20 minutes about earnings   | Cron (main, `--at`) | One-shot with precise timing             |
| Check market sentiment                  | Heartbeat           | Piggybacks on existing cycle             |

## Heartbeat: Periodic Awareness

Heartbeats run in the **main session** at a regular interval (default: 30 min). They're designed for K.I.T. to monitor markets and surface anything important.

### When to use heartbeat

- **Multiple periodic checks**: Instead of 5 separate cron jobs checking portfolio, positions, alerts, signals, and market news, a single heartbeat can batch all of these.
- **Context-aware decisions**: K.I.T. has full main-session context, so it can make smart decisions about what's urgent vs. what can wait.
- **Trading continuity**: Heartbeat runs share the same session, so K.I.T. remembers your recent trades and can follow up naturally.
- **Low-overhead monitoring**: One heartbeat replaces many small polling tasks.

### Heartbeat advantages

- **Batches multiple checks**: One turn can review positions, P&L, and pending signals together.
- **Reduces API calls**: A single heartbeat is cheaper than 5 isolated cron jobs.
- **Context-aware**: K.I.T. knows your open positions and can prioritize accordingly.
- **Smart suppression**: If nothing needs attention, K.I.T. replies `HEARTBEAT_OK` and no message is delivered.
- **Natural timing**: Drifts slightly based on queue load, which is fine for most monitoring.

### Heartbeat example: HEARTBEAT.md checklist

```md
# K.I.T. Heartbeat Checklist

## Position Monitoring
- Check P&L on all open positions
- Alert if any position > 5% in loss
- Alert if trailing stop should be tightened

## Market Awareness
- Check for high-impact news in next 2 hours
- Review market sentiment shifts
- Look for significant whale movements

## Strategy Health
- Verify all trading bots are running
- Check for any failed trade executions
- Review signal queue

## Maintenance
- If markets closed, do nothing (HEARTBEAT_OK)
- Late night (23:00-07:00): only urgent alerts
```

### Configuring heartbeat

```json5
{
  heartbeat: {
    every: "30m",              // Check every 30 minutes
    target: "telegram",        // Send alerts to Telegram
    activeHours: {
      start: "07:00",          // Start at market open
      end: "23:00",            // End late evening
    },
    skipWeekends: true,        // Don't check on weekends
  },
}
```

## Cron: Precise Scheduling

Cron jobs run at **exact times** and can run in isolated sessions without affecting main context.

### When to use cron

- **Daily reports**: "Send me a P&L summary every day at 6pm"
- **Scheduled analysis**: "Run backtests every Sunday at 8am"
- **One-shot reminders**: "Alert me in 15 minutes when market opens"
- **Different model**: Use a cheaper model for routine reports
- **Isolated execution**: Task shouldn't see main session history

### Cron examples

```bash
# Daily P&L report at 18:00
kit cron add --name "daily-pnl" \
  --schedule "0 18 * * *" \
  --task "Generate daily P&L report and send to Telegram"

# Weekly backtest on Sunday
kit cron add --name "weekly-backtest" \
  --schedule "0 8 * * 0" \
  --task "Backtest all active strategies against last week's data"

# One-shot reminder
kit cron add --name "earnings-alert" \
  --at "2026-02-12T15:30:00" \
  --task "Remind me: NVDA earnings call in 30 minutes"
```

## Trading-Specific Guidance

### Use Heartbeat For
- ✅ Position monitoring (P&L, margin levels)
- ✅ Signal queue checking
- ✅ Market hours awareness
- ✅ Portfolio health checks
- ✅ Trailing stop adjustments

### Use Cron For
- ✅ Daily/weekly P&L reports
- ✅ Strategy backtesting (scheduled)
- ✅ Tax report generation (monthly)
- ✅ Portfolio rebalancing (scheduled)
- ✅ One-shot price alerts

### Market Hours Consideration

K.I.T. is smart about market hours:

```md
# In HEARTBEAT.md
- If forex market closed (weekend), reply HEARTBEAT_OK
- If crypto position open, check 24/7
- If stock market closed, only check crypto positions
```

## Combining Both

The most effective setup uses both:

1. **Heartbeat** (every 30 min) for ongoing awareness
2. **Cron** for precise scheduled tasks

Example setup:
```
Heartbeat (30m):
  - Check open positions
  - Monitor P&L
  - Surface urgent signals
  - Market sentiment check

Cron:
  - Daily P&L report @ 18:00
  - Weekly strategy analysis @ Sunday 08:00
  - Monthly tax summary @ 1st of month
```

This gives you both real-time awareness AND scheduled reports without duplicating work.

## Token Efficiency

| Approach           | Token Cost | Best For                    |
| ------------------ | ---------- | --------------------------- |
| Single heartbeat   | Low        | Multiple periodic checks    |
| Multiple cron jobs | Higher     | Isolated, precise tasks     |
| Combined           | Optimal    | Full trading automation     |

**Tip**: Batch similar checks into HEARTBEAT.md instead of creating many cron jobs. Use cron only when you need exact timing or isolated execution.
