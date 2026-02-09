# MetaTrader 4/5 Skill für K.I.T. 🚀

> 🤖 **DER BESTE TRADING AGENT DER WELT** - Vollständige MT5 Integration mit Enterprise-Features

## 🔥 WELTKLASSE FEATURES

| Feature | Status | Beschreibung |
|---------|--------|--------------|
| **Core Trading** | ✅ | Market/Limit/Stop Orders, Position Management |
| **Multi-Account** | ✅ | Unbegrenzte Accounts parallel verwalten |
| **Copy Trading** | ✅ | Master-Follower mit Multiplikatoren |
| **Strategy Tester** | ✅ | Backtesting, Optimization, Walk-Forward |
| **Signal Provider** | ✅ | Telegram/Discord/Webhook Broadcasting |
| **Expert Advisor** | ✅ | Bidirektionale MQL5 Kommunikation |
| **VPS Deployment** | ✅ | 24/7 Production mit Auto-Recovery |

---

## 📦 Installation

### 1. MetaTrader 5 Terminal

```bash
# Download: https://www.metatrader5.com/de/download
# Installieren und Account einrichten
```

### 2. Python Dependencies

```bash
pip install MetaTrader5 pandas numpy psutil requests flask
```

### 3. Optional für erweiterte Features

```bash
pip install ta-lib scikit-learn tensorflow  # ML/Technical Analysis
```

---

## 🚀 Quick Start

```python
from skills.metatrader import MT5Connector, MT5Orders, MT5Data

# Verbinden
mt5 = MT5Connector()
mt5.connect(account=123456, password="pass", server="Broker-Demo")

# Trade ausführen
orders = MT5Orders()
orders.market_order("EURUSD", "buy", 0.1, sl=1.0850, tp=1.1000)

# Daten abrufen
data = MT5Data()
candles = data.get_candles("EURUSD", "H1", 100)

# Trennen
mt5.disconnect()
```

---

## 📖 Module-Übersicht

### 1️⃣ MT5 Connector (`mt5_connector.py`)

Verbindungs-Management mit Error Handling.

```python
from scripts.mt5_connector import MT5Connector, MT5Error

mt5 = MT5Connector()

# Mit Credentials
mt5.connect(account=123456, password="pass", server="ICMarkets-Demo")

# Account Info
info = mt5.get_account_info()
print(f"Balance: {info['balance']} {info['currency']}")
print(f"Leverage: 1:{info['leverage']}")

# Trading erlaubt?
if mt5.is_trading_allowed():
    print("✅ Ready to trade!")
```

### 2️⃣ MT5 Orders (`mt5_orders.py`)

Vollständiges Order Management.

```python
from scripts.mt5_orders import MT5Orders

orders = MT5Orders()

# MARKET ORDER
result = orders.market_order(
    symbol="EURUSD",
    order_type="buy",
    volume=0.1,
    sl=1.0850,
    tp=1.1050
)
print(f"Order executed: Ticket #{result['ticket']}")

# LIMIT ORDER  
orders.limit_order(
    symbol="EURUSD",
    order_type="buy_limit",
    volume=0.1,
    price=1.0900,
    sl=1.0850,
    tp=1.0980
)

# STOP ORDER
orders.stop_order(
    symbol="EURUSD",
    order_type="buy_stop",
    volume=0.1,
    price=1.1000,
    sl=1.0950,
    tp=1.1100
)

# POSITION MANAGEMENT
positions = orders.get_positions()
for pos in positions:
    print(f"{pos['symbol']}: {pos['profit']:+.2f}")

# Schließen
orders.close_position(ticket=123456789)
orders.close_all_positions(symbol="EURUSD")

# Modifizieren
orders.modify_position(ticket=123456789, sl=1.0900, tp=1.1000)
```

### 3️⃣ MT5 Data (`mt5_data.py`)

Echtzeit-Marktdaten und Historical Data.

