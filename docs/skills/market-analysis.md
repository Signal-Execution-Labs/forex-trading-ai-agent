---
summary: "Market Analysis Skill - Technische und fundamentale Analyse"
read_when:
  - Marktanalyse verstehen
  - Indikatoren nutzen
title: "Market Analysis"
---

# Market Analysis

Der Market Analysis Skill bietet umfassende technische und fundamentale Analyse für informierte Trading-Entscheidungen.

## Quick Analysis

```bash
kit analyze BTC/USDT
```

Telegram:
```
"Analysiere BTC"
"Wie sieht ETH aus?"
```

Output:
```
📊 BTC/USDT Analyse
═══════════════════════════════════════
Preis: $67,432.50 (+1.2% 24h)
24h Range: $66,100 - $68,200
Volume: $28.5B (+15% vs avg)

📈 TREND: Bullish
─────────────────────
• MA20: $66,500 ✅ (Preis drüber)
• MA50: $64,200 ✅ (Preis drüber)
• MA200: $52,400 ✅ (Preis drüber)

📊 MOMENTUM
─────────────────────
• RSI(14): 58 🟡 Neutral
• MACD: +420 🟢 Bullish
• Stochastic: 65/72 🟡 Neutral

📉 VOLATILITÄT
─────────────────────
• BB: $64,500 - $70,500
• ATR(14): $1,200 (2.1%)

🎯 LEVELS
─────────────────────
Support: $65,000 | $63,500 | $61,000
Resistance: $68,500 | $70,000 | $72,500

💡 K.I.T. FAZIT
─────────────────────
🟢 Bullish Bias
Empfehlung: Long bei Pullback zu $66,000
Stop-Loss: $64,500 | Take-Profit: $70,000
```

## Technische Indikatoren

### Trend-Indikatoren

```bash
kit indicators BTC/USDT --category trend
```

| Indikator | Beschreibung | Interpretation |
|-----------|--------------|----------------|
| SMA | Simple Moving Average | Trend-Richtung |
| EMA | Exponential Moving Average | Reaktiver als SMA |
| MACD | Moving Average Convergence | Momentum + Trend |
| ADX | Average Directional Index | Trendstärke |
| Parabolic SAR | Stop and Reverse | Trend + SL |

### Momentum-Indikatoren

```bash
kit indicators BTC/USDT --category momentum
```

| Indikator | Beschreibung | Überkauft | Überverkauft |
|-----------|--------------|-----------|--------------|
| RSI | Relative Strength Index | >70 | <30 |
| Stochastic | Stochastic Oscillator | >80 | <20 |
| CCI | Commodity Channel Index | >100 | <-100 |
| Williams %R | Williams Percent Range | >-20 | <-80 |

### Volatilitäts-Indikatoren

```bash
kit indicators BTC/USDT --category volatility
```

| Indikator | Beschreibung | Verwendung |
|-----------|--------------|------------|
| Bollinger Bands | Preis-Kanäle | Breakouts, Mean-Reversion |
| ATR | Average True Range | Stop-Loss Sizing |
| Keltner Channels | Volatilitäts-Kanäle | Trend + Volatilität |

### Volumen-Indikatoren

```bash
kit indicators BTC/USDT --category volume
```

| Indikator | Beschreibung |
|-----------|--------------|
| OBV | On-Balance Volume |
| Volume Profile | Volumen nach Preis |
| VWAP | Volume Weighted Average Price |
| CMF | Chaikin Money Flow |

## Chart-Patterns

```bash
kit patterns BTC/USDT
```

### Erkannte Patterns

```
📊 Chart Patterns - BTC/USDT
═══════════════════════════════════════
Aktive Patterns:

🔼 Ascending Triangle (4h)
   Seit: 3 Tagen
   Breakout-Level: $68,500
   Target: $72,000
   Konfidenz: 75%

🕯️ Bullish Engulfing (1d)
   Vor: 2 Kerzen
   Signifikanz: Hoch
   Bestätigung: Warten auf Close über $67,500

📈 Higher Highs & Higher Lows
   Timeframe: Daily
   Trend: Aufwärts
   Intakt seit: 14 Tagen
```

### Candlestick-Patterns

```bash
kit candles BTC/USDT
```

Erkannte Patterns:
- **Bullish:** Hammer, Engulfing, Morning Star, Dragonfly Doji
- **Bearish:** Shooting Star, Engulfing, Evening Star, Gravestone Doji
- **Neutral:** Doji, Spinning Top, Harami

## Multi-Timeframe Analyse

```bash
kit analyze BTC/USDT --mtf
```

```
📊 Multi-Timeframe Analyse
═══════════════════════════════════════
         15m     1h      4h      1d
─────────────────────────────────────
Trend    🟢      🟢      🟢      🟢
RSI      62      58      55      52
MACD     🟢      🟢      🟢      🟡
Volume   High    Avg     Avg     High

Konsens: 🟢 Bullish (alle Timeframes aligned)
```

## Support & Resistance

```bash
kit levels BTC/USDT
```

```
📊 Support & Resistance Levels
═══════════════════════════════════════
        │
$72,500 │ ════════ R3 (Historisch)
$70,000 │ ════════ R2 (Psychologisch)
$68,500 │ ════════ R1 (Aktuell)
        │
$67,432 │ ★ PREIS
        │
$65,000 │ ════════ S1 (MA20)
$63,500 │ ════════ S2 (Vorheriges Low)
$61,000 │ ════════ S3 (Stark)
        │

Stärkste Levels:
• $70,000: Psychologisch + Fibonacci
• $65,000: MA20 + Previous Resistance
```

## Fundamentale Analyse

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
• Fed Rate Decision: In 5 Tagen
• ETF Flows: +$500M (7d)
```

## Sentiment-Analyse

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

## Vergleichsanalyse

```bash
kit compare BTC ETH SOL
```

```
📊 Asset Vergleich
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

### Eigene Indikatoren kombinieren

```bash
kit analyze BTC/USDT \
  --indicators "rsi,macd,bb" \
  --timeframe 4h \
  --periods 50
```

### Analyse speichern

```bash
kit analyze BTC/USDT --save btc-analysis
kit analyze --load btc-analysis
```

## Konfiguration

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

## Nächste Schritte

<Columns>
  <Card title="Trading-Tools" href="/concepts/trading-tools" icon="wrench">
    Alle verfügbaren Tools.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Alerts basierend auf Analyse.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Automatische Strategien.
  </Card>
</Columns>
