---
name: etoro-connector
description: eToro API integration - CopyTrader, real-time market data, portfolio analytics, and social features
metadata:
  {
    "kit":
      {
        "emoji": "🌐",
        "category": "social",
        "tier": "premium",
        "requires": { 
          "skills": ["copy-trader"]
        }
      }
  }
---

# eToro Connector 🌐

**Connect to eToro's Public APIs.** Access real-time market data, copy top traders, and leverage social trading features.

> eToro launched public APIs in October 2025, providing free access to real-time market data, portfolio analytics, and social features.

## Features

### 1. CopyTrader™ Integration
Copy up to 100 traders at once with eToro's flagship feature.

```bash
kit etoro discover

# Output:
🌐 eToro Top Traders
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Filter by: Strategy | Performance | Risk Score | Assets

Popular Investors:
┌──────┬─────────────────┬─────────┬──────────┬─────────┬───────────┐
│ Rank │ Username        │ Return  │ Risk     │ Copiers │ AUM       │
├──────┼─────────────────┼─────────┼──────────┼─────────┼───────────┤
│ 1    │ @jaynemesis     │ +42.3%  │ 4/10     │ 15,234  │ $45M      │
│ 2    │ @misterfx       │ +38.7%  │ 5/10     │ 12,892  │ $32M      │
│ 3    │ @olivierdanvel  │ +35.2%  │ 3/10     │ 9,756   │ $28M      │
│ 4    │ @tradingthomas  │ +31.8%  │ 4/10     │ 7,543   │ $19M      │
│ 5    │ @cryptoexpert   │ +45.1%  │ 7/10     │ 6,421   │ $15M      │
└──────┴─────────────────┴─────────┴──────────┴─────────┴───────────┘

Filters Applied: Min 12mo history | Min 100 copiers
```

### 2. Real-Time Market Data (Free API)

```bash
kit etoro markets

# Output:
📊 eToro Market Data
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Stocks:                     Crypto:
• AAPL: $187.50 (+1.2%)     • BTC: $51,230 (+2.1%)
• TSLA: $178.90 (+0.8%)     • ETH: $2,890 (+3.4%)
• NVDA: $875.30 (+2.5%)     • SOL: $105.20 (+5.2%)
• MSFT: $412.80 (+0.5%)     • AVAX: $38.50 (+4.1%)

ETFs:                       Commodities:
• SPY: $512.30 (+0.3%)      • Gold: $2,045 (+0.2%)
• QQQ: $445.20 (+0.6%)      • Oil: $76.80 (-1.1%)
• VOO: $470.15 (+0.4%)      • Silver: $22.90 (+0.5%)

Market Sentiment: BULLISH 🟢
Social Buzz: TSLA trending (+340% mentions)
```

### 3. Portfolio Analytics

```bash
kit etoro portfolio

# Output:
📈 eToro Portfolio Analytics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Value: $52,340
Cash: $5,200 (10%)
Invested: $47,140 (90%)

Asset Allocation:
├─ Stocks: 45% ($21,213)
├─ Crypto: 35% ($16,499)
├─ ETFs: 15% ($7,071)
└─ Commodities: 5% ($2,357)

Performance:
├─ Today: +$312 (+0.6%)
├─ Week: +$1,890 (+3.7%)
├─ Month: +$4,230 (+8.8%)
└─ YTD: +$12,450 (+31.2%)

Risk Analysis:
├─ Portfolio Beta: 1.23
├─ Volatility (30d): 18.5%
├─ Sharpe Ratio: 1.87
└─ Max Drawdown: -12.3%

Diversification Score: 7.2/10
Recommendation: Add commodities exposure
```

### 4. Social Features

```bash
kit etoro social

# Output:
💬 eToro Social Feed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Trending Topics:
1. #Bitcoin - 12,340 posts
2. #Tesla - 8,920 posts
3. #AI - 6,780 posts

Top Posts from Copied Traders:

@jaynemesis (2h ago):
"Adding to my BTC position here. $50k support 
holding strong. Target $60k by end of month."
👍 1,234 | 💬 89 | 🔄 45

@misterfx (4h ago):
"Closed my EUR/USD short at 1.0820. 
+180 pips profit. Waiting for next setup."
👍 892 | 💬 56 | 🔄 23

@cryptoexpert (6h ago):
"SOL breaking out. My top altcoin pick for 2026."
👍 2,456 | 💬 234 | 🔄 156
```

### 5. Smart Copy Allocation

```bash
kit etoro smartcopy

# Output:
🧠 eToro Smart Copy Setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

K.I.T. analyzed 500+ Popular Investors and recommends:

Diversified Copy Portfolio ($10,000):

Low Risk Bundle (40% - $4,000):
├─ @olivierdanvel: $2,000 (3/10 risk)
└─ @conservative_joe: $2,000 (2/10 risk)

Medium Risk Bundle (40% - $4,000):
├─ @jaynemesis: $2,000 (4/10 risk)
└─ @tradingthomas: $2,000 (4/10 risk)

High Risk/High Reward (20% - $2,000):
└─ @cryptoexpert: $2,000 (7/10 risk)

Expected Performance:
├─ Target Return: +25-40% annually
├─ Max Drawdown: -15%
├─ Diversification: 5 traders across strategies
└─ Correlation: Low (0.32 avg between traders)

[DEPLOY PORTFOLIO] [CUSTOMIZE] [SIMULATE]
```

## API Integration

```typescript
import { EtoroConnector } from '@kit/skills';

const etoro = new EtoroConnector({
  apiKey: process.env.ETORO_API_KEY,  // Free API key from eToro
});

// Get market data (free, real-time)
const btcPrice = await etoro.getPrice('BTC');
const markets = await etoro.getMarkets(['stocks', 'crypto', 'etfs']);

// Discover Popular Investors
const traders = await etoro.discoverTraders({
  minReturn: 20,
  maxRisk: 6,
  minMonths: 12,
  sortBy: 'copiers'
});

// Get trader details
const profile = await etoro.getTraderProfile('jaynemesis');

// Portfolio analytics
const analytics = await etoro.getPortfolioAnalytics();

// Social feed
const feed = await etoro.getSocialFeed({
  fromCopied: true,
  trending: true
});

// Copy trading (requires connected account)
await etoro.copyTrader('jaynemesis', {
  amount: 2000,
  copyExisting: true,
  stopLoss: -10
});
```

## Configuration

```yaml
# TOOLS.md
etoro:
  enabled: true
  api_key: ${ETORO_API_KEY}
  
  # Market data
  markets:
    - stocks
    - crypto
    - etfs
    - commodities
    - forex
  
  # Copy trading
  copy:
    max_traders: 10
    max_allocation: 30%  # of portfolio
    copy_existing: true
    default_stop_loss: -15%
  
  # Social features
  social:
    follow_copied_traders: true
    notifications: true
  
  # Sync settings
  sync_interval: 5m  # Portfolio sync
```

## Benefits of eToro API

1. **Free Real-Time Data** - Stocks, crypto, ETFs, commodities, forex
2. **Social Insights** - See what traders are saying and doing
3. **Copy Trading** - One-click copy of successful traders
4. **Portfolio Analytics** - Risk metrics, diversification analysis
5. **Multi-Asset** - All markets in one place

## Setup

1. Get free API key at: https://api.etoro.com
2. Add to your K.I.T. config:
   ```bash
   kit config set ETORO_API_KEY=your_key_here
   ```
3. Enable the skill:
   ```bash
   kit skills enable etoro-connector
   ```
