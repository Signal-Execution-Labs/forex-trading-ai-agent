---
name: market-regime-detector
description: "Detects market regime (trending/ranging/volatile) and adapts trading strategy recommendations"
metadata: { "kit": { "emoji": "🎯", "events": ["gateway:heartbeat", "trade:signal"], "category": "analysis" } }
---

# Market Regime Detector Hook

Analyzes price action to detect the current market regime and provides strategy recommendations.

## What It Does

- Monitors price data for configured symbols
- Detects 4 market regimes: **Trending Up**, **Trending Down**, **Ranging**, **Volatile**
- Uses ADX, ATR, and Bollinger Band width for regime classification
- Writes regime state to workspace for strategy adaptation
- Alerts on regime changes

## Regime Detection

| Regime | ADX | ATR/Price | BB Width | Characteristics |
|--------|-----|-----------|----------|-----------------|
| Trending Up | >25 | Any | Expanding | Strong directional move up |
| Trending Down | >25 | Any | Expanding | Strong directional move down |
| Ranging | <20 | Low | Narrow | Sideways consolidation |
| Volatile | Any | High | Wide | High volatility, no clear direction |

## Strategy Recommendations

- **Trending**: Enable trend-following strategies, disable mean reversion
- **Ranging**: Enable mean reversion, grid bots; disable breakout strategies
- **Volatile**: Reduce position sizes, widen stops, enable volatility strategies

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "market-regime-detector": {
          "enabled": true,
          "env": {
            "MRD_SYMBOLS": "BTC/USDT,ETH/USDT,ES",
            "MRD_TIMEFRAME": "1h",
            "MRD_ADX_THRESHOLD": "25",
            "MRD_ALERT_ON_CHANGE": "true"
          }
        }
      }
    }
  }
}
```

## Output Files

- `~/.kit/data/market-regimes.json` - Current regime state for all symbols
- `~/.kit/reports/regime-changes.log` - Historical regime change log
