---
name: rebalancer
description: "Automatic portfolio rebalancing to maintain target allocations. Supports threshold and calendar-based triggers."
metadata:
  {
    "openclaw":
      {
        "emoji": "⚖️",
        "requires": { "bins": ["python3"], "pip": ["ccxt", "yfinance", "pandas"] }
      }
  }
---

# Rebalancer

Vollautomatisches Portfolio-Rebalancing für optimale Asset Allocation.

## Overview

- **Target Allocation** - Ziel-Gewichtungen definieren
- **Drift Detection** - Abweichungen erkennen
- **Smart Rebalancing** - Steuer- und kostenoptimiert
- **Multi-Asset** - Crypto, Aktien, ETFs, Bonds

## 🤖 AUTO-PILOT MODE

```python
# ~/.kit/config/rebalancer.json
{
  "auto_pilot": {
    "enabled": true,
    "trigger": {
      "type": "threshold",  # threshold | calendar | hybrid
      "threshold_pct": 5,   # Rebalance wenn >5% Drift
      "calendar": "quarterly",  # monthly | quarterly | yearly
      "check_interval_hours": 24
    },
    "execution": {
      "mode": "sell_buy",   # sell_buy | buy_only | cashflow
      "min_trade_eur": 50,
      "require_approval": true,  # User muss bestätigen
      "approval_timeout_hours": 24
    },
    "tax_optimization": {
      "avoid_short_term_gains": true,
      "use_tax_loss_harvesting": true,
      "max_annual_gains_eur": 10000
    },
    "notifications": {
      "drift_alert_pct": 3,
      "rebalance_complete": true
    }
  },
  "target_allocation": {
    "crypto": {
      "BTC": 40,
      "ETH": 30,
      "SOL": 15,
      "stablecoins": 15
    },
    "traditional": {
      "stocks_us": 40,
      "stocks_eu": 20,
      "bonds": 25,
      "gold": 10,
      "cash": 5
    }
  }
}
```

## Commands

### Check Current Allocation vs Target

```bash
python3 -c "
import ccxt
import yfinance as yf

# Target allocation
target = {
    'BTC': 40,
    'ETH': 30,
    'SOL': 15,
    'USDT': 15
}

# Current holdings (from exchange)
holdings = {
    'BTC': 0.5,
    'ETH': 3.0,
    'SOL': 50,
    'USDT': 5000
}

exchange = ccxt.binance()
values = {}
total = 0

# Calculate values
for coin, amount in holdings.items():
    if coin in ['USDT', 'USDC']:
        values[coin] = amount
    else:
        ticker = exchange.fetch_ticker(f'{coin}/USDT')
        values[coin] = amount * ticker['last']
    total += values[coin]

print('⚖️ PORTFOLIO ALLOCATION')
print('=' * 70)
print(f'{\"Asset\":8} {\"Value\":>12} {\"Current\":>10} {\"Target\":>10} {\"Drift\":>10} {\"Status\":>10}')
print('-' * 70)

max_drift = 0
for coin in target:
    current_pct = (values.get(coin, 0) / total * 100) if total > 0 else 0
    target_pct = target[coin]
    drift = current_pct - target_pct
    max_drift = max(max_drift, abs(drift))
    
    if abs(drift) > 5:
        status = '🔴 REBAL'
    elif abs(drift) > 2:
        status = '🟡 Watch'
    else:
        status = '🟢 OK'
    
    print(f'{coin:8} \${values.get(coin, 0):>11,.2f} {current_pct:>9.1f}% {target_pct:>9.1f}% {drift:>+9.1f}% {status:>10}')

print('-' * 70)
print(f'{\"TOTAL\":8} \${total:>11,.2f}')
print()

if max_drift > 5:
    print('⚠️ REBALANCING RECOMMENDED - Max drift exceeds 5%')
else:
    print('✅ Portfolio within tolerance')
"
```

### Calculate Rebalance Trades

```bash
python3 -c "
# Current vs Target
current_values = {
    'BTC': 25000,   # 50%
    'ETH': 15000,   # 30%
    'SOL': 5000,    # 10%
    'USDT': 5000    # 10%
}

target_pct = {
    'BTC': 40,
    'ETH': 30,
    'SOL': 15,
    'USDT': 15
}

total = sum(current_values.values())

print('⚖️ REBALANCE CALCULATION')
print('=' * 60)
print(f'Total Portfolio: \${total:,.2f}')
print()
print(f'{\"Asset\":8} {\"Current\":>12} {\"Target\":>12} {\"Action\":>15}')
print('-' * 60)

trades = []

for asset, target in target_pct.items():
    current_val = current_values.get(asset, 0)
    target_val = total * (target / 100)
    diff = target_val - current_val
    
    if abs(diff) > 50:  # Min trade threshold
        action = f'BUY \${diff:,.0f}' if diff > 0 else f'SELL \${-diff:,.0f}'
        trades.append({'asset': asset, 'action': 'buy' if diff > 0 else 'sell', 'amount': abs(diff)})
    else:
        action = '—'
    
    print(f'{asset:8} \${current_val:>11,.2f} \${target_val:>11,.2f} {action:>15}')

print()
print('📋 TRADE ORDERS:')
for t in trades:
    emoji = '🟢' if t['action'] == 'buy' else '🔴'
    print(f\"  {emoji} {t['action'].upper()} \${t['amount']:,.2f} of {t['asset']}\")
"
```

### Tax-Optimized Rebalancing

