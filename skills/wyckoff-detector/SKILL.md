# Wyckoff Schematic Detector

Automatic detection of Wyckoff accumulation and distribution patterns.

## Features

- **Real-Time Detection** - Identifies Wyckoff phases as they develop
- **Phase Labeling** - PS, SC, AR, ST, Springs, Tests, SOS, LPSY, etc.
- **Smart Money Tracking** - Visualize institutional accumulation/distribution
- **Volume Analysis** - Effort vs Result analysis for phase confirmation
- **Price Targets** - Calculate markup/markdown targets from ranges
- **Alert System** - Notify on phase transitions and key events
- **Multi-Timeframe** - Detect patterns across all timeframes

## Wyckoff Phases Detected

### Accumulation
- PS (Preliminary Support)
- SC (Selling Climax)
- AR (Automatic Rally)
- ST (Secondary Test)
- Spring/Shakeout
- Test of Spring
- SOS (Sign of Strength)
- LPS (Last Point of Support)
- BU (Back-Up)

### Distribution
- PSY (Preliminary Supply)
- BC (Buying Climax)
- AR (Automatic Reaction)
- ST (Secondary Test)
- UT (Upthrust)
- UTAD (Upthrust After Distribution)
- SOW (Sign of Weakness)
- LPSY (Last Point of Supply)

## Commands

```
kit wyckoff scan                   # Scan markets for patterns
kit wyckoff analyze <symbol>       # Deep analysis of symbol
kit wyckoff phases <symbol>        # Show current phase
kit wyckoff alerts                 # Configure phase alerts
kit wyckoff backtest               # Backtest Wyckoff strategy
```

## API Endpoints

- `GET /api/wyckoff/scan` - Scan for patterns
- `GET /api/wyckoff/:symbol` - Symbol analysis
- `GET /api/wyckoff/:symbol/phases` - Phase history
- `POST /api/wyckoff/alerts` - Set alerts

## Configuration

```yaml
wyckoff:
  sensitivity: medium         # low/medium/high
  min_range_bars: 50          # Minimum consolidation length
  volume_confirmation: true
  multi_timeframe: true
  timeframes: [1h, 4h, 1d]
```

## Trading Integration

- Auto-entry on Spring/Test confirmation
- Stop loss at SC/BC levels
- Take profit at range projection
- Position sizing based on risk
