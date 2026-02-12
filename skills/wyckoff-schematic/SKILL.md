# Wyckoff Schematic Detector

> Automatically detect and visualize Wyckoff Method accumulation and distribution patterns in real-time.

## Overview

Identifies smart money movements using Richard Wyckoff's century-old method:
- **Accumulation phases** (smart money buying)
- **Distribution phases** (smart money selling)
- **Phase transitions** (PS, SC, AR, ST, Spring, UTAD, SOW, etc.)

## Features

### Phase Detection
- **Preliminary Support (PS):** First buying appears after prolonged downtrend
- **Selling Climax (SC):** Panic selling on high volume, capitulation
- **Automatic Rally (AR):** Natural bounce after SC
- **Secondary Test (ST):** Retest of SC lows
- **Spring/Shakeout:** Final fake breakdown before markup
- **Last Point of Support (LPS):** Higher low confirmations
- **Sign of Strength (SOS):** Breakout above resistance

### Distribution Detection
- **Preliminary Supply (PSY):** First selling after uptrend
- **Buying Climax (BC):** Euphoric buying on high volume
- **Automatic Reaction (AR):** Pullback after BC
- **Secondary Test (ST):** Retest of BC highs
- **Upthrust After Distribution (UTAD):** Failed breakout
- **Sign of Weakness (SOW):** Breakdown signals

### Volume Analysis
- Volume spread analysis at each phase
- Effort vs Result comparison
- Supply/demand strength measurement
- No-demand and no-supply candles

### Visual Elements
- Phase labels on chart
- Trading range boundaries
- Creek/ice levels (support/resistance)
- Volume annotations
- Alert zones

## Configuration

```yaml
wyckoff_schematic:
  sensitivity: medium  # low, medium, high
  min_range_bars: 20   # minimum bars for trading range
  volume_threshold: 1.5 # volume spike multiplier
  show_labels: true
  show_annotations: true
  alert_on_spring: true
  alert_on_utad: true
  timeframes: [1h, 4h, 1d]
  assets: [BTC, ETH, SPY]
```

## Outputs

- `phase`: Current Wyckoff phase (accumulation, distribution, markup, markdown)
- `event`: Latest detected event (SC, AR, ST, Spring, etc.)
- `probability`: Confidence level (0-100%)
- `bias`: Expected direction (bullish, bearish, neutral)
- `range_high`: Trading range resistance
- `range_low`: Trading range support
- `volume_context`: Volume analysis summary

## Alerts

- **Spring Detected:** High probability reversal from accumulation
- **UTAD Detected:** Distribution complete, markdown likely
- **Phase Transition:** Moving to new phase
- **Volume Anomaly:** Unusual volume in context

## Trading Integration

```javascript
// Auto-trade on high confidence springs
if (event === 'spring' && probability > 75) {
  kit.execute({
    action: 'buy',
    size: 'position_size',
    stop: range_low * 0.99,
    target: range_high
  });
}
```

## Best Practices

1. Use on higher timeframes (1H+) for reliability
2. Combine with volume profile for confirmation
3. Wait for LPS after spring for safer entries
4. Never trade against the schematic

## References

- Richard D. Wyckoff original methodology
- David Weis "Trades About to Happen"
- TradingView "Wyckoff Schematic" by Kingshuk Ghosh
