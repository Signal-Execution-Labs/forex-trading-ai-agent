# MetaTrader 4/5 Skill für K.I.T.

> 🤖 K.I.T. kann jetzt Forex & CFD Trading über MetaTrader 5 ausführen!

## 📋 Übersicht

Dieses Skill ermöglicht K.I.T.:
- **Account-Verbindung** zu MetaTrader 5 Brokern
- **Order-Ausführung** (Market, Limit, Stop Orders)
- **Position-Management** (Open, Modify, Close)
- **Echtzeit-Marktdaten** (Ticks, Candles, Quotes)
- **Account-Informationen** (Balance, Equity, Margin)

---

## 🔧 Installation

### 1. MetaTrader 5 Terminal installieren

1. Download von [MetaQuotes](https://www.metatrader5.com/de/download)
2. Installieren und starten
3. Demo- oder Live-Account bei einem Broker eröffnen
4. Login-Daten notieren: **Account-Nummer**, **Passwort**, **Server**

### 2. Python MetaTrader5 Library

```bash
pip install MetaTrader5
```

**Voraussetzungen:**
- Windows OS (MT5 ist nur für Windows)
- Python 3.7+
- MetaTrader 5 Terminal muss installiert sein

### 3. Zusätzliche Dependencies

```bash
pip install pandas numpy
```

---

## 🚀 Quick Start

```python
from scripts.mt5_connector import MT5Connector

# Verbinden
mt5 = MT5Connector()
mt5.connect(
    account=12345678,
    password="dein_passwort",
    server="ICMarketsSC-Demo"
)

# Account-Info
print(mt5.get_account_info())

# Trennen
mt5.disconnect()
```

---

## 📖 Vollständige Dokumentation

### Account Connection

```python
from scripts.mt5_connector import MT5Connector

mt5 = MT5Connector()

# Methode 1: Mit Credentials
success = mt5.connect(
    account=12345678,
    password="passwort",
    server="BrokerServer-Demo"
)

# Methode 2: Bereits eingeloggt im Terminal
success = mt5.connect()  # Nutzt aktive Session

# Verbindung prüfen
if mt5.is_connected():
    print("Verbunden!")

# Account-Info
info = mt5.get_account_info()
# Returns: {
#   'login': 12345678,
#   'balance': 10000.0,
#   'equity': 10150.0,
#   'margin': 500.0,
#   'free_margin': 9650.0,
#   'leverage': 100,
#   'currency': 'USD',
#   'server': 'BrokerServer-Demo'
# }
```

### Order Execution

```python
from scripts.mt5_orders import MT5Orders
import MetaTrader5 as mt5

orders = MT5Orders()

# MARKET ORDER - Sofortige Ausführung
result = orders.market_order(
    symbol="EURUSD",
    order_type="buy",      # "buy" oder "sell"
    volume=0.1,            # Lot-Größe
    sl=1.0850,             # Stop Loss (optional)
    tp=1.1050,             # Take Profit (optional)
    comment="KIT-Trade"
)

# LIMIT ORDER - Bei bestimmtem Preis
result = orders.limit_order(
    symbol="EURUSD",
    order_type="buy_limit",  # buy_limit, sell_limit
    volume=0.1,
    price=1.0900,            # Gewünschter Entry
    sl=1.0850,
    tp=1.1000
)

# STOP ORDER - Breakout Trading
result = orders.stop_order(
    symbol="EURUSD",
    order_type="buy_stop",   # buy_stop, sell_stop
    volume=0.1,
    price=1.1000,
    sl=1.0950,
    tp=1.1100
)
```

### Position Management

```python
from scripts.mt5_orders import MT5Orders

orders = MT5Orders()

# Alle offenen Positionen
positions = orders.get_positions()
for pos in positions:
    print(f"{pos['symbol']}: {pos['type']} {pos['volume']} @ {pos['price_open']}")
    print(f"  P/L: {pos['profit']}")

# Position nach Symbol
eurusd_pos = orders.get_positions(symbol="EURUSD")

# Position schließen
orders.close_position(ticket=123456789)

# Alle Positionen schließen
orders.close_all_positions()

# Position teilweise schließen
orders.close_position(ticket=123456789, volume=0.05)

# Stop Loss / Take Profit ändern
orders.modify_position(
    ticket=123456789,
    sl=1.0900,
    tp=1.1100
)
```

### Pending Orders

```python
# Alle pending Orders abrufen
pending = orders.get_pending_orders()

# Order löschen
orders.cancel_order(ticket=987654321)

# Alle pending Orders löschen
orders.cancel_all_orders()
```

### Market Data

```python
from scripts.mt5_data import MT5Data

data = MT5Data()

# Aktueller Tick (Bid/Ask)
tick = data.get_tick("EURUSD")
# Returns: {'bid': 1.0950, 'ask': 1.0951, 'time': datetime}

# Spread in Pips
spread = data.get_spread("EURUSD")  # z.B. 1.0

# Candlestick-Daten (OHLCV)
candles = data.get_candles(
    symbol="EURUSD",
    timeframe="H1",       # M1, M5, M15, M30, H1, H4, D1, W1, MN1
    count=100             # Anzahl Kerzen
)
# Returns: pandas DataFrame mit open, high, low, close, volume, time

# Spezifischer Zeitraum
from datetime import datetime
candles = data.get_candles_range(
    symbol="EURUSD",
    timeframe="H1",
    date_from=datetime(2024, 1, 1),
    date_to=datetime(2024, 1, 31)
)
```

### Symbol Info

```python
from scripts.mt5_data import MT5Data

data = MT5Data()

# Symbol-Informationen
info = data.get_symbol_info("EURUSD")
# Returns: {
#   'symbol': 'EURUSD',
#   'bid': 1.0950,
#   'ask': 1.0951,
#   'spread': 1,
#   'digits': 5,
#   'point': 0.00001,
#   'trade_contract_size': 100000,
#   'volume_min': 0.01,
#   'volume_max': 100.0,
#   'volume_step': 0.01,
#   'swap_long': -0.5,
#   'swap_short': 0.3
# }

# Alle verfügbaren Symbole
symbols = data.get_all_symbols()

# Nur Forex-Paare
forex = data.get_symbols_by_group("*USD*")
```

### Account Info

```python
from scripts.mt5_connector import MT5Connector

mt5 = MT5Connector()
mt5.connect()

# Vollständige Account-Info
info = mt5.get_account_info()
print(f"Balance: {info['balance']} {info['currency']}")
print(f"Equity: {info['equity']}")
print(f"Free Margin: {info['free_margin']}")
print(f"Margin Level: {info['margin_level']}%")

# Trading erlaubt?
if mt5.is_trading_allowed():
    print("Trading aktiviert")
```

---

## 📊 Timeframe-Konstanten

| K.I.T. Code | MT5 Konstante | Beschreibung |
|-------------|---------------|--------------|
| `M1`        | `TIMEFRAME_M1`  | 1 Minute |
| `M5`        | `TIMEFRAME_M5`  | 5 Minuten |
| `M15`       | `TIMEFRAME_M15` | 15 Minuten |
| `M30`       | `TIMEFRAME_M30` | 30 Minuten |
| `H1`        | `TIMEFRAME_H1`  | 1 Stunde |
| `H4`        | `TIMEFRAME_H4`  | 4 Stunden |
| `D1`        | `TIMEFRAME_D1`  | 1 Tag |
| `W1`        | `TIMEFRAME_W1`  | 1 Woche |
| `MN1`       | `TIMEFRAME_MN1` | 1 Monat |

---

## ⚠️ Error Handling

```python
from scripts.mt5_connector import MT5Connector, MT5Error

mt5 = MT5Connector()

try:
    mt5.connect(account=123, password="wrong", server="Server")
except MT5Error as e:
    print(f"Fehler: {e.code} - {e.message}")
    # Fehler: 10006 - Authorization failed
```

### Häufige Fehlercodes

| Code | Bedeutung |
|------|-----------|
| 10004 | Requote |
| 10006 | Authorization failed |
| 10007 | Zu viele Requests |
| 10010 | Auto-Trading deaktiviert |
| 10013 | Invalid volume |
| 10014 | Invalid price |
| 10015 | Invalid stops |
| 10016 | Trade disabled |
| 10019 | Not enough money |

---

## 🔒 Sicherheitshinweise

1. **Credentials niemals im Code speichern!**
   - Nutze Umgebungsvariablen oder verschlüsselte Config
   
2. **Demo-Account zuerst!**
   - Immer erst im Demo-Modus testen
   
3. **Risk Management aktivieren!**
   - Setze immer Stop Loss
   - Nutze angemessene Lot-Größen
   - Max 2% Risk pro Trade

4. **Auto-Trading im MT5 aktivieren:**
   - Tools → Options → Expert Advisors
   - "Allow automated trading" aktivieren

---

## 🧪 Test-Beispiel

```bash
cd skills/metatrader
python examples/example_trade.py
```

Siehe `examples/example_trade.py` für ein vollständiges Beispiel.

---

## 📁 Dateistruktur

```
skills/metatrader/
├── SKILL.md              # Diese Dokumentation
├── scripts/
│   ├── mt5_connector.py  # Verbindungs-Management
│   ├── mt5_orders.py     # Order-Ausführung
│   └── mt5_data.py       # Marktdaten
└── examples/
    └── example_trade.py  # Beispiel-Trade
```

---

## 🤖 K.I.T. Befehle

Nach Integration kann K.I.T. diese Befehle verstehen:

- *"Kaufe 0.1 Lot EURUSD"*
- *"Zeige meine offenen Positionen"*
- *"Schließe alle EUR Trades"*
- *"Was ist der aktuelle EURUSD Kurs?"*
- *"Zeige H4 Chart für Gold"*
- *"Wie ist mein Kontostand?"*

---

**Erstellt:** 2026-02-09  
**Version:** 1.0.0  
**Autor:** K.I.T. MetaTrader Agent
