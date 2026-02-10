---
summary: "Install K.I.T. on Windows VPS"
title: "Windows VPS Installation"
---

# Windows VPS Installation Guide

This guide gets K.I.T. running on your Windows VPS - optimized for **RoboForex**!

## ⏱️ Time required: ~20 minutes

---

## 🏆 Recommended Broker: RoboForex

RoboForex is our top recommendation for K.I.T.:

| Feature | Details |
|---------|---------|
| **Demo Account** | ✅ Unlimited, $100,000 virtual capital |
| **MT5 Support** | ✅ Full |
| **API Trading** | ✅ Allowed |
| **Spreads** | From 0.0 pips |
| **Leverage** | Up to 1:2000 |
| **Server** | RoboForex-Demo, RoboForex-ECN |

**Create Demo Account:** https://www.roboforex.com/register/

---

## Step 1: Install Prerequisites

### 1.1 Install Python (IMPORTANT!)

**Download:** https://www.python.org/downloads/

⚠️ **IMPORTANT during installation:**
- [x] **"Add Python to PATH"** check it!
- [x] **"Install for all users"** select

```powershell
# Check if Python is installed
python --version   # Should show 3.10+
pip --version      # Should be installed with it
```

If `python` not recognized:
```powershell
# Add Python to PATH (manually)
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311"
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311\Scripts"
```

### 1.2 Install Node.js (for K.I.T. Core)

**Download:** https://nodejs.org/en/download/
- Choose **Windows Installer (.msi)** - LTS Version
- Install with default options

```powershell
node --version   # Should show v20+
npm --version    # Should show 10+
```

### 1.3 Install Git

**Download:** https://git-scm.com/download/win
- Install with default options

```powershell
git --version
```

---

## Step 2: Install MetaTrader 5

### 2.1 Download MT5 Terminal

**Download from RoboForex:** https://www.roboforex.com/trading-platforms/metatrader5/

Or directly: https://download.mql5.com/cdn/web/metaquotes.software.corp/mt5/mt5setup.exe

### 2.2 Install MT5

1. Run `mt5setup.exe`
2. Keep default options
3. Complete installation

### 2.3 Create Demo Account

1. Start MT5
2. **File → Open an Account**
3. Select server: **RoboForex-Demo**
   - If not in list: "Add new broker" → enter `RoboForex`
4. Select **"Open a demo account"**
5. Fill in details and create account
6. **Note down login credentials!** (Account number & password)

### 2.4 Enable Algo Trading (IMPORTANT!)

In MT5:
1. **Tools → Options**
2. Tab **"Expert Advisors"**
3. Enable:
   - [x] **Allow Algorithmic Trading**
   - [x] Allow DLL imports
4. Click **OK**

**Also in main window:**
- In toolbar: **"Algo Trading"** button must be GREEN!
- If red: Click to enable

---

## Step 3: Install Python MT5 Library

```powershell
# MetaTrader5 Library
pip install MetaTrader5

# Additional dependencies
pip install pandas numpy

# Optional for extended features
pip install psutil requests flask
```

### Check if installation worked:

```python
python -c "import MetaTrader5 as mt5; print(f'MT5 Library v{mt5.__version__}')"
```

---

## Step 4: Test Connection

### Quick Test (MT5 must be running and logged in!)

Create a file `mt5_test.py`:

```python
import MetaTrader5 as mt5

print("🚗 K.I.T. MT5 Connection Test")
print("="*40)

# Initialize
if not mt5.initialize():
    error = mt5.last_error()
    print(f"❌ Error: {error}")
    print("\n💡 Tips:")
    print("   - Is MT5 Terminal open?")
    print("   - Are you logged in?")
    exit(1)

print("✅ MT5 connected!")

# Account Info
account = mt5.account_info()
print(f"\n📊 Account Info:")
print(f"   Login:   {account.login}")
print(f"   Server:  {account.server}")
print(f"   Balance: {account.balance:,.2f} {account.currency}")

# Disconnect
mt5.shutdown()
print("\n✅ Test successful!")
```

Run:
```powershell
python mt5_test.py
```

### Expected Output:
```
🚗 K.I.T. MT5 Connection Test
========================================
✅ MT5 connected!

📊 Account Info:
   Login:   12345678
   Server:  RoboForex-Demo
   Balance: 100,000.00 USD

✅ Test successful!
```

---

## Step 5: Install K.I.T.

