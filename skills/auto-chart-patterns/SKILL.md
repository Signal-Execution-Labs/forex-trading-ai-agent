# Auto Chart Patterns

TradingView Premium-style automatic chart pattern recognition.

## Features

- **Real-Time Detection** - Patterns detected as they form
- **30+ Pattern Types** - Classic and advanced patterns
- **Confidence Scoring** - AI-based pattern quality rating (0-100%)
- **Price Targets** - Automatic target calculation from pattern
- **Historical Stats** - Success rate per pattern type
- **Multi-Asset Scanning** - Scan entire markets for patterns
- **Alert on Formation** - Get notified when patterns complete

## Patterns Detected

### Reversal Patterns
- Head & Shoulders / Inverse H&S
- Double Top / Double Bottom
- Triple Top / Triple Bottom
- Rounding Top / Rounding Bottom
- Diamond Top / Diamond Bottom

### Continuation Patterns
- Ascending/Descending Triangle
- Symmetrical Triangle
- Bull/Bear Flag
- Bull/Bear Pennant
- Rising/Falling Wedge
- Rectangle/Channel

### Advanced Patterns
- Cup & Handle / Inverse C&H
- Adam & Eve
- Bump & Run
- Island Reversal
- Three Drives
- Wolfe Waves
- Gartley / Butterfly / Bat / Crab (Harmonics)

## Commands

```
kit patterns scan                  # Scan watchlist for patterns
kit patterns <symbol>              # Detect patterns on symbol
kit patterns history               # View detected pattern history
kit patterns stats                 # Pattern success statistics
kit patterns alert <type>          # Alert on specific pattern
```

## API Endpoints

- `GET /api/patterns/scan` - Multi-asset pattern scan
- `GET /api/patterns/:symbol` - Symbol patterns
- `GET /api/patterns/history` - Detection history
- `GET /api/patterns/stats` - Performance statistics
- `POST /api/patterns/alerts` - Configure alerts

## Configuration

```yaml
patterns:
  min_confidence: 70          # Minimum pattern quality
  detection_mode: realtime    # realtime/endofbar
  include_harmonics: true
  include_candlestick: true
  lookback_bars: 200
  auto_trade: false           # Enable auto-trading on patterns
```

## Pattern Data

Each detection includes:
- Pattern type and direction
- Entry point and stop loss
- Target prices (1, 2, 3)
- Confidence score
- Historical success rate
- Volume confirmation status
