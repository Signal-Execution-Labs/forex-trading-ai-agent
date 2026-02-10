# DCA Bot Skill

Automated Dollar-Cost Averaging bot inspired by 3Commas, with K.I.T. enhancements.

## Overview

The DCA Bot executes intelligent dollar-cost averaging strategies across any exchange. Unlike simple scheduled buys, this bot uses technical indicators and market conditions to optimize entry points.

## Features

### Core DCA Strategies
- **Simple DCA**: Buy fixed amount at fixed intervals
- **Smart DCA**: Buy more when price drops, less when it rises
- **Indicator DCA**: Only DCA when RSI is oversold or other conditions met
- **Hybrid DCA**: Combine time-based and condition-based triggers

### Safety Orders (3Commas-style)
- **Base Order**: Initial buy when bot starts or signal received
- **Safety Orders**: Additional buys when price drops X% from entry
- **Martingale**: Increase safety order size by multiplier
- **Max Safety Orders**: Limit total number of safety orders

### Take Profit Strategies
- **Single TP**: Exit entire position at target %
- **Scaled TP**: Exit in portions (25% at 3%, 50% at 5%, 25% at 10%)
- **Trailing TP**: Lock in profits with trailing stop
- **Dynamic TP**: Adjust target based on volatility

### Stop Loss Options
- **Hard Stop**: Exit at fixed % loss
- **Trailing Stop**: Move stop up as price rises
- **Break-even Stop**: Move stop to entry after X% profit
- **No Stop**: Rely on DCA to average down (high risk)

## Configuration

```yaml
# Example DCA Bot Config
bot:
  name: "BTC Weekly DCA"
  exchange: binance
  symbol: BTC/USDT
  mode: smart_dca

strategy:
  base_order_size: 100       # USDT
  safety_order_size: 50      # USDT
  max_safety_orders: 5
  safety_order_deviation: 2  # % drop to trigger
  safety_order_multiplier: 1.5  # Size increase per order
  
  take_profit: 5             # %
  trailing_take_profit: true
  trailing_deviation: 1      # %
  
  stop_loss: 15              # % (optional)
  
schedule:
  type: interval             # or 'cron' or 'signal'
  interval_hours: 168        # Weekly
  
conditions:
  # Only DCA when these are met
  - indicator: RSI
    timeframe: 1d
    condition: lt
    value: 50
  - indicator: price
    condition: below_sma
    period: 200
```

## API

### Start DCA Bot
```typescript
import { DCABot } from '@kit/skills/dca-bot';

const bot = new DCABot({
  exchange: 'binance',
  symbol: 'BTC/USDT',
  baseOrderSize: 100,
  safetyOrderSize: 50,
  maxSafetyOrders: 5,
  safetyOrderDeviation: 2,
  takeProfit: 5,
  trailingTP: true,
});

await bot.start();
```

### Events
```typescript
bot.on('baseOrder', (order) => console.log('Base order filled:', order));
bot.on('safetyOrder', (order, level) => console.log(`Safety order ${level} filled`));
bot.on('takeProfit', (profit) => console.log('Take profit hit:', profit));
bot.on('stopLoss', (loss) => console.log('Stop loss hit:', loss));
```

### Manual Controls
```typescript
await bot.pause();           // Pause DCA
await bot.resume();          // Resume
await bot.addFunds(100);     // Add to position manually
await bot.closePosition();   // Market sell everything
await bot.setTP(10);         // Adjust take profit
```

## Comparison: K.I.T. vs 3Commas

| Feature | 3Commas | K.I.T. DCA Bot |
|---------|---------|----------------|
| Multi-exchange | ✅ | ✅ |
| Safety orders | ✅ | ✅ |
| Trailing TP | ✅ | ✅ |
| TradingView signals | ✅ | ✅ |
| AI entry optimization | ❌ | ✅ |
| Cross-exchange arbitrage | ❌ | ✅ |
| DeFi integration | ❌ | ✅ |
| Forex/Stocks DCA | ❌ | ✅ |
| Self-hosted | ❌ | ✅ |
| No monthly fees | ❌ | ✅ |

## AI Enhancements

K.I.T.'s DCA bot goes beyond 3Commas:

1. **Smart Entry**: AI predicts optimal entry points using:
   - Order book analysis
   - Historical support levels
   - Whale accumulation patterns
   - News sentiment

2. **Dynamic Sizing**: Adjusts order size based on:
   - Current portfolio allocation
   - Risk metrics
   - Market volatility
   - Correlation with other assets

3. **Cross-Market Intelligence**: 
   - Pauses BTC DCA if stocks crashing (correlation)
   - Accelerates DCA during fear (Fear & Greed Index)
   - Coordinates with other K.I.T. strategies

## Status Commands

```
/dca status           - All running DCA bots
/dca list             - List all configured bots
/dca start <name>     - Start a specific bot
/dca stop <name>      - Stop a bot
/dca stats <name>     - Performance statistics
```

## Integration

Works with:
- `exchange-connector` - Execute trades
- `portfolio-tracker` - Track DCA positions
- `risk-calculator` - Size orders properly
- `alert-system` - Notifications
- `tax-tracker` - Log for taxes
- `tradingview-webhook` - External signals
