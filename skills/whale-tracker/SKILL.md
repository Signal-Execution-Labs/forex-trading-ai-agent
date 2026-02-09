---
name: whale-tracker
description: Track large wallet movements across blockchains. Detect whale accumulation, distribution, and smart money flows.
metadata:
  {
    "kit":
      {
        "emoji": "🐋",
        "category": "intelligence",
        "tier": "premium",
        "triggers": [
          "whale", "whales", "whale alert", "whale tracker",
          "big wallet", "large transaction", "smart money",
          "accumulation", "distribution", "whale watching"
        ]
      }
  }
---

# 🐋 Whale Tracker

**Follow the smart money.** Track large wallet movements, whale accumulation patterns, and smart money flows across all major blockchains.

## Features

### 🔍 Real-Time Whale Alerts
- Track wallets holding >$1M in crypto
- Instant notifications on large transfers
- Exchange deposit/withdrawal detection
- Smart contract interactions

### 📊 Wallet Intelligence
- Historical transaction analysis
- Profit/loss tracking per wallet
- Portfolio composition
- Trading patterns & timing

### 🎯 Smart Money Tracking
- Known whale wallets database
- VC/Fund wallet identification
- Exchange cold/hot wallet tracking
- DeFi whale activity

### 📈 Accumulation/Distribution
- Net flow analysis
- Exchange reserves tracking
- Dormant wallet activation
- Supply distribution metrics

## Usage

```bash
# Real-time whale alerts
kit whale watch

# Track specific wallet
kit whale track 0x1234...abcd

# Top whale movements (24h)
kit whale top

# Whale activity for specific token
kit whale activity BTC

# Exchange inflows/outflows
kit whale flows binance
```

## CLI Output

```
🐋 K.I.T. Whale Tracker - Live
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Monitoring 15,847 whale wallets...
Last alert: 2 minutes ago

🚨 RECENT WHALE MOVEMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔴 SELL SIGNAL
   1,500 BTC ($75M) moved to Binance
   From: Unknown Whale #4521
   Time: 3 min ago
   Impact: Potentially Bearish 📉

🟢 ACCUMULATION
   Smart Money Wallet bought 50,000 ETH
   Price: $3,012 avg
   Value: $150.6M
   This wallet: +340% in 2024 📈

⚪ NEUTRAL
   10,000 ETH moved between cold wallets
   From: Grayscale Cold Storage
   To: Grayscale Hot Wallet
   Likely: Internal transfer

📊 24H SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Exchange Inflows:  $234M (bearish pressure)
Exchange Outflows: $456M (bullish signal)
Net Flow: -$222M (accumulation) 🟢

Top Movers:
• BTC: 12,450 coins moved ($623M)
• ETH: 89,000 coins moved ($267M)
• SOL: 2.1M coins moved ($210M)
```

## Configuration

```yaml
# TOOLS.md
whale_tracker:
  # Minimum transaction size to track
  min_value_usd: 100000  # $100k
  
  # Alert thresholds
  alerts:
    exchange_deposit: 500000    # $500k
    exchange_withdrawal: 1000000 # $1M
    whale_movement: 5000000     # $5M
    
  # Chains to monitor
  chains:
    - ethereum
    - bitcoin
    - solana
    - arbitrum
    - polygon
    
  # Tracked wallets (add your own)
  watchlist:
    - address: "0x1234..."
      label: "Smart Money #1"
    - address: "bc1q..."
      label: "BTC Whale"
      
  # Notification settings
  notifications:
    telegram: true
    discord: true
    email: false
```

## API

```python
from whale_tracker import WhaleTracker

tracker = WhaleTracker()

# Get recent whale movements
movements = await tracker.get_recent(
    min_value=1000000,  # $1M minimum
    hours=24
)

# Track specific wallet
wallet = await tracker.track_wallet("0x1234...")
print(f"Balance: ${wallet.total_value:,.0f}")
print(f"30d P&L: {wallet.pnl_30d:+.1%}")

# Exchange flow analysis
flows = await tracker.exchange_flows("binance", hours=24)
print(f"Net BTC flow: {flows.btc_net:+.2f}")

# Smart money signals
signals = await tracker.smart_money_signals()
for signal in signals:
    print(f"{signal.action}: {signal.asset} - {signal.confidence}%")
```

## Data Sources

- **Blockchain APIs**: Etherscan, Blockchair, Solscan
- **Whale Alert**: Real-time large transaction feed
- **Glassnode**: On-chain metrics
- **Nansen**: Wallet labels & smart money
- **Arkham**: Entity identification
- **Exchange APIs**: Deposit/withdrawal data

## Signals Interpretation

| Signal | Meaning | Action |
|--------|---------|--------|
| 🔴 Exchange Deposit | Potential sell | Consider reducing |
| 🟢 Exchange Withdrawal | Accumulation | Consider buying |
| 🐋 Whale Buy | Smart money entry | Follow cautiously |
| 💰 Dormant Activation | Old coins moving | Watch closely |
| 📊 Net Outflow | Supply squeeze | Bullish signal |

## Dependencies
- aiohttp>=3.9.0
- web3>=6.0.0
- python-bitcoinlib>=0.12.0
