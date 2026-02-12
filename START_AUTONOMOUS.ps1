# K.I.T. Autonomous Agent Startup Script
# Run this on the VPS to start K.I.T. in autonomous mode

Write-Host "🤖 Starting K.I.T. Autonomous Agent..." -ForegroundColor Cyan

# Set environment variables
$env:TELEGRAM_BOT_TOKEN = "8234018238:AAGCxlVuLVQEWZqCra9q9IqHCM8f0fULy1U"
$env:TELEGRAM_CHAT_ID = "988209153"
$env:KIT_AUTONOMOUS = "true"

# Navigate to K.I.T. directory
Set-Location "C:\k.i.t.-bot"

# Pull latest code
Write-Host "📥 Pulling latest code..." -ForegroundColor Yellow
git pull origin main

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install

# Build
Write-Host "🔨 Building..." -ForegroundColor Yellow
npm run build

# Start K.I.T.
Write-Host "🚀 Starting K.I.T. Autonomous Agent!" -ForegroundColor Green
node dist/src/cli/kit.js start --autonomous --telegram

Write-Host "✅ K.I.T. is running in autonomous mode!" -ForegroundColor Green
