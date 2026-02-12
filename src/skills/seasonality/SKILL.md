# Seasonality Analyzer

> **Skill #93** - Discover annual patterns and time-based market cycles

## Overview

Track how assets perform during specific months, weeks, and days across multiple years. Identify recurring seasonal patterns like "Sell in May," tax-loss harvesting, Santa Rally, and crypto-specific cycles.

Inspired by TradingView's Seasonals feature.

## Features

- **Monthly Returns:** Average performance by month
- **Weekly Patterns:** Day-of-week effects
- **Holiday Analysis:** Performance around major holidays
- **Multi-Year Overlay:** Compare current year to historical average
- **Sector Rotation:** When does each sector outperform?
- **Crypto Cycles:** Halving cycles, altseason patterns
- **Custom Date Ranges:** Define your own seasonal windows

## Usage

```bash
# Monthly seasonality
kit skill seasonality --symbol SPY --years 10

# Weekly pattern
kit skill seasonality --symbol BTCUSDT --mode weekly

# Compare current year to average
kit skill seasonality --symbol AAPL --overlay current

# Sector rotation calendar
kit skill seasonality --mode sectors --years 5

# Crypto halving cycle
kit skill seasonality --symbol BTC --cycle halving
```

## Configuration

```yaml
seasonality:
  lookback_years: 10
  min_years: 3
  confidence_threshold: 65%
  
  known_patterns:
    - name: "January Effect"
      description: "Small caps outperform in January"
      months: [1]
      assets: ["IWM", "small_caps"]
    
    - name: "Sell in May"
      description: "Weak May-October period"
      months: [5, 6, 7, 8, 9, 10]
      bias: "bearish"
    
    - name: "Santa Rally"
      description: "Last 5 days + first 2 days"
      date_range: "Dec 25 - Jan 2"
      bias: "bullish"
    
    - name: "Tax Loss Harvesting"
      description: "Selling losers in December"
      months: [12]
      bias: "bearish for losers"
```

## Example Output

```json
{
  "symbol": "SPY",
  "years_analyzed": 10,
  "monthly_returns": {
    "January": { "avg": 1.2, "positive": 70, "confidence": "high" },
    "February": { "avg": -0.1, "positive": 50, "confidence": "low" },
    "March": { "avg": 1.5, "positive": 80, "confidence": "high" },
    "April": { "avg": 2.1, "positive": 80, "confidence": "high" },
    "May": { "avg": 0.3, "positive": 50, "confidence": "low" },
    "November": { "avg": 2.8, "positive": 90, "confidence": "very high" },
    "December": { "avg": 1.9, "positive": 80, "confidence": "high" }
  },
  "best_months": ["November", "April", "December"],
  "worst_months": ["September", "February", "May"],
  "current_month_forecast": {
    "month": "February",
    "historical_avg": -0.1,
    "current_return": 1.5,
    "deviation": "+1.6%"
  }
}
```

## Crypto-Specific Patterns

### Bitcoin Halving Cycle
```yaml
halving_cycle:
  phases:
    - name: "Pre-Halving"
      period: "-6 months to halving"
      typical: "Accumulation, 30-50% gains"
    
    - name: "Halving"
      period: "Event month"
      typical: "Choppy, uncertainty"
    
    - name: "Post-Halving Bull"
      period: "+6 to +18 months"
      typical: "Parabolic run, 300-500% gains"
    
    - name: "Peak & Correction"
      period: "+18 to +24 months"
      typical: "Blow-off top, 80% correction"
  
  history:
    - halving: "2012-11-28"
      peak: "2013-12-01"
      days_to_peak: 368
    - halving: "2016-07-09"
      peak: "2017-12-17"
      days_to_peak: 526
    - halving: "2020-05-11"
      peak: "2021-11-10"
      days_to_peak: 549
    - halving: "2024-04-20"
      peak: "TBD"
```

## Alerts

```bash
# Alert when entering bullish season
kit skill seasonality --symbol SPY --alert-enter "November"

# Alert when historical pattern breaks
kit skill seasonality --symbol BTCUSDT --alert-deviation 2
```

## Integration

- **Auto Trader:** Adjust position sizing based on seasonal bias
- **Portfolio:** Sector rotation based on monthly patterns
- **Research:** Backtest seasonal strategies
- **Calendar:** Mark seasonal entry/exit dates
