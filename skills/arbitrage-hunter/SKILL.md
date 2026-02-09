# 🎯 Arbitrage Hunter

**K.I.T.'s Money Printer - Find FREE MONEY across exchanges!**

## Features

### 💰 Cross-Exchange Arbitrage
- Monitor price differences across 10+ exchanges
- Instant spread detection
- Net profit calculation (fees included)
- Auto-execution when profitable

### 🔺 Triangular Arbitrage
- BTC → ETH → USDT → BTC cycles
- Real-time path optimization
- Multi-hop detection
- Slippage estimation

### 🔗 DeFi Arbitrage
- DEX vs CEX price differences
- Uniswap, Sushiswap, Curve
- MEV protection
- Flash loan integration ready

### ⚡ Latency Optimization
- Sub-100ms execution
- Exchange proximity analysis
- Order book depth monitoring
- Race condition handling

## Usage

```python
from arbitrage_hunter import ArbitrageHunter

hunter = ArbitrageHunter()

# Find cross-exchange opportunities
opps = await hunter.scan_cross_exchange(
    symbols=["BTC/USDT", "ETH/USDT"],
    min_spread=0.1,  # 0.1% minimum
    max_volume=10000  # Max $10k per trade
)

for opp in opps:
    print(f"🎯 {opp.symbol}")
    print(f"   Buy: {opp.buy_exchange} @ ${opp.buy_price}")
    print(f"   Sell: {opp.sell_exchange} @ ${opp.sell_price}")
    print(f"   Spread: {opp.spread:.2%}")
    print(f"   Net Profit: ${opp.net_profit:.2f}")

# Find triangular opportunities
triangles = await hunter.scan_triangular(
    base_asset="USDT",
    min_profit=0.05  # 0.05% minimum
)

# Execute arbitrage
result = await hunter.execute(opps[0])
```

## Supported Exchanges

| Exchange | Cross-Ex | Triangular | Speed |
|----------|----------|------------|-------|
| Binance | ✅ | ✅ | ⚡⚡⚡ |
| Coinbase | ✅ | ✅ | ⚡⚡ |
| Kraken | ✅ | ✅ | ⚡⚡ |
| KuCoin | ✅ | ✅ | ⚡⚡ |
| Bybit | ✅ | ✅ | ⚡⚡⚡ |
| OKX | ✅ | ✅ | ⚡⚡⚡ |
| Uniswap | ✅ | ❌ | ⚡ |
| dYdX | ✅ | ❌ | ⚡⚡ |

## Configuration

```yaml
arbitrage_hunter:
  exchanges:
    - binance
    - coinbase
    - kraken
    
  thresholds:
    min_spread: 0.1%
    min_profit: $5
    max_position: $50000
    
  execution:
    auto_execute: false
    max_slippage: 0.05%
    timeout_ms: 500
    
  defi:
    enabled: true
    flash_loans: false
    max_gas_gwei: 50
```

## Risk Management
- Maximum position size limits
- Slippage protection
- Exchange balance monitoring
- Failed execution handling
- P&L tracking
