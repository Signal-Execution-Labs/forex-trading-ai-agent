---
name: performance-report
description: Generate comprehensive trading performance reports. Daily, weekly, monthly analytics with P&L, win rate, and insights.
metadata:
  {
    "kit":
      {
        "emoji": "📊",
        "category": "analytics",
        "tier": "standard",
        "triggers": [
          "performance", "report", "performance report", "pnl report",
          "weekly report", "monthly report", "daily report",
          "trading stats", "analytics", "how am i doing",
          "my stats", "win rate", "trade history"
        ]
      }
  }
---

# 📊 Performance Report

**Track your trading performance.** Generate detailed daily, weekly, and monthly reports with P&L analysis, win rates, best/worst trades, and actionable insights.

## Features

### 📈 P&L Analysis
- Realized vs unrealized P&L
- P&L by asset, strategy, timeframe
- Fee impact analysis
- Cumulative returns chart

### 🎯 Trade Statistics
- Win rate and profit factor
- Average win vs average loss
- Expectancy calculation
- Risk/reward analysis

### 📅 Time-Based Reports
- Daily summary
- Weekly performance review
- Monthly deep-dive
- Quarterly/annual reports

### 💡 Insights & Recommendations
- Best performing assets
- Optimal trading hours
- Strategy effectiveness
- Areas for improvement

## Usage

```bash
# Daily summary
kit report daily

# Weekly report
kit report weekly

# Monthly report
kit report monthly

# Custom period
kit report --from 2024-01-01 --to 2024-01-31

# Export to PDF
kit report monthly --export pdf

# Specific asset analysis
kit report --asset BTC
```

## CLI Output

```
📊 K.I.T. Weekly Performance Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period: Feb 3 - Feb 9, 2026
Generated: Feb 9, 2026 22:00

💰 P&L SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Starting Balance:   $43,500.00
Ending Balance:     $45,231.50
Net P&L:            +$1,731.50 (+3.98%)

Realized P&L:       +$1,456.78 (+3.35%)
Unrealized P&L:     +$274.72 (+0.61%)
Fees Paid:          -$89.50

📈 TRADING ACTIVITY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Trades:       23
Winning Trades:     15 (65.2%)
Losing Trades:      8 (34.8%)
Win Rate:           65.2% ✅

Average Win:        +$156.78
Average Loss:       -$89.23
Profit Factor:      2.63 ✅
Expectancy:         +$75.28/trade

🏆 TOP PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. BTC/USDT Long    +$523.40 (+4.2%)
2. ETH/USDT Long    +$312.56 (+3.8%)
3. SOL/USDT Long    +$178.90 (+2.1%)

📉 WORST TRADES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. AVAX/USDT Short  -$156.78 (-3.2%)
2. LINK/USDT Long   -$89.23 (-1.8%)

📊 BY ASSET
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BTC:  +$856.90 (12 trades, 75% win)
ETH:  +$534.20 (6 trades, 67% win)
SOL:  +$289.45 (3 trades, 67% win)
Other: +$50.95 (2 trades, 50% win)

💡 INSIGHTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Strong week - outperformed targets
✅ BTC trades particularly profitable
⚠️ Shorts underperformed - review strategy
💡 Best trading hours: 14:00-18:00 UTC
💡 Consider increasing BTC allocation

"Another profitable week. Keep this up!"
   - K.I.T.
```

## Configuration

```yaml
# TOOLS.md
performance_report:
  # Report schedule
  auto_reports:
    daily: "08:00"     # Daily at 8 AM
    weekly: "Mon 09:00" # Monday 9 AM
    monthly: "1 09:00"  # 1st of month 9 AM
    
  # Delivery
  delivery:
    telegram: true
    email: false
    discord: false
    
  # Export options
  export:
    format: "markdown"  # markdown, html, pdf
    include_charts: true
    
  # Metrics to include
  metrics:
    - pnl_summary
    - trade_statistics
    - top_performers
    - worst_trades
    - asset_breakdown
    - time_analysis
    - insights
    
  # Benchmarks
  benchmarks:
    - BTC
    - SPY
```

## API

```python
from performance_report import PerformanceReporter

reporter = PerformanceReporter()

# Generate weekly report
report = await reporter.generate(
    period="weekly",
    include_charts=True
)

print(report.summary)
print(f"Net P&L: ${report.net_pnl:+,.2f}")
print(f"Win Rate: {report.win_rate:.1%}")

# Custom period
report = await reporter.generate(
    start_date="2024-01-01",
    end_date="2024-01-31"
)

# Export to file
await reporter.export(report, format="pdf", path="./reports/")

# Get specific metrics
metrics = await reporter.get_metrics(period="monthly")
print(f"Profit Factor: {metrics.profit_factor:.2f}")
print(f"Expectancy: ${metrics.expectancy:.2f}")
```

## Report Types

### Daily Report
- Quick summary of today's activity
- Open positions update
- P&L for the day
- Key market events

### Weekly Report
- Full week P&L breakdown
- Trade-by-trade analysis
- Asset performance comparison
- Strategy effectiveness
- Week-over-week comparison

### Monthly Report
- Comprehensive monthly review
- Detailed statistics
- Performance vs benchmarks
- Strategy deep-dive
- Tax-relevant summary
- Recommendations for next month

### Annual Report
- Year in review
- Total returns
- Tax summary
- Goal progress
- Strategy evolution
- Next year planning

## Dependencies
- pandas>=2.0.0
- matplotlib>=3.7.0 (optional, for charts)
- jinja2>=3.0.0 (for HTML export)
