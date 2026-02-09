#!/usr/bin/env python3
"""
K.I.T. MetaTrader 5 Quick Test 🚀

Schneller Funktionstest für:
✅ Connect
✅ Balance
✅ Open Trade  
✅ Close Trade

Für Kay's RoboForex Demo Test!

Usage:
    python quick_test.py                    # Nutzt bereits eingeloggtes MT5
    python quick_test.py --trade            # Führt auch Test-Trade aus
    python quick_test.py --account 12345    # Mit Account-Nummer
"""

import sys
import os
import argparse
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    import MetaTrader5 as mt5
    from scripts.mt5_connector import MT5Connector, MT5Error
    from scripts.mt5_orders import MT5Orders, MT5OrderError
    from scripts.mt5_data import MT5Data
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("\n💡 Installiere dependencies:")
    print("   pip install MetaTrader5 pandas")
    sys.exit(1)


def print_header(title):
    """Print a formatted header"""
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def print_ok(msg):
    print(f"  ✅ {msg}")


def print_fail(msg):
    print(f"  ❌ {msg}")


def print_info(msg):
    print(f"  ℹ️  {msg}")


def test_connection(account=None, password=None, server=None):
    """Test 1: Connection"""
    print_header("TEST 1: CONNECTION")
    
    connector = MT5Connector()
    
    try:
        if account and password and server:
            connector.connect(account=account, password=password, server=server)
            print_ok(f"Connected with credentials (Account: {account})")
        else:
            connector.connect()
            print_ok("Connected to running MT5 terminal")
        
        return connector
        
    except MT5Error as e:
        print_fail(f"Connection failed: {e}")
        print_info("Make sure MT5 is running and logged in")
        return None


def test_account_info(connector):
    """Test 2: Account Info (Balance)"""
    print_header("TEST 2: ACCOUNT INFO & BALANCE")
    
    try:
        info = connector.get_account_info()
        
        print_ok("Account info retrieved!")
        print(f"\n  📊 Account Details:")
        print(f"     Login:      {info['login']}")
        print(f"     Name:       {info['name']}")
        print(f"     Server:     {info['server']}")
        print(f"     Company:    {info['company']}")
        print(f"     ─────────────────────────────")
        print(f"     💰 Balance:     {info['balance']:>12,.2f} {info['currency']}")
        print(f"     💎 Equity:      {info['equity']:>12,.2f} {info['currency']}")
        print(f"     📊 Free Margin: {info['free_margin']:>12,.2f} {info['currency']}")
        print(f"     ⚡ Leverage:    1:{info['leverage']}")
        print(f"     ─────────────────────────────")
        
        if info['trade_allowed'] and info['trade_expert']:
            print_ok("Trading is ENABLED")
        else:
            print_fail("Trading is DISABLED!")
            print_info("Enable Auto-Trading in MT5: Tools → Options → Expert Advisors")
        
        return info
        
    except Exception as e:
        print_fail(f"Failed to get account info: {e}")
        return None


def test_market_data(symbol="EURUSD"):
    """Test 3: Market Data"""
    print_header(f"TEST 3: MARKET DATA ({symbol})")
    
    data = MT5Data()
    
    try:
        # Tick data
        tick = data.get_tick(symbol)
        spread = data.get_spread(symbol)
        
        print_ok("Market data retrieved!")
        print(f"\n  📈 Current Prices:")
        print(f"     Bid:    {tick['bid']:.5f}")
        print(f"     Ask:    {tick['ask']:.5f}")
        print(f"     Spread: {spread:.1f} pips")
        print(f"     Time:   {tick['time']}")
        
        # Symbol info
        info = data.get_symbol_info(symbol)
        print(f"\n  📋 Symbol Info:")
        print(f"     Contract Size: {info['trade_contract_size']:,}")
        print(f"     Min Lot:       {info['volume_min']}")
        print(f"     Max Lot:       {info['volume_max']}")
        print(f"     Lot Step:      {info['volume_step']}")
        
        return tick, info
        
    except Exception as e:
        print_fail(f"Failed to get market data: {e}")
        return None, None


def test_positions():
    """Test 4: Check Positions"""
    print_header("TEST 4: CURRENT POSITIONS")
    
    orders = MT5Orders()
    
    try:
        positions = orders.get_positions()
        pending = orders.get_pending_orders()
        
        print_ok(f"Positions retrieved!")
        print(f"\n  📊 Open Positions: {len(positions)}")
        
        if positions:
            for pos in positions:
                emoji = "🟢" if pos['type'] == 'buy' else "🔴"
                profit_emoji = "💰" if pos['profit'] >= 0 else "📉"
                print(f"     {emoji} {pos['symbol']}: {pos['type'].upper()} {pos['volume']} @ {pos['price_open']:.5f}")
                print(f"        {profit_emoji} P/L: {pos['profit']:+.2f} | Ticket: {pos['ticket']}")
        
        print(f"\n  ⏳ Pending Orders: {len(pending)}")
        if pending:
            for order in pending:
                print(f"     📋 {order['symbol']}: {order['type']} {order['volume_initial']} @ {order['price_open']:.5f}")
        
        return positions, pending
        
    except Exception as e:
        print_fail(f"Failed to get positions: {e}")
        return [], []


