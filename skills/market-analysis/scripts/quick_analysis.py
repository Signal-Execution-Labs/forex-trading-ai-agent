#!/usr/bin/env python3
"""
K.I.T. Quick Analysis - Fast technical analysis
Usage:
    python quick_analysis.py BTC/USDT
    python quick_analysis.py ETH/USDT --timeframe 1h
"""

import sys
import io
import argparse
import json

# Fix Windows encoding issues
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import ccxt
    import ta
    import pandas as pd
except ImportError as e:
    print(json.dumps({"error": f"Missing package: {e}"}))
    sys.exit(1)

def analyze(symbol, timeframe='4h', output_json=False):
    try:
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
        price = float(latest['close'])
        rsi = float(latest['rsi'])
        
        # Scoring
        score = 0
        signals = []
        
        # SMA20
        if price > latest['sma_20']:
            score += 1
            signals.append({"indicator": "SMA20", "signal": "BULLISH", "detail": f"Price ${price:,.2f} > SMA20 ${latest['sma_20']:,.2f}"})
        else:
            signals.append({"indicator": "SMA20", "signal": "BEARISH", "detail": f"Price ${price:,.2f} < SMA20 ${latest['sma_20']:,.2f}"})
        
        # SMA50
        if price > latest['sma_50']:
            score += 1
            signals.append({"indicator": "SMA50", "signal": "BULLISH", "detail": f"Price ${price:,.2f} > SMA50 ${latest['sma_50']:,.2f}"})
        else:
            signals.append({"indicator": "SMA50", "signal": "BEARISH", "detail": f"Price ${price:,.2f} < SMA50 ${latest['sma_50']:,.2f}"})
        
        # RSI
        if rsi < 30:
            signals.append({"indicator": "RSI", "signal": "OVERSOLD", "detail": f"RSI {rsi:.1f} < 30 (buy opportunity)"})
            score += 1
        elif rsi > 70:
            signals.append({"indicator": "RSI", "signal": "OVERBOUGHT", "detail": f"RSI {rsi:.1f} > 70 (sell signal)"})
            score -= 1
        else:
            signals.append({"indicator": "RSI", "signal": "NEUTRAL", "detail": f"RSI {rsi:.1f} (neutral zone)"})
        
        # MACD
        macd_val = float(latest['macd'])
        macd_sig = float(latest['macd_signal'])
        if macd_val > macd_sig:
            score += 1
            signals.append({"indicator": "MACD", "signal": "BULLISH", "detail": f"MACD {macd_val:.4f} > Signal {macd_sig:.4f}"})
        else:
            signals.append({"indicator": "MACD", "signal": "BEARISH", "detail": f"MACD {macd_val:.4f} < Signal {macd_sig:.4f}"})
        
        # Determine outlook
        if score >= 3:
            outlook = "BULLISH"
            recommendation = "Consider LONG positions"
        elif score <= 1:
            outlook = "BEARISH"
            recommendation = "Consider SHORT positions or stay out"
        else:
            outlook = "NEUTRAL"
            recommendation = "Wait for clearer signals"
        
        result = {
            "symbol": symbol,
            "timeframe": timeframe,
            "price": price,
            "indicators": {
                "sma_20": float(latest['sma_20']),
                "sma_50": float(latest['sma_50']),
                "rsi": rsi,
                "macd": macd_val,
                "macd_signal": macd_sig
            },
            "signals": signals,
            "score": f"{score}/4",
            "outlook": outlook,
            "recommendation": recommendation,
            "confidence": (score + 2) * 20  # Convert to 0-100%
        }
        
        if output_json:
            print(json.dumps(result, indent=2))
        else:
            # Human readable output
            print(f"=== MARKET ANALYSIS: {symbol} ({timeframe}) ===")
            print(f"Current Price: ${price:,.2f}")
            print()
            print("TECHNICAL INDICATORS:")
            for sig in signals:
                icon = "[+]" if sig["signal"] in ["BULLISH", "OVERSOLD"] else "[-]" if sig["signal"] in ["BEARISH", "OVERBOUGHT"] else "[~]"
                print(f"  {icon} {sig['indicator']}: {sig['signal']} - {sig['detail']}")
            print()
            print(f"SCORE: {score}/4")
            print(f"OUTLOOK: {outlook}")
            print(f"RECOMMENDATION: {recommendation}")
            print(f"CONFIDENCE: {(score + 2) * 20}%")
        
        return result
        
    except Exception as e:
        error_result = {"error": str(e), "symbol": symbol}
        if output_json:
            print(json.dumps(error_result))
        else:
            print(f"ERROR analyzing {symbol}: {e}")
        return error_result

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Quick Analysis')
    parser.add_argument('symbol', default='BTC/USDT', nargs='?', help='Trading pair (e.g., BTC/USDT)')
    parser.add_argument('--timeframe', '-t', default='4h', help='Timeframe (1m, 5m, 15m, 1h, 4h, 1d)')
    parser.add_argument('--json', '-j', action='store_true', help='Output as JSON')
    
    args = parser.parse_args()
    analyze(args.symbol, args.timeframe, args.json)

if __name__ == '__main__':
    main()
