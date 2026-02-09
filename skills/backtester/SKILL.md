---
name: backtester
description: "Backtest trading strategies with historical data. Calculate performance metrics and generate reports."
metadata:
  {
    "openclaw":
      {
        "emoji": "🔬",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "ta", "pandas", "numpy"] }
      }
  }
---

# Backtester

Test trading strategies against historical data before risking real money.

## Overview

- **Historical Data** - Load OHLCV from exchanges
- **Strategy Testing** - Simulate trades with rules
- **Performance Metrics** - Win rate, Sharpe, drawdown
- **Report Generation** - Detailed analysis

## Commands

### Load Historical Data

```bash
python3 -c "
import ccxt
import pandas as pd
from datetime import datetime, timedelta

symbol = 'BTC/USDT'
timeframe = '1d'
exchange = ccxt.binance()

# Fetch 1 year of data
since = exchange.parse8601((datetime.now() - timedelta(days=365)).isoformat())
ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=365)

df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
df['date'] = pd.to_datetime(df['timestamp'], unit='ms')

print(f'📊 HISTORICAL DATA: {symbol}')
print('=' * 50)
print(f'Timeframe: {timeframe}')
print(f'Period: {df[\"date\"].iloc[0].date()} to {df[\"date\"].iloc[-1].date()}')
print(f'Candles: {len(df)}')
print(f'Price Range: \${df[\"low\"].min():,.2f} - \${df[\"high\"].max():,.2f}')

# Save for backtesting
# df.to_csv(f'{symbol.replace(\"/\", \"_\")}_{timeframe}.csv', index=False)
"
```

### Simple RSI Backtest

```bash
python3 -c "
import ccxt
import ta
import pandas as pd
import numpy as np

# Load data
symbol = 'BTC/USDT'
exchange = ccxt.binance()
ohlcv = exchange.fetch_ohlcv(symbol, '1d', limit=365)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Calculate RSI
df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()

# Strategy: Buy RSI < 30, Sell RSI > 70
initial_capital = 10000
capital = initial_capital
position = 0
trades = []

for i in range(1, len(df)):
    rsi = df['rsi'].iloc[i]
    price = df['close'].iloc[i]
    
    if rsi < 30 and position == 0:  # Buy signal
        position = capital / price
        capital = 0
        trades.append({'type': 'buy', 'price': price, 'rsi': rsi})
    
    elif rsi > 70 and position > 0:  # Sell signal
        capital = position * price
        position = 0
        trades.append({'type': 'sell', 'price': price, 'rsi': rsi})

# Close final position
if position > 0:
    capital = position * df['close'].iloc[-1]

final_value = capital
total_return = ((final_value - initial_capital) / initial_capital) * 100
buy_hold_return = ((df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0]) * 100

print(f'📊 RSI STRATEGY BACKTEST: {symbol}')
print('=' * 50)
print(f'Period: {len(df)} days')
print(f'Initial Capital: \${initial_capital:,.2f}')
print(f'Final Value: \${final_value:,.2f}')
print()
print(f'Strategy Return: {total_return:+.2f}%')
print(f'Buy & Hold Return: {buy_hold_return:+.2f}%')
print(f'Outperformance: {total_return - buy_hold_return:+.2f}%')
print()
print(f'Total Trades: {len(trades)}')
"
```

### Moving Average Crossover Backtest

