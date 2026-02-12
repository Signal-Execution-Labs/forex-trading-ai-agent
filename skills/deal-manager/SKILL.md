# Deal Manager Skill

Advanced deal lifecycle management inspired by 3Commas SmartTrade.

## Overview

Manages the complete lifecycle of trading deals from entry to exit, including:
- Active deal monitoring and management
- Safety orders (DCA into losing positions)
- Take profit chains (multiple TP levels)
- Trailing take profit and stop loss
- Deal cancellation and pause functionality
- Position averaging and scaling

## Features

### 1. Deal Creation
- Single entry or scaled entries
- Limit, market, or conditional orders
- Pre-configured safety order chains
- Multiple take profit targets

### 2. Safety Orders (3Commas Style)
- Automatic additional buys when price drops
- Configurable deviation percentages (1%, 2%, 3%...)
- Volume scaling (1x, 1.5x, 2x...)
- Maximum safety orders limit
- Average entry price recalculation

### 3. Take Profit Chains
- Multiple TP levels (TP1: 25%, TP2: 50%, TP3: 100%)
- Percentage or fixed price targets
- Partial position closing at each level
- Trailing activation after TP hit

### 4. Trailing Features
- Trailing take profit (follows price up)
- Trailing stop loss (protects gains)
- Trailing deviation percentage
- Activation price threshold

### 5. Deal Controls
- Cancel deal (close at market)
- Pause deal (freeze all orders)
- Resume deal (reactivate orders)
- Edit deal parameters mid-trade
- Emergency close all deals

### 6. Deal Analytics
- Real-time P&L tracking
- Average entry price
- Break-even price
- Safety orders triggered count
- Time in trade

## Commands

```
deal create <symbol> <side> <amount> [options]
deal list [--active|--completed|--cancelled]
deal status <deal_id>
deal cancel <deal_id> [--market|--limit]
deal pause <deal_id>
deal resume <deal_id>
deal edit <deal_id> [options]
deal close-all [--symbol <symbol>]
deal add-safety <deal_id> [--amount <amt>] [--deviation <pct>]
deal add-tp <deal_id> --price <price> --percent <pct>
deal history [--symbol <symbol>] [--days <n>]
```

## Configuration

```yaml
deal_manager:
  default_safety_orders: 3
  safety_deviation_start: 1.5  # First SO at -1.5%
  safety_deviation_step: 1.0   # Each subsequent +1%
  safety_volume_scale: 1.5     # Each SO 1.5x previous
  max_safety_orders: 10
  
  default_take_profits:
    - percent: 25
      close_percent: 33
    - percent: 50
      close_percent: 33
    - percent: 100
      close_percent: 34
  
  trailing:
    enabled: true
    activation: 1.0  # Activate after 1% profit
    deviation: 0.5   # Trail by 0.5%
  
  emergency:
    max_loss_percent: 15
    auto_close: true
```

## Example Workflows

### Basic Long Deal with Safety Orders
```
deal create BTC/USDT long 0.01 \
  --entry-type limit \
  --entry-price 60000 \
  --safety-orders 5 \
  --safety-deviation 2% \
  --take-profit 65000
```

### Multi-TP Deal with Trailing
```
deal create ETH/USDT long 1.0 \
  --tp1 "3500:30%" \
  --tp2 "3700:40%" \
  --tp3 "4000:30%" \
  --trailing-after-tp1 \
  --trailing-deviation 1%
```

### Scale Into Position
```
deal create SOL/USDT long 10 \
  --scale-entries "100:25%,95:25%,90:25%,85:25%" \
  --take-profit 120 \
  --stop-loss 80
```

## Integration

- Works with all exchange connectors
- Syncs with paper-trading skill for testing
- Exports to trade-journal skill
- Triggers alerts via alert-system skill

## Inspired By

- 3Commas SmartTrade and DCA Bot
- Cornix Telegram bot deal management
- Bitsgap deal chains