```python
from scripts.mt5_data import MT5Data

data = MT5Data()

# TICK DATA
tick = data.get_tick("EURUSD")
print(f"Bid: {tick['bid']}, Ask: {tick['ask']}")

# SPREAD
spread = data.get_spread("EURUSD")
print(f"Spread: {spread} pips")

# CANDLES (OHLCV)
candles = data.get_candles("EURUSD", "H1", 100)
print(candles.tail())

# DATE RANGE
from datetime import datetime
candles = data.get_candles_range(
    "EURUSD", "H1",
    datetime(2024, 1, 1),
    datetime(2024, 1, 31)
)

# SYMBOL INFO
info = data.get_symbol_info("EURUSD")
print(f"Contract Size: {info['trade_contract_size']}")
print(f"Min Volume: {info['volume_min']}")
```

---

## 🏆 ENTERPRISE FEATURES

### 4️⃣ Multi-Account Manager (`mt5_multi_account.py`)

Verwalte unbegrenzte Accounts gleichzeitig!

```python
from scripts.mt5_multi_account import MT5MultiAccountManager, AccountConfig

manager = MT5MultiAccountManager()

# Accounts hinzufügen
manager.add_account(AccountConfig(
    account_id=111111,
    password="pass1",
    server="Broker-Demo",
    name="Aggressive Account",
    max_risk_percent=5.0,
    copy_multiplier=1.5
))

manager.add_account(AccountConfig(
    account_id=222222,
    password="pass2",
    server="Broker-Demo",
    name="Conservative Account",
    max_risk_percent=1.0,
    copy_multiplier=0.5
))

# Auf ALLEN Accounts gleichzeitig traden
results = manager.execute_on_all("EURUSD", "buy", 0.1, sl=1.0850, tp=1.1000)

# Portfolio Summary
summary = manager.get_portfolio_summary()
print(f"Total Balance: ${summary['total_balance']:,.2f}")
print(f"Total Profit: ${summary['total_profit']:+,.2f}")

# Copy Trading Setup
manager.setup_copy_trading(
    master_account=111111,
    follower_accounts=[222222, 333333],
    multipliers={222222: 0.5, 333333: 2.0}
)

# Position Sizing mit Risk Management
lot_size = manager.calculate_position_size(
    account_id=111111,
    symbol="EURUSD",
    stop_loss_pips=20,
    risk_percent=2.0
)
print(f"Calculated lot size: {lot_size}")
```

### 5️⃣ Strategy Tester (`mt5_strategy_tester.py`)

Professionelles Backtesting mit Monte Carlo Simulation!

```python
from scripts.mt5_strategy_tester import (
    MT5StrategyTester, 
    MovingAverageCrossStrategy,
    Strategy,
    TradeDirection
)

# Tester erstellen
tester = MT5StrategyTester(initial_balance=10000)
tester.load_data("EURUSD", "H1", days=365)

# Strategie testen
strategy = MovingAverageCrossStrategy()
result = tester.run_backtest(strategy, volume=0.1)

print(f"📊 Backtest Results:")
print(f"  Total Trades: {result.total_trades}")
print(f"  Win Rate: {result.win_rate:.1f}%")
print(f"  Total Profit: ${result.total_profit:,.2f}")
print(f"  Profit Factor: {result.profit_factor:.2f}")
print(f"  Max Drawdown: {result.max_drawdown_percent:.1f}%")
print(f"  Sharpe Ratio: {result.sharpe_ratio:.2f}")

# OPTIMIZATION
opt_results = tester.optimize(
    strategy,
    param_grid={
        'fast_period': [5, 10, 15, 20],
        'slow_period': [20, 30, 40, 50],
        'sl_pips': [15, 20, 25],
        'tp_pips': [30, 40, 50]
    },
    metric='profit_factor'
)
print(f"Best params: {opt_results[0]['parameters']}")

# WALK-FORWARD ANALYSIS
wf_results = tester.walk_forward(
    strategy,
    param_grid={'fast_period': [5, 10, 15], 'slow_period': [20, 30, 40]},
    in_sample_bars=500,
    out_sample_bars=100
)

# MONTE CARLO SIMULATION
mc = tester.monte_carlo(result, simulations=1000)
print(f"🎲 Monte Carlo:")
print(f"  Probability of Profit: {mc['probability_profit']:.1f}%")
print(f"  5th Percentile: ${mc['percentile_5']:,.2f}")
print(f"  95th Percentile: ${mc['percentile_95']:,.2f}")

# HTML Report generieren
tester.generate_report(result, "backtest_report.html")
```

