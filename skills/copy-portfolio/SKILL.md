# Copy Portfolio Skill

**Category:** Social Trading  
**Inspired by:** eToro CopyPortfolio, Shrimpy, Iconomi

## Overview

Copy entire portfolio allocations from top traders, not just individual trades. Automatically rebalance to match their holdings with smart DCA and risk management.

## Features

### 1. Portfolio Discovery
- **Top Performers**: Ranked by ROI, Sharpe, drawdown
- **Verified Traders**: KYC'd with track record
- **Strategy Types**: Growth, Income, DeFi, Meme, Blue Chip
- **Risk Profiles**: Conservative, Balanced, Aggressive
- **AUM Tracking**: See how much others are copying

### 2. Copy Modes
- **Mirror**: Exact allocation match (rebalance on change)
- **Proportional**: Scale to your budget
- **Selective**: Copy only certain assets
- **Delayed**: Wait X hours before copying (frontrun protection)
- **Signal-Only**: Get alerts but execute manually

### 3. Smart Rebalancing
- **Threshold-Based**: Rebalance when drift >X%
- **Time-Based**: Daily, weekly, monthly
- **Fee-Optimized**: Minimize trading fees
- **Tax-Aware**: Consider tax implications
- **DCA Entry**: Gradually enter new positions

### 4. Risk Controls
- **Max Allocation**: Cap per asset (e.g., 10% max)
- **Blacklist**: Exclude certain assets
- **Whitelist**: Only include approved assets
- **Leverage Limit**: Cap leverage copied
- **Stop Copying**: Auto-stop on drawdown

### 5. Performance Tracking
- **Your Returns**: Compare to copied trader
- **Slippage Analysis**: Entry price differences
- **Fee Impact**: Total fees paid
- **Attribution**: Which trades helped/hurt

## Commands

```
kit portfolio discover --sort roi --risk balanced --period 90d
kit portfolio copy <trader-id> --budget 5000 --mode mirror
kit portfolio list --status active
kit portfolio compare <trader-id> --my-returns vs --their-returns
kit portfolio stop <copy-id>
kit portfolio rebalance <copy-id> --now
kit portfolio blacklist add DOGE,SHIB
```

## Output Format

```json
{
  "copy_id": "CP-2026-001",
  "trader": {
    "id": "trader_xyz",
    "name": "CryptoWhale",
    "verified": true,
    "followers": 1250,
    "aum_copied": "$2.4M",
    "stats": {
      "roi_90d": "+45.2%",
      "sharpe": 1.85,
      "max_drawdown": "-12%",
      "win_rate": "68%"
    }
  },
  "your_copy": {
    "budget": 5000,
    "current_value": 5890,
    "pnl": "+$890 (+17.8%)",
    "mode": "proportional",
    "started": "2026-01-15",
    "last_rebalance": "2026-02-10"
  },
  "current_allocation": [
    { "asset": "BTC", "target": "40%", "actual": "41.2%", "value": 2427 },
    { "asset": "ETH", "target": "30%", "actual": "29.1%", "value": 1714 },
    { "asset": "SOL", "target": "15%", "actual": "15.8%", "value": 931 },
    { "asset": "LINK", "target": "10%", "actual": "9.5%", "value": 560 },
    { "asset": "USDC", "target": "5%", "actual": "4.4%", "value": 258 }
  ],
  "pending_changes": [
    {
      "action": "Trader added AVAX (5%)",
      "status": "pending_rebalance",
      "execute_at": "2026-02-12 09:00"
    }
  ]
}
```

## Trader Leaderboard

| Rank | Trader | ROI (90d) | Sharpe | Risk | Copiers |
|------|--------|-----------|--------|------|---------|
| 1 | CryptoWhale | +45.2% | 1.85 | Medium | 1,250 |
| 2 | DeFiKing | +38.7% | 2.10 | High | 890 |
| 3 | SafeHODLer | +22.1% | 2.45 | Low | 2,100 |
| 4 | AltSeason | +67.3% | 1.20 | High | 450 |
| 5 | IndexFund | +18.5% | 2.80 | Low | 3,200 |

## Becoming a Copyable Trader

K.I.T. users can also become traders:
- Connect verified portfolio
- Set fee structure (0-2% mgmt, 0-20% perf)
- Build track record (min 90 days)
- Earn when others copy you
- Dashboard shows your copiers and AUM

## Integration

- Works with portfolio-tracker skill
- Syncs with tax-calculator
- Alerts via signal-bot skill
- Performance in performance-report
