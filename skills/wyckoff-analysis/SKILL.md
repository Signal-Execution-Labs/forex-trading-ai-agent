# Wyckoff Analysis Skill

Wyckoff Method analysis for detecting smart money accumulation and distribution patterns.

## Overview

The Wyckoff Method is a century-old approach to understanding market structure by analyzing:
- **Accumulation phases** (smart money buying)
- **Distribution phases** (smart money selling)
- **Price-volume relationships**
- **Composite Man theory** (institutional behavior)

## Commands

- `wyckoff analyze <symbol>` - Full Wyckoff analysis
- `wyckoff phase <symbol>` - Detect current market phase
- `wyckoff events <symbol>` - Identify Wyckoff events (PS, SC, AR, ST, etc.)
- `wyckoff composite <symbol>` - Composite Man activity analysis
- `wyckoff volume <symbol>` - Volume spread analysis
- `wyckoff alerts` - Set up Wyckoff event alerts

## Wyckoff Phases

### Accumulation (Bottom)
1. **PS** - Preliminary Support
2. **SC** - Selling Climax
3. **AR** - Automatic Rally
4. **ST** - Secondary Test
5. **Spring/LPS** - Spring or Last Point of Support
6. **SOS** - Sign of Strength
7. **LPS** - Last Point of Support (backup)

### Distribution (Top)
1. **PSY** - Preliminary Supply
2. **BC** - Buying Climax
3. **AR** - Automatic Reaction
4. **ST** - Secondary Test
5. **UT/UTAD** - Upthrust / Upthrust After Distribution
6. **SOW** - Sign of Weakness
7. **LPSY** - Last Point of Supply

## Volume Analysis

- **Effort vs Result** - Volume should confirm price movement
- **No Demand** - Rising price on decreasing volume (weakness)
- **No Supply** - Falling price on decreasing volume (strength)
- **Stopping Volume** - High volume halting a trend

## Configuration

```yaml
wyckoff:
  lookback_periods: 200
  volume_threshold: 1.5  # Volume spike multiplier
  price_tolerance: 0.02  # 2% price tolerance for tests
  min_phase_bars: 20     # Minimum bars to confirm phase
  alerts:
    - phase_change
    - spring_detected
    - upthrust_detected
    - sos_confirmed
    - sow_confirmed
```

## Output Example

```
┌─────────────────────────────────────────────────────────┐
│  WYCKOFF ANALYSIS: BTC/USDT                            │
├─────────────────────────────────────────────────────────┤
│  Current Phase: ACCUMULATION (Phase C - Spring)        │
│  Confidence: 78%                                       │
│                                                        │
│  Recent Events:                                        │
│  • SC (Selling Climax) @ $38,200 - Jan 15             │
│  • AR (Automatic Rally) @ $42,100 - Jan 18            │
│  • ST (Secondary Test) @ $38,800 - Jan 25             │
│  • SPRING @ $37,500 - Feb 3 ⚡ BULLISH                │
│                                                        │
│  Volume Analysis:                                      │
│  • Effort/Result: BULLISH (rising effort, rising $)   │
│  • Stopping Volume: Detected at $37,500               │
│  • No Supply: Confirmed on last 3 pullbacks           │
│                                                        │
│  Composite Man Activity:                               │
│  • Accumulation detected: 15 days                     │
│  • Estimated position: LONG                           │
│  • Aggression: MODERATE                               │
│                                                        │
│  Projection:                                           │
│  • Next target: $45,000 (SOS zone)                   │
│  • Invalidation: Below $36,000                        │
└─────────────────────────────────────────────────────────┘
```

## Integration

Works with:
- `market-analysis` - Enhanced technical analysis
- `alert-system` - Wyckoff event notifications
- `signal-bot` - Wyckoff-based signals
- `ai-predictor` - ML-enhanced phase detection