### 6️⃣ Signal Provider (`mt5_signal_provider.py`)

Professioneller Signal-Service mit Multi-Channel Broadcasting!

```python
from scripts.mt5_signal_provider import (
    MT5SignalProvider,
    SignalType,
    Subscriber
)

# Provider erstellen
provider = MT5SignalProvider(
    provider_name="KIT_Elite_Signals",
    telegram_bot_token="your_bot_token"
)

# Subscriber hinzufügen
provider.add_subscriber(Subscriber(
    id="sub1",
    name="John Trader",
    telegram_chat_id="123456789",
    volume_multiplier=1.0
))

provider.add_subscriber(Subscriber(
    id="sub2",
    name="Jane VIP",
    discord_webhook="https://discord.com/api/webhooks/...",
    volume_multiplier=2.0
))

# Signal erstellen und broadcasten
signal = provider.create_signal(
    signal_type=SignalType.MARKET_BUY,
    symbol="EURUSD",
    volume=0.1,
    sl=1.0850,
    tp=1.1000,
    comment="Golden Cross Setup"
)

# Broadcast zu allen Subscribern
results = provider.broadcast(signal)
print(f"Notified {results['subscribers_notified']} subscribers")

# Performance Stats
stats = provider.get_performance_stats(days=30)
print(f"Total Signals: {stats['total_signals']}")
print(f"Execution Rate: {stats['execution_rate']:.1f}%")
```

### 7️⃣ Expert Advisor Bridge (`mt5_expert_advisor.py`)

Bidirektionale Kommunikation mit MQL5 Expert Advisors!

```python
from scripts.mt5_expert_advisor import (
    MT5EABridge,
    EACommand,
    EASignal,
    EATemplateGenerator
)

# Bridge erstellen
bridge = MT5EABridge(magic_number=123456)

# Signale an EA senden
bridge.send_buy("EURUSD", 0.1, sl=1.0850, tp=1.1000)
bridge.send_sell("GBPUSD", 0.05)
bridge.send_close_all()

# Signale von EA empfangen
def handle_ea_signal(signal):
    print(f"EA Signal: {signal.command.value} {signal.symbol}")

bridge.add_handler(handle_ea_signal)
bridge.start_listener()

# EA Status abrufen
status = bridge.get_ea_status()
print(f"EA Status: {status}")

# MQL5 EA Templates generieren
EATemplateGenerator.save_ea_templates("MQL5/Experts/KIT/")
```

### 8️⃣ VPS Deployment (`mt5_vps_deployment.py`)

Production-Ready 24/7 Trading Infrastructure!

```python
from scripts.mt5_vps_deployment import (
    MT5VPSDeployment,
    VPSConfig
)

# Konfiguration
config = VPSConfig(
    account_id=123456,
    password="secure_pass",
    server="Broker-Live",
    
    # Watchdog
    watchdog_enabled=True,
    watchdog_interval_sec=60,
    max_restart_attempts=3,
    
    # Alerts
    alert_telegram_chat="123456789",
    telegram_bot_token="your_token",
    
    # Performance Limits
    max_cpu_percent=80,
    max_memory_percent=80
)

# VPS Service starten
vps = MT5VPSDeployment(config)
vps.start()

# Status abrufen
status = vps.get_status()
print(f"Status: {status['status']}")
print(f"Uptime: {status['uptime_hours']:.1f} hours")
print(f"Health: {'✅' if status['health']['is_healthy'] else '❌'}")

# Health Check manuell
health = vps.run_health_check()
print(f"MT5 Connected: {health.mt5_connected}")
print(f"Latency: {health.latency_ms:.0f}ms")
print(f"CPU: {health.cpu_usage:.1f}%")
```

