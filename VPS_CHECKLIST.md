# K.I.T. VPS Installation Checklist

**Date:** February 2026  
**Goal:** Install MT5 + K.I.T. on Windows VPS

---

## Estimated Time: ~20 Minutes

---

## Phase 1: Software Installation (10 min)

### Python
- [ ] Download: https://www.python.org/downloads/
- [ ] **IMPORTANT:** Check "Add Python to PATH" during installation!
- [ ] Verify: `python --version` → should show 3.10+

### MetaTrader 5
- [ ] Download: https://www.metatrader5.com/download
- [ ] Or from your broker's website
- [ ] Install (use default options)

### Git (optional)
- [ ] Download: https://git-scm.com/download/win
- [ ] Install

---

## Phase 2: MT5 Account Setup (5 min)

### Create Demo Account
- [ ] Start MT5
- [ ] File → Open an Account
- [ ] Choose your broker's demo server
- [ ] Select "Open a demo account" → fill in details
- [ ] **SAVE YOUR CREDENTIALS:**
  - Account: ________________
  - Password: ________________
  - Server: ________________

### Enable Algo-Trading (CRITICAL!)
- [ ] Tools → Options → Expert Advisors
- [ ] Check "Allow Algorithmic Trading"
- [ ] Click OK
- [ ] In toolbar: "Algo Trading" button must be **GREEN**

---

## Phase 3: K.I.T. Installation (5 min)

### Run K.I.T. Installer
```powershell
# In PowerShell:
cd C:\
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
.\INSTALL_VPS.ps1
```

### Alternative: Manual Installation
```powershell
pip install MetaTrader5 pandas numpy psutil requests flask
```

---

## Phase 4: Connection Test

### Quick Test
```powershell
cd C:\k.i.t.-bot
python MT5_QUICK_TEST.py
```

**Expected Output:**
```
OK Connected!
ACCOUNT INFO:
   Login:    12345678
   Server:   YourBroker-Demo
   Balance:  100,000.00 USD
```

### Demo Trade Test
```powershell
python MT5_QUICK_TEST.py --trade
```

---

## Troubleshooting

### "MT5 initialization failed"
→ Start MT5 Terminal and log in

### "No module named 'MetaTrader5'"
→ Run `pip install MetaTrader5`

### "Trade not allowed" (Error 10010)
→ Enable Algo-Trading (see Phase 2)

### "Python not found"
→ Reinstall Python WITH "Add to PATH" checked

---

## Supported Brokers

| Broker | Demo Server |
|--------|-------------|
| RoboForex | RoboForex-Demo |
| IC Markets | ICMarketsSC-Demo |
| Pepperstone | Pepperstone-Demo |
| XM | XMGlobal-Demo |
| OANDA | OANDA-v20 Practice |
| Any MT5 Broker | Check broker's website |

---

## After Successful Installation

K.I.T. can:
- Connect to MT5 and read account info
- Fetch live prices (EURUSD, GBPUSD, etc.)
- Execute trades
- Manage positions
- Run 24/7 on your VPS

**Next Step:** Start K.I.T. Gateway!
```powershell
cd C:\k.i.t.-bot
npm install
npm run build
npm start
```

---

## Support

- K.I.T. GitHub: https://github.com/kayzaa/k.i.t.-bot
- MT5 Documentation: https://www.mql5.com/en/docs/integration/python_metatrader5
