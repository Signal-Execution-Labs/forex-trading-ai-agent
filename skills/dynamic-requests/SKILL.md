# Dynamic Requests Skill

> Pine Script v6 inspired dynamic security/timeframe requests at runtime

## Overview

Dynamic Requests allows strategies to fetch data from multiple symbols and timeframes dynamically at runtime, similar to Pine Script v6's `request.security()` improvements. No more hardcoded symbols!

## Features

### Dynamic Security Requests
- **Runtime Symbol Selection:** Change symbols without recompiling
- **Multi-Symbol Analysis:** Compare up to 40 symbols simultaneously
- **Correlation Tracking:** Real-time correlation matrix
- **Spread Calculations:** Synthetic pairs and spreads

### Dynamic Timeframe Requests
- **MTF Analysis:** Request any timeframe at runtime
- **Auto-Aggregation:** Combine tick data into any interval
- **Higher TF Confluence:** Automated alignment checks
- **Gap Detection:** Identify data gaps automatically

### Request Types
| Type | Description |
|------|-------------|
| `security` | Price data from another symbol |
| `earnings` | Fundamental earnings data |
| `dividends` | Dividend calendar/history |
| `splits` | Stock split history |
| `financial` | Income statement, balance sheet |
| `economic` | Economic indicators (GDP, CPI, etc.) |
| `quandl` | Alternative data sources |
| `seed` | Custom dataset injection |

### Request Options
```typescript
interface DynamicRequest {
  symbol: string | string[];      // Single or multiple symbols
  timeframe: string;              // '1', '5', '15', '1H', '1D', '1W', '1M'
  lookback: number;               // Number of bars
  gaps: 'barmerge.gaps_off' | 'barmerge.gaps_on';
  lookahead: 'barmerge.lookahead_off' | 'barmerge.lookahead_on';
  calc_on_every_tick: boolean;    // Real-time or bar close only
  currency: string;               // Convert to specific currency
  adjustment: 'splits' | 'dividends' | 'none';
}
```

## Use Cases

### 1. Sector Rotation Strategy
Compare all S&P 500 sectors and rotate into strongest:
- XLK, XLV, XLF, XLE, XLY, XLP, XLI, XLB, XLU, XLRE, XLC
- Auto-rebalance based on relative strength

### 2. Currency Pair Analysis
DXY correlation with major pairs dynamically.

### 3. Crypto Dominance Trading
BTC.D changes trigger altcoin rotation.

### 4. Earnings Momentum
Request earnings data and trade post-earnings momentum.

## Commands

- `kit requests add <config>` - Add dynamic request
- `kit requests list` - Show active requests
- `kit requests pause <id>` - Pause request
- `kit requests status` - Request statistics
- `kit requests export` - Export request data

## Configuration

```yaml
skill: dynamic-requests
version: 1.0.0
requests:
  - name: sector_rotation
    symbols: ['XLK', 'XLV', 'XLF', 'XLE', 'XLY']
    timeframe: 1D
    indicator: rsi(close, 14)
    compare: relative_strength
    
  - name: btc_correlation
    symbols: ['BTCUSD', 'ETHUSD', 'SOLUSD']
    timeframe: 1H
    indicator: correlation(close, BTCUSD.close, 20)
```

## API Integration

Works with all K.I.T. data providers:
- Binance, Coinbase, Kraken (crypto)
- Alpaca, Interactive Brokers (stocks)
- OANDA, FXCM (forex)
- Custom REST/WebSocket feeds

## Performance

- **Caching:** Smart cache with TTL per timeframe
- **Rate Limiting:** Automatic throttling per exchange
- **Batching:** Combine requests where possible
- **Compression:** LZ4 compressed historical data