```powershell
# To a directory of your choice
cd C:\

# Clone repository
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot

# Install dependencies
npm install

# Compile TypeScript
npm run build
```

---

## Step 6: Test K.I.T. MT5 Skills

```powershell
cd C:\k.i.t.-bot\skills\metatrader

# Simple connect test
python examples/01_connect.py

# Show balance
python examples/02_balance.py

# Execute demo trade (only on demo!)
python examples/03_market_order.py

# Full test
python examples/quick_test.py --trade
```

---

## 🧪 Quick Tests

### Test 1: Python + MT5 Library
```powershell
python -c "import MetaTrader5; print('OK')"
```

### Test 2: MT5 Connection
```powershell
python -c "import MetaTrader5 as mt5; mt5.initialize(); print(mt5.account_info().balance); mt5.shutdown()"
```

### Test 3: Trade on Demo
```powershell
cd C:\k.i.t.-bot\skills\metatrader
python examples/quick_test.py --trade
```

---

## 🚨 Troubleshooting

### Problem: "MT5 initialization failed"

**Cause:** MT5 Terminal not running or not logged in.

**Solution:**
1. Start MT5 Terminal
2. Log in (Demo or Live)
3. Wait until "Connecting..." disappears
4. Run script again

### Problem: "No module named 'MetaTrader5'"

**Cause:** Python library not installed.

**Solution:**
```powershell
pip install MetaTrader5
```

If multiple Python versions:
```powershell
py -3 -m pip install MetaTrader5
```

### Problem: "Trade not allowed" / Error 10010

**Cause:** Algo trading is disabled.

**Solution:**
1. In MT5: **Tools → Options → Expert Advisors**
2. Enable **"Allow Algorithmic Trading"**
3. Click **OK**
4. In toolbar: Set **"Algo Trading"** button to GREEN

### Problem: "Invalid stops" / Error 10015

**Cause:** SL/TP too close to current price.

**Solution:**
- Increase SL/TP distance (at least 10-20 pips)
- Or trade without SL/TP

### Problem: "Not enough money" / Error 10019

**Cause:** Balance too low for lot size.

**Solution:**
- Reduce lot size (e.g., 0.01 instead of 0.1)
- Or create new demo account

### Problem: "Connection lost"

**Cause:** Internet connection unstable.

**Solution:**
1. Check internet connection
2. Restart MT5
3. Re-connect

### Problem: Python not in PATH

**Cause:** Python installed without "Add to PATH".

**Solution:**
```powershell
# Add to PATH manually (temporary)
$env:Path += ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311"

# Permanent (as Admin in PowerShell)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\$env:USERNAME\AppData\Local\Programs\Python\Python311", "User")
```

### Problem: MT5 starts but no login

**Cause:** Server unreachable or wrong password.

**Solution:**
1. Check server name: `RoboForex-Demo` (exactly!)
2. Check login credentials
3. Check firewall (allow MT5)

---

## 📋 Checklist

### Basic Setup
- [ ] Python 3.10+ installed with PATH
- [ ] `pip install MetaTrader5 pandas` executed
- [ ] MT5 Terminal installed
- [ ] MT5 Demo Account created (RoboForex-Demo)
- [ ] Algo trading enabled in MT5

### Connection Test
- [ ] `python -c "import MetaTrader5"` works
- [ ] MT5 test script shows balance
- [ ] Quick test (`quick_test.py`) runs through

### Optional for K.I.T.
- [ ] Node.js v20+ installed
- [ ] Git installed
- [ ] K.I.T. cloned and built
- [ ] K.I.T. can use MT5 skills

---

## 🔒 Security

1. **Never store credentials in code!**
   - Use environment variables
   - Or secure config files (not in Git!)

2. **Always test on demo first!**
   - All scripts check for demo account
   - Only switch to live after extensive testing

3. **Risk management!**
   - Always set stop loss
   - Max 1-2% risk per trade
   - Never risk more than you can afford to lose

---

## 🆘 Support

For problems:
- GitHub Issues: https://github.com/kayzaa/k.i.t.-bot/issues
- RoboForex Support: https://www.roboforex.com/support/
- MT5 Docs: https://www.mql5.com/en/docs/integration/python_metatrader5

---

**Created:** 2026-02-10  
**Version:** 2.0 (RoboForex Edition)  
**Author:** K.I.T. MetaTrader Specialist
