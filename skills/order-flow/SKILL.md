# Institutional Order Flow Skill

Track and analyze smart money movements in real-time.

## Description

This skill provides institutional-grade order flow analysis, detecting whale movements, dark pool activity, and smart money positioning across multiple markets.

## Capabilities

### Order Flow Detection
- **Delta Analysis** - Buy/sell imbalance detection
- **Volume Profile** - Price levels with high activity
- **Footprint Charts** - Bid/ask at each price level
- **Cumulative Delta** - Running total of buy/sell pressure

### Smart Money Tracking
- **Whale Alerts** - Large order detection ($100K+)
- **Iceberg Detection** - Hidden order identification
- **Spoofing Detection** - Fake order wall identification
- **Block Trade Alerts** - Off-exchange large transactions

### Dark Pool Analysis
- **Dark Pool Prints** - Hidden liquidity execution
- **ATS Volume** - Alternative Trading System activity
- **Cross-Market Flow** - Correlated movements

### Institutional Signals
- **COT Data** - Commitment of Traders positioning
- **Options Flow** - Unusual options activity
- **Put/Call Ratio** - Sentiment from derivatives
- **Open Interest** - Position changes

## Usage

```typescript
// Get real-time order flow
const flow = await kit.skill('order-flow', 'analyze', {
  symbol: 'BTC/USDT',
  exchange: 'binance',
  depth: 20,
  period: '15m'
});

// Track whale movements
const whales = await kit.skill('order-flow', 'whales', {
  minSize: 100000,  // $100K minimum
  symbols: ['BTC/USDT', 'ETH/USDT'],
  window: '1h'
});

// Dark pool activity
const darkPool = await kit.skill('order-flow', 'dark-pool', {
  symbol: 'AAPL',
  source: 'finra'
});

// Get institutional positioning
const cot = await kit.skill('order-flow', 'cot', {
  instrument: 'ES',  // E-mini S&P 500
  period: 'weekly'
});
```

## Output Format

```json
{
  "symbol": "BTC/USDT",
  "timestamp": "2026-02-11T21:30:00Z",
  "orderFlow": {
    "delta": 1250000,
    "cumulativeDelta": 5680000,
    "buyVolume": 3400000,
    "sellVolume": 2150000,
    "signal": "bullish_absorption"
  },
  "whaleActivity": {
    "count": 3,
    "netPosition": "long",
    "largestOrder": {
      "size": 450000,
      "side": "buy",
      "time": "21:28:45"
    }
  },
  "microstructure": {
    "spread": 0.01,
    "depth": {
      "bids": 2800000,
      "asks": 2100000
    },
    "imbalance": 0.33,
    "icebergDetected": false
  },
  "signal": {
    "direction": "long",
    "confidence": 0.78,
    "reason": "Strong buy delta with whale accumulation"
  }
}
```

## Configuration

```json
{
  "exchanges": ["binance", "coinbase", "kraken"],
  "whaleThreshold": 100000,
  "updateInterval": 1000,
  "alertChannels": ["telegram", "discord"],
  "darkPoolSources": ["finra", "otc"],
  "cotSchedule": "weekly"
}
```

## Events

- `order-flow:whale-detected` - Large order detected
- `order-flow:iceberg-found` - Hidden order identified
- `order-flow:imbalance-alert` - Significant buy/sell imbalance
- `order-flow:dark-pool-print` - Large dark pool transaction

## Author

K.I.T. Financial Agent Framework
