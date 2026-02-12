# Trading Competition

> **Skill #94** - Compete risk-free for rankings and rewards

## Overview

Compete against other traders using paper money. Participate in daily, weekly, and special event competitions. Track leaderboards, earn badges, and prove your trading skills without risking real capital.

Inspired by TradingView's "The Leap" competition platform.

## Features

- **Competition Types:** Daily, Weekly, Monthly, Special Events
- **Paper Trading:** No real money required
- **Live Leaderboards:** Real-time rankings
- **Performance Metrics:** Profit, Sharpe, Max DD, Consistency
- **Badges & Achievements:** Unlock trading milestones
- **Prize Pools:** Compete for rewards (optional)
- **Strategy Categories:** Day trading, Swing, Scalping, Crypto

## Usage

```bash
# Join daily competition
kit skill compete join --type daily

# View leaderboard
kit skill compete leaderboard --type weekly

# Check your stats
kit skill compete stats

# Create private competition
kit skill compete create --name "Crypto Masters" --duration 7d --asset-class crypto
```

## Configuration

```yaml
trading_competition:
  default_balance: 100000
  allowed_assets:
    - crypto
    - forex
    - stocks
    - futures
  
  scoring:
    profit_weight: 40%
    sharpe_weight: 25%
    consistency_weight: 20%
    drawdown_penalty: 15%
  
  competition_types:
    daily:
      duration: 24h
      min_trades: 5
      max_leverage: 10x
    
    weekly:
      duration: 7d
      min_trades: 20
      max_leverage: 5x
    
    monthly:
      duration: 30d
      min_trades: 50
      max_leverage: 3x
```

## Scoring System

```
Final Score = (Profit × 0.4) + (Sharpe × 0.25) + (Consistency × 0.20) - (Drawdown × 0.15)

Where:
- Profit: Normalized return percentage
- Sharpe: Risk-adjusted returns (higher = better)
- Consistency: % of profitable days
- Drawdown: Maximum drawdown (penalty)
```

## Example Leaderboard

```json
{
  "competition": "Weekly Crypto Challenge",
  "period": "2026-02-10 to 2026-02-16",
  "participants": 1247,
  "leaderboard": [
    {
      "rank": 1,
      "trader": "AlphaTrader42",
      "profit": 34.2,
      "sharpe": 2.4,
      "trades": 89,
      "score": 892
    },
    {
      "rank": 2,
      "trader": "CryptoKing",
      "profit": 28.7,
      "sharpe": 2.1,
      "trades": 156,
      "score": 847
    },
    {
      "rank": 3,
      "trader": "SwingMaster",
      "profit": 22.5,
      "sharpe": 2.8,
      "trades": 34,
      "score": 823
    }
  ]
}
```

## Badges & Achievements

| Badge | Requirement | Points |
|-------|-------------|--------|
| 🥇 Champion | Win a competition | 500 |
| 🔥 Hot Streak | 5 profitable days in a row | 100 |
| 🎯 Sniper | 80%+ win rate (min 20 trades) | 150 |
| 📈 Consistent | Top 20% for 4 weeks | 200 |
| 🛡️ Risk Manager | Max DD < 5% with profit | 175 |
| 🚀 Rocket | 100%+ return in one competition | 300 |
| 🧠 Strategist | Sharpe > 3.0 | 250 |

## Special Events

```yaml
special_events:
  - name: "Fed Day Challenge"
    trigger: "FOMC announcement days"
    duration: 4h
    rules: "Trade the Fed reaction"
  
  - name: "CPI Madness"
    trigger: "CPI release days"
    duration: 2h
    rules: "First 2 hours after release"
  
  - name: "Halving Hype"
    trigger: "Bitcoin halving event"
    duration: 48h
    rules: "Crypto only"
```

## Anti-Cheat Measures

- **Trade Verification:** All orders must execute at valid prices
- **Slippage Simulation:** Realistic fills based on volume
- **No Future Peeking:** Orders based on candle close, not future data
- **Activity Requirements:** Minimum trades to qualify
- **Leverage Limits:** Prevent unrealistic leverage abuse

## Integration

- **Social:** Share results to community
- **Badges:** Display on profile
- **Stats:** Track lifetime competition performance
- **Replay:** Review top traders' strategies (with permission)
