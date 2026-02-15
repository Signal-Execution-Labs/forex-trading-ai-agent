---
name: whale-alert
description: "Monitors large cryptocurrency transactions to detect smart money movements"
version: "1.0.0"
metadata:
  kit:
    emoji: "🐋"
    events: ["session:start", "alert:triggered"]
    priority: 50
---

# Whale Alert Hook

Monitors large cryptocurrency transactions to detect smart money movements.

## What It Does

- Tracks large transfers (>$1M default) on major chains
- Detects exchange inflows/outflows (bearish/bullish signals)
- Monitors known whale wallets and their movements
- Alerts on unusual accumulation or distribution patterns
- Logs transaction history for pattern analysis

## Configuration

Default minimum value: $1,000,000
Default assets: BTC, ETH, USDT, USDC
Check interval: 15 minutes

## Alert Types

- **🐋 WHALE TRANSFER**: Large wallet-to-wallet transfer
- **📥 EXCHANGE INFLOW**: Large deposit to exchange (potential sell pressure)
- **📤 EXCHANGE OUTFLOW**: Large withdrawal from exchange (bullish accumulation)
- **🔄 WHALE ACCUMULATION**: Known whale adding to position
- **⚠️ WHALE DISTRIBUTION**: Known whale reducing position

## Signals

| Flow Type | Direction | Signal |
|-----------|-----------|--------|
| Exchange Inflow | BTC/ETH | 🔴 Bearish (selling incoming) |
| Exchange Outflow | BTC/ETH | 🟢 Bullish (HODLing) |
| Exchange Inflow | Stablecoins | 🟢 Bullish (buying power) |
| Exchange Outflow | Stablecoins | 🔴 Bearish (buying power leaving) |

## Output

Writes to `~/.kit/workspace/whale-activity.json` with transaction history and exchange flow data.
