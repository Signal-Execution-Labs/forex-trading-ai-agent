# Signal Copier Skill

Copy trading signals from Telegram channels and execute them automatically across ALL supported markets.

## Supported Markets

| Market | Platforms | Signal Types |
|--------|-----------|--------------|
| **Crypto** | Binance, Kraken, Coinbase, Bybit | Spot, Futures, Margin |
| **Forex** | MT4, MT5, RoboForex, OANDA | Buy/Sell, Pending Orders |
| **Binary Options** | BinaryFaster, IQ Option, Pocket Option | Call/Put, Turbo |
| **Stocks** | Alpaca, Interactive Brokers | Buy/Sell, Options |
| **DeFi** | Uniswap, PancakeSwap | Swap, LP Entry/Exit |

## Features

### 1. Multi-Channel Monitoring
- Subscribe to multiple Telegram signal channels
- Discord signal servers
- Twitter/X signal accounts
- Custom webhook endpoints

### 2. Universal Signal Parser
Automatically detects and parses various signal formats:

```
# Crypto Signals
"BTC/USDT LONG Entry: 45000 TP: 47000 SL: 44000"
"🚀 ETH BUY NOW | Target: +5%"

# Forex Signals
"EUR/USD BUY @ 1.0850 TP: 1.0900 SL: 1.0800"
"GOLD SELL Entry: 2050 | TP1: 2040 TP2: 2030"

# Binary Options
"EUR/USD CALL 5min Entry NOW 🔥"
"GBP/JPY PUT 1min HIGH CONFIDENCE"

# Stock Signals
"AAPL BUY Entry: $180 Target: $195"
"TSLA CALL Option Strike 250 Exp 03/15"
```

### 3. Smart Execution
- **Risk Management**: Auto-calculate position size based on your settings
- **Slippage Protection**: Skip if price moved too far
- **Duplicate Detection**: Don't execute same signal twice
- **Delay Handling**: Execute within X seconds or skip

### 4. Confirmation & Logging
- Instant confirmation to your Telegram/Discord
- Trade journal with all copied signals
- Performance tracking per signal provider

## Configuration

```yaml
# workspace/signal-copier.yaml
channels:
  - type: telegram
    id: "@CryptoSignalsPro"
    markets: [crypto]
    auto_execute: true
    
  - type: telegram  
    id: "@ForexVIPSignals"
    markets: [forex]
    auto_execute: true
    
  - type: telegram
    id: "@BinaryOptionsGold"
    markets: [binary]
    auto_execute: true

settings:
  max_risk_per_trade: 2%          # % of portfolio
  max_trades_per_day: 20
  execution_delay_max: 30s        # Skip if signal older
  require_confirmation: false     # true = ask before executing
  
routing:
  crypto: binance                 # Default exchange for crypto
  forex: mt5                      # Default for forex
  binary: binaryfaster            # Default for binary options
  stocks: alpaca                  # Default for stocks

notifications:
  on_signal: true
  on_execution: true
  on_result: true
```

## Commands

```
/signals status              - Show active channel subscriptions
/signals add <channel>       - Add new signal channel
/signals remove <channel>    - Remove channel
/signals pause               - Pause all auto-execution
/signals resume              - Resume auto-execution
/signals history             - Show recent signals & results
/signals stats               - Performance per provider
```

## Signal Flow

```
┌─────────────────┐
│ Signal Channel  │
│ (Telegram/etc)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Signal Parser  │ ← Detect format, extract data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Risk Manager    │ ← Check limits, calculate size
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Market Router   │ ← Route to correct exchange
└────────┬────────┘
         │
    ┌────┴────┬─────────┬──────────┐
    ▼         ▼         ▼          ▼
┌───────┐ ┌───────┐ ┌────────┐ ┌───────┐
│Binance│ │  MT5  │ │Binary  │ │Alpaca │
│Kraken │ │RoboFX │ │Faster  │ │  IB   │
└───────┘ └───────┘ └────────┘ └───────┘
```

## Safety Features

1. **Whitelist Only**: Only copy from approved channels
2. **Rate Limiting**: Max X trades per hour/day
3. **Loss Limits**: Stop copying if daily loss > X%
4. **Manual Override**: Always can pause/stop instantly
5. **Paper Trading**: Test mode without real money

## Example Usage

### Add a Crypto Signal Channel
```
User: Add the channel @CryptoWhale to copy crypto signals
K.I.T.: ✅ Added @CryptoWhale for crypto signals
        → Routing to: Binance
        → Auto-execute: ON
        → Max risk: 2% per trade
```

### Signal Received & Executed
```
Signal from @CryptoWhale:
"🐋 BTC/USDT LONG
Entry: $43,500
TP1: $44,500 (+2.3%)
TP2: $45,500 (+4.6%)
SL: $42,800 (-1.6%)"

K.I.T.: 📥 Signal detected from @CryptoWhale
        📊 BTC/USDT LONG @ $43,500
        ✅ Executed on Binance
        📦 Size: 0.023 BTC ($1,000)
        🎯 TP: $44,500 / $45,500
        🛑 SL: $42,800
```

## Files

- `signal-copier.py` - Main signal copier engine
- `parsers/` - Signal format parsers
- `routers/` - Market routing logic
- `providers/` - Channel connectors (Telegram, Discord, etc.)
