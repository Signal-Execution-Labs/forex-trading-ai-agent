#!/usr/bin/env python3
"""
K.I.T. MT5 Quick Test
Tests connection and optionally executes a demo trade.

Usage:
    python MT5_QUICK_TEST.py           # Connection test only
    python MT5_QUICK_TEST.py --trade   # With demo trade
    python MT5_QUICK_TEST.py --auto    # Auto-execute trade (no prompt)
"""

import sys

try:
    import MetaTrader5 as mt5
except ImportError:
    print("ERROR: MetaTrader5 library not installed!")
    print("   Install with: pip install MetaTrader5")
    sys.exit(1)

def print_header():
    print("""
    +=============================================+
    |     K.I.T. MT5 CONNECTION TEST              |
    |     Your Autonomous AI Financial Agent      |
    +=============================================+
    """)

def test_connection():
    print("Connecting to MT5...")
    
    if not mt5.initialize():
        error = mt5.last_error()
        print(f"ERROR: {error}")
        print("\nSOLUTIONS:")
        print("   1. Start MT5 Terminal")
        print("   2. Log in to your broker")
        print("   3. Wait until connected")
        print("   4. Run this script again")
        return False
    
    print("OK Connected!")
    return True

def show_account():
    account = mt5.account_info()
    if account is None:
        print("ERROR: No account info!")
        return False
    
    trading_status = "OK ENABLED" if account.trade_allowed else "X DISABLED"
    
    print(f"""
ACCOUNT INFO:
   +----------------------------------------+
   | Login:    {account.login:<26}|
   | Server:   {account.server:<26}|
   | Name:     {account.name[:26]:<26}|
   | Balance:  {account.balance:>13,.2f} {account.currency:<8}|
   | Equity:   {account.equity:>13,.2f} {account.currency:<8}|
   | Leverage: 1:{account.leverage:<24}|
   | Trading:  {trading_status:<26}|
   +----------------------------------------+
    """)
    
    if not account.trade_allowed:
        print("WARNING: ALGO-TRADING DISABLED!")
        print("   -> MT5: Tools > Options > Expert Advisors")
        print("   -> Enable 'Allow Algorithmic Trading'")
        print("   -> Toolbar: 'Algo Trading' button must be GREEN")
    
    return account.trade_allowed

def show_prices():
    symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
    print("LIVE PRICES:")
    print("   +----------+------------+------------+---------+")
    print("   | Symbol   | Bid        | Ask        | Spread  |")
    print("   +----------+------------+------------+---------+")
    
    for symbol in symbols:
        tick = mt5.symbol_info_tick(symbol)
        if tick:
            if "JPY" in symbol:
                spread = (tick.ask - tick.bid) * 100
            elif "XAU" in symbol:
                spread = (tick.ask - tick.bid) * 10
            else:
                spread = (tick.ask - tick.bid) * 10000
            print(f"   | {symbol:<8} | {tick.bid:>10.5f} | {tick.ask:>10.5f} | {spread:>6.1f}  |")
        else:
            print(f"   | {symbol:<8} | {'N/A':>10} | {'N/A':>10} | {'N/A':>6}  |")
    
    print("   +----------+------------+------------+---------+")
    print()

def show_positions():
    positions = mt5.positions_get()
    if positions is None or len(positions) == 0:
        print("OPEN POSITIONS: None")
        return
    
    print(f"OPEN POSITIONS: {len(positions)}")
    print("   +----------+------+--------+------------+-------------+")
    print("   | Symbol   | Type | Volume | Profit     | Ticket      |")
    print("   +----------+------+--------+------------+-------------+")
    
    for pos in positions:
        pos_type = "BUY" if pos.type == 0 else "SELL"
        print(f"   | {pos.symbol:<8} | {pos_type:<4} | {pos.volume:>6.2f} | {pos.profit:>+10.2f} | {pos.ticket:<11} |")
    
    print("   +----------+------+--------+------------+-------------+")
    print()

def execute_demo_trade():
    print("\nDEMO TRADE")
    print("   ---------------------")
    print("   Symbol: EURUSD")
    print("   Type:   BUY")
    print("   Volume: 0.01 Lot (minimum)")
    
    # Auto-confirm with --auto flag
    if "--auto" not in sys.argv:
        try:
            confirm = input("\n   Execute trade? (y/n): ").lower().strip()
            if confirm not in ['y', 'yes']:
                print("   Cancelled.")
                return
        except:
            print("   Cancelled (no input).")
            return
    else:
        print("\n   [AUTO-MODE] Executing trade...")
    
    symbol = "EURUSD"
    symbol_info = mt5.symbol_info(symbol)
    
    if symbol_info is None:
        print(f"   ERROR: Symbol {symbol} not found!")
        return
    
    if not symbol_info.visible:
        if not mt5.symbol_select(symbol, True):
            print(f"   ERROR: Cannot select {symbol}!")
            return
    
    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        print(f"   ERROR: Cannot get price for {symbol}!")
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
    
    print(f"\n   Sending order @ {price:.5f}...")
    result = mt5.order_send(request)
    
    if result is None:
        print(f"   ERROR: Order failed - no result!")
        return
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        error_messages = {
            10004: "Requote - price changed",
            10006: "Request rejected",
            10007: "Request cancelled",
            10010: "Auto-trading disabled!",
            10013: "Invalid volume",
            10014: "Invalid price",
            10015: "Invalid stops",
            10016: "Invalid trade type",
            10017: "Trade disabled",
            10018: "Market closed",
            10019: "Not enough money",
        }
        msg = error_messages.get(result.retcode, result.comment)
        print(f"   ERROR: Trade failed!")
        print(f"   Error Code: {result.retcode}")
        print(f"   Reason: {msg}")
        
        if result.retcode == 10010:
            print("\n   SOLUTION:")
            print("   1. MT5: Tools > Options > Expert Advisors")
            print("   2. Enable 'Allow Algorithmic Trading'")
            print("   3. Toolbar: 'Algo Trading' must be GREEN")
    else:
        print(f"""
   +========================================+
   |       OK TRADE SUCCESSFUL!             |
   +========================================+
   |  Ticket:  {result.order:<25}|
   |  Symbol:  EURUSD                       |
   |  Type:    BUY                          |
   |  Volume:  0.01                         |
   |  Price:   {result.price:<25.5f}|
   +========================================+
        """)

def main():
    print_header()
    
    # Connect
    if not test_connection():
        return 1
    
    # Account Info
    trading_allowed = show_account()
    
    # Prices
    show_prices()
    
    # Positions
    show_positions()
    
    # Trade?
    if trading_allowed and ("--trade" in sys.argv or "--auto" in sys.argv):
        execute_demo_trade()
    elif not trading_allowed:
        print("WARNING: Trading disabled - cannot execute demo trade")
    else:
        print("TIP: For demo trade run: python MT5_QUICK_TEST.py --trade")
    
    # Cleanup
    mt5.shutdown()
    print("\nOK Test completed!\n")
    return 0

if __name__ == "__main__":
    sys.exit(main())
