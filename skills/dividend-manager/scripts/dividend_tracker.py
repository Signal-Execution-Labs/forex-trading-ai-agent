#!/usr/bin/env python3
"""
K.I.T. Dividend Tracker
Usage:
    python dividend_tracker.py --portfolio
    python dividend_tracker.py --upcoming
    python dividend_tracker.py --drip
"""

import argparse
import yfinance as yf
from datetime import datetime

def get_portfolio():
    """Load portfolio - customize or load from file"""
    return [
        {'symbol': 'AAPL', 'shares': 50},
        {'symbol': 'MSFT', 'shares': 30},
        {'symbol': 'JNJ', 'shares': 40},
        {'symbol': 'KO', 'shares': 100},
        {'symbol': 'O', 'shares': 75},
    ]

def show_portfolio():
    """Show dividend portfolio with yields"""
    portfolio = get_portfolio()
    
    print("💰 DIVIDEND PORTFOLIO")
    print("=" * 70)
    print(f"{'Symbol':8} {'Shares':>8} {'Price':>10} {'Div/Share':>10} {'Yield':>8} {'Annual':>10}")
    print("-" * 70)
    
    total_value = 0
    total_dividend = 0
    
    for p in portfolio:
        try:
            stock = yf.Ticker(p['symbol'])
            info = stock.info
            
            price = info.get('currentPrice', info.get('regularMarketPrice', 0))
            div_rate = info.get('dividendRate', 0) or 0
            div_yield = info.get('dividendYield', 0) or 0
            
            value = p['shares'] * price
            annual_div = p['shares'] * div_rate
            
            total_value += value
            total_dividend += annual_div
            
            print(f"{p['symbol']:8} {p['shares']:>8} ${price:>9.2f} ${div_rate:>9.2f} {div_yield*100:>7.2f}% ${annual_div:>9.2f}")
        except Exception as e:
            print(f"{p['symbol']:8} Error: {e}")
    
    print("-" * 70)
    portfolio_yield = (total_dividend / total_value * 100) if total_value > 0 else 0
    print(f"{'TOTAL':8} {' ':>8} ${total_value:>9,.2f} {' ':>10} {portfolio_yield:>7.2f}% ${total_dividend:>9,.2f}")
    print()
    print(f"📅 Monthly Income: ${total_dividend/12:,.2f}")

def show_upcoming():
    """Show upcoming dividend dates"""
    portfolio = get_portfolio()
    symbols = [p['symbol'] for p in portfolio]
    
    print("📅 UPCOMING DIVIDENDS")
    print("=" * 50)
    
    for symbol in symbols:
        try:
            stock = yf.Ticker(symbol)
            cal = stock.calendar
            
            if cal is not None and not cal.empty:
                ex_date = cal.get('Ex-Dividend Date')
                div_date = cal.get('Dividend Date')
                
                if ex_date:
                    print(f"{symbol:6} | Ex-Date: {ex_date}")
        except Exception as e:
            print(f"{symbol:6} | Error: {e}")

def calculate_drip():
    """Calculate DRIP reinvestment"""
    # Example: dividend received
    received = {
        'AAPL': 12.00,
        'MSFT': 22.50,
        'JNJ': 48.00,
    }
    
    print("💰 DRIP CALCULATION")
    print("=" * 50)
    
    total_reinvested = 0
    
    for symbol, amount in received.items():
        try:
            stock = yf.Ticker(symbol)
            price = stock.info.get('currentPrice', 100)
            shares = amount / price
            
            print(f"{symbol}: ${amount:.2f} → {shares:.4f} shares @ ${price:.2f}")
            total_reinvested += amount
        except:
            print(f"{symbol}: ${amount:.2f} → Error getting price")
    
    print()
    print(f"Total to reinvest: ${total_reinvested:.2f}")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Dividend Tracker')
    parser.add_argument('--portfolio', action='store_true', help='Show portfolio')
    parser.add_argument('--upcoming', action='store_true', help='Show upcoming dividends')
    parser.add_argument('--drip', action='store_true', help='Calculate DRIP')
    
    args = parser.parse_args()
    
    if args.portfolio:
        show_portfolio()
    elif args.upcoming:
        show_upcoming()
    elif args.drip:
        calculate_drip()
    else:
        show_portfolio()

if __name__ == '__main__':
    main()
