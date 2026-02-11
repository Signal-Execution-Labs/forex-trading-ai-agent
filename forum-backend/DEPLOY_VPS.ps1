# K.I.T. Forum Backend - VPS Deployment Script
# Run this on the VPS as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  K.I.T. Forum Backend Deployment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$INSTALL_DIR = "C:\kitbot-api"
$PORT = 3001

# Check if running as admin
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "ERROR: Run this script as Administrator!" -ForegroundColor Red
    exit 1
}

# 1. Install Node.js if not present
Write-Host "`n[1/6] Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "Installing Node.js..." -ForegroundColor Yellow
    # Download and install Node.js LTS
    $nodeInstaller = "$env:TEMP\node-setup.msi"
    Invoke-WebRequest -Uri "https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi" -OutFile $nodeInstaller
    Start-Process msiexec.exe -ArgumentList "/i", $nodeInstaller, "/quiet", "/norestart" -Wait
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    Write-Host "Node.js installed!" -ForegroundColor Green
} else {
    Write-Host "Node.js found: $nodeVersion" -ForegroundColor Green
}

# 2. Create install directory
Write-Host "`n[2/6] Creating directory..." -ForegroundColor Yellow
if (Test-Path $INSTALL_DIR) {
    Write-Host "Cleaning existing installation..." -ForegroundColor Yellow
    # Stop any running process
    Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*kitbot*" } | Stop-Process -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $INSTALL_DIR -Recurse -Force -ErrorAction SilentlyContinue
}
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
Write-Host "Created: $INSTALL_DIR" -ForegroundColor Green

# 3. Copy backend files (assumes this script is run from the backend folder)
Write-Host "`n[3/6] Copying files..." -ForegroundColor Yellow
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item -Path "$scriptDir\*" -Destination $INSTALL_DIR -Recurse -Force
Write-Host "Files copied!" -ForegroundColor Green

# 4. Install dependencies
Write-Host "`n[4/6] Installing dependencies..." -ForegroundColor Yellow
Set-Location $INSTALL_DIR
npm install --production 2>&1 | Out-Null
npm install tsx pm2 -g 2>&1 | Out-Null
Write-Host "Dependencies installed!" -ForegroundColor Green

# 5. Open firewall port
Write-Host "`n[5/6] Configuring firewall..." -ForegroundColor Yellow
$ruleName = "KitBot API Port $PORT"
$existingRule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existingRule) {
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $PORT -Action Allow | Out-Null
    Write-Host "Firewall rule created for port $PORT" -ForegroundColor Green
} else {
    Write-Host "Firewall rule already exists" -ForegroundColor Green
}

# 6. Start the server with PM2
Write-Host "`n[6/6] Starting server..." -ForegroundColor Yellow
Set-Location $INSTALL_DIR

# Create PM2 ecosystem file
$pm2Config = @"
module.exports = {
  apps: [{
    name: 'kitbot-api',
    script: 'npx',
    args: 'tsx src/index.ts',
    cwd: '$($INSTALL_DIR -replace '\\', '\\\\')',
    env: {
      PORT: $PORT,
      HOST: '0.0.0.0',
      NODE_ENV: 'production'
    },
    watch: false,
    instances: 1,
    autorestart: true,
    max_restarts: 10
  }]
}
"@
$pm2Config | Out-File -FilePath "$INSTALL_DIR\ecosystem.config.js" -Encoding UTF8

# Stop existing and start fresh
pm2 delete kitbot-api 2>$null
pm2 start ecosystem.config.js
pm2 save

# Set PM2 to start on boot
pm2-startup 2>$null

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "API running at: http://185.45.149.32:$PORT" -ForegroundColor Cyan
Write-Host "API Docs: http://185.45.149.32:$PORT/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Commands:" -ForegroundColor Yellow
Write-Host "  pm2 status       - Check status"
Write-Host "  pm2 logs         - View logs"
Write-Host "  pm2 restart all  - Restart server"
Write-Host ""
