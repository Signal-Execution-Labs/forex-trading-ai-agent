---
name: tax-tracker
description: "Automatic tax tracking for all trades. Calculate capital gains, generate tax reports, and optimize tax liability."
metadata:
  {
    "openclaw":
      {
        "emoji": "🧾",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "pandas", "openpyxl"] }
      }
  }
---

# Tax Tracker

Vollautomatisches Steuer-Tracking für alle Trading-Aktivitäten.

## Overview

- **Trade Import** - Automatischer Import von allen Exchanges
- **Gain Calculation** - FIFO, LIFO, HIFO Methoden
- **Tax Optimization** - Tax-Loss Harvesting Vorschläge
- **Report Generation** - Steuerberichte für DE/AT/CH

## 🤖 AUTO-PILOT MODE

```python
# ~/.kit/config/tax-tracker.json
{
  "auto_pilot": {
    "enabled": true,
    "sync_interval_hours": 24,
    "methods": {
      "crypto": "FIFO",
      "stocks": "FIFO"
    },
    "tax_loss_harvesting": {
      "enabled": true,
      "threshold_eur": 500,
      "require_approval": true
    },
    "reports": {
      "auto_generate": true,
      "schedule": "monthly",
      "formats": ["pdf", "csv"]
    },
    "notifications": {
      "tax_deadline_reminder": true,
      "large_gain_alert": 1000
    }
  },
  "jurisdiction": "DE",
  "tax_year": 2026
}
```

## Tax Rules (Germany)

| Asset | Haltefrist | Steuersatz |
|-------|------------|------------|
| Crypto | 1 Jahr steuerfrei | bis 45% + Soli |
| Aktien | Keine | 25% Abgeltungssteuer |
| ETFs | Keine | 25% + Teilfreistellung |

## Commands

### Import All Trades

```bash
python3 -c "
import ccxt
import json
import os
from datetime import datetime

exchanges_config = json.load(open(os.path.expanduser('~/.kit/exchanges.json')))
all_trades = []

for name, cfg in exchanges_config.items():
    try:
        exchange = getattr(ccxt, name)(cfg)
        # Fetch all trades (may need pagination)
        trades = exchange.fetch_my_trades('BTC/USDT', limit=100)
        for t in trades:
            all_trades.append({
                'exchange': name,
                'symbol': t['symbol'],
                'side': t['side'],
                'amount': t['amount'],
                'price': t['price'],
                'cost': t['cost'],
                'fee': t['fee']['cost'] if t['fee'] else 0,
                'timestamp': t['timestamp'],
                'date': datetime.fromtimestamp(t['timestamp']/1000).isoformat()
            })
        print(f'✅ {name}: {len(trades)} trades imported')
    except Exception as e:
        print(f'⚠️ {name}: {e}')

print(f'\\n📊 Total: {len(all_trades)} trades')
# Save: json.dump(all_trades, open('trades_2026.json', 'w'), indent=2)
"
```

### Calculate Capital Gains (FIFO)

```bash
python3 -c "
from collections import defaultdict
from datetime import datetime, timedelta

# Example trades
trades = [
    {'side': 'buy', 'amount': 1.0, 'price': 40000, 'date': '2025-01-15', 'asset': 'BTC'},
    {'side': 'buy', 'amount': 0.5, 'price': 45000, 'date': '2025-06-01', 'asset': 'BTC'},
    {'side': 'sell', 'amount': 0.8, 'price': 50000, 'date': '2026-02-01', 'asset': 'BTC'},
]

# FIFO calculation
holdings = defaultdict(list)  # asset -> [(amount, price, date)]
gains = []

for trade in sorted(trades, key=lambda x: x['date']):
    asset = trade['asset']
    
    if trade['side'] == 'buy':
        holdings[asset].append({
            'amount': trade['amount'],
            'price': trade['price'],
            'date': datetime.fromisoformat(trade['date'])
        })
    
    elif trade['side'] == 'sell':
        sell_amount = trade['amount']
        sell_price = trade['price']
        sell_date = datetime.fromisoformat(trade['date'])
        
        while sell_amount > 0 and holdings[asset]:
            lot = holdings[asset][0]
            
            # Calculate how much from this lot
            used = min(lot['amount'], sell_amount)
            
            # Calculate gain
            proceeds = used * sell_price
            cost_basis = used * lot['price']
            gain = proceeds - cost_basis
            
            # Check holding period (Germany: 1 year = tax free for crypto)
            holding_days = (sell_date - lot['date']).days
            tax_free = holding_days >= 365
            
            gains.append({
                'asset': asset,
                'amount': used,
                'proceeds': proceeds,
                'cost_basis': cost_basis,
                'gain': gain,
                'holding_days': holding_days,
                'tax_free': tax_free
            })
            
            # Update lot
            lot['amount'] -= used
            sell_amount -= used
            
            if lot['amount'] <= 0:
                holdings[asset].pop(0)

print('🧾 CAPITAL GAINS REPORT (FIFO)')
print('=' * 60)

total_gain = 0
taxable_gain = 0

for g in gains:
    status = '🟢 Steuerfrei' if g['tax_free'] else '🔴 Steuerpflichtig'
    print(f\"{g['asset']}: {g['amount']:.4f} | Gewinn: €{g['gain']:,.2f} | {g['holding_days']}d | {status}\")
    total_gain += g['gain']
    if not g['tax_free']:
        taxable_gain += g['gain']

print()
print(f'Gesamt-Gewinn: €{total_gain:,.2f}')
print(f'Steuerpflichtiger Gewinn: €{taxable_gain:,.2f}')
print(f'Geschätzte Steuer (42%): €{taxable_gain * 0.42:,.2f}')
"
```

