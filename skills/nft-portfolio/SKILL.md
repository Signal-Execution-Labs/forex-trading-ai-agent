# NFT Portfolio Skill

**Category:** DeFi  
**Inspired by:** Zapper NFT, OpenSea Portfolio, Blur, NFTBank

## Overview

Complete NFT portfolio management across multiple chains and marketplaces. Track floor prices, rarity, profit/loss, and discover opportunities.

## Features

### 1. Portfolio Tracking
- **Multi-Chain**: Ethereum, Polygon, Solana, Base, Arbitrum, Optimism
- **Auto-Discovery**: Scan wallets for all NFTs
- **Floor Price**: Real-time floor tracking
- **Estimated Value**: Portfolio valuation in ETH/USD
- **Cost Basis**: Track purchase prices + gas
- **P&L**: Realized and unrealized gains

### 2. Collection Analytics
- **Floor History**: Price charts over time
- **Volume Tracking**: 24h, 7d, 30d volume
- **Holder Distribution**: Whale vs retail ratio
- **Listing Ratio**: % listed for sale
- **Wash Trade Detection**: Filter fake volume
- **Rarity Analysis**: Trait rarity scoring

### 3. Market Aggregation
- **OpenSea**: Largest marketplace
- **Blur**: Pro trading, zero fees
- **LooksRare**: Rewards program
- **X2Y2**: Low fees
- **Magic Eden**: Solana native
- **Tensor**: Solana pro trading

### 4. Trading Tools
- **Bulk Listing**: List multiple NFTs at once
- **Sweep Floor**: Buy cheapest listings
- **Bid Management**: Track and manage bids
- **Auto-Accept**: Accept bids above threshold
- **Sniper**: Alert on underpriced listings

### 5. Alerts & Notifications
- Floor price drop/rise alerts
- New listing below floor
- Bid received
- Sale completed
- Collection trending
- Whale activity

## Commands

```
kit nft portfolio --wallet 0x123...abc
kit nft track <collection> --alert-floor 0.5
kit nft value --currency usd
kit nft rarity <token-id> --collection azuki
kit nft list <token-id> --price 1.5eth --marketplace blur
kit nft sweep <collection> --budget 5eth --max-price 0.1eth
kit nft bids --status active
kit nft analytics <collection> --period 30d
```

## Output Format

```json
{
  "portfolio": {
    "total_nfts": 47,
    "collections": 12,
    "estimated_value": {
      "eth": 15.234,
      "usd": 38085
    },
    "cost_basis": {
      "eth": 8.5,
      "usd": 21250
    },
    "unrealized_pnl": {
      "eth": "+6.734",
      "usd": "+$16,835",
      "percent": "+79.2%"
    }
  },
  "top_holdings": [
    {
      "collection": "Azuki",
      "count": 2,
      "floor": 5.2,
      "value": 10.4,
      "pnl": "+$8,500"
    },
    {
      "collection": "Pudgy Penguins",
      "count": 1,
      "floor": 3.1,
      "value": 3.1,
      "pnl": "+$2,100"
    }
  ],
  "recent_activity": [
    {
      "type": "sale",
      "collection": "Doodles",
      "price": 1.8,
      "profit": "+0.6 ETH",
      "time": "2h ago"
    }
  ]
}
```

## Rarity Analysis

```json
{
  "token_id": 4269,
  "collection": "Azuki",
  "rarity_rank": 847,
  "rarity_score": 156.7,
  "traits": [
    { "type": "Background", "value": "Red", "rarity": "3.2%" },
    { "type": "Clothing", "value": "Kimono", "rarity": "5.1%" },
    { "type": "Eyes", "value": "Closed", "rarity": "2.8%" }
  ],
  "price_premium": "+15% above floor (due to rarity)"
}
```

## Chain Support

| Chain | Status | Marketplaces |
|-------|--------|--------------|
| Ethereum | ✅ | OpenSea, Blur, X2Y2, LooksRare |
| Polygon | ✅ | OpenSea |
| Solana | ✅ | Magic Eden, Tensor |
| Base | ✅ | OpenSea |
| Arbitrum | ✅ | OpenSea |
| Bitcoin (Ordinals) | 🔜 | Magic Eden |
