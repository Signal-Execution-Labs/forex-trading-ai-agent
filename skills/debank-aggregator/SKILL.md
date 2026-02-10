# DeBank DeFi Portfolio Aggregator

**K.I.T. Skill for comprehensive DeFi portfolio tracking via DeBank**

## Overview

DeBank is the leading DeFi portfolio tracker, supporting 1,300+ protocols across all major EVM chains. This skill integrates DeBank's data to provide:

- Multi-chain portfolio aggregation
- Real-time position tracking (LP, lending, staking, vesting)
- Protocol health monitoring
- Whale wallet tracking
- Transaction history analysis
- NFT holdings

## Features

### Portfolio Tracking
- **Multi-Chain Support**: Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, Fantom, Base, zkSync, and 50+ more chains
- **Protocol Coverage**: Uniswap, Aave, Compound, Curve, Convex, Lido, Yearn, GMX, and 1,300+ protocols
- **Position Types**: Tokens, LP positions, lending, borrowing, staking, farming, vesting, NFTs

### Wallet Intelligence
- **Whale Tracking**: Monitor high-value wallets and their movements
- **Social Features**: Follow wallets, see what "smart money" is doing
- **Transaction Analysis**: Detailed tx history with protocol interactions

### Risk Monitoring
- **Protocol Health**: Track TVL changes, audits, risks
- **Position Health**: Monitor liquidation risks, IL exposure
- **Chain Exposure**: Understand cross-chain risk distribution

## Usage

### Quick Commands

```typescript
import { DeBank } from '@kit/skills/debank-aggregator';

// Get full portfolio for an address
const portfolio = await DeBank.getPortfolio('0x...');

// Get positions in a specific protocol
const aavePositions = await DeBank.getProtocolPositions('0x...', 'aave');

// Track whale wallets
const whales = await DeBank.getWhaleActivity({ minValue: 1_000_000 });

// Get token balances across all chains
const balances = await DeBank.getTokenBalances('0x...');

// NFT holdings
const nfts = await DeBank.getNFTHoldings('0x...');
```

### K.I.T. Agent Integration

```
User: "What's the total value of my DeFi positions?"

K.I.T.: Uses debank-aggregator to fetch all positions:
- Lido stETH: $45,230
- Aave USDC lending: $12,500
- Uniswap V3 ETH/USDC LP: $8,340
- Convex CRV staking: $3,200
Total DeFi Value: $69,270
```

## API Reference

### DeBank Open API

DeBank provides a comprehensive API (some endpoints require API key):

**Free Endpoints:**
- `/v1/user/total_balance` - Total balance across chains
- `/v1/user/chain_balance` - Balance per chain
- `/v1/user/token_list` - Token holdings
- `/v1/user/complex_protocol_list` - Protocol positions

**Pro Endpoints (API Key Required):**
- `/v1/user/history_list` - Transaction history
- `/v1/user/nft_list` - NFT holdings
- `/v1/protocol/list` - All supported protocols
- `/v1/whale/list` - Whale wallet data

### Rate Limits
- Free: 10 requests/second
- Pro: 100 requests/second

## Configuration

```json
{
  "debank": {
    "apiKey": "YOUR_DEBANK_API_KEY",  // Optional, for pro features
    "watchlist": [
      "0x...",  // Your wallets
      "0x..."   // Whale wallets to track
    ],
    "alerts": {
      "portfolioChange": 10,  // Alert on 10% change
      "protocolRisk": true,   // Alert on protocol issues
      "whaleMovement": 100000 // Alert on $100k+ whale moves
    }
  }
}
```

## K.I.T. Advantages over DeBank UI

1. **Automation**: Auto-rebalance when positions drift
2. **Alerts**: Custom alerts via Telegram, Discord, etc.
3. **Cross-Platform**: Combine DeFi data with CEX, forex, stocks
4. **AI Analysis**: K.I.T. analyzes positions and suggests optimizations
5. **Tax Integration**: Feed data to tax-tracker skill
6. **Copy Trading**: Copy whale strategies automatically

## Example Workflows

### Daily Portfolio Check
```
1. Fetch all positions via DeBank
2. Calculate daily P&L
3. Check liquidation risks
4. Send summary to user
```

### Whale Copy Trading
```
1. Monitor whale watchlist
2. Detect new positions
3. Analyze opportunity
4. Execute similar position (scaled)
5. Set stop-loss/take-profit
```

### Yield Optimization
```
1. Scan all yield positions
2. Compare with current rates
3. Identify better opportunities
4. Suggest/execute migration
```

## Files

- `debank-client.ts` - API client implementation
- `portfolio-tracker.ts` - Portfolio aggregation logic
- `whale-monitor.ts` - Whale tracking functionality
- `index.ts` - Skill exports
