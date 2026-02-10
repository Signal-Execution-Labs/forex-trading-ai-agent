---
summary: "K.I.T. auf Windows VPS installieren"
title: "Windows VPS Installation"
---

# Windows VPS Installation Guide

Diese Anleitung bringt K.I.T. auf deinem Windows VPS zum Laufen - speziell optimiert für **RoboForex**!

## ⏱️ Zeitaufwand: ~20 Minuten

---

## 🏆 Empfohlener Broker: RoboForex

RoboForex ist unsere Top-Empfehlung für K.I.T.:

| Feature | Details |
|---------|---------|
| **Demo Account** | ✅ Unbegrenzt, $100.000 virtuelles Kapital |
| **MT5 Support** | ✅ Vollständig |
| **API Trading** | ✅ Erlaubt |
| **Spreads** | Ab 0.0 Pips |
| **Leverage** | Bis 1:2000 |
| **Server** | RoboForex-Demo, RoboForex-ECN |

**Demo Account erstellen:** https://www.roboforex.com/register/

---

## Schritt 1: Voraussetzungen installieren

### 1.1 Python installieren (WICHTIG!)

**Download:** https://www.python.org/downloads/

⚠️ **WICHTIG bei Installation:**
- [x] **"Add Python to PATH"** anhaken!
- [x] **"Install for all users"** wählen

```powershell
# Prüfen ob Python installiert ist
python --version   # Sollte 3.10+ zeigen
pip --version      # Sollte mitinstalliert sein
```

Falls `python` nicht erkannt wird:
```powershell
# Python zum PATH hinzufügen (manuell)
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311"
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\Scripts"
```

### 1.2 Node.js installieren (für K.I.T. Core)

**Download:** https://nodejs.org/en/download/
- Wähle **Windows Installer (.msi)** - LTS Version
- Installieren mit Standardoptionen

```powershell
node --version   # Sollte v20+ zeigen
npm --version    # Sollte 10+ zeigen
```

### 1.3 Git installieren

**Download:** https://git-scm.com/download/win
- Installieren mit Standardoptionen

```powershell
git --version
```

---

## Schritt 2: MetaTrader 5 installieren

### 2.1 MT5 Terminal downloaden

**Download von RoboForex:** https://www.roboforex.com/trading-platforms/metatrader5/

Oder direkt: https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe

### 2.2 MT5 installieren

1. `mt5setup.exe` ausführen
2. Standardoptionen beibehalten
3. Installation abschließen

### 2.3 Demo-Account erstellen

1. MT5 starten
2. **File → Open an Account**
3. Server wählen: **RoboForex-Demo**
   - Falls nicht in Liste: "Add new broker" → `RoboForex` eingeben
4. **"Open a demo account"** wählen
5. Daten ausfüllen und Account erstellen
6. **Login-Daten notieren!** (Account-Nummer & Passwort)

### 2.4 Algo-Trading aktivieren (WICHTIG!)

In MT5:
1. **Tools → Options**
2. Tab **"Expert Advisors"**
3. Aktiviere:
   - [x] **Allow Algorithmic Trading**
   - [x] Allow DLL imports
4. **OK** klicken

**Außerdem im Hauptfenster:**
- In der Toolbar: **"Algo Trading"** Button muss GRÜN sein!
- Falls rot: Anklicken zum Aktivieren

---

## Schritt 3: Python MT5 Library installieren

```powershell
# MetaTrader5 Library
pip install MetaTrader5

# Zusätzliche Dependencies
pip install pandas numpy

# Optional für erweiterte Features
pip install psutil requests flask
```

### Prüfen ob Installation geklappt hat:

```python
python -c "import MetaTrader5 as mt5; print(f'MT5 Library v{mt5.__version__}')"
```

---

## Schritt 4: Verbindung testen

### Quick Test (MT5 muss laufen und eingeloggt sein!)

Erstelle eine Datei `mt5_test.py`:

```python
import MetaTrader5 as mt5

print("🚗 K.I.T. MT5 Connection Test")
print("="*40)

# Initialisieren
if not mt5.initialize():
    error = mt5.last_error()
    print(f"❌ Fehler: {error}")
    print("\n💡 Tipps:")
    print("   - Ist MT5 Terminal geöffnet?")
    print("   - Bist du eingeloggt?")
    exit(1)

print("✅ MT5 verbunden!")

# Account Info
account = mt5.account_info()
print(f"\n📊 Account Info:")
print(f"   Login:   {account.login}")
print(f"   Server:  {account.server}")
print(f"   Balance: {account.balance:,.2f} {account.currency}")

# Trennen
mt5.shutdown()
print("\n✅ Test erfolgreich!")
```

Ausführen:
```powershell
python mt5_test.py
```

### Erwartete Ausgabe:
```
🚗 K.I.T. MT5 Connection Test
========================================
✅ MT5 verbunden!

📊 Account Info:
   Login:   12345678
   Server:  RoboForex-Demo
   Balance: 100,000.00 USD

✅ Test erfolgreich!
```

---

## Schritt 5: K.I.T. installieren

