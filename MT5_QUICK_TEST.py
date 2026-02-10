#!/usr/bin/env python3
"""
K.I.T. MT5 Quick Test
Testet Verbindung und führt optional einen Demo-Trade aus.

Usage:
    python MT5_QUICK_TEST.py           # Nur Verbindungstest
    python MT5_QUICK_TEST.py --trade   # Mit Demo-Trade
"""

import sys

try:
    import MetaTrader5 as mt5
except ImportError:
    print("❌ MetaTrader5 library nicht installiert!")
    print("   Installieren mit: pip install MetaTrader5")
    sys.exit(1)

def print_header():
    print("""
    ╔═══════════════════════════════════════════╗
    ║     K.I.T. MT5 CONNECTION TEST            ║
    ║     Der beste Trading Agent der Welt!     ║
    ╚═══════════════════════════════════════════╝
    """)

def test_connection():
    print("🔌 Verbinde mit MT5...")
    
    if not mt5.initialize():
        error = mt5.last_error()
        print(f"❌ FEHLER: {error}")
        print("\n💡 LÖSUNGEN:")
        print("   1. MT5 Terminal starten")
        print("   2. Einloggen (RoboForex-Demo)")
        print("   3. Warten bis verbunden")
        print("   4. Script erneut ausführen")
        return False
    
    print("✅ Verbunden!")
    return True

def show_account():
    account = mt5.account_info()
    if account is None:
        print("❌ Keine Account-Info!")
        return False
    
    print(f"""
📊 ACCOUNT INFO:
   ┌────────────────────────────────────────┐
   │ Login:    {account.login:<28}│
   │ Server:   {account.server:<28}│
   │ Name:     {account.name[:28]:<28}│
   │ Balance:  {account.balance:>15,.2f} {account.currency:<8}│
   │ Equity:   {account.equity:>15,.2f} {account.currency:<8}│
   │ Leverage: 1:{account.leverage:<25}│
   │ Trading:  {'✅ ERLAUBT':<28}│
   └────────────────────────────────────────┘
    """) if account.trade_allowed else print(f"""
📊 ACCOUNT INFO:
   ┌────────────────────────────────────────┐
   │ Login:    {account.login:<28}│
   │ Server:   {account.server:<28}│
   │ Name:     {account.name[:28]:<28}│
   │ Balance:  {account.balance:>15,.2f} {account.currency:<8}│
   │ Equity:   {account.equity:>15,.2f} {account.currency:<8}│
   │ Leverage: 1:{account.leverage:<25}│
   │ Trading:  {'❌ DEAKTIVIERT!':<28}│
   └────────────────────────────────────────┘
    """)
    
    if not account.trade_allowed:
        print("⚠️  ALGO-TRADING DEAKTIVIERT!")
        print("   → MT5: Tools → Options → Expert Advisors")
        print("   → Aktiviere 'Allow Algorithmic Trading'")
        print("   → Toolbar: 'Algo Trading' Button auf GRÜN")
    
    return account.trade_allowed

def show_prices():
    symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
    print("💹 AKTUELLE PREISE:")
    print("   ┌──────────┬────────────┬────────────┬─────────┐")
    print("   │ Symbol   │ Bid        │ Ask        │ Spread  │")
    print("   ├──────────┼────────────┼────────────┼─────────┤")
    
    for symbol in symbols:
        tick = mt5.symbol_info_tick(symbol)
        if tick:
            if "JPY" in symbol:
                spread = (tick.ask - tick.bid) * 100
            elif "XAU" in symbol:
                spread = (tick.ask - tick.bid) * 10
            else:
                spread = (tick.ask - tick.bid) * 10000
            print(f"   │ {symbol:<8} │ {tick.bid:>10.5f} │ {tick.ask:>10.5f} │ {spread:>6.1f}  │")
        else:
            print(f"   │ {symbol:<8} │ {'N/A':>10} │ {'N/A':>10} │ {'N/A':>6}  │")
    
    print("   └──────────┴────────────┴────────────┴─────────┘")
    print()

