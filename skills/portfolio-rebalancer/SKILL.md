# Portfolio Rebalancer

Automated portfolio rebalancing with multiple strategies.

## Rebalancing Methods

### 1. Calendar Rebalancing
- Daily, Weekly, Monthly, Quarterly
- Configurable day/time

### 2. Threshold Rebalancing  
- Trigger when allocation drifts X% from target
- Per-asset or portfolio-wide thresholds

### 3. Tactical Rebalancing
- AI-driven based on market conditions
- Momentum-adjusted allocations
- Risk-parity weighting

### 4. Tax-Loss Harvesting
- Sell losers to offset gains
- 30-day wash sale rule compliance
- Substitute asset selection

## Features

- **Multi-Exchange Support** - Binance, Coinbase, Kraken, etc.
- **Gas Optimization** - Batch transactions, optimal timing
- **Drift Visualization** - See how far from targets
- **What-If Analysis** - Preview rebalance before execution
- **Transaction Logs** - Full audit trail

## Commands

```
kit rebalance status
kit rebalance preview --method threshold
kit rebalance execute --dry-run
kit rebalance configure --method calendar --frequency weekly
kit rebalance tax-harvest --threshold 500
```

## Target Allocation Example

```json
{
  "BTC": 40,
  "ETH": 30,
  "SOL": 15,
  "USDC": 15
}
```
