# Dynamic Requests

Pine Script v6 style dynamic security requests with runtime symbol/timeframe changes.

## Features

- **Runtime Symbol Switching** - Change requested symbol based on conditions
- **Dynamic Timeframe** - Adjust timeframe based on volatility
- **Conditional Data Requests** - Only fetch data when needed
- **Multi-Symbol Correlation** - Dynamic correlation pairs
- **Adaptive MTF** - Auto-select optimal timeframes

## Example Use Cases

```
# Switch to correlated asset during high correlation
if correlation(BTC, ETH) > 0.9:
    use ETH data for confirmation

# Dynamic timeframe based on volatility  
timeframe = "1m" if ATR > threshold else "5m"

# Conditional spread analysis
if spread > 0.1%:
    request depth data
```

## Commands

```
kit dynamic-request configure
kit dynamic-request test <symbol>
kit dynamic-request correlation-pairs
```

## Performance

- Caches requests to minimize API calls
- Smart invalidation based on data staleness
- Parallel fetching for independent requests
