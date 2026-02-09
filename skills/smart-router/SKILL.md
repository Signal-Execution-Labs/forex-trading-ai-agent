# ⚡ Smart Order Router

**K.I.T.'s Execution Engine - Best prices, minimal slippage, maximum profit!**

## Features

### 🎯 Best Execution
- Real-time price comparison across 10+ exchanges
- Order book depth analysis
- Liquidity scoring
- Market impact estimation

### 📊 Slippage Minimization
- TWAP (Time-Weighted Average Price)
- VWAP (Volume-Weighted Average Price)
- Iceberg orders
- Hidden liquidity detection

### ✂️ Order Splitting
- Intelligent order fragmentation
- Cross-exchange distribution
- Timing optimization
- Fee optimization

### 🌑 Dark Pool Access
- Institutional-grade execution
- Block trading
- Minimal market impact
- Price improvement

## Usage

```python
from smart_router import SmartRouter

router = SmartRouter()

# Find best execution path
route = await router.find_best_route(
    symbol="BTC/USDT",
    side="buy",
    amount=10,  # BTC
    max_slippage=0.001  # 0.1%
)

print(f"Best execution plan:")
print(f"  Total cost: ${route.total_cost:,.2f}")
print(f"  Avg price: ${route.avg_price:,.2f}")
print(f"  Expected slippage: {route.expected_slippage:.3%}")

for leg in route.legs:
    print(f"  - {leg.exchange}: {leg.amount} @ ${leg.price}")

# Execute with TWAP
result = await router.execute_twap(
    symbol="BTC/USDT",
    side="buy",
    amount=10,
    duration_minutes=30,
    interval_seconds=60
)

# Execute with VWAP
result = await router.execute_vwap(
    symbol="ETH/USDT",
    side="sell",
    amount=100,
    participation_rate=0.1  # 10% of volume
)
```

## Execution Algorithms

| Algorithm | Best For | Market Impact |
|-----------|----------|---------------|
| Market | Small orders, urgent | High |
| Limit | Price-sensitive | Low |
| TWAP | Large orders, time flexible | Medium |
| VWAP | Track market volume | Low |
| Iceberg | Hide size | Low |
| Sniper | Best price hunting | Very Low |

## Configuration

```yaml
smart_router:
  exchanges:
    - name: binance
      priority: 1
      max_volume_pct: 40
    - name: coinbase
      priority: 2
      max_volume_pct: 30
    - name: kraken
      priority: 3
      max_volume_pct: 30
      
  execution:
    default_algo: "smart"
    max_slippage: 0.1%
    retry_attempts: 3
    timeout_ms: 5000
    
  order_splitting:
    enabled: true
    min_split_size: $1000
    max_splits: 10
    
  twap:
    default_duration: 30m
    min_interval: 30s
    randomize: true
    
  vwap:
    lookback_period: 1h
    max_participation: 20%
```

## Metrics
- Fill rate
- Price improvement
- Execution time
- Slippage vs benchmark
- Market impact

## Dependencies
- ccxt>=4.0.0
- numpy>=1.24.0
- pandas>=2.0.0
- aiohttp>=3.8.0
