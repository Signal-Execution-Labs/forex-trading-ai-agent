---
name: market-analysis
description: "Complete market analysis for Crypto, Forex, and Stocks with RSI, MACD, trends, and trading recommendations."
metadata:
  {
    "openclaw":
      {
        "emoji": "📈",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "ta", "pandas", "numpy", "requests"] }
      }
  }
---

# Market Analysis

Comprehensive technical analysis for all markets: Crypto, Forex, and Stocks.

## Quick Commands

### Full Weekly Analysis (All Markets)

```bash
python3 scripts/full_analysis.py --all
```

This analyzes:
- **Crypto**: BTC/USDT, ETH/USDT, SOL/USDT
- **Forex**: EUR/USD, GBP/USD, USD/JPY
- **Stocks**: AAPL, MSFT, GOOGL

### Crypto Only

```bash
python3 scripts/full_analysis.py --crypto
```

### Forex Only

```bash
python3 scripts/full_analysis.py --forex
```

### Stocks Only

```bash
python3 scripts/full_analysis.py --stocks
```

### Single Asset Analysis

```bash
python3 scripts/quick_analysis.py BTC/USDT
python3 scripts/quick_analysis.py ETH/USDT --timeframe 1h
```

## Output Example

```
============================================================
     K.I.T. WEEKLY MARKET ANALYSIS
     2026-02-15 20:30
============================================================

MARKET SENTIMENT: Fear & Greed Index = 45 (Fear)

------------------------------------------------------------
CRYPTO ANALYSIS
------------------------------------------------------------
  [+] BTC/USDT
      Price: $68,500.00
      RSI: 46.9 | MACD: Bullish | Trend: Down
      Outlook: NEUTRAL | Action: WAIT | Confidence: 60%

  [-] ETH/USDT
      Price: $1,939.00
      RSI: 42.1 | MACD: Bearish | Trend: Down
      Outlook: BEARISH | Action: SELL/AVOID | Confidence: 40%

------------------------------------------------------------
FOREX ANALYSIS
------------------------------------------------------------
  [+] EUR/USD
      Rate: 1.0850
      RSI: 52.3 | Trend: Ranging
      Outlook: NEUTRAL | Action: WAIT | Confidence: 60%

------------------------------------------------------------
STOCK ANALYSIS
------------------------------------------------------------
  [+] AAPL (Technology)
      Price: $185.50
      RSI: 48.2 | P/E: 28.5
      Outlook: NEUTRAL | Action: HOLD | Confidence: 60%

============================================================
SUMMARY
============================================================
  Bullish signals: 2
  Bearish signals: 3
  Overall market: BEARISH

TRADING RECOMMENDATIONS:
  - ETH/USDT: SELL/AVOID (Confidence: 40%)
```

## Indicators Used

| Indicator | Bullish | Bearish | Neutral |
|-----------|---------|---------|---------|
| RSI < 30 | +1 (Oversold) | | |
| RSI > 70 | | -1 (Overbought) | |
| RSI 30-70 | | | 0 |
| Price > SMA20 | +1 | | |
| Price > SMA50 | +1 | | |
| MACD > Signal | +1 | | |
| MACD < Signal | | -1 | |

## Score Interpretation

- **Score 3-4**: BULLISH - Consider buying
- **Score 2**: NEUTRAL - Wait for clearer signals
- **Score 0-1**: BEARISH - Consider selling or avoiding

## Risk Management

Always use:
- **Stop-Loss**: 2-3% below entry
- **Take-Profit**: 4-6% above entry
- **Position Size**: Max 10% of portfolio per trade
