# Social Activity Feed

**Skill #63** | **Category:** Social | **Inspired by:** Zapper Feed, eToro Social, Nansen Smart Money

Follow wallets, track whale moves, see what smart money is doing - all in a social media style feed.

## Features

### Wallet Following
- Follow any wallet address with custom labels
- Auto-discover smart money wallets (Nansen-style)
- Whale wallet watchlists
- Institution/fund wallet tracking
- Friend/community wallet feeds

### Activity Types Tracked
| Activity | Description |
|----------|-------------|
| Swaps | Token exchanges on DEXs |
| Transfers | Token/NFT movements |
| Mints | New NFT mints |
| Stakes | Staking deposits/withdrawals |
| Borrows | DeFi lending activity |
| Claims | Reward/airdrop claims |
| Bridges | Cross-chain transfers |
| Approvals | Token approvals |
| Contract Deploys | New contract deployments |

### Smart Money Insights
- **Trending tokens**: What are whales buying?
- **Fresh wallet alerts**: Newly funded wallets (potential insider)
- **Accumulation patterns**: Quiet accumulation detection
- **Exit signals**: Smart money selling patterns
- **Copy trade triggers**: Auto-copy when whale buys

### Feed Filters
- By wallet label (whales, friends, funds)
- By chain (ETH, Polygon, Arbitrum, etc.)
- By activity type (swaps, mints, stakes)
- By value (>$10k, >$100k, >$1M)
- By token (specific token activity)
- By protocol (Uniswap, Aave, etc.)

### Notifications
- Telegram/Discord alerts for followed wallets
- Custom notification rules per wallet
- Smart money movement alerts
- Whale transaction alerts
- New listing alerts (tokens appearing in whale wallets)

## Configuration

```yaml
# kit.yaml
skills:
  - social-feed

social-feed:
  following:
    - address: "0x..."
      label: "Whale #1"
      tags: [whale, smart-money]
      notify: true
    - address: "0x..."
      label: "Friend Wallet"
      tags: [friend]
      notify: false
  
  watchlists:
    - name: "Ethereum Whales"
      autoDiscover: true
      minBalance: 10000000  # $10M USD
      chains: [ethereum]
    - name: "Arbitrum Degens"
      autoDiscover: true
      minActivity: 50  # 50 tx/week
      chains: [arbitrum]
  
  filters:
    minValue: 1000  # Only show >$1k transactions
    hideSpam: true
    
  notifications:
    telegram: true
    discord: false
    minValue: 10000  # Only notify for >$10k
    
  copyTrade:
    enabled: false
    maxFollow: 5
    maxCopyAmount: 1000  # USD per copy
    slippage: 1  # percent
```

## Usage

### CLI Commands

```bash
# View feed
kit social feed --limit 50

# Follow a wallet
kit social follow 0x... --label "Whale"

# Unfollow
kit social unfollow 0x...

# View followed wallets
kit social following

# Filter feed
kit social feed --type swap --min-value 100000

# Smart money insights
kit social smart-money --chain ethereum

# Trending tokens by whale activity
kit social trending

# Copy trade setup
kit social copy-trade 0x... --max-amount 500
```

### API Endpoints

```
GET  /api/social/feed?limit=50&type=swap&minValue=1000
POST /api/social/follow
DELETE /api/social/follow/:address
GET  /api/social/following
GET  /api/social/smart-money/:chain
GET  /api/social/trending/:timeframe
GET  /api/social/wallet/:address/activity
POST /api/social/copy-trade
GET  /api/social/whale-alerts
```

### Programmatic Access

```typescript
import { SocialFeed } from 'kit-trading/skills/social-feed';

const feed = new SocialFeed();

// Follow a whale
await feed.follow('0x...', { label: 'Known Whale', notify: true });

// Get activity feed
const activities = await feed.getFeed({
  limit: 50,
  minValue: 10000,
  types: ['swap', 'mint']
});

// Smart money insights
const trending = await feed.getTrendingTokens('24h');
console.log('Whales are buying:', trending);

// Set up copy trading
await feed.enableCopyTrade('0x...', {
  maxAmount: 500,
  slippage: 1,
  tokens: ['ETH', 'ARB']  // Only copy these
});

// Real-time alerts
feed.on('whaleMove', (activity) => {
  console.log(`${activity.label} ${activity.type}: $${activity.valueUsd}`);
});
```

## Dashboard UI

Access at `http://localhost:3000/social` when K.I.T. dashboard is running.

### Views
- **Feed**: Twitter/Zapper-style scrolling activity feed
- **Following**: Manage followed wallets
- **Smart Money**: Whale/fund tracking dashboard
- **Trending**: Hot tokens by smart money activity
- **Copy Trade**: Manage copy trading settings

## Comparison

| Feature | Zapper | Nansen | Arkham | K.I.T. |
|---------|--------|--------|--------|--------|
| Activity feed | ✅ | Limited | ✅ | ✅ |
| Smart money | ❌ | ✅ | ✅ | ✅ |
| Copy trade | ❌ | ❌ | ❌ | ✅ |
| Real-time alerts | Limited | ✅ | ✅ | ✅ |
| Self-hosted | ❌ | ❌ | ❌ | ✅ |
| Price | Free | $150/mo | $150/mo | **Free** |

## Privacy

- All data from public blockchain
- No centralized tracking
- Your follows stay local
- Copy trade keys encrypted locally
