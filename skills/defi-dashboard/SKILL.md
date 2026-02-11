# DeFi Dashboard

**Skill #62** | **Category:** DeFi | **Inspired by:** Zapper, DeBank, Zerion

A comprehensive DeFi portfolio dashboard that aggregates all your positions across chains and protocols in one unified view.

## Features

### Portfolio Aggregation
- **Multi-chain support**: Ethereum, Polygon, Arbitrum, Optimism, BSC, Avalanche, Base, zkSync
- **Auto-discovery**: Scans wallets for all positions automatically
- **Real-time updates**: WebSocket feeds for live price/position changes

### Position Tracking
| Position Type | Tracked Data |
|---------------|--------------|
| Tokens | Balance, USD value, 24h change |
| LP Positions | Pool tokens, underlying assets, fees earned |
| Staking | Staked amount, rewards accrued, APY |
| Lending | Supplied, borrowed, health factor |
| Yield Farming | Deposited, rewards, ROI |
| NFTs | Collection, floor price, rarity |
| Vesting | Unlocked, claimable, schedule |

### Protocol Support
- **DEXs**: Uniswap, SushiSwap, Curve, Balancer, PancakeSwap
- **Lending**: Aave, Compound, MakerDAO, Venus
- **Yield**: Yearn, Convex, Beefy, Harvest
- **Staking**: Lido, Rocket Pool, Frax
- **Derivatives**: GMX, dYdX, Perpetual Protocol

### Analytics
- Net worth tracking over time
- P&L by position/protocol/chain
- Impermanent loss calculator
- Gas spent tracker
- Portfolio allocation charts
- Historical performance

### Activity Feed (Zapper-style)
- Real-time on-chain activity
- Swaps, transfers, approvals, contract interactions
- Human-readable transaction descriptions
- Filter by type, protocol, value

### Alerts
- Price alerts for any token
- Health factor warnings for lending
- IL threshold alerts for LPs
- Whale activity notifications
- New airdrop eligibility

## Configuration

```yaml
# kit.yaml
skills:
  - defi-dashboard

defi-dashboard:
  wallets:
    - address: "0x..."
      label: "Main Wallet"
      chains: [ethereum, polygon, arbitrum]
    - address: "0x..."
      label: "DeFi Wallet"
      chains: all
  
  updateInterval: 60  # seconds
  
  alerts:
    healthFactor:
      enabled: true
      threshold: 1.5
    impermanentLoss:
      enabled: true
      threshold: 5  # percent
    largeTransfer:
      enabled: true
      minValue: 10000  # USD
  
  display:
    currency: USD
    showNFTs: true
    showDust: false  # hide <$1 positions
    groupBy: protocol  # protocol | chain | type
```

## Usage

### CLI Commands

```bash
# View full dashboard
kit defi status

# Specific wallet
kit defi status --wallet 0x...

# Single chain
kit defi status --chain ethereum

# Activity feed
kit defi activity --limit 50

# Export for taxes
kit defi export --year 2025 --format csv

# Check health factors
kit defi health

# Find claimable rewards
kit defi claimable
```

### API Endpoints

```
GET /api/defi/portfolio/:wallet
GET /api/defi/positions/:wallet/:chain
GET /api/defi/activity/:wallet?limit=50
GET /api/defi/health/:wallet
GET /api/defi/claimable/:wallet
GET /api/defi/history/:wallet?days=30
POST /api/defi/alerts
GET /api/defi/gas-tracker
```

### Programmatic Access

```typescript
import { DeFiDashboard } from 'kit-trading/skills/defi-dashboard';

const dashboard = new DeFiDashboard({
  wallets: ['0x...', '0x...'],
  chains: ['ethereum', 'polygon', 'arbitrum']
});

// Get full portfolio
const portfolio = await dashboard.getPortfolio();
console.log(`Net Worth: $${portfolio.netWorth}`);

// Check positions
for (const pos of portfolio.positions) {
  console.log(`${pos.protocol}: ${pos.type} - $${pos.valueUsd}`);
}

// Watch for changes
dashboard.on('positionChange', (change) => {
  console.log(`${change.type}: ${change.delta}`);
});

// Get activity feed
const activity = await dashboard.getActivity({ limit: 20 });
```

## Dashboard UI

Access at `http://localhost:3000/defi` when K.I.T. dashboard is running.

### Views
- **Overview**: Net worth, allocation pie chart, top positions
- **Positions**: Detailed list by protocol/chain/type
- **Activity**: Real-time feed with filters
- **Analytics**: Charts, P&L, performance metrics
- **Alerts**: Manage price/health alerts

## Comparison

| Feature | Zapper | DeBank | Zerion | K.I.T. |
|---------|--------|--------|--------|--------|
| Multi-chain | 11 | 50+ | 10 | 8+ |
| Activity feed | ✅ | ✅ | ✅ | ✅ |
| Alerts | Limited | ❌ | ✅ | ✅ Full |
| AI insights | ❌ | ❌ | ❌ | ✅ |
| Tax export | ❌ | ❌ | ❌ | ✅ |
| Self-hosted | ❌ | ❌ | ❌ | ✅ |
| API access | Paid | Limited | Paid | ✅ Free |
| Privacy | Tracked | Tracked | Tracked | ✅ Local |

## Data Sources

- On-chain data: Alchemy, Infura, public RPCs
- Token prices: CoinGecko, CoinMarketCap, DEX prices
- Protocol data: Direct contract reads, The Graph
- NFT data: OpenSea, Reservoir

## Privacy

All data is fetched directly from blockchain. No third-party tracking. Your wallet addresses stay on your machine.
