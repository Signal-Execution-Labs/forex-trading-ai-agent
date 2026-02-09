---
name: defi-yield
description: DeFi yield hunting across protocols. Find the best APY, auto-compound, manage LP positions, and optimize gas.
metadata:
  {
    "kit":
      {
        "emoji": "🌾",
        "category": "defi",
        "tier": "premium",
        "requires": { 
          "env": ["WALLET_PRIVATE_KEY"],
          "skills": ["defi-connector"]
        }
      }
  }
---

# DeFi Yield Hunter 🌾

**Maximize your yield.** Automatically find, enter, and manage the best yield opportunities across DeFi.

## Supported Protocols

### Lending
- Aave (Ethereum, Polygon, Arbitrum)
- Compound (Ethereum)
- Morpho (Ethereum)
- Spark (MakerDAO)

### DEXs & LPs
- Uniswap V3 (concentrated liquidity)
- Curve (stablecoins)
- Balancer (weighted pools)
- PancakeSwap (BSC)

### Yield Aggregators
- Yearn Finance
- Convex Finance
- Beefy Finance

### Staking
- Lido (ETH staking)
- Rocket Pool (ETH staking)
- Marinade (SOL staking)

### Liquid Staking
- stETH, rETH, cbETH
- mSOL, jitoSOL

## Yield Scanner

```bash
kit defi scan

# Output:
🌾 DeFi Yield Scanner
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Scanning 47 protocols across 8 chains...

TOP STABLE YIELDS (Low Risk):
┌─────────────────────────┬───────┬─────────┬───────────┐
│ Protocol / Pool         │ APY   │ TVL     │ Risk      │
├─────────────────────────┼───────┼─────────┼───────────┤
│ Aave USDC (Ethereum)    │ 5.2%  │ $2.1B   │ LOW ✅    │
│ Compound USDC           │ 4.8%  │ $1.5B   │ LOW ✅    │
│ Curve 3pool             │ 6.1%  │ $800M   │ LOW ✅    │
│ Spark DAI               │ 5.5%  │ $1.2B   │ LOW ✅    │
│ Morpho USDC             │ 7.2%  │ $450M   │ LOW ✅    │
└─────────────────────────┴───────┴─────────┴───────────┘

TOP LP YIELDS (Medium Risk):
┌─────────────────────────┬───────┬─────────┬───────────┐
│ Protocol / Pool         │ APY   │ TVL     │ Risk      │
├─────────────────────────┼───────┼─────────┼───────────┤
│ Uni V3 ETH/USDC         │ 25%   │ $350M   │ MED ⚠️   │
│ Curve stETH/ETH         │ 8.5%  │ $1.2B   │ LOW ✅    │
│ Balancer wstETH/ETH     │ 7.8%  │ $280M   │ LOW ✅    │
│ PancakeSwap CAKE/BNB    │ 45%   │ $120M   │ MED ⚠️   │
└─────────────────────────┴───────┴─────────┴───────────┘

DEGEN YIELDS (High Risk):
┌─────────────────────────┬───────┬─────────┬───────────┐
│ Protocol / Pool         │ APY   │ TVL     │ Risk      │
├─────────────────────────┼───────┼─────────┼───────────┤
│ New Farm XYZ            │ 500%  │ $5M     │ HIGH 🔴   │
│ Leveraged Yield ABC     │ 200%  │ $15M    │ HIGH 🔴   │
└─────────────────────────┴───────┴─────────┴───────────┘

💡 Recommendation:
Your $10,000 could earn:
• Conservative: $520/year (Aave USDC)
• Balanced: $1,250/year (Morpho + Curve)
• Aggressive: $2,500/year (Uni V3 LPing)
```

## Auto-Yield Strategy

```bash
kit defi auto-yield --capital 10000 --risk low

# Output:
🌾 Auto-Yield Strategy
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Capital: $10,000
Risk Level: LOW
Target APY: 5-8%

Recommended Allocation:
┌─────────────────────────┬────────┬───────┬──────────┐
│ Protocol                │ Amount │ APY   │ Expected │
├─────────────────────────┼────────┼───────┼──────────┤
│ Morpho USDC (ETH)       │ $4,000 │ 7.2%  │ $288/yr  │
│ Aave USDC (Arbitrum)    │ $3,000 │ 5.8%  │ $174/yr  │
│ Curve stETH/ETH         │ $2,000 │ 8.5%  │ $170/yr  │
│ Spark DAI               │ $1,000 │ 5.5%  │ $55/yr   │
└─────────────────────────┴────────┴───────┴──────────┘

Total Expected: $687/year (6.87% APY)
Estimated Gas: $45 (one-time setup)
Auto-compound: Weekly

Features:
✅ Multi-protocol diversification
✅ Auto-compound rewards
✅ Auto-rebalance monthly
✅ Exit to stables if >10% drawdown
✅ Gas-optimized transactions

[DEPLOY STRATEGY]
```

## LP Position Manager