```bash
python3 -c "
import ccxt
import ta
import pandas as pd
import numpy as np

symbol = 'BTC/USDT'
exchange = ccxt.binance()
ohlcv = exchange.fetch_ohlcv(symbol, '4h', limit=500)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Calculate EMAs
df['ema_12'] = ta.trend.ema_indicator(df['close'], 12)
df['ema_26'] = ta.trend.ema_indicator(df['close'], 26)

# Generate signals
df['signal'] = 0
df.loc[df['ema_12'] > df['ema_26'], 'signal'] = 1  # Long
df.loc[df['ema_12'] < df['ema_26'], 'signal'] = -1  # Out/Short

# Calculate returns
df['returns'] = df['close'].pct_change()
df['strategy_returns'] = df['signal'].shift(1) * df['returns']

# Performance metrics
total_return = (1 + df['strategy_returns'].fillna(0)).prod() - 1
buy_hold_return = (df['close'].iloc[-1] / df['close'].iloc[0]) - 1

# Calculate metrics
returns = df['strategy_returns'].dropna()
sharpe = np.sqrt(252 * 6) * returns.mean() / returns.std() if returns.std() > 0 else 0

# Drawdown
cumulative = (1 + returns).cumprod()
running_max = cumulative.cummax()
drawdown = (cumulative - running_max) / running_max
max_drawdown = drawdown.min()

print(f'📊 MA CROSSOVER BACKTEST: {symbol}')
print('=' * 50)
print(f'Period: {len(df)} candles (4h)')
print()
print('Performance:')
print(f'  Strategy Return: {total_return*100:+.2f}%')
print(f'  Buy & Hold: {buy_hold_return*100:+.2f}%')
print(f'  Sharpe Ratio: {sharpe:.2f}')
print(f'  Max Drawdown: {max_drawdown*100:.2f}%')
print()

# Win rate
trades = df[df['signal'] != df['signal'].shift(1)].copy()
print(f'Total Signals: {len(trades)}')
"
```

### Full Backtest with Metrics

```bash
python3 -c "
import ccxt
import ta
import pandas as pd
import numpy as np
from datetime import datetime

def backtest_strategy(df, strategy_func, initial_capital=10000):
    '''Generic backtester'''
    capital = initial_capital
    position = 0
    entry_price = 0
    trades = []
    equity_curve = [initial_capital]
    
    for i in range(50, len(df)):  # Start after indicator warmup
        signal = strategy_func(df, i)
        price = df['close'].iloc[i]
        
        if signal == 'buy' and position == 0:
            position = capital * 0.95 / price  # 5% reserved for fees
            entry_price = price
            capital = capital * 0.05
            trades.append({'type': 'buy', 'price': price, 'index': i})
        
        elif signal == 'sell' and position > 0:
            capital += position * price * 0.999  # 0.1% fee
            pnl = (price - entry_price) / entry_price * 100
            trades.append({'type': 'sell', 'price': price, 'pnl': pnl, 'index': i})
            position = 0
        
        equity = capital + position * price
        equity_curve.append(equity)
    
    return {
        'trades': trades,
        'equity_curve': equity_curve,
        'final_value': equity_curve[-1],
        'initial_capital': initial_capital
    }

def rsi_strategy(df, i):
    rsi = df['rsi'].iloc[i]
    if rsi < 30:
        return 'buy'
    elif rsi > 70:
        return 'sell'
    return 'hold'

# Load data and calculate indicators
symbol = 'BTC/USDT'
exchange = ccxt.binance()
ohlcv = exchange.fetch_ohlcv(symbol, '1d', limit=365)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()

# Run backtest
results = backtest_strategy(df, rsi_strategy)

# Calculate metrics
equity = pd.Series(results['equity_curve'])
returns = equity.pct_change().dropna()

total_return = (results['final_value'] / results['initial_capital'] - 1) * 100
sharpe = np.sqrt(252) * returns.mean() / returns.std() if returns.std() > 0 else 0

running_max = equity.cummax()
drawdown = (equity - running_max) / running_max
max_drawdown = drawdown.min() * 100

# Trade stats
sell_trades = [t for t in results['trades'] if t['type'] == 'sell']
if sell_trades:
    wins = len([t for t in sell_trades if t['pnl'] > 0])
    win_rate = wins / len(sell_trades) * 100
    avg_win = np.mean([t['pnl'] for t in sell_trades if t['pnl'] > 0]) if wins > 0 else 0
    avg_loss = np.mean([t['pnl'] for t in sell_trades if t['pnl'] <= 0]) if wins < len(sell_trades) else 0
else:
    win_rate = avg_win = avg_loss = 0

print(f'📊 BACKTEST REPORT: RSI Strategy on {symbol}')
print('=' * 60)
print(f'Period: {len(df)} days')
print(f'Initial Capital: \${results[\"initial_capital\"]:,.2f}')
print(f'Final Value: \${results[\"final_value\"]:,.2f}')
print()
print('PERFORMANCE METRICS')
print('-' * 60)
print(f'Total Return: {total_return:+.2f}%')
print(f'Sharpe Ratio: {sharpe:.2f}')
print(f'Max Drawdown: {max_drawdown:.2f}%')
print()
print('TRADE STATISTICS')
print('-' * 60)
print(f'Total Trades: {len(sell_trades)}')
print(f'Win Rate: {win_rate:.1f}%')
print(f'Avg Win: {avg_win:+.2f}%')
print(f'Avg Loss: {avg_loss:.2f}%')
print(f'Profit Factor: {abs(avg_win/avg_loss) if avg_loss != 0 else \"N/A\":.2f}')
"
```

