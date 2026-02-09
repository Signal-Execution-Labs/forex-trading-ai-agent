#!/usr/bin/env python3
"""
K.I.T. Multi-Asset Portfolio Overview
Usage:
    python portfolio_overview.py
    python portfolio_overview.py --dca
    python portfolio_overview.py --sectors
"""

import argparse
import yfinance as yf
from datetime import datetime

def get_portfolio():
    """Get multi-asset portfolio"""
    return {
        'stocks': [
            {'symbol': 'AAPL', 'shares': 50, 'cost': 150},
            {'symbol': 'MSFT', 'shares': 30, 'cost': 280},
            {'symbol': 'GOOGL', 'shares': 20, 'cost': 120},
        ],
        'etfs': [
            {'symbol': 'VTI', 'shares': 100, 'cost': 200},
            {'symbol': 'VXUS', 'shares': 80, 'cost': 55},
            {'symbol': 'BND', 'shares': 50, 'cost': 75},
        ],
        'commodities': [
            {'symbol': 'GLD', 'shares': 25, 'cost': 170},
        ]
    }

def show_overview():
    """Show full portfolio overview"""
    portfolio = get_portfolio()
    
    print("🌍 MULTI-ASSET PORTFOLIO")
    print("=" * 80)
    
    total_value = 0
    total_cost = 0
    by_class = {}
    
    for asset_class, positions in portfolio.items():
        class_value = 0
        print(f"\n📁 {asset_class.upper()}")
        print("-" * 80)
        
        for pos in positions:
            try:
                stock = yf.Ticker(pos['symbol'])
                price = stock.info.get('currentPrice', stock.info.get('regularMarketPrice', 0))
                value = pos['shares'] * price
                cost = pos['shares'] * pos['cost']
                pnl = value - cost
                pnl_pct = (pnl / cost * 100) if cost > 0 else 0
                
                emoji = '🟢' if pnl >= 0 else '🔴'
                print(f"{pos['symbol']:8} {pos['shares']:>6} @ ${price:>8.2f} = ${value:>10,.2f} {emoji} {pnl_pct:>+6.1f}%")
                
                class_value += value
                total_cost += cost
            except Exception as e:
                print(f"{pos['symbol']:8} Error")
        
        by_class[asset_class] = class_value
        total_value += class_value
    
    print()
    print("=" * 80)
    print("ALLOCATION BY CLASS:")
    for cls, val in by_class.items():
        pct = (val / total_value * 100) if total_value > 0 else 0
        bar = '█' * int(pct / 2)
        print(f"  {cls:15} ${val:>12,.2f} ({pct:5.1f}%) {bar}")
    
    print()
    total_pnl = total_value - total_cost
    total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0
    print(f"TOTAL VALUE: ${total_value:,.2f}")
    print(f"TOTAL P&L:   ${total_pnl:+,.2f} ({total_pnl_pct:+.1f}%)")

def show_dca():
    """Show DCA execution plan"""
    dca_plan = [
        {'symbol': 'VTI', 'amount_eur': 200, 'name': 'US Total Market'},
        {'symbol': 'VXUS', 'amount_eur': 100, 'name': 'International'},
        {'symbol': 'BND', 'amount_eur': 50, 'name': 'Bonds'},
    ]
    
    eur_usd = 1.08
    
    print("💰 DCA EXECUTION PLAN")
    print("=" * 60)
    print(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    print(f"EUR/USD: {eur_usd}")
    print()
    
    total = 0
    
    for plan in dca_plan:
        try:
            stock = yf.Ticker(plan['symbol'])
            price = stock.info.get('currentPrice', 100)
            amount_usd = plan['amount_eur'] * eur_usd
            shares = amount_usd / price
            
            print(f"{plan['symbol']:6} | €{plan['amount_eur']:>6} = ${amount_usd:>7.2f} | {shares:.4f} shares @ ${price:.2f}")
            total += plan['amount_eur']
        except:
            print(f"{plan['symbol']:6} | €{plan['amount_eur']:>6} | Error")
    
    print()
    print(f"Total: €{total}")

def show_sectors():
    """Show sector performance"""
    sectors = {
        'Technology': 'XLK',
        'Healthcare': 'XLV',
        'Financials': 'XLF',
        'Consumer Disc.': 'XLY',
        'Energy': 'XLE',
    }
    
    print("📊 SECTOR PERFORMANCE (1 Month)")
    print("=" * 50)
    
    perfs = []
    
    for name, symbol in sectors.items():
        try:
            etf = yf.Ticker(symbol)
            hist = etf.history(period='1mo')
            
            if len(hist) > 1:
                change = ((hist['Close'].iloc[-1] - hist['Close'].iloc[0]) / hist['Close'].iloc[0]) * 100
                perfs.append((name, change))
        except:
            pass
    
    perfs.sort(key=lambda x: x[1], reverse=True)
    
    for name, change in perfs:
        emoji = '🟢' if change >= 0 else '🔴'
        bar = '█' * int(abs(change))
        print(f"{emoji} {name:18} {change:>+6.1f}% {bar}")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Multi-Asset Portfolio')
    parser.add_argument('--dca', action='store_true', help='Show DCA plan')
    parser.add_argument('--sectors', action='store_true', help='Show sector performance')
    
    args = parser.parse_args()
    
    if args.dca:
        show_dca()
    elif args.sectors:
        show_sectors()
    else:
        show_overview()

if __name__ == '__main__':
    main()
