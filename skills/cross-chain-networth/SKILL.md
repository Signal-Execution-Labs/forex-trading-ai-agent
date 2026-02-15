# Cross-Chain Net Worth

DeBank-style unified portfolio tracking across all chains.

## Features

- **Multi-Chain Aggregation** - Track assets across 50+ EVM chains, Solana, Bitcoin, Cosmos
- **Real-Time Valuation** - Live portfolio value with 24h change tracking
- **DeFi Position Tracking** - Lending, borrowing, staking, LPs, yield farming
- **NFT Portfolio** - NFT holdings with floor price valuation
- **Transaction History** - Full history with gas fees and counterparties
- **Profit & Loss** - Realized/unrealized P&L per asset and position
- **Liquidation Monitoring** - Alerts when DeFi positions approach liquidation
- **Gas Optimization** - Track gas spent and suggest optimal transaction times

## Supported Chains

- Ethereum, Arbitrum, Optimism, Base, Polygon, BNB Chain
- Avalanche, Fantom, Gnosis, zkSync, Linea, Scroll
- Solana, Bitcoin, Cosmos ecosystem
- 40+ additional EVM chains

## Commands

```
kit networth                       # Total portfolio value
kit networth breakdown             # By chain breakdown
kit networth defi                  # DeFi positions only
kit networth nft                   # NFT holdings
kit networth history               # Historical value chart
kit networth export                # Export to CSV/JSON
```

## API Endpoints

- `GET /api/networth/total` - Aggregate net worth
- `GET /api/networth/chains` - Per-chain breakdown
- `GET /api/networth/defi` - DeFi positions
- `GET /api/networth/nft` - NFT holdings
- `GET /api/networth/history` - Historical snapshots
- `GET /api/networth/pnl` - Profit and loss

## Configuration

```yaml
networth:
  wallets:
    - "0x..." # Ethereum
    - "5P..." # Solana
  refresh_interval: 60s
  track_nfts: true
  track_defi: true
  alert_on_liquidation: true
  alert_threshold: 85%
```

## Data Sources

- DeBank API
- Zapper API
- Direct RPC queries
- CoinGecko/CoinMarketCap for pricing