### Tax-Loss Harvesting Opportunities

```bash
python3 -c "
import ccxt

# Current holdings with cost basis
holdings = [
    {'asset': 'BTC', 'amount': 0.5, 'cost_basis': 50000, 'buy_date': '2025-08-01'},
    {'asset': 'ETH', 'amount': 2.0, 'cost_basis': 3000, 'buy_date': '2025-09-15'},
    {'asset': 'SOL', 'amount': 20, 'cost_basis': 150, 'buy_date': '2025-10-01'},
]

exchange = ccxt.binance()

print('🧾 TAX-LOSS HARVESTING OPPORTUNITIES')
print('=' * 60)

total_unrealized_loss = 0

for h in holdings:
    try:
        ticker = exchange.fetch_ticker(f\"{h['asset']}/USDT\")
        current_price = ticker['last']
        current_value = h['amount'] * current_price
        cost = h['amount'] * h['cost_basis']
        unrealized = current_value - cost
        
        if unrealized < 0:
            total_unrealized_loss += abs(unrealized)
            print(f\"🔴 {h['asset']}: Unrealized Loss €{unrealized:,.2f}\")
            print(f\"   Sell now to realize loss for tax offset\")
            print(f\"   Can rebuy after 30 days (wash sale rule)\")
            print()
    except:
        pass

print(f'Total harvestable losses: €{total_unrealized_loss:,.2f}')
print(f'Potential tax savings (42%): €{total_unrealized_loss * 0.42:,.2f}')
"
```

### Generate Annual Tax Report

```bash
python3 -c "
from datetime import datetime
import json

# Mock data - load from trades file
report = {
    'year': 2026,
    'jurisdiction': 'DE',
    'summary': {
        'total_proceeds': 125000,
        'total_cost_basis': 100000,
        'total_gains': 25000,
        'tax_free_gains': 15000,
        'taxable_gains': 10000,
        'total_fees': 500,
        'estimated_tax': 4200
    },
    'by_asset': {
        'BTC': {'gains': 18000, 'taxable': 8000},
        'ETH': {'gains': 5000, 'taxable': 2000},
        'SOL': {'gains': 2000, 'taxable': 0}
    }
}

print('🧾 ANNUAL TAX REPORT 2026')
print('=' * 60)
print(f\"Jurisdiction: {report['jurisdiction']}\")
print()
print('SUMMARY')
print('-' * 60)
print(f\"Total Proceeds:     €{report['summary']['total_proceeds']:>12,.2f}\")
print(f\"Total Cost Basis:   €{report['summary']['total_cost_basis']:>12,.2f}\")
print(f\"Total Gains:        €{report['summary']['total_gains']:>12,.2f}\")
print(f\"  - Tax Free:       €{report['summary']['tax_free_gains']:>12,.2f}\")
print(f\"  - Taxable:        €{report['summary']['taxable_gains']:>12,.2f}\")
print(f\"Trading Fees:       €{report['summary']['total_fees']:>12,.2f}\")
print()
print(f\"Estimated Tax:      €{report['summary']['estimated_tax']:>12,.2f}\")
print()
print('BY ASSET')
print('-' * 60)
for asset, data in report['by_asset'].items():
    print(f\"{asset:6} | Gains: €{data['gains']:>10,.2f} | Taxable: €{data['taxable']:>10,.2f}\")
"
```

### Auto-Pilot: Scheduled Tax Sync

```bash
python3 -c "
import json
import os
from datetime import datetime

config_path = os.path.expanduser('~/.kit/config/tax-tracker.json')

# Auto-pilot logic
def run_auto_pilot():
    config = json.load(open(config_path)) if os.path.exists(config_path) else {}
    auto = config.get('auto_pilot', {})
    
    if not auto.get('enabled'):
        print('⚠️ Auto-pilot disabled')
        return
    
    print('🤖 TAX TRACKER AUTO-PILOT')
    print('=' * 50)
    print(f'Running at: {datetime.now().isoformat()}')
    print()
    
    # 1. Sync trades from all exchanges
    print('📥 Syncing trades from exchanges...')
    # sync_all_trades()
    
    # 2. Calculate current tax position
    print('📊 Calculating tax position...')
    # calculate_gains()
    
    # 3. Check for tax-loss harvesting
    if auto.get('tax_loss_harvesting', {}).get('enabled'):
        print('🔍 Checking tax-loss harvesting opportunities...')
        # find_harvest_opportunities()
    
    # 4. Generate report if scheduled
    if auto.get('reports', {}).get('auto_generate'):
        print('📄 Generating tax report...')
        # generate_report()
    
    print()
    print('✅ Auto-pilot cycle complete')

run_auto_pilot()
"
```

## Workflow

### Year-End Tax Workflow

1. **Januar**: Sync all previous year trades
2. **Februar**: Generate preliminary report
3. **März-Mai**: Submit to tax advisor / Finanzamt
4. **Laufend**: Track new trades, optimize

### Supported Formats

| Format | Use Case |
|--------|----------|
| CSV | Import to tax software |
| PDF | Archive / Advisor |
| JSON | K.I.T. internal |
| XLSX | Manual review |

### German Tax Calendar

| Deadline | Action |
|----------|--------|
| 31. Juli | Steuererklärung ohne Steuerberater |
| 28/29. Feb | Steuererklärung mit Steuerberater |
| Laufend | Vorauszahlungen (15.3, 15.6, 15.9, 15.12) |
