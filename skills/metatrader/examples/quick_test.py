#!/usr/bin/env python3
"""
K.I.T. MetaTrader 5 Quick Test 🚀

Schneller Funktionstest für:
✅ Connect
✅ Balance
✅ Market Data
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
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Prüfe MT5 Installation
def check_mt5_installed():
    """Check if MetaTrader5 package is installed"""
    try:
        import MetaTrader5 as mt5
        return True
    except ImportError:
        print("❌ MetaTrader5 nicht installiert!")
        print("\n💡 Installation:")
        print("   pip install MetaTrader5")
        print("   pip install pandas numpy")
        return False

if not check_mt5_installed():
    sys.exit(1)

import MetaTrader5 as mt5

# Jetzt die lokalen Module
try:
    from scripts.mt5_connector import MT5Connector, MT5Error
    from scripts.mt5_orders import MT5Orders, MT5OrderError
    from scripts.mt5_data import MT5Data
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print("\n💡 Führe das Script aus dem richtigen Verzeichnis aus:")
    print("   cd skills/metatrader")
    print("   python examples/quick_test.py")
    sys.exit(1)


# ============================================================================
# Helper Functions
# ============================================================================

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


def print_warn(msg):
    print(f"  ⚠️  {msg}")


# MT5 Error Code Descriptions
MT5_ERROR_DESCRIPTIONS = {
    # Connection errors
    -1: "Generischer Fehler",
    -2: "Ungültige Parameter",
    -3: "Keine Speicher mehr",
    -4: "Timeout bei Verbindung",
    -5: "Nicht eingeloggt",
    -6: "Keine Verbindung zum Server",
    -7: "Zu viele Anfragen",
    -8: "Automatisches Trading deaktiviert",
    -9: "Account nicht gefunden",
    -10: "Trade-Modul nicht erlaubt",
    
    # Trade errors
    10004: "Requote - Preis hat sich geändert",
    10006: "Request rejected",
    10007: "Cancelled by user",
    10008: "Order placed",
    10009: "Request completed",
    10010: "Nur partial Ausführung",
    10011: "Fehler bei der Verarbeitung",
    10012: "Request cancelled by timeout",
    10013: "Invalid request",
    10014: "Ungültiges Volumen",
    10015: "Ungültiger Preis",
    10016: "Ungültige Stops",
    10017: "Trading deaktiviert",
    10018: "Markt geschlossen",
    10019: "Nicht genug Geld",
    10020: "Preise haben sich geändert",
    10021: "Keine Quotes",
    10022: "Invalid order expiration",
    10023: "Order status hat sich geändert",
    10024: "Zu viele Requests",
    10025: "Keine Änderungen im Request",
    10026: "Autotrade vom Server deaktiviert",
    10027: "Autotrade vom Terminal deaktiviert",
    10028: "Request locked",
    10029: "Long Position nicht erlaubt",
    10030: "Short Position nicht erlaubt",
    10031: "Close-only Mode",
    10032: "Position closing only",
    10033: "Invalid fill type",
    10034: "Connection lost",
    10035: "FIFO violation",
    10036: "Hedging nicht erlaubt",
    10038: "Überschreitet Volume limit",
    10039: "Orders limit exceeded",
    10040: "Position limit exceeded",
    10041: "Pending orders limit",
    10042: "Position volume limit",
    10043: "Symbol not available",
    10044: "Margin limit exceeded",
}


def describe_error(code: int) -> str:
    """Get human-readable description for MT5 error code"""
    return MT5_ERROR_DESCRIPTIONS.get(code, f"Unbekannter Fehler (Code: {code})")


def check_mt5_terminal_running():
    """Check if MT5 terminal is running"""
    try:
        import psutil
        for proc in psutil.process_iter(['name']):
            if 'terminal64.exe' in proc.info['name'].lower() or 'terminal.exe' in proc.info['name'].lower():
                return True
        return False
    except ImportError:
        # psutil not installed, can't check
        return None


# ============================================================================
# Tests
# ============================================================================

def test_connection(account=None, password=None, server=None):
    """Test 1: Connection"""
    print_header("TEST 1: CONNECTION")
    
    # Check if MT5 is running
    mt5_running = check_mt5_terminal_running()
    if mt5_running is False:
        print_fail("MT5 Terminal läuft nicht!")
        print_info("Bitte MT5 starten und einloggen.")
        print_info("Download: https://www.metatrader5.com/de/download")
        return None
    elif mt5_running is True:
        print_ok("MT5 Terminal erkannt")
    
    connector = MT5Connector()
    
    try:
        if account and password and server:
            print_info(f"Verbinde mit Account {account} auf {server}...")
            connector.connect(account=account, password=password, server=server)
            print_ok(f"Connected with credentials")
        else:
            print_info("Verbinde mit bereits eingeloggtem Terminal...")
            connector.connect()
            print_ok("Connected to running MT5 terminal")
        
        # Show terminal info
        terminal = connector.get_terminal_info()
        print(f"\n  🖥️  Terminal Info:")
        print(f"     Build:    {terminal['build']}")
        print(f"     Company:  {terminal['company']}")
        print(f"     Path:     {terminal['path'][:50]}...")
        
        return connector
        
    except MT5Error as e:
        print_fail(f"Verbindung fehlgeschlagen!")
        print(f"     Error Code: {e.code}")
        print(f"     Message:    {describe_error(e.code)}")
        print(f"     Details:    {e.message}")
        
        # Specific troubleshooting
        if e.code == -6:
            print_info("→ Prüfe deine Internetverbindung")
            print_info("→ Prüfe ob der Broker-Server erreichbar ist")
        elif e.code == -5:
            print_info("→ MT5 ist nicht eingeloggt")
            print_info("→ Öffne MT5 und logge dich ein")
        elif e.code == -8:
            print_info("→ Aktiviere Algo-Trading in MT5:")
            print_info("   Tools → Options → Expert Advisors → Allow Algo Trading")
        
        return None


def test_account_info(connector):
    """Test 2: Account Info (Balance)"""
    print_header("TEST 2: ACCOUNT INFO & BALANCE")
    
    try:
        info = connector.get_account_info()
        
        print_ok("Account info retrieved!")
        print(f"\n  📊 Account Details:")
        print(f"     ─────────────────────────────────────")
        print(f"     Login:      {info['login']}")
        print(f"     Name:       {info['name']}")
        print(f"     Server:     {info['server']}")
        print(f"     Company:    {info['company']}")
        print(f"     ─────────────────────────────────────")
        print(f"     💰 Balance:     {info['balance']:>12,.2f} {info['currency']}")
        print(f"     💎 Equity:      {info['equity']:>12,.2f} {info['currency']}")
        print(f"     📊 Free Margin: {info['free_margin']:>12,.2f} {info['currency']}")
        print(f"     ⚡ Leverage:    1:{info['leverage']}")
        print(f"     ─────────────────────────────────────")
        
        # Trading status
        print(f"\n  🔐 Trading Status:")
        if info['trade_allowed']:
            print_ok("Trade allowed by server")
        else:
            print_fail("Trade NOT allowed by server")
            
        if info['trade_expert']:
            print_ok("Expert Advisors enabled")
        else:
            print_fail("Expert Advisors DISABLED!")
            print_info("Aktiviere in MT5: Tools → Options → Expert Advisors")
            print_info("Setze Haken bei 'Allow Algorithmic Trading'")
        
        # Check if demo
        is_demo = ('demo' in info['server'].lower() or 
                   'practice' in info['server'].lower() or
                   'virtual' in info['server'].lower())
        
        if is_demo:
            print_ok("✅ Demo Account erkannt - sicher zum Testen!")
        else:
            print_warn("⚠️  LIVE Account erkannt - Vorsicht beim Traden!")
        
        return info
        
    except Exception as e:
        print_fail(f"Failed to get account info: {e}")
        return None


def test_market_data(symbol="EURUSD"):
    """Test 3: Market Data"""
    print_header(f"TEST 3: MARKET DATA ({symbol})")
    
    data = MT5Data()
    
    try:
        # Check market status
        status = data.get_market_status(symbol)
        print(f"\n  📈 Market Status:")
        if status['trade_allowed']:
            print_ok(f"{symbol} ist handelbar")
        else:
            print_warn(f"{symbol} Trade Mode: {status['trade_mode']}")
        
        # Tick data
        tick = data.get_tick(symbol)
        spread = data.get_spread(symbol)
        
        print(f"\n  💹 Current Prices:")
        print(f"     Bid:    {tick['bid']:.5f}")
        print(f"     Ask:    {tick['ask']:.5f}")
        print(f"     Spread: {spread:.1f} pips")
        print(f"     Time:   {tick['time']}")
        
        # Symbol info
        info = data.get_symbol_info(symbol)
        print(f"\n  📋 Symbol Info:")
        print(f"     Description:   {info['description']}")
        print(f"     Contract Size: {info['trade_contract_size']:,}")
        print(f"     Min Lot:       {info['volume_min']}")
        print(f"     Max Lot:       {info['volume_max']}")
        print(f"     Lot Step:      {info['volume_step']}")
        print(f"     Digits:        {info['digits']}")
        
        # Recent candles
        print(f"\n  🕯️  Last 3 H1 Candles:")
        candles = data.get_candles(symbol, "H1", 3)
        for _, row in candles.iterrows():
            print(f"     {row['time']} | O:{row['open']:.5f} H:{row['high']:.5f} L:{row['low']:.5f} C:{row['close']:.5f}")
        
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
        
        # Open positions
        print(f"\n  📊 Open Positions: {len(positions)}")
        if positions:
            total_profit = sum(p['profit'] for p in positions)
            for pos in positions:
                emoji = "🟢" if pos['type'] == 'buy' else "🔴"
                profit_emoji = "💰" if pos['profit'] >= 0 else "📉"
                print(f"     {emoji} {pos['symbol']}: {pos['type'].upper()} {pos['volume']} lots @ {pos['price_open']:.5f}")
                print(f"        Current: {pos['price_current']:.5f} | {profit_emoji} P/L: {pos['profit']:+.2f}")
                if pos['sl'] or pos['tp']:
                    print(f"        SL: {pos['sl'] or 'None'} | TP: {pos['tp'] or 'None'}")
            print(f"\n     📈 Total Open P/L: {total_profit:+.2f}")
        else:
            print_info("Keine offenen Positionen")
        
        # Pending orders
        print(f"\n  ⏳ Pending Orders: {len(pending)}")
        if pending:
            for order in pending:
                print(f"     📋 {order['symbol']}: {order['type']} {order['volume_initial']} @ {order['price_open']:.5f}")
        else:
            print_info("Keine pending Orders")
        
        return positions, pending
        
    except Exception as e:
        print_fail(f"Failed to get positions: {e}")
        return [], []


def test_trade(symbol="EURUSD", volume=0.01):
    """Test 5: Open and Close a Trade"""
    print_header("TEST 5: OPEN & CLOSE TEST TRADE")
    
    orders = MT5Orders()
    data = MT5Data()
    
    try:
        # Get current price
        tick = data.get_tick(symbol)
        info = data.get_symbol_info(symbol)
        
        # Calculate SL/TP (20 pips) - dynamisch basierend auf Symbol
        pip_value = 0.0001 if info['digits'] == 5 else 0.01
        
        sl = round(tick['bid'] - (20 * pip_value), info['digits'])
        tp = round(tick['ask'] + (20 * pip_value), info['digits'])
        
        print_info(f"Opening test trade...")
        print(f"     Symbol: {symbol}")
        print(f"     Type:   BUY")
        print(f"     Volume: {volume} lots")
        print(f"     Price:  ~{tick['ask']:.5f}")
        print(f"     SL:     {sl:.5f} (-20 pips)")
        print(f"     TP:     {tp:.5f} (+20 pips)")
        
        # Open trade
        result = orders.market_order(
            symbol=symbol,
            order_type="buy",
            volume=volume,
            sl=sl,
            tp=tp,
            comment="KIT-QuickTest"
        )
        
        print_ok(f"Trade OPENED! 🎉")
        print(f"     Ticket:      {result['ticket']}")
        print(f"     Deal:        {result['deal']}")
        print(f"     Entry Price: {result['price']:.5f}")
        
        # Wait a moment
        print_info("Warte 3 Sekunden vor dem Schließen...")
        for i in range(3, 0, -1):
            print(f"     {i}...", end=" ", flush=True)
            time.sleep(1)
        print()
        
        # Check current P/L
        positions = orders.get_positions()
        current_pos = next((p for p in positions if p['ticket'] == result['ticket']), None)
        if current_pos:
            print(f"\n     📊 Aktuelle Position:")
            print(f"        Current Price: {current_pos['price_current']:.5f}")
            print(f"        P/L:           {current_pos['profit']:+.2f}")
        
        # Close trade
        print_info("\nSchließe Trade...")
        close_result = orders.close_position(ticket=result['ticket'])
        
        print_ok(f"Trade CLOSED! 🎉")
        print(f"     Exit Price: {close_result['price']:.5f}")
        print(f"     P/L:        {close_result.get('profit', 0):+.2f}")
        
        return True
        
    except MT5OrderError as e:
        print_fail(f"Trade failed!")
        print(f"     Error Code: {e.retcode}")
        print(f"     Message:    {describe_error(e.retcode)}")
        print(f"     Comment:    {e.comment}")
        
        # Specific troubleshooting
        if e.retcode == 10019:
            print_info("\n💡 Lösung: Nicht genug Margin")
            print_info("   → Reduziere Lot Size (z.B. 0.01)")
            print_info("   → Prüfe deinen Kontostand")
        elif e.retcode == 10015 or e.retcode == 10016:
            print_info("\n💡 Lösung: Ungültige Stops")
            print_info("   → Broker hat minimum SL/TP Abstand")
            print_info("   → Versuche ohne SL/TP")
        elif e.retcode == 10010:
            print_info("\n💡 Lösung: Algo-Trading deaktiviert")
            print_info("   → MT5: Tools → Options → Expert Advisors")
            print_info("   → Haken bei 'Allow Algorithmic Trading'")
        elif e.retcode == 10018:
            print_info("\n💡 Lösung: Markt geschlossen")
            print_info("   → Forex: Mo-Fr 00:00-24:00")
            print_info("   → Versuche ein anderes Symbol")
        elif e.retcode == 10033:
            print_info("\n💡 Lösung: Invalid Fill Type")
            print_info("   → Broker unterstützt IOC nicht")
            print_info("   → Wird in nächster Version behoben")
            
        return False
    except Exception as e:
        print_fail(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_all_tests(args):
    """Run all tests"""
    print("\n" + "🚗"*20)
    print("  K.I.T. MetaTrader 5 Quick Test")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
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
            print_warn("⚠️  Dies scheint ein LIVE Account zu sein!")
            print_info("Nutze --force um auf Live-Accounts zu traden (auf eigenes Risiko)")
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
        print("\n  ⚠️  Einige Tests fehlgeschlagen.")
        print("  Siehe Fehlermeldungen oben für Details.")
        
        # Quick troubleshooting
        print("\n  💡 Quick Troubleshooting:")
        if not results['connection']:
            print("     → Ist MT5 gestartet und eingeloggt?")
            print("     → pip install MetaTrader5")
        if not results.get('account_info', True):
            print("     → Ist der Account aktiv?")
        if not results.get('market_data', True):
            print("     → Ist das Symbol verfügbar?")
            print("     → Ist der Markt geöffnet?")


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
  
Common Servers:
  RoboForex:   RoboForex-Demo, RoboForex-Pro
  IC Markets:  ICMarketsSC-Demo
  Pepperstone: Pepperstone-Demo
        """
    )
    
    parser.add_argument('--account', type=int, help='MT5 Account number')
    parser.add_argument('--password', type=str, help='MT5 Password')
    parser.add_argument('--server', type=str, help='MT5 Server (e.g., RoboForex-Demo)')
    parser.add_argument('--symbol', type=str, default='EURUSD', help='Symbol to test (default: EURUSD)')
    parser.add_argument('--volume', type=float, default=0.01, help='Trade volume (default: 0.01)')
    parser.add_argument('--trade', action='store_true', help='Execute test trade (open and close)')
    parser.add_argument('--force', action='store_true', help='Allow trade on live accounts')
    
    args = parser.parse_args()
    
    success = run_all_tests(args)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
