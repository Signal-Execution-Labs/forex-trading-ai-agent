# Pattern Recognition Pro

Advanced chart pattern detection with AI confirmation.

## Overview
Automatically detect and classify chart patterns using both classical rules and AI/ML models.

## Pattern Categories

### Classic Patterns
**Reversal:**
- Head & Shoulders / Inverse H&S
- Double Top / Double Bottom
- Triple Top / Triple Bottom
- Rounding Top / Rounding Bottom
- Rising/Falling Wedge (reversal context)

**Continuation:**
- Bull/Bear Flag
- Bull/Bear Pennant
- Rectangle/Range
- Ascending/Descending Triangle
- Symmetrical Triangle
- Cup and Handle

### Candlestick Patterns
**Bullish:**
- Hammer, Inverted Hammer
- Morning Star, Bullish Engulfing
- Three White Soldiers
- Piercing Line, Doji Star

**Bearish:**
- Shooting Star, Hanging Man
- Evening Star, Bearish Engulfing
- Three Black Crows
- Dark Cloud Cover

### Harmonic Patterns
- Gartley, Bat, Butterfly
- Crab, Shark, Cypher
- ABCD, Three Drives

## AI Enhancement
- Pattern probability scoring (0-100%)
- False pattern filtering
- Historical success rate lookup
- Multi-timeframe confirmation
- Similar pattern matching from history

## Configuration
```yaml
patternPro:
  categories: ["classic", "candlestick", "harmonic"]
  minConfidence: 70
  useAI: true
  alertOnFormation: true
  alertOnCompletion: true
  showTargets: true
  showInvalidation: true
```

## Output
- Pattern type and direction
- Entry, stop loss, take profit levels
- Risk/reward ratio
- Historical win rate
- Confidence score
- Invalidation level

## Alerts
- Pattern forming (early warning)
- Pattern confirmed
- Pattern target hit
- Pattern invalidated
