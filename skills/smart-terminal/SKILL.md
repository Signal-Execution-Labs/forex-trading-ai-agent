# Smart Trading Terminal

Professional trading interface with advanced order types - 3Commas inspired.

## Overview
One terminal to rule all exchanges. Advanced order types, hotkeys, multi-take-profit, and intelligent trailing - all from a unified interface.

## Advanced Order Types

### 1. Trailing Take Profit
```yaml
order:
  type: trailing_tp
  entry: $100
  initial_tp: $110 (+10%)
  trailing_deviation: 2%
  
# Price hits $115 → TP moves to $112.70
# Price hits $120 → TP moves to $117.60
# Price drops to $117.60 → SELL (locked +17.6%)
```

### 2. Trailing Stop Loss
```yaml
order:
  type: trailing_sl
  entry: $100
  initial_sl: $95 (-5%)
  trailing_deviation: 3%
  
# Price rises to $120 → SL moves to $116.40
# Price drops to $116.40 → SELL (locked +16.4%)
```

### 3. Multiple Take Profits
```yaml
order:
  type: multi_tp
  entry: $100
  take_profits:
    - price: $105  # +5%
      size: 30%    # Sell 30%
    - price: $110  # +10%
      size: 30%    # Sell 30%
    - price: $120  # +20%
      size: 40%    # Sell remaining
  stop_loss: $95   # -5%
```

### 4. Scaled Entry (DCA)
```yaml
order:
  type: scaled_entry
  target_position: $1000
  levels:
    - price: $100
      amount: 40%   # $400
    - price: $95
      amount: 30%   # $300
    - price: $90
      amount: 30%   # $300
  avg_entry: ~$96
```

### 5. OCO (One Cancels Other)
```yaml
order:
  type: oco
  entry: $100
  take_profit: $115
  stop_loss: $92
  # First triggered cancels the other
```

### 6. Conditional Orders
```yaml
order:
  type: conditional
  condition: "BTC > $50000"
  then:
    buy: ETH
    amount: $500
```

## Hotkeys
```
Trading Hotkeys:
├── B: Quick buy (market)
├── S: Quick sell (market)
├── L: Limit buy at current
├── Shift+L: Limit sell at current
├── T: Set trailing stop
├── P: Set take profit
├── C: Cancel last order
├── Esc: Cancel all orders
├── 1-9: Position size (10%-90%)
└── Enter: Confirm order
```

## One-Click Trading
```yaml
one_click:
  enabled: true
  default_size: 10%      # of portfolio
  default_sl: 2%         # auto SL
  default_tp: 5%         # auto TP
  confirmation: false    # instant execution
```

## Multi-Exchange Support
```
Connected Exchanges:
├── Binance ✅ (Spot + Futures)
├── Coinbase ✅
├── Kraken ✅
├── KuCoin ✅
├── OKX ✅
├── Bybit ✅
└── + 15 more
```

## Terminal Views

### Trade Panel
```
┌─────────────────────────────────────┐
│ BTC/USDT          $43,250  +2.3%   │
├─────────────────────────────────────┤
│ [BUY]  Amount: [____] USDT         │
│        Type: [Market ▼]            │
│        [x] Trailing TP: 2%         │
│        [x] Multiple TP             │
│        [x] Trailing SL: 3%         │
│                                     │
│        [████ EXECUTE BUY ████]     │
└─────────────────────────────────────┘
```

### Position Manager
```
Open Positions:
┌──────┬────────┬─────────┬─────────┬─────────┐
│ Pair │ Size   │ Entry   │ P&L     │ Actions │
├──────┼────────┼─────────┼─────────┼─────────┤
│ BTC  │ 0.1    │ $42,500 │ +$75    │ TP SL ❌│
│ ETH  │ 1.5    │ $2,800  │ -$30    │ TP SL ❌│
│ SOL  │ 20     │ $95     │ +$120   │ TP SL ❌│
└──────┴────────┴─────────┴─────────┴─────────┘
```

## AI Features
- Suggested SL/TP based on volatility
- Optimal position size calculation
- Entry timing recommendations
- Risk/reward analysis

## Commands
```bash
kit terminal open
kit terminal buy --pair BTC/USDT --amount 1000 --trailing-tp 3%
kit terminal sell --pair ETH/USDT --multi-tp "5%:30%, 10%:30%, 15%:40%"
kit terminal positions
kit terminal cancel --all
kit terminal hotkeys --set
```
