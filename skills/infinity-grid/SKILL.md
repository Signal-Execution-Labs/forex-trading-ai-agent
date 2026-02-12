# Infinity Grid Bot

Permanent grid that never closes - auto-expands as price rises.

## Overview
Unlike standard grid bots that stop when price breaks out, Infinity Grid follows price upward forever. Sell into strength, never miss the moon.

## Strategy Logic
```
1. Set lower bound (no upper bound)
2. Grid profit per level: 0.5% - 2%
3. When price rises → sell partial → create new higher level
4. When price falls → buy back → prepare for next rise
5. Never stop, never close - true HODL+profit
```

## Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| lower_bound | 1000 | Minimum price (stop loss line) |
| grid_profit | 1% | Profit per grid sell |
| investment | 1000 | Total capital |
| grids | 100 | Initial grid levels |

## Use Cases
- **Bull markets**: Ride the wave, take profits
- **HODLers**: Keep exposure, harvest gains
- **Trending assets**: BTC, ETH, SOL

## Vs Standard Grid
| Feature | Standard | Infinity |
|---------|----------|----------|
| Upper Bound | Fixed | None |
| Closes on breakout | Yes | No |
| Moon potential | Limited | Unlimited |
| Best for | Ranges | Trends |

## Risk Warning
- Lower bound = stop loss
- Falling markets = no sells, full bag
- Works best on assets you'd HODL anyway

## Commands
```bash
kit infinity-grid create --symbol BTC/USDT --lower 30000 --profit 1%
kit infinity-grid status
kit infinity-grid adjust --lower 25000
kit infinity-grid emergency-close
```