```bash
python3 -c "
from datetime import datetime, timedelta

# Holdings with purchase dates
holdings = [
    {'asset': 'BTC', 'amount': 0.3, 'buy_date': '2025-01-15', 'cost_basis': 35000},
    {'asset': 'BTC', 'amount': 0.2, 'buy_date': '2025-08-01', 'cost_basis': 45000},
    {'asset': 'ETH', 'amount': 2.0, 'buy_date': '2024-12-01', 'cost_basis': 2200},
]

# Need to sell $5000 of BTC for rebalancing
sell_target = 5000
btc_price = 50000

print('⚖️ TAX-OPTIMIZED REBALANCING')
print('=' * 60)
print(f'Need to sell: \${sell_target:,.2f} of BTC')
print()

# Sort lots by tax efficiency
today = datetime.now()
btc_lots = [h for h in holdings if h['asset'] == 'BTC']

for lot in btc_lots:
    buy_date = datetime.fromisoformat(lot['buy_date'])
    holding_days = (today - buy_date).days
    lot['holding_days'] = holding_days
    lot['tax_free'] = holding_days >= 365
    lot['current_value'] = lot['amount'] * btc_price
    lot['gain_pct'] = ((btc_price - lot['cost_basis']) / lot['cost_basis']) * 100

# Strategy: Sell tax-free lots first, then lowest gain lots
btc_lots.sort(key=lambda x: (-x['tax_free'], x['gain_pct']))

print('Lot Selection (tax-optimized):')
print('-' * 60)

remaining = sell_target
for lot in btc_lots:
    if remaining <= 0:
        break
    
    sell_value = min(lot['current_value'], remaining)
    sell_amount = sell_value / btc_price
    
    status = '🟢 TAX-FREE' if lot['tax_free'] else f\"🔴 Taxable ({lot['gain_pct']:+.1f}% gain)\"
    print(f\"  Sell {sell_amount:.4f} BTC from {lot['buy_date']} lot | {status}\")
    
    remaining -= sell_value

print()
print('💡 Tax Impact: Minimal (prioritized tax-free lots)')
"
```

### Multi-Asset Rebalancing

```bash
python3 -c "
# Full portfolio: Crypto + Stocks + Bonds
portfolio = {
    'crypto': {
        'BTC': 20000,
        'ETH': 10000,
    },
    'stocks': {
        'VTI': 30000,   # US Total Market
        'VXUS': 15000,  # International
    },
    'bonds': {
        'BND': 15000,   # Total Bond
    },
    'gold': {
        'GLD': 5000,
    },
    'cash': {
        'EUR': 5000,
    }
}

# Target allocation by class
target_class = {
    'crypto': 30,
    'stocks': 45,
    'bonds': 15,
    'gold': 5,
    'cash': 5
}

# Calculate totals
class_values = {cls: sum(assets.values()) for cls, assets in portfolio.items()}
total = sum(class_values.values())

print('⚖️ MULTI-ASSET REBALANCING')
print('=' * 60)
print(f'Total Portfolio: \${total:,.2f}')
print()
print('BY ASSET CLASS:')
print('-' * 60)

for cls, target in target_class.items():
    current_val = class_values.get(cls, 0)
    current_pct = (current_val / total * 100) if total > 0 else 0
    target_val = total * (target / 100)
    diff = target_val - current_val
    
    if abs(diff) > 100:
        action = f'+\${diff:,.0f}' if diff > 0 else f'-\${-diff:,.0f}'
    else:
        action = 'OK'
    
    bar = '█' * int(current_pct / 2)
    print(f'{cls:8} {current_pct:5.1f}% -> {target:5.1f}% | {action:>10} | {bar}')
"
```

### Auto-Pilot: Scheduled Rebalancing

```bash
python3 -c "
import json
from datetime import datetime

print('🤖 REBALANCER AUTO-PILOT')
print('=' * 50)
print(f'Check time: {datetime.now().isoformat()}')
print()

# Check triggers
drift_detected = True  # From allocation check
threshold = 5

if drift_detected:
    print('⚠️ DRIFT DETECTED > 5%')
    print()
    print('Proposed trades:')
    print('  🔴 SELL \$2,000 BTC')
    print('  🟢 BUY \$1,500 SOL')
    print('  🟢 BUY \$500 USDT')
    print()
    print('📱 Awaiting user approval...')
    print('   Reply \"APPROVE\" to execute')
    print('   Reply \"SKIP\" to postpone')
    print('   Auto-timeout in 24 hours')
else:
    print('✅ Portfolio within tolerance')
    print('   No rebalancing needed')
"
```

## Workflow

### Rebalancing Strategies

| Strategy | Description | Best For |
|----------|-------------|----------|
| Threshold | Rebalance when drift > X% | Active traders |
| Calendar | Fixed schedule (quarterly) | Passive investors |
| Cashflow | Only use new deposits | Tax-efficient |
| Hybrid | Calendar + threshold override | Balanced approach |

### Execution Modes

| Mode | Description |
|------|-------------|
| `sell_buy` | Sell overweight, buy underweight |
| `buy_only` | Only buy underweight (no selling) |
| `cashflow` | Use dividends/deposits for buying |

### Tax Considerations

1. **Sell tax-free lots first** (>1 year for crypto in DE)
2. **Harvest losses** when selling overweight positions
3. **Stay under Freistellungsauftrag** if possible
4. **Consider wash sale rules** for immediate rebuy
