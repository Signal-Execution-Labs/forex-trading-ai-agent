# MetaTrader 5 Quick Start 🚀

## Für Kay's Test am VPS mit RoboForex Demo

### 1. Vorbereitung (einmalig)

```powershell
# Python Dependencies installieren
pip install MetaTrader5 pandas numpy pytz
```

### 2. MetaTrader 5 Terminal

1. MT5 starten und in RoboForex Demo einloggen
2. **Auto-Trading aktivieren**: `Tools → Options → Expert Advisors → ✅ Allow algorithmic trading`
3. Terminal offen lassen

### 3. Quick Test ausführen

```powershell
cd "C:\Pfad\zu\k.i.t.-bot\skills\metatrader\examples"

# Basic Test (ohne Trade)
python quick_test.py

# Mit Test-Trade (öffnet und schließt sofort)
python quick_test.py --trade

# Anderes Symbol testen
python quick_test.py --symbol GBPUSD --trade

# Mit Login (falls nicht eingeloggt im Terminal)
python quick_test.py --account 12345678 --password "xxx" --server "RoboForex-Demo"
```

### 4. Was der Test prüft

| Test | Beschreibung | Erwartet |
|------|--------------|----------|
| **Connection** | Verbindung zu MT5 | ✅ PASS |
| **Account Info** | Balance, Equity abrufen | ✅ PASS |
| **Market Data** | Tick-Daten, Spread | ✅ PASS |
| **Positions** | Offene Positionen auflisten | ✅ PASS |
| **Trade** | Order öffnen & schließen | ✅ PASS (optional) |

### 5. Erwartete Ausgabe

```
🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗
  K.I.T. MetaTrader 5 Quick Test
  2026-02-10 09:00:00
🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗

============================================================
  TEST 1: CONNECTION
============================================================
  ✅ Connected to running MT5 terminal

============================================================
  TEST 2: ACCOUNT INFO & BALANCE
============================================================
  ✅ Account info retrieved!

  📊 Account Details:
     Login:      12345678
     Name:       Kay Demo
     Server:     RoboForex-Demo
     ─────────────────────────────
     💰 Balance:     10,000.00 USD
     💎 Equity:      10,000.00 USD
     📊 Free Margin: 10,000.00 USD
     ⚡ Leverage:    1:500
     ─────────────────────────────
  ✅ Trading is ENABLED

... (weitere Tests)

============================================================
  TEST SUMMARY
============================================================
  ✅ Connection: PASS
  ✅ Account Info: PASS
  ✅ Market Data: PASS
  ✅ Positions: PASS
  ✅ Open/Close Trade: PASS

  ==========================================
  Results: 5/5 tests passed

  🎉 ALL TESTS PASSED!
  K.I.T. MetaTrader 5 is ready for action! 🚀
```

### 6. Troubleshooting

| Problem | Lösung |
|---------|--------|
| "MT5 initialization failed" | MT5 Terminal starten |
| "Trading is DISABLED" | Auto-Trading in MT5 aktivieren |
| "Not enough money" | Lot Size reduzieren (--volume 0.01) |
| "Invalid stops" | Broker hat min SL/TP Distanz |

### 7. Nächste Schritte

Nach erfolgreichem Test:
```python
from skills.metatrader import MT5Connector, MT5Orders, MT5Data

# Eigene Trades machen
mt5 = MT5Connector()
mt5.connect()

orders = MT5Orders()
result = orders.market_order("EURUSD", "buy", 0.01)
print(f"Trade opened: #{result['ticket']}")
```

---

**Fragen?** Schreib mir auf Telegram! 📱

*K.I.T. - Ready to trade!* 🤖
