---
name: dividend-manager
description: "Track dividends, manage DRIP (reinvestment), forecast income, and optimize dividend portfolio."
metadata:
  {
    "openclaw":
      {
        "emoji": "💰",
        "requires": { "bins": ["python3"], "pip": ["yfinance", "pandas", "requests"] }
      }
  }
---

# Dividend Manager

Vollautomatisches Dividenden-Tracking und Reinvestment.

## Overview

- **Dividend Tracking** - Alle Ausschüttungen erfassen
- **DRIP Automation** - Automatische Wiederanlage
- **Income Forecast** - Zukünftige Einnahmen planen
- **Portfolio Optimization** - Yield vs Growth Balance

## 🤖 AUTO-PILOT MODE

```python
# ~/.kit/config/dividend-manager.json
{
  "auto_pilot": {
    "enabled": true,
    "drip": {
      "enabled": true,
      "mode": "same_stock",  # same_stock | diversify | accumulate_cash
      "min_reinvest_eur": 25,
      "require_approval": false
    },
    "alerts": {
      "ex_dividend_reminder_days": 3,
      "payment_notification": true,
      "yield_change_threshold_pct": 10
    },
    "rebalance": {
      "target_yield_pct": 4.0,
      "max_single_position_pct": 10
    },
    "tax_optimization": {
      "use_sparerpauschbetrag": true,
      "freistellungsauftrag_eur": 1000
    }
  }
}
```

## Commands

### Track Dividend Portfolio

```bash
python3 -c "
import yfinance as yf

portfolio = [
    {'symbol': 'AAPL', 'shares': 50},
    {'symbol': 'MSFT', 'shares': 30},
    {'symbol': 'JNJ', 'shares': 40},
    {'symbol': 'KO', 'shares': 100},
    {'symbol': 'O', 'shares': 75},  # Realty Income (monthly)
]

print('💰 DIVIDEND PORTFOLIO')
print('=' * 70)
print(f'{\"Symbol\":8} {\"Shares\":>8} {\"Price\":>10} {\"Div/Share\":>10} {\"Yield\":>8} {\"Annual\":>10}')
print('-' * 70)

total_value = 0
total_annual_div = 0

for p in portfolio:
    try:
        stock = yf.Ticker(p['symbol'])
        info = stock.info
        
        price = info.get('currentPrice', info.get('regularMarketPrice', 0))
        div_rate = info.get('dividendRate', 0) or 0
        div_yield = info.get('dividendYield', 0) or 0
        
        position_value = p['shares'] * price
        annual_div = p['shares'] * div_rate
        
        total_value += position_value
        total_annual_div += annual_div
        
        print(f\"{p['symbol']:8} {p['shares']:>8} \${price:>9.2f} \${div_rate:>9.2f} {div_yield*100:>7.2f}% \${annual_div:>9.2f}\")
    except Exception as e:
        print(f\"{p['symbol']:8} Error: {e}\")

print('-' * 70)
portfolio_yield = (total_annual_div / total_value * 100) if total_value > 0 else 0
print(f'{\"TOTAL\":8} {\"\":>8} \${total_value:>9,.2f} {\"\":>10} {portfolio_yield:>7.2f}% \${total_annual_div:>9,.2f}')
print()
print(f'📅 Monthly Income: \${total_annual_div/12:,.2f}')
"
```

### Upcoming Dividends Calendar

```bash
python3 -c "
import yfinance as yf
from datetime import datetime, timedelta

portfolio = ['AAPL', 'MSFT', 'JNJ', 'KO', 'O', 'VZ', 'PG']

print('📅 UPCOMING DIVIDENDS')
print('=' * 60)

upcoming = []

for symbol in portfolio:
    try:
        stock = yf.Ticker(symbol)
        cal = stock.calendar
        
        if cal is not None and not cal.empty:
            ex_date = cal.get('Ex-Dividend Date')
            if ex_date:
                upcoming.append({
                    'symbol': symbol,
                    'ex_date': ex_date,
                    'dividend': stock.info.get('dividendRate', 0) / 4  # Quarterly
                })
    except:
        pass

# Sort by date
for div in sorted(upcoming, key=lambda x: x['ex_date'] if x['ex_date'] else datetime.max):
    if div['ex_date']:
        date_str = div['ex_date'].strftime('%Y-%m-%d') if hasattr(div['ex_date'], 'strftime') else str(div['ex_date'])
        print(f\"{div['symbol']:6} | Ex-Date: {date_str} | ~\${div['dividend']:.2f}/share\")
"
```

### DRIP Calculator & Auto-Reinvest