```powershell
# In ein Verzeichnis deiner Wahl
cd C:\

# Repository klonen
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot

# Dependencies installieren
npm install

# TypeScript kompilieren
npm run build
```

---

## Schritt 6: K.I.T. MT5 Skills testen

```powershell
cd C:\k.i.t.-bot\skills\metatrader

# Einfacher Connect-Test
python examples/01_connect.py

# Balance anzeigen
python examples/02_balance.py

# Demo-Trade ausführen (nur auf Demo!)
python examples/03_market_order.py

# Vollständiger Test
python examples/quick_test.py --trade
```

---

## 🧪 Schnelltests

### Test 1: Python + MT5 Library
```powershell
python -c "import MetaTrader5; print('OK')"
```

### Test 2: MT5 Verbindung
```powershell
python -c "import MetaTrader5 as mt5; mt5.initialize(); print(mt5.account_info().balance); mt5.shutdown()"
```

### Test 3: Trade auf Demo
```powershell
cd C:\k.i.t.-bot\skills\metatrader
python examples/quick_test.py --trade
```

---

## 🚨 Troubleshooting

### Problem: "MT5 initialization failed"

**Ursache:** MT5 Terminal läuft nicht oder ist nicht eingeloggt.

**Lösung:**
1. MT5 Terminal starten
2. Einloggen (Demo oder Live)
3. Warten bis "Connecting..." weg ist
4. Script erneut starten

### Problem: "No module named 'MetaTrader5'"

**Ursache:** Python Library nicht installiert.

**Lösung:**
```powershell
pip install MetaTrader5
```

Falls mehrere Python-Versionen:
```powershell
py -3 -m pip install MetaTrader5
```

### Problem: "Trade not allowed" / Error 10010

**Ursache:** Algo-Trading ist deaktiviert.

**Lösung:**
1. In MT5: **Tools → Options → Expert Advisors**
2. Aktiviere **"Allow Algorithmic Trading"**
3. Klicke **OK**
4. In der Toolbar: **"Algo Trading"** Button auf GRÜN stellen

### Problem: "Invalid stops" / Error 10015

**Ursache:** SL/TP zu nah am aktuellen Preis.

**Lösung:**
- Erhöhe den Abstand von SL/TP (mind. 10-20 Pips)
- Oder trade ohne SL/TP

### Problem: "Not enough money" / Error 10019

**Ursache:** Balance zu niedrig für Lot-Größe.

**Lösung:**
- Reduziere Lot-Size (z.B. 0.01 statt 0.1)
- Oder erstelle neuen Demo-Account

### Problem: "Connection lost"

**Ursache:** Internetverbindung instabil.

**Lösung:**
1. Prüfe Internetverbindung
2. MT5 neu starten
3. Re-connect

### Problem: Python nicht im PATH

**Ursache:** Python wurde ohne "Add to PATH" installiert.

**Lösung:**
```powershell
# Manuell zum PATH hinzufügen (temporär)
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311"

# Permanent (als Admin in PowerShell)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311", "User")
```

### Problem: MT5 startet aber kein Login

**Ursache:** Server nicht erreichbar oder falsches Passwort.

**Lösung:**
1. Server-Namen prüfen: `RoboForex-Demo` (exakt so!)
2. Login-Daten prüfen
3. Firewall prüfen (MT5 erlauben)

---

## 📋 Checkliste

### Basis-Setup
- [ ] Python 3.10+ installiert mit PATH
- [ ] `pip install MetaTrader5 pandas` ausgeführt
- [ ] MT5 Terminal installiert
- [ ] MT5 Demo-Account erstellt (RoboForex-Demo)
- [ ] Algo-Trading in MT5 aktiviert

### Verbindungstest
- [ ] `python -c "import MetaTrader5"` funktioniert
- [ ] MT5 Test-Script zeigt Balance an
- [ ] Quick Test (`quick_test.py`) läuft durch

### Optional für K.I.T.
- [ ] Node.js v20+ installiert
- [ ] Git installiert
- [ ] K.I.T. geklont und gebaut
- [ ] K.I.T. kann MT5 Skills nutzen

---

## 🔒 Sicherheit

1. **Credentials niemals im Code speichern!**
   - Nutze Environment Variables
   - Oder sichere Config-Files (nicht in Git!)

2. **Immer erst auf Demo testen!**
   - Alle Scripts prüfen auf Demo-Account
   - Erst nach ausgiebigen Tests auf Live wechseln

3. **Risk Management!**
   - Immer Stop Loss setzen
   - Max 1-2% Risiko pro Trade
   - Niemals mehr riskieren als du verlieren kannst

---

## 🆘 Support

Bei Problemen:
- GitHub Issues: https://github.com/kayzaa/k.i.t.-bot/issues
- RoboForex Support: https://www.roboforex.com/support/
- MT5 Doku: https://www.mql5.com/en/docs/integration/python_metatrader5

---

**Erstellt:** 2026-02-10  
**Version:** 2.0 (RoboForex Edition)  
**Autor:** K.I.T. MetaTrader Specialist
