# Fear & Greed Index

Multi-factor sentiment indicator for market timing.

## Overview
Combine multiple sentiment signals into a single 0-100 score. Contrarian indicator: extreme fear = buying opportunity, extreme greed = selling opportunity.

## Index Components

### 1. Volatility (25%)
```
VIX / Crypto Volatility Index
├── Low Vol (<15): Greed
├── Normal (15-25): Neutral
└── High Vol (>25): Fear

Current: 32 → Fear (-20 points)
```

### 2. Market Momentum (25%)
```
Price vs Moving Averages
├── Above 200 SMA: Greed
├── Between 50-200: Neutral
└── Below 50 SMA: Fear

Current: Above 200 SMA → Greed (+20 points)
```

### 3. Social Sentiment (15%)
```
Twitter/Reddit Analysis
├── Bullish mentions >60%: Greed
├── Mixed (40-60%): Neutral
└── Bearish >60%: Fear

Current: 72% bullish → Extreme Greed (+15 points)
```

### 4. Dominance (10%)
```
BTC Dominance
├── Rising + BTC up: Greed
├── Stable: Neutral
└── Rising + BTC down: Fear (flight to safety)

Current: 48% stable → Neutral (0 points)
```

### 5. Volume (10%)
```
Trading Volume vs Average
├── 2x above avg: Extreme (direction matters)
├── Normal range: Neutral
└── Below average: Caution

Current: 1.3x average → Slight Greed (+5 points)
```

### 6. Options Put/Call (10%)
```
Put/Call Ratio
├── <0.7: Extreme Greed
├── 0.7-1.0: Neutral
└── >1.0: Fear

Current: 0.65 → Greed (+8 points)
```

### 7. Google Trends (5%)
```
Search Interest
├── "Buy Bitcoin" trending: Retail FOMO
├── "Bitcoin dead" trending: Capitulation
└── Normal: Neutral

Current: "Buy crypto" +40% → Greed (+4 points)
```

## Score Interpretation
```
Fear & Greed Index: 67 (GREED)

0-25:   Extreme Fear   🟢 BUY zone
26-45:  Fear           🟢 Accumulate
46-55:  Neutral        ⚪ Hold
56-75:  Greed          🟡 Caution
76-100: Extreme Greed  🔴 Take profits

Historical accuracy:
- Buying at <25: 78% profitable (1 year)
- Selling at >75: 71% avoided drawdown
```

## Historical Data
```
Fear & Greed Timeline:
     100 ┤                   ╭──╮
         │                ╭──╯  ╰──
      75 ┤        ╭───────╯
         │    ╭───╯
      50 ┤────╯
         │╭──╯
      25 ┤╯
         └────────────────────────
          Nov  Dec  Jan  Feb

Notable Points:
- Nov 15: 18 (Extreme Fear) → +45% in 30d
- Jan 20: 92 (Extreme Greed) → -22% in 14d
```

## Multi-Asset Support
```
Asset-Specific Indexes:
├── Crypto F&G: 67 (Greed)
├── Stock Market: 58 (Greed)
├── Forex USD: 45 (Neutral)
├── Gold: 52 (Neutral)
└── DeFi: 71 (Greed)
```

## Trading Strategy
```yaml
strategy: fear_greed_contrarian
  
rules:
  - condition: index < 20
    action: buy
    size: 30% of dry powder
    
  - condition: index < 35
    action: buy
    size: 15% of dry powder
    
  - condition: index > 80
    action: sell
    size: 25% of position
    
  - condition: index > 90
    action: sell
    size: 40% of position
```

## Alerts
```yaml
alerts:
  extreme_fear: true    # Index < 20
  extreme_greed: true   # Index > 80
  daily_report: true    # Daily summary
  trend_change: true    # Crosses 50
```

## Commands
```bash
kit fear-greed current
kit fear-greed history --days 90
kit fear-greed breakdown   # Show all components
kit fear-greed alert --extreme-only
kit fear-greed compare --assets btc,eth,stocks
```
