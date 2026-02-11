# Liquidity Monitor & Order Book Analysis

## Description
Real-time order book depth analysis and liquidity monitoring for optimal trade execution.

## Features
- **Order Book Depth** - Track bid/ask depth at multiple levels
- **Liquidity Scoring** - Rate asset liquidity (A-F grade)
- **Spread Analysis** - Bid-ask spread monitoring with alerts
- **Slippage Estimator** - Predict slippage for order sizes
- **Whale Detection** - Identify large orders/walls
- **Imbalance Alerts** - Order book imbalance notifications
- **VWAP Tracking** - Volume-weighted average price
- **Execution Quality** - Post-trade analysis vs benchmarks

## Use Cases
1. **Optimal Entry** - Wait for better liquidity before entry
2. **Exit Planning** - Size exits based on available liquidity
3. **Market Making** - Identify spread opportunities
4. **Whale Following** - Track large order movements
5. **HFT Signals** - Microstructure-based signals

## Commands
```
liquidity check BTC/USDT
orderbook depth ETH/USDT --levels 20
slippage estimate BTC/USDT --size 50000
spread alert BTC/USDT --max 0.1%
whale watch BTC/USDT --min-size 1000000
vwap track SPY --window 1d
execution analyze --trade-id xyz123
liquidity heatmap --top 50
```

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| levels | int | 10 | Order book depth levels |
| min_size | float | 10000 | Minimum USD for whale detection |
| spread_alert | float | 0.5% | Alert when spread exceeds |
| imbalance_ratio | float | 2.0 | Bid/ask imbalance threshold |
| update_interval | string | 1s | Real-time update frequency |
| exchange | string | auto | Exchange for order book data |

## Liquidity Grades
| Grade | Spread | Depth ($1M) | Description |
|-------|--------|-------------|-------------|
| A+ | <0.01% | >$50M | Institutional grade |
| A | <0.05% | >$10M | Highly liquid |
| B | <0.1% | >$1M | Good liquidity |
| C | <0.5% | >$100K | Moderate |
| D | <1% | >$10K | Thin |
| F | >1% | <$10K | Illiquid - avoid |

## Outputs
- Real-time order book visualization
- Liquidity score and grade
- Slippage estimates for order sizes
- Whale order alerts
- Spread history charts
- Execution quality reports

## Technical Implementation
- WebSocket connections to exchange order books
- Redis for real-time data caching
- Time-series database for historical depth
- Streaming aggregation for VWAP
- ML models for slippage prediction

## Risk Considerations
- Order books can be spoofed (fake orders)
- Liquidity can evaporate quickly in volatility
- Different exchanges have different depth
- Latency matters for execution decisions
