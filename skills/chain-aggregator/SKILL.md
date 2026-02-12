# Cross-Chain Aggregator

One view for all your crypto across every chain.

## Overview
Inspired by DeBank + Zapper: aggregate positions from 50+ chains into a single dashboard. DeFi, NFTs, tokens - everything in one place.

## Supported Chains
```
EVM Chains:
├── Ethereum, Arbitrum, Optimism, Base
├── Polygon, zkSync, Scroll, Linea
├── BNB Chain, Avalanche, Fantom
└── 40+ more EVM chains

Non-EVM:
├── Solana, Bitcoin, Cosmos
├── Sui, Aptos, Near
└── Tron, TON
```

## Position Types

### Wallet Tokens
```yaml
Chain: Ethereum
├── ETH: 2.5 ($7,000)
├── USDC: 5,000 ($5,000)
├── UNI: 100 ($850)
└── Total: $12,850
```

### DeFi Positions
```yaml
Protocol: Aave v3
├── Supplied: 10,000 USDC (5.2% APY)
├── Borrowed: 5,000 DAI (3.8% APY)
├── Health: 1.85 (safe)
└── Net: +$5,000

Protocol: Uniswap v3
├── Pool: ETH/USDC
├── Liquidity: $4,200
├── Range: $2,500 - $3,500
├── In Range: ✅
├── Unclaimed Fees: $45
└── IL: -2.3%
```

### Staking
```yaml
Validator: Lido
├── Staked: 5 ETH ($14,000)
├── Rewards: 0.12 ETH ($336)
├── APY: 4.1%
└── Unbonding: None
```

### NFTs
```yaml
Collection: BAYC
├── Token #1234
├── Floor: 25 ETH
├── Rarity: Top 15%
└── Traits: Gold Fur, Laser Eyes
```

## Aggregation API
```typescript
const portfolio = await kit.aggregate({
  addresses: ['0x...', '0x...'],
  chains: 'all',  // or ['ethereum', 'arbitrum']
  include: {
    tokens: true,
    defi: true,
    nfts: true,
    staking: true
  }
});

// Returns unified portfolio object
console.log(portfolio.totalUSD);  // $45,230
console.log(portfolio.byChain);   // { ethereum: $30k, arbitrum: $15k }
```

## Data Sources
1. **DeBank API** - DeFi protocols
2. **Zapper API** - Position tracking
3. **Direct RPC** - Token balances
4. **Alchemy/Infura** - NFT metadata
5. **CoinGecko** - Price feeds

## Smart Features

### Gas Optimization
```
Suggested: Move $5k USDC from Ethereum to Arbitrum
Reason: 90% lower fees, same yield on Aave
Est. Savings: $120/year in gas
```

### Risk Alerts
```
⚠️ Aave Health Factor: 1.15 (liquidation risk)
⚠️ LP position out of range (no fees)
⚠️ Staking rewards unclaimed for 30 days
```

### Yield Comparison
```
Your USDC positions:
├── Aave (Ethereum): 5.2% APY ← Highest
├── Compound (Arbitrum): 4.8% APY
└── Venus (BNB): 6.1% APY (higher risk)
```

## Commands
```bash
kit chain-aggregate --addresses 0x123,0x456
kit chain-balances --chain ethereum
kit chain-defi --protocols aave,uniswap
kit chain-compare --asset USDC
kit chain-migrate --from ethereum --to arbitrum --asset USDC
```
