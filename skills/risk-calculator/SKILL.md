---
name: risk-calculator
description: Advanced portfolio risk analysis. Calculate VaR, Sharpe ratio, correlation, and position sizing.
metadata:
  {
    "kit":
      {
        "emoji": "⚠️",
        "category": "risk",
        "tier": "standard",
        "triggers": [
          "risk", "risk calculator", "portfolio risk", "var",
          "value at risk", "sharpe", "drawdown", "max drawdown",
          "position size", "risk analysis", "correlation",
          "volatility", "beta", "risk metrics"
        ]
      }
  }
---

# ⚠️ Risk Calculator

**Know your risk before you trade.** Comprehensive portfolio risk analysis including VaR, Sharpe ratio, drawdown analysis, and optimal position sizing.

## Features

### 📊 Risk Metrics
- Value at Risk (VaR) - 95% and 99%
- Conditional VaR (CVaR / Expected Shortfall)
- Maximum Drawdown
- Sharpe Ratio
- Sortino Ratio
- Beta vs benchmark

### 🎯 Position Sizing
- Kelly Criterion calculation
- Fixed risk position sizing
- Volatility-adjusted sizing
- Maximum position limits

### 📈 Correlation Analysis
- Asset correlation matrix
- Portfolio diversification score
- Concentration risk
- Sector/chain exposure

### ⚡ Real-Time Monitoring
- Live risk dashboard
- Alert on threshold breach
- Stress test scenarios
- Margin utilization

## Usage

```bash
# Full portfolio risk analysis
kit risk analyze

# Calculate position size for trade
kit risk size BTC/USDT --risk 2%

# Check Value at Risk
kit risk var --confidence 95

# Correlation matrix
kit risk correlation

# Stress test
kit risk stress --scenario crash
```

## CLI Output

```
⚠️ K.I.T. Risk Calculator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Portfolio Value: $45,231.50
Last Updated: Just now

📊 RISK METRICS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Daily VaR (95%):     $1,234.56 (2.73%)
Daily VaR (99%):     $1,890.23 (4.18%)
Weekly VaR (95%):    $2,761.89 (6.11%)

Max Drawdown (30d):  -12.5%
Current Drawdown:    -3.2%

Sharpe Ratio:        1.85 ✅ Excellent
Sortino Ratio:       2.31 ✅ Excellent
Beta (vs BTC):       1.12

🎯 POSITION LIMITS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Max Single Position: $9,046 (20%)
Recommended Trade:   $904 (2% risk)
Kelly Optimal:       $2,261 (5%)

📈 CORRELATION MATRIX
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       BTC    ETH    SOL
BTC   1.00   0.85   0.72
ETH   0.85   1.00   0.68
SOL   0.72   0.68   1.00

Diversification Score: 65/100 ⚠️
Suggestion: Add uncorrelated assets

⚡ STRESS SCENARIOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-10% Market Crash:   -$4,789 (-10.6%)
-30% Bear Market:    -$15,234 (-33.7%)
2020 COVID Crash:    -$22,851 (-50.5%)
```

## Configuration

```yaml
# TOOLS.md
risk_calculator:
  # Risk limits
  max_portfolio_var: 0.05       # 5% max daily VaR
  max_position_size: 0.20       # 20% max single position
  max_correlation: 0.85         # Alert if assets >85% correlated
  min_sharpe: 0.5               # Alert if Sharpe drops below
  
  # Position sizing
  default_risk_per_trade: 0.02  # 2% risk per trade
  kelly_fraction: 0.25          # Use 1/4 Kelly (safer)
  
  # Alerts
  alerts:
    drawdown_warning: 0.10      # Warn at 10% drawdown
    drawdown_critical: 0.20     # Critical at 20%
    var_breach: true
    
  # Historical data period
  lookback_days: 90
```

## API

```python
from risk_calculator import RiskCalculator

calc = RiskCalculator()

# Portfolio risk analysis
risk = await calc.analyze_portfolio(portfolio)
print(f"Daily VaR (95%): ${risk.var_95:,.2f}")
print(f"Sharpe Ratio: {risk.sharpe:.2f}")
print(f"Max Drawdown: {risk.max_drawdown:.1%}")

# Position sizing
size = calc.calculate_position_size(
    portfolio_value=50000,
    risk_per_trade=0.02,  # 2%
    entry_price=50000,
    stop_loss=48000
)
print(f"Position size: {size.quantity} BTC (${size.value:,.0f})")

# Correlation matrix
corr = await calc.correlation_matrix(assets=["BTC", "ETH", "SOL"])
print(corr)

# Stress test
scenarios = await calc.stress_test(portfolio)
for s in scenarios:
    print(f"{s.name}: {s.impact:+.1%}")
```

## Risk Formulas

### Value at Risk (VaR)
```
VaR = Portfolio Value × Z-score × σ × √t

Where:
- Z-score: 1.645 for 95%, 2.326 for 99%
- σ: Portfolio volatility
- t: Time period (days)
```

### Sharpe Ratio
```
Sharpe = (Rp - Rf) / σp

Where:
- Rp: Portfolio return
- Rf: Risk-free rate
- σp: Portfolio standard deviation
```

### Kelly Criterion
```
f* = (p × b - q) / b

Where:
- p: Probability of winning
- q: Probability of losing (1 - p)
- b: Win/loss ratio

Conservative: Use f*/4 to f*/2
```

### Maximum Drawdown
```
MDD = (Peak - Trough) / Peak × 100%
```

## Dependencies
- numpy>=1.24.0
- pandas>=2.0.0
- scipy>=1.10.0
