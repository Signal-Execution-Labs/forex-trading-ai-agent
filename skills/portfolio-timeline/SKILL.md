# Portfolio Timeline

Track your portfolio's complete history - every trade, transfer, and value change.

## Overview
Like DeBank's history view: see exactly how your portfolio evolved over time. Understand your journey from first deposit to current state.

## Features

### 1. Transaction History
```
Timeline Entry:
├── 2026-02-12 14:30 | SWAP | 1 ETH → 2,800 USDT
├── 2026-02-11 09:15 | DEPOSIT | +0.5 BTC (from Ledger)
├── 2026-02-10 18:00 | YIELD | +45 USDT (Aave interest)
├── 2026-02-09 12:30 | AIRDROP | +1,200 ARB tokens
└── 2026-02-08 08:00 | TRADE | Buy 10 SOL @ $95
```

### 2. Value Snapshots
```
Daily snapshots:
- Total value at 00:00 UTC
- Peak/low of the day
- Net change (deposits adjusted)
- True performance vs HODL
```

### 3. Performance Attribution
```
What drove your gains?
├── Trading P&L: +$2,340 (45%)
├── HODL gains: +$1,800 (35%)
├── Yield/Staking: +$520 (10%)
├── Airdrops: +$450 (9%)
└── Fees paid: -$110 (-)
```

## Visualization

### Equity Curve
```
     $15k ┤                    ╭──────
          │                ╭───╯
     $12k ┤            ╭───╯
          │        ╭───╯
     $10k ┤────────╯
          └────────────────────────────
           Jan    Feb    Mar    Apr
```

### Drawdown Chart
```
      0% ┤────╮      ╭────────╮
     -5% │    ╰──────╯        ╰───
    -10% │
    -15% ┤        ← Max DD: -8.3%
```

## Data Sources
- Exchange APIs (trades, deposits)
- Wallet transactions (on-chain)
- DeFi positions (DeBank API)
- Manual entries (OTC, gifts)

## Reports

### Monthly Summary
```markdown
## February 2026 Portfolio Report

Starting Value: $12,450
Ending Value: $15,230
Net Deposits: +$1,000
True Gain: +$1,780 (+14.3%)

Best Day: Feb 15 (+$890)
Worst Day: Feb 3 (-$340)
Win Rate: 67% (20/30 days)
```

### Tax Export
```csv
Date,Type,Asset,Amount,Price,Total,Fee
2026-02-12,SELL,ETH,1,2800,2800,2.80
2026-02-08,BUY,SOL,10,95,950,0.95
```

## Commands
```bash
kit timeline show --days 30
kit timeline export --format csv --year 2026
kit timeline snapshot  # Manual snapshot now
kit timeline performance --vs BTC  # Compare to benchmark
kit timeline report --month 2026-02
```

## Privacy
- Local storage by default
- Optional encrypted cloud sync
- No third-party data sharing
- Export your data anytime
