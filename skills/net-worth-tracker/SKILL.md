# Net Worth Tracker

Complete financial picture - all assets, liabilities, and net worth in one view.

## Overview
Inspired by Personal Capital/Empower: track your entire financial life, not just trading accounts. See your true net worth and progress toward goals.

## Account Types

### Assets
```yaml
Liquid:
  - Bank accounts (checking, savings)
  - Brokerage accounts
  - Crypto wallets
  - Cash equivalents

Investments:
  - Stocks, ETFs, mutual funds
  - Bonds, CDs
  - Retirement accounts (401k, IRA, Roth)
  - Crypto holdings

Real Assets:
  - Real estate (home equity)
  - Vehicles
  - Collectibles, art
  - Precious metals

Other:
  - Business equity
  - Private investments
  - HSA, 529 plans
```

### Liabilities
```yaml
Debt:
  - Mortgage
  - Auto loans
  - Student loans
  - Credit cards
  - Personal loans
  - HELOC
```

## Net Worth Calculation
```
Net Worth = Total Assets - Total Liabilities

Example:
├── Assets: $450,000
│   ├── Liquid: $25,000
│   ├── Investments: $175,000
│   ├── Retirement: $150,000
│   └── Home Equity: $100,000
├── Liabilities: $180,000
│   ├── Mortgage: $150,000
│   ├── Student Loans: $25,000
│   └── Credit Cards: $5,000
└── NET WORTH: $270,000 ✓
```

## Tracking Features

### Historical Trend
```
Net Worth Over Time:
$300k ┤                          ╭───
      │                     ╭────╯
$250k ┤                ╭────╯
      │           ╭────╯
$200k ┤      ╭────╯
      │ ╭────╯
$150k ┤─╯
      └─────────────────────────────
       2024    2025    2026
```

### Monthly Changes
```
February 2026:
├── Starting: $265,000
├── Investment Gains: +$8,000
├── Savings Added: +$3,000
├── Debt Paid: -$2,000 (liability ↓)
├── Spending: (tracked separately)
└── Ending: $274,000 (+3.4%)
```

### Asset Allocation
```
Your Allocation:
├── 🟦 Stocks: 45%
├── 🟩 Crypto: 20%
├── 🟨 Real Estate: 22%
├── 🟧 Bonds: 8%
└── ⬜ Cash: 5%

Recommended for your age (35):
├── Stocks: 65%
├── Bonds: 25%
└── Cash: 10%
```

## Goal Tracking

### Retirement Planning
```yaml
retirement:
  target_age: 55
  target_amount: $2,000,000
  current_savings: $325,000
  monthly_contribution: $2,500
  expected_return: 7%
  
projection:
  on_track: true
  projected_at_55: $2,450,000
  safe_withdrawal: $98,000/year (4% rule)
```

### Custom Goals
```yaml
goals:
  - name: "House Down Payment"
    target: $100,000
    current: $45,000
    deadline: "2027-06-01"
    progress: 45%
    
  - name: "Emergency Fund"
    target: $30,000
    current: $28,000
    progress: 93%
```

## Integrations
- **Banks:** Plaid connection
- **Brokerages:** Direct API
- **Crypto:** Wallet addresses
- **Real Estate:** Zillow/Redfin estimates
- **Retirement:** 401k/IRA providers

## Privacy & Security
- Read-only connections
- No trading permissions
- Local encryption option
- No data selling

## Commands
```bash
kit networth show
kit networth history --months 12
kit networth breakdown --type assets
kit networth add-account --type bank --name "Chase Checking"
kit networth add-manual --type "Home" --value 350000
kit networth goal-add --name "Retirement" --target 2000000
kit networth export --format pdf
```

## Alerts
- 📈 Net worth milestone reached
- 📉 Significant drop (>5%)
- 🎯 Goal progress update (monthly)
- ⚠️ Debt-to-asset ratio warning