def show_positions():
    positions = mt5.positions_get()
    if positions is None or len(positions) == 0:
        print("📈 OFFENE POSITIONEN: Keine")
        return
    
    print(f"📈 OFFENE POSITIONEN: {len(positions)}")
    print("   ┌──────────┬──────┬────────┬────────────┬─────────────┐")
    print("   │ Symbol   │ Type │ Volume │ Profit     │ Ticket      │")
    print("   ├──────────┼──────┼────────┼────────────┼─────────────┤")
    
    for pos in positions:
        pos_type = "BUY" if pos.type == 0 else "SELL"
        print(f"   │ {pos.symbol:<8} │ {pos_type:<4} │ {pos.volume:>6.2f} │ {pos.profit:>+10.2f} │ {pos.ticket:<11} │")
    
    print("   └──────────┴──────┴────────┴────────────┴─────────────┘")
    print()

def execute_demo_trade():
    print("\n🎯 DEMO TRADE AUSFÜHREN")
    print("   ─────────────────────")
    print("   Symbol: EURUSD")
    print("   Type:   BUY")
    print("   Volume: 0.01 Lot (minimal)")
    
    # Auto-confirm mit --auto flag
    if "--auto" not in sys.argv:
        try:
            confirm = input("\n   Trade ausführen? (j/n): ").lower().strip()
            if confirm not in ['j', 'ja', 'y', 'yes']:
                print("   ❌ Abgebrochen.")
                return
        except:
            print("   ❌ Abgebrochen (kein Input).")
            return
    else:
        print("\n   [AUTO-MODE] Führe Trade aus...")
    
    symbol = "EURUSD"
    symbol_info = mt5.symbol_info(symbol)
    
    if symbol_info is None:
        print(f"   ❌ Symbol {symbol} nicht gefunden!")
        return
    
    if not symbol_info.visible:
        if not mt5.symbol_select(symbol, True):
            print(f"   ❌ Kann {symbol} nicht aktivieren!")
            return
    
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        print(f"   ❌ Kann Preis für {symbol} nicht abrufen!")
        return
    
    price = tick.ask
    point = symbol_info.point
    
    # Order request
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY,
        "price": price,
        "sl": round(price - 50 * point, 5),  # 50 pips SL
        "tp": round(price + 100 * point, 5), # 100 pips TP
        "deviation": 20,
        "magic": 123456789,
        "comment": "K.I.T. Test Trade",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    print(f"\n   Sende Order @ {price:.5f}...")
    result = mt5.order_send(request)
    
    if result is None:
        print(f"   ❌ Order fehlgeschlagen: Kein Result!")
        return
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        error_messages = {
            10004: "Requote - Preis hat sich geändert",
            10006: "Request abgelehnt",
            10007: "Request abgebrochen",
            10010: "Auto-Trading deaktiviert!",
            10013: "Ungültiges Volume",
            10014: "Ungültiger Preis",
            10015: "Ungültige Stops",
            10016: "Ungültiger Handelstyp",
            10017: "Trade deaktiviert",
            10018: "Markt geschlossen",
            10019: "Nicht genug Geld",
        }
        msg = error_messages.get(result.retcode, result.comment)
        print(f"   ❌ Trade fehlgeschlagen!")
        print(f"   Error Code: {result.retcode}")
        print(f"   Grund: {msg}")
        
        if result.retcode == 10010:
            print("\n   💡 LÖSUNG:")
            print("   1. MT5: Tools → Options → Expert Advisors")
            print("   2. Aktiviere 'Allow Algorithmic Trading'")
            print("   3. Toolbar: 'Algo Trading' auf GRÜN")
    else:
        print(f"""
   ╔════════════════════════════════════════╗
   ║       ✅ TRADE ERFOLGREICH!            ║
   ╠════════════════════════════════════════╣
   ║  Ticket:  {result.order:<27}║
   ║  Symbol:  EURUSD                       ║
   ║  Type:    BUY                          ║
   ║  Volume:  0.01                         ║
   ║  Price:   {result.price:<27.5f}║
   ╚════════════════════════════════════════╝
        """)

def main():
    print_header()
    
    # Verbinden
    if not test_connection():
        return 1
    
    # Account Info
    trading_allowed = show_account()
    
    # Preise
    show_prices()
    
    # Positionen
    show_positions()
    
    # Trade?
    if trading_allowed and ("--trade" in sys.argv or "--auto" in sys.argv):
        execute_demo_trade()
    elif not trading_allowed:
        print("⚠️  Trading deaktiviert - kein Demo-Trade möglich")
    else:
        print("💡 Für Demo-Trade: python MT5_QUICK_TEST.py --trade")
    
    # Cleanup
    mt5.shutdown()
    print("\n✅ Test abgeschlossen!\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
