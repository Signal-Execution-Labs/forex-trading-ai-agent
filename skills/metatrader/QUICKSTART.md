# MetaTrader 5 Quick Start 🚀

## 30-Sekunden Start

```bash
# 1. Library installieren
pip install MetaTrader5 pandas

# 2. MT5 Terminal öffnen und einloggen

# 3. Testen
cd skills/metatrader
python examples/quick_test.py
```

---

## Beispiele ausführen

### Connect Test
```bash
python examples/01_connect.py
```

### Balance anzeigen
```bash
python examples/02_balance.py
```

### Demo Trade (nur Demo-Accounts!)
```bash
python examples/03_market_order.py
```

### Vollständiger Test
```bash
python examples/quick_test.py --trade
```

---

## Broker Empfehlung

| Broker | Server | Demo |
|--------|--------|------|
| **RoboForex** ⭐ | RoboForex-Demo | [Anmelden](https://www.roboforex.com/register/) |
| IC Markets | ICMarketsSC-Demo | |
| Pepperstone | Pepperstone-Demo | |

---

## Häufige Probleme

### ❌ "No module named 'MetaTrader5'"
```bash
pip install MetaTrader5
```

### ❌ "MT5 initialization failed"
→ MT5 Terminal muss geöffnet und eingeloggt sein!

### ❌ "Trade not allowed" (Error 10010)
→ In MT5: Tools → Options → Expert Advisors → "Allow Algorithmic Trading" ✓

### ❌ "Invalid stops" (Error 10015)
→ SL/TP Abstand erhöhen (min. 20 Pips)

### ❌ "Not enough money" (Error 10019)
→ Lot-Größe reduzieren (0.01 statt 0.1)

---

## Nächste Schritte

1. 📖 Lies [SKILL.md](./SKILL.md) für alle Features
2. 📝 Schau dir die [Examples](./examples/) an
3. 🧪 Teste auf Demo bevor du Live gehst!

---

**Happy Trading! 🚗💰**
