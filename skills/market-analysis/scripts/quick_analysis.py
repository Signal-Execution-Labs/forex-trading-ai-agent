#!/usr/bin/env python3
"""
K.I.T. Quick Analysis - Fast technical analysis
Usage:
    python quick_analysis.py BTC/USDT
    python quick_analysis.py ETH/USDT --timeframe 1h
"""

import argparse
import ccxt
import ta
import pandas as pd

def analyze(symbol, timeframe='4h'):
    exchange = ccxt.binance()
    
    # Fetch data
    ohlcv = exchange.fetch_ohlcv(symbol, timeframe, limit=100)
    df = pd.DataFrame(ohlcv, columns=['timestamp', 'open', 'high', 'low', 'close', 'volume'])
    
    # Calculate indicators
    df['sma_20'] = ta.trend.sma_indicator(df['close'], 20)
    df['sma_50'] = ta.trend.sma_indicator(df['close'], 50)
    df['rsi'] = ta.momentum.RSIIndicator(df['close'], 14).rsi()
    
    macd = ta.trend.MACD(df['close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    
    latest = df.iloc[-1]
    price = latest['close']
    
    # Scoring
    score = 0
    signals = []
    
    if price > latest['sma_20']:
        score += 1
        signals.append('🟢 Price > SMA20')
    else:
        signals.append('🔴 Price < SMA20')
    
    if price > latest['sma_50']:
        score += 1
        signals.append('🟢 Price > SMA50')
    else:
        signals.append('🔴 Price < SMA50')
    
    rsi = latest['rsi']
    if rsi < 30:
        signals.append('🟢 RSI Oversold')
        score += 1
    elif rsi > 70:
        signals.append('🔴 RSI Overbought')
        score -= 1
    else:
        signals.append(f'⚪ RSI Neutral ({rsi:.0f})')
    
    if latest['macd'] > latest['macd_signal']:
        score += 1
        signals.append('🟢 MACD Bullish')
    else:
        signals.append('🔴 MACD Bearish')
    
    # Output
    print(f"📊 QUICK ANALYSIS: {symbol} ({timeframe})")
    print("=" * 50)
    print(f"Price: ${price:,.2f}")
    print()
    
    for sig in signals:
        print(f"  {sig}")
    
    print()
    print(f"Score: {score}/4")
    
    if score >= 3:
        print("📈 OUTLOOK: BULLISH")
    elif score <= 1:
        print("📉 OUTLOOK: BEARISH")
    else:
        print("⚪ OUTLOOK: NEUTRAL")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Quick Analysis')
    parser.add_argument('symbol', default='BTC/USDT', nargs='?', help='Trading pair')
    parser.add_argument('--timeframe', '-t', default='4h', help='Timeframe')
    
    args = parser.parse_args()
    analyze(args.symbol, args.timeframe)

if __name__ == '__main__':
    main()
