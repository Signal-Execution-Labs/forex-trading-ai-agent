# Multi-Copy Manager

Copy up to 100 traders simultaneously with smart allocation.

## Overview
Like eToro's multi-copy feature: diversify your copy trading by following multiple signal providers at once with intelligent capital distribution.

## Allocation Strategies

### 1. Equal Weight
```yaml
strategy: equal
traders: 10
capital: $10,000
allocation: $1,000 each (10%)
```

### 2. Performance Weighted
```yaml
strategy: performance
metric: sharpe_ratio  # or returns, win_rate

# Auto-adjusts based on performance
high_performers: 40% allocation
medium_performers: 35% allocation
low_performers: 25% allocation
```

### 3. Risk Parity
```yaml
strategy: risk_parity
target_vol: 15%

# Lower weight to volatile traders
volatile_trader: 5% allocation
stable_trader: 15% allocation
# Total portfolio volatility = 15%
```

### 4. Custom Allocation
```yaml
allocations:
  TrendMaster: 25%
  ScalpKing: 15%
  CryptoGuru: 20%
  SwingPro: 15%
  ValueInvestor: 25%
```

## Smart Features

### Correlation Filter
```
Analyzing trader correlations...

⚠️ Warning: TrendMaster & CryptoGuru correlation = 0.85
   Both hold similar positions

Suggestion: Remove one or reduce allocation
```

### Auto-Rebalance
```yaml
rebalance:
  trigger: drift_threshold  # or calendar
  threshold: 10%            # Rebalance when 10% drift
  frequency: monthly        # Max 1x per month
```

### Performance Tracking
```
Multi-Copy Portfolio Performance:
├── Total Return: +23.5%
├── vs S&P 500: +8.2%
├── Best Performer: ScalpKing (+45%)
├── Worst Performer: ValueInvestor (+5%)
├── Max Drawdown: -12%
└── Sharpe Ratio: 1.8
```

## Risk Management

### Per-Trader Limits
```yaml
limits:
  max_allocation: 25%    # No single trader > 25%
  min_allocation: 5%     # Below this, don't copy
  max_drawdown: 20%      # Pause if DD > 20%
  daily_loss_limit: 5%   # Stop copying for day
```

### Portfolio Limits
```yaml
portfolio:
  max_traders: 100
  max_positions: 50      # Total across all traders
  max_leverage: 3x
  hedge_requirement: false
```

### Auto-Remove Rules
```yaml
auto_remove:
  - condition: drawdown > 30%
    action: stop_copy
  - condition: inactive > 30 days
    action: warning
  - condition: win_rate < 40% (90 days)
    action: reduce_allocation
```

## Discovery & Selection

### Trader Search
```
Filters:
├── Asset Class: Crypto, Forex, Stocks
├── Risk Score: 1-5 (conservative to aggressive)
├── Min Track Record: 6 months
├── Min Copiers: 50
├── Max Drawdown: <25%
└── Return: >20% annually
```

### Suggested Portfolios
```
Pre-built multi-copy portfolios:

1. "Conservative Mix" (5 traders)
   - 3 low-risk, 2 medium-risk
   - Target: 15% annual, <10% DD
   
2. "Crypto Alpha" (8 traders)
   - All crypto specialists
   - Target: 50% annual, <30% DD
   
3. "Diversified Global" (15 traders)
   - Stocks, forex, crypto, commodities
   - Target: 25% annual, <15% DD
```

## Commands
```bash
kit multi-copy add --trader ScalpKing --allocation 15%
kit multi-copy remove --trader ValueInvestor
kit multi-copy rebalance --strategy performance
kit multi-copy status
kit multi-copy performance --period 6m
kit multi-copy suggest --risk medium --capital 10000
```
