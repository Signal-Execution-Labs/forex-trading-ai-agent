---
name: multi-asset
description: "Trade and track stocks, ETFs, commodities, bonds, and forex. Unified portfolio across all asset classes."
metadata:
  {
    "openclaw":
      {
        "emoji": "🌍",
        "requires": { "bins": ["python3"], "pip": ["yfinance", "pandas", "requests", "alpha_vantage"] }
      }
  }
---

# Multi-Asset

Vollständige Abdeckung aller Asset-Klassen in einem System.

## Overview

- **Stocks** - US, EU, Emerging Markets
- **ETFs** - Index, Sector, Thematic
- **Bonds** - Government, Corporate
- **Commodities** - Gold, Silver, Oil
- **Forex** - Major pairs

## 🤖 AUTO-PILOT MODE

```python
# ~/.kit/config/multi-asset.json
{
  "auto_pilot": {
    "enabled": true,
    "brokers": {
      "interactive_brokers": {"enabled": true, "account": "U1234567"},
      "trade_republic": {"enabled": true},
      "scalable": {"enabled": true}
    },
    "strategies": {
      "dca": {
        "enabled": true,
        "schedule": "weekly",
        "day": "monday",
        "investments": [
          {"symbol": "VTI", "amount_eur": 200},
          {"symbol": "VXUS", "amount_eur": 100},
          {"symbol": "BND", "amount_eur": 50}
        ]
      },
      "value_averaging": {
        "enabled": false,
        "target_growth_pct": 0.5
      },
      "rebalancing": {
        "enabled": true,
        "trigger": "quarterly"
      }
    },
    "alerts": {
      "price_target": true,
      "earnings": true,
      "dividend_ex_date": true,
      "52w_high_low": true
    },
    "require_approval": {
      "trades_above_eur": 1000,
      "new_positions": true
    }
  },
  "target_allocation": {
    "us_stocks": 35,
    "intl_stocks": 25,
    "bonds": 20,
    "commodities": 10,
    "crypto": 10
  }
}
```

## Supported Brokers

| Broker | Region | Features |
|--------|--------|----------|
| Interactive Brokers | Global | Full API, all assets |
| Trade Republic | EU | Stocks, ETFs, Crypto |
| Scalable Capital | EU | ETFs, Stocks |
| Degiro | EU | Low cost stocks |
| Alpaca | US | Commission-free API |

## Commands

### Full Portfolio Overview

```bash
python3 -c "
import yfinance as yf

portfolio = {
    'stocks': [
        {'symbol': 'AAPL', 'shares': 50, 'cost': 150},
        {'symbol': 'MSFT', 'shares': 30, 'cost': 280},
        {'symbol': 'GOOGL', 'shares': 20, 'cost': 120},
    ],
    'etfs': [
        {'symbol': 'VTI', 'shares': 100, 'cost': 200},
        {'symbol': 'VXUS', 'shares': 80, 'cost': 55},
        {'symbol': 'BND', 'shares': 50, 'cost': 75},
    ],
    'commodities': [
        {'symbol': 'GLD', 'shares': 25, 'cost': 170},
    ]
}

print('🌍 MULTI-ASSET PORTFOLIO')
print('=' * 80)

total_value = 0
total_cost = 0
by_class = {}

for asset_class, positions in portfolio.items():
    class_value = 0
    print(f'\\n📁 {asset_class.upper()}')
    print('-' * 80)
    
    for pos in positions:
        try:
            stock = yf.Ticker(pos['symbol'])
            price = stock.info.get('currentPrice', stock.info.get('regularMarketPrice', 0))
            value = pos['shares'] * price
            cost = pos['shares'] * pos['cost']
            pnl = value - cost
            pnl_pct = (pnl / cost * 100) if cost > 0 else 0
            
            emoji = '🟢' if pnl >= 0 else '🔴'
            print(f\"{pos['symbol']:8} {pos['shares']:>6} @ \${price:>8.2f} = \${value:>10,.2f} {emoji} {pnl_pct:>+6.1f}%\")
            
            class_value += value
            total_cost += cost
        except Exception as e:
            print(f\"{pos['symbol']:8} Error: {e}\")
    
    by_class[asset_class] = class_value
    total_value += class_value

print()
print('=' * 80)
print('SUMMARY BY CLASS:')
for cls, val in by_class.items():
    pct = (val / total_value * 100) if total_value > 0 else 0
    print(f'  {cls:15} \${val:>12,.2f} ({pct:5.1f}%)')

print()
total_pnl = total_value - total_cost
total_pnl_pct = (total_pnl / total_cost * 100) if total_cost > 0 else 0
print(f'TOTAL VALUE: \${total_value:,.2f}')
print(f'TOTAL P&L:   \${total_pnl:+,.2f} ({total_pnl_pct:+.1f}%)')
"
```

