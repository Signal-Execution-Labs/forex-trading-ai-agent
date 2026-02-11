# Smart Trade Skill

**Category:** Trading  
**Inspired by:** 3Commas SmartTrade, Altrady, Cornix

## Overview

Advanced order management with trailing take profit (TTP), multiple targets, and intelligent position management. Goes beyond simple limit orders with professional-grade execution.

## Features

### 1. Entry Options
- **Market**: Instant execution
- **Limit**: Specific price entry
- **Conditional**: Enter on signal/indicator
- **Scaled Entry**: DCA into position (3-10 entries)
- **Break-Even Entry**: Enter only if stop won't be hit

### 2. Take Profit Types
- **Fixed TP**: Single target price
- **Multiple TPs**: Up to 10 targets with custom %
- **Trailing TP (TTP)**: Trail profits with deviation %
- **Scaled Exit**: Gradually exit as price rises
- **Time-Based TP**: Close after X hours/days

### 3. Stop Loss Types
- **Fixed SL**: Static stop price
- **Trailing SL**: Follow price with distance
- **Break-Even SL**: Move SL to entry after profit
- **Time-Based SL**: Stop if no profit after X time
- **Indicator SL**: Exit on signal (RSI, MACD, etc.)

### 4. Advanced Features
- **Move to Break-Even**: Auto after X% profit
- **Partial Close**: Close % at each target
- **Reverse on Stop**: Open opposite position
- **Hedge Mode**: Simultaneous long/short
- **OCO Orders**: One-cancels-other logic

### 5. Smart Conditions
- **Deal Start Conditions**:
  - QFL (Quick Fingers Luc) - flash crash detection
  - TradingView signal via webhook
  - RSI oversold/overbought
  - MACD cross
  - Price % drop from high
  - K.I.T. AI signal
  
- **Deal Close Conditions**:
  - Max duration reached
  - Profit target hit
  - Signal reversal
  - Risk limit exceeded

## Commands

```
kit smart-trade open BTC/USDT long \
  --entry market \
  --size 0.1 \
  --tp 5%,10%,15% --tp-amounts 30%,40%,30% \
  --trailing-tp 1.5% \
  --sl 3% \
  --trailing-sl 2% \
  --break-even 2%
  
kit smart-trade list --status active
kit smart-trade edit <id> --tp 8% --sl 4%
kit smart-trade close <id> --market
kit smart-trade stats --period 30d
```

## Output Format

```json
{
  "trade_id": "ST-2026-0211-001",
  "symbol": "BTC/USDT",
  "direction": "long",
  "status": "active",
  "entry": {
    "type": "scaled",
    "orders": [
      { "price": 45000, "filled": true, "amount": 0.033 },
      { "price": 44500, "filled": true, "amount": 0.033 },
      { "price": 44000, "filled": false, "amount": 0.034 }
    ],
    "avg_price": 44750
  },
  "take_profit": {
    "type": "trailing",
    "targets": [
      { "price": 47000, "amount": "30%", "status": "pending" },
      { "price": 49000, "amount": "40%", "status": "pending" },
      { "price": 52000, "amount": "30%", "status": "pending" }
    ],
    "trailing": { "deviation": "1.5%", "activated": false }
  },
  "stop_loss": {
    "type": "trailing",
    "initial": 43500,
    "current": 44000,
    "break_even": { "trigger": "2%", "activated": true }
  },
  "pnl": {
    "unrealized": "+$125.50",
    "realized": "$0",
    "roi": "+2.8%"
  }
}
```

## Risk Management

- Max concurrent trades per asset
- Max portfolio allocation per trade
- Daily loss limit protection
- Position size calculator integration
- Correlation check before opening

## Exchange Support

- Binance (Spot + Futures)
- Bybit (Spot + Derivatives)
- OKX (Unified)
- KuCoin
- Kraken
- Coinbase Pro
- All MT5 brokers
