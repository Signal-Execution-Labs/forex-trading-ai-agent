---
name: auto-trader
description: "Automated trading with strategy execution, risk management, position sizing, and stop-loss/take-profit."
metadata:
  {
    "openclaw":
      {
        "emoji": "🤖",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "ta", "pandas"] }
      }
  }
---

# Auto Trader

Automated trading execution with risk management.

## Overview

- **Strategy Execution** - Run predefined trading strategies
- **Risk Management** - Position sizing, max drawdown limits
- **Order Management** - Stop-loss, take-profit, trailing stops
- **Trade Logging** - Complete audit trail

⚠️ **WARNING**: Automated trading involves significant risk. Always test with small amounts first!

## Configuration

Trading config in `~/.kit/auto-trader.json`:

```json
{
  "exchange": "binance",
  "sandbox": true,
  "risk": {
    "max_position_pct": 5,
    "max_daily_loss_pct": 3,
    "default_stop_loss_pct": 2,
    "default_take_profit_pct": 4
  },
  "strategies": ["rsi_reversal", "ma_crossover"],
  "symbols": ["BTC/USDT", "ETH/USDT"]
}
```

## Commands

### Position Sizing Calculator

```bash
python3 -c "
account_balance = 10000  # USD
risk_per_trade_pct = 2   # Risk 2% per trade
entry_price = 45000      # BTC entry
stop_loss_price = 44000  # Stop loss

risk_amount = account_balance * (risk_per_trade_pct / 100)
price_risk = entry_price - stop_loss_price
position_size = risk_amount / price_risk

print('📊 POSITION SIZE CALCULATOR')
print('=' * 50)
print(f'Account Balance: \${account_balance:,.2f}')
print(f'Risk per Trade: {risk_per_trade_pct}% (\${risk_amount:,.2f})')
print(f'Entry Price: \${entry_price:,.2f}')
print(f'Stop Loss: \${stop_loss_price:,.2f}')
print(f'Price Risk: \${price_risk:,.2f} per unit')
print()
print(f'✅ Position Size: {position_size:.6f} BTC')
print(f'✅ Position Value: \${position_size * entry_price:,.2f}')
"
```

### Simple RSI Strategy

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

# Strategy: Buy when RSI < 30, Sell when RSI > 70
symbol = 'BTC/USDT'
exchange = ccxt.binance()

ohlcv = exchange.fetch_ohlcv(symbol, '1h', limit=100)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()

current_rsi = df['rsi'].iloc[-1]
current_price = df['close'].iloc[-1]

print(f'📊 RSI STRATEGY: {symbol}')
print('=' * 50)
print(f'Price: \${current_price:,.2f}')
print(f'RSI(14): {current_rsi:.1f}')
print()

if current_rsi < 30:
    print('🟢 SIGNAL: BUY (RSI oversold)')
    print(f'   Entry: \${current_price:,.2f}')
    print(f'   Stop Loss: \${current_price * 0.98:,.2f} (-2%)')
    print(f'   Take Profit: \${current_price * 1.04:,.2f} (+4%)')
elif current_rsi > 70:
    print('🔴 SIGNAL: SELL (RSI overbought)')
else:
    print('⚪ NO SIGNAL: RSI in neutral zone (30-70)')
"
```

### Moving Average Crossover Strategy

```bash
python3 -c "
import ccxt
import ta
import pandas as pd

symbol = 'BTC/USDT'
exchange = ccxt.binance()

ohlcv = exchange.fetch_ohlcv(symbol, '4h', limit=100)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

df['ema_12'] = ta.trend.ema_indicator(df['close'], 12)
df['ema_26'] = ta.trend.ema_indicator(df['close'], 26)

current = df.iloc[-1]
previous = df.iloc[-2]
price = current['close']

print(f'📊 MA CROSSOVER STRATEGY: {symbol}')
print('=' * 50)
print(f'Price: \${price:,.2f}')
print(f'EMA(12): \${current[\"ema_12\"]:,.2f}')
print(f'EMA(26): \${current[\"ema_26\"]:,.2f}')
print()

# Check for crossover
if previous['ema_12'] < previous['ema_26'] and current['ema_12'] > current['ema_26']:
    print('🟢 SIGNAL: BUY (Golden Cross - EMA12 crossed above EMA26)')
elif previous['ema_12'] > previous['ema_26'] and current['ema_12'] < current['ema_26']:
    print('🔴 SIGNAL: SELL (Death Cross - EMA12 crossed below EMA26)')
elif current['ema_12'] > current['ema_26']:
    print('📈 TREND: Bullish (EMA12 > EMA26) - Hold/Look for entries')
else:
    print('📉 TREND: Bearish (EMA12 < EMA26) - Stay out or short')
"
```

### Execute Trade with Risk Management

```bash
python3 -c "
import ccxt

# Configuration
EXCHANGE_CONFIG = {'apiKey': 'YOUR_KEY', 'secret': 'YOUR_SECRET', 'sandbox': True}
SYMBOL = 'BTC/USDT'
SIDE = 'buy'
RISK_PCT = 2  # 2% of account

