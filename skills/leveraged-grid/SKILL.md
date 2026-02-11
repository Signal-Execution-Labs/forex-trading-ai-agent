# Leveraged Grid Bot

**Inspired by:** Pionex Futures Grid, Bybit Grid Bot, 3Commas Futures Grid

Grid trading on futures/perpetuals with leverage for amplified returns. Pionex reports 2x higher profits vs spot grid with same parameters.

## Overview

A leveraged grid bot opens long and short positions on futures contracts instead of spot. Combined with leverage (2x-20x), this amplifies both profits and the grid's effective range.

## Features

### Core Functionality
- **Futures Grid Trading**: Buy low / sell high on perpetual contracts
- **Leverage Support**: 2x to 20x configurable leverage
- **Long Grid**: Opens longs at lower prices, closes at higher
- **Short Grid**: Opens shorts at higher prices, closes at lower
- **Neutral Grid**: Bi-directional grid around current price
- **Dynamic Leverage**: AI adjusts leverage based on volatility

### Risk Management
- **Liquidation Protection**: Auto-reduce positions before liq price
- **Max Drawdown Limit**: Stop bot if drawdown exceeds threshold
- **Margin Ratio Monitor**: Real-time margin health tracking
- **Position Size Limits**: Per-grid and total position caps
- **Funding Rate Alerts**: Warn when funding costs eat profits
- **Cross/Isolated Margin**: Choose margin mode per bot

### AI Enhancements
- **Optimal Leverage Suggestion**: Based on historical volatility
- **Grid Range Optimization**: AI-calculated upper/lower bounds
- **Entry Timing**: Wait for optimal entry based on RSI/momentum
- **Volatility Scaling**: Wider grids in volatile markets
- **Funding Rate Integration**: Factor funding into profit calculations

### Advanced Features
- **Trailing Grid**: Grid follows price movement (long or short bias)
- **Infinity Mode**: No upper limit, perpetual accumulation
- **Hedge Mode**: Simultaneous long and short positions
- **Multi-Asset**: Run across multiple pairs with capital allocation
- **Take Profit/Stop Loss**: Bot-level TP/SL for entire position

## Configuration

```yaml
leveraged-grid:
  exchange: binance-futures  # binance-futures, bybit, okx
  symbol: BTC/USDT:USDT
  leverage: 5                # 2-20x
  gridType: neutral          # long, short, neutral
  priceRange:
    lower: 90000
    upper: 110000
  gridCount: 50              # Number of grid lines
  investmentAmount: 1000     # USDT to allocate
  marginMode: isolated       # isolated, cross
  
  riskManagement:
    maxDrawdownPercent: 15
    liquidationBuffer: 10    # % buffer before liq price
    maxPositionSize: 5000    # Max total position in USDT
    fundingRateThreshold: 0.1 # Warn if funding > 0.1%
    
  aiOptimization:
    enabled: true
    lookbackDays: 30
    adjustLeverage: true     # Auto-adjust based on volatility
    adjustGridSpacing: true  # Tighter in low vol, wider in high vol
    
  trailing:
    enabled: false
    direction: up            # up, down, both
    triggerPercent: 5        # Trail when price moves 5%
```

## How It Works

### Long Grid (Bullish)
1. Set grid below current price
2. Open long positions as price drops (accumulate)
3. Close longs as price rises (take profit)
4. With 5x leverage: $1000 controls $5000 worth of BTC

### Short Grid (Bearish)
1. Set grid above current price
2. Open short positions as price rises
3. Close shorts as price drops
4. Profit from downward price movements

### Neutral Grid (Sideways)
1. Set grid around current price (50% above, 50% below)
2. Both long and short positions
3. Profits from any price movement within range
4. Best for ranging markets

## Profit Calculation

```
Grid Profit = (Upper - Lower) / Grid Count × Leverage × Trade Count
```

Example:
- Range: $90,000 - $110,000 (20% range)
- Grid Count: 50
- Investment: $1,000
- Leverage: 5x
- Each grid: 0.4% profit × 5 = 2% profit
- If price oscillates 10 times: 10 × 50 × 2% = ~100% return

## Risk Warnings

⚠️ **Leverage amplifies losses too!**
- 10x leverage = 10% price move can liquidate
- Always use liquidation protection
- Start with low leverage (2-3x) until comfortable
- Monitor funding rates on perpetuals

## API Requirements

Exchange must support:
- Futures/Perpetuals trading
- Leverage adjustment
- Position mode (one-way or hedge)
- Margin mode switching
- WebSocket for real-time updates

## Comparison: Spot vs Leveraged Grid

| Aspect | Spot Grid | Leveraged Grid |
|--------|-----------|----------------|
| Capital Efficiency | 1x | 2-20x |
| Profit Potential | Base | 2-20x higher |
| Risk | Asset depreciation | Liquidation |
| Funding Costs | None | Every 8h |
| Direction | Long only | Long/Short/Neutral |
| Suitable For | HODL + profit | Active traders |

## K.I.T. Advantages

- **Self-hosted**: No monthly fees (vs 3Commas $49-99/mo)
- **AI Optimization**: Dynamic leverage and grid spacing
- **Multi-Exchange**: Not locked to one platform
- **Risk Integration**: Connects to K.I.T. risk-ai for portfolio-level management
- **Tax Tracking**: Auto-logs to tax-tracker skill
- **Full Automation**: Set and forget with smart risk management

## Example Use Cases

### 1. BTC Bull Market Grid
```yaml
symbol: BTC/USDT:USDT
gridType: long
leverage: 3
priceRange:
  lower: 95000
  upper: 120000
gridCount: 100
# Accumulate BTC on dips, take profit on pumps
```

### 2. ETH Range Trading
```yaml
symbol: ETH/USDT:USDT
gridType: neutral
leverage: 5
priceRange:
  lower: 3200
  upper: 3800
gridCount: 60
# Profit from ETH oscillation
```

### 3. Altcoin High-Risk Grid
```yaml
symbol: SOL/USDT:USDT
gridType: neutral
leverage: 10
priceRange:
  lower: 180
  upper: 240
gridCount: 30
maxDrawdownPercent: 20
# High leverage on volatile altcoin
```
