# Intrabar Analyzer

TradingView Pine Script v6 inspired intrabar data analysis.

## Features

- **Tick-Level Analysis** - Real volume distribution per tick
- **Multi-Timeframe Accuracy Levels**:
  - 1T (Tick): Most accurate
  - 1S (1 Second): Reasonably accurate  
  - 15S (15 Seconds): Good approximation
  - 1M (1 Minute): Rough approximation
- **Volume Profile from Ticks** - Actual traded volume at price levels
- **Intrabar Momentum** - Detect momentum shifts within bars
- **VWAP Precision** - True intrabar VWAP calculation

## Commands

```
kit intrabar <symbol> --level 1T
kit intrabar volume-profile <symbol> --bars 100
kit intrabar momentum <symbol> --sensitivity high
```

## Data Quality Notes

- Crypto/Forex: Best LTF data availability
- Stocks: Limited tick data depending on exchange
- Higher accuracy = shorter historical range
