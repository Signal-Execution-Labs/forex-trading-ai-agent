---
name: social-trading
description: "Copy trades from other bots, signal providers, and top traders in real-time"
metadata:
  {
    "openclaw":
      {
        "emoji": "👥",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "websockets", "aiohttp", "python-telegram-bot"] }
      }
  }
---

# Social Trading

Copy trades from professional traders, signal bots, and automated systems across multiple platforms.

## Overview

- **Multi-Source Copy Trading** - Copy from Telegram bots, Discord bots, Twitter signals, API providers
- **Smart Signal Processing** - Parse, validate, and execute signals automatically
- **Risk Adjustment** - Scale positions based on your risk tolerance
- **Performance Tracking** - Track win rate and P&L per signal source
- **Latency Optimization** - Sub-second execution for time-sensitive signals

## Signal Sources

### Supported Platforms

| Platform | Type | Latency |
|----------|------|---------|
| **Telegram Bots** | Real-time messages | <1s |
| **Discord Bots** | Channel webhooks | <1s |
| **Twitter/X** | Tweet monitoring | 2-5s |
| **TradingView** | Webhook alerts | <1s |
| **Crypto Exchanges** | Copy trading API | <1s |
| **Custom Webhooks** | HTTP POST | <1s |

### Supported Bot Types

1. **Signal Bots** - Provide buy/sell signals
2. **Copy Trading Bots** - Mirror trades from a master account
3. **Alert Bots** - Notify about market conditions
4. **Strategy Bots** - Execute predefined strategies

## Configuration

```yaml
# workspace/social-trading.yaml
sources:
  # Telegram Signal Bot
  - name: "Crypto Whale Signals"
    type: telegram_bot
    channel_id: "@CryptoWhaleVIP"
    enabled: true
    filters:
      min_confidence: 0.8
      pairs: ["BTC/USDT", "ETH/USDT"]
    risk:
      max_position_pct: 5
      scale_factor: 0.5  # Copy at 50% of signal size
      
  # Discord Signal Server
  - name: "Forex Masters"
    type: discord
    server_id: "123456789"
    channel_id: "signals"
    enabled: true
    markets: [forex]
    risk:
      max_position_pct: 3
      
  # Another K.I.T. Bot (via webhook)
  - name: "Partner K.I.T. Bot"
    type: kit_webhook
    endpoint: "https://partner-kit.example.com/signals"
    api_key: "${PARTNER_KIT_API_KEY}"
    enabled: true
    
  # Binance Copy Trading (Leaderboard)
  - name: "Binance Top Trader"
    type: binance_copy
    trader_id: "XXXX1234"
    enabled: true
    risk:
      scale_factor: 0.25
      
  # Custom Webhook
  - name: "My Custom Source"
    type: webhook
    listen_port: 8081
    secret: "${WEBHOOK_SECRET}"
    enabled: true

settings:
  execution:
    max_slippage_pct: 0.5
    max_signal_age_seconds: 60
    confirm_large_trades: true  # Confirm trades > $1000
    
  risk:
    max_daily_trades: 50
    max_daily_loss_pct: 5
    max_concurrent_positions: 10
    
  notifications:
    on_signal: true
    on_trade: true
    on_close: true
    channel: telegram

routing:
  crypto: binance
  forex: mt5
  stocks: alpaca
```

## Signal Formats

### Standard K.I.T. Signal Format

```json
{
  "action": "buy",
  "symbol": "BTC/USDT",
  "price": 45000,
  "type": "market",
  "confidence": 0.85,
  "tp": [46000, 47000],
  "sl": 44000,
  "size_pct": 5,
  "source": "signal_bot_name",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Supported Text Formats

```
# Format 1: Simple
BUY BTC/USDT @ 45000 TP: 46000 SL: 44000

# Format 2: Emoji-based
🟢 LONG BTC/USDT
Entry: $45,000
Target: $47,000 (+4.4%)
Stop: $44,000 (-2.2%)

# Format 3: Forex style
EUR/USD BUY
Entry: 1.0850
TP1: 1.0900
TP2: 1.0950
SL: 1.0800

# Format 4: Crypto bot
🚀 #BTC #LONG
Entry Zone: 44800-45200
Targets: 46000 / 47000 / 48000
Stop Loss: 44000
Leverage: 10x
```

## Commands

### Manage Sources

```bash
# List all signal sources
kit social sources

# Add a new source
kit social add telegram @CryptoSignalsVIP

# Enable/disable source
kit social enable "Crypto Whale Signals"
kit social disable "Forex Masters"

# Test source connection
kit social test "Partner K.I.T. Bot"
```

### Monitor Signals

```bash
# Watch incoming signals (live)
kit social watch