```bash
kit defi lp ETH/USDC

# Output:
🌾 LP Position: ETH/USDC (Uniswap V3)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Position:
├─ Pool: ETH/USDC 0.3%
├─ Range: $2,800 - $3,400
├─ Liquidity: $5,000
├─ Current Price: $3,050 (in range ✅)
├─ ETH: 0.82 ($2,501)
├─ USDC: 2,499
└─ Unclaimed Fees: $127

Performance (30 days):
├─ Fees Earned: $312 (6.24%)
├─ IL (Impermanent Loss): -$89 (-1.78%)
├─ Net P&L: +$223 (+4.46%)
└─ Annualized: ~54% APY

Range Analysis:
├─ Time in Range: 87%
├─ Optimal Range: $2,700 - $3,300 (tighter)
└─ Suggestion: Narrow range for higher fees

Actions:
[COLLECT FEES] [REBALANCE] [CLOSE POSITION]
```

## Impermanent Loss Calculator

```bash
kit defi il ETH/USDC --initial 3000 --current 3500

# Output:
📊 Impermanent Loss Calculator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Initial Price: $3,000
Current Price: $3,500 (+16.7%)

If you HODL'd:
├─ ETH value: $3,500 (+$500)
├─ USDC value: $3,000
└─ Total: $6,500

As LP (50/50):
├─ ETH amount: 0.926 ETH
├─ USDC amount: $3,240
├─ Total: $6,481
└─ IL: -$19 (-0.29%)

IL Breakdown:
• Price moved 16.7%
• IL = 0.29% (relatively small)
• Fees need to exceed 0.29% to be profitable

IL at Various Prices:
┌───────────┬────────────┬───────────┐
│ ETH Price │ IL         │ Break-even│
├───────────┼────────────┼───────────┤
│ $2,400    │ -1.23%     │ 25 days   │
│ $3,000    │ 0%         │ 0 days    │
│ $3,600    │ -0.46%     │ 9 days    │
│ $4,500    │ -2.02%     │ 40 days   │
│ $6,000    │ -5.72%     │ 114 days  │
└───────────┴────────────┴───────────┘
```

## Staking Optimizer

```bash
kit defi stake ETH

# Output:
🌾 ETH Staking Options
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your ETH: 5 ETH ($15,000)

Options:
┌────────────────┬───────┬────────────┬──────────────────┐
│ Provider       │ APY   │ Token      │ Features         │
├────────────────┼───────┼────────────┼──────────────────┤
│ Lido           │ 4.2%  │ stETH      │ Most liquid      │
│ Rocket Pool    │ 4.5%  │ rETH       │ Decentralized    │
│ Coinbase       │ 3.8%  │ cbETH      │ Regulated        │
│ Frax           │ 5.1%  │ sfrxETH    │ Highest yield    │
└────────────────┴───────┴────────────┴──────────────────┘

Recommended: Rocket Pool (rETH)
• Higher APY than Lido
• More decentralized
• Good liquidity

Potential Yield:
├─ 5 ETH staked
├─ APY: 4.5%
├─ Annual yield: 0.225 ETH (~$675)
└─ Plus: rETH price appreciation

[STAKE WITH ROCKET POOL]
```

## Gas Optimizer

```bash
kit defi gas

# Output:
⛽ Gas Optimizer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Gas: 35 gwei ($2.10 for swap)

Gas Price History (24h):
Low:  18 gwei @ 4:00 UTC
High: 85 gwei @ 14:30 UTC
Now:  35 gwei (below average ✅)

Optimal Times:
• Cheapest: 02:00-06:00 UTC (weekdays)
• Most Expensive: 14:00-18:00 UTC

Pending Transactions:
┌────────────────────┬──────────┬───────────┬──────────┐
│ Action             │ Est. Gas │ Now       │ Optimal  │
├────────────────────┼──────────┼───────────┼──────────┤
│ Aave Deposit       │ 150K     │ $5.25     │ $2.70    │
│ Uni V3 LP Add      │ 350K     │ $12.25    │ $6.30    │
│ Harvest Rewards    │ 200K     │ $7.00     │ $3.60    │
└────────────────────┴──────────┴───────────┴──────────┘

Potential Savings: $12.90

[SCHEDULE FOR OPTIMAL GAS]
```

## API

```typescript
import { DeFiYield } from '@binaryfaster/kit';

const defi = new DeFiYield();

// Scan yields
const yields = await defi.scanYields({
  minTVL: 10000000,
  maxRisk: 'medium',
  chains: ['ethereum', 'arbitrum']
});

// Deploy auto-yield
await defi.deployAutoYield({
  capital: 10000,
  risk: 'low',
  autoCompound: true
});

// Manage LP
const lp = await defi.getLPPosition('uniswap-v3', 'ETH/USDC');
await lp.rebalance({ range: [2800, 3400] });
await lp.collectFees();

// Stake
await defi.stake('ETH', {
  provider: 'rocket-pool',
  amount: 5
});
```

## Configuration

```yaml
# TOOLS.md
defi_yield:
  enabled: true
  
  wallet:
    address: ${WALLET_ADDRESS}
    # Private key stored securely
    
  chains:
    - ethereum
    - arbitrum
    - polygon
    - optimism
    
  settings:
    max_gas_price: 50  # gwei
    auto_compound: true
    compound_threshold: 50  # $50 minimum
    rebalance_frequency: weekly
    
  risk_limits:
    max_protocol_allocation: 30%
    min_tvl: 10000000  # $10M
    avoid_unaudited: true
```
