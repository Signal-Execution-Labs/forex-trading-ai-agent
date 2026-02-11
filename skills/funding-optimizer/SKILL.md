# Funding Rate Optimizer Skill

**Category:** Trading  
**Inspired by:** Coinglass, Velo Data, Laevitas

## Overview

Maximize funding rate income on perpetual futures. Track funding across exchanges, find best rates, and automate delta-neutral funding harvesting strategies.

## Features

### 1. Funding Rate Dashboard
- **Real-Time Rates**: All exchanges, all pairs
- **Historical Data**: 30/60/90 day averages
- **Annualized Yield**: APY from funding alone
- **Next Funding**: Countdown timers
- **Rate Predictions**: ML-based forecasts

### 2. Exchange Comparison
- **Binance**: 8-hour funding
- **Bybit**: 8-hour funding
- **OKX**: 8-hour funding
- **dYdX**: 1-hour funding
- **GMX/GNS**: Real-time funding
- **Hyperliquid**: 1-hour funding

### 3. Funding Strategies
- **Cash & Carry**: Spot long + perp short
- **Cross-Exchange**: Long on low, short on high
- **Directional Bias**: Harvest + trend trade
- **Stablecoin Yield**: Fund rate on stables

### 4. Delta-Neutral Automation
- **Auto-Hedge**: Open spot position to offset perp
- **Rebalance**: Keep delta near zero
- **Basis Tracking**: Monitor spot-perp spread
- **Liquidation Guard**: Safe margin management
- **Profit Taking**: Compound or withdraw

### 5. Risk Management
- **Funding Rate Flip Alert**: When rate changes sign
- **Liquidation Distance**: Monitor margin safety
- **Correlation Check**: Ensure hedge effectiveness
- **Max Position Size**: Per pair limits
- **Stop Loss**: Exit if strategy unprofitable

## Commands

```
kit funding rates --sort apy --min-volume 10m
kit funding compare BTC --exchanges binance,bybit,okx
kit funding history ETH --period 30d
kit funding harvest BTC --budget 10000 --strategy cash-carry
kit funding positions --status active
kit funding pnl --period 7d
kit funding alerts --add BTC --threshold 0.1%
```

## Output Format

```json
{
  "timestamp": "2026-02-11T21:35:00Z",
  "top_rates": [
    {
      "symbol": "BTC/USDT",
      "exchange": "Binance",
      "current_rate": "+0.0234%",
      "annualized": "+25.7%",
      "next_funding": "2h 15m",
      "predicted_rate": "+0.0198%",
      "volume_24h": "$8.5B",
      "open_interest": "$4.2B"
    },
    {
      "symbol": "ETH/USDT",
      "exchange": "Bybit",
      "current_rate": "+0.0312%",
      "annualized": "+34.2%",
      "next_funding": "2h 15m"
    }
  ],
  "arbitrage_opportunities": [
    {
      "symbol": "SOL",
      "long_exchange": "OKX",
      "long_rate": "+0.005%",
      "short_exchange": "Binance",
      "short_rate": "+0.032%",
      "spread": "0.027%",
      "annualized_arb": "+29.6%",
      "capital_required": "$20,000 (split)"
    }
  ],
  "active_positions": [
    {
      "strategy": "cash_carry",
      "pair": "BTC/USDT",
      "spot_position": "+0.5 BTC @ $45,000",
      "perp_position": "-0.5 BTC @ $45,100",
      "basis": "+$100 (+0.22%)",
      "funding_earned": "$234.50",
      "pnl_total": "+$312.20",
      "apy_realized": "+28.4%",
      "delta": "-0.002 BTC",
      "days_active": 14
    }
  ]
}
```

## Funding Calendar

Visual calendar showing:
- Funding times per exchange (every 8h / 1h)
- Expected income per period
- Historical funding by hour of day
- Best times to enter positions

## Yield Comparison

| Strategy | APY Range | Risk | Capital Efficiency |
|----------|-----------|------|-------------------|
| Cash & Carry | 15-40% | Low | 50% (spot + perp) |
| Cross-Exchange | 20-50% | Medium | 100% |
| Directional | 30-100% | High | 100% |
| Stablecoin | 5-15% | Very Low | 100% |

## Auto-Compound

- Reinvest funding earnings automatically
- Compound daily, weekly, or monthly
- Track compound growth over time
- Tax event logging for each compound
