# Economic Dashboard

> **Skill #96** - Global economic data, indicators, and forecasts

## Overview

Comprehensive economic data dashboard covering 80+ countries with 400+ indicators. Track inflation, employment, GDP, interest rates, and trade data. Includes economic calendar with high-impact event tracking.

Inspired by TradingView's Economics section and Trading Economics.

## Features

- **400+ Economic Indicators:** CPI, GDP, unemployment, PMI, etc.
- **80+ Countries:** Major and emerging economies
- **Economic Calendar:** Scheduled releases with impact levels
- **Yield Curves:** Multi-country comparison
- **Heatmaps:** Global economic health at a glance
- **Forecasts:** AI-powered economic predictions
- **Correlation Analysis:** Economic data vs asset prices
- **Alerts:** Notify on releases and threshold breaches

## Usage

```bash
# View US economic dashboard
kit skill econ dashboard --country US

# Economic calendar (next 7 days)
kit skill econ calendar --days 7 --impact high

# Compare yield curves
kit skill econ yield-curve --countries US,DE,JP,GB

# CPI trend analysis
kit skill econ indicator --name CPI --country US --years 5

# Global heatmap
kit skill econ heatmap --indicator gdp_growth
```

## Configuration

```yaml
economic_dashboard:
  default_country: US
  calendar_timezone: "America/New_York"
  
  tracked_indicators:
    - CPI
    - Core CPI
    - PPI
    - GDP Growth
    - Unemployment Rate
    - Non-Farm Payrolls
    - PMI Manufacturing
    - PMI Services
    - Retail Sales
    - Consumer Confidence
    - Interest Rate
    - Trade Balance
  
  tracked_countries:
    - US
    - EU
    - GB
    - JP
    - CN
    - DE
    - AU
    - CA
  
  alert_thresholds:
    CPI_deviation: 0.2       # Alert if 0.2% off forecast
    GDP_deviation: 0.3
    NFP_deviation: 50000     # 50k jobs off forecast
```

## Economic Calendar

```json
{
  "calendar": [
    {
      "datetime": "2026-02-12T13:30:00Z",
      "country": "US",
      "indicator": "CPI YoY",
      "impact": "high",
      "previous": 2.9,
      "forecast": 2.8,
      "actual": null,
      "unit": "%"
    },
    {
      "datetime": "2026-02-14T13:30:00Z",
      "country": "US",
      "indicator": "Retail Sales MoM",
      "impact": "high",
      "previous": 0.4,
      "forecast": 0.3,
      "actual": null,
      "unit": "%"
    }
  ]
}
```

## Impact Levels

| Impact | Color | Description | Typical Volatility |
|--------|-------|-------------|-------------------|
| 🔴 High | Red | Major market mover | 50-200+ pips |
| 🟡 Medium | Yellow | Moderate impact | 20-50 pips |
| 🟢 Low | Green | Minor impact | < 20 pips |

## Key Indicators Reference

### Inflation
- **CPI:** Consumer Price Index (headline inflation)
- **Core CPI:** CPI excluding food & energy
- **PPI:** Producer Price Index (leading indicator)
- **PCE:** Personal Consumption Expenditure (Fed's preferred)

### Growth
- **GDP:** Gross Domestic Product (quarterly)
- **PMI:** Purchasing Managers Index (leading)
- **Industrial Production:** Manufacturing output

### Employment
- **NFP:** Non-Farm Payrolls (US jobs report)
- **Unemployment Rate:** Percentage unemployed
- **Jobless Claims:** Weekly filings

### Consumer
- **Retail Sales:** Consumer spending
- **Consumer Confidence:** Sentiment index

## Yield Curve Analysis

```json
{
  "country": "US",
  "date": "2026-02-12",
  "curve": {
    "1M": 5.25,
    "3M": 5.20,
    "6M": 5.05,
    "1Y": 4.80,
    "2Y": 4.45,
    "5Y": 4.20,
    "10Y": 4.35,
    "30Y": 4.55
  },
  "shape": "inverted",
  "2s10s_spread": -10,
  "interpretation": "Yield curve inverted. Historically precedes recession by 12-18 months."
}
```

## Trading Correlations

```yaml
correlations:
  CPI_higher_than_expected:
    USD: bullish
    bonds: bearish
    gold: bullish
    stocks: bearish
  
  NFP_higher_than_expected:
    USD: bullish
    bonds: bearish
    stocks: mixed
  
  Fed_rate_hike:
    USD: bullish
    bonds: bearish
    gold: bearish
    stocks: bearish (initially)
```

## Integration

- **Auto Trader:** Trade economic events
- **Alerts:** Notify on high-impact releases
- **Calendar:** Sync to trading calendar
- **News:** Combine with sentiment analysis
- **Strategy:** Avoid trading during high-impact events
