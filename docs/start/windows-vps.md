---
summary: "K.I.T. auf Windows VPS installieren"
title: "Windows VPS Installation"
---

# Windows VPS Installation Guide

Diese Anleitung bringt K.I.T. auf deinem Windows VPS zum Laufen.

## ⏱️ Zeitaufwand: ~15 Minuten

---

## Schritt 1: Voraussetzungen installieren

### 1.1 Node.js installieren

Download: https://nodejs.org/en/download/
- Wähle **Windows Installer (.msi)** - LTS Version
- Installieren mit Standardoptionen

Prüfen:
```powershell
node --version   # Sollte v20+ zeigen
npm --version    # Sollte 10+ zeigen
```

### 1.2 Git installieren

Download: https://git-scm.com/download/win
- Installieren mit Standardoptionen

Prüfen:
```powershell
git --version
```

### 1.3 Python installieren (für MT5)

Download: https://www.python.org/downloads/
- **WICHTIG:** Haken bei "Add Python to PATH" setzen!

Prüfen:
```powershell
python --version   # Sollte 3.10+ zeigen
pip --version
```

---

## Schritt 2: K.I.T. installieren

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

## Schritt 3: Konfiguration

### 3.1 Workspace erstellen

```powershell
# Workspace-Verzeichnis erstellen
mkdir $env:USERPROFILE\.kit
mkdir $env:USERPROFILE\.kit\workspace

# Templates kopieren
Copy-Item templates\* $env:USERPROFILE\.kit\workspace\ -Recurse
```

### 3.2 API Keys konfigurieren

Erstelle `C:\Users\DEINNAME\.kit\config.json`:

```json
{
  "anthropic": {
    "apiKey": "sk-ant-DEIN-KEY"
  },
  "workspace": "C:\\Users\\DEINNAME\\.kit\\workspace"
}
```

### 3.3 Exchange API Keys

Erstelle `C:\Users\DEINNAME\.kit\exchanges.json`:

```json
{
  "binance": {
    "apiKey": "DEIN-BINANCE-KEY",
    "secret": "DEIN-BINANCE-SECRET",
    "sandbox": true
  },
  "roboforex": {
    "login": "DEIN-MT5-LOGIN",
    "password": "DEIN-MT5-PASSWORD",
    "server": "RoboForex-Demo"
  }
}
```

---

## Schritt 4: MetaTrader 5 Setup

### 4.1 MT5 Terminal installieren

1. Download von RoboForex: https://www.roboforex.com/trading-platforms/metatrader5/
2. Installieren und starten
3. Demo-Account erstellen oder einloggen

### 4.2 Python MT5 Library

```powershell
pip install MetaTrader5
pip install pandas numpy
```

### 4.3 MT5 Verbindung testen

```python
import MetaTrader5 as mt5

# Initialisieren
if mt5.initialize():
    print("✅ MT5 verbunden!")
    print(f"Version: {mt5.version()}")
    
    # Account Info
    account = mt5.account_info()
    print(f"Balance: {account.balance}")
    print(f"Server: {account.server}")
    
    mt5.shutdown()
else:
    print("❌ MT5 Verbindung fehlgeschlagen")
```

---

## Schritt 5: K.I.T. starten

### Development Mode

```powershell
cd C:\k.i.t.-bot
npm run dev
```

### Production Mode

```powershell
npm run build
npm start
```

---

## Schritt 6: Telegram Bot verbinden

1. Erstelle Bot bei @BotFather auf Telegram
2. Kopiere den Token
3. Füge zu `config.json` hinzu:

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "DEIN-BOT-TOKEN",
      "allowedUsers": [DEINE-USER-ID]
    }
  }
}
```

---

## 🧪 Schnelltest

### Test 1: Node.js
```powershell
node -e "console.log('Node OK')"
```

### Test 2: K.I.T. Build
```powershell
cd C:\k.i.t.-bot
npm run build
```

### Test 3: MT5 Verbindung
```powershell
cd C:\k.i.t.-bot\skills\metatrader\scripts
python mt5_connector.py --test
```

---

## 🚨 Troubleshooting

### "npm install" schlägt fehl
```powershell
# Als Administrator ausführen
npm cache clean --force
npm install --force
```

### MT5 startet nicht
- MT5 Terminal muss laufen bevor Python verbindet
- "Algo Trading erlauben" in MT5 aktivieren: Tools → Options → Expert Advisors

### Permission Errors
- PowerShell als Administrator starten
- Execution Policy setzen: `Set-ExecutionPolicy RemoteSigned`

---

## 📋 Checkliste für morgen

- [ ] Node.js installiert
- [ ] Git installiert
- [ ] Python installiert
- [ ] K.I.T. geklont und gebaut
- [ ] MT5 Terminal installiert
- [ ] MT5 Demo-Account erstellt
- [ ] Python MetaTrader5 Library installiert
- [ ] Erster MT5 Verbindungstest erfolgreich

---

## 🆘 Support

Bei Problemen: Erstelle ein Issue auf GitHub
https://github.com/kayzaa/k.i.t.-bot/issues
