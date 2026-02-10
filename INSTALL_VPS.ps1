# ============================================
# K.I.T. VPS INSTALLER - Windows Edition
# One-Click Installation für Windows VPS + MT5
# ============================================

Write-Host @"
    
    ██╗  ██╗    ██╗   ████████╗
    ██║ ██╔╝    ██║   ╚══██╔══╝
    █████╔╝     ██║      ██║   
    ██╔═██╗     ██║      ██║   
    ██║  ██╗ ██╗██║ ██╗  ██║   
    ╚═╝  ╚═╝ ╚═╝╚═╝ ╚═╝  ╚═╝   
    
    VPS INSTALLER v2.0
    Der beste Trading Agent der Welt!
    
"@ -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# ============================================
# STEP 1: Check Prerequisites
# ============================================

Write-Host "`n[1/6] Checking Prerequisites..." -ForegroundColor Yellow

# Check Python
$pythonVersion = $null
try {
    $pythonVersion = python --version 2>&1
    Write-Host "  ✅ Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  ❌ Python NOT FOUND!" -ForegroundColor Red
    Write-Host "     Download: https://www.python.org/downloads/" -ForegroundColor Gray
    Write-Host "     WICHTIG: 'Add Python to PATH' anhaken bei Installation!" -ForegroundColor Yellow
    exit 1
}

# Check pip
try {
    $pipVersion = pip --version 2>&1
    Write-Host "  ✅ pip: OK" -ForegroundColor Green
} catch {
    Write-Host "  ❌ pip NOT FOUND!" -ForegroundColor Red
    exit 1
}

# Check Node.js (optional)
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Node.js nicht gefunden (optional für K.I.T. Dashboard)" -ForegroundColor Yellow
}

# Check Git
try {
    $gitVersion = git --version 2>&1
    Write-Host "  ✅ Git: OK" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Git nicht gefunden (optional)" -ForegroundColor Yellow
}

# ============================================
# STEP 2: Install Python Dependencies
# ============================================

Write-Host "`n[2/6] Installing Python Dependencies..." -ForegroundColor Yellow

$packages = @(
    "MetaTrader5",
    "pandas",
    "numpy",
    "psutil",
    "requests",
    "flask"
)

foreach ($pkg in $packages) {
    Write-Host "  Installing $pkg..." -ForegroundColor Gray
    pip install $pkg --quiet --disable-pip-version-check 2>&1 | Out-Null
}

Write-Host "  ✅ All Python packages installed!" -ForegroundColor Green

# ============================================
# STEP 3: Verify MetaTrader5 Library
# ============================================

Write-Host "`n[3/6] Verifying MetaTrader5 Library..." -ForegroundColor Yellow

$testScript = @"
import MetaTrader5 as mt5
print(f"MT5 Library Version: {mt5.__version__}")
"@

try {
    $result = python -c $testScript 2>&1
    Write-Host "  ✅ $result" -ForegroundColor Green
} catch {
    Write-Host "  ❌ MetaTrader5 library error!" -ForegroundColor Red
    exit 1
}

# ============================================
# STEP 4: Check MT5 Terminal
# ============================================

Write-Host "`n[4/6] Checking MT5 Terminal..." -ForegroundColor Yellow

$mt5Process = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
if ($mt5Process) {
    Write-Host "  ✅ MT5 Terminal is RUNNING!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  MT5 Terminal ist NICHT gestartet!" -ForegroundColor Yellow
    Write-Host "     Bitte starte MT5 und logge dich ein!" -ForegroundColor Yellow
}

# ============================================
# STEP 5: Connection Test
# ============================================

Write-Host "`n[5/6] Testing MT5 Connection..." -ForegroundColor Yellow

$connectTest = @"
import MetaTrader5 as mt5
import json

result = {"status": "error", "message": "Unknown error"}

if not mt5.initialize():
    error = mt5.last_error()
    result = {"status": "error", "message": f"MT5 init failed: {error}"}
