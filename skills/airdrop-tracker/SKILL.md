# Airdrop Tracker Skill

**Category:** DeFi  
**Inspired by:** DeBank Airdrop, Earndrop, LayerZero Checker, Starknet Checker

## Overview

Track airdrop eligibility across protocols, optimize farming strategies, and never miss a claim. Scans your wallets against known criteria and upcoming opportunities.

## Features

### 1. Eligibility Checker
- **Wallet Scan**: Check all connected wallets
- **Multi-Protocol**: 100+ protocols tracked
- **Criteria Matching**: Compare against known requirements
- **Score Calculation**: Eligibility likelihood score
- **Historical Activity**: Review past interactions

### 2. Active Airdrops
- **Claimable Now**: Airdrops ready to claim
- **Upcoming**: Announced but not live
- **Speculative**: Likely airdrops (no token yet)
- **Deadline Alerts**: Don't miss claim windows

### 3. Farming Optimizer
- **Activity Suggestions**: What to do to qualify
- **Cost Analysis**: Gas cost vs expected airdrop
- **Priority Ranking**: Best ROI opportunities
- **Sybil Detection**: Avoid disqualification patterns
- **Bridge Recommendations**: Which bridges to use

### 4. Protocol Tracking
- **Layer 2s**: zkSync, Starknet, Scroll, Linea, Base
- **Bridges**: LayerZero, Wormhole, Hyperlane
- **DeFi**: Uniswap, Aave, Compound forks
- **Social**: Lens, Farcaster, friend.tech
- **Infrastructure**: The Graph, Chainlink, EigenLayer

### 5. Claim Management
- **Auto-Claim**: Claim airdrops automatically
- **Gas Optimization**: Wait for low gas
- **Tax Tracking**: Record claim value for taxes
- **Consolidation**: Claim to single wallet

## Commands

```
kit airdrop check --wallet 0x123...abc
kit airdrop eligible --protocol zksync
kit airdrop farm --budget 500 --risk medium
kit airdrop claim --all --max-gas 30gwei
kit airdrop upcoming --category l2
kit airdrop history --wallet 0x123...abc
kit airdrop optimize --wallets 3
```

## Output Format

```json
{
  "wallet": "0x123...abc",
  "scan_date": "2026-02-11",
  "claimable": [
    {
      "protocol": "Jupiter",
      "token": "JUP",
      "amount": 250,
      "value_usd": 125,
      "deadline": "2026-03-15",
      "claim_url": "https://..."
    }
  ],
  "eligible": [
    {
      "protocol": "zkSync",
      "status": "likely_eligible",
      "score": 85,
      "criteria_met": [
        "✅ 10+ transactions",
        "✅ 3+ months active",
        "✅ $500+ volume",
        "✅ Used bridge",
        "❌ NFT mint (optional)"
      ],
      "estimated_value": "$500-2000",
      "recommendation": "Mint an NFT on zkSync to maximize allocation"
    }
  ],
  "farming_opportunities": [
    {
      "protocol": "Scroll",
      "current_score": 45,
      "potential_score": 90,
      "actions": [
        { "action": "Bridge via official bridge", "cost": "$5", "impact": "+20" },
        { "action": "Swap on Ambient", "cost": "$3", "impact": "+15" },
        { "action": "Deploy a contract", "cost": "$10", "impact": "+25" }
      ],
      "total_cost": "$18",
      "expected_airdrop": "$800-3000"
    }
  ],
  "warnings": [
    "⚠️ LayerZero: Sybil detection active - vary transaction times",
    "⚠️ Starknet: Snapshot may be soon - act within 7 days"
  ]
}
```

## Sybil Prevention Tips

K.I.T. helps you farm legitimately:
- Vary transaction amounts (not round numbers)
- Spread activity over weeks/months
- Use different times of day
- Don't batch identical transactions
- Maintain unique activity patterns per wallet

## Supported Protocols (100+)

| Category | Protocols |
|----------|-----------|
| L2 Rollups | zkSync, Starknet, Scroll, Linea, Taiko, Blast |
| Bridges | LayerZero, Wormhole, Hyperlane, Across |
| DeFi | EigenLayer, Symbiotic, Pendle, GMX |
| Social | Farcaster, Lens, CyberConnect |
| Gaming | IMX, Ronin, Beam |

## Tax Integration

- Records claim date and USD value
- Tracks cost basis from farming
- Exports to tax-calculator skill
- Supports FIFO/LIFO/HIFO methods
