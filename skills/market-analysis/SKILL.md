---
name: market-analysis
description: "Technical analysis, chart patterns, indicator calculation, and market sentiment analysis for crypto trading."
metadata:
  {
    "openclaw":
      {
        "emoji": "📈",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "ta", "pandas", "numpy"] }
      }
  }
---

# Market Analysis

Comprehensive technical and sentiment analysis for crypto markets.

## Overview

- **Technical Indicators** - RSI, MACD, Bollinger Bands, Moving Averages
- **Chart Patterns** - Support/Resistance, Trends, Formations
- **Volume Analysis** - Volume Profile, OBV
- **Market Sentiment** - Fear & Greed, Funding Rates

## Commands

### Full Technical Analysis

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()

# Fetch data
ohlcv = exchange.fetch_ohlcv(symbol, '4h', limit=200)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Calculate indicators
df['sma_20'] = ta.trend.sma_indicator(df['close'], 20)
df['sma_50'] = ta.trend.sma_indicator(df['close'], 50)
df['ema_12'] = ta.trend.ema_indicator(df['close'], 12)
df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()

macd = ta.trend.MACD(df['close'])
df['macd'] = macd.macd()
df['macd_signal'] = macd.macd_signal()

bb = ta.volatility.BollingerBands(df['close'], 20, 2)
df['bb_upper'] = bb.bollinger_hband()
df['bb_lower'] = bb.bollinger_lband()

# Latest values
latest = df.iloc[-1]
price = latest['close']

print(f'📊 TECHNICAL ANALYSIS: {symbol}')
print('=' * 50)
print(f'Price: \${price:,.2f}')
print()
print('📉 Moving Averages:')
print(f'  SMA(20): \${latest[\"sma_20\"]:,.2f} ({\"🟢 Above\" if price > latest[\"sma_20\"] else \"🔴 Below\"})')
print(f'  SMA(50): \${latest[\"sma_50\"]:,.2f} ({\"🟢 Above\" if price > latest[\"sma_50\"] else \"🔴 Below\"})')
print()
print('📊 Oscillators:')
rsi = latest['rsi']
rsi_signal = '🔴 Overbought' if rsi > 70 else '🟢 Oversold' if rsi < 30 else '⚪ Neutral'
print(f'  RSI(14): {rsi:.1f} {rsi_signal}')
macd_signal = '🟢 Bullish' if latest['macd'] > latest['macd_signal'] else '🔴 Bearish'
print(f'  MACD: {macd_signal}')
print()
print('📏 Bollinger Bands:')
print(f'  Upper: \${latest[\"bb_upper\"]:,.2f}')
print(f'  Lower: \${latest[\"bb_lower\"]:,.2f}')
bb_pct = (price - latest['bb_lower']) / (latest['bb_upper'] - latest['bb_lower'])
print(f'  Position: {bb_pct:.0%} (0%=lower, 100%=upper)')
"
```

### Support & Resistance Levels

```bash
python3 -c "
import ccxt
import pandas as pd
import numpy as np

symbol = 'BTC/USDT'
exchange = ccxt.binance()

ohlcv = exchange.fetch_ohlcv(symbol, '1d', limit=90)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

current_price = df['close'].iloc[-1]

# Find pivot points
highs = df['high'].values
lows = df['low'].values

# Simple pivot detection
resistance_levels = []
support_levels = []

for i in range(2, len(df)-2):
    if highs[i] > highs[i-1] and highs[i] > highs[i-2] and highs[i] > highs[i+1] and highs[i] > highs[i+2]:
        resistance_levels.append(highs[i])
    if lows[i] < lows[i-1] and lows[i] < lows[i-2] and lows[i] < lows[i+1] and lows[i] < lows[i+2]:
        support_levels.append(lows[i])

# Filter and sort
resistances = sorted([r for r in resistance_levels if r > current_price])[:3]
supports = sorted([s for s in support_levels if s < current_price], reverse=True)[:3]

print(f'📊 SUPPORT & RESISTANCE: {symbol}')
print('=' * 50)
print(f'Current Price: \${current_price:,.2f}')
print()
print('🔴 Resistance Levels:')
for r in resistances:
    dist = ((r - current_price) / current_price) * 100
    print(f'  \${r:,.2f} (+{dist:.1f}%)')
print()
print('🟢 Support Levels:')
for s in supports:
    dist = ((current_price - s) / current_price) * 100
    print(f'  \${s:,.2f} (-{dist:.1f}%)')
"
```

### Trend Analysis

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()

ohlcv = exchange.fetch_ohlcv(symbol, '1d', limit=100)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Calculate trend indicators
df['sma_7'] = ta.trend.sma_indicator(df['close'], 7)
df['sma_25'] = ta.trend.sma_indicator(df['close'], 25)
df['sma_99'] = ta.trend.sma_indicator(df['close'], 99)
df['adx'] = ta.trend.ADXIndicator(df['high'], df['low'], df['close']).adx()

latest = df.iloc[-1]
price = latest['close']

print(f'📊 TREND ANALYSIS: {symbol}')
print('=' * 50)

# MA Alignment
ma_bullish = latest['sma_7'] > latest['sma_25'] > latest['sma_99']
ma_bearish = latest['sma_7'] < latest['sma_25'] < latest['sma_99']

if ma_bullish:
    print('🟢 TREND: BULLISH (MAs aligned up)')
elif ma_bearish:
    print('🔴 TREND: BEARISH (MAs aligned down)')
else:
    print('⚪ TREND: MIXED (MAs not aligned)')

# Trend strength
adx = latest['adx']
if adx > 50:
    strength = 'Very Strong'
elif adx > 25:
    strength = 'Strong'
elif adx > 20:
    strength = 'Moderate'
else:
    strength = 'Weak/No trend'
print(f'📏 ADX: {adx:.1f} - {strength}')

# Price vs MAs
print()
print('Price vs Moving Averages:')
print(f'  vs SMA(7):  {\"🟢\" if price > latest[\"sma_7\"] else \"🔴\"} \${latest[\"sma_7\"]:,.2f}')
print(f'  vs SMA(25): {\"🟢\" if price > latest[\"sma_25\"] else \"🔴\"} \${latest[\"sma_25\"]:,.2f}')
print(f'  vs SMA(99): {\"🟢\" if price > latest[\"sma_99\"] else \"🔴\"} \${latest[\"sma_99\"]:,.2f}')
"
```

