# Liquidity Sweep Detector

Smart Money Concept: Detect liquidity grabs before reversals.

## Overview
Identifies when price sweeps above/below key levels to grab stop losses before reversing. Essential for Smart Money trading.

## Sweep Types
1. **High Sweep (Bearish):** Price sweeps above swing high, then closes below
2. **Low Sweep (Bullish):** Price sweeps below swing low, then closes above
3. **Equal Highs/Lows:** Price targets equal highs/lows for liquidity
4. **Session Sweep:** Price sweeps Asian/London session highs/lows

## Detection Logic
```
Bullish Sweep:
- Candle wick goes below previous swing low
- Candle body closes above the swing low
- Creates "reclaim" signal (⤴)

Bearish Sweep:
- Candle wick goes above previous swing high
- Candle body closes below the swing high
- Creates "reclaim" signal (⤵)
```

## Features
- Multi-timeframe sweep detection
- Liquidity pool mapping
- Stop hunt identification
- Fair Value Gap (FVG) after sweep
- Order block creation after sweep
- Confluence scoring

## Configuration
```yaml
liquiditySweep:
  swingLength: 20       # Bars for swing detection
  minWickRatio: 0.5     # Wick must be 50%+ of candle
  confirmBars: 3        # Bars to confirm sweep
  showPools: true       # Show liquidity pools on chart
  alertOnSweep: true
```

## Alerts
- Bullish liquidity sweep confirmed
- Bearish liquidity sweep confirmed
- Large liquidity pool forming
- Session high/low swept

## Best Pairs
- BTC/USD, ETH/USD (crypto)
- EUR/USD, GBP/USD (forex)
- NASDAQ, S&P 500 (indices)
