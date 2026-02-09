"""
Example Trade - MetaTrader 5 Trading Beispiel für K.I.T.

Dieses Skript demonstriert:
1. Verbindung zu MT5
2. Account-Info abrufen
3. Marktdaten holen
4. Demo-Trade ausführen (nur im Demo-Account!)

⚠️ WARNUNG: Dieses Skript führt echte Trades aus!
Nur mit Demo-Account verwenden zum Testen!
"""

import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import MetaTrader5 as mt5
from scripts.mt5_connector import MT5Connector, MT5Error
from scripts.mt5_orders import MT5Orders, MT5OrderError
from scripts.mt5_data import MT5Data


def main():
    """Main example function"""
    
    print("=" * 60)
    print("🤖 K.I.T. MetaTrader 5 - Example Trade")
    print("=" * 60)
    
    # =====================================================
    # CONFIGURATION - Anpassen für deinen Account!
    # =====================================================
    
    # Option 1: Bereits im MT5 Terminal eingeloggt
    USE_EXISTING_LOGIN = True
    
    # Option 2: Mit Credentials einloggen
    ACCOUNT = 12345678          # Deine Account-Nummer
    PASSWORD = "your_password"   # Dein Passwort
    SERVER = "Broker-Demo"       # Dein Server
    
    # Trade-Parameter
    SYMBOL = "EURUSD"
    VOLUME = 0.01  # Kleinste Lot-Größe für Tests
    
    # =====================================================
    # 1. VERBINDUNG HERSTELLEN
    # =====================================================
    
    print("\n📡 Verbinde zu MetaTrader 5...")
    
    connector = MT5Connector()
    
    try:
        if USE_EXISTING_LOGIN:
            # Nutze bereits eingeloggtes Terminal
            connector.connect()
        else:
            # Login mit Credentials
            connector.connect(
                account=ACCOUNT,
                password=PASSWORD,
                server=SERVER
            )
        
        print("✅ Verbunden!")
        
    except MT5Error as e:
        print(f"❌ Verbindungsfehler: {e}")
        print("\n💡 Stelle sicher, dass:")
        print("   1. MetaTrader 5 installiert und gestartet ist")
        print("   2. Du in deinem Account eingeloggt bist")
        print("   3. Auto-Trading aktiviert ist (Tools → Options → Expert Advisors)")
        return
    
    # =====================================================
    # 2. ACCOUNT-INFO ANZEIGEN
    # =====================================================
    
    print("\n" + "=" * 60)
    print("📊 ACCOUNT INFO")
    print("=" * 60)
    
    info = connector.get_account_info()
    print(f"  Login:        {info['login']}")
    print(f"  Name:         {info['name']}")
    print(f"  Server:       {info['server']}")
    print(f"  Balance:      {info['balance']:,.2f} {info['currency']}")
    print(f"  Equity:       {info['equity']:,.2f} {info['currency']}")
    print(f"  Free Margin:  {info['free_margin']:,.2f} {info['currency']}")
    print(f"  Leverage:     1:{info['leverage']}")
    print(f"  Trading OK:   {'✅ Ja' if info['trade_allowed'] else '❌ Nein'}")
    
    # =====================================================
    # 3. MARKTDATEN ABRUFEN
    # =====================================================
    
    print("\n" + "=" * 60)
    print(f"📈 MARKTDATEN - {SYMBOL}")
    print("=" * 60)
    
    data = MT5Data()
    
    # Aktueller Tick
    tick = data.get_tick(SYMBOL)
    spread = data.get_spread(SYMBOL)
    
    print(f"  Bid:     {tick['bid']:.5f}")
    print(f"  Ask:     {tick['ask']:.5f}")
    print(f"  Spread:  {spread:.1f} pips")
    print(f"  Zeit:    {tick['time']}")
    
    # Symbol-Info
    symbol_info = data.get_symbol_info(SYMBOL)
    print(f"\n  Contract Size: {symbol_info['trade_contract_size']:,}")
    print(f"  Min Volume:    {symbol_info['volume_min']}")
    print(f"  Max Volume:    {symbol_info['volume_max']}")
    
    # Letzte 5 H1 Kerzen
    print(f"\n  📊 Letzte 5 H1 Kerzen:")
    candles = data.get_candles(SYMBOL, "H1", 5)
    for _, row in candles.iterrows():
        direction = "🟢" if row['close'] >= row['open'] else "🔴"
        print(f"     {direction} {row['time'].strftime('%Y-%m-%d %H:%M')} | "
              f"O: {row['open']:.5f} H: {row['high']:.5f} L: {row['low']:.5f} C: {row['close']:.5f}")
    
    # =====================================================
    # 4. OFFENE POSITIONEN PRÜFEN
    # =====================================================
    
    print("\n" + "=" * 60)
    print("📋 OFFENE POSITIONEN")
    print("=" * 60)
    
    orders = MT5Orders()
    positions = orders.get_positions()
    
    if positions:
        for pos in positions:
            direction = "🟢 BUY" if pos['type'] == 'buy' else "🔴 SELL"
            profit_emoji = "💰" if pos['profit'] >= 0 else "📉"
            print(f"  {direction} {pos['volume']} {pos['symbol']} @ {pos['price_open']:.5f}")
            print(f"     {profit_emoji} P/L: {pos['profit']:+.2f} | SL: {pos['sl']} | TP: {pos['tp']}")
    else:
        print("  Keine offenen Positionen")
    
    # =====================================================
    # 5. DEMO TRADE (OPTIONAL)
    # =====================================================
    
    print("\n" + "=" * 60)
    print("🎯 DEMO TRADE")
    print("=" * 60)
    
    # Sicherheitscheck: Nur Demo-Accounts!
    if "demo" not in info['server'].lower() and "practice" not in info['server'].lower():
        print("⚠️  WARNUNG: Dies scheint ein LIVE-Account zu sein!")
        print("   Demo-Trade wird NICHT ausgeführt.")
        print("   Nutze einen Demo-Account zum Testen.")
    else:
        print(f"\n  Trade-Details:")
        print(f"    Symbol: {SYMBOL}")
        print(f"    Volume: {VOLUME}")
        print(f"    Type:   BUY (Market Order)")
        
        # Berechne SL/TP (20 pips SL, 30 pips TP)
        sl = tick['bid'] - 0.0020  # 20 pips unter Bid
        tp = tick['ask'] + 0.0030  # 30 pips über Ask
        
        print(f"    SL:     {sl:.5f} (-20 pips)")
        print(f"    TP:     {tp:.5f} (+30 pips)")
        
        # Bestätigung anfordern
        print("\n  ⚠️  Möchtest du diesen Trade ausführen?")
        response = input("     Eingabe 'YES' zum Bestätigen: ")
        
        if response.upper() == 'YES':
            try:
                result = orders.market_order(
                    symbol=SYMBOL,
                    order_type="buy",
                    volume=VOLUME,
                    sl=sl,
                    tp=tp,
                    comment="KIT-Example"
                )
                
                print(f"\n  ✅ Trade ausgeführt!")
                print(f"     Ticket:  {result['ticket']}")
                print(f"     Price:   {result['price']:.5f}")
                print(f"     Volume:  {result['volume']}")
                
            except MT5OrderError as e:
                print(f"\n  ❌ Trade fehlgeschlagen: {e}")
        else:
            print("\n  ℹ️  Trade abgebrochen.")
    
    # =====================================================
    # 6. CLEANUP
    # =====================================================
    
    print("\n" + "=" * 60)
    connector.disconnect()
    print("👋 Verbindung getrennt. Auf Wiedersehen!")
    print("=" * 60)


if __name__ == "__main__":
    main()