### Volume Analysis

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()

ohlcv = exchange.fetch_ohlcv(symbol, '1d', limit=30)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Volume metrics
avg_volume = df['volume'].mean()
current_volume = df['volume'].iloc[-1]
volume_ratio = current_volume / avg_volume

# OBV
df['obv'] = ta.volume.OnBalanceVolumeIndicator(df['close'], df['volume']).on_balance_volume()
obv_trend = 'Rising' if df['obv'].iloc[-1] > df['obv'].iloc[-5] else 'Falling'

print(f'📊 VOLUME ANALYSIS: {symbol}')
print('=' * 50)
print(f'Current Volume: {current_volume:,.0f}')
print(f'Average Volume: {avg_volume:,.0f}')
print(f'Volume Ratio: {volume_ratio:.2f}x average')
print()

if volume_ratio > 2:
    print('🔥 HIGH VOLUME - Significant activity')
elif volume_ratio > 1.5:
    print('📈 ABOVE AVERAGE - Increased interest')
elif volume_ratio < 0.5:
    print('😴 LOW VOLUME - Quiet market')
else:
    print('⚪ NORMAL VOLUME')

print()
print(f'OBV Trend: {obv_trend}')
if obv_trend == 'Rising' and df['close'].iloc[-1] > df['close'].iloc[-5]:
    print('✅ Volume confirms price move')
elif obv_trend != ('Rising' if df['close'].iloc[-1] > df['close'].iloc[-5] else 'Falling'):
    print('⚠️ Divergence detected - watch for reversal')
"
```

### Fear & Greed Index

```bash
python3 -c "
import requests

# Alternative.me Fear & Greed Index
response = requests.get('https://api.alternative.me/fng/?limit=1')
data = response.json()['data'][0]

value = int(data['value'])
classification = data['value_classification']

print('📊 CRYPTO FEAR & GREED INDEX')
print('=' * 50)

# Visual bar
bar_length = 50
filled = int(value / 100 * bar_length)
bar = '█' * filled + '░' * (bar_length - filled)

print(f'[{bar}] {value}/100')
print()

if value <= 25:
    emoji = '😱'
    advice = 'Extreme fear - Potential buying opportunity'
elif value <= 45:
    emoji = '😰'
    advice = 'Fear - Market is nervous'
elif value <= 55:
    emoji = '😐'
    advice = 'Neutral - Wait for clearer signals'
elif value <= 75:
    emoji = '😀'
    advice = 'Greed - Be cautious with new positions'
else:
    emoji = '🤑'
    advice = 'Extreme greed - Consider taking profits'

print(f'{emoji} {classification.upper()}')
print(f'💡 {advice}')
"
```

### Multi-Timeframe Analysis

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()
timeframes = ['1h', '4h', '1d']

print(f'📊 MULTI-TIMEFRAME ANALYSIS: {symbol}')
print('=' * 50)

for tf in timeframes:
    ohlcv = exchange.fetch_ohlcv(symbol, tf, limit=100)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    
    # Calculate indicators
    df['sma_20'] = ta.trend.sma_indicator(df['close'], 20)
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()
    
    macd = ta.trend.MACD(df['close'])
    macd_hist = macd.macd_diff().iloc[-1]
    
    latest = df.iloc[-1]
    price = latest['close']
    
    # Determine bias
    signals = 0
    if price > latest['sma_20']: signals += 1
    if latest['rsi'] > 50: signals += 1
    if macd_hist > 0: signals += 1
    
    if signals >= 2:
        bias = '🟢 Bullish'
    elif signals <= 1:
        bias = '🔴 Bearish'
    else:
        bias = '⚪ Neutral'
    
    print(f'{tf:4} | RSI: {latest[\"rsi\"]:5.1f} | MACD: {\"🟢\" if macd_hist > 0 else \"🔴\"} | {bias}')
"
```

## Workflow

### Daily Analysis Routine

1. Check Fear & Greed Index
2. Run multi-timeframe analysis on watchlist
3. Identify key support/resistance levels
4. Note any indicator divergences
5. Update trading plan

### Signal Scoring

| Indicator | Bullish | Bearish |
|-----------|---------|---------|
| Price > SMA(50) | +1 | -1 |
| RSI > 50 | +1 | -1 |
| MACD > Signal | +1 | -1 |
| ADX > 25 | Confirms trend | Confirms trend |
| Volume rising | +1 | +1 |

Score >= 3: Strong signal
Score 1-2: Weak signal
Score <= 0: Counter-trend