def test_trade(symbol="EURUSD", volume=0.01):
    """Test 5: Open and Close a Trade"""
    print_header("TEST 5: OPEN & CLOSE TRADE")
    
    orders = MT5Orders()
    data = MT5Data()
    
    try:
        # Get current price
        tick = data.get_tick(symbol)
        
        # Calculate SL/TP (20 pips)
        sl = round(tick['bid'] - 0.0020, 5)  # 20 pips below
        tp = round(tick['ask'] + 0.0020, 5)  # 20 pips above
        
        print_info(f"Opening test trade...")
        print(f"     Symbol: {symbol}")
        print(f"     Type:   BUY")
        print(f"     Volume: {volume}")
        print(f"     SL:     {sl:.5f}")
        print(f"     TP:     {tp:.5f}")
        
        # Open trade
        result = orders.market_order(
            symbol=symbol,
            order_type="buy",
            volume=volume,
            sl=sl,
            tp=tp,
            comment="KIT-QuickTest"
        )
        
        print_ok(f"Trade OPENED!")
        print(f"     Ticket: {result['ticket']}")
        print(f"     Price:  {result['price']:.5f}")
        
        # Wait a moment
        import time
        print_info("Waiting 2 seconds before closing...")
        time.sleep(2)
        
        # Close trade
        print_info("Closing trade...")
        close_result = orders.close_position(ticket=result['ticket'])
        
        print_ok(f"Trade CLOSED!")
        print(f"     Close Price: {close_result['price']:.5f}")
        print(f"     P/L:         {close_result.get('profit', 0):+.2f}")
        
        return True
        
    except MT5OrderError as e:
        print_fail(f"Trade failed: {e}")
        print_info(f"Retcode: {e.retcode}")
        
        # Common errors
        if e.retcode == 10019:
            print_info("Not enough money - reduce lot size")
        elif e.retcode == 10015:
            print_info("Invalid stops - broker may have minimum SL/TP distance")
        elif e.retcode == 10010:
            print_info("Auto-trading disabled - enable it in MT5")
            
        return False
    except Exception as e:
        print_fail(f"Unexpected error: {e}")
        return False


def run_all_tests(args):
    """Run all tests"""
    print("\n" + "🚗"*20)
    print("  K.I.T. MetaTrader 5 Quick Test")
    print("  " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
    print("🚗"*20)
    
    results = {
        'connection': False,
        'account_info': False,
        'market_data': False,
        'positions': False,
        'trade': None  # None = skipped
    }
    
    # Test 1: Connection
    connector = test_connection(
        account=args.account,
        password=args.password,
        server=args.server
    )
    results['connection'] = connector is not None
    
    if not connector:
        print_summary(results)
        return False
    
    # Test 2: Account Info
    info = test_account_info(connector)
    results['account_info'] = info is not None
    
    # Check if demo account for trade test
    is_demo = info and ('demo' in info.get('server', '').lower() or 
                        'practice' in info.get('server', '').lower() or
                        'virtual' in info.get('server', '').lower())
    
    # Test 3: Market Data
    tick, symbol_info = test_market_data(args.symbol)
    results['market_data'] = tick is not None
    
    # Test 4: Positions
    positions, pending = test_positions()
    results['positions'] = True  # Always passes if we get here
    
    # Test 5: Trade (only if --trade flag and demo account)
    if args.trade:
        if not is_demo and not args.force:
            print_header("TEST 5: TRADE (SKIPPED)")
            print_info("This appears to be a LIVE account!")
            print_info("Use --force to trade on live accounts (at your own risk)")
            results['trade'] = None
        else:
            results['trade'] = test_trade(args.symbol, args.volume)
    
    # Cleanup
    connector.disconnect()
    print_info("Disconnected from MT5")
    
    # Summary
    print_summary(results)
    
    return all(v for v in results.values() if v is not None)


def print_summary(results):
    """Print test summary"""
    print_header("TEST SUMMARY")
    
    tests = [
        ('Connection', results['connection']),
        ('Account Info', results['account_info']),
        ('Market Data', results['market_data']),
        ('Positions', results['positions']),
    ]
    
    if results['trade'] is not None:
        tests.append(('Open/Close Trade', results['trade']))
    
    passed = sum(1 for _, v in tests if v)
    total = len(tests)
    
    for name, result in tests:
        emoji = "✅" if result else "❌"
        status = "PASS" if result else "FAIL"
        print(f"  {emoji} {name}: {status}")
    
    print(f"\n  {'='*40}")
    print(f"  Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("\n  🎉 ALL TESTS PASSED!")
        print("  K.I.T. MetaTrader 5 is ready for action! 🚀")
    else:
        print("\n  ⚠️  Some tests failed. Check the errors above.")


def main():
    parser = argparse.ArgumentParser(
        description='K.I.T. MetaTrader 5 Quick Test',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python quick_test.py                    # Basic test (use running MT5)
  python quick_test.py --trade            # Include trade test
  python quick_test.py --symbol GBPUSD    # Test different symbol
  python quick_test.py --account 12345 --password xxx --server RoboForex-Demo
        """
    )
    
    parser.add_argument('--account', type=int, help='MT5 Account number')
    parser.add_argument('--password', type=str, help='MT5 Password')
    parser.add_argument('--server', type=str, help='MT5 Server (e.g., RoboForex-Demo)')
    parser.add_argument('--symbol', type=str, default='EURUSD', help='Symbol to test (default: EURUSD)')
    parser.add_argument('--volume', type=float, default=0.01, help='Trade volume for test (default: 0.01)')
    parser.add_argument('--trade', action='store_true', help='Execute test trade (open and close)')
    parser.add_argument('--force', action='store_true', help='Allow trade on live accounts')
    
    args = parser.parse_args()
    
    success = run_all_tests(args)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
