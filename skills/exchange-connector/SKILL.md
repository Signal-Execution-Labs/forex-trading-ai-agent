---
name: exchange-connector
description: "Connect to crypto exchanges (Binance, Kraken, Coinbase, etc.). Execute orders, manage API keys, stream market data."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔌",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "python-dotenv"] }
      }
  }
---

# Exchange Connector

Connect K.I.T. to cryptocurrency exchanges for trading and market data.

## Overview

This skill provides unified access to 100+ crypto exchanges via the CCXT library:
- **API Key Management** - Secure storage and rotation
- **Order Execution** - Market, limit, stop-loss orders
- **Market Data** - Real-time prices, orderbook, trades
- **Balance Queries** - Portfolio across exchanges

## Supported Exchanges

| Exchange | ID | Features |
|----------|-----|----------|
| Binance | `binance` | Spot, Futures, Margin |
| Kraken | `kraken` | Spot, Futures |
| Coinbase | `coinbase` | Spot |
| KuCoin | `kucoin` | Spot, Futures |
| Bybit | `bybit` | Derivatives |
| OKX | `okx` | Full suite |

## Configuration

API keys are stored in `~/.kit/exchanges.json`:

```json
{
  "binance": {
    "apiKey": "your-api-key",
    "secret": "your-secret",
    "sandbox": false
  },
  "kraken": {
    "apiKey": "your-api-key",
    "secret": "your-secret"
  }
}
```

⚠️ **Security**: Never commit API keys! Use environment variables or encrypted storage.

## Commands

### Check Connection

```bash
python3 -c "
import ccxt
exchange = ccxt.binance({'apiKey': 'KEY', 'secret': 'SECRET'})
print(exchange.fetch_balance())
"
```

### Get Current Price

```bash
python3 -c "
import ccxt
exchange = ccxt.binance()
ticker = exchange.fetch_ticker('BTC/USDT')
print(f\"BTC/USDT: {ticker['last']}\")
"
```

### Place Market Order

```bash
python3 -c "
import ccxt
exchange = ccxt.binance({'apiKey': 'KEY', 'secret': 'SECRET'})
order = exchange.create_market_buy_order('BTC/USDT', 0.001)
print(order)
"
```

### Place Limit Order

```bash
python3 -c "
import ccxt
exchange = ccxt.binance({'apiKey': 'KEY', 'secret': 'SECRET'})
order = exchange.create_limit_buy_order('BTC/USDT', 0.001, 40000)
print(order)
"
```

### Get Open Orders

```bash
python3 -c "
import ccxt
exchange = ccxt.binance({'apiKey': 'KEY', 'secret': 'SECRET'})
orders = exchange.fetch_open_orders('BTC/USDT')
for o in orders:
    print(f\"{o['side']} {o['amount']} @ {o['price']}\")
"
```

### Cancel Order

```bash
python3 -c "
import ccxt
exchange = ccxt.binance({'apiKey': 'KEY', 'secret': 'SECRET'})
result = exchange.cancel_order('ORDER_ID', 'BTC/USDT')
print(result)
"
```

### Get OHLCV Data

```bash
python3 -c "
import ccxt
exchange = ccxt.binance()
ohlcv = exchange.fetch_ohlcv('BTC/USDT', '1h', limit=24)
for candle in ohlcv:
    print(f\"O:{candle[1]} H:{candle[2]} L:{candle[3]} C:{candle[4]}\")
"
```

### Stream Orderbook (WebSocket)

```bash
python3 -c "
import ccxt.pro as ccxtpro
import asyncio

async def watch():
    exchange = ccxtpro.binance()
    while True:
        ob = await exchange.watch_order_book('BTC/USDT')
        print(f\"Best bid: {ob['bids'][0][0]}, Best ask: {ob['asks'][0][0]}\")
        
asyncio.run(watch())
"
```

## Workflow

### Adding a New Exchange

1. Get API keys from exchange (enable trading permissions)
2. Add to `~/.kit/exchanges.json`
3. Test connection with balance query
4. Verify with small test order

### Order Types

| Type | Use Case |
|------|----------|
| `market` | Immediate execution at best price |
| `limit` | Execute at specific price or better |
| `stop_loss` | Sell when price drops to level |
| `take_profit` | Sell when price reaches target |
| `stop_limit` | Stop-loss with limit price |

### Error Handling

Common errors:
- `AuthenticationError` - Invalid API keys
- `InsufficientFunds` - Not enough balance
- `InvalidOrder` - Bad order parameters
- `RateLimitExceeded` - Too many requests

## Scripts

Use `scripts/exchange_cli.py` for quick operations:

```bash
python3 scripts/exchange_cli.py --exchange binance --action balance
python3 scripts/exchange_cli.py --exchange binance --action price BTC/USDT
python3 scripts/exchange_cli.py --exchange binance --action buy BTC/USDT 0.001
```
