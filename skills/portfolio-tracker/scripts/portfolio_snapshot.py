#!/usr/bin/env python3
"""
K.I.T. Portfolio Snapshot - Daily portfolio tracking
Usage:
    python portfolio_snapshot.py --save
    python portfolio_snapshot.py --report
"""

import argparse
import json
import os
from datetime import datetime
import ccxt

CONFIG_PATH = os.path.expanduser('~/.kit/exchanges.json')
SNAPSHOT_DIR = os.path.expanduser('~/.kit/portfolio/snapshots')

def load_exchanges():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}

def fetch_all_balances():
    config = load_exchanges()
    total_holdings = {}
    
    for name, cfg in config.items():
        try:
            exchange = getattr(ccxt, name)(cfg)
            balance = exchange.fetch_balance()
            for coin, amount in balance['total'].items():
                if amount > 0:
                    total_holdings[coin] = total_holdings.get(coin, 0) + amount
        except Exception as e:
            print(f"⚠️ Error with {name}: {e}")
    
    return total_holdings

def calculate_usd_values(holdings):
    exchange = ccxt.binance()
    values = {}
    
    for coin, amount in holdings.items():
        if coin in ['USDT', 'USDC', 'USD']:
            values[coin] = {'amount': amount, 'price': 1, 'value': amount}
        else:
            try:
                ticker = exchange.fetch_ticker(f'{coin}/USDT')
                values[coin] = {
                    'amount': amount,
                    'price': ticker['last'],
                    'value': amount * ticker['last']
                }
            except:
                pass
    
    return values

def save_snapshot(data):
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    filename = f"snapshot_{datetime.now().strftime('%Y-%m-%d')}.json"
    path = os.path.join(SNAPSHOT_DIR, filename)
    
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f"✅ Saved: {path}")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Portfolio Snapshot')
    parser.add_argument('--save', action='store_true', help='Save snapshot')
    parser.add_argument('--report', action='store_true', help='Show report')
    args = parser.parse_args()
    
    holdings = fetch_all_balances()
    values = calculate_usd_values(holdings)
    
    total_usd = sum(v['value'] for v in values.values())
    
    snapshot = {
        'timestamp': datetime.now().isoformat(),
        'total_usd': total_usd,
        'holdings': values
    }
    
    if args.save:
        save_snapshot(snapshot)
    
    print(f"📊 PORTFOLIO SNAPSHOT")
    print("=" * 50)
    print(f"Total Value: ${total_usd:,.2f}")
    print()
    
    for coin, data in sorted(values.items(), key=lambda x: -x[1]['value']):
        pct = (data['value'] / total_usd * 100) if total_usd > 0 else 0
        print(f"  {coin:6} {data['amount']:>12.4f} ${data['value']:>10,.2f} ({pct:5.1f}%)")

if __name__ == '__main__':
    main()
