---
name: portfolio-tracker
description: "Track crypto holdings across exchanges. Calculate P&L, asset allocation, and generate performance reports."
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "pandas", "tabulate"] }
      }
  }
---

# Portfolio Tracker

Track and analyze your crypto portfolio across all exchanges.

## Overview

- **Multi-Exchange Aggregation** - Unified view of all holdings
- **P&L Calculation** - Realized and unrealized gains
- **Asset Allocation** - Distribution by coin and exchange
- **Performance Reports** - Daily, weekly, monthly summaries

## Data Storage

Portfolio data in `~/.kit/portfolio/`:

```
portfolio/
├── holdings.json       # Current positions
├── transactions.json   # Trade history
├── snapshots/          # Daily snapshots
│   └── 2026-02-09.json
└── reports/            # Generated reports
```

## Commands

### Fetch All Balances

```bash
python3 -c "
import ccxt
import json

exchanges_config = json.load(open('~/.kit/exchanges.json'))
total = {}

for name, config in exchanges_config.items():
    exchange = getattr(ccxt, name)(config)
    balance = exchange.fetch_balance()
    for coin, amount in balance['total'].items():
        if amount > 0:
            total[coin] = total.get(coin, 0) + amount
            print(f'{name}: {coin} = {amount}')

print('\\n=== TOTAL ===')
for coin, amount in total.items():
    print(f'{coin}: {amount}')
"
```

### Calculate Portfolio Value

```bash
python3 -c "
import ccxt

exchange = ccxt.binance()
holdings = {'BTC': 0.5, 'ETH': 2.0, 'SOL': 10}
total_usd = 0

for coin, amount in holdings.items():
    if coin == 'USDT':
        total_usd += amount
    else:
        ticker = exchange.fetch_ticker(f'{coin}/USDT')
        value = amount * ticker['last']
        total_usd += value
        print(f'{coin}: {amount} = \${value:,.2f}')

print(f'\\nTotal: \${total_usd:,.2f}')
"
```

### Asset Allocation

```bash
python3 -c "
import ccxt

holdings = {'BTC': 0.5, 'ETH': 2.0, 'SOL': 10, 'USDT': 1000}
exchange = ccxt.binance()
values = {}
total = 0

for coin, amount in holdings.items():
    if coin == 'USDT':
        values[coin] = amount
    else:
        ticker = exchange.fetch_ticker(f'{coin}/USDT')
        values[coin] = amount * ticker['last']
    total += values[coin]

print('Asset Allocation:')
print('=' * 40)
for coin, value in sorted(values.items(), key=lambda x: -x[1]):
    pct = (value / total) * 100
    bar = '█' * int(pct / 2)
    print(f'{coin:6} {pct:5.1f}% {bar} \${value:,.0f}')
"
```

### P&L Calculation

```bash
python3 -c "
# Example: Calculate P&L from cost basis
trades = [
    {'coin': 'BTC', 'amount': 0.1, 'cost_basis': 35000},
    {'coin': 'BTC', 'amount': 0.2, 'cost_basis': 42000},
    {'coin': 'ETH', 'amount': 1.0, 'cost_basis': 2200},
]

import ccxt
exchange = ccxt.binance()

for trade in trades:
    ticker = exchange.fetch_ticker(f\"{trade['coin']}/USDT\")
    current_price = ticker['last']
    current_value = trade['amount'] * current_price
    cost = trade['amount'] * trade['cost_basis']
    pnl = current_value - cost
    pnl_pct = (pnl / cost) * 100
    emoji = '🟢' if pnl >= 0 else '🔴'
    print(f\"{emoji} {trade['coin']}: \${pnl:+,.2f} ({pnl_pct:+.1f}%)\")
"
```

### Daily Snapshot

```bash
python3 -c "
import json
from datetime import datetime
import ccxt

# Fetch current holdings and prices
holdings = {'BTC': 0.5, 'ETH': 2.0}
exchange = ccxt.binance()
snapshot = {
    'timestamp': datetime.now().isoformat(),
    'holdings': {},
    'total_usd': 0
}

for coin, amount in holdings.items():
    ticker = exchange.fetch_ticker(f'{coin}/USDT')
    value = amount * ticker['last']
    snapshot['holdings'][coin] = {
        'amount': amount,
        'price': ticker['last'],
        'value_usd': value
    }
    snapshot['total_usd'] += value

filename = f\"snapshot_{datetime.now().strftime('%Y-%m-%d')}.json\"
print(json.dumps(snapshot, indent=2))
# Save: json.dump(snapshot, open(filename, 'w'))
"
```

### Performance Report

```bash
python3 -c "
# Compare snapshots for performance
import json
from datetime import datetime, timedelta

# Mock data - load from files in practice
yesterday = {'total_usd': 50000, 'holdings': {'BTC': {'value_usd': 40000}}}
today = {'total_usd': 52000, 'holdings': {'BTC': {'value_usd': 42000}}}

change = today['total_usd'] - yesterday['total_usd']
change_pct = (change / yesterday['total_usd']) * 100

print('📈 DAILY PERFORMANCE REPORT')
print('=' * 40)
print(f\"Portfolio Value: \${today['total_usd']:,.2f}\")
print(f\"24h Change: \${change:+,.2f} ({change_pct:+.2f}%)\")
print()
print('Top Movers:')
for coin in today['holdings']:
    if coin in yesterday['holdings']:
        prev = yesterday['holdings'][coin]['value_usd']
        curr = today['holdings'][coin]['value_usd']
        pct = ((curr - prev) / prev) * 100
        emoji = '🟢' if pct >= 0 else '🔴'
        print(f'  {emoji} {coin}: {pct:+.2f}%')
"
```

## Workflow

### Setting Up Tracking

1. Configure exchanges in `~/.kit/exchanges.json`
2. Run initial balance fetch
3. Set up daily snapshot cron job
4. Import historical trades for accurate P&L

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| Total Value | Sum of all holdings in USD |
| 24h Change | Daily performance |
| 7d Change | Weekly performance |
| 30d Change | Monthly performance |
| ATH | All-time high portfolio value |
| Max Drawdown | Largest peak-to-trough decline |
| Sharpe Ratio | Risk-adjusted returns |

### Report Types

- **Daily Summary** - Quick overview
- **Weekly Report** - Detailed with charts
- **Monthly Report** - Full analysis with recommendations
- **Tax Report** - Realized gains for tax purposes