# Show recent signals
kit social history --limit 20

# Show signals from specific source
kit social history --source "Crypto Whale Signals"
```

### Performance Tracking

```bash
# Overall performance
kit social stats

# Per-source performance
kit social stats --source "Crypto Whale Signals"

# Export to CSV
kit social export --format csv --output signals_report.csv
```

## Signal Processing Flow

```
┌────────────────────────────────────────────────────────────┐
│                    SIGNAL SOURCES                          │
│  Telegram │ Discord │ Twitter │ Webhook │ Exchange Copy   │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                   SIGNAL PARSER                            │
│  • Detect format                                           │
│  • Extract: action, symbol, price, TP, SL                  │
│  • Normalize to K.I.T. format                              │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                   SIGNAL VALIDATOR                         │
│  • Check signal age (skip if too old)                      │
│  • Verify symbol exists                                    │
│  • Check for duplicates                                    │
│  • Validate price within bounds                            │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                   RISK MANAGER                             │
│  • Apply scale factor                                      │
│  • Check position limits                                   │
│  • Calculate position size                                 │
│  • Verify risk/reward ratio                                │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                   EXECUTION ENGINE                         │
│  • Route to correct exchange                               │
│  • Place orders (market/limit)                             │
│  • Set TP/SL orders                                        │
│  • Log trade                                               │
└──────────────────────────┬─────────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────────┐
│                   NOTIFICATION                             │
│  • Confirm trade to user                                   │
│  • Update trade journal                                    │
│  • Track performance                                       │
└────────────────────────────────────────────────────────────┘
```

## Safety Features

### 1. Signal Validation
- Skip signals older than X seconds
- Require minimum confidence level
- Block duplicate signals
- Validate price is within reasonable range

### 2. Position Limits
- Max position size per signal
- Max concurrent positions
- Max positions per source
- Daily trade limit

### 3. Risk Controls
- Max daily loss limit (auto-pause)
- Max drawdown protection
- Scaling factor to reduce exposure
- Manual confirmation for large trades

### 4. Source Trust Levels

| Level | Description | Features |
|-------|-------------|----------|
| **Untrusted** | New source | Manual confirm all trades |
| **Verified** | 50+ signals tracked | Auto-execute small trades |
| **Trusted** | 70%+ win rate, 100+ signals | Full auto-execute |
| **Premium** | Your own bots | No limits |

## Example Usage

### Add a Telegram Signal Bot

```
User: Add the Telegram channel @CryptoGems as a signal source

K.I.T.: ✅ Added @CryptoGems as signal source
        📊 Signal Type: Crypto
        ⚙️ Scale Factor: 50% (default for new sources)
        🔒 Trust Level: Untrusted (manual confirmation required)
        
        First 50 signals will require your confirmation.
        After that, small trades will auto-execute if performance is good.
```

### Signal Received

```
📥 Signal from @CryptoGems:

🚀 ETH/USDT LONG
Entry: $2,450
TP1: $2,550 (+4.1%)
TP2: $2,650 (+8.2%)
SL: $2,380 (-2.9%)
Confidence: 🟢 High

K.I.T.: 📊 Signal detected!
        
        📈 ETH/USDT LONG
        💰 Entry: $2,450
        🎯 TP: $2,550 / $2,650
        🛑 SL: $2,380
        📦 Position: 0.2 ETH ($490) [50% scaled]
        
        Execute? [Yes/No/Skip]
```

### Performance Report

```
User: Show social trading stats

K.I.T.: 📊 Social Trading Performance (Last 30 Days)
        
        ┌──────────────────────────────────────────────┐
        │ Source               │ Win Rate │ P&L       │
        ├──────────────────────────────────────────────┤
        │ @CryptoGems          │ 68%      │ +$1,240   │
        │ @ForexMasters        │ 72%      │ +$890     │
        │ Partner K.I.T. Bot   │ 65%      │ +$456     │
        │ Binance Top Trader   │ 58%      │ -$120     │
        └──────────────────────────────────────────────┘
        
        Total Trades: 147
        Total P&L: +$2,466
        Avg Trade: +$16.78
```

## Files

- `social_trader.py` - Main social trading engine
- `parsers/` - Signal format parsers
  - `telegram_parser.py` - Telegram message parser
  - `discord_parser.py` - Discord message parser
  - `generic_parser.py` - Generic text parser
- `sources/` - Signal source connectors
  - `telegram_source.py` - Telegram bot/channel connector
  - `discord_source.py` - Discord webhook connector
  - `webhook_source.py` - Generic webhook receiver
- `config/` - Configuration templates
