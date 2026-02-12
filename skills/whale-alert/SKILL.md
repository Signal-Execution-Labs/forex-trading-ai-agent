# Whale Alert System

Track large transactions in real-time across all chains.

## Overview
Monitor whale movements: large transfers, exchange deposits/withdrawals, and accumulation patterns. Trade with the smart money, not against it.

## Alert Types

### 1. Large Transfers
```
🐋 WHALE ALERT
1,500 BTC ($64.5M) transferred
From: Unknown Wallet
To: Binance
Time: 2 mins ago

⚠️ Exchange deposit = potential sell pressure
```

### 2. Exchange Flows
```
📊 24h Exchange Flow - BTC
Inflow: 12,450 BTC ($534M)
Outflow: 8,230 BTC ($353M)
Net: +4,220 BTC (bearish signal)
```

### 3. Accumulation Detection
```
🦈 SHARK ACCUMULATION
Wallet: 0x7a...f3
Asset: ETH
7d Activity:
├── Bought: 2,340 ETH
├── Avg Price: $2,850
├── Total: $6.67M
└── Pattern: Systematic buying
```

### 4. Token Unlocks
```
🔓 TOKEN UNLOCK ALERT
Token: ARB
Amount: 125M tokens ($156M)
Date: Feb 15, 2026
Recipients: Team + early investors
Risk: High sell pressure expected
```

## Tracking Features

### Watchlist
```yaml
watchlisted_wallets:
  - address: "0x1234..."
    label: "Jump Trading"
    alerts: all
  - address: "0x5678..."
    label: "Alameda Remnants"
    alerts: large_only
  - address: "bc1q..."
    label: "Mt. Gox Trustee"
    alerts: any_movement
```

### Smart Money Index
```
Smart Money Flow (7d):
├── BTC: Accumulating 🟢
├── ETH: Distributing 🔴
├── SOL: Neutral ⚪
├── LINK: Heavy Accumulation 🟢🟢
└── DOGE: Heavy Distribution 🔴🔴
```

### On-Chain Metrics
```
BTC On-Chain:
├── Exchange Balance: 2.3M BTC (12% of supply)
├── Miner Outflow: +1,200 BTC (selling)
├── Long-Term Holder: -5,000 BTC (distributing)
├── Short-Term Holder: +8,000 BTC (new buyers)
└── Spent Output Age: 45 days (old coins moving)
```

## Alert Thresholds
```yaml
alerts:
  btc:
    minimum: 500 BTC
    exchange_deposit: 100 BTC
  eth:
    minimum: 5000 ETH
    exchange_deposit: 1000 ETH
  stablecoins:
    minimum: $10M
    exchange_flow: $50M
```

## Trading Signals
```
Based on whale activity:

🟢 BUY Signal Conditions:
- Large exchange withdrawals
- Accumulation by known smart money
- Decreasing exchange reserves

🔴 SELL Signal Conditions:
- Large exchange deposits
- Distribution by long-term holders
- Increasing exchange reserves
```

## Data Sources
- Whale Alert API
- Glassnode
- CryptoQuant
- Nansen
- Direct blockchain RPC

## Commands
```bash
kit whale-alert stream           # Live whale alerts
kit whale-alert track 0x123...   # Track specific wallet
kit whale-alert flows --asset BTC
kit whale-alert smart-money
kit whale-alert unlocks --days 30
kit whale-alert top-wallets --asset ETH
```
