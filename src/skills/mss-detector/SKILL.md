# MSS Detector (Market Structure Shift)

> **Skill #67** - Detect market structure shifts for reversal trading

## Overview

Identifies Market Structure Shifts (MSS) - a key concept in Smart Money trading. MSS occurs when price breaks a significant swing high/low, indicating potential trend reversal.

## Features

- **Swing Detection:** Automatic swing high/low identification
- **MSS Confirmation:** Break + close confirmation for valid shifts
- **Liquidity Zones:** Identify liquidity sweeps before MSS
- **Multi-Timeframe:** Detect MSS across different timeframes
- **Alert System:** Real-time alerts on MSS formation
- **AI Confirmation:** Optional AI model validation

## Usage

```bash
# Basic MSS detection
kit skill mss-detector --symbol BTC/USDT --timeframe 15m

# With AI confirmation
kit skill mss-detector --symbol ETH/USDT --ai-confirm true

# Multi-timeframe analysis
kit skill mss-detector --symbol EUR/USD --timeframes 5m,15m,1h
```

## Configuration

```yaml
mss_detector:
  swing_lookback: 10          # Candles to identify swings
  confirmation_candles: 1     # Candles to confirm break
  ai_confirmation: true       # Use AI for validation
  min_swing_size: 0.5%        # Minimum swing size
  liquidity_sweep: true       # Detect liquidity grabs
  timeframes:
    - 15m
    - 1h
    - 4h
```

## Signals Generated

| Signal | Description | Action |
|--------|-------------|--------|
| BULLISH_MSS | Bearish structure broken | Look for longs |
| BEARISH_MSS | Bullish structure broken | Look for shorts |
| MSS_SWEEP | Liquidity sweep + MSS | High probability |
| MSS_FAILED | False break detected | No action |

## Integration

Works seamlessly with:
- Order Flow skill (volume confirmation)
- AI Predictor (probability scoring)
- Auto Trader (automated entries)
- Multi-Condition Alert Builder (complex setups)

## Smart Money Concepts

1. **Liquidity Grab:** Price sweeps stops before reversing
2. **Break of Structure (BOS):** Initial structure break
3. **MSS Confirmation:** Candle close beyond structure
4. **Order Block:** Entry zone after MSS
