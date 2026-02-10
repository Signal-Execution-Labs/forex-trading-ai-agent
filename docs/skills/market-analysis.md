---
summary: "Market Analysis Skill - Technical and fundamental analysis"
read_when:
  - Understand market analysis
  - Use indicators
title: "Market Analysis"
---

# Market Analysis

The Market Analysis skill provides comprehensive technical and fundamental analysis for informed trading decisions.

## Quick Analysis

```bash
kit analyze BTC/USDT
```

Telegram:
```
"Analyze BTC"
"How does ETH look?"
```

Output:
```
📊 BTC/USDT Analysis
═══════════════════════════════════════
Price: $67,432.50 (+1.2% 24h)
24h Range: $66,100 - $68,200
Volume: $28.5B (+15% vs avg)

📈 TREND: Bullish
─────────────────────
• MA20: $66,500 ✅ (Price above)
• MA50: $64,200 ✅ (Price above)
• MA200: $52,400 ✅ (Price above)

📊 MOMENTUM
─────────────────────
• RSI(14): 58 🟡 Neutral
• MACD: +420 🟢 Bullish
• Stochastic: 65/72 🟡 Neutral

📉 VOLATILITY
─────────────────────
• BB: $64,500 - $70,500
• ATR(14): $1,200 (2.1%)

🎯 LEVELS
─────────────────────
Support: $65,000 | $63,500 | $61,000
Resistance: $68,500 | $70,000 | $72,500

💡 K.I.T. CONCLUSION
─────────────────────
🟢 Bullish Bias
Recommendation: Long on pullback to $66,000
Stop-Loss: $64,500 | Take-Profit: $70,000
```

## Technical Indicators

### Trend Indicators

```bash
kit indicators BTC/USDT --category trend
```

| Indicator | Description | Interpretation |
|-----------|-------------|----------------|
| SMA | Simple Moving Average | Trend direction |
| EMA | Exponential Moving Average | More reactive than SMA |
| MACD | Moving Average Convergence | Momentum + Trend |
| ADX | Average Directional Index | Trend strength |
| Parabolic SAR | Stop and Reverse | Trend + SL |

### Momentum Indicators

```bash
kit indicators BTC/USDT --category momentum
```

| Indicator | Description | Overbought | Oversold |
|-----------|-------------|------------|----------|
| RSI | Relative Strength Index | >70 | <30 |
| Stochastic | Stochastic Oscillator | >80 | <20 |
| CCI | Commodity Channel Index | >100 | <-100 |
| Williams %R | Williams Percent Range | >-20 | <-80 |

### Volatility Indicators

```bash
kit indicators BTC/USDT --category volatility
```

| Indicator | Description | Usage |
|-----------|-------------|-------|
| Bollinger Bands | Price channels | Breakouts, mean reversion |
| ATR | Average True Range | Stop-loss sizing |
| Keltner Channels | Volatility channels | Trend + volatility |

### Volume Indicators

```bash
kit indicators BTC/USDT --category volume
```

| Indicator | Description |
|-----------|-------------|
| OBV | On-Balance Volume |
| Volume Profile | Volume by price |
| VWAP | Volume Weighted Average Price |
| CMF | Chaikin Money Flow |

## Chart Patterns

```bash
kit patterns BTC/USDT
```

### Detected Patterns

```
📊 Chart Patterns - BTC/USDT
═══════════════════════════════════════
Active Patterns:

🔼 Ascending Triangle (4h)
   Since: 3 days
   Breakout Level: $68,500
   Target: $72,000
   Confidence: 75%

🕯️ Bullish Engulfing (1d)
   Ago: 2 candles
   Significance: High
   Confirmation: Wait for close above $67,500

📈 Higher Highs & Higher Lows
   Timeframe: Daily
   Trend: Upward
   Intact since: 14 days
```

### Candlestick Patterns

```bash
kit candles BTC/USDT
```

