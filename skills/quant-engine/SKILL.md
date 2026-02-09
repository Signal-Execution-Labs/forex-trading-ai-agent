---
name: quant-engine
description: Quantitative trading strategies from Wall Street. Statistical arbitrage, mean reversion, momentum, and factor-based strategies.
metadata:
  {
    "kit":
      {
        "emoji": "📐",
        "category": "trading",
        "tier": "premium",
        "requires": { 
          "skills": ["market-analysis", "backtester"]
        }
      }
  }
---

# Quant Engine 📐

**Wall Street algorithms for everyone.** Professional quantitative strategies that institutional traders use to generate alpha.

## Strategy Library

### 1. Mean Reversion
Profit when prices deviate from their mean and revert.

```bash
kit quant mean-reversion BTC/USDT

# Output:
📐 Mean Reversion Analysis: BTC/USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Price: $50,000
20-day Mean:   $48,500
Z-Score:       +1.8 (1.8 std devs above mean)

Signal: OVERBOUGHT - Consider Short

Historical Performance:
• When Z > 1.5: 68% revert within 5 days
• Average reversion: -3.2%
• Optimal entry: Z > 2.0
• Optimal exit: Z < 0.5

Backtest (1 year):
• Win Rate: 62%
• Avg Profit: +1.8%
• Sharpe: 1.45
• Max Drawdown: -12%

[ACTIVATE STRATEGY]
```

### 2. Momentum
Follow the trend - winners keep winning.

```bash
kit quant momentum --top 10

# Output:
📐 Momentum Rankings (Crypto Top 100)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Momentum Score = (12-month return) × (1 - volatility)

TOP MOMENTUM:
┌──────┬────────┬───────────┬───────────┬──────────┐
│ Rank │ Asset  │ 30d Ret   │ 90d Ret   │ Score    │
├──────┼────────┼───────────┼───────────┼──────────┤
│ 1    │ SOL    │ +45%      │ +180%     │ 0.92     │
│ 2    │ AVAX   │ +38%      │ +120%     │ 0.85     │
│ 3    │ INJ    │ +52%      │ +200%     │ 0.83     │
│ 4    │ BTC    │ +15%      │ +45%      │ 0.78     │
│ 5    │ ETH    │ +12%      │ +38%      │ 0.72     │
└──────┴────────┴───────────┴───────────┴──────────┘

WORST MOMENTUM (Avoid):
┌──────┬────────┬───────────┬───────────┬──────────┐
│ Rank │ Asset  │ 30d Ret   │ 90d Ret   │ Score    │
├──────┼────────┼───────────┼───────────┼──────────┤
│ 96   │ LUNA2  │ -25%      │ -60%      │ 0.12     │
│ 97   │ FTT    │ -30%      │ -70%      │ 0.08     │
│ 98   │ CEL    │ -35%      │ -80%      │ 0.05     │
└──────┴────────┴───────────┴───────────┴──────────┘

Recommended Portfolio:
Long top 5 momentum, rebalance monthly
Backtest Sharpe: 1.89
```

### 3. Pairs Trading
Statistical arbitrage between correlated assets.

```bash
kit quant pairs

# Output:
📐 Pairs Trading Opportunities
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Best Pairs (by cointegration score):

1. BTC/ETH
   ├─ Correlation: 0.85
   ├─ Cointegration: 0.92 (excellent)
   ├─ Current Spread: +2.1 std devs
   ├─ Signal: LONG ETH / SHORT BTC
   └─ Expected Profit: 2.3%

2. SOL/AVAX
   ├─ Correlation: 0.78
   ├─ Cointegration: 0.85
   ├─ Current Spread: -1.8 std devs
   ├─ Signal: LONG SOL / SHORT AVAX
   └─ Expected Profit: 1.9%

3. LINK/UNI
   ├─ Correlation: 0.72
   ├─ Cointegration: 0.79
   ├─ Current Spread: Normal (no trade)
   └─ Signal: WAIT

Historical Performance (Pairs Strategy):
• Win Rate: 71%
• Avg Profit: 1.2%
• Sharpe: 2.1
• Max Drawdown: -8%
```

### 4. Factor Investing
Multi-factor model for crypto assets.

```bash
kit quant factors

# Output:
📐 Factor Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Active Factors:

1. VALUE (Cheap vs Expensive)
   Metric: Market Cap / Active Users
   Top Value: MATIC, ATOM, DOT
   
2. MOMENTUM (Winners vs Losers)
   Metric: 6-month risk-adjusted return
   Top Momentum: SOL, INJ, AVAX
   
3. QUALITY (Strong vs Weak)
   Metric: Developer activity + TVL growth
   Top Quality: ETH, SOL, MATIC
   
4. LOW VOLATILITY
   Metric: 90-day realized volatility
   Lowest Vol: BTC, ETH, BNB
   
5. SIZE (Small vs Large)
   Metric: Market cap percentile
   Small Cap Gems: INJ, TIA, SEI

Multi-Factor Portfolio:
┌─────────┬────────┬───────────────────────────────┐
│ Asset   │ Weight │ Factor Exposure               │
├─────────┼────────┼───────────────────────────────┤
│ BTC     │ 25%    │ Quality, Low Vol              │
│ ETH     │ 20%    │ Quality, Value                │
│ SOL     │ 15%    │ Momentum, Quality             │
│ MATIC   │ 12%    │ Value, Quality                │
│ INJ     │ 10%    │ Momentum, Size, Value         │
│ AVAX    │ 10%    │ Momentum                      │
│ ATOM    │ 8%     │ Value                         │
└─────────┴────────┴───────────────────────────────┘

Expected Alpha: +15% annually
Sharpe Ratio: 1.65
```

