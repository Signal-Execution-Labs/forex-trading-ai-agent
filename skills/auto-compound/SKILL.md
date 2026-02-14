# Auto Compound

Automatic yield compounding across DeFi protocols.

## Features

### Compounding Strategies
- **Time-Based** - Compound every X hours/days
- **Threshold-Based** - Compound when rewards > $X
- **Gas-Optimized** - Compound when gas is cheap
- **APY-Maximizing** - Calculate optimal frequency

### Supported Protocols
- **Yield Aggregators** - Yearn, Beefy, Convex
- **Lending** - Aave, Compound (auto-reinvest)
- **Staking** - Restake rewards automatically
- **LP Farming** - Harvest and reinvest

### Gas Optimization
- **Gas Price Monitoring** - Track gas trends
- **Batch Operations** - Combine multiple claims
- **Flashbots** - MEV-protected transactions
- **Cross-Chain** - Bridge to cheaper chains

### Calculations
- **Compound Calculator** - Preview compounding effects
- **Break-Even Analysis** - When does compounding pay off?
- **Gas ROI** - Is this compound worth the gas?

## Commands

```
kit compound configure --protocol beefy --strategy gas-optimized
kit compound status
kit compound preview --position <id>
kit compound execute --dry-run
kit compound calculator --principal 10000 --apy 15 --frequency daily
kit compound history
```

## Safety

- Slippage protection on swaps
- Failed transaction retry
- Emergency withdrawal
- Position monitoring
