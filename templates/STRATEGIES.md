# STRATEGIES.md - Trading Strategies

_Your documented trading strategies. Backtest before live trading._

---

## 📊 Active Strategies

### Strategy 1: [Name]

**Status:** 🟢 Active / 🟡 Testing / 🔴 Paused

**Overview:**
[Brief description of what this strategy does]

**Rules:**
```yaml
type: [trend_following / mean_reversion / breakout / etc.]
timeframe: [1m / 15m / 1h / 4h / D / W]
markets: [BTC, ETH, etc.]
sessions: [All / London / NY / Asia]

entry:
  conditions:
    - [Condition 1]
    - [Condition 2]
  confirmation: [What confirms the entry]
  
exit:
  stop_loss: [% or ATR or structure]
  take_profit: [% or R:R or structure]
  trailing: [Yes/No, details]
  time_stop: [Max hold time if any]

position_sizing:
  method: [Fixed % / Kelly / Volatility-adjusted]
  size: [% of portfolio]
  max_positions: [Number]
```

**Indicators Used:**
- 
- 

**Best Conditions:**
- Market trending / ranging
- Volatility: High / Medium / Low
- Time of day:

**Avoid When:**
- 
- 

**Backtest Results:**
| Period | Trades | Win Rate | Avg Win | Avg Loss | Profit Factor | Max DD |
|--------|--------|----------|---------|----------|---------------|--------|
| | | | | | | |

**Live Results:**
| Period | Trades | Win Rate | P&L | Notes |
|--------|--------|----------|-----|-------|
| | | | | |

**Notes & Lessons:**
- 

---

### Strategy 2: [Name]

[Copy structure from above]

---

## 🧪 Strategies in Testing

### [Strategy Name]

**Status:** Paper trading since [Date]

**Hypothesis:** [What you're testing]

**Paper Trade Log:**
| # | Date | Asset | Entry | Exit | P&L | Notes |
|---|------|-------|-------|------|-----|-------|
| 1 | | | | | | |

**Observations:**
- 

**Go Live Criteria:**
- [ ] Minimum 20 paper trades
- [ ] Win rate > [X]%
- [ ] Profit factor > [X]
- [ ] Comfortable with execution

---

## 💀 Retired Strategies

### [Strategy Name]
**Retired:** [Date]
**Reason:** [Why it stopped working]
**Lessons:** [What you learned]

---

## 📚 Strategy Library

_Ideas to explore later._

### Trend Following
- Moving Average Crossover
- Breakout with Volume
- Higher Highs/Higher Lows

### Mean Reversion
- RSI Oversold/Overbought
- Bollinger Band Squeeze
- Support/Resistance Bounce

### Momentum
- Relative Strength
- Breakout Continuation
- News Momentum

### Other
- DCA Accumulation
- Grid Trading
- Arbitrage

---

## 🛠️ Strategy Development Process

### 1. Idea Generation
- Where did the idea come from?
- What edge does it exploit?

### 2. Define Rules
- Entry conditions (specific, testable)
- Exit conditions (stop, target, time)
- Position sizing

### 3. Backtest
- Minimum 100 trades or 2 years
- Multiple market conditions
- Account for slippage/fees

### 4. Paper Trade
- Minimum 20 live paper trades
- Track psychology/execution

### 5. Go Live (Small)
- Start with minimum size
- Scale up after 50 trades if profitable

### 6. Review & Refine
- Monthly performance review
- Adjust or retire as needed

---

## 📈 Strategy Performance Dashboard

| Strategy | Status | Trades | Win Rate | Profit Factor | This Month |
|----------|--------|--------|----------|---------------|------------|
| | | | | | |
| | | | | | |

---

## 🎯 Current Focus

**Primary Strategy:** [Name]
**Why:** [Fits current market conditions because...]

**Secondary:** [Name]
**Notes:** [When to use this one]

---

_Review strategies monthly. Markets change, strategies must adapt._
