# Golden Zone Re-Entry

> **Skill #68** - Fibonacci pullback entries in established trends

## Overview

Identifies optimal re-entry points in trending markets using the "Golden Zone" (61.8%-78.6% Fibonacci retracement). After an initial signal, tracks pullbacks for continuation entries.

## Features

- **Primary Signal Tracking:** Monitor initial trend signals
- **Fibonacci Calculation:** Auto-draw Fib levels on swings
- **Golden Zone Detection:** 61.8%-78.6% entry zone
- **Confluence Scoring:** Multiple factor alignment
- **Risk Management:** Auto SL at 100% Fib level
- **Triangle Markers:** Visual re-entry signals

## Usage

```bash
# Basic golden zone tracking
kit skill golden-zone --symbol BTC/USDT --trend bullish

# With confluence requirements
kit skill golden-zone --symbol ETH/USDT --min-confluence 3

# Custom zone levels
kit skill golden-zone --symbol SOL/USDT --zone 0.618,0.786
```

## Configuration

```yaml
golden_zone:
  fib_levels:
    - 0.382      # Shallow pullback
    - 0.50       # 50% level
    - 0.618      # Golden ratio
    - 0.786      # Deep pullback
  entry_zone:
    start: 0.618
    end: 0.786
  confluence_factors:
    - fib_level
    - support_resistance
    - volume_profile
    - order_block
    - moving_average
  min_confluence: 2
  risk_reward_min: 2.0
```

## Signal Types

| Signal | Marker | Description |
|--------|--------|-------------|
| PRIMARY_BULLISH | 🟢 Circle | Initial trend signal |
| PRIMARY_BEARISH | 🔴 Circle | Initial short signal |
| REENTRY_LONG | 🔺 Triangle | Golden zone long |
| REENTRY_SHORT | 🔻 Triangle | Golden zone short |
| ZONE_REACHED | ⚡ | Price entered zone |

## Entry Rules

1. Wait for primary signal (MSS, pattern, etc.)
2. Identify impulse leg swing high/low
3. Draw Fibonacci from swing low to high (bullish)
4. Watch for pullback into 61.8%-78.6% zone
5. Enter on confirmation (candle pattern, volume)
6. Stop loss below 100% Fib level
7. Target: previous high/extension levels

## Confluence Checklist

- [ ] Price in golden zone (61.8%-78.6%)
- [ ] Support/resistance level
- [ ] Order block present
- [ ] Volume decrease (healthy pullback)
- [ ] RSI not overbought/oversold
- [ ] Higher timeframe alignment
