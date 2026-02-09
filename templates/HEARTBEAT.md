# HEARTBEAT.md - K.I.T. Periodic Checks

## ⏰ Check Schedule

| Check | Frequency | Trading Hours Only |
|-------|-----------|-------------------|
| Market Prices | Every 30 min | No (but less frequent off-hours) |
| Portfolio Status | Every 2h | Yes |
| Alert Triggers | Continuous | No |
| News Scan | 3x daily | No |
| Funding Rates | Every 8h | Futures only |

---

## 📊 Market Check

### Watchlist Prices
Check current prices for assets in USER.md watchlist.

**Alert if:**
- Move > 3% in last hour
- Move > 5% in last 4 hours
- Price approaching key support/resistance (from STRATEGIES.md)
- Unusual volume (> 2x average)

### Market Conditions
- Overall market sentiment (BTC direction)
- Fear & Greed Index level
- Any circuit breakers or exchange issues

---

## 💼 Portfolio Check

### Open Positions
For each open position:
- Current P&L ($ and %)
- Distance to stop-loss
- Distance to take-profit
- Time in trade

**Alert if:**
- P&L drops below -50% of stop distance (getting close to stop)
- Position profitable > 2R (consider taking partial)
- Holding > 2x expected duration

### Account Status
- Available balance
- Margin utilization (if using leverage)
- Unrealized P&L total
- Daily P&L

**Alert if:**
- Daily loss > daily limit (from USER.md)
- Margin utilization > 70%
- Drawdown from peak > threshold

---

## 🚨 Alert Check

### Price Alerts
Check user-defined price alerts:
```
[List active price alerts here]
- BTC: Alert if < $40,000 or > $50,000
- ETH: Alert if < $2,000
```

### Pattern Alerts
Check for completed patterns:
- Breakout from consolidation
- Support/resistance tests
- Trend line breaks

### Technical Alerts
- RSI oversold/overbought
- Moving average crosses
- Volume spikes

---

## 📰 News Check

### Sources to Scan
1. **High-Impact Economic Events**
   - Fed decisions
   - CPI/inflation data
   - Employment reports
   - GDP releases

2. **Crypto-Specific**
   - Exchange hacks or issues
   - Regulatory news
   - Major protocol updates
   - Large whale movements

3. **Asset-Specific**
   - News about held assets
   - Earnings (if trading stocks)
   - Partnership announcements

### News Impact Assessment
- **High:** Immediate alert, pause new trades
- **Medium:** Note in daily summary
- **Low:** Log for weekly review

---

## 📈 Funding Rate Check (Futures Only)

Every 8 hours (or before funding):
- Current funding rate for open positions
- Cost/benefit of holding through funding
- Alert if funding > 0.1% (expensive to hold)

---

## 🔄 Heartbeat Response Logic

```
IF urgent_alert:
    → Notify user immediately
    
ELIF trading_hours AND (market_opportunity OR portfolio_warning):
    → Send summary message
    
ELIF end_of_trading_day:
    → Send daily summary
    
ELIF weekly_review_due:
    → Compile weekly report
    
ELSE:
    → HEARTBEAT_OK (stay quiet)
```

---

## 📋 State Tracking

Track check timestamps in `memory/heartbeat-state.json`:
```json
{
  "lastChecks": {
    "market": 1703275200,
    "portfolio": 1703272000,
    "news": 1703260800,
    "funding": 1703251200
  },
  "lastDailySummary": "2024-12-22",
  "lastWeeklyReport": "2024-W51",
  "alertsTriggered": []
}
```

---

## 🌙 Off-Hours Behavior

During user's Do Not Disturb hours (from USER.md):
- Continue monitoring
- Log alerts but don't notify unless URGENT
- Urgent = stop-loss triggered, exchange issue, >10% move

---

## 📝 What To Log

Every heartbeat, append to daily memory:
```markdown
### Heartbeat [HH:MM]
- BTC: $XX,XXX (±X%)
- Portfolio: $XX,XXX (±X% today)
- Open Positions: X
- Alerts: [None / List]
```

---

_Adjust frequencies and thresholds based on your trading style and risk tolerance._
