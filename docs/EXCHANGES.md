# K.I.T. Exchange Integration Documentation

## Overview

K.I.T. supports multiple exchanges for cryptocurrency and forex trading through a unified interface. Each exchange adapter implements the `BaseExchange` abstract class, providing consistent methods for market data, account management, and order execution.

## Supported Exchanges

| Exchange | Type | Spot | Futures | Margin | WebSocket | Status |
|----------|------|------|---------|--------|-----------|--------|
| **Binance** | Crypto | ✅ | ✅ | ✅ | ✅ | Production |
| **Kraken** | Crypto | ✅ | ✅ | ✅ | ✅ | Production |
| **Coinbase** | Crypto | ✅ | ❌ | ❌ | ✅ | Production |
| **Bybit** | Crypto | ✅ | ✅ | ✅ | ✅ | Production |
| **OKX** | Crypto | ✅ | ✅ | ✅ | ✅ | Production |
| **OANDA** | Forex | ✅ | ❌ | ✅ | ✅* | Production |

*OANDA uses HTTP streaming instead of traditional WebSocket

---

## Quick Start

### Environment Variables

```env
# Binance
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_TESTNET=false
BINANCE_FUTURES=false

# Kraken
KRAKEN_API_KEY=your_api_key
KRAKEN_API_SECRET=your_api_secret
KRAKEN_FUTURES=false

# Coinbase
COINBASE_API_KEY=your_api_key
COINBASE_API_SECRET=your_api_secret

# Bybit
BYBIT_API_KEY=your_api_key
BYBIT_API_SECRET=your_api_secret
BYBIT_TESTNET=false
BYBIT_CATEGORY=linear  # spot, linear, inverse

# OKX
OKX_API_KEY=your_api_key
OKX_API_SECRET=your_api_secret
OKX_PASSPHRASE=your_passphrase
OKX_TESTNET=false
OKX_INST_TYPE=SWAP  # SPOT, MARGIN, SWAP, FUTURES, OPTION

# OANDA (Forex)
OANDA_API_KEY=your_api_key
OANDA_ACCOUNT_ID=your_account_id
OANDA_TESTNET=false
```

### Basic Usage

```typescript
import { ExchangeManager, exchangeManager } from './exchanges';

// Initialize all configured exchanges
await exchangeManager.initialize();

// Get ticker from specific exchange
const ticker = await exchangeManager.getTicker('binance', 'BTC/USDT');
console.log(`BTC Price: $${ticker.price}`);

// Get all balances
const balances = await exchangeManager.getAllBalances();

// Create an order
const order = await exchangeManager.createOrder(
  'binance',
  'BTC/USDT',
  'limit',
  'buy',
  0.001,
  50000
);

// Subscribe to real-time updates
await exchangeManager.connectWebSocket('binance');
await exchangeManager.subscribeToTicker('binance', 'BTC/USDT', (data) => {
  console.log(`Real-time price: ${data.price}`);
});
```

---

## Exchange-Specific Details

### 1. Binance

**API Documentation:** https://binance-docs.github.io/apidocs/

#### Features
- Spot, Margin, and USDT-M Futures trading
- Full WebSocket support for real-time data
- Testnet environment available

#### Supported Order Types
- Market
- Limit
- Stop-Loss
- Stop-Loss-Limit
- Take-Profit
- Take-Profit-Limit

#### Rate Limits
- REST: 1200 requests/minute (with weights)
- WebSocket: 5 messages/second

#### Example

```typescript
import { BinanceExchange } from './exchanges/binance';

const binance = new BinanceExchange({
  apiKey: 'your_key',
  apiSecret: 'your_secret',
  testnet: false,
}, true); // futuresMode = true

await binance.connect();

// Get OHLCV candles
const candles = await binance.fetchOHLCV('BTC/USDT', '1h', undefined, 100);

// Create futures order with leverage
const order = await binance.createOrder(
  'BTC/USDT',
  'limit',
  'buy',
  0.01,
  45000,
  { timeInForce: 'GTC' }
);
```

---

### 2. Kraken

**API Documentation:** https://docs.kraken.com/rest/

