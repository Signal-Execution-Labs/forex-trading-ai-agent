# Crypto Prices

Fetch real-time cryptocurrency prices from Binance API.

## Features
- No API key required (public data)
- 24h price change and volume
- Support for any trading pair

## Usage

```bash
# Single price
python binance.py BTC
python binance.py ETHUSDT

# Multiple prices
python binance.py BTC ETH SOL
```

## Output
```json
{
  "symbol": "BTCUSDT",
  "price": 67500.00,
  "change": 1250.50,
  "changePercent": 1.89,
  "high": 68000.00,
  "low": 66000.00,
  "volume": 25000.5,
  "quoteVolume": 1687500000.00,
  "source": "binance"
}
```

## Requirements
- Python 3.x (no external dependencies)
