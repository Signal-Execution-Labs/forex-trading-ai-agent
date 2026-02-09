#!/usr/bin/env python3
"""
K.I.T. Position Calculator - Risk-based position sizing
Usage:
    python position_calculator.py --balance 10000 --risk 2 --entry 45000 --stop 44000
"""

import argparse

def calculate_position(balance, risk_pct, entry_price, stop_price):
    risk_amount = balance * (risk_pct / 100)
    price_risk = abs(entry_price - stop_price)
    position_size = risk_amount / price_risk
    position_value = position_size * entry_price
    
    return {
        'risk_amount': risk_amount,
        'price_risk': price_risk,
        'position_size': position_size,
        'position_value': position_value,
        'position_pct': (position_value / balance) * 100
    }

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Position Calculator')
    parser.add_argument('--balance', '-b', type=float, required=True, help='Account balance')
    parser.add_argument('--risk', '-r', type=float, default=2, help='Risk % per trade')
    parser.add_argument('--entry', '-e', type=float, required=True, help='Entry price')
    parser.add_argument('--stop', '-s', type=float, required=True, help='Stop loss price')
    parser.add_argument('--target', '-t', type=float, help='Take profit target')
    
    args = parser.parse_args()
    
    result = calculate_position(args.balance, args.risk, args.entry, args.stop)
    
    print("📊 POSITION SIZE CALCULATOR")
    print("=" * 50)
    print(f"Account Balance:  ${args.balance:,.2f}")
    print(f"Risk per Trade:   {args.risk}% (${result['risk_amount']:,.2f})")
    print(f"Entry Price:      ${args.entry:,.2f}")
    print(f"Stop Loss:        ${args.stop:,.2f}")
    print()
    print("RESULTS:")
    print("-" * 50)
    print(f"Position Size:    {result['position_size']:.6f} units")
    print(f"Position Value:   ${result['position_value']:,.2f}")
    print(f"Account Usage:    {result['position_pct']:.1f}%")
    
    if args.target:
        reward = abs(args.target - args.entry)
        rr_ratio = reward / result['price_risk']
        potential_profit = result['position_size'] * reward
        print()
        print(f"Take Profit:      ${args.target:,.2f}")
        print(f"Risk:Reward:      1:{rr_ratio:.1f}")
        print(f"Potential Profit: ${potential_profit:,.2f}")

if __name__ == '__main__':
    main()
