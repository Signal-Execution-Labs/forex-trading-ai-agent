# Auto Pattern Recognition

Automated chart pattern detection with AI-powered confirmation. Identifies 30+ patterns in real-time.

## Features

- **Classic Patterns**: Head & Shoulders, Double Top/Bottom, Triangles
- **Harmonic Patterns**: Gartley, Butterfly, Bat, Crab, Shark, Cypher
- **Candlestick Patterns**: Engulfing, Doji, Hammer, Morning/Evening Star
- **Wave Patterns**: Elliott Wave, Wolfe Waves, Wedges
- **AI Confirmation**: Neural network validates pattern quality
- **Multi-Timeframe**: Scans across all timeframes simultaneously
- **Alert Integration**: Instant notifications when patterns complete

## Supported Patterns (30+)

### Reversal Patterns
- Head & Shoulders (regular & inverse)
- Double Top / Double Bottom
- Triple Top / Triple Bottom
- Rounding Top / Bottom
- Diamond Top / Bottom
- Island Reversal

### Continuation Patterns  
- Ascending / Descending Triangle
- Symmetrical Triangle
- Bull / Bear Flag
- Bull / Bear Pennant
- Rectangle / Channel
- Cup & Handle

### Harmonic Patterns
- Gartley (0.786 XA retracement)
- Butterfly (1.27 or 1.618 XA extension)
- Bat (0.886 XA retracement)
- Crab (1.618 XA extension)
- Shark (0.886 / 1.13)
- Cypher (0.786 / 1.272)
- ABCD Pattern

### Candlestick Patterns
- Bullish/Bearish Engulfing
- Morning Star / Evening Star
- Hammer / Hanging Man
- Doji Variants
- Three White Soldiers / Black Crows
- Piercing Line / Dark Cloud Cover

## Usage

```typescript
import { PatternRecognition } from 'kit-trading/skills/auto-pattern-recognition';

// Scan for all patterns
const patterns = await PatternRecognition.scan({
  symbol: 'BTCUSDT',
  timeframes: ['15m', '1h', '4h'],
  categories: ['reversal', 'harmonic', 'candlestick'],
  minQuality: 0.7, // 70% pattern quality threshold
});

// Subscribe to pattern alerts
PatternRecognition.onPattern('BTCUSDT', (pattern) => {
  console.log(`${pattern.type} detected on ${pattern.timeframe}`);
  console.log(`Quality: ${pattern.quality}%, Target: ${pattern.target}`);
});
```

## Configuration

```yaml
auto-pattern-recognition:
  scan_interval: 1m           # Frequency of pattern scans
  min_quality: 0.7            # Minimum pattern quality (0-1)
  ai_confirmation: true       # Use AI to validate patterns
  timeframes:
    - 15m
    - 1h  
    - 4h
    - 1d
  categories:
    - reversal
    - continuation
    - harmonic
    - candlestick
  alerts:
    enabled: true
    channels: [telegram, discord]
```

## Output

```json
{
  "patterns": [
    {
      "id": "pat_abc123",
      "symbol": "BTCUSDT",
      "timeframe": "4h",
      "type": "bullish_gartley",
      "category": "harmonic",
      "status": "forming", // forming | completed | failed
      "quality": 0.85,
      "aiConfidence": 0.78,
      "points": {
        "X": { "price": 42000, "time": "2026-02-10" },
        "A": { "price": 44500, "time": "2026-02-11" },
        "B": { "price": 42800, "time": "2026-02-12" },
        "C": { "price": 44100, "time": "2026-02-13" },
        "D": { "price": 42300, "time": "2026-02-14" }
      },
      "entry": 42300,
      "stopLoss": 41800,
      "targets": [43500, 44200, 45000],
      "riskReward": 2.4,
      "completionETA": "2026-02-14T16:00:00Z"
    }
  ]
}
```

## Inspired By

- TradingView Premium automated chart pattern recognition
- Harmonic Pattern detection algorithms
- AI-powered pattern validation systems