### Compare Multiple Strategies

```bash
python3 -c "
import ccxt
import ta
import pandas as pd
import numpy as np

# Load data
symbol = 'BTC/USDT'
exchange = ccxt.binance()
ohlcv = exchange.fetch_ohlcv(symbol, '1d', limit=365)
df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])

# Calculate all indicators
df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()
df['ema_12'] = ta.trend.ema_indicator(df['close'], 12)
df['ema_26'] = ta.trend.ema_indicator(df['close'], 26)
bb = ta.volatility.BollingerBands(df['close'], 20, 2)
df['bb_lower'] = bb.bollinger_lband()
df['bb_upper'] = bb.bollinger_hband()

def calc_return(signal_series):
    returns = df['close'].pct_change()
    strategy_returns = signal_series.shift(1) * returns
    return ((1 + strategy_returns.fillna(0)).prod() - 1) * 100

# Strategy 1: RSI
rsi_signal = pd.Series(0, index=df.index)
rsi_signal[df['rsi'] < 30] = 1
rsi_signal[df['rsi'] > 70] = 0

# Strategy 2: EMA Crossover
ema_signal = pd.Series(0, index=df.index)
ema_signal[df['ema_12'] > df['ema_26']] = 1

# Strategy 3: Bollinger Bands
bb_signal = pd.Series(0, index=df.index)
bb_signal[df['close'] < df['bb_lower']] = 1
bb_signal[df['close'] > df['bb_upper']] = 0

# Buy and Hold
buy_hold = ((df['close'].iloc[-1] / df['close'].iloc[0]) - 1) * 100

print('📊 STRATEGY COMPARISON')
print('=' * 50)
print(f'Symbol: {symbol}')
print(f'Period: {len(df)} days')
print()
print('Returns:')
print(f'  RSI Strategy:     {calc_return(rsi_signal):+.2f}%')
print(f'  EMA Crossover:    {calc_return(ema_signal):+.2f}%')
print(f'  Bollinger Bands:  {calc_return(bb_signal):+.2f}%')
print(f'  Buy & Hold:       {buy_hold:+.2f}%')
"
```

## Workflow

### Backtesting Process

1. **Define Hypothesis** - What pattern are you testing?
2. **Gather Data** - At least 1 year of historical data
3. **Code Strategy** - Clear entry/exit rules
4. **Run Backtest** - Generate performance metrics
5. **Analyze Results** - Look for overfitting
6. **Walk-Forward Test** - Test on unseen data
7. **Paper Trade** - Real-time validation

### Key Metrics

| Metric | Good | Bad |
|--------|------|-----|
| Total Return | > Buy & Hold | < 0% |
| Sharpe Ratio | > 1.5 | < 0.5 |
| Max Drawdown | < 20% | > 50% |
| Win Rate | > 50% | < 30% |
| Profit Factor | > 1.5 | < 1.0 |

### Avoiding Overfitting

- Use out-of-sample testing
- Keep strategy rules simple
- Avoid curve-fitting to specific periods
- Test on multiple assets
- Be skeptical of "too good" results
