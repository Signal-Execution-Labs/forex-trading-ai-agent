# Heat Map Generator

Visual heat maps for market sectors and correlations.

## Overview
Generate TradingView-style heat maps showing relative performance, volume, and other metrics across multiple assets.

## Heat Map Types

### 1. Sector Heat Map
Performance by market sector:
- Crypto: DeFi, L1, L2, Memes, Gaming, AI
- Stocks: Tech, Healthcare, Finance, Energy, Consumer
- Forex: Majors, Minors, Exotics

### 2. Performance Heat Map
Color-coded by % change:
- Dark Green: > +5%
- Light Green: +2% to +5%
- Pale Green: 0% to +2%
- Pale Red: -2% to 0%
- Light Red: -5% to -2%
- Dark Red: < -5%

### 3. Volume Heat Map
Relative volume compared to average:
- High volume = larger boxes
- Low volume = smaller boxes

### 4. Correlation Heat Map
Asset correlation matrix (-1 to +1):
- Blue: Negative correlation
- White: No correlation
- Red: Positive correlation

### 5. Volatility Heat Map
ATR/IV percentile ranking:
- Hot (red): High volatility
- Cold (blue): Low volatility

## Features
- Real-time updates
- Customizable timeframes (1D, 1W, 1M, YTD)
- Drill-down to individual assets
- Export as image
- Embed in dashboard

## Configuration
```yaml
heatMap:
  type: "performance"
  timeframe: "1D"
  sectors: ["crypto", "forex", "stocks"]
  minMarketCap: 1000000000
  colorScheme: "greenRed"
  boxSizing: "market_cap"  # or "equal"
```

## Use Cases
- Quick market overview
- Sector rotation analysis
- Find outperforming assets
- Correlation-based hedging
