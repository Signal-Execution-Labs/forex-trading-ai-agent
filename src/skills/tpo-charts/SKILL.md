# TPO Charts (Time Price Opportunity)

> **Skill #91** - Market Profile analysis with TPO visualization

## Overview

Time Price Opportunity charts display how much time price spends at each level, revealing value areas, POC (Point of Control), and institutional activity zones. Essential for understanding where "smart money" accumulates.

Inspired by TradingView's TPO/Market Profile feature.

## Features

- **TPO Letter Profiles:** Each letter = one time period at price level
- **Value Area:** Where 70% of trading activity occurs (VAH/VAL)
- **Point of Control (POC):** Most traded price level
- **Initial Balance:** First hour's range (key support/resistance)
- **Single Prints:** Low volume areas = potential breakout zones
- **Profile Shapes:** P, b, D, B-shape pattern recognition
- **Multi-Day Composite:** Merge profiles for longer-term analysis

## Usage

```bash
# Basic TPO chart
kit skill tpo --symbol ES --date today

# With value area
kit skill tpo --symbol NQ --show-value-area --period 30m

# Composite profile (5 days)
kit skill tpo --symbol BTCUSDT --composite 5d

# Profile shape detection
kit skill tpo --symbol EURUSD --detect-shapes
```

## Configuration

```yaml
tpo_charts:
  period: 30m           # Time per TPO letter
  value_area: 70        # % for value area calculation
  letters: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
  
  sessions:
    regular:
      start: "09:30"
      end: "16:00"
    extended:
      start: "04:00"
      end: "20:00"
  
  colors:
    poc: "#FFD700"        # Gold
    value_area: "#4169E1" # Royal Blue
    single_print: "#FF6B6B"
    initial_balance: "#90EE90"
```

## Profile Shapes & Meaning

| Shape | Pattern | Interpretation |
|-------|---------|----------------|
| **P** | Activity at top | Failed auction high, bearish |
| **b** | Activity at bottom | Failed auction low, bullish |
| **D** | Normal distribution | Balanced, range-bound |
| **B** | Double distribution | Two value areas, breakout pending |

## Example Output

```json
{
  "symbol": "ES",
  "date": "2026-02-12",
  "poc": 5245.50,
  "value_area": {
    "high": 5252.00,
    "low": 5238.00
  },
  "initial_balance": {
    "high": 5248.25,
    "low": 5241.75
  },
  "profile_shape": "b",
  "single_prints": [5234.00, 5255.50],
  "interpretation": "Failed auction low - bullish bias. Watch for move toward POC at 5245.50",
  "tpo_data": [
    {"price": 5250.00, "tpos": "ABCDEFG", "count": 7},
    {"price": 5248.00, "tpos": "ABCDEFGHIJ", "count": 10}
  ]
}
```

## Trading Strategies

### Value Area Trading
```yaml
strategy:
  name: "VA Fill"
  entry: "Price opens outside VA"
  target: "POC or opposite VA extreme"
  stop: "Beyond initial balance"
```

### Single Print Fade
```yaml
strategy:
  name: "Single Print Fill"
  entry: "Price approaches single print zone"
  logic: "Single prints get filled 80%+ of time"
  target: "Fill of single print area"
```

## Integration

- **Auto Trader:** Trade value area fills
- **Alerts:** Notify on IB breach, VA tests
- **Screener:** Find assets with specific profile shapes
- **Journal:** Log TPO setups and outcomes
