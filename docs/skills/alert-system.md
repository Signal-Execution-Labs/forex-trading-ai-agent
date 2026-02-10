---
summary: "Alert System Skill - Intelligent notifications"
read_when:
  - Set up alerts
  - Configure notifications
title: "Alert System"
---

# Alert System

The Alert System monitors markets 24/7 and notifies you of important events.

## Alert Types

### Price Alerts

```bash
kit alert BTC/USDT price above 70000
kit alert BTC/USDT price below 60000
kit alert ETH/USDT price at 3500
```

Telegram:
```
"Alert when BTC above 70k"
"Notify me when ETH below 3000"
```

### Percent Change

```bash
kit alert BTC/USDT change +5% --period 1h
kit alert BTC/USDT change -10% --period 24h
```

```
"Alert when BTC rises 5% in 1 hour"
```

### Indicator Alerts

```bash
# RSI
kit alert BTC/USDT rsi above 70
kit alert BTC/USDT rsi below 30

# MACD
kit alert BTC/USDT macd crossover

# Bollinger Bands
kit alert ETH/USDT bb-touch upper
kit alert ETH/USDT bb-touch lower
```

```
"Alert when BTC RSI above 70"
"Notify on MACD crossover"
```

### Volume Alerts

```bash
kit alert BTC/USDT volume above 200%
kit alert ETH/USDT volume spike
```

### Pattern Alerts

```bash
kit alert BTC/USDT pattern "bullish engulfing"
kit alert ETH/USDT pattern "head and shoulders"
```

### Portfolio Alerts

```bash
kit alert portfolio total above 50000
kit alert portfolio total below 10000
kit alert portfolio change -5%
```

## Alert Management

### List Alerts

```bash
kit alerts
kit alerts --active
kit alerts --triggered
```

```
"Show my alerts"
```

Output:
```
📋 Active Alerts (5)
═══════════════════════════════════════
ID    Type      Asset      Condition        Status
─────────────────────────────────────────────────
#1    Price     BTC/USDT   > $70,000        ⏳ Active
#2    Price     BTC/USDT   < $60,000        ⏳ Active
#3    RSI       ETH/USDT   < 30             ⏳ Active
#4    Change    SOL/USDT   +10% (24h)       ⏳ Active
#5    Volume    BTC/USDT   > 200%           ⏳ Active

Recently Triggered (3):
─────────────────────────────────────────────────
#6    Price     ETH/USDT   > $3,500         ✅ 2h ago
#7    RSI       BTC/USDT   > 70             ✅ Yesterday
#8    Pattern   BTC/USDT   Bullish Engulf   ✅ 3 days
```

### Delete Alert

```bash
kit alerts remove 1
kit alerts remove --all
kit alerts remove --asset BTC/USDT
```

```
"Delete alert #1"
"Delete all alerts"
```

### Pause Alert

```bash
kit alerts pause 1
kit alerts pause --all
kit alerts resume 1
```

## Advanced Alerts

### Combined Conditions

```bash
kit alert BTC/USDT \
  --price-above 68000 \
  --rsi-below 70 \
  --volume-above 150%
```

All conditions must be met.

### Recurring Alerts

```bash
kit alert BTC/USDT price above 70000 --repeat
```

Alert is reactivated after triggering.

### Time-Based Alerts

```bash
# Only during trading hours
kit alert BTC/USDT price above 70000 --hours 9-17

# Only on specific days
kit alert BTC/USDT rsi below 30 --days mon,tue,wed
```

### Cooldown

```bash
kit alert BTC/USDT change +5% --cooldown 1h
```

At least 1 hour between notifications.

## Notification Channels

### Configuration

```json
{
  "skills": {
    "alert-system": {
      "channels": {
        "telegram": {
          "enabled": true,
          "priority": ["critical", "high", "normal"]
        },
        "discord": {
          "enabled": true,
          "priority": ["critical"]
        },
        "email": {
          "enabled": true,
          "address": "you@example.com",
          "priority": ["critical"]
        }
      }
    }
  }
}
```

### Priorities

```bash
# Critical - all channels
kit alert BTC/USDT price below 50000 --priority critical

# High - Telegram + Discord
kit alert BTC/USDT rsi below 30 --priority high

# Normal - only Telegram
kit alert BTC/USDT price above 70000 --priority normal
```

## Smart Alerts

### AI-Powered Alerts

K.I.T. can intelligently suggest alerts:

```bash
kit alerts suggest BTC/USDT
```

Output:
```
💡 Alert Suggestions for BTC/USDT
═══════════════════════════════════════
Based on technical analysis:

1. Support Alert
   Price: $65,000 (strong support)
   "Alert when BTC below $65,000"

2. Resistance Alert
   Price: $70,000 (resistance)
   "Alert when BTC above $70,000"

3. RSI Alert
   RSI approaching overbought (currently 65)
   "Alert when RSI above 70"

[1] Add all
[2] Select
[3] Ignore
```

### Auto-Alerts

```json
{
  "alerts": {
    "auto": {
      "enabled": true,
      "types": [
        "support-break",
        "resistance-break",
        "trend-change",
        "volume-anomaly"
      ]
    }
  }
}
```

## Alert Actions

Alerts can trigger automatic actions:

```json
{
  "alerts": {
    "actions": {
      "BTC-drop-alert": {
        "condition": "price below 60000",
        "action": "notify",
        "message": "BTC Critical Level!"
      },
      "RSI-oversold": {
        "condition": "rsi below 25",
        "action": "buy",
        "amount": 100,
        "requireConfirmation": true
      }
    }
  }
}
```

## Notification Format

### Standard Format

```
🔔 ALERT: BTC/USDT
─────────────────────
Condition: Price > $70,000
Current: $70,150 (+0.2%)

Time: Jan 15, 2024 14:32 UTC
```

### Detailed Format

```
🔔 ALERT: BTC/USDT
═══════════════════════════════════════
Condition: RSI < 30 (Oversold)
Current: RSI = 28

Context:
• Price: $62,500 (-5.2% 24h)
• Volume: +180% vs average
• Support: $61,000

Recommendation: 🟢 Possible buying opportunity

[📊 Chart] [💰 Buy] [❌ Ignore]
```

## Statistics

```bash
kit alerts stats
```

```
📊 Alert Statistics (30 days)
═══════════════════════════════════════
Total created: 45
Triggered: 23 (51%)
Deleted: 12
Active: 10

Profitable (after alert trade):
• Winners: 15 (65%)
• Losers: 8 (35%)
• Average: +2.3%

Top Alert Types:
1. RSI Oversold: 8 hits, +4.5% avg
2. Support Break: 6 hits, +3.2% avg
3. Volume Spike: 5 hits, +2.1% avg
```

## Next Steps

<Columns>
  <Card title="Market Analysis" href="/skills/market-analysis" icon="bar-chart">
    Technical analysis for better alerts.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Connect alerts with automatic trades.
  </Card>
  <Card title="Telegram Channel" href="/channels/telegram" icon="message-square">
    Set up Telegram notifications.
  </Card>
</Columns>
