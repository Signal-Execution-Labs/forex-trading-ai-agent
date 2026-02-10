---
summary: "Autopilot Mode - Fully autonomous trading"
read_when:
  - Configure autonomous trading
  - Understand autopilot modes
title: "Autopilot"
---

# Autopilot Mode

Autopilot is K.I.T.'s fully autonomous trading mode. When enabled, K.I.T. makes trading decisions and executes them without requiring your approval.

## Operating Modes

K.I.T. supports three operating modes, giving you control over how autonomous you want it to be.

### 1. Manual Mode (Training Wheels)

Every trade requires your explicit approval. K.I.T. suggests, you decide.

```bash
kit autopilot disable
```

**Best for:**
- Learning how K.I.T. works
- Building trust
- High-risk periods

### 2. Semi-Auto Mode (Co-Pilot)

Small trades execute automatically. Large or risky trades need approval.

```bash
kit autopilot enable --mode semi-auto
kit autopilot threshold 500  # Auto-approve trades under $500
```

**Configurable thresholds:**
- Trade size
- Position size
- Daily loss limit

### 3. Full-Auto Mode (Autopilot)

K.I.T. takes full control. You get daily reports. It handles the rest.

```bash
kit autopilot enable --mode full-auto
```

**Best for:**
- Hands-off trading
- 24/7 market coverage
- Passive income strategies

## Configuration

### CLI Commands

```bash
# Enable autopilot
kit autopilot enable --mode full-auto

# Disable autopilot
kit autopilot disable

# Set approval threshold
kit autopilot threshold 1000  # $1000

# View current settings
kit autopilot status

# Set strategy
kit autopilot strategy rsi-momentum
```

### Configuration File

```json
{
  "autopilot": {
    "enabled": true,
    "mode": "semi-auto",
    "approvalThreshold": 500,
    "maxDailyTrades": 20,
    "strategies": ["rsi", "macd-crossover"],
    "pairs": ["BTC/USDT", "ETH/USDT"],
    "riskLimits": {
      "maxPositionSize": 0.1,
      "maxDailyLoss": 0.05,
      "stopLossRequired": true
    }
  }
}
```

## Safety Features

Autopilot includes multiple safety mechanisms:

| Feature | Description |
|---------|-------------|
| **Kill Switch** | Instantly close all positions |
| **Max Daily Loss** | Stop trading after X% loss |
| **Max Drawdown** | Emergency stop at peak drawdown |
| **Position Limits** | No position exceeds X% of portfolio |
| **Strategy Validation** | Strategies must pass backtesting |

### Kill Switch

Emergency stop that closes all positions immediately:

```bash
kit trade kill
```

This command:
1. Cancels all open orders
2. Closes all positions at market price
3. Disables autopilot
4. Sends emergency alert

## Notification Settings

Configure how K.I.T. reports to you:

```json
{
  "notifications": {
    "onTrade": true,
    "onLargeProfit": true,
    "onLoss": true,
    "dailyReport": true,
    "weeklyReport": true,
    "channels": ["telegram"]
  }
}
```

### Report Types

| Report | Frequency | Content |
|--------|-----------|---------|
| Trade Alert | Instant | Every executed trade |
| Daily Summary | 9 AM | P&L, positions, performance |
| Weekly Report | Sunday | Full week analysis |
| Monthly Review | 1st | Month performance, strategy review |

## Best Practices

1. **Start with Semi-Auto** - Build trust before full autopilot
2. **Set Conservative Limits** - Better safe than sorry
3. **Review Daily Reports** - Stay informed even in autopilot
4. **Backtest Strategies** - Only use proven strategies
5. **Keep Kill Switch Ready** - Know how to stop quickly

## Strategy Selection

Autopilot uses configured strategies to make decisions:

```bash
# List available strategies
kit strategies list

# Enable a strategy
kit autopilot strategy add rsi-oversold

# Remove a strategy  
kit autopilot strategy remove macd-divergence

# View active strategies
kit autopilot strategies
```

### Built-in Strategies

| Strategy | Type | Risk Level |
|----------|------|------------|
| RSI Oversold/Overbought | Mean Reversion | Medium |
| MACD Crossover | Trend Following | Medium |
| Bollinger Bounce | Mean Reversion | Low |
| Breakout | Momentum | High |
| DCA | Accumulation | Low |

## Monitoring Autopilot

### Status Check

```bash
kit autopilot status
```

Output:
```
🤖 Autopilot Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Mode:           Full-Auto
Status:         Running ✅
Since:          2024-01-15 09:00
Trades Today:   5
P&L Today:      +$127.50 (+0.8%)

Active Strategies:
  • RSI Oversold (BTC/USDT, ETH/USDT)
  • MACD Cross (BTC/USDT)

Limits:
  • Max Position: 10% ✅
  • Daily Loss: 2.1% / 5% ✅
  • Trades: 5 / 20 ✅
```

### Live Logs

```bash
kit autopilot logs --follow
```

## Troubleshooting

<AccordionGroup>
  <Accordion title="Autopilot not executing trades">
    Check:
    1. Is autopilot enabled? `kit autopilot status`
    2. Are exchange credentials valid? `kit test-connection`
    3. Is there sufficient balance?
    4. Are pairs configured correctly?
  </Accordion>
  
  <Accordion title="Too many trades">
    Adjust settings:
    ```bash
    kit autopilot max-trades 10  # Per day
    kit autopilot cooldown 3600  # 1 hour between trades
    ```
  </Accordion>
  
  <Accordion title="Trades too small/large">
    Set position sizing:
    ```bash
    kit autopilot min-trade 50
    kit autopilot max-trade 500
    ```
  </Accordion>
</AccordionGroup>

## Related

- [Risk Management](/concepts/risk-management) - Safety settings
- [Auto Trader Skill](/skills/auto-trader) - Strategy details
- [Trading Tools](/concepts/trading-tools) - Available tools

---

<Warning>
**Important:** Autopilot is powerful but carries risk. Always start with conservative settings and increase autonomy gradually as you build confidence in the system.
</Warning>