Detected patterns:
- **Bullish:** Hammer, Engulfing, Morning Star, Dragonfly Doji
- **Bearish:** Shooting Star, Engulfing, Evening Star, Gravestone Doji
- **Neutral:** Doji, Spinning Top, Harami

## Multi-Timeframe Analysis

```bash
kit analyze BTC/USDT --mtf
```

```
📊 Multi-Timeframe Analysis
═══════════════════════════════════════
         15m     1h      4h      1d
─────────────────────────────────────
Trend    🟢      🟢      🟢      🟢
RSI      62      58      55      52
MACD     🟢      🟢      🟢      🟡
Volume   High    Avg     Avg     High

Consensus: 🟢 Bullish (all timeframes aligned)
```

## Support & Resistance

```bash
kit levels BTC/USDT
```

```
📊 Support & Resistance Levels
═══════════════════════════════════════
        │
$72,500 │ ════════ R3 (Historical)
$70,000 │ ════════ R2 (Psychological)
$68,500 │ ════════ R1 (Current)
        │
$67,432 │ ★ PRICE
        │
$65,000 │ ════════ S1 (MA20)
$63,500 │ ════════ S2 (Previous Low)
$61,000 │ ════════ S3 (Strong)
        │

Strongest Levels:
• $70,000: Psychological + Fibonacci
• $65,000: MA20 + Previous Resistance
```

## Fundamental Analysis

```bash
kit fundamentals BTC
```

```
📊 BTC Fundamentals
═══════════════════════════════════════
On-Chain Metrics:
• Active Addresses: 1.2M (+5% vs avg)
• Hash Rate: 550 EH/s (ATH)
• Exchange Inflows: -15,000 BTC (Bullish)
• Whale Accumulation: +8,500 BTC (7d)

Market Metrics:
• Market Cap: $1.32T (#1)
• Dominance: 52.3%
• Fear & Greed: 65 (Greed)

Macro:
• Fed Rate Decision: In 5 days
• ETF Flows: +$500M (7d)
```

## Sentiment Analysis

```bash
kit sentiment BTC
```

```
📊 BTC Sentiment
═══════════════════════════════════════
Overall Score: 72/100 🟢 Bullish

Social Media:
• Twitter: 68/100 (Bullish)
• Reddit: 75/100 (Very Bullish)
• Telegram: 70/100 (Bullish)

News Sentiment:
• Positive: 65%
• Neutral: 25%
• Negative: 10%

Top Keywords:
• "ETF" (45 mentions)
• "Halving" (32 mentions)
• "Institutional" (28 mentions)
```

## Comparison Analysis

```bash
kit compare BTC ETH SOL
```

```
📊 Asset Comparison
═══════════════════════════════════════
         BTC        ETH        SOL
─────────────────────────────────────
7d       +5.2%      +8.1%      +12.3%
30d      +15.3%     +22.5%     +35.2%
RSI      58         62         71
Trend    🟢         🟢         🟡
Volume   Normal     High       V.High

Winner (7d): SOL +12.3%
Most Overbought: SOL (RSI 71)
```

## Custom Analysis

### Combine Custom Indicators

```bash
kit analyze BTC/USDT \
  --indicators "rsi,macd,bb" \
  --timeframe 4h \
  --periods 50
```

### Save Analysis

```bash
kit analyze BTC/USDT --save btc-analysis
kit analyze --load btc-analysis
```

## Configuration

```json
{
  "skills": {
    "market-analysis": {
      "defaultTimeframe": "4h",
      "defaultIndicators": ["rsi", "macd", "ema"],
      "patternsEnabled": true,
      "sentimentEnabled": true,
      "dataSource": "binance"
    }
  }
}
```

## Next Steps

<Columns>
  <Card title="Trading Tools" href="/concepts/trading-tools" icon="wrench">
    All available tools.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Alerts based on analysis.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Automatic strategies.
  </Card>
</Columns>
