---
summary: "Install K.I.T. on Windows 10/11 - Step by Step"
title: "Windows Installation Guide"
read_when:
  - Windows 10/11 installation
  - First installation on Windows
  - Windows setup guide
---

# Windows Installation Guide 🪟

Complete guide for K.I.T. on Windows 10/11.

**Time required:** ~15 minutes

---

## 📋 Overview

| Component | Version | Download |
|-----------|---------|----------|
| Node.js | 20+ LTS | [nodejs.org](https://nodejs.org) |
| Python | 3.10+ | [python.org](https://python.org) |
| Git | Latest | [git-scm.com](https://git-scm.com) |
| VS Code | Optional | [code.visualstudio.com](https://code.visualstudio.com) |

---

## 🚀 Quick Install (PowerShell)

For experienced users - all in one script:

```powershell
# Run as Administrator!

# 1. Install Chocolatey (Package Manager)
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 2. Dependencies
choco install nodejs-lts python git -y

# 3. Clone and install K.I.T.
cd ~
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
npm install
npm run build

# 4. Python dependencies
pip install MetaTrader5 pandas numpy

# 5. Test
npx tsc --noEmit
npm test
```

---

## 📦 Step 1: Install Node.js

### Download

1. Go to [nodejs.org](https://nodejs.org/en/download/)
2. Click **"Windows Installer (.msi)"** - LTS Version
3. Run the installer

### Installation

1. **Welcome** → Next
2. **License** → Accept → Next
3. **Destination** → Leave default → Next
4. **Custom Setup** → Default → Next
5. **Tools for Native Modules** → ✅ Check the box! → Next
6. **Install** → Wait...
7. **Finish**

### Verify

Open new PowerShell:

```powershell
node --version    # Should show v20.x.x or higher
npm --version     # Should show 10.x.x
```

---

## 🐍 Step 2: Install Python

### Download

1. Go to [python.org/downloads](https://www.python.org/downloads/)
2. Click **"Download Python 3.12.x"** (or latest version)
3. Run the installer

### Installation

⚠️ **IMPORTANT:** On the first screen:

- [x] ✅ **"Add Python to PATH"** - MUST be checked!
- [x] ✅ **"Install launcher for all users"**

Then:
1. Click **"Customize installation"**
2. Optional Features: Leave all checked → Next
3. Advanced Options:
   - [x] Install for all users
   - [x] Add Python to environment variables
   - [x] Precompile standard library
4. **Install** → Wait...
5. **"Disable path length limit"** → Click (if shown)
6. **Close**

### Verify

Open new PowerShell:

```powershell
python --version    # Should show Python 3.12.x
pip --version       # Should show pip 24.x
```

**If "python" not recognized:**

```powershell
# Add Python to PATH
$pythonPath = "$env:LOCALAPPDATA\Programs\Python\Python312"
$env:Path = "$pythonPath;$pythonPath\Scripts;$env:Path"

# Save permanently
[Environment]::SetEnvironmentVariable("Path", $env:Path, "User")
```

---

## 📥 Step 3: Install Git

### Download

1. Go to [git-scm.com/download/win](https://git-scm.com/download/win)
2. Download starts automatically
3. Run the installer

### Installation

Default options are OK. Important:

- **Default editor:** VS Code (or your preferred editor)
- **PATH environment:** "Git from the command line and also from 3rd-party software" ✅
- **HTTPS transport:** Use the OpenSSL library
- **Line ending:** Checkout Windows-style, commit Unix-style

### Verify

```powershell
git --version    # Should show git version 2.x.x
```

---

## 🤖 Step 4: Install K.I.T.

### Clone Repository

```powershell
# To a directory of your choice
cd C:\Users\$env:USERNAME\Projects    # Or: cd ~

# Clone K.I.T.
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
```

### Install Dependencies

```powershell
# Node.js packages
npm install

# Duration: 1-3 minutes depending on internet
```

### Compile TypeScript

```powershell
# Build
npm run build

# Type check (should show no errors)
npx tsc --noEmit
```

### Run Tests

```powershell
npm test
```

✅ Expected output: `31 passed`

---

## 🐍 Step 5: Set Up Python Skills

### MetaTrader 5 Library

```powershell
pip install MetaTrader5 pandas numpy
```

### Optional Libraries

```powershell
# For extended features
pip install psutil requests flask

# For Machine Learning
pip install scikit-learn tensorflow

# For Technical Analysis
pip install ta-lib
```

### Verify

```powershell
python -c "import MetaTrader5 as mt5; print(f'MT5 Library OK')"
python -c "import pandas; print(f'Pandas OK')"
```

---

## ⚙️ Step 6: Configuration

### Set Environment Variables

**Option A: PowerShell (temporary)**

```powershell
$env:ANTHROPIC_API_KEY = "sk-ant-xxx..."
$env:KIT_HOME = "C:\Users\$env:USERNAME\.kit"
```

**Option B: Permanent (recommended)**

1. Windows Search → "Environment Variables"
2. Open "Edit environment variables"
3. Under "User variables" → "New":
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxx...`
4. Another one:
   - Name: `KIT_HOME`
   - Value: `C:\Users\YourName\.kit`

### Create Config

```powershell
# Create config directory
mkdir -Force $env:USERPROFILE\.kit

# Copy example config
Copy-Item "examples\kit.config.example.json" "$env:USERPROFILE\.kit\config.json"
```

---

## 🧪 Step 7: Test Installation

### TypeScript Check

```powershell
cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot
npx tsc --noEmit
```

✅ No output = No errors = Perfect!

### Unit Tests

```powershell
npm test
```

✅ Expected output:
```
 ✓ tests/config.test.ts (9 tests)
 ✓ tests/logger.test.ts (8 tests)
 ✓ tests/session-manager.test.ts (14 tests)

 Test Files  3 passed (3)
      Tests  31 passed (31)
```

### MT5 Connection (optional)

If MetaTrader 5 is installed:

```powershell
cd skills\metatrader
python examples\quick_test.py
```

---

## 🖥️ Step 8: Start Dashboard

```powershell
# Start dashboard on port 3000
npm run dashboard

# Browser opens automatically at http://localhost:3000
```

---

## 🔧 Useful PowerShell Aliases

Add to your PowerShell profile:

```powershell
# Open profile
notepad $PROFILE

# Add aliases:
function kit { cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot; npm run $args }
function kit-test { cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot; npm test }
function kit-build { cd C:\Users\$env:USERNAME\Projects\k.i.t.-bot; npm run build }
```

---

## 🚨 Troubleshooting

### Problem: "npm" not recognized

**Solution:**
1. Close all PowerShell windows
2. Open new PowerShell
3. Test again

If still not working:
```powershell
# Add Node.js PATH manually
$env:Path += ";C:\Program Files\nodejs"
```

### Problem: "python" not recognized

**Solution:**
```powershell
# Check Python PATH
where.exe python

# If empty, add manually
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python312"
```

### Problem: "npm install" errors

**Solution:**
```powershell
# Clear cache
npm cache clean --force

# Delete node modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Problem: TypeScript Errors

**Solution:**
```powershell
# Check TypeScript version
npx tsc --version

# Reinstall node modules
Remove-Item -Recurse -Force node_modules
npm install
npx tsc --noEmit
```

### Problem: Tests fail

**Solution:**
```powershell
# Verbose output for details
npm test -- --reporter=verbose

# Run single test
npm test -- tests/config.test.ts
```

### Problem: MetaTrader5 Import Error

**Solution:**
```powershell
# Check 64-bit Python (MT5 needs 64-bit!)
python -c "import sys; print(sys.maxsize > 2**32)"
# Must output "True"

# If False: Install 64-bit Python
```

### Problem: Execution Policy Error

**Solution:**
```powershell
# As Admin:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## 📋 Installation Checklist

### Basic
- [ ] Node.js 20+ installed → `node --version`
- [ ] npm works → `npm --version`
- [ ] Python 3.10+ installed → `python --version`
- [ ] pip works → `pip --version`
- [ ] Git installed → `git --version`

### K.I.T.
- [ ] Repository cloned
- [ ] `npm install` successful
- [ ] `npm run build` successful
- [ ] `npx tsc --noEmit` no errors
- [ ] `npm test` all tests passed

### Python Skills
- [ ] `pip install MetaTrader5` successful
- [ ] `import MetaTrader5` works

### Optional
- [ ] MT5 Terminal installed
- [ ] MT5 Demo Account created
- [ ] Algo trading enabled
- [ ] Dashboard running

---

## 🎯 Next Steps

1. **[Connect Exchange](/start/exchanges)** - Binance, Kraken, etc.
2. **[MT5 Setup](/start/windows-vps)** - MetaTrader 5 for Forex
3. **[First Trade](/start/first-trade)** - Execute demo trade
4. **[Configuration](/start/configuration)** - Customize K.I.T.

---

## 🔗 Links

- **K.I.T. GitHub:** https://github.com/kayzaa/k.i.t.-bot
- **Node.js Download:** https://nodejs.org
- **Python Download:** https://python.org
- **Git Download:** https://git-scm.com
- **VS Code:** https://code.visualstudio.com

---

**Version:** 1.0.0  
**Created:** 2026-02-10  
**Author:** K.I.T. [Sprint-Agent]
