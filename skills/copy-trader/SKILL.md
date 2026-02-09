---
name: copy-trader
description: Social trading - copy the best traders automatically. Track whales, influencers, and top performers.
metadata:
  {
    "kit":
      {
        "emoji": "👥",
        "category": "social",
        "tier": "premium",
        "requires": { 
          "skills": ["exchange-connector"]
        }
      }
  }
---

# Copy Trader 👥

**Trade like the pros.** Automatically copy successful traders, track whale wallets, and follow smart money.

## Features

### 1. Whale Tracking
Follow the biggest wallets in crypto.

```bash
kit copy whales

# Output:
🐋 Whale Tracker - Live
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Recent Whale Movements (>$1M):

🟢 5 min ago - BUY
   Wallet: 0x7a25...3f4d (Smart Money #12)
   Asset: ETH
   Amount: 2,500 ETH ($7.5M)
   Exchange: From Binance to Cold Wallet
   Interpretation: Accumulation

🔴 12 min ago - SELL
   Wallet: 0x3b12...8e9a (Exchange Hot Wallet)
   Asset: BTC
   Amount: 150 BTC ($7.5M)
   Exchange: Coinbase internal
   Interpretation: Customer withdrawal (neutral)

🟢 25 min ago - BUY
   Wallet: 0x9d45...2c1b (Known Fund)
   Asset: SOL
   Amount: 50,000 SOL ($5M)
   Exchange: OTC to self-custody
   Interpretation: BULLISH

Net Whale Flow (24h):
• BTC: +$45M inflow (bullish)
• ETH: +$23M inflow (bullish)
• SOL: +$12M inflow (bullish)
• Stablecoins: -$80M outflow (risk-on)
```

### 2. Top Trader Leaderboard
Find and copy the best performers.

```bash
kit copy leaderboard

# Output:
👥 Top Traders Leaderboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Last 30 Days Performance:

┌──────┬─────────────────┬─────────┬──────────┬─────────┬───────────┐
│ Rank │ Trader          │ Return  │ Win Rate │ Sharpe  │ Copiers   │
├──────┼─────────────────┼─────────┼──────────┼─────────┼───────────┤
│ 1    │ CryptoKing_89   │ +89%    │ 78%      │ 2.45    │ 1,234     │
│ 2    │ WhaleHunter     │ +67%    │ 72%      │ 2.12    │ 892       │
│ 3    │ TrendMaster     │ +54%    │ 68%      │ 1.98    │ 756       │
│ 4    │ ScalpingPro     │ +48%    │ 82%      │ 1.87    │ 543       │
│ 5    │ DiamondHands    │ +42%    │ 65%      │ 1.76    │ 421       │
└──────┴─────────────────┴─────────┴──────────┴─────────┴───────────┘

All-Time Best:
┌──────┬─────────────────┬─────────┬──────────┬─────────┐
│ Rank │ Trader          │ Return  │ Months   │ Max DD  │
├──────┼─────────────────┼─────────┼──────────┼─────────┤
│ 1    │ OGTrader        │ +1,245% │ 24       │ -25%    │
│ 2    │ BullMarketKing  │ +890%   │ 18       │ -30%    │
│ 3    │ AlphaSeeker     │ +678%   │ 12       │ -22%    │
└──────┴─────────────────┴─────────┴──────────┴─────────┘
```

### 3. Trader Profile Analysis

```bash
kit copy profile CryptoKing_89

# Output:
👤 Trader Profile: CryptoKing_89
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Verified: ✅
Active Since: Jan 2022
Copiers: 1,234
AUM: $2.3M (copy capital)

Performance:
├─ 30 Days: +89%
├─ 90 Days: +156%
├─ 1 Year: +423%
└─ All Time: +1,890%

Risk Metrics:
├─ Max Drawdown: -18%
├─ Sharpe Ratio: 2.45
├─ Win Rate: 78%
└─ Avg Trade Duration: 4.2 days

Trading Style:
├─ Type: Swing Trader
├─ Timeframe: 4H - Daily
├─ Assets: BTC, ETH, SOL, AVAX
└─ Avg Positions: 3-5

Recent Trades:
┌────────────┬──────────┬────────┬─────────┬─────────┐
│ Date       │ Asset    │ Side   │ Entry   │ P&L     │
├────────────┼──────────┼────────┼─────────┼─────────┤
│ Feb 8      │ SOL      │ Long   │ $95     │ +12%    │
│ Feb 6      │ BTC      │ Long   │ $48,500 │ +5%     │
│ Feb 3      │ ETH      │ Long   │ $2,800  │ +8%     │
│ Jan 30     │ AVAX     │ Long   │ $32     │ +18%    │
└────────────┴──────────┴────────┴─────────┴─────────┘

Current Positions:
• BTC Long: $50,000 (+2.5%)
• SOL Long: $98 (+3.2%)

[COPY THIS TRADER]
```

