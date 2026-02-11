# MetaTrader 4/5 Skill for K.I.T.

> Complete MT5 Integration with Enterprise Features

## Supported Brokers

| Broker | Demo Server | Notes |
|--------|-------------|-------|
| **RoboForex** | RoboForex-Demo | Low spreads, fast execution |
| IC Markets | ICMarketsSC-Demo | Popular for scalping |
| Pepperstone | Pepperstone-Demo | Australian broker |
| XM | XMGlobal-Demo | Global coverage |
| OANDA | OANDA-v20 Practice | US-friendly |
| Any MT5 Broker | Check broker | Works with any MT5 broker |

---

## Features

| Feature | Status | Description |
|---------|--------|-------------|
| **Core Trading** | ✅ | Market/Limit/Stop Orders, Position Management |
| **Multi-Account** | ✅ | Manage unlimited accounts in parallel |
| **Copy Trading** | ✅ | Master-Follower with multipliers |
| **Strategy Tester** | ✅ | Backtesting, Optimization, Walk-Forward |
| **Signal Provider** | ✅ | Telegram/Discord/Webhook Broadcasting |
| **Expert Advisor** | ✅ | Bidirectional MQL5 Communication |
| **VPS Deployment** | ✅ | 24/7 Production with Auto-Recovery |

---

## Installation

### 1. MetaTrader 5 Terminal

Download: https://www.metatrader5.com/download

Or from your broker's website.

### 2. Python Dependencies

```bash
pip install MetaTrader5 pandas numpy psutil requests flask
```

### 3. Optional for Extended Features

```bash
pip install ta-lib scikit-learn tensorflow  # ML/Technical Analysis
```

---

## Quick Start

**K.I.T. verbindet sich LOKAL zum bereits laufenden MT5 Terminal - KEINE Credentials nötig!**

```python
import MetaTrader5 as mt5

# Auto-Connect zum laufenden Terminal (KEINE LOGIN-DATEN!)
if mt5.initialize():
    print("✅ Verbunden mit MT5!")
    
    # Account Info holen
    account = mt5.account_info()
    print(f"Account: {account.login}")
    print(f"Balance: {account.balance} {account.currency}")
    
    # Trade ausführen
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": "EURUSD",
        "volume": 0.1,
        "type": mt5.ORDER_TYPE_BUY,
        "price": mt5.symbol_info_tick("EURUSD").ask,
    }
    result = mt5.order_send(request)
    print(f"Order: {result}")
    
    mt5.shutdown()
else:
    print("❌ MT5 Terminal nicht gestartet!")
```

### Voraussetzungen
1. **MT5 Terminal läuft** und ist eingeloggt (manuell einmalig)
2. **Auto-Trading aktiviert** (Button oben in MT5)
3. **Python auf gleichem PC** wie MT5

K.I.T. braucht **NIEMALS** deine Login-Daten - das Terminal ist bereits authentifiziert!

---

## Module Overview

### 1. MT5 Connector (`mt5_connector.py`)

Connection management with error handling.

```python
import MetaTrader5 as mt5

# AUTO-CONNECT (empfohlen) - verbindet zum laufenden Terminal
if mt5.initialize():
    info = mt5.account_info()
    print(f"Balance: {info.balance} {info.currency}")
    print(f"Leverage: 1:{info.leverage}")
    
    # Trading allowed?
    if info.trade_allowed:
        print("Ready to trade!")
    
    mt5.shutdown()

# ALTERNATIVE: Spezifischen Account wählen (falls mehrere Terminals)
# mt5.initialize(login=123456, password="pass", server="Broker-Demo")
```

> ⚠️ **K.I.T. fragt NIEMALS nach Passwörtern!** Das MT5 Terminal ist bereits eingeloggt.

### 2. MT5 Orders (`mt5_orders.py`)

Complete order management.

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

# POSITION MANAGEMENT
positions = orders.get_positions()
for pos in positions:
    print(f"{pos['symbol']}: {pos['profit']:+.2f}")

# Close position
orders.close_position(ticket=123456789)
orders.close_all_positions(symbol="EURUSD")
```

### 3. MT5 Data (`mt5_data.py`)

Real-time market data and historical data.

```python
from scripts.mt5_data import MT5Data

data = MT5Data()

# TICK DATA
tick = data.get_tick("EURUSD")
print(f"Bid: {tick['bid']}, Ask: {tick['ask']}")

# CANDLES (OHLCV)
candles = data.get_candles("EURUSD", "H1", 100)
print(candles.tail())

# SYMBOL INFO
info = data.get_symbol_info("EURUSD")
print(f"Contract Size: {info['trade_contract_size']}")
print(f"Min Volume: {info['volume_min']}")
```

---

## Enterprise Features

### 4. Multi-Account Manager (`mt5_multi_account.py`)

Manage unlimited accounts simultaneously.

```python
from scripts.mt5_multi_account import MT5MultiAccountManager, AccountConfig

manager = MT5MultiAccountManager()

# Add accounts
manager.add_account(AccountConfig(
    account_id=111111,
    password="pass1",
    server="Broker-Demo",
    name="Aggressive Account",
    max_risk_percent=5.0
))

manager.add_account(AccountConfig(
    account_id=222222,
    password="pass2",
    server="Broker-Demo",
    name="Conservative Account",
    max_risk_percent=1.0
))

# Trade on ALL accounts simultaneously
results = manager.execute_on_all("EURUSD", "buy", 0.1)

