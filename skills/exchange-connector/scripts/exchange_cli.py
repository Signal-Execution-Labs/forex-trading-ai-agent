#!/usr/bin/env python3
"""
K.I.T. Exchange CLI - Quick exchange operations
Usage:
    python exchange_cli.py --exchange binance --action balance
    python exchange_cli.py --exchange binance --action price BTC/USDT
    python exchange_cli.py --exchange binance --action buy BTC/USDT 0.001
"""

import argparse
import json
import os
import ccxt

CONFIG_PATH = os.path.expanduser('~/.kit/exchanges.json')

def load_config():
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            return json.load(f)
    return {}

def get_exchange(name, config=None):
    cfg = config or load_config().get(name, {})
    exchange_class = getattr(ccxt, name)
    return exchange_class(cfg)

def cmd_balance(exchange):
    balance = exchange.fetch_balance()
    print(f"💰 Balance on {exchange.id.upper()}")
    print("=" * 40)
    for coin, amount in balance['total'].items():
        if amount > 0:
            print(f"  {coin}: {amount}")

def cmd_price(exchange, symbol):
    ticker = exchange.fetch_ticker(symbol)
    change_emoji = '🟢' if ticker['percentage'] >= 0 else '🔴'
    print(f"📊 {symbol}")
    print(f"  Price: ${ticker['last']:,.2f}")
    print(f"  24h: {change_emoji} {ticker['percentage']:+.2f}%")
    print(f"  Volume: ${ticker['quoteVolume']:,.0f}")

def cmd_buy(exchange, symbol, amount):
    print(f"🛒 Buying {amount} {symbol}...")
    # order = exchange.create_market_buy_order(symbol, float(amount))
    # print(f"✅ Order: {order['id']}")
    print("⚠️ DRY RUN - Uncomment to execute")

def cmd_sell(exchange, symbol, amount):
    print(f"💰 Selling {amount} {symbol}...")
    # order = exchange.create_market_sell_order(symbol, float(amount))
    # print(f"✅ Order: {order['id']}")
    print("⚠️ DRY RUN - Uncomment to execute")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Exchange CLI')
    parser.add_argument('--exchange', '-e', default='binance', help='Exchange name')
    parser.add_argument('--action', '-a', required=True, 
                        choices=['balance', 'price', 'buy', 'sell', 'orders'])
    parser.add_argument('args', nargs='*', help='Action arguments')
    
    args = parser.parse_args()
    exchange = get_exchange(args.exchange)
    
    if args.action == 'balance':
        cmd_balance(exchange)
    elif args.action == 'price':
        cmd_price(exchange, args.args[0] if args.args else 'BTC/USDT')
    elif args.action == 'buy':
        cmd_buy(exchange, args.args[0], args.args[1])
    elif args.action == 'sell':
        cmd_sell(exchange, args.args[0], args.args[1])

if __name__ == '__main__':
    main()
