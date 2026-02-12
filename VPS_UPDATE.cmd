@echo off
echo ========================================
echo K.I.T. VPS Update Script
echo ========================================
echo.

REM Stop any running K.I.T. instances
echo [1/5] Stopping running instances...
taskkill /F /IM node.exe 2>nul
timeout /t 5 /nobreak >nul

REM Try to stop NSSM service if it exists
echo [2/5] Stopping KitBotAPI service (if exists)...
C:\nssm-2.24\win64\nssm.exe stop KitBotAPI 2>nul
timeout /t 3 /nobreak >nul

REM Pull latest code
echo [3/5] Pulling latest code from GitHub...
cd /d C:\k.i.t.-bot
git pull

REM Build
echo [4/5] Building K.I.T....
call npm run build

REM Wait for Telegram cooldown
echo [5/5] Waiting 30s for Telegram cooldown...
timeout /t 30 /nobreak

REM Start K.I.T.
echo.
echo ========================================
echo Starting K.I.T....
echo ========================================
kit start

pause
