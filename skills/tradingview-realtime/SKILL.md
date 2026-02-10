# TradingView Realtime Data

Get realtime market prices, indicators, and screener data from TradingView without official API.

## Features

- **Realtime Prices**: WebSocket streaming for any TradingView symbol
- **Indicators**: Get values from any indicator (RSI, MACD, MAs, custom)
- **Screener Data**: Access TradingView stock/crypto screeners
- **Chart Data**: Historical OHLCV data
- **No API Key Required**: Uses public TradingView data

## How It Works

Based on TradingView's WebSocket protocol (unofficial API):
- Connect to `wss://data.tradingview.com/socket.io/websocket`
- Subscribe to symbol quotes and indicators
- Receive realtime updates

## Usage

### Get Realtime Quote

```typescript
import { TradingViewClient } from './tradingview-client';

const tv = new TradingViewClient();
await tv.connect();

// Subscribe to Bitcoin price
tv.subscribeQuote('BINANCE:BTCUSDT', (data) => {
  console.log(`BTC: $${data.lp} (${data.ch > 0 ? '+' : ''}${data.chp}%)`);
});

// Get multiple symbols
tv.subscribeQuotes(['NASDAQ:AAPL', 'NASDAQ:TSLA', 'FX:EURUSD']);
```

### Get Indicator Values

```typescript
// Get RSI value for any timeframe
const rsi = await tv.getIndicator('BINANCE:BTCUSDT', 'RSI', {
  timeframe: '1H',
  length: 14
});
console.log(`RSI(14): ${rsi.value}`);

// Get multiple indicators
const indicators = await tv.getIndicators('BINANCE:BTCUSDT', [
  { name: 'RSI', params: { length: 14 } },
  { name: 'MACD', params: { fast: 12, slow: 26, signal: 9 } },
  { name: 'EMA', params: { length: 50 } },
  { name: 'BB', params: { length: 20, stdDev: 2 } }
]);
```

### Screener Data

```typescript
// Get top gainers from crypto screener
const gainers = await tv.getScreener('crypto', {
  sort: { sortBy: 'change', sortOrder: 'desc' },
  filter: { change: { gte: 5 } },
  limit: 20
});

// Stock screener with custom filter
const stocks = await tv.getScreener('america', {
  filter: {
    'market_cap_basic': { gte: 1e9 },
    'RSI': { lte: 30 },
    'change': { lte: -5 }
  },
  columns: ['name', 'close', 'change', 'volume', 'RSI', 'market_cap_basic']
});
```

### Historical Data

```typescript
// Get OHLCV bars
const bars = await tv.getBars('BINANCE:BTCUSDT', {
  timeframe: '1D',
  from: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days
  to: Date.now()
});
```

## Available Data Fields

### Quote Data
| Field | Description |
|-------|-------------|
| `lp` | Last price |
| `ch` | Price change |
| `chp` | Change percent |
| `volume` | Volume |
| `bid` | Bid price |
| `ask` | Ask price |
| `high` | Daily high |
| `low` | Daily low |
| `open` | Open price |

### Common Indicators
- RSI, Stochastic, CCI, MFI, Williams %R
- MACD, ADX, Aroon, Awesome Oscillator
- SMA, EMA, WMA, VWMA
- Bollinger Bands, Keltner Channel, Donchian
- ATR, Parabolic SAR, Ichimoku
- Volume, OBV, VWAP

## Configuration

```yaml
tradingview:
  # Session token for premium features (optional)
  session_token: null
  
  # Reconnect settings
  reconnect_attempts: 5
  reconnect_delay_ms: 5000
  
  # Rate limiting
  max_subscriptions: 50
  request_delay_ms: 100

# Symbols to track
watchlist:
  - BINANCE:BTCUSDT
  - BINANCE:ETHUSDT
  - NASDAQ:AAPL
  - FX:EURUSD
  - COMEX:GC1!
```

## Integration with K.I.T.

### Market Analysis Skill
```typescript
// Get comprehensive market overview
const analysis = await kit.skills.tradingviewRealtime.analyze('BINANCE:BTCUSDT');
// Returns: { price, indicators, trend, support, resistance }
```

### Signal Generation
```typescript
// Use TradingView indicators for signals
kit.on('tradingview:indicator', (data) => {
  if (data.symbol === 'BTCUSDT' && data.RSI < 30) {
    kit.emit('signal:buy', { symbol: data.symbol, reason: 'RSI oversold' });
  }
});
```

### Multi-Source Confirmation
```typescript
// Combine with exchange data for confirmation
const tvPrice = await tv.getQuote('BINANCE:BTCUSDT');
const exchangePrice = await binance.getPrice('BTCUSDT');
const slippage = Math.abs(tvPrice.lp - exchangePrice) / exchangePrice * 100;
```

## Rate Limits & Best Practices

- Max ~50 symbol subscriptions per connection
- Use batch requests where possible
- Cache indicator values (update every few seconds, not milliseconds)
- Implement reconnection logic for connection drops
- Don't hammer the WebSocket (1 request per 100ms minimum)

## Resources

- [TradingView-API (GitHub)](https://github.com/Mathieu2301/TradingView-API)
- [Apify TradingView Scraper](https://apify.com/api/tradingview-api)
- [TradingView Charting Library](https://www.tradingview.com/free-charting-libraries/)

## Disclaimer

This uses unofficial/undocumented TradingView APIs. It may break without notice.
For production trading, consider official exchange APIs for price data.
TradingView data is best used for indicators and screeners.