#### Features
- Spot and Futures trading
- Strong security features
- EUR and USD pairs

#### Symbol Format
Kraken uses unique symbol names (e.g., `XXBTZUSD` for BTC/USD). The adapter normalizes these automatically.

#### Authentication
Kraken uses a unique signature method with base64-encoded HMAC-SHA512.

#### Example

```typescript
import { KrakenExchange } from './exchanges/kraken';

const kraken = new KrakenExchange({
  apiKey: 'your_key',
  apiSecret: 'your_secret_base64',
});

await kraken.connect();

// Fetch EUR pairs
const ticker = await kraken.fetchTicker('BTC/EUR');
```

---

### 3. Coinbase

**API Documentation:** https://docs.cloud.coinbase.com/advanced-trade-api/

#### Features
- Advanced Trade API (replaces Coinbase Pro)
- High liquidity for major pairs
- USD/USDC trading

#### Supported Order Types
- Market
- Limit (GTC, GTD)

#### Example

```typescript
import { CoinbaseExchange } from './exchanges/coinbase';

const coinbase = new CoinbaseExchange({
  apiKey: 'your_key',
  apiSecret: 'your_secret',
});

await coinbase.connect();

// Create limit order
const order = await coinbase.createOrder(
  'BTC/USD',
  'limit',
  'buy',
  0.001,
  45000,
  { postOnly: true }
);
```

---

### 4. Bybit

**API Documentation:** https://bybit-exchange.github.io/docs/v5/intro

#### Features
- Unified V5 API
- Spot, Linear (USDT), Inverse perpetuals
- Copy trading support

#### Categories
- `spot`: Spot trading
- `linear`: USDT perpetual futures
- `inverse`: Coin-margined futures

#### Leverage Management

```typescript
import { BybitExchange } from './exchanges/bybit';

const bybit = new BybitExchange({
  apiKey: 'your_key',
  apiSecret: 'your_secret',
}, 'linear');

await bybit.connect();

// Set leverage
await bybit.setLeverage('BTC/USDT', 10);

// Set margin mode
await bybit.setMarginMode('BTC/USDT', 'ISOLATED');

// Create order with reduce-only
const order = await bybit.createOrder(
  'BTC/USDT',
  'market',
  'sell',
  0.01,
  undefined,
  { reduceOnly: true }
);
```

---

### 5. OKX

**API Documentation:** https://www.okx.com/docs-v5/

#### Features
- Comprehensive derivatives support
- Options trading
- Multiple margin modes

#### Instrument Types
- `SPOT`: Spot trading
- `MARGIN`: Margin trading
- `SWAP`: Perpetual swaps
- `FUTURES`: Delivery futures
- `OPTION`: Options

#### Example

```typescript
import { OKXExchange } from './exchanges/okx';

const okx = new OKXExchange({
  apiKey: 'your_key',
  apiSecret: 'your_secret',
  passphrase: 'your_passphrase',
}, 'SWAP');

await okx.connect();

// Set position mode
await okx.setPositionMode('long_short_mode');

// Set leverage
await okx.setLeverage('BTC/USDT', 20, 'cross');

// Create order
const order = await okx.createOrder(
  'BTC/USDT',
  'limit',
  'buy',
  0.01,
  45000,
  { posSide: 'long' }
);
```

---

### 6. OANDA (Forex)

**API Documentation:** https://developer.oanda.com/rest-live-v20/introduction/

#### Features
- Professional forex trading
- Low spreads on major pairs
- Practice (demo) accounts

#### Special Considerations
- Uses HTTP streaming for real-time data (not WebSocket)
- Account ID required
- Volume measured in units, not lots

#### Major Forex Pairs
- EUR/USD, GBP/USD, USD/JPY
- AUD/USD, USD/CAD, NZD/USD
- EUR/GBP, EUR/JPY, GBP/JPY

#### Example

