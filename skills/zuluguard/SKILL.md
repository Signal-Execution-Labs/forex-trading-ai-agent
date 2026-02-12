# ZuluGuard - Copy Trading Protection

Automated risk control for signal copying - inspired by ZuluTrade's protection system.

## Overview
When copying other traders' signals, ZuluGuard monitors and protects your capital. Set limits once, trade with confidence.

## Protection Layers

### Layer 1: Max Drawdown Guard
```yaml
max_drawdown: 15%  # Stop copying if -15% from peak
action: pause_copy  # or close_all
cooldown: 24h      # Resume after cooldown
```

### Layer 2: Per-Trade Protection
```yaml
max_loss_per_trade: 2%   # Close if single trade loses 2%
max_open_trades: 5       # Don't copy if >5 open
min_stop_loss: true      # Require SL on every copy
```

### Layer 3: Provider Monitoring
```yaml
provider_max_drawdown: 25%  # Stop if provider hits -25%
provider_min_winrate: 40%   # Stop if winrate drops
provider_max_risk: 8        # Risk score threshold (1-10)
```

### Layer 4: Lot Size Control
```yaml
lot_mode: fixed     # fixed, proportional, risk_based
fixed_lot: 0.1      # Always 0.1 lots
max_lot: 1.0        # Never exceed
scale_factor: 0.5   # Copy at 50% of provider size
```

## Automatic Actions

| Trigger | Action Options |
|---------|----------------|
| Max DD hit | pause, close_all, notify |
| Bad trade | close_trade, skip_future |
| Provider slip | reduce_size, pause, switch |
| Win streak | increase_size (optional) |

## Provider Evaluation
```
Risk Score = (MaxDD × 0.4) + (AvgLeverage × 0.3) + (WorstTrade × 0.3)

Score 1-3: Conservative ✅
Score 4-6: Moderate ⚠️
Score 7-10: Aggressive ❌
```

## Multi-Provider Mode
```yaml
providers:
  - name: "ConservativeKing"
    allocation: 40%
    max_dd: 10%
  - name: "TrendMaster"
    allocation: 35%
    max_dd: 20%
  - name: "ScalpHero"
    allocation: 25%
    max_dd: 15%
    
correlation_limit: 0.7  # Avoid similar providers
```

## Emergency Protocols
```bash
# Panic button - close everything
kit zuluguard emergency --close-all

# Pause all copying
kit zuluguard pause --duration 24h

# Blacklist a provider
kit zuluguard blacklist --provider "RiskyTrader"
```

## Commands
```bash
kit zuluguard enable --max-dd 15% --max-trade-loss 3%
kit zuluguard status
kit zuluguard providers  # List with risk scores
kit zuluguard history    # Protection events log
kit zuluguard simulate   # Backtest protection settings
```

## Alerts
- 📉 Drawdown warning at 50% of limit
- 🛑 Position closed by guard
- ⚠️ Provider risk increased
- ✅ Daily protection report
