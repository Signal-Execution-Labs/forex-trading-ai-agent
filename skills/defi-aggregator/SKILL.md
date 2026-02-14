# DeFi Aggregator

Zapper/DeBank-style DeFi portfolio tracking across all chains.

## Supported Chains

- Ethereum, Polygon, Arbitrum, Optimism
- BSC, Avalanche, Fantom
- Solana, Base, zkSync
- 50+ EVM chains

## Features

### Portfolio View
- **Net Worth** - Total value across all chains
- **Asset Breakdown** - Tokens, NFTs, LP positions
- **Protocol Exposure** - Where your money is deployed
- **Historical Value** - Portfolio chart over time

### Position Tracking
- **Lending** - Aave, Compound, Morpho positions
- **Liquidity Pools** - Uniswap, Curve, Balancer
- **Staking** - Native staking, Liquid staking (Lido, Rocket Pool)
- **Yield Farms** - APY tracking, reward claiming
- **Vaults** - Yearn, Beefy, Convex

### Health Monitoring
- **Liquidation Alerts** - Warning before liquidation
- **IL Tracking** - Impermanent loss calculation
- **Reward Claiming** - Optimal claim timing
- **Gas Alerts** - Notify when gas is low

## Commands

```
kit defi portfolio
kit defi positions --chain ethereum
kit defi health-check
kit defi rewards --claimable
kit defi optimize --strategy gas-efficient
kit defi track <wallet-address>
```

## Integrations

- 300+ DeFi protocols tracked
- Real-time price feeds
- Transaction history parsing
- Tax report generation
