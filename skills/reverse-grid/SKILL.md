# Reverse Grid Bot

Profit from downtrends by shorting - grid bot for bears.

## Overview
Standard grids buy low, sell high. Reverse grids **short high, cover low**. Perfect for bear markets or hedging long positions.

## Strategy Logic
```
1. Set upper and lower bounds
2. Short at each grid level going up
3. Cover (buy back) at lower levels
4. Profit from falling prices
5. Requires margin/futures account
```

## Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| upper_bound | 50000 | Max price (top shorts) |
| lower_bound | 30000 | Min price (take profits) |
| grids | 20 | Number of levels |
| leverage | 1x | Position sizing (1x-10x) |
| position_size | 100 | USD per grid level |

## Operation Modes

### Mode 1: Pure Short
- Only short positions
- Max profit = upper - lower
- Loss if price moons

### Mode 2: Hedge Mode
- Pairs with spot holdings
- Shorts hedge your longs
- Neutral delta when combined

### Mode 3: Auto-Reverse
- Detects trend change
- Flips from short to long grid
- Requires AI sentiment signal

## Risk Management
```
Max Position = grids × position_size × leverage
Liquidation Price = upper_bound × (1 + 1/leverage)
Recommended: ≤3x leverage for grids
```

## Best Markets
- Bear market confirmed
- Overbought conditions (RSI > 80)
- After parabolic pumps
- Ranging downward

## Commands
```bash
kit reverse-grid create --symbol BTC/USDT --upper 48000 --lower 35000
kit reverse-grid status
kit reverse-grid flip  # Convert to normal grid
kit reverse-grid close-all
```

## Warning
⚠️ Unlimited loss potential if price pumps
⚠️ Use stop-loss at upper bound
⚠️ Not for beginners - understand shorts first
