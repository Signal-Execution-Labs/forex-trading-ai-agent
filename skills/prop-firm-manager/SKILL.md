# Prop Firm Manager

## Overview
Complete management system for proprietary trading firm challenges and funded accounts. Track rules, prevent violations, and maximize your chances of passing challenges.

## Supported Prop Firms
- FTMO
- MyForexFunds  
- The Funded Trader
- True Forex Funds
- Funded Next
- E8 Funding
- Topstep
- Custom (configure your own rules)

## Features

### 📊 Challenge Tracker
- Track progress toward profit target
- Days remaining in challenge
- Current phase (Challenge / Verification / Funded)
- Pass probability based on current performance

### 🛡️ Rule Enforcer
Automatically prevents trades that would violate:
- **Daily Loss Limit** - Blocks trades when approaching limit
- **Max Drawdown** - Stops all trading at drawdown threshold
- **Lot Size Limits** - Ensures position sizes are within rules
- **Weekend Holding** - Warns/closes positions before weekend
- **News Trading Ban** - Blocks trades during high-impact news

### 📈 Consistency Rules
Many prop firms require consistent trading:
- No single day > 30-50% of total profit
- Minimum trading days
- No martingale/grid strategies
- Tracks and alerts on consistency violations

### 🚫 News Blocker
- Integrates with ForexFactory, Investing.com calendars
- Configurable buffer time (e.g., no trading 15min before/after)
- Filter by impact level (High/Medium/Low)
- Per-currency filtering

### 💰 Profit Calculator
- Daily P&L tracking
- Projected days to target
- Break-even analysis
- Payout schedule calculator

### 📱 Alerts
- Approaching daily loss limit (80%, 90%, 95%)
- Drawdown warnings
- News event reminders
- Challenge deadline approaching
- Target reached celebration!

## Configuration

```yaml
prop_firm_manager:
  firm: "ftmo"  # or custom
  account_size: 100000
  phase: "challenge"  # challenge, verification, funded
  
  rules:
    daily_loss_limit: 5  # percent
    max_drawdown: 10  # percent
    profit_target: 10  # percent (challenge phase)
    min_trading_days: 4
    max_position_size: 10  # lots
    weekend_holding: false
    news_trading: false
    
  news_filter:
    impact: ["high"]
    buffer_minutes: 15
    currencies: ["USD", "EUR", "GBP", "JPY"]
    
  alerts:
    telegram: true
    email: false
    sound: true
    
  consistency:
    max_daily_profit_pct: 40  # no single day > 40% of target
    min_trades_per_day: 0
    max_trades_per_day: 20
```

## Commands

### Setup
```
prop setup ftmo 100k challenge
prop setup custom --daily-loss=5 --max-dd=10 --target=8
```

### Status
```
prop status           # Show current challenge status
prop rules            # Show active rules
prop pnl              # Today's P&L vs limits
prop calendar         # Upcoming news events
```

### Safety
```
prop pause            # Pause all trading
prop resume           # Resume trading
prop close-all        # Emergency close all positions
```

### Analysis
```
prop consistency      # Check consistency metrics
prop projection       # Days to target at current rate
prop report           # Full challenge report
```

## Integration with K.I.T.

When enabled, the prop firm manager:
1. Intercepts all trade requests
2. Validates against current rules
3. Blocks violations with explanation
4. Logs all decisions for audit

### Example
```
You: "Buy 5 lots EUR/USD"

K.I.T.: "⚠️ Trade blocked by Prop Firm Manager:
- Current daily loss: -3.8%
- Daily limit: -5%
- This trade risks exceeding limit

Recommendation: Reduce to 2 lots or wait for tomorrow."
```

## Best Practices

1. **Set conservative limits** - Use 80% of actual limits as your K.I.T. limits
2. **Enable news blocker** - Most challenge failures happen during news
3. **Monitor consistency** - Don't get lucky on day 1 then fail consistency
4. **Use projections** - Don't rush, slow and steady wins

## Prop Firm Presets

### FTMO Classic
- Daily Loss: 5%
- Max Drawdown: 10%  
- Profit Target: 10% (Challenge), 5% (Verification)
- Min Days: 4
- No news trading required (but recommended)

### MyForexFunds
- Daily Loss: 5%
- Max Drawdown: 12%
- Profit Target: 8%
- Consistency rule: No day > 50% of profit

### The Funded Trader
- Daily Loss: 6%
- Max Drawdown: 12%
- Profit Target: 10%
- Weekend holding allowed

---
*"Pass your challenge, keep your funded account."*