else:
    account = mt5.account_info()
    if account is None:
        result = {"status": "error", "message": "No account info"}
    else:
        result = {
            "status": "ok",
            "login": account.login,
            "server": account.server,
            "balance": account.balance,
            "currency": account.currency,
            "leverage": account.leverage,
            "trade_allowed": account.trade_allowed
        }
    mt5.shutdown()

print(json.dumps(result))
"@

try {
    $jsonResult = python -c $connectTest 2>&1
    $result = $jsonResult | ConvertFrom-Json
    
    if ($result.status -eq "ok") {
        Write-Host "  ✅ MT5 CONNECTED!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  ╔════════════════════════════════════════╗" -ForegroundColor Cyan
        Write-Host "  ║         ACCOUNT INFORMATION            ║" -ForegroundColor Cyan
        Write-Host "  ╠════════════════════════════════════════╣" -ForegroundColor Cyan
        Write-Host ("  ║  Login:    {0,-27}║" -f $result.login) -ForegroundColor White
        Write-Host ("  ║  Server:   {0,-27}║" -f $result.server) -ForegroundColor White
        Write-Host ("  ║  Balance:  {0,-27}║" -f "$($result.balance) $($result.currency)") -ForegroundColor White
        Write-Host ("  ║  Leverage: 1:{0,-25}║" -f $result.leverage) -ForegroundColor White
        Write-Host ("  ║  Trading:  {0,-27}║" -f $(if($result.trade_allowed){"✅ ENABLED"}else{"❌ DISABLED"})) -ForegroundColor White
        Write-Host "  ╚════════════════════════════════════════╝" -ForegroundColor Cyan
        
        if (-not $result.trade_allowed) {
            Write-Host ""
            Write-Host "  ⚠️  ALGO-TRADING DEAKTIVIERT!" -ForegroundColor Red
            Write-Host "     In MT5: Tools → Options → Expert Advisors" -ForegroundColor Yellow
            Write-Host "     Aktiviere 'Allow Algorithmic Trading'" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  ❌ Connection failed: $($result.message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  💡 TIPPS:" -ForegroundColor Yellow
        Write-Host "     1. Starte MT5 Terminal" -ForegroundColor Gray
        Write-Host "     2. Logge dich ein (RoboForex-Demo)" -ForegroundColor Gray
        Write-Host "     3. Warte bis 'Connecting...' weg ist" -ForegroundColor Gray
        Write-Host "     4. Führe dieses Script erneut aus" -ForegroundColor Gray
    }
} catch {
    Write-Host "  ❌ Test failed: $_" -ForegroundColor Red
}

# ============================================
# STEP 6: Create Quick Test Script
# ============================================

Write-Host "`n[6/6] Creating Quick Test Script..." -ForegroundColor Yellow

$kitPath = $PSScriptRoot
if (-not $kitPath) { $kitPath = Get-Location }

$quickTestPath = Join-Path $kitPath "MT5_QUICK_TEST.py"

$quickTestContent = @'
#!/usr/bin/env python3
"""
K.I.T. MT5 Quick Test
Testet Verbindung und führt optional einen Demo-Trade aus.
"""

import MetaTrader5 as mt5
import sys
from datetime import datetime

def print_header():
    print("""
    ╔═══════════════════════════════════════════╗
    ║     K.I.T. MT5 CONNECTION TEST            ║
    ║     Der beste Trading Agent der Welt!     ║
    ╚═══════════════════════════════════════════╝
    """)

def test_connection():
    print("🔌 Verbinde mit MT5...")
    
    if not mt5.initialize():
        error = mt5.last_error()
        print(f"❌ FEHLER: {error}")
        print("\n💡 LÖSUNGEN:")
        print("   1. MT5 Terminal starten")
        print("   2. Einloggen (RoboForex-Demo)")
        print("   3. Warten bis verbunden")
        return False
    
    print("✅ Verbunden!")
    return True

def show_account():
    account = mt5.account_info()
    if account is None:
        print("❌ Keine Account-Info!")
        return False
    
    print(f"""
📊 ACCOUNT INFO:
   Login:    {account.login}
   Server:   {account.server}
   Name:     {account.name}
   Balance:  {account.balance:,.2f} {account.currency}
   Equity:   {account.equity:,.2f} {account.currency}
   Margin:   {account.margin:,.2f} {account.currency}
   Leverage: 1:{account.leverage}
   Trading:  {'✅ Erlaubt' if account.trade_allowed else '❌ DEAKTIVIERT'}
    """)
    
    if not account.trade_allowed:
        print("⚠️  ALGO-TRADING DEAKTIVIERT!")
        print("   → MT5: Tools → Options → Expert Advisors")
        print("   → Aktiviere 'Allow Algorithmic Trading'")
    
    return account.trade_allowed

def show_prices():
    symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
    print("💹 AKTUELLE PREISE:")
    
    for symbol in symbols:
        tick = mt5.symbol_info_tick(symbol)
        if tick:
            spread = (tick.ask - tick.bid) * 10000
            print(f"   {symbol}: Bid {tick.bid:.5f} | Ask {tick.ask:.5f} | Spread {spread:.1f}")
        else:
            print(f"   {symbol}: Nicht verfügbar")
    print()

def execute_demo_trade():
    print("🎯 DEMO TRADE:")
    print("   Symbol: EURUSD")
    print("   Type:   BUY")
    print("   Volume: 0.01 Lot")
    
    confirm = input("\n   Trade ausführen? (j/n): ").lower()
    if confirm != 'j':
        print("   ❌ Abgebrochen.")
        return
    
    symbol = "EURUSD"
    symbol_info = mt5.symbol_info(symbol)
    
    if symbol_info is None:
        print(f"   ❌ Symbol {symbol} nicht gefunden!")
        return
    
    if not symbol_info.visible:
        mt5.symbol_select(symbol, True)
    
    tick = mt5.symbol_info_tick(symbol)
    price = tick.ask
    
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY,
        "price": price,
        "deviation": 20,
        "magic": 123456,
        "comment": "K.I.T. Test Trade",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        print(f"   ❌ Trade fehlgeschlagen: {result.retcode}")
        print(f"   Grund: {result.comment}")
    else:
        print(f"   ✅ TRADE ERFOLGREICH!")
        print(f"   Ticket: {result.order}")
        print(f"   Preis:  {result.price}")
        print(f"   Volume: {result.volume}")

def main():
    print_header()
    
    if not test_connection():
        return
    
    trading_allowed = show_account()
    show_prices()
    
    if trading_allowed and "--trade" in sys.argv:
        execute_demo_trade()
    elif trading_allowed:
        print("💡 Für Demo-Trade: python MT5_QUICK_TEST.py --trade")
    
    mt5.shutdown()
    print("\n✅ Test abgeschlossen!")

if __name__ == "__main__":
    main()
'@

Set-Content -Path $quickTestPath -Value $quickTestContent -Encoding UTF8
Write-Host "  ✅ Created: $quickTestPath" -ForegroundColor Green

# ============================================
# SUMMARY
# ============================================

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║            K.I.T. VPS INSTALLATION COMPLETE!               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host ""
Write-Host "📋 NÄCHSTE SCHRITTE:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. MT5 Terminal starten und einloggen (RoboForex-Demo)" -ForegroundColor White
Write-Host "  2. Algo-Trading aktivieren (Button muss GRÜN sein)" -ForegroundColor White
Write-Host "  3. Quick Test ausführen:" -ForegroundColor White
Write-Host ""
Write-Host "     python MT5_QUICK_TEST.py" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Demo-Trade testen:" -ForegroundColor White
Write-Host ""
Write-Host "     python MT5_QUICK_TEST.py --trade" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔗 Links:" -ForegroundColor Cyan
Write-Host "   RoboForex Demo: https://www.roboforex.com/register/" -ForegroundColor Gray
Write-Host "   MT5 Download:   https://www.roboforex.com/trading-platforms/metatrader5/" -ForegroundColor Gray
Write-Host "   K.I.T. GitHub:  https://github.com/kayzaa/k.i.t.-bot" -ForegroundColor Gray
Write-Host ""
