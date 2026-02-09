---
name: alert-system
description: "Set price alerts, volume alerts, indicator alerts (RSI/MACD), and news alerts for crypto trading."
metadata:
  {
    "openclaw":
      {
        "emoji": "🚨",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "ta", "requests"] }
      }
  }
---

# Alert System

Real-time alerts for price movements, technical indicators, and market events.

## Overview

- **Price Alerts** - Trigger when price crosses threshold
- **Volume Alerts** - Unusual volume detection
- **Indicator Alerts** - RSI overbought/oversold, MACD crossovers
- **News Alerts** - Breaking crypto news

## Alert Storage

Alerts stored in `~/.kit/alerts.json`:

```json
{
  "alerts": [
    {
      "id": "alert_001",
      "type": "price",
      "symbol": "BTC/USDT",
      "condition": "above",
      "value": 50000,
      "active": true,
      "notify": ["telegram", "sound"]
    }
  ]
}
```

## Commands

### Price Alert - Above

```bash
python3 -c "
import ccxt
import time

symbol = 'BTC/USDT'
target = 50000
exchange = ccxt.binance()

print(f'⏳ Watching {symbol} for price above \${target:,}...')
while True:
    ticker = exchange.fetch_ticker(symbol)
    price = ticker['last']
    if price >= target:
        print(f'🚨 ALERT: {symbol} is now \${price:,.2f} (above \${target:,})')
        break
    print(f'Current: \${price:,.2f}', end='\\r')
    time.sleep(10)
"
```

### Price Alert - Below

```bash
python3 -c "
import ccxt
import time

symbol = 'BTC/USDT'
target = 45000
exchange = ccxt.binance()

print(f'⏳ Watching {symbol} for price below \${target:,}...')
while True:
    ticker = exchange.fetch_ticker(symbol)
    price = ticker['last']
    if price <= target:
        print(f'🚨 ALERT: {symbol} dropped to \${price:,.2f} (below \${target:,})')
        break
    time.sleep(10)
"
```

### Percent Change Alert

```bash
python3 -c "
import ccxt
import time

symbol = 'BTC/USDT'
threshold_pct = 5  # 5% move
exchange = ccxt.binance()

ticker = exchange.fetch_ticker(symbol)
start_price = ticker['last']
print(f'⏳ Watching {symbol} for {threshold_pct}% move from \${start_price:,.2f}...')

while True:
    ticker = exchange.fetch_ticker(symbol)
    price = ticker['last']
    change_pct = ((price - start_price) / start_price) * 100
    
    if abs(change_pct) >= threshold_pct:
        direction = '📈' if change_pct > 0 else '📉'
        print(f'🚨 {direction} {symbol} moved {change_pct:+.2f}% to \${price:,.2f}')
        break
    time.sleep(30)
"
```

### Volume Spike Alert

```bash
python3 -c "
import ccxt
import time

symbol = 'BTC/USDT'
volume_multiplier = 2  # 2x average volume
exchange = ccxt.binance()

# Get average volume (last 24 bars)
ohlcv = exchange.fetch_ohlcv(symbol, '1h', limit=24)
avg_volume = sum(c[5] for c in ohlcv) / len(ohlcv)

print(f'⏳ Watching {symbol} for volume spike (>{volume_multiplier}x avg)...')
print(f'Average hourly volume: {avg_volume:,.0f}')

while True:
    ticker = exchange.fetch_ticker(symbol)
    current_volume = ticker['quoteVolume'] / 24  # Rough hourly
    
    if current_volume > avg_volume * volume_multiplier:
        print(f'🚨 VOLUME SPIKE: {symbol} volume {current_volume:,.0f} ({current_volume/avg_volume:.1f}x average)')
        break
    time.sleep(60)
"
```

### RSI Alert (Overbought/Oversold)

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()

# Fetch OHLCV data
ohlcv = exchange.fetch_ohlcv(symbol, '1h', limit=100)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Calculate RSI
df['rsi'] = ta.momentum.RSIIndicator(df['close'], window=14).rsi()
current_rsi = df['rsi'].iloc[-1]

print(f'{symbol} RSI(14): {current_rsi:.1f}')

if current_rsi >= 70:
    print('🔴 OVERBOUGHT - Consider taking profits')
elif current_rsi <= 30:
    print('🟢 OVERSOLD - Potential buying opportunity')
else:
    print('⚪ Neutral')
"
```

### MACD Crossover Alert

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()

ohlcv = exchange.fetch_ohlcv(symbol, '4h', limit=100)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

macd = ta.trend.MACD(df['close'])
df['macd'] = macd.macd()
df['signal'] = macd.macd_signal()
df['histogram'] = macd.macd_diff()

current_hist = df['histogram'].iloc[-1]
prev_hist = df['histogram'].iloc[-2]

print(f'{symbol} MACD Histogram: {current_hist:.4f}')

if prev_hist < 0 and current_hist > 0:
    print('🟢 BULLISH CROSSOVER - MACD crossed above signal')
elif prev_hist > 0 and current_hist < 0:
    print('🔴 BEARISH CROSSOVER - MACD crossed below signal')
else:
    direction = 'Bullish' if current_hist > 0 else 'Bearish'
    print(f'⚪ No crossover - Currently {direction}')
"
```

### Multi-Coin Price Monitor

```bash
python3 -c "
import ccxt
import time

watchlist = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT']
exchange = ccxt.binance()

print('📊 Crypto Price Monitor')
print('=' * 50)

while True:
    for symbol in watchlist:
        ticker = exchange.fetch_ticker(symbol)
        price = ticker['last']
        change = ticker['percentage']
        emoji = '🟢' if change >= 0 else '🔴'
        print(f'{emoji} {symbol:12} \${price:>10,.2f}  {change:+6.2f}%')
    print('-' * 50)
    time.sleep(60)
"
```

## Workflow

### Setting Up Alerts

1. Define alert conditions (price, indicator, volume)
2. Add to `~/.kit/alerts.json`
3. Run alert monitor as background service
4. Configure notification channels

### Alert Types

| Type | Trigger | Use Case |
|------|---------|----------|
| `price_above` | Price >= target | Take profit |
| `price_below` | Price <= target | Stop loss, buy dip |
| `pct_change` | X% move in Y time | Volatility |
| `volume_spike` | Volume > X * average | Breakout |
| `rsi_high` | RSI >= 70 | Overbought |
| `rsi_low` | RSI <= 30 | Oversold |
| `macd_cross` | MACD/Signal cross | Trend change |

### Notification Channels

- **Telegram** - Via K.I.T. bot
- **Sound** - System alert sound
- **Email** - For critical alerts
- **Push** - Mobile notification

### Best Practices

1. Don't set alerts too close to current price (noise)
2. Use multiple confirmation (price + volume + indicator)
3. Set both entry and exit alerts
4. Review and clean up old alerts regularly