---

## 📊 Timeframes

| Code | MT5 Konstante | Beschreibung |
|------|---------------|--------------|
| `M1` | TIMEFRAME_M1 | 1 Minute |
| `M5` | TIMEFRAME_M5 | 5 Minuten |
| `M15` | TIMEFRAME_M15 | 15 Minuten |
| `M30` | TIMEFRAME_M30 | 30 Minuten |
| `H1` | TIMEFRAME_H1 | 1 Stunde |
| `H4` | TIMEFRAME_H4 | 4 Stunden |
| `D1` | TIMEFRAME_D1 | 1 Tag |
| `W1` | TIMEFRAME_W1 | 1 Woche |
| `MN1` | TIMEFRAME_MN1 | 1 Monat |

---

## ⚠️ Error Codes

| Code | Bedeutung |
|------|-----------|
| 10004 | Requote |
| 10006 | Authorization failed |
| 10010 | Auto-Trading deaktiviert |
| 10013 | Invalid volume |
| 10014 | Invalid price |
| 10015 | Invalid stops |
| 10019 | Not enough money |

---

## 🔒 Security Best Practices

1. **Credentials**: Niemals im Code speichern - nutze Environment Variables
2. **Demo First**: IMMER erst im Demo-Modus testen
3. **Risk Management**: Max 2% pro Trade, setze IMMER Stop Loss
4. **VPS**: Nutze dedicated VPS für 24/7 Trading
5. **Monitoring**: Aktiviere Alerts für kritische Events

---

## 🧪 Testen

```bash
cd skills/metatrader

# Basic Test
python examples/example_trade.py

# Unit Tests
python -m pytest tests/

# Backtest
python -c "
from scripts.mt5_strategy_tester import MT5StrategyTester, MovingAverageCrossStrategy
tester = MT5StrategyTester()
tester.load_data('EURUSD', 'H1', days=90)
result = tester.run_backtest(MovingAverageCrossStrategy())
print(f'Profit: {result.total_profit:.2f}')
"
```

---

## 📁 Dateistruktur

```
skills/metatrader/
├── SKILL.md                    # Diese Dokumentation
├── __init__.py                 # Package exports
├── scripts/
│   ├── __init__.py
│   ├── mt5_connector.py        # Connection Management
│   ├── mt5_orders.py           # Order Execution
│   ├── mt5_data.py             # Market Data
│   ├── mt5_multi_account.py    # Multi-Account Manager
│   ├── mt5_strategy_tester.py  # Backtesting Engine
│   ├── mt5_signal_provider.py  # Signal Broadcasting
│   ├── mt5_expert_advisor.py   # MQL5 EA Bridge
│   └── mt5_vps_deployment.py   # VPS Infrastructure
└── examples/
    └── example_trade.py        # Interactive Example
```

---

## 🤖 K.I.T. Befehle

Nach Integration versteht K.I.T.:

- *"Kaufe 0.1 Lot EURUSD mit 20 Pip Stop Loss"*
- *"Zeige meine offenen Positionen"*
- *"Schließe alle Verlust-Trades"*
- *"Backtest MA Crossover auf EURUSD letzte 6 Monate"*
- *"Sende Signal an alle Subscriber"*
- *"Status aller Trading-Accounts"*
- *"VPS Health Check"*

---

**Version:** 2.0.0 (Enterprise Edition)  
**Erstellt:** 2026-02-09  
**Autor:** K.I.T. MetaTrader Agent  
**Lines of Code:** 5,000+  

---

> 🚀 **K.I.T. - Der beste Trading Agent der Welt!**