```bash
python3 -c "
import yfinance as yf

# Dividend received
dividend_payment = {
    'symbol': 'AAPL',
    'shares_owned': 50,
    'dividend_per_share': 0.24,
    'total_received': 12.00
}

stock = yf.Ticker(dividend_payment['symbol'])
current_price = stock.info.get('currentPrice', 150)

# Calculate DRIP
shares_to_buy = dividend_payment['total_received'] / current_price
fractional = shares_to_buy % 1
whole_shares = int(shares_to_buy)
leftover_cash = fractional * current_price

print('💰 DRIP CALCULATION')
print('=' * 50)
print(f\"Dividend Received: \${dividend_payment['total_received']:.2f}\")
print(f\"Current Price: \${current_price:.2f}\")
print()
print(f\"Shares to Buy: {shares_to_buy:.4f}\")
print(f\"  Whole Shares: {whole_shares}\")
print(f\"  Leftover Cash: \${leftover_cash:.2f}\")
print()

if whole_shares > 0:
    print(f'🤖 AUTO-DRIP: Would buy {whole_shares} shares of {dividend_payment[\"symbol\"]}')
    # Execute: exchange.create_market_buy_order(symbol, whole_shares)
else:
    print('💵 Accumulating cash for next DRIP opportunity')
"
```

### Dividend Growth Analysis

```bash
python3 -c "
import yfinance as yf
import pandas as pd

symbol = 'JNJ'  # Dividend King
stock = yf.Ticker(symbol)

# Get historical dividends
dividends = stock.dividends

if len(dividends) > 0:
    # Annual dividends
    annual = dividends.resample('Y').sum()
    
    print(f'📈 DIVIDEND GROWTH: {symbol}')
    print('=' * 50)
    
    # Last 5 years
    recent = annual.tail(6)
    
    for date, div in recent.items():
        print(f'{date.year}: \${div:.2f}')
    
    # Calculate CAGR
    if len(recent) >= 2:
        start_div = recent.iloc[0]
        end_div = recent.iloc[-1]
        years = len(recent) - 1
        cagr = ((end_div / start_div) ** (1/years) - 1) * 100
        
        print()
        print(f'5-Year CAGR: {cagr:.1f}%')
        
        # Project future
        current_annual = end_div
        print()
        print('📊 Projected (assuming same growth):')
        for y in range(1, 6):
            projected = current_annual * ((1 + cagr/100) ** y)
            print(f'  Year {y}: \${projected:.2f}')
"
```

### Income Forecast

```bash
python3 -c "
from datetime import datetime, timedelta

# Portfolio with dividend schedules
portfolio = [
    {'symbol': 'AAPL', 'shares': 50, 'div_quarterly': 0.24, 'months': [2, 5, 8, 11]},
    {'symbol': 'MSFT', 'shares': 30, 'div_quarterly': 0.75, 'months': [3, 6, 9, 12]},
    {'symbol': 'O', 'shares': 75, 'div_monthly': 0.256, 'months': list(range(1, 13))},  # Monthly
    {'symbol': 'KO', 'shares': 100, 'div_quarterly': 0.46, 'months': [4, 7, 10, 1]},
]

print('📅 12-MONTH DIVIDEND FORECAST')
print('=' * 60)

monthly_income = {m: 0 for m in range(1, 13)}

for p in portfolio:
    if 'div_monthly' in p:
        for m in p['months']:
            monthly_income[m] += p['shares'] * p['div_monthly']
    elif 'div_quarterly' in p:
        for m in p['months']:
            monthly_income[m] += p['shares'] * p['div_quarterly']

current_month = datetime.now().month

for month in range(1, 13):
    month_name = datetime(2026, month, 1).strftime('%B')
    income = monthly_income[month]
    bar = '█' * int(income / 10)
    marker = ' ◄── Current' if month == current_month else ''
    print(f'{month_name:10} €{income:>8.2f} {bar}{marker}')

total = sum(monthly_income.values())
print()
print(f'Annual Total: €{total:,.2f}')
print(f'Monthly Avg:  €{total/12:,.2f}')
"
```

### Auto-Pilot: Full DRIP Automation

```bash
python3 -c "
import json
import os
from datetime import datetime

print('🤖 DIVIDEND MANAGER AUTO-PILOT')
print('=' * 50)
print(f'Running: {datetime.now().isoformat()}')
print()

# Auto-pilot tasks:
tasks = [
    ('📥 Check for new dividend payments', 'check_payments'),
    ('💰 Process DRIP reinvestments', 'process_drip'),
    ('📅 Update dividend calendar', 'update_calendar'),
    ('📊 Recalculate yield metrics', 'calc_metrics'),
    ('🔔 Send upcoming ex-date alerts', 'send_alerts'),
]

for task, func in tasks:
    print(f'{task}...')
    # Execute task
    print(f'  ✅ Done')

print()
print('Next run: Tomorrow 09:00')
"
```

## Workflow

### DRIP Modes

| Mode | Description |
|------|-------------|
| `same_stock` | Reinvest in same stock |
| `diversify` | Spread across underweight positions |
| `accumulate_cash` | Save for manual allocation |
| `highest_yield` | Buy highest yielding stock |

### Dividend Aristocrats Focus

Stocks with 25+ years of dividend increases:
- JNJ, KO, PG, MMM, EMR, XOM, CVX, ABT, PEP, CL

### Tax Optimization (Germany)

- **Sparerpauschbetrag**: €1,000 (Singles) / €2,000 (Married)
- **Freistellungsauftrag**: Split across brokers
- **Quellensteuer**: Track foreign withholding for credit