exchange = ccxt.binance(EXCHANGE_CONFIG)
balance = exchange.fetch_balance()
account_value = balance['USDT']['free']

# Calculate position size
ticker = exchange.fetch_ticker(SYMBOL)
price = ticker['last']
risk_amount = account_value * (RISK_PCT / 100)
stop_loss_distance = price * 0.02  # 2% stop
position_size = risk_amount / stop_loss_distance

print(f'📊 EXECUTING TRADE')
print('=' * 50)
print(f'Symbol: {SYMBOL}')
print(f'Side: {SIDE.upper()}')
print(f'Entry: \${price:,.2f}')
print(f'Size: {position_size:.6f}')
print(f'Value: \${position_size * price:,.2f}')
print(f'Stop Loss: \${price * 0.98:,.2f}')
print(f'Take Profit: \${price * 1.04:,.2f}')
print()

# Uncomment to execute
# order = exchange.create_market_buy_order(SYMBOL, position_size)
# print(f'✅ Order executed: {order[\"id\"]}')

print('⚠️ DRY RUN - Uncomment to execute real trade')
"
```

### Trailing Stop Implementation

```bash
python3 -c "
import ccxt
import time

# Trailing stop: moves stop up as price increases
symbol = 'BTC/USDT'
entry_price = 45000
trailing_pct = 2  # 2% trailing distance
exchange = ccxt.binance()

highest_price = entry_price
stop_price = entry_price * (1 - trailing_pct/100)

print(f'📊 TRAILING STOP: {symbol}')
print(f'Entry: \${entry_price:,.2f}')
print(f'Trailing: {trailing_pct}%')
print('=' * 50)

# Simulation loop
for i in range(10):
    ticker = exchange.fetch_ticker(symbol)
    current_price = ticker['last']
    
    # Update trailing stop if price moved up
    if current_price > highest_price:
        highest_price = current_price
        stop_price = highest_price * (1 - trailing_pct/100)
    
    pnl_pct = ((current_price - entry_price) / entry_price) * 100
    
    print(f'Price: \${current_price:,.2f} | High: \${highest_price:,.2f} | Stop: \${stop_price:,.2f} | P&L: {pnl_pct:+.2f}%')
    
    if current_price <= stop_price:
        print(f'🛑 STOP HIT at \${stop_price:,.2f}')
        break
    
    time.sleep(5)
"
```

### Daily Trading Report

```bash
python3 -c "
# Mock trade data - load from log in practice
trades = [
    {'symbol': 'BTC/USDT', 'side': 'buy', 'entry': 45000, 'exit': 46000, 'size': 0.1},
    {'symbol': 'ETH/USDT', 'side': 'buy', 'entry': 2500, 'exit': 2450, 'size': 1.0},
    {'symbol': 'SOL/USDT', 'side': 'buy', 'entry': 100, 'exit': 108, 'size': 5.0},
]

print('📊 DAILY TRADING REPORT')
print('=' * 50)

total_pnl = 0
wins = 0
losses = 0

for trade in trades:
    if trade['side'] == 'buy':
        pnl = (trade['exit'] - trade['entry']) * trade['size']
    else:
        pnl = (trade['entry'] - trade['exit']) * trade['size']
    
    total_pnl += pnl
    if pnl >= 0:
        wins += 1
    else:
        losses += 1
    
    emoji = '🟢' if pnl >= 0 else '🔴'
    print(f'{emoji} {trade[\"symbol\"]:12} {trade[\"side\"]:4} \${pnl:+,.2f}')

print()
print('=' * 50)
win_rate = (wins / len(trades)) * 100 if trades else 0
print(f'Total Trades: {len(trades)}')
print(f'Win Rate: {win_rate:.0f}% ({wins}W / {losses}L)')
print(f'Total P&L: \${total_pnl:+,.2f}')
"
```

## Workflow

### Strategy Checklist

Before enabling auto-trading:

1. ✅ Backtest strategy with historical data
2. ✅ Paper trade for at least 2 weeks
3. ✅ Define clear entry/exit rules
4. ✅ Set maximum position sizes
5. ✅ Set daily loss limits
6. ✅ Test with small amounts first

### Risk Management Rules

| Rule | Setting |
|------|---------|
| Max position size | 5% of account |
| Max daily loss | 3% of account |
| Default stop loss | 2% |
| Default take profit | 4% (2:1 R:R) |
| Max open trades | 3 |

### Order Types

| Type | Use Case |
|------|----------|
| Market | Immediate execution |
| Limit | Better price, may not fill |
| Stop Market | Emergency exit |
| Stop Limit | Controlled exit price |
| OCO | Take profit + stop loss together |

### Trade Logging

All trades logged to `~/.kit/trades/`:

```json
{
  "id": "trade_001",
  "timestamp": "2026-02-09T14:30:00Z",
  "symbol": "BTC/USDT",
  "side": "buy",
  "entry_price": 45000,
  "exit_price": 46000,
  "size": 0.1,
  "pnl": 100,
  "strategy": "rsi_reversal"
}
```
