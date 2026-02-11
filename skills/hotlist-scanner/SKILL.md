# Hotlist Scanner Skill

**Category:** Analysis  
**Inspired by:** TradingView Hotlists, Finviz Screener, Stock Rover

## Overview

Real-time market hotlist scanner that identifies top movers, unusual activity, and trending assets across all markets. Like TradingView's built-in hotlists but with AI-powered insights.

## Features

### 1. Top Movers
- **Gainers**: Top 10/25/50 by % gain (1h, 4h, 24h, 7d)
- **Losers**: Top decliners by timeframe
- **Volume Leaders**: Highest volume relative to average
- **Volatility Spikes**: Assets with unusual ATR expansion
- **New Highs/Lows**: 52-week, all-time high/low breakers

### 2. Unusual Activity Detection
- Volume surge (>2x average)
- Price breakouts from consolidation
- Large order flow imbalance
- Options unusual activity (high put/call ratio)
- Whale accumulation signals

### 3. Sector Rotation
- Sector performance heatmap
- Relative strength by sector
- Money flow analysis
- Leading/lagging sector detection

### 4. Multi-Market Coverage
- **Crypto**: Top 500 by market cap
- **Forex**: Major, minor, exotic pairs
- **Stocks**: US, EU, Asia markets
- **Commodities**: Metals, energy, agriculture
- **Indices**: Global market indices

### 5. Custom Hotlists
- Create personalized criteria
- Combine multiple filters
- Save and share hotlists
- Alert on hotlist changes

## Commands

```
kit hotlist gainers --market crypto --timeframe 24h --limit 25
kit hotlist volume --threshold 3x --market stocks
kit hotlist breakouts --pattern consolidation --days 20
kit hotlist unusual --type whale --min-size 100000
kit hotlist sectors --sort momentum --timeframe 7d
kit hotlist create "My Scanner" --criteria "volume>2x AND rsi<30 AND macd_cross=bullish"
```

## Output Format

```json
{
  "hotlist": "Top Crypto Gainers 24h",
  "generated": "2026-02-11T21:35:00Z",
  "assets": [
    {
      "symbol": "XYZ/USDT",
      "price": 1.234,
      "change_24h": "+45.2%",
      "volume_24h": 125000000,
      "volume_ratio": 4.5,
      "market_cap": 890000000,
      "rank_change": "+15",
      "signals": ["volume_surge", "breakout", "whale_buy"],
      "kit_score": 85
    }
  ],
  "market_summary": {
    "total_scanned": 500,
    "avg_change": "+2.3%",
    "advancing": 312,
    "declining": 188,
    "sentiment": "bullish"
  }
}
```

## Integration

- Real-time WebSocket updates
- Push notifications for hotlist alerts
- Dashboard widget with live updates
- Export to CSV/Excel
- API endpoint for external tools

## K.I.T. Score

Each asset receives a K.I.T. Score (0-100) based on:
- Technical analysis alignment
- Volume confirmation
- Trend strength
- Risk/reward ratio
- AI sentiment analysis
