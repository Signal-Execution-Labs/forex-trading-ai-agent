# Portfolio Rebalancer Skill

Automated portfolio rebalancing across multiple exchanges and asset classes with intelligent drift detection and tax-efficient execution.

## Overview

The Portfolio Rebalancer maintains target asset allocations across your entire portfolio, automatically executing trades when drift exceeds thresholds. Supports multiple rebalancing strategies and tax-lot optimization.

## Features

### Multi-Exchange Support
- **CEX**: Binance, Coinbase, Kraken, Bybit, OKX
- **DEX**: Uniswap, SushiSwap, PancakeSwap, 1inch
- **TradFi**: MT5 (Forex), Interactive Brokers (Stocks)
- **Wallets**: MetaMask, Ledger, cold storage tracking

### Rebalancing Strategies

1. **Threshold-Based**
   - Rebalance when asset drift exceeds X% (default: 5%)
   - Only touch drifted assets, minimize trades

2. **Calendar-Based**
   - Rebalance on fixed schedule (daily/weekly/monthly)
   - Full portfolio adjustment to targets

3. **Cash-Flow Based**
   - Rebalance using incoming deposits/dividends
   - No selling - only buy underweight assets

4. **Band Rebalancing**
   - Target: 60% / Bands: 55-65%
   - Only rebalance when outside bands

5. **Tactical Overlay**
   - AI-adjusted targets based on market conditions
   - Momentum/sentiment modifiers

### Tax Optimization

- **Tax-Loss Harvesting**: Automatically sell losers to offset gains
- **FIFO/LIFO/HIFO**: Configurable tax lot selection
- **Wash Sale Prevention**: 30-day purchase blocking
- **Long-Term Holding**: Avoid selling assets < 1 year when possible
- **Jurisdiction-Aware**: US, DE, UK, EU rules

### Risk Management

- **Correlation Monitoring**: Alert if portfolio becomes too correlated
- **Sector/Asset Exposure Limits**: Max % per sector/coin
- **Drawdown Protection**: Reduce equity % if portfolio drops >X%
- **Cash Reserve**: Maintain minimum cash buffer

## Configuration

```yaml
portfolio_rebalancer:
  enabled: true
  
  # Target allocation (must sum to 100%)
  targets:
    BTC: 40%
    ETH: 25%
    SOL: 10%
    USDC: 15%     # Stablecoin reserve
    SPY: 10%      # S&P 500 ETF via MT5
  
  # Strategy
  strategy: threshold
  drift_threshold: 5%        # Rebalance when drift > 5%
  min_trade_value: $100      # Ignore tiny rebalances
  
  # Execution
  execution:
    slippage_tolerance: 0.5%
    use_limit_orders: true
    split_large_orders: true  # Split orders > $10k
    prefer_dex: false         # Use CEX by default
  
  # Tax settings (US)
  tax:
    enable_tlh: true           # Tax-loss harvesting
    lot_selection: hifo        # Highest-in-first-out
    wash_sale_days: 30
    long_term_preference: true # Prefer selling long-term lots
  
  # Risk limits
  risk:
    max_single_asset: 50%
    max_correlation: 0.8
    min_cash_reserve: 10%
    drawdown_reduce_at: 20%
  
  # Schedule (for calendar strategy)
  schedule:
    type: weekly
    day: monday
    time: "09:00"
    timezone: America/New_York
```

## Commands

### Check Portfolio Status
```
kit portfolio status
```
Shows current allocations vs targets, drift %, and recommended actions.

### Preview Rebalance
```
kit rebalance preview
```
Shows trades that would be executed without actually trading.

### Execute Rebalance
```
kit rebalance execute
```
Executes the rebalancing trades.

### Set Targets
```
kit rebalance set-target BTC 45%
kit rebalance set-target ETH 30%
```

### View History
```
kit rebalance history
```
Shows past rebalancing events and performance.

## Integration with K.I.T.

The Portfolio Rebalancer integrates deeply with K.I.T.'s autonomous agent:

1. **Automatic Monitoring**: Runs on heartbeat, checks drift every 4 hours
2. **Smart Execution**: Uses Smart Order Router skill for best execution
3. **Tax Reports**: Feeds into Tax Calculator skill
4. **Notifications**: Sends alerts via configured channels

## Example Session

```
You: What's my portfolio drift?

K.I.T.: 📊 Portfolio Drift Analysis

Current vs Target:
┌─────────┬─────────┬─────────┬─────────┐
│ Asset   │ Current │ Target  │ Drift   │
├─────────┼─────────┼─────────┼─────────┤
│ BTC     │ 45.2%   │ 40.0%   │ +5.2%   │ ← Overweight
│ ETH     │ 22.1%   │ 25.0%   │ -2.9%   │
│ SOL     │ 8.4%    │ 10.0%   │ -1.6%   │
│ USDC    │ 14.8%   │ 15.0%   │ -0.2%   │
│ SPY     │ 9.5%    │ 10.0%   │ -0.5%   │
└─────────┴─────────┴─────────┴─────────┘

⚠️ BTC exceeds 5% drift threshold.

Recommended trades:
- Sell 0.012 BTC ($1,182) on Binance
- Buy 0.42 ETH ($1,050) on Coinbase
- Buy 2.1 SOL ($132) on Jupiter

Execute rebalance? [Yes/No/Preview]
```

## Files

- `rebalancer.ts` - Core rebalancing logic
- `drift-detector.ts` - Drift calculation and monitoring
- `tax-optimizer.ts` - Tax-efficient trade selection
- `execution-planner.ts` - Multi-exchange execution planning
