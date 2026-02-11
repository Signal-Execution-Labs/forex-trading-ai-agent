# TWAP Bot Skill

Time-Weighted Average Price execution algorithm for K.I.T.

## Overview

TWAP (Time-Weighted Average Price) is an algorithmic execution strategy that breaks up large orders into smaller slices and executes them evenly over a specified time period. This minimizes market impact and achieves the average price over the execution window.

## Use Cases

- **Large Orders**: Execute big positions without moving the market
- **Accumulation**: Build positions gradually at average prices
- **Distribution**: Exit positions smoothly without dumping
- **Dollar-Cost Averaging**: Regular interval buying like DCA but time-based
- **Whale Hiding**: Disguise large trades as normal market activity

## Features

### Execution Modes
- **Standard TWAP**: Equal slices at equal intervals
- **Volume-Weighted TWAP (VWAP hybrid)**: Adjust slice sizes based on historical volume patterns
- **Random TWAP**: Add randomness to timing/sizing to avoid detection
- **Adaptive TWAP**: Adjust execution based on real-time market conditions

### Configuration Options
```typescript
interface TWAPConfig {
  symbol: string;
  side: 'buy' | 'sell';
  totalQuantity: number;
  durationMinutes: number;
  sliceCount?: number;         // Auto-calculated if not set
  minSliceSize?: number;       // Minimum per slice
  maxSliceSize?: number;       // Maximum per slice
  randomizeTime?: boolean;     // Add ±15% jitter to intervals
  randomizeSize?: boolean;     // Add ±10% jitter to sizes
  urgency?: 'low' | 'medium' | 'high';  // Affects slice frequency
  exchanges?: string[];        // Multi-exchange execution
  priceLimit?: number;         // Don't execute if price exceeds limit
  volumeParticipation?: number; // Max % of volume per slice (e.g., 5%)
}
```

### Adaptive Features
- **Liquidity Sensing**: Reduce slice size in thin markets
- **Spread Monitoring**: Pause if spread widens abnormally
- **Price Drift Protection**: Adjust if price moves significantly
- **Completion Targets**: Speed up if falling behind, slow down if ahead

## Commands

### Start TWAP Order
```
/twap start BTC/USDT buy 1.5 duration=60m slices=12
```
Buys 1.5 BTC over 60 minutes in 12 equal slices (0.125 BTC every 5 min).

### Check Status
```
/twap status <order_id>
```

### Cancel TWAP
```
/twap cancel <order_id>
```

### List Active TWAPs
```
/twap list
```

## Example Scenarios

### Accumulate 10 ETH over 4 hours
```typescript
const twap = new TWAPBot({
  symbol: 'ETH/USDT',
  side: 'buy',
  totalQuantity: 10,
  durationMinutes: 240,
  randomizeTime: true,
  randomizeSize: true,
  volumeParticipation: 0.02  // Max 2% of volume
});
```

### Exit 100,000 USDT position smoothly
```typescript
const twap = new TWAPBot({
  symbol: 'BTC/USDT',
  side: 'sell',
  totalQuantity: 100000,  // USDT value
  durationMinutes: 480,    // 8 hours
  urgency: 'low',
  exchanges: ['binance', 'bybit', 'okx']  // Split across exchanges
});
```

## Comparison with Other Strategies

| Strategy | Market Impact | Price Target | Best For |
|----------|--------------|--------------|----------|
| TWAP | Low | Time-based average | Large orders, stealth |
| VWAP | Very Low | Volume-weighted avg | High volume periods |
| DCA | Low | Fixed intervals | Long-term accumulation |
| Grid | Medium | Range-bound | Volatility capture |
| Market | High | Immediate | Urgent execution |

## Integration

Works with all K.I.T. exchange connectors:
- CEX: Binance, Bybit, OKX, Kraken, Coinbase, KuCoin
- DEX: Uniswap, PancakeSwap, 1inch (via smart-router)
- Forex: MT5 (via metatrader skill)

## Alerts

- Slice executed notification
- Execution paused (spread too wide)
- Price limit reached
- TWAP completed with summary
- Error/failure alerts

## API

See `twap-bot.ts` for full implementation.
