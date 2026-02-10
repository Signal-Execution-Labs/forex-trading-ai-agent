---
summary: "K.I.T. auf Windows 10/11 installieren - Schritt für Schritt"
title: "Windows Installation Guide"
read_when:
  - Windows 10/11 Installation
  - Erste Installation auf Windows
  - Windows Setup Guide
---

# Windows Installation Guide 🪟

Komplette Anleitung für K.I.T. auf Windows 10/11.

**Zeitaufwand:** ~15 Minuten

---

## 📋 Übersicht

| Komponente | Version | Download |
|------------|---------|----------|
| Node.js | 20+ LTS | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |
| Git | Latest | [git-scm.com](https://git-scm.com) |
| VS Code | Optional | [code.visualstudio.com](https://code.visualstudio.com) |

---

## 🚀 Quick Install (PowerShell)

Für erfahrene Nutzer - alles in einem Script:

```powershell
# Als Administrator ausführen!

# 1. Chocolatey installieren (Package Manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. Dependencies
choco install nodejs-lts python git -y

# 3. K.I.T. klonen und installieren
cd ~
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
npm install
npm run build

# 4. Python dependencies
pip install MetaTrader5 pandas numpy

# 5. Testen
npx tsc --noEmit
npm test
```

---

## 📦 Schritt 1: Node.js installieren

### Download

1. Öffne [nodejs.org](https://nodejs.org/en/download/)
2. Klicke auf **"Windows Installer (.msi)"** - LTS Version
3. Starte den Installer

### Installation

1. **Welcome** → Next
2. **License** → Akzeptieren → Next
3. **Destination** → Standard lassen → Next
4. **Custom Setup** → Standard → Next
5. **Tools for Native Modules** → ✅ Checkbox aktivieren! → Next
6. **Install** → Warten...
7. **Finish**

### Prüfen

Neue PowerShell öffnen:

```powershell
node --version    # Sollte v20.x.x oder höher zeigen
npm --version     # Sollte 10.x.x zeigen
```

---

## 🐍 Schritt 2: Python installieren

### Download

1. Öffne [python.org/downloads](https://www.python.org/downloads/)
2. Klicke auf **"Download Python 3.12.x"** (oder neueste Version)
3. Starte den Installer

### Installation

⚠️ **WICHTIG:** Beim ersten Screen:

- [x] ✅ **"Add Python to PATH"** - MUSS aktiviert sein!
- [x] ✅ **"Install launcher for all users"**

Dann:
1. Klicke **"Customize installation"**
2. Optional Features: Alle aktiviert lassen → Next
3. Advanced Options:
   - [x] Install for all users
   - [x] Add Python to environment variables
   - [x] Precompile standard library
4. **Install** → Warten...
5. **"Disable path length limit"** → Klicken (falls angezeigt)
6. **Close**

### Prüfen

Neue PowerShell öffnen:

```powershell
python --version    # Sollte Python 3.12.x zeigen
pip --version       # Sollte pip 24.x zeigen
```

**Falls "python" nicht erkannt wird:**

```powershell
# Python zum PATH hinzufügen
$pythonPath = "$env:LOCALAPPDATA\Programs\Python\Python312"
$env:Path = "$pythonPath;$pythonPath\Scripts;$env:Path"

# Permanent speichern
[Environment]::SetEnvironmentVariable("Path", $env:Path, "User")
```

---

## 📥 Schritt 3: Git installieren

### Download

1. Öffne [git-scm.com/download/win](https://git-scm.com/download/win)
2. Download startet automatisch
3. Starte den Installer

### Installation

Standard-Optionen sind OK. Wichtig:

- **Default editor:** VS Code (oder dein bevorzugter Editor)
- **PATH environment:** "Git from the command line and also from 3rd-party software" ✅
- **HTTPS transport:** Use the OpenSSL library
- **Line ending:** Checkout Windows-style, commit Unix-style

### Prüfen

```powershell
git --version    # Sollte git version 2.x.x zeigen
```

---

## 🤖 Schritt 4: K.I.T. installieren

### Repository klonen

```powershell
# In ein Verzeichnis deiner Wahl
cd C:\Users\$env:USERNAME\Projects    # Oder: cd ~

# K.I.T. klonen
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
```

### Dependencies installieren

```powershell
# Node.js packages
npm install

# Dauer: 1-3 Minuten je nach Internet
```

### TypeScript kompilieren

```powershell
# Build
npm run build

# Type-Check (sollte keine Fehler zeigen)
npx tsc --noEmit
```

### Tests ausführen

```powershell
npm test
```

✅ Erwartete Ausgabe: `31 passed`

---

## 🐍 Schritt 5: Python Skills einrichten

### MetaTrader 5 Library

```powershell
pip install MetaTrader5 pandas numpy
```

### Optionale Libraries

```powershell
# Für erweiterte Features
pip install psutil requests flask

# Für Machine Learning
pip install scikit-learn tensorflow

# Für Technical Analysis
pip install ta-lib
```

### Prüfen

```powershell
python -c "import MetaTrader5 as mt5; print(f'MT5 Library OK')"
python -c "import pandas; print(f'Pandas OK')"
```

---

## ⚙️ Schritt 6: Konfiguration

### Umgebungsvariablen setzen

**Option A: PowerShell (temporär)**

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-xxx..."
$env:KIT_HOME = "C:\Users\$env:USERNAME\.kit"
```

**Option B: Permanent (empfohlen)**

1. Windows-Suche → "Umgebungsvariablen"
2. "Umgebungsvariablen bearbeiten" öffnen
3. Unter "Benutzervariablen" → "Neu":
   - Name: `ANTHROPIC_API_KEY`
   - Wert: `sk-ant-xxx...`
4. Noch eine:
   - Name: `KIT_HOME`
   - Wert: `C:\Users\DeinName\.kit`

### Config erstellen

```powershell
# Config-Verzeichnis erstellen
mkdir -Force $env:USERPROFILE\.kit

# Beispiel-Config kopieren
Copy-Item "examples\kit.config.example.json" "$env:USERPROFILE\.kit\config.json"
```

---

## 🧪 Schritt 7: Installation testen

### TypeScript Check

```powershell
cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot
npx tsc --noEmit
```

✅ Keine Ausgabe = Keine Fehler = Perfekt!

### Unit Tests

```powershell
npm test
```

✅ Erwartete Ausgabe:
```
 ✓ tests/config.test.ts (9 tests)
 ✓ tests/logger.test.ts (8 tests)
 ✓ tests/session-manager.test.ts (14 tests)

 Test Files  3 passed (3)
      Tests  31 passed (31)
```

### MT5 Verbindung (optional)

Falls MetaTrader 5 installiert ist:

```powershell
cd skills\metatrader
python examples\quick_test.py
```

---

## 🖥️ Schritt 8: Dashboard starten

```powershell
# Dashboard auf Port 3000 starten
npm run dashboard

# Browser öffnet automatisch http://localhost:3000
```

---

## 🔧 Nützliche PowerShell Aliases

Füge zu deinem PowerShell-Profil hinzu:

```powershell
# Profil öffnen
notepad $PROFILE

# Aliases hinzufügen:
function kit { cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot; npm run $args }
function kit-test { cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot; npm test }
function kit-build { cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot; npm run build }
```

---

## 🚨 Troubleshooting

### Problem: "npm" wird nicht erkannt

**Lösung:**
1. Schließe alle PowerShell-Fenster
2. Öffne neue PowerShell
3. Nochmal testen

Falls immer noch nicht:
```powershell
# Node.js PATH manuell hinzufügen
$env:Path += ";C:\Program Files\nodejs"
```

### Problem: "python" wird nicht erkannt

**Lösung:**
```powershell
# Python PATH prüfen
where.exe python

# Falls leer, manuell hinzufügen
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python312"
```

### Problem: "npm install" Fehler

**Lösung:**
```powershell
# Cache leeren
npm cache clean --force

# Node modules löschen und neu installieren
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Problem: TypeScript Errors

**Lösung:**
```powershell
# Prüfe TypeScript Version
npx tsc --version

# Node modules neu installieren
Remove-Item -Recurse -Force node_modules
npm install
npx tsc --noEmit
```

### Problem: Tests schlagen fehl

**Lösung:**
```powershell
# Verbose output für Details
npm test -- --reporter=verbose

# Einzelnen Test laufen lassen
npm test -- tests/config.test.ts
```

### Problem: MetaTrader5 Import Fehler

**Lösung:**
```powershell
# 64-bit Python prüfen (MT5 braucht 64-bit!)
python -c "import sys; print(sys.maxsize > 2**32)"
# Muss "True" ausgeben

# Falls False: 64-bit Python installieren
```

### Problem: Execution Policy Fehler

**Lösung:**
```powershell
# Als Admin:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📋 Installations-Checkliste

### Basis
- [ ] Node.js 20+ installiert → `node --version`
- [ ] npm funktioniert → `npm --version`
- [ ] Python 3.10+ installiert → `python --version`
- [ ] pip funktioniert → `pip --version`
- [ ] Git installiert → `git --version`

### K.I.T.
- [ ] Repository geklont
- [ ] `npm install` erfolgreich
- [ ] `npm run build` erfolgreich
- [ ] `npx tsc --noEmit` keine Fehler
- [ ] `npm test` alle Tests passed

### Python Skills
- [ ] `pip install MetaTrader5` erfolgreich
- [ ] `import MetaTrader5` funktioniert

### Optional
- [ ] MT5 Terminal installiert
- [ ] MT5 Demo Account erstellt
- [ ] Algo-Trading aktiviert
- [ ] Dashboard läuft

---

## 🎯 Nächste Schritte

1. **[Exchange verbinden](/start/exchanges)** - Binance, Kraken, etc.
2. **[MT5 Setup](/start/windows-vps)** - MetaTrader 5 für Forex
3. **[Erster Trade](/start/first-trade)** - Demo Trade ausführen
4. **[Konfiguration](/start/configuration)** - K.I.T. anpassen

---

## 🔗 Links

- **K.I.T. GitHub:** https://github.com/kayzaa/k.i.t.-bot
- **Node.js Download:** https://nodejs.org
- **Python Download:** https://python.org
- **Git Download:** https://git-scm.com
- **VS Code:** https://code.visualstudio.com

---

**Version:** 1.0.0  
**Erstellt:** 2026-02-10  
**Autor:** K.I.T. [Sprint-Agent]
