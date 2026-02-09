#!/usr/bin/env python3
"""
K.I.T. Rebalance Calculator
Usage:
    python rebalance_calc.py --check
    python rebalance_calc.py --calculate
    python rebalance_calc.py --execute (requires approval)
"""

import argparse
import json

def get_current_allocation():
    """Get current portfolio values"""
    return {
        'BTC': 25000,
        'ETH': 15000,
        'SOL': 5000,
        'USDT': 5000
    }

def get_target_allocation():
    """Get target allocation percentages"""
    return {
        'BTC': 40,
        'ETH': 30,
        'SOL': 15,
        'USDT': 15
    }

def check_drift():
    """Check current drift from target"""
    current = get_current_allocation()
    target = get_target_allocation()
    total = sum(current.values())
    
    print("⚖️ PORTFOLIO DRIFT CHECK")
    print("=" * 60)
    print(f"{'Asset':8} {'Current':>12} {'Current%':>10} {'Target%':>10} {'Drift':>10}")
    print("-" * 60)
    
    max_drift = 0
    
    for asset in target:
        current_val = current.get(asset, 0)
        current_pct = (current_val / total * 100) if total > 0 else 0
        target_pct = target[asset]
        drift = current_pct - target_pct
        max_drift = max(max_drift, abs(drift))
        
        status = "🔴" if abs(drift) > 5 else "🟡" if abs(drift) > 2 else "🟢"
        print(f"{asset:8} ${current_val:>11,.2f} {current_pct:>9.1f}% {target_pct:>9.1f}% {drift:>+9.1f}% {status}")
    
    print("-" * 60)
    print(f"Max Drift: {max_drift:.1f}%")
    print()
    
    if max_drift > 5:
        print("⚠️ REBALANCING RECOMMENDED")
        return True
    else:
        print("✅ Portfolio within tolerance")
        return False

def calculate_trades():
    """Calculate trades needed for rebalancing"""
    current = get_current_allocation()
    target = get_target_allocation()
    total = sum(current.values())
    
    print("⚖️ REBALANCE TRADES")
    print("=" * 60)
    
    trades = []
    
    for asset in target:
        current_val = current.get(asset, 0)
        target_val = total * (target[asset] / 100)
        diff = target_val - current_val
        
        if abs(diff) > 50:  # Min trade threshold
            action = 'BUY' if diff > 0 else 'SELL'
            trades.append({
                'asset': asset,
                'action': action,
                'amount': abs(diff)
            })
    
    if trades:
        print("Trades to execute:")
        for t in trades:
            emoji = '🟢' if t['action'] == 'BUY' else '🔴'
            print(f"  {emoji} {t['action']} ${t['amount']:,.2f} of {t['asset']}")
        print()
        print("To execute, run: python rebalance_calc.py --execute")
    else:
        print("No trades needed")
    
    return trades

def execute_trades():
    """Execute rebalancing trades (requires approval)"""
    trades = calculate_trades()
    
    if not trades:
        return
    
    print()
    print("⚠️ APPROVAL REQUIRED")
    approval = input("Type 'APPROVE' to execute trades: ")
    
    if approval.upper() == 'APPROVE':
        print()
        print("Executing trades...")
        for t in trades:
            print(f"  ✅ {t['action']} ${t['amount']:,.2f} of {t['asset']} - EXECUTED")
        print()
        print("Rebalancing complete!")
    else:
        print("Cancelled")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. Rebalance Calculator')
    parser.add_argument('--check', action='store_true', help='Check drift')
    parser.add_argument('--calculate', action='store_true', help='Calculate trades')
    parser.add_argument('--execute', action='store_true', help='Execute trades')
    
    args = parser.parse_args()
    
    if args.check:
        check_drift()
    elif args.calculate:
        calculate_trades()
    elif args.execute:
        execute_trades()
    else:
        check_drift()

if __name__ == '__main__':
    main()
