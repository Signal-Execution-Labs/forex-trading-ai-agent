#!/usr/bin/env python3
"""
K.I.T. DeFi Monitor
Usage:
    python defi_monitor.py --positions
    python defi_monitor.py --yields
    python defi_monitor.py --health
"""

import argparse
import requests
from datetime import datetime

def get_positions():
    """Get DeFi positions (mock data)"""
    return {
        'staking': [
            {'protocol': 'Lido', 'asset': 'stETH', 'amount': 2.5, 'apy': 3.8},
        ],
        'lending': [
            {'protocol': 'Aave', 'asset': 'USDC', 'amount': 10000, 'apy': 4.2, 'type': 'supply'},
            {'protocol': 'Aave', 'asset': 'USDT', 'amount': 3000, 'apy': 5.5, 'type': 'borrow'},
        ],
        'liquidity': [
            {'protocol': 'Uniswap', 'pair': 'ETH/USDC', 'value': 5000, 'apy': 12.5},
        ]
    }

def show_positions():
    """Show all DeFi positions"""
    positions = get_positions()
    
    print("🌾 DEFI POSITIONS")
    print("=" * 60)
    
    total_value = 0
    total_yield = 0
    
    # Staking
    print("\n🥩 STAKING")
    for p in positions['staking']:
        value = p['amount'] * 2500  # ETH price estimate
        annual_yield = value * (p['apy'] / 100)
        total_value += value
        total_yield += annual_yield
        print(f"  {p['protocol']:10} {p['amount']:.4f} {p['asset']} | APY: {p['apy']}% | ~${annual_yield:,.0f}/yr")
    
    # Lending
    print("\n🏦 LENDING")
    for p in positions['lending']:
        value = p['amount']
        annual = value * (p['apy'] / 100)
        
        if p['type'] == 'supply':
            total_value += value
            total_yield += annual
            print(f"  {p['protocol']:10} Supply {p['amount']:,.0f} {p['asset']} | APY: {p['apy']}% | +${annual:,.0f}/yr")
        else:
            total_yield -= annual
            print(f"  {p['protocol']:10} Borrow {p['amount']:,.0f} {p['asset']} | APY: {p['apy']}% | -${annual:,.0f}/yr")
    
    # Liquidity
    print("\n💧 LIQUIDITY")
    for p in positions['liquidity']:
        annual = p['value'] * (p['apy'] / 100)
        total_value += p['value']
        total_yield += annual
        print(f"  {p['protocol']:10} {p['pair']} | ${p['value']:,} | APY: {p['apy']}% | ~${annual:,.0f}/yr")
    
    print()
    print("=" * 60)
    print(f"Total DeFi Value: ${total_value:,.2f}")
    print(f"Net Annual Yield: ${total_yield:,.2f}")
    net_apy = (total_yield / total_value * 100) if total_value > 0 else 0
    print(f"Effective APY: {net_apy:.2f}%")

def show_yields():
    """Show top yield opportunities from DefiLlama"""
    print("🌾 TOP YIELD OPPORTUNITIES")
    print("=" * 70)
    
    try:
        data = requests.get('https://yields.llama.fi/pools', timeout=10).json()['data']
        
        # Filter: TVL > $10M, APY 5-50%
        good = [p for p in data if 
                p.get('tvlUsd', 0) > 10_000_000 and 
                5 < p.get('apy', 0) < 50]
        
        good.sort(key=lambda x: x.get('apy', 0), reverse=True)
        
        print(f"{'Protocol':15} {'Pool':20} {'Chain':10} {'TVL':>12} {'APY':>8}")
        print("-" * 70)
        
        for farm in good[:15]:
            print(f"{farm.get('project', '')[:14]:15} "
                  f"{farm.get('symbol', '')[:19]:20} "
                  f"{farm.get('chain', '')[:9]:10} "
                  f"${farm.get('tvlUsd', 0)/1e6:>10.1f}M "
                  f"{farm.get('apy', 0):>7.1f}%")
    
    except Exception as e:
        print(f"Error fetching data: {e}")

def check_health():
    """Check health factors for lending positions"""
    positions = [
        {'protocol': 'Aave', 'health_factor': 1.85},
        {'protocol': 'Compound', 'health_factor': 2.1},
    ]
    
    print("🏥 HEALTH FACTOR CHECK")
    print("=" * 50)
    print(f"Time: {datetime.now().isoformat()}")
    print()
    
    for pos in positions:
        hf = pos['health_factor']
        
        if hf < 1.2:
            status = '🔴 CRITICAL'
        elif hf < 1.5:
            status = '🟡 WARNING'
        else:
            status = '🟢 SAFE'
        
        print(f"{pos['protocol']:12} HF: {hf:.2f} {status}")

def main():
    parser = argparse.ArgumentParser(description='K.I.T. DeFi Monitor')
    parser.add_argument('--positions', action='store_true', help='Show positions')
    parser.add_argument('--yields', action='store_true', help='Show yield opportunities')
    parser.add_argument('--health', action='store_true', help='Check health factors')
    
    args = parser.parse_args()
    
    if args.positions:
        show_positions()
    elif args.yields:
        show_yields()
    elif args.health:
        check_health()
    else:
        show_positions()

if __name__ == '__main__':
    main()
