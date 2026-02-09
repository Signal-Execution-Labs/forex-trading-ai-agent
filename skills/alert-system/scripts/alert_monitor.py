#!/usr/bin/env python3
"""
K.I.T. Alert Monitor - Watch prices and trigger alerts
Usage:
    python alert_monitor.py --add BTC/USDT above 50000
    python alert_monitor.py --list
    python alert_monitor.py --watch
"""

import argparse
import json
import os
import time
import ccxt

ALERTS_PATH = os.path.expanduser('~/.kit/alerts.json')

def load_alerts():
    if os.path.exists(ALERTS_PATH):
        with open(ALERTS_PATH) as f:
            return json.load(f)
    return {'alerts': []}

def save_alerts(data):
    os.makedirs(os.path.dirname(ALERTS_PATH), exist_ok=True)
    with open(ALERTS_PATH, 'w') as f:
        json.dump(data, f, indent=2)

def add_alert(symbol, condition, value):
    data = load_alerts()
    alert = {
        'id': f"alert_{len(data['alerts']) + 1:03d}",
        'symbol': symbol,
        'condition': condition,
        'value': float(value),
        'active': True
    }
    data['alerts'].append(alert)
    save_alerts(data)
    print(f"✅ Alert added: {alert['id']}")
    print(f"   {symbol} {condition} ${value:,.2f}")

def list_alerts():
    data = load_alerts()
    print("🚨 ACTIVE ALERTS")
    print("=" * 50)
    for alert in data['alerts']:
        if alert['active']:
            print(f"  [{alert['id']}] {alert['symbol']} {alert['condition']} ${alert['value']:,.2f}")

def watch_alerts():
    data = load_alerts()
    exchange = ccxt.binance()
    
    print("👁️ Watching alerts... (Ctrl+C to stop)")
    print("=" * 50)
    
    while True:
        for alert in data['alerts']:
            if not alert['active']:
                continue
                
            try:
                ticker = exchange.fetch_ticker(alert['symbol'])
                price = ticker['last']
                
                triggered = False
                if alert['condition'] == 'above' and price >= alert['value']:
                    triggered = True
                elif alert['condition'] == 'below' and price <= alert['value']:
                    triggered = True
                
                if triggered:
                    print(f"\n🚨 ALERT TRIGGERED!")
                    print(f"   {alert['symbol']} is ${price:,.2f}")
                    print(f"   Condition: {alert['condition']} ${alert['value']:,.2f}")
                    alert['active'] = False
                    save_alerts(data)
                    
            except Exception as e:
                print(f"⚠️ Error checking {alert['symbol']}: {e}")
        
        time.sleep(30)

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Alert Monitor')
    parser.add_argument('--add', nargs=3, metavar=('SYMBOL', 'CONDITION', 'VALUE'),
                        help='Add alert: BTC/USDT above 50000')
    parser.add_argument('--list', action='store_true', help='List alerts')
    parser.add_argument('--watch', action='store_true', help='Watch alerts')
    
    args = parser.parse_args()
    
    if args.add:
        add_alert(*args.add)
    elif args.list:
        list_alerts()
    elif args.watch:
        watch_alerts()
    else:
        parser.print_help()

if __name__ == '__main__':
    main()
