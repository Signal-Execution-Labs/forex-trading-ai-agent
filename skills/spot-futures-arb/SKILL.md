# Spot-Futures Arbitrage Skill

Delta-neutral strategy exploiting funding rate differentials between spot and perpetual futures markets.

## Overview

Spot-Futures Arbitrage (also called "Cash and Carry" or "Funding Rate Arbitrage") is a market-neutral strategy that profits from the funding rate mechanism in perpetual futures contracts without taking directional risk.

**How It Works:**
1. Buy spot asset (e.g., 1 BTC)
2. Short equivalent perpetual futures (e.g., 1 BTC-PERP)
3. Collect funding payments when funding rate is positive
4. Hedge is delta-neutral: price movements cancel out

**Typical APY:** 10-50%+ depending on market conditions

## The Funding Rate Mechanism

Perpetual futures have no expiry date. To keep the futures price anchored to spot, exchanges use a funding rate paid between longs and shorts every 8 hours.

- **Positive funding** (market bullish): Longs pay shorts → Short futures, earn funding
- **Negative funding** (market bearish): Shorts pay longs → Long futures, earn funding

## Features

### Core Features
- **Multi-exchange monitoring**: Track funding rates across Binance, Bybit, OKX, dYdX, Hyperliquid
- **Auto-entry/exit**: Open positions when funding exceeds threshold, close when opportunity ends
- **Cross-margin optimization**: Use margin efficiently across positions
- **Real-time P&L tracking**: Track funding collected vs trading fees

### Supported Exchanges
| Exchange | Funding Interval | API Support |
|----------|-----------------|-------------|
| Binance | 8h | ✅ Full |
| Bybit | 8h | ✅ Full |
| OKX | 8h | ✅ Full |
| dYdX | 1h | ✅ Full |
| Hyperliquid | 1h | ✅ Full |
| Kraken | 4h | ✅ Full |

### Risk Management
- **Max position size**: Per-asset and total portfolio limits
- **Funding threshold**: Only enter when rate exceeds minimum (e.g., 0.01%)
- **Auto-exit triggers**: Close if funding turns negative beyond threshold
- **Liquidation protection**: Monitor margin ratios, auto-reduce if needed
- **Hedging accuracy**: Ensure spot and futures positions stay balanced

## Configuration

```typescript
interface SpotFuturesArbConfig {
  // Entry criteria
  minFundingRate: number;         // Minimum annualized rate to enter (e.g., 0.15 = 15%)
  minFundingPeriods: number;      // Consecutive positive periods before entry
  
  // Position sizing
  maxPositionSize: number;        // Max per-asset in USD
  maxTotalExposure: number;       // Max total portfolio exposure
  leverageMultiplier: number;     // Futures leverage (1x = no leverage)
  
  // Risk management
  stopLossRate: number;           // Exit if funding turns this negative
  minMarginRatio: number;         // Reduce position if margin falls below
  maxSlippage: number;            // Max acceptable slippage on entry/exit
  
  // Execution
  preferredExchanges: string[];   // Priority order for execution
  hedgeOnSameExchange: boolean;   // Keep spot and futures on same exchange
  rebalanceThreshold: number;     // Rebalance if hedge ratio drifts (e.g., 0.02 = 2%)
  
  // Notifications
  notifyOnEntry: boolean;
  notifyOnFunding: boolean;
  notifyOnExit: boolean;
}
```

## Commands

### Check Funding Rates
```
/arb funding [symbol]
```
Shows current and predicted funding rates across exchanges.

### Start Arbitrage Position
```
/arb start BTC size=10000 threshold=0.10
```
Opens BTC spot-futures arb with $10k and 10% min annualized rate.

### View Active Positions
```
/arb positions
```

### Close Position
```
/arb close BTC
```

### Show Statistics
```
/arb stats
```
Shows total funding collected, fees paid, net profit.

## Example: BTC Funding Rate Arbitrage

**Scenario:**
- BTC funding rate: 0.03% per 8h (positive = longs pay shorts)
- Annualized: 0.03% × 3 × 365 = 32.85% APY

**Execution:**
1. Buy 0.5 BTC spot at $60,000 = $30,000
2. Short 0.5 BTC-PERP at $60,100 = $30,050
3. Every 8 hours, collect ~$9 funding (0.03% × $30,000)
4. Daily: ~$27, Monthly: ~$810, Yearly: ~$9,855

**Costs:**
- Trading fees: ~0.1% × 2 = 0.2% = $60
- Spot/futures spread: ~$50
- Total entry cost: ~$110

**Break-even: ~4 days** at current funding rate

## Risks

1. **Funding rate reversal**: Rate can turn negative
2. **Liquidation risk**: If futures position gets liquidated
3. **Exchange risk**: Counterparty/platform risk
4. **Execution risk**: Slippage on entry/exit
5. **Opportunity cost**: Capital locked in hedge

## Best Practices

1. **Diversify across assets**: Don't concentrate in single pair
2. **Monitor margin closely**: Keep margin ratio above 50%
3. **Set auto-exit triggers**: Close if funding turns significantly negative
4. **Track all costs**: Include fees, spread, and opportunity cost
5. **Use multiple exchanges**: Better rates and redundancy

## Integration

Works with:
- `exchange-connector`: For spot and futures execution
- `arbitrage-finder`: Discovers opportunities
- `risk-calculator`: Position sizing
- `alert-system`: Notifications
- `portfolio-tracker`: P&L tracking

## API

See `spot-futures-arb.ts` for implementation.
