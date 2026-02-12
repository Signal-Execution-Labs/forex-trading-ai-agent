# AI Score Engine

> **Skill #69** - Quant scoring system (0-100) for any asset

## Overview

AI-powered scoring engine that evaluates assets from 0-100 based on customizable rules. Combines technical, fundamental, and sentiment factors into a single actionable score.

Inspired by TradingView's AI trading concepts and quantitative factor models.

## Features

- **Multi-Factor Scoring:** Technical + Fundamental + Sentiment
- **Custom Rules:** Define your own scoring criteria
- **Real-Time Updates:** Continuous score recalculation
- **Batch Screening:** Score entire watchlists
- **Signal Generation:** Long/Short/Flat based on thresholds
- **Historical Tracking:** Score evolution over time

## Usage

```bash
# Score a single asset
kit skill ai-score --symbol BTC/USDT

# Score with custom model
kit skill ai-score --symbol ETH/USDT --model aggressive

# Batch scoring
kit skill ai-score --watchlist crypto_top_20 --sort desc
```

## Configuration

```yaml
ai_score_engine:
  weights:
    technical: 0.40
    momentum: 0.25
    sentiment: 0.20
    fundamental: 0.15
  
  thresholds:
    strong_buy: 80
    buy: 60
    neutral: 40
    sell: 20
    strong_sell: 0
  
  technical_factors:
    - trend_strength: 15%
    - rsi_position: 10%
    - macd_signal: 10%
    - volume_trend: 5%
  
  momentum_factors:
    - price_momentum: 10%
    - relative_strength: 10%
    - breakout_potential: 5%
  
  sentiment_factors:
    - social_sentiment: 10%
    - news_sentiment: 5%
    - fear_greed: 5%
```

## Score Interpretation

| Score | Rating | Signal | Color |
|-------|--------|--------|-------|
| 80-100 | Strong Buy | 🟢 LONG | Green |
| 60-79 | Buy | 🟢 LONG | Light Green |
| 40-59 | Neutral | ⚪ FLAT | Gray |
| 20-39 | Sell | 🔴 SHORT | Light Red |
| 0-19 | Strong Sell | 🔴 SHORT | Red |

## Example Output

```json
{
  "symbol": "BTC/USDT",
  "score": 73,
  "rating": "Buy",
  "signal": "LONG",
  "breakdown": {
    "technical": 82,
    "momentum": 68,
    "sentiment": 71,
    "fundamental": 65
  },
  "key_factors": [
    "Strong uptrend on 4H",
    "RSI recovering from oversold",
    "Social sentiment bullish",
    "Volume increasing"
  ],
  "confidence": 0.78,
  "last_update": "2026-02-12T05:22:00Z"
}
```

## Advanced Features

### Custom Models
Create your own scoring models for different strategies:

```yaml
models:
  conservative:
    weights:
      technical: 0.50
      fundamental: 0.30
      sentiment: 0.20
    min_score: 75
  
  aggressive:
    weights:
      momentum: 0.50
      technical: 0.30
      sentiment: 0.20
    min_score: 60
```

### Alert Integration
```bash
kit skill ai-score --symbol BTC/USDT --alert-above 80 --alert-below 30
```

## Integration

- **Auto Trader:** Execute based on score thresholds
- **Portfolio Manager:** Rebalance using scores
- **Screener:** Filter watchlists by score
- **Signals:** Publish high-score opportunities
