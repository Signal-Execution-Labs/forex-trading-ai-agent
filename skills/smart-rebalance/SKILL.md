# Smart Rebalance Bot

AI-powered portfolio rebalancing with tax awareness.

## Overview
Like Pionex Rebalancing Bot, but smarter: considers taxes, gas fees, and market conditions before making moves.

## Rebalancing Strategies

### 1. Threshold Rebalancing
```yaml
targets:
  BTC: 40%
  ETH: 30%
  SOL: 20%
  USDC: 10%

threshold: 5%  # Rebalance when >5% drift

# Current: BTC 48%, ETH 28%, SOL 16%, USDC 8%
# Action: Sell 8% BTC, buy 4% SOL, buy 2% USDC
```

### 2. Calendar Rebalancing
```yaml
schedule: monthly  # weekly, monthly, quarterly
day: 1            # First of month
time: "09:00"     # After market opens
```

### 3. Smart Rebalancing
```yaml
mode: smart
considerations:
  - tax_lots: true      # Sell highest cost basis first
  - gas_threshold: $10  # Skip if gas > $10
  - min_trade: $50      # Don't rebalance tiny amounts
  - market_hours: true  # Avoid weekends
  - volatility: true    # Pause during high vol
```

## Tax-Loss Harvesting
```
Opportunity Found:
├── Asset: SOL
├── Cost Basis: $120
├── Current Price: $95
├── Loss: -$25/coin (208 coins = -$5,200)
├── Tax Savings: ~$1,560 (at 30% rate)
└── Action: Sell SOL, buy similar asset (AVAX)

Wait 30 days → Buy back SOL (wash sale rule)
```

## Fee Optimization
```
Rebalance Plan:
├── Direct Route: 3 trades, $45 fees
├── Optimized Route: 2 trades via ETH, $28 fees
└── Savings: $17 ✓

Also considering:
├── Batch with pending trades
├── Use limit orders (maker fees)
└── Wait for lower gas (evening)
```

## Risk Parity Mode
```yaml
mode: risk_parity
target_vol: 15%  # Portfolio volatility target

# Automatically adjusts weights based on:
# - Asset volatility (more volatile = less weight)
# - Correlation (diversification bonus)
# - Current market regime
```

## Drift Alerts
```
📊 Portfolio Drift Report

BTC: 40% → 46% (+6%) ⚠️ Over threshold
ETH: 30% → 32% (+2%) ✓ OK
SOL: 20% → 14% (-6%) ⚠️ Under threshold
USDC: 10% → 8% (-2%) ✓ OK

Suggested Action: Rebalance (est. cost: $12)
```

## Commands
```bash
kit rebalance preview  # Show what would change
kit rebalance execute  # Run rebalance
kit rebalance set --btc 40 --eth 30 --sol 20 --usdc 10
kit rebalance schedule --frequency monthly
kit rebalance tax-harvest  # Find tax loss opportunities
kit rebalance history  # Past rebalances
```

## Integrations
- CEX: Binance, Coinbase, Kraken
- DEX: Uniswap, 1inch
- Wallets: MetaMask, Ledger
- Tax: Koinly, CoinTracker export
