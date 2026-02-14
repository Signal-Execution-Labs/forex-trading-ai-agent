# AI Narrative Engine

Generate human-readable market analysis narratives using AI. Transforms raw technical data into actionable insights.

## Features

- **Block Analysis**: Aggregate order flow and volume blocks
- **Volumetric Calculations**: Delta, CVD, imbalances
- **Trend Detection**: Multi-timeframe trend identification
- **AI Narrative**: Human-readable market situation summary
- **Trading Bias**: Clear directional bias with confidence
- **Key Levels**: Support/resistance with volume context

## Usage

```typescript
import { AInarrative } from 'kit-trading/skills/ai-narrative-engine';

const narrative = await AInarrative.analyze({
  symbol: 'BTCUSDT',
  timeframe: '1h',
  depth: 'detailed', // 'quick' | 'detailed' | 'comprehensive'
});

console.log(narrative.summary);
// "BTC is showing bullish momentum after a successful retest of the $42,500 
// support zone. Volume confirms buyer strength with a 2.3:1 buy/sell ratio.
// Key resistance at $44,200. Bias: LONG with 78% confidence."
```

## Configuration

```yaml
ai-narrative-engine:
  model: claude-opus-4-5-20251101  # AI model for narrative
  style: professional              # professional | casual | technical
  language: en                     # en | de | es | fr | zh | jp
  include:
    - trend_analysis
    - volume_context
    - key_levels
    - trading_bias
    - risk_factors
  update_interval: 5m              # Real-time updates
```

## Output Format

```json
{
  "symbol": "BTCUSDT",
  "timeframe": "1h",
  "timestamp": "2026-02-14T13:45:00Z",
  "summary": "Detailed market narrative...",
  "bias": "LONG",
  "confidence": 0.78,
  "keyLevels": {
    "support": [42500, 41800, 40000],
    "resistance": [44200, 45500, 48000]
  },
  "volumeContext": {
    "buyVolume": 1250000,
    "sellVolume": 543000,
    "ratio": 2.3,
    "trend": "accumulation"
  },
  "riskFactors": [
    "High funding rate (0.08%)",
    "Weekend low liquidity"
  ],
  "nextUpdate": "2026-02-14T13:50:00Z"
}
```

## Inspired By

- TradingView AI-style narrative indicators
- Block analysis and volumetric calculations
- Aggregated market context tools