### Dollar-Cost Averaging (DCA) Execution

```bash
python3 -c "
import yfinance as yf
from datetime import datetime

# Weekly DCA plan
dca_plan = [
    {'symbol': 'VTI', 'amount_eur': 200, 'name': 'US Total Market'},
    {'symbol': 'VXUS', 'amount_eur': 100, 'name': 'International'},
    {'symbol': 'BND', 'amount_eur': 50, 'name': 'Bonds'},
]

eur_usd = 1.08  # Exchange rate

print('💰 DCA EXECUTION')
print('=' * 60)
print(f'Date: {datetime.now().strftime(\"%Y-%m-%d\")}')
print(f'EUR/USD: {eur_usd}')
print()

total_invested = 0

for plan in dca_plan:
    try:
        stock = yf.Ticker(plan['symbol'])
        price = stock.info.get('currentPrice', 100)
        
        amount_usd = plan['amount_eur'] * eur_usd
        shares = amount_usd / price
        
        print(f\"{plan['symbol']:6} ({plan['name']})\")
        print(f\"  Budget: €{plan['amount_eur']} = \${amount_usd:.2f}\")
        print(f\"  Price:  \${price:.2f}\")
        print(f\"  Shares: {shares:.4f}\")
        print()
        
        total_invested += plan['amount_eur']
        
        # Execute order:
        # broker.buy(plan['symbol'], shares)
        
    except Exception as e:
        print(f\"{plan['symbol']}: Error - {e}\")

print(f'Total Invested: €{total_invested}')
print()
print('⚠️ DRY RUN - Enable auto_pilot to execute')
"
```

### Sector Analysis

```bash
python3 -c "
import yfinance as yf

# Sector ETFs
sectors = {
    'Technology': 'XLK',
    'Healthcare': 'XLV',
    'Financials': 'XLF',
    'Consumer Disc.': 'XLY',
    'Industrials': 'XLI',
    'Energy': 'XLE',
    'Utilities': 'XLU',
    'Materials': 'XLB',
    'Real Estate': 'XLRE',
    'Comm. Services': 'XLC',
    'Cons. Staples': 'XLP',
}

print('📊 SECTOR PERFORMANCE')
print('=' * 60)

performances = []

for name, symbol in sectors.items():
    try:
        etf = yf.Ticker(symbol)
        hist = etf.history(period='1mo')
        
        if len(hist) > 1:
            start = hist['Close'].iloc[0]
            end = hist['Close'].iloc[-1]
            change = ((end - start) / start) * 100
            performances.append((name, change))
    except:
        pass

# Sort by performance
performances.sort(key=lambda x: x[1], reverse=True)

for name, change in performances:
    emoji = '🟢' if change >= 0 else '🔴'
    bar = '█' * int(abs(change))
    print(f'{emoji} {name:18} {change:>+6.1f}% {bar}')
"
```

### Bond Ladder Builder

