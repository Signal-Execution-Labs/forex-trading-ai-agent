# Skill #84: Risk Parity Balancer

Allocates portfolio weights based on **risk contribution** rather than capital weights. Each asset contributes equally to total portfolio risk.

## Why Risk Parity?

Traditional portfolios (60/40 stocks/bonds) are dominated by stock risk:
- 60% stocks = ~90% of portfolio risk
- 40% bonds = ~10% of portfolio risk

Risk parity ensures **each asset contributes equally** to volatility.

## Features

### Core Functionality
- **Equal Risk Contribution (ERC)**: Each asset contributes 1/N of total risk
- **Inverse Volatility**: Weight inversely proportional to volatility
- **Correlation-Aware**: Accounts for asset correlations via covariance matrix
- **Leverage Targeting**: Optional leverage to hit target volatility (e.g., 10%)

### Supported Modes
| Mode | Description | Use Case |
|------|-------------|----------|
| `inverse-vol` | 1/volatility weighting | Simple, correlation-agnostic |
| `erc` | Equal Risk Contribution | Full covariance optimization |
| `hierarchical` | Hierarchical Risk Parity (HRP) | Handles instability in correlation |
| `minimum-variance` | Min variance portfolio | Risk minimization |

### Risk Metrics Calculated
- Individual asset volatility (rolling window)
- Correlation matrix (Pearson, Spearman, or shrunk)
- Marginal Risk Contribution (MRC) per asset
- Risk Contribution (RC) as percentage
- Portfolio Sharpe ratio (pre/post rebalance)

## Usage

```
kit skill risk-parity-balancer --assets BTC,ETH,SOL,USDC --mode erc
kit skill risk-parity-balancer --portfolio my-crypto --target-vol 12
kit skill risk-parity-balancer --lookback 90d --rebalance weekly
```

### Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--assets` | - | Comma-separated asset list |
| `--portfolio` | - | Portfolio ID to rebalance |
| `--mode` | `erc` | Weighting mode (inverse-vol, erc, hrp, min-var) |
| `--lookback` | `60d` | Volatility/correlation lookback period |
| `--target-vol` | - | Target annual volatility (enables leverage) |
| `--max-leverage` | `3.0` | Maximum leverage allowed |
| `--min-weight` | `0.02` | Minimum weight per asset (2%) |
| `--max-weight` | `0.40` | Maximum weight per asset (40%) |
| `--rebalance` | `manual` | Rebalance frequency (daily, weekly, monthly) |
| `--correlation` | `pearson` | Correlation method |

## Example Output

```
🎯 Risk Parity Analysis

Assets: BTC, ETH, SOL, USDC
Mode: Equal Risk Contribution (ERC)
Lookback: 60 days

📊 Current Allocation:
Asset   Weight   Vol(ann)   Risk Contrib
BTC     40.0%    65%        58.2%  ⚠️
ETH     30.0%    75%        31.5%
SOL     20.0%    95%        9.8%
USDC    10.0%    0.1%       0.5%

📐 Risk Parity Weights:
Asset   New Weight   Risk Contrib   Change
BTC     18.5%        25.0%          -21.5%
ETH     15.2%        25.0%          -14.8%
SOL     8.3%         25.0%          -11.7%
USDC    58.0%        25.0%          +48.0%

📈 Portfolio Impact:
Before: 52% annual vol, Sharpe 0.85
After:  15% annual vol, Sharpe 1.42 (+67%)
```

## Algorithm

### Equal Risk Contribution (ERC)

Objective: Minimize difference in risk contributions:

```
min Σᵢ Σⱼ (wᵢ(Σw)ᵢ - wⱼ(Σw)ⱼ)²

Subject to:
- Σwᵢ = 1 (or leverage target)
- wᵢ ≥ min_weight
- wᵢ ≤ max_weight
```

Where:
- `wᵢ` = weight of asset i
- `Σ` = covariance matrix
- `(Σw)ᵢ` = marginal risk contribution of asset i

### Hierarchical Risk Parity (HRP)

1. Calculate correlation matrix
2. Apply hierarchical clustering (dendrogram)
3. Quasi-diagonalize matrix
4. Recursive bisection for weights
5. Apply constraints

## Integration

### With Other Skills
- **#43 Momentum Ranking**: Filter assets before risk parity
- **#51 Trailing Grid**: Use risk parity for grid sizing
- **#56 Tax Calculator**: Optimize for tax-efficient rebalancing
- **#21 DeFi Yield**: Include yield in return estimates

### Auto-Rebalance Hook
```javascript
// hooks/risk-parity-rebalance.js
module.exports = {
  name: 'risk-parity-rebalance',
  events: ['scheduler.daily'],
  async handler(event, context) {
    const weights = await context.skill('risk-parity-balancer', {
      portfolio: 'main',
      mode: 'erc',
      threshold: 0.05  // 5% drift trigger
    });
    
    if (weights.needsRebalance) {
      await context.trading.rebalance(weights.orders);
      await context.notify(`Rebalanced: ${weights.summary}`);
    }
  }
};
```

## References

- Maillard, Roncalli, Teïletche (2010): "The Properties of Equally Weighted Risk Contribution Portfolios"
- De Prado (2016): "Building Diversified Portfolios that Outperform Out of Sample"
- Roncalli (2013): "Introduction to Risk Parity and Budgeting"

## Related Skills

- **#15 Risk Manager**: Sets overall risk limits
- **#17 Portfolio Allocator**: Capital-weighted allocation
- **#44 Correlation Analyzer**: Deep dive into correlations
- **#83 Deal Manager**: Manages individual position sizing