```typescript
import { OANDAExchange } from './exchanges/oanda';

const oanda = new OANDAExchange({
  apiKey: 'your_api_token',
  apiSecret: '',
  accountId: '101-001-12345678-001',
  testnet: true, // Use practice account
});

await oanda.connect();

// Get EUR/USD spread
const spread = await oanda.getSpread('EUR/USD');
console.log(`Spread: ${spread} pips`);

// Create forex order with SL/TP
const order = await oanda.createOrder(
  'EUR/USD',
  'market',
  'buy',
  10000, // 10,000 units (0.1 lot)
  undefined,
  {
    stopLoss: 1.0800,
    takeProfit: 1.1000,
  }
);

// Close position
await oanda.closePosition('EUR/USD', 0); // 0 = close all long units
```

---

## WebSocket Streaming

All exchanges support real-time data via WebSocket (OANDA uses HTTP streaming).

### Available Streams

| Stream | Binance | Kraken | Coinbase | Bybit | OKX | OANDA |
|--------|---------|--------|----------|-------|-----|-------|
| Ticker | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| OrderBook | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| Trades | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| OHLCV/Klines | ✅ | ✅ | ❌* | ✅ | ✅ | ❌ |

*Coinbase doesn't natively support OHLCV streaming

### Example: Multi-Exchange Price Monitoring

```typescript
import { exchangeManager } from './exchanges';

await exchangeManager.initialize();

// Connect all WebSockets
await exchangeManager.connectAllWebSockets();

// Monitor BTC price across exchanges
const exchanges = ['binance', 'kraken', 'bybit'];
const symbol = 'BTC/USDT';

for (const exchange of exchanges) {
  await exchangeManager.subscribeToTicker(exchange, symbol, (data) => {
    console.log(`[${exchange}] ${symbol}: $${data.price.toFixed(2)}`);
  });
}
```

---

## Advanced Features

### Arbitrage Detection

```typescript
// Find price differences across exchanges
const arbitrage = await exchangeManager.detectArbitrage('BTC/USDT', 0.3);

if (arbitrage) {
  console.log(`
    Arbitrage Opportunity!
    Buy on: ${arbitrage.buyExchange} @ ${arbitrage.buyPrice}
    Sell on: ${arbitrage.sellExchange} @ ${arbitrage.sellPrice}
    Spread: ${arbitrage.spreadPercent.toFixed(2)}%
  `);
}
```

### Portfolio Value

```typescript
// Get total portfolio value in USDT
const totalValue = await exchangeManager.getTotalPortfolioValue('USDT');
console.log(`Total Portfolio: $${totalValue.toFixed(2)}`);
```

### Best Price Finder

```typescript
// Find best prices across exchanges
const prices = await exchangeManager.findBestPrice('ETH/USDT');
console.log('Best prices (sorted by spread):');
prices.forEach(p => {
  console.log(`${p.exchange}: Bid ${p.bid}, Ask ${p.ask}, Spread ${p.spread}`);
});
```

---

## Error Handling

All exchange methods throw errors with descriptive messages:

```typescript
try {
  await exchangeManager.createOrder('binance', 'BTC/USDT', 'limit', 'buy', 0.001, 1000000);
} catch (error) {
  if (error.message.includes('insufficient balance')) {
    console.log('Not enough funds');
  } else if (error.message.includes('invalid price')) {
    console.log('Price out of range');
  } else {
    console.log('Order failed:', error.message);
  }
}
```

---

## Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Use IP whitelisting** - Configure on exchange
3. **Limit API permissions** - Only enable what you need
4. **Use testnet first** - Test all strategies in sandbox mode
5. **Monitor rate limits** - Implement proper throttling
6. **Secure your server** - Use firewalls and VPN

---

## Rate Limits Reference

| Exchange | REST Requests | WebSocket Messages |
|----------|---------------|-------------------|
| Binance | 1200/min (weighted) | 5/sec |
| Kraken | 20/sec | 10/sec |
| Coinbase | 10/sec | 8/sec |
| Bybit | 120/sec | 20/sec |
| OKX | 20/sec | 5/sec |
| OANDA | 100/sec | N/A |

---

## Changelog

### v2.0.0 (2026-02-09)
- Added full exchange adapters (Binance, Kraken, Coinbase, Bybit, OKX, OANDA)
- Implemented WebSocket streaming
- Added arbitrage detection
- Added portfolio tracking
- Added factory function for easy exchange creation

### v1.0.0
- Initial release with basic CCXT integration
