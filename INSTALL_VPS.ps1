# ============================================
# K.I.T. VPS INSTALLER - Windows Edition
# One-Click Installation for Windows VPS + MT5
# ============================================

Write-Host @"
    
    ██╗  ██╗    ██╗   ████████╗
    ██║ ██╔╝    ██║   ╚══██╔══╝
    █████╔╝     ██║      ██║   
    ██╔═██╗     ██║      ██║   
    ██║  ██╗ ██╗██║ ██╗  ██║   
    ╚═╝  ╚═╝ ╚═╝╚═╝ ╚═╝  ╚═╝   
    
    VPS INSTALLER v2.0
    Your Autonomous AI Financial Agent
    
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
    Write-Host "  OK Python: $pythonVersion" -ForegroundColor Green
} catch {
    Write-Host "  X Python NOT FOUND!" -ForegroundColor Red
    Write-Host "     Download: https://www.python.org/downloads/" -ForegroundColor Gray
    Write-Host "     IMPORTANT: Check 'Add Python to PATH' during installation!" -ForegroundColor Yellow
    exit 1
}

# Check pip
try {
    $pipVersion = pip --version 2>&1
    Write-Host "  OK pip: OK" -ForegroundColor Green
} catch {
    Write-Host "  X pip NOT FOUND!" -ForegroundColor Red
    exit 1
}

# Check Node.js (optional)
try {
    $nodeVersion = node --version 2>&1
    Write-Host "  OK Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  -- Node.js not found (optional for K.I.T. Dashboard)" -ForegroundColor Yellow
}

# Check Git
try {
    $gitVersion = git --version 2>&1
    Write-Host "  OK Git: OK" -ForegroundColor Green
} catch {
    Write-Host "  -- Git not found (optional)" -ForegroundColor Yellow
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

Write-Host "  OK All Python packages installed!" -ForegroundColor Green

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
    Write-Host "  OK $result" -ForegroundColor Green
} catch {
    Write-Host "  X MetaTrader5 library error!" -ForegroundColor Red
    exit 1
}

# ============================================
# STEP 4: Check MT5 Terminal
# ============================================

Write-Host "`n[4/6] Checking MT5 Terminal..." -ForegroundColor Yellow

$mt5Process = Get-Process -Name "terminal64" -ErrorAction SilentlyContinue
if ($mt5Process) {
    Write-Host "  OK MT5 Terminal is RUNNING!" -ForegroundColor Green
} else {
    Write-Host "  -- MT5 Terminal is NOT running!" -ForegroundColor Yellow
    Write-Host "     Please start MT5 and log in!" -ForegroundColor Yellow
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
        Write-Host "  OK MT5 CONNECTED!" -ForegroundColor Green
        Write-Host ""
        Write-Host "  +==========================================+" -ForegroundColor Cyan
        Write-Host "  |         ACCOUNT INFORMATION              |" -ForegroundColor Cyan
        Write-Host "  +==========================================+" -ForegroundColor Cyan
        Write-Host ("  |  Login:    {0,-27}|" -f $result.login) -ForegroundColor White
        Write-Host ("  |  Server:   {0,-27}|" -f $result.server) -ForegroundColor White
        Write-Host ("  |  Balance:  {0,-27}|" -f "$($result.balance) $($result.currency)") -ForegroundColor White
        Write-Host ("  |  Leverage: 1:{0,-25}|" -f $result.leverage) -ForegroundColor White
        Write-Host ("  |  Trading:  {0,-27}|" -f $(if($result.trade_allowed){"OK ENABLED"}else{"X DISABLED"})) -ForegroundColor White
        Write-Host "  +==========================================+" -ForegroundColor Cyan
        
        if (-not $result.trade_allowed) {
            Write-Host ""
            Write-Host "  WARNING: ALGO-TRADING DISABLED!" -ForegroundColor Red
            Write-Host "     In MT5: Tools > Options > Expert Advisors" -ForegroundColor Yellow
            Write-Host "     Enable 'Allow Algorithmic Trading'" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  X Connection failed: $($result.message)" -ForegroundColor Red
        Write-Host ""
        Write-Host "  TIPS:" -ForegroundColor Yellow
        Write-Host "     1. Start MT5 Terminal" -ForegroundColor Gray
        Write-Host "     2. Log in to your broker (e.g., RoboForex-Demo)" -ForegroundColor Gray
        Write-Host "     3. Wait until 'Connecting...' disappears" -ForegroundColor Gray
        Write-Host "     4. Run this script again" -ForegroundColor Gray
    }
} catch {
    Write-Host "  X Test failed: $_" -ForegroundColor Red
}

# ============================================
# STEP 6: Summary
# ============================================

Write-Host ""
Write-Host "+============================================================+" -ForegroundColor Green
Write-Host "|            K.I.T. VPS INSTALLATION COMPLETE!               |" -ForegroundColor Green
Write-Host "+============================================================+" -ForegroundColor Green

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Start MT5 Terminal and log in to your broker" -ForegroundColor White
Write-Host "  2. Enable Algo-Trading (button must be GREEN)" -ForegroundColor White
Write-Host "  3. Run Quick Test:" -ForegroundColor White
Write-Host ""
Write-Host "     python MT5_QUICK_TEST.py" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Test a demo trade:" -ForegroundColor White
Write-Host ""
Write-Host "     python MT5_QUICK_TEST.py --trade" -ForegroundColor Yellow
Write-Host ""
Write-Host "LINKS:" -ForegroundColor Cyan
Write-Host "   MT5 Download:   https://www.metatrader5.com/download" -ForegroundColor Gray
Write-Host "   K.I.T. GitHub:  https://github.com/kayzaa/k.i.t.-bot" -ForegroundColor Gray
Write-Host ""