# Portfolio summary
summary = manager.get_portfolio_summary()
print(f"Total Balance: ${summary['total_balance']:,.2f}")
```

### 5. Strategy Tester (`mt5_strategy_tester.py`)

Professional backtesting with Monte Carlo simulation.

```python
from scripts.mt5_strategy_tester import MT5StrategyTester, MovingAverageCrossStrategy

# Create tester
tester = MT5StrategyTester(initial_balance=10000)
tester.load_data("EURUSD", "H1", days=365)

# Run backtest
strategy = MovingAverageCrossStrategy()
result = tester.run_backtest(strategy, volume=0.1)

print(f"Backtest Results:")
print(f"  Total Trades: {result.total_trades}")
print(f"  Win Rate: {result.win_rate:.1f}%")
print(f"  Total Profit: ${result.total_profit:,.2f}")
print(f"  Profit Factor: {result.profit_factor:.2f}")
print(f"  Max Drawdown: {result.max_drawdown_percent:.1f}%")

# Optimization
opt_results = tester.optimize(
    strategy,
    param_grid={
        'fast_period': [5, 10, 15, 20],
        'slow_period': [20, 30, 40, 50]
    },
    metric='profit_factor'
)
```

### 6. Signal Provider (`mt5_signal_provider.py`)

Professional signal service with multi-channel broadcasting.

```python
from scripts.mt5_signal_provider import MT5SignalProvider, SignalType

provider = MT5SignalProvider(
    provider_name="KIT_Signals",
    telegram_bot_token="your_bot_token"
)

# Add subscribers
provider.add_subscriber(Subscriber(
    id="sub1",
    telegram_chat_id="123456789"
))

# Create and broadcast signal
signal = provider.create_signal(
    signal_type=SignalType.MARKET_BUY,
    symbol="EURUSD",
    volume=0.1,
    sl=1.0850,
    tp=1.1000
)

results = provider.broadcast(signal)
```

### 7. VPS Deployment (`mt5_vps_deployment.py`)

Production-ready 24/7 trading infrastructure.

```python
from scripts.mt5_vps_deployment import MT5VPSDeployment, VPSConfig

config = VPSConfig(
    account_id=123456,
    password="secure_pass",
    server="Broker-Live",
    watchdog_enabled=True,
    alert_telegram_chat="123456789"
)

vps = MT5VPSDeployment(config)
vps.start()

# Check status
status = vps.get_status()
print(f"Status: {status['status']}")
print(f"Uptime: {status['uptime_hours']:.1f} hours")
```

---

## Timeframes

| Code | MT5 Constant | Description |
|------|--------------|-------------|
| `M1` | TIMEFRAME_M1 | 1 Minute |
| `M5` | TIMEFRAME_M5 | 5 Minutes |
| `M15` | TIMEFRAME_M15 | 15 Minutes |
| `M30` | TIMEFRAME_M30 | 30 Minutes |
| `H1` | TIMEFRAME_H1 | 1 Hour |
| `H4` | TIMEFRAME_H4 | 4 Hours |
| `D1` | TIMEFRAME_D1 | 1 Day |
| `W1` | TIMEFRAME_W1 | 1 Week |

---

## Error Codes

| Code | Meaning |
|------|---------|
| 10004 | Requote |
| 10006 | Authorization failed |
| 10010 | Auto-Trading disabled |
| 10013 | Invalid volume |
| 10014 | Invalid price |
| 10015 | Invalid stops |
| 10019 | Not enough money |

---

## Security Best Practices

1. **NO CREDENTIALS NEEDED**: K.I.T. connects to your already-logged-in MT5 Terminal - never give K.I.T. your password!
2. **Local Only**: Python MT5 module only works on the same PC as the terminal
3. **Demo First**: ALWAYS test in demo mode first
4. **Risk Management**: Max 2% per trade, ALWAYS set Stop Loss
5. **VPS**: Use dedicated VPS for 24/7 trading
6. **Monitoring**: Enable alerts for critical events

> 🔒 **K.I.T. NEVER asks for your MT5 login/password!** If something asks for credentials, it's not the real K.I.T.

---

## Testing

```bash
cd skills/metatrader

# Basic test
python examples/example_trade.py

# Unit tests
python -m pytest tests/

# Quick test
python examples/quick_test.py --trade
```

---

## File Structure

```
skills/metatrader/
├── SKILL.md                    # This documentation
├── __init__.py                 # Package exports
├── scripts/
│   ├── mt5_connector.py        # Connection Management
│   ├── mt5_orders.py           # Order Execution
│   ├── mt5_data.py             # Market Data
│   ├── mt5_multi_account.py    # Multi-Account Manager
│   ├── mt5_strategy_tester.py  # Backtesting Engine
│   ├── mt5_signal_provider.py  # Signal Broadcasting
│   ├── mt5_expert_advisor.py   # MQL5 EA Bridge
│   └── mt5_vps_deployment.py   # VPS Infrastructure
└── examples/
    ├── 01_connect.py
    ├── 02_balance.py
    ├── 03_market_order.py
    └── quick_test.py
```

---

## K.I.T. Commands

After integration, K.I.T. understands:

- *"Buy 0.1 lot EURUSD with 20 pip stop loss"*
- *"Show my open positions"*
- *"Close all losing trades"*
- *"Backtest MA crossover on EURUSD last 6 months"*
- *"Send signal to all subscribers"*
- *"Status of all trading accounts"*
- *"VPS health check"*

---

**Version:** 2.0.0  
**Created:** February 2026  
**Author:** K.I.T. MetaTrader Agent
