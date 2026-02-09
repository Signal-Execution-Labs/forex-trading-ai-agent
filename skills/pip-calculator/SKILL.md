# Pip Calculator 💰

Berechnet Pip-Werte, Gewinn/Verlust und Konvertierungen für alle Assets. Wisse genau, was jeder Pip wert ist!

## Trigger Keywords

- pip value, pip wert, pipwert
- calculate pips, berechne pips
- pip profit, pip gewinn
- pips to money, money to pips
- how much is a pip

## Was kann dieser Skill?

- **Pip Value**: Wert eines Pips für verschiedene Lot-Größen
- **P&L Berechnung**: Profit/Verlust in Pips → Geld
- **Pip Distance**: Abstand zwischen zwei Preisen in Pips
- **Währungskonvertierung**: Berücksichtigt Account-Währung

## Pip-Größen nach Asset

| Asset-Typ | Pip-Größe | Beispiel |
|-----------|-----------|----------|
| Forex (5-digit) | 0.0001 | EURUSD: 1.08500 → 1.08510 = 1 pip |
| Forex JPY | 0.01 | USDJPY: 149.500 → 149.510 = 1 pip |
| Gold (XAUUSD) | 0.1 | 2050.50 → 2050.60 = 1 pip |
| Indices | 1.0 | Varies by broker |
| Crypto | Varies | Usually $1 |

## Beispiele

```
"K.I.T., was ist ein Pip bei EURUSD wert bei 0.5 Lot?"
"Berechne den Gewinn: GBPUSD, 50 Pips, 0.1 Lot"
"Wie viele Pips sind zwischen 1.0850 und 1.0920 bei EURUSD?"
```

## API

```python
from skills.pip_calculator import (
    calculate_pip_value,
    calculate_profit,
    price_to_pips,
    pips_to_price
)

# Pip-Wert berechnen
value = calculate_pip_value(
    symbol="EURUSD",
    lot_size=0.1,
    account_currency="USD"
)
print(f"1 Pip = ${value}")  # 1 Pip = $1.00

# Profit berechnen
profit = calculate_profit(
    symbol="GBPUSD",
    pips=50,
    lot_size=0.1
)
print(f"Profit: ${profit}")  # Profit: $50.00

# Pip-Distance
pips = price_to_pips(
    symbol="EURUSD",
    price1=1.0850,
    price2=1.0920
)
print(f"Distance: {pips} pips")  # Distance: 70 pips
```

## Standard Pip Values (per 1.0 Lot)

| Symbol | Pip Value (USD) | Berechnung |
|--------|-----------------|------------|
| EURUSD | $10.00 | (0.0001 × 100,000) |
| GBPUSD | $10.00 | (0.0001 × 100,000) |
| USDJPY | ~$6.67 | (0.01 × 100,000 / USDJPY Rate) |
| XAUUSD | $10.00 | (0.1 × 100 oz) |

## Mini/Micro Lots

| Lot Size | Contract | Pip Value (EURUSD) |
|----------|----------|-------------------|
| Standard (1.0) | 100,000 | $10.00 |
| Mini (0.1) | 10,000 | $1.00 |
| Micro (0.01) | 1,000 | $0.10 |

## Konfiguration

```yaml
pip_calculator:
  account_currency: "USD"
  default_lot_size: 0.1
  include_commission: false
```

---

*K.I.T. - "Every pip counts!"* 💰
