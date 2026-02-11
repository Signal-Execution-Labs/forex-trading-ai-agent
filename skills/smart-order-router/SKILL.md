---
name: smart-order-router
description: Intelligent order routing to get best execution across multiple exchanges
version: "1.0.0"
author: K.I.T. Team
tags: [trading, execution, routing, dex, cex, optimization]
markets: [crypto, forex, stocks]
---

# Smart Order Router (SOR)

Optimizes trade execution by routing orders across multiple venues to achieve best price, lowest fees, and minimal slippage.

## Features

### Multi-Venue Routing
- **CEX Aggregation**: Route across Binance, Coinbase, Kraken, OKX, Bybit
- **DEX Aggregation**: 1inch, Jupiter, Uniswap, SushiSwap, Curve
- **Cross-chain**: Seamlessly route between chains (ETH, BSC, Arbitrum, Solana)

### Execution Strategies
- **TWAP** (Time-Weighted Average Price): Split large orders over time
- **VWAP** (Volume-Weighted Average Price): Execute proportional to volume
- **Iceberg**: Hide large order size with visible chunks
- **Sniper**: Rapid execution for time-sensitive trades

### Price Optimization
- Real-time spread analysis across venues
- Fee-adjusted best price calculation
- Slippage prediction based on order book depth
- Gas cost optimization for DEX routes

### Execution Analytics
- Fill rate tracking
- Execution quality scoring
- Venue performance comparison
- Post-trade analysis reports

## Usage

### Basic Order
```
Route 1 ETH buy order across best venues
```

### With Strategy
```
Execute $50k BTC buy using TWAP over 2 hours
```

### DEX Only
```
Swap 10,000 USDC to ETH on DEXs only, max 0.5% slippage
```

### Cross-Chain
```
Route 5 ETH from Ethereum to Arbitrum via best bridge
```

## Configuration

```json
{
  "sor": {
    "venues": {
      "cex": ["binance", "coinbase", "kraken"],
      "dex": ["1inch", "uniswap"],
      "enabled": true
    },
    "defaults": {
      "strategy": "best-price",
      "maxSlippage": 0.5,
      "splitThreshold": 10000,
      "gasBuffer": 1.2
    },
    "analytics": {
      "trackFills": true,
      "compareVenues": true
    }
  }
}
```

## Strategies

| Strategy | Best For | Description |
|----------|----------|-------------|
| best-price | Small orders | Route to single venue with best price |
| split | Medium orders | Distribute across venues for better fill |
| twap | Large orders | Time-weighted execution over duration |
| vwap | Market hours | Volume-weighted to minimize impact |
| iceberg | Whale orders | Hide size, execute in chunks |
| sniper | Time-sensitive | Fastest execution, accept higher cost |

## Output

The SOR provides execution reports:
```
📊 Order Execution Report
━━━━━━━━━━━━━━━━━━━━━━━━
Order: BUY 2.5 ETH
Strategy: SPLIT

Fills:
├── Binance:  1.2 ETH @ $2,485.32 (fee: $1.49)
├── Coinbase: 0.8 ETH @ $2,486.01 (fee: $1.19)
└── 1inch:    0.5 ETH @ $2,484.98 (gas: $2.10)

Summary:
• Avg Price: $2,485.47
• Total Fees: $4.78
• Savings vs single venue: $12.34 (0.2%)
• Execution Time: 4.2s
```

## Requirements

- API keys for connected exchanges
- Wallet connection for DEX trades
- Sufficient balance on each venue (or auto-rebalance enabled)
