---
name: funding-rate-monitor
description: "Monitors perpetual futures funding rates for arbitrage opportunities and sentiment signals"
version: "1.0.0"
metadata:
  kit:
    emoji: "💸"
    events: ["session:start", "alert:triggered"]
    priority: 50
---

# Funding Rate Monitor Hook

Monitors perpetual futures funding rates for arbitrage opportunities and extreme sentiment signals.

## What It Does

- Tracks funding rates across major exchanges (Binance, Bybit, OKX, dYdX)
- Alerts on extreme rates (>0.1% = expensive longs, <-0.1% = expensive shorts)
- Calculates annualized funding yield for cash-and-carry arbitrage
- Detects rate inversions (negative funding in uptrends = bullish divergence)
- Logs historical rates for pattern analysis

## Configuration

Default symbols: BTC, ETH, SOL
Default exchanges: Binance, Bybit
Alert threshold: 0.1% (per 8h funding)
Check interval: 60 minutes

## Alerts

- **🔴 EXTREME LONG COST**: Funding >0.3% (72% APR to hold longs)
- **🟢 EXTREME SHORT COST**: Funding <-0.3% (72% APR to hold shorts)
- **⚡ ARBITRAGE OPPORTUNITY**: >50% APR differential between exchanges
- **📊 SENTIMENT SHIFT**: Rate crosses zero after sustained period

## Use Cases

1. **Cash-and-carry arbitrage**: Long spot, short perp when funding is positive
2. **Sentiment gauge**: Extreme funding = market overheated
3. **Entry timing**: Enter longs when funding resets to neutral/negative
4. **Exchange selection**: Trade on exchange with best funding for your direction

## Output

Writes to `~/.kit/workspace/funding-rates.json` with rate history and alerts.