### 4. Copy Trading Setup

```bash
kit copy start CryptoKing_89

# Output:
👥 Copy Trading Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trader: CryptoKing_89
Mode: Proportional Copy

Settings:
├─ Allocation: $5,000 (5% of portfolio)
├─ Copy Ratio: 1:1 (their 1% = your 1%)
├─ Max Per Trade: $1,000
├─ Stop Loss Override: -10%
└─ Copy Existing Positions: Yes

Risk Limits:
├─ Max Drawdown: -15% (auto-stop)
├─ Max Daily Loss: -5%
└─ Slippage Limit: 0.5%

What Gets Copied:
✅ Entry signals
✅ Exit signals
✅ Position sizing (proportional)
✅ Stop losses
❌ Leverage (you choose: 1x)

Ready to Start?
[CONFIRM] [EDIT SETTINGS] [CANCEL]
```

### 5. Multi-Trader Portfolio

```bash
kit copy portfolio

# Output:
👥 Copy Trading Portfolio
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Allocated: $15,000
Total P&L: +$2,340 (+15.6%)

Active Copies:
┌─────────────────┬────────────┬─────────┬─────────────┐
│ Trader          │ Allocation │ P&L     │ Status      │
├─────────────────┼────────────┼─────────┼─────────────┤
│ CryptoKing_89   │ $5,000     │ +$890   │ 2 positions │
│ WhaleHunter     │ $5,000     │ +$1,200 │ 3 positions │
│ TrendMaster     │ $5,000     │ +$250   │ 1 position  │
└─────────────────┴────────────┴─────────┴─────────────┘

Copied Positions:
┌────────────┬─────────────────┬────────┬─────────┐
│ Asset      │ From            │ Size   │ P&L     │
├────────────┼─────────────────┼────────┼─────────┤
│ BTC        │ CryptoKing_89   │ $1,500 │ +5.2%   │
│ SOL        │ CryptoKing_89   │ $1,000 │ +8.1%   │
│ ETH        │ WhaleHunter     │ $2,000 │ +3.5%   │
│ AVAX       │ WhaleHunter     │ $1,500 │ +12.3%  │
│ BTC        │ WhaleHunter     │ $1,000 │ +2.1%   │
│ LINK       │ TrendMaster     │ $800   │ +4.5%   │
└────────────┴─────────────────┴────────┴─────────┘
```

### 6. Smart Money Alerts

```bash
kit copy alerts

# Output:
🔔 Smart Money Alerts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Active Alerts:

1. Whale Accumulation Alert
   Trigger: >$10M inflow to cold wallets
   Status: ✅ Active
   Last Triggered: 2h ago (ETH)

2. Exchange Outflow Alert
   Trigger: >5% of exchange balance withdrawn
   Status: ✅ Active
   Last Triggered: 6h ago (BTC)

3. Top Trader New Position
   Trigger: CryptoKing_89 opens position
   Status: ✅ Active
   Last Triggered: 8h ago (SOL)

4. Influencer Trade Alert
   Watching: @CryptoCapo, @Pentosh1
   Status: ✅ Active
   
Recent Alerts:
├─ 2h ago: 🐋 Whale bought 2,500 ETH
├─ 6h ago: 📤 1,200 BTC left Binance
├─ 8h ago: 👤 CryptoKing_89 longed SOL
└─ 12h ago: 🐋 $50M USDT moved to exchanges
```

## API

```typescript
import { CopyTrader } from '@binaryfaster/kit';

const copy = new CopyTrader();

// Get leaderboard
const leaders = await copy.getLeaderboard({
  period: '30d',
  minTrades: 10,
  minWinRate: 0.6
});

// Copy a trader
await copy.copyTrader('CryptoKing_89', {
  allocation: 5000,
  maxPerTrade: 1000,
  stopLoss: -0.10
});

// Track whale wallets
copy.trackWhale('0x7a25...3f4d', (tx) => {
  console.log(`Whale moved: ${tx.amount} ${tx.asset}`);
});

// Get whale movements
const whaleMovements = await copy.getWhaleMovements({
  minAmount: 1000000,
  period: '24h'
});
```

## Configuration

```yaml
# TOOLS.md
copy_trader:
  enabled: true
  
  # Global limits
  max_copy_allocation: 20%  # of total portfolio
  max_per_trader: 10%
  
  # Copy settings
  default_copy_ratio: 1.0
  max_slippage: 0.5%
  copy_stop_losses: true
  
  # Whale tracking
  whale_alert_threshold: 1000000  # $1M
  tracked_wallets: []  # Add specific wallets
  
  # Notifications
  notify_on:
    - whale_movement
    - trader_position
    - copy_executed
```