### 5. Market Making
Provide liquidity and earn the spread.

```bash
kit quant market-make BTC/USDT

# Output:
📐 Market Making Strategy: BTC/USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Orderbook:
Best Bid: $49,990
Best Ask: $50,010
Spread: $20 (0.04%)

Our Quotes:
├─ Bid: $49,985 (size: 0.1 BTC)
├─ Ask: $50,015 (size: 0.1 BTC)
└─ Our Spread: $30 (0.06%)

Expected P&L:
• Trades/hour: ~50
• Avg profit/trade: $1.50
• Hourly profit: $75
• Daily profit: $1,800

Risks:
• Inventory risk: May accumulate position
• Adverse selection: Smart traders pick us off
• Volatility: Spread widens in volatile markets

Settings:
├─ Spread multiplier: 1.5x
├─ Max inventory: 1 BTC
├─ Skew on inventory: Yes
└─ Cancel on large moves: Yes
```

### 6. Grid Trading
Automated buy low, sell high in a range.

```bash
kit quant grid BTC/USDT --range 45000-55000 --grids 20

# Output:
📐 Grid Trading Setup: BTC/USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Range: $45,000 - $55,000
Grid Size: $500 (20 grids)
Investment: $10,000

Grid Levels:
$55,000 ──┬── Sell
$54,500 ──┼── Sell
$54,000 ──┼── Sell
...
$50,250 ←─┼── Current Price
$50,000 ──┼── Buy
$49,500 ──┼── Buy
...
$45,000 ──┴── Buy

Orders Placed: 20
• 10 buy orders below current price
• 10 sell orders above current price

Expected Returns (if price oscillates):
• Per round trip: $50 (0.5%)
• Monthly (avg 60 trips): $3,000 (30%)

Risks:
• Price breaks range → hold position
• One-directional move → opportunity cost

[ACTIVATE GRID]
```

## Strategy Builder

```bash
kit quant build

# Interactive strategy builder
📐 Quant Strategy Builder
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: Choose Base Strategy
> 1. Mean Reversion
> 2. Momentum
> 3. Pairs Trading
> 4. Custom Signals

Step 2: Define Entry Rules
> Z-Score > 2.0 AND RSI < 30 AND Volume > 1.5x avg

Step 3: Define Exit Rules
> Z-Score < 0.5 OR Stop Loss -3% OR Take Profit +5%

Step 4: Position Sizing
> Risk 2% per trade, max 10% portfolio

Step 5: Backtest Period
> 2 years

Running backtest...

Results:
• Total Return: +145%
• Sharpe Ratio: 1.78
• Max Drawdown: -18%
• Win Rate: 58%
• Profit Factor: 2.1

[SAVE STRATEGY] [DEPLOY STRATEGY]
```

## API

```typescript
import { QuantEngine } from '@binaryfaster/kit';

const quant = new QuantEngine();

// Mean reversion signal
const mrSignal = await quant.meanReversion('BTC/USDT', {
  lookback: 20,
  entryThreshold: 2.0,
  exitThreshold: 0.5
});

// Momentum ranking
const momentum = await quant.momentumRank({
  universe: 'top100',
  period: 90
});

// Pairs trading
const pairs = await quant.findPairs({
  minCorrelation: 0.7,
  minCointegration: 0.8
});

// Factor model
const factors = await quant.factorModel({
  factors: ['momentum', 'value', 'quality'],
  rebalance: 'monthly'
});

// Deploy strategy
await quant.deploy('my-momentum-strategy', {
  capital: 10000,
  mode: 'paper'  // or 'live'
});
```

## Configuration

```yaml
# TOOLS.md
quant_engine:
  strategies:
    mean_reversion:
      enabled: true
      pairs: ["BTC/USDT", "ETH/USDT"]
      lookback: 20
      entry_z: 2.0
      exit_z: 0.5
      
    momentum:
      enabled: true
      universe: "top50"
      rebalance: "weekly"
      top_n: 5
      
    pairs_trading:
      enabled: true
      pairs: [["BTC", "ETH"], ["SOL", "AVAX"]]
      
    grid:
      enabled: false
      # Requires manual setup
      
  # Risk controls
  max_strategy_allocation: 20%
  max_total_quant: 50%
```
