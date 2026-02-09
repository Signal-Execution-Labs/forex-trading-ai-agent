#!/usr/bin/env python3
"""
K.I.T. Backtest Runner - Run strategy backtests
Usage:
    python backtest_runner.py --strategy rsi --symbol BTC/USDT --days 365
"""

import argparse
import ccxt
import ta
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def load_data(symbol, timeframe, days):
    exchange = ccxt.binance()
    since = exchange.parse8601((datetime.now() - timedelta(days=days)).isoformat())
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe, since=since, limit=days)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    df['date'] = pd.to_datetime(df['timestamp'], unit='ms')
    return df

def rsi_strategy(df):
    """Buy RSI < 30, Sell RSI > 70"""
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()
    
    capital = 10000
    position = 0
    trades = []
    
    for i in range(14, len(df)):
        rsi = df['rsi'].iloc[i]
        price = df['close'].iloc[i]
        
        if rsi < 30 and position == 0:
            position = capital / price
            capital = 0
            trades.append({'type': 'buy', 'price': price})
        elif rsi > 70 and position > 0:
            capital = position * price
            position = 0
            trades.append({'type': 'sell', 'price': price})
    
    if position > 0:
        capital = position * df['close'].iloc[-1]
    
    return capital, trades

def ma_crossover_strategy(df):
    """Buy EMA12 > EMA26, Sell EMA12 < EMA26"""
    df['ema_12'] = ta.trend.ema_indicator(df['close'], 12)
    df['ema_26'] = ta.trend.ema_indicator(df['close'], 26)
    
    capital = 10000
    position = 0
    trades = []
    
    for i in range(27, len(df)):
        ema12 = df['ema_12'].iloc[i]
        ema26 = df['ema_26'].iloc[i]
        prev_ema12 = df['ema_12'].iloc[i-1]
        prev_ema26 = df['ema_26'].iloc[i-1]
        price = df['close'].iloc[i]
        
        if prev_ema12 < prev_ema26 and ema12 > ema26 and position == 0:
            position = capital / price
            capital = 0
            trades.append({'type': 'buy', 'price': price})
        elif prev_ema12 > prev_ema26 and ema12 < ema26 and position > 0:
            capital = position * price
            position = 0
            trades.append({'type': 'sell', 'price': price})
    
    if position > 0:
        capital = position * df['close'].iloc[-1]
    
    return capital, trades

STRATEGIES = {
    'rsi': rsi_strategy,
    'ma_crossover': ma_crossover_strategy,
}

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Backtest Runner')
    parser.add_argument('--strategy', '-s', default='rsi', choices=STRATEGIES.keys())
    parser.add_argument('--symbol', default='BTC/USDT')
    parser.add_argument('--days', type=int, default=365)
    parser.add_argument('--timeframe', '-t', default='1d')
    
    args = parser.parse_args()
    
    print(f"📊 BACKTEST: {args.strategy.upper()} on {args.symbol}")
    print("=" * 50)
    print(f"Period: {args.days} days")
    print(f"Timeframe: {args.timeframe}")
    print()
    
    df = load_data(args.symbol, args.timeframe, args.days)
    strategy = STRATEGIES[args.strategy]
    final_capital, trades = strategy(df)
    
    initial = 10000
    total_return = ((final_capital - initial) / initial) * 100
    buy_hold = ((df['close'].iloc[-1] / df['close'].iloc[0]) - 1) * 100
    
    print(f"Initial Capital: ${initial:,.2f}")
    print(f"Final Value: ${final_capital:,.2f}")
    print()
    print(f"Strategy Return: {total_return:+.2f}%")
    print(f"Buy & Hold: {buy_hold:+.2f}%")
    print(f"Outperformance: {total_return - buy_hold:+.2f}%")
    print()
    print(f"Total Trades: {len(trades)}")

if __name__ == '__main__':
    main()
