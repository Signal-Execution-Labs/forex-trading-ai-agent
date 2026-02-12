# Options Strategy Builder

> **Skill #95** - Design, analyze, and trade options strategies

## Overview

Visual options strategy builder with P&L charts, Greeks analysis, what-if scenarios, and automated execution. Build spreads from scratch or use pre-made templates for common strategies.

Inspired by TradingView's Options Strategy Builder.

## Features

- **Visual P&L Charts:** Interactive profit/loss at expiration
- **Greeks Dashboard:** Delta, Gamma, Theta, Vega, Rho
- **Strategy Templates:** 30+ pre-built strategies
- **What-If Analysis:** Model price and volatility changes
- **Risk Graphs:** Visualize max profit/loss/breakeven
- **Multi-Leg Builder:** Create complex spreads
- **Volatility Surface:** IV skew and term structure
- **Auto-Execution:** One-click strategy deployment

## Usage

```bash
# Build call spread
kit skill options build --type call-spread --symbol SPY --strikes 500,510 --exp 2026-03-21

# Analyze iron condor
kit skill options analyze --type iron-condor --symbol AAPL --width 5

# What-if scenario
kit skill options whatif --strategy saved:my_spread --price-change 5% --iv-change -10%

# View options chain
kit skill options chain --symbol NVDA --exp 2026-03-21
```

## Configuration

```yaml
options_builder:
  default_expiry: "nearest monthly"
  risk_free_rate: 0.05
  dividend_yield: 0.01
  
  position_limits:
    max_contracts: 100
    max_buying_power: 0.20  # 20% of portfolio
    max_margin: 0.50
  
  greeks_thresholds:
    max_delta: 50
    max_gamma: 10
    min_theta: -100  # Max daily decay
    max_vega: 500
```

## Strategy Templates

### Bullish Strategies
| Strategy | Max Profit | Max Loss | Best When |
|----------|------------|----------|-----------|
| Long Call | Unlimited | Premium | Strong up move expected |
| Bull Call Spread | Limited | Limited | Moderate up move |
| Cash-Secured Put | Premium | Strike - Premium | Willing to own shares |
| Call Ratio Spread | Limited | Unlimited | Small up move |

### Bearish Strategies
| Strategy | Max Profit | Max Loss | Best When |
|----------|------------|----------|-----------|
| Long Put | Strike - Premium | Premium | Strong down move |
| Bear Put Spread | Limited | Limited | Moderate down move |
| Put Ratio Spread | Limited | Unlimited | Small down move |

### Neutral Strategies
| Strategy | Max Profit | Max Loss | Best When |
|----------|------------|----------|-----------|
| Iron Condor | Credit | Width - Credit | Low volatility expected |
| Iron Butterfly | Credit | Width - Credit | Pin to strike expected |
| Straddle (sell) | Credit | Unlimited | Expecting range |
| Strangle (sell) | Credit | Unlimited | Wide range expected |

### Volatility Strategies
| Strategy | Profit From | Max Loss |
|----------|-------------|----------|
| Long Straddle | Big move either way | Premium paid |
| Long Strangle | Big move either way | Premium paid |
| Calendar Spread | IV increase | Net debit |

## Example Output

```json
{
  "strategy": "Iron Condor",
  "symbol": "SPY",
  "expiration": "2026-03-21",
  "legs": [
    { "type": "sell", "option": "put", "strike": 490, "contracts": 1 },
    { "type": "buy", "option": "put", "strike": 485, "contracts": 1 },
    { "type": "sell", "option": "call", "strike": 510, "contracts": 1 },
    { "type": "buy", "option": "call", "strike": 515, "contracts": 1 }
  ],
  "analysis": {
    "max_profit": 320,
    "max_loss": 180,
    "breakeven_low": 486.80,
    "breakeven_high": 513.20,
    "probability_profit": 68,
    "risk_reward": "1.78:1"
  },
  "greeks": {
    "delta": -2.3,
    "gamma": -0.8,
    "theta": 12.50,
    "vega": -45.2
  },
  "margin_required": 500
}
```

## What-If Scenarios

```yaml
scenarios:
  - name: "Earnings Pop"
    price_change: +10%
    iv_change: -50%
    
  - name: "Market Crash"
    price_change: -15%
    iv_change: +100%
    
  - name: "Theta Decay"
    days_forward: 14
    price_change: 0%
```

## Integration

- **Auto Trader:** Execute strategies with one click
- **Alerts:** Notify on Greeks thresholds
- **Portfolio:** Track all options positions
- **Risk Manager:** Position sizing based on max loss
