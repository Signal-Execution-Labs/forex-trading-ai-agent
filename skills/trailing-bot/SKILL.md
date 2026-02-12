# Trailing Buy/Sell Bot

Smart entries and exits that follow price action.

## Overview
Don't catch falling knives. Don't sell too early. The Trailing Bot waits for confirmation before executing, maximizing your entry and exit points.

## Trailing Buy
```
Target Price: $100
Callback: 2%

Price falls: $100 → $95 → $90 → $85 (tracking)
Price rises: $85 → $86.70 (+2% callback) → BUY!

Result: Bought at $86.70 instead of $100
Savings: 13.3%
```

## Trailing Sell
```
Entry Price: $100
Callback: 3%

Price rises: $100 → $110 → $120 → $130 (tracking)
Price drops: $130 → $126.10 (-3% callback) → SELL!

Result: Sold at $126.10 instead of $100
Profit: 26.1%
```

## Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| trigger_price | number | Price to activate trailing |
| callback_rate | 0.5-10% | Reversal % to trigger |
| order_type | market/limit | Execution type |
| time_limit | hours | Max wait time |

## Trailing Modes

### 1. Simple Trailing
Basic callback from lowest/highest point.

### 2. Time-Decay Trailing
Callback tightens over time:
```
Hour 1: 5% callback
Hour 6: 3% callback
Hour 24: 1% callback
```

### 3. Volume-Adjusted
Tighter callback on high volume (confirmation).

### 4. Multi-Leg Trailing
Chain buy → trailing stop → trailing take profit.

## Combo Strategies

### Dip Buy + Trailing Stop
```
1. Trailing Buy on -10% dip
2. Auto-set trailing stop at 5%
3. Let winners run
```

### Breakout Trailing
```
1. Set trailing buy above resistance
2. Confirm breakout with callback
3. Avoid fake breakouts
```

## Commands
```bash
kit trailing create --type buy --symbol ETH/USDT --trigger 2800 --callback 2%
kit trailing create --type sell --symbol ETH/USDT --trigger 3500 --callback 3%
kit trailing list
kit trailing cancel --id tr_123
```

## Pro Tips
- Volatile assets: Use 3-5% callback
- Stable assets: Use 1-2% callback
- Combine with alerts for confirmation
