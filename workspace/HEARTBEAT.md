# K.I.T. Heartbeat Tasks

Tasks to run periodically. Check these during heartbeat polls.

## Market Hours Check

Before any trading activity, verify:
- Is it a trading day? (Crypto: always, Forex: not weekends)
- Any exchange maintenance scheduled?
- Market conditions normal?

## Morning Routine (09:00 CET)

```yaml
morning:
  - Check overnight news
  - Review portfolio status
  - Update watchlist
  - Check open positions
  - Verify stop-losses are active
```

## Hourly Checks

```yaml
hourly:
  - Price alerts status
  - Open position P&L
  - Unusual volume detection
  - Strategy signal scan
```

## Alert Conditions

Monitor these and alert if triggered:

```yaml
alerts:
  # Price Alerts (user-defined)
  # Check memory for user's price alerts
  
  # Portfolio Alerts
  portfolio:
    - daily_loss > 3%: "⚠️ Down 3% today"
    - daily_loss > 5%: "🛑 Daily loss limit reached!"
    - daily_gain > 10%: "🎉 Great day! Consider taking profits"
  
  # Position Alerts
  positions:
    - unrealized_loss > 5%: "Position losing, check stop"
    - near_stop_loss: "Position approaching stop"
    - hit_target: "Target reached, consider exit"
  
  # Market Alerts
  market:
    - btc_change_1h > 5%: "BTC moving >5% in hour"
    - extreme_fear: "Fear & Greed < 20"
    - extreme_greed: "Fear & Greed > 80"
```

## Evening Review (22:00 CET)

```yaml
evening:
  - Summarize day's P&L
  - Log notable trades
  - Review missed opportunities
  - Update trading journal
  - Set overnight alerts
```

## Weekly Tasks (Sunday)

```yaml
weekly:
  - Performance review (win rate, P&L)
  - Strategy assessment
  - Risk limit review
  - Cleanup old alerts
  - Update MEMORY.md with learnings
```

## News Monitoring

```yaml
news:
  check_interval: 30m
  alert_on:
    - high_impact_news
    - regulatory_news
    - exchange_news
    - hack_or_exploit
```

## Economic Calendar

```yaml
calendar:
  alert_before: 30m  # Alert 30 min before events
  track:
    - Fed meetings
    - CPI releases
    - Employment data
    - GDP releases
```

## System Health

```yaml
health:
  - Exchange connection status
  - API rate limit status
  - Pending order status
  - Strategy execution status
```

## Current Watchlist

Update this with assets you're monitoring:

```yaml
watchlist:
  primary:
    - BTC/USDT  # Always watch Bitcoin
    - ETH/USDT  # Always watch Ethereum
    
  secondary:
    - SOL/USDT
    - AVAX/USDT
    
  opportunities:
    # Add potential trades here
```

## Active Alerts

List your current alerts:

```yaml
active_alerts:
  # Example:
  # - BTC above 50000
  # - ETH below 2000
  # - RSI oversold on SOL
```

## Notes for Today

```markdown
<!-- Add daily trading notes here -->

### Market Conditions
- Trend: 
- Volatility: 
- Sentiment: 

### Plan
- 

### Executed
- 

### Lessons
- 
```

## Heartbeat Response Rules

When processing heartbeat:

1. **HEARTBEAT_OK** - Nothing needs attention
2. **Alert User** - Something important happened
3. **Take Action** - Execute predefined automated task

Prefer HEARTBEAT_OK unless there's something genuinely worth reporting.

Don't spam the user with:
- Minor price movements
- Routine status updates
- Repetitive alerts

Do alert for:
- Position near stop-loss
- Significant P&L change
- High-impact news
- System issues
