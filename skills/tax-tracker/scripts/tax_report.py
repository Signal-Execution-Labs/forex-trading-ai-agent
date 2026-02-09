#!/usr/bin/env python3
"""
K.I.T. Tax Report Generator
Usage:
    python tax_report.py --year 2026
    python tax_report.py --year 2026 --format csv
"""

import argparse
import json
import os
from datetime import datetime
from collections import defaultdict

def calculate_gains_fifo(trades, asset):
    """Calculate gains using FIFO method"""
    holdings = []  # [(amount, price, date)]
    gains = []
    
    asset_trades = sorted(
        [t for t in trades if t['asset'] == asset],
        key=lambda x: x['date']
    )
    
    for trade in asset_trades:
        if trade['side'] == 'buy':
            holdings.append({
                'amount': trade['amount'],
                'price': trade['price'],
                'date': datetime.fromisoformat(trade['date'])
            })
        elif trade['side'] == 'sell':
            sell_amount = trade['amount']
            sell_price = trade['price']
            sell_date = datetime.fromisoformat(trade['date'])
            
            while sell_amount > 0 and holdings:
                lot = holdings[0]
                used = min(lot['amount'], sell_amount)
                
                proceeds = used * sell_price
                cost_basis = used * lot['price']
                gain = proceeds - cost_basis
                holding_days = (sell_date - lot['date']).days
                
                gains.append({
                    'amount': used,
                    'proceeds': proceeds,
                    'cost_basis': cost_basis,
                    'gain': gain,
                    'holding_days': holding_days,
                    'tax_free': holding_days >= 365
                })
                
                lot['amount'] -= used
                sell_amount -= used
                
                if lot['amount'] <= 0:
                    holdings.pop(0)
    
    return gains

def generate_report(year, trades):
    """Generate annual tax report"""
    # Filter trades for year
    year_trades = [t for t in trades if t['date'].startswith(str(year))]
    
    # Get unique assets
    assets = set(t['asset'] for t in year_trades)
    
    report = {
        'year': year,
        'generated': datetime.now().isoformat(),
        'summary': {
            'total_proceeds': 0,
            'total_cost_basis': 0,
            'total_gains': 0,
            'tax_free_gains': 0,
            'taxable_gains': 0
        },
        'by_asset': {}
    }
    
    for asset in assets:
        gains = calculate_gains_fifo(trades, asset)
        
        asset_summary = {
            'proceeds': sum(g['proceeds'] for g in gains),
            'cost_basis': sum(g['cost_basis'] for g in gains),
            'gains': sum(g['gain'] for g in gains),
            'tax_free': sum(g['gain'] for g in gains if g['tax_free']),
            'taxable': sum(g['gain'] for g in gains if not g['tax_free'])
        }
        
        report['by_asset'][asset] = asset_summary
        report['summary']['total_proceeds'] += asset_summary['proceeds']
        report['summary']['total_cost_basis'] += asset_summary['cost_basis']
        report['summary']['total_gains'] += asset_summary['gains']
        report['summary']['tax_free_gains'] += asset_summary['tax_free']
        report['summary']['taxable_gains'] += asset_summary['taxable']
    
    return report

def print_report(report):
    """Pretty print the report"""
    print(f"\n🧾 TAX REPORT {report['year']}")
    print("=" * 60)
    
    s = report['summary']
    print(f"Total Proceeds:     €{s['total_proceeds']:>12,.2f}")
    print(f"Total Cost Basis:   €{s['total_cost_basis']:>12,.2f}")
    print(f"Total Gains:        €{s['total_gains']:>12,.2f}")
    print(f"  - Tax Free:       €{s['tax_free_gains']:>12,.2f}")
    print(f"  - Taxable:        €{s['taxable_gains']:>12,.2f}")
    print()
    
    # Estimated tax (Germany, ~42% marginal rate for crypto)
    est_tax = s['taxable_gains'] * 0.42
    print(f"Estimated Tax (42%): €{est_tax:>12,.2f}")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Tax Report Generator')
    parser.add_argument('--year', type=int, default=datetime.now().year)
    parser.add_argument('--format', choices=['text', 'csv', 'json'], default='text')
    parser.add_argument('--trades', default='~/.kit/trades.json', help='Trades file')
    
    args = parser.parse_args()
    
    # Load trades (or use sample data)
    trades_path = os.path.expanduser(args.trades)
    if os.path.exists(trades_path):
        trades = json.load(open(trades_path))
    else:
        # Sample data for demo
        trades = [
            {'asset': 'BTC', 'side': 'buy', 'amount': 0.5, 'price': 40000, 'date': '2025-01-15'},
            {'asset': 'BTC', 'side': 'sell', 'amount': 0.3, 'price': 50000, 'date': '2026-03-01'},
        ]
    
    report = generate_report(args.year, trades)
    
    if args.format == 'json':
        print(json.dumps(report, indent=2))
    elif args.format == 'csv':
        print("Asset,Proceeds,Cost Basis,Gains,Tax Free,Taxable")
        for asset, data in report['by_asset'].items():
            print(f"{asset},{data['proceeds']},{data['cost_basis']},{data['gains']},{data['tax_free']},{data['taxable']}")
    else:
        print_report(report)

if __name__ == '__main__':
    main()
