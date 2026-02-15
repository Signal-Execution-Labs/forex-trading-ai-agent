# AI Portfolio Rebalancer

Intelligent portfolio rebalancing with tax-loss harvesting and drift detection.

## Features

- **Drift Detection** - Alert when allocations deviate from targets
- **Smart Rebalancing** - AI decides optimal rebalance timing
- **Tax-Loss Harvesting** - Automatically harvest losses for tax efficiency
- **Wash Sale Prevention** - Avoid wash sale violations automatically
- **Multi-Account Coordination** - Rebalance across all accounts as one
- **Transaction Cost Optimization** - Minimize fees and slippage
- **Model Portfolio Support** - Follow model portfolios with auto-adjustment

## Rebalancing Strategies

- **Calendar** - Rebalance on schedule (monthly, quarterly)
- **Threshold** - Rebalance when drift exceeds X%
- **Tactical** - AI-driven based on market conditions
- **Hybrid** - Combine multiple strategies

## Commands

```
kit rebalance status               # Current drift analysis
kit rebalance preview              # Preview rebalancing trades
kit rebalance execute              # Execute rebalancing
kit rebalance harvest              # Tax-loss harvest opportunities
kit rebalance history              # Rebalancing history
kit rebalance model <name>         # Follow model portfolio
```

## API Endpoints

- `GET /api/rebalance/status` - Drift analysis
- `GET /api/rebalance/preview` - Preview trades
- `POST /api/rebalance/execute` - Execute rebalance
- `GET /api/rebalance/harvest` - Tax-loss opportunities
- `GET /api/rebalance/models` - Available model portfolios

## Configuration

```yaml
rebalance:
  strategy: threshold
  threshold: 5%                # Drift threshold
  min_trade_size: $100
  tax_loss_harvest: true
  wash_sale_window: 30d
  exclude_assets: []
  schedule: quarterly          # For calendar strategy
```

## Tax-Loss Harvesting

- Identifies losing positions
- Sells for tax deduction
- Buys correlated replacement
- Tracks wash sale windows
- Estimates tax savings

## Model Portfolios

- Ray Dalio All Weather
- 60/40 Balanced
- Risk Parity
- Permanent Portfolio
- Custom models
