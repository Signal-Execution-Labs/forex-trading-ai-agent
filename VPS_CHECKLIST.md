# 🚀 K.I.T. VPS Installation Checklist

**Datum:** 10.02.2026  
**Ziel:** MT5 + K.I.T. auf Windows VPS installieren

---

## ⏱️ Zeitaufwand: ~20 Minuten

---

## Phase 1: Software Installation (10 min)

### ✅ Python installieren
- [ ] Download: https://www.python.org/downloads/
- [ ] **WICHTIG:** "Add Python to PATH" ✓ anhaken!
- [ ] Test: `python --version` → sollte 3.10+ zeigen

### ✅ MetaTrader 5 installieren  
- [ ] Download: https://www.roboforex.com/trading-platforms/metatrader5/
- [ ] Oder: https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe
- [ ] Installieren (Standard-Optionen)

### ✅ Git installieren (optional)
- [ ] Download: https://git-scm.com/download/win
- [ ] Installieren

---

## Phase 2: MT5 Account Setup (5 min)

### ✅ RoboForex Demo Account erstellen
- [ ] MT5 starten
- [ ] File → Open an Account
- [ ] Server: **RoboForex-Demo** wählen
- [ ] "Open a demo account" → Daten ausfüllen
- [ ] **LOGIN-DATEN NOTIEREN:**
  - Account: ________________
  - Passwort: ________________
  - Server: RoboForex-Demo

### ✅ Algo-Trading aktivieren (WICHTIG!)
- [ ] Tools → Options → Expert Advisors
- [ ] ✓ "Allow Algorithmic Trading" aktivieren
- [ ] OK klicken
- [ ] In Toolbar: "Algo Trading" Button auf **GRÜN** stellen

---

## Phase 3: K.I.T. Installation (5 min)

### ✅ K.I.T. Installer ausführen
```powershell
# In PowerShell als Admin:
cd C:\
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
.\INSTALL_VPS.ps1
```

### ✅ Alternative: Manuelle Installation
```powershell
pip install MetaTrader5 pandas numpy psutil requests flask
```

---

## Phase 4: Verbindungstest

### ✅ Quick Test
```powershell
cd C:\k.i.t.-bot
python MT5_QUICK_TEST.py
```

**Erwartete Ausgabe:**
```
✅ Verbunden!
📊 ACCOUNT INFO:
   Login:    12345678
   Server:   RoboForex-Demo
   Balance:  100,000.00 USD
```

### ✅ Demo Trade Test
```powershell
python MT5_QUICK_TEST.py --trade
```

---

## 🚨 Troubleshooting

### ❌ "MT5 initialization failed"
→ MT5 Terminal starten und einloggen

### ❌ "No module named 'MetaTrader5'"
→ `pip install MetaTrader5`

### ❌ "Trade not allowed" (Error 10010)
→ Algo-Trading aktivieren (siehe Phase 2)

### ❌ "Python not found"
→ Python neu installieren MIT "Add to PATH"

---

## 📱 Support

Bei Problemen Kay Bescheid geben via Telegram!

- K.I.T. GitHub: https://github.com/kayzaa/k.i.t.-bot
- RoboForex: https://www.roboforex.com/support/

---

## 🎯 Nach erfolgreicher Installation

K.I.T. kann dann:
- ✅ MT5 verbinden und Account-Info lesen
- ✅ Preise abrufen (EURUSD, GBPUSD, etc.)
- ✅ Trades ausführen
- ✅ Positionen verwalten
- ✅ 24/7 auf VPS laufen

**Nächster Schritt:** K.I.T. Gateway starten!
```powershell
cd C:\k.i.t.-bot
npm install
npm run build
npm start
```