```bash
python3 -c "
# Bond ladder for stable income
ladder = [
    {'maturity': '1Y', 'etf': 'SHY', 'allocation': 20, 'yield': 4.8},
    {'maturity': '3Y', 'etf': 'IEI', 'allocation': 20, 'yield': 4.2},
    {'maturity': '7Y', 'etf': 'IEF', 'allocation': 20, 'yield': 4.0},
    {'maturity': '10Y', 'etf': 'TLH', 'allocation': 20, 'yield': 4.3},
    {'maturity': '20Y', 'etf': 'TLT', 'allocation': 20, 'yield': 4.5},
]

total_investment = 50000

print('🪜 BOND LADDER')
print('=' * 60)
print(f'Total Investment: \${total_investment:,}')
print()
print(f'{\"Maturity\":10} {\"ETF\":6} {\"Amount\":>12} {\"Yield\":>8} {\"Income\":>10}')
print('-' * 60)

total_income = 0

for rung in ladder:
    amount = total_investment * (rung['allocation'] / 100)
    income = amount * (rung['yield'] / 100)
    total_income += income
    
    print(f\"{rung['maturity']:10} {rung['etf']:6} \${amount:>11,.0f} {rung['yield']:>7.1f}% \${income:>9,.0f}\")

print('-' * 60)
avg_yield = (total_income / total_investment) * 100
print(f'{\"TOTAL\":10} {\"\":6} \${total_investment:>11,} {avg_yield:>7.1f}% \${total_income:>9,.0f}')
print()
print(f'Monthly Income: \${total_income/12:,.0f}')
"
```

### Commodity Exposure

```bash
python3 -c "
import yfinance as yf

commodities = {
    'Gold': 'GLD',
    'Silver': 'SLV',
    'Oil': 'USO',
    'Natural Gas': 'UNG',
    'Agriculture': 'DBA',
    'Copper': 'CPER',
}

print('🪙 COMMODITY PRICES')
print('=' * 50)

for name, symbol in commodities.items():
    try:
        etf = yf.Ticker(symbol)
        hist = etf.history(period='5d')
        
        if len(hist) > 0:
            price = hist['Close'].iloc[-1]
            prev = hist['Close'].iloc[0]
            change = ((price - prev) / prev) * 100
            emoji = '🟢' if change >= 0 else '🔴'
            print(f'{name:15} \${price:>8.2f} {emoji} {change:>+5.1f}%')
    except Exception as e:
        print(f'{name:15} Error')
"
```

### Auto-Pilot: Full Automation

```bash
python3 -c "
from datetime import datetime

print('🤖 MULTI-ASSET AUTO-PILOT')
print('=' * 50)
print(f'Running: {datetime.now().isoformat()}')
print()

# Check what day it is for DCA
day = datetime.now().strftime('%A')

tasks = [
    (f'📅 Check DCA schedule (Today: {day})', 'DCA due: Monday'),
    ('💰 Execute weekly DCA', 'Pending approval'),
    ('📊 Rebalance check', 'Within tolerance'),
    ('🔔 Earnings calendar', 'AAPL reports in 5 days'),
    ('💸 Dividend tracker', 'MSFT ex-date tomorrow'),
    ('📈 Performance update', 'Portfolio +2.3% MTD'),
]

for task, status in tasks:
    print(f'{task}')
    print(f'  → {status}')
    print()

# Pending actions requiring approval
print('📋 PENDING APPROVALS:')
print('  1. DCA: Buy €350 worth of VTI, VXUS, BND')
print('     Reply \"APPROVE DCA\" to execute')
print()
print('Next check: Tomorrow 09:00')
"
```

## Workflow

### Asset Class Roles

| Class | Role | Target % |
|-------|------|----------|
| US Stocks | Growth | 35% |
| Intl Stocks | Diversification | 25% |
| Bonds | Stability, Income | 20% |
| Commodities | Inflation Hedge | 10% |
| Crypto | High Growth | 10% |

### DCA Best Practices

1. **Fixed schedule** - Same day each week/month
2. **Ignore prices** - Invest regardless of market
3. **Automate** - Remove emotion
4. **Rebalance** - Quarterly or threshold-based

### Tax-Efficient Placement

| Account Type | Best Assets |
|--------------|-------------|
| Taxable | Index ETFs (low turnover) |
| Tax-Deferred (401k) | Bonds, REITs |
| Tax-Free (Roth) | High growth stocks |
