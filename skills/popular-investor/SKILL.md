# Popular Investor Program

Become a signal provider and earn from copiers - eToro-style program.

## Overview
Share your strategies, build a following, earn rewards. The more people copy your trades, the more you earn.

## Program Tiers

### Tier 1: Cadet
```yaml
requirements:
  min_equity: $1,000
  verified: true
  trading_history: 2 months
  
benefits:
  - Public profile
  - Performance badges
  - No earnings yet
```

### Tier 2: Rising Star
```yaml
requirements:
  min_copiers: 10
  min_aum: $10,000  # Assets under management
  max_drawdown: <30%
  win_rate: >50%
  
benefits:
  - Monthly payout: 0.5% of AUM
  - Verified badge
  - Featured in search
```

### Tier 3: Champion
```yaml
requirements:
  min_copiers: 50
  min_aum: $100,000
  max_drawdown: <20%
  consistent_profit: 6 months
  
benefits:
  - Monthly payout: 1.0% of AUM
  - Priority support
  - Strategy spotlight
```

### Tier 4: Elite
```yaml
requirements:
  min_copiers: 200
  min_aum: $500,000
  verified_track_record: 12 months
  
benefits:
  - Monthly payout: 1.5% of AUM
  - Personal manager
  - Media features
  - Exclusive events
```

## Earnings Calculator
```
Monthly Earnings = AUM × Tier Rate

Example (Champion):
├── 75 copiers
├── Average copy: $2,000
├── AUM: $150,000
├── Rate: 1.0%
└── Monthly Earnings: $1,500
```

## Profile Features

### Performance Display
```
TrendMaster Pro 🏆 Champion
├── Total Gain: +187% (2 years)
├── This Year: +45%
├── Risk Score: 4/10 (Moderate)
├── Copiers: 127
├── AUM: $254,000
└── Win Rate: 68%
```

### Strategy Description
```markdown
## My Strategy
Long-term trend following with strict risk management.
- Markets: Crypto + Forex
- Timeframe: Swing (days to weeks)
- Max positions: 5
- Stop loss: Always 2%
```

### Social Feed
- Post trade ideas with reasoning
- Reply to copier questions
- Share market analysis
- Build community engagement

## Copier Protection
```yaml
max_copiers: 500       # Prevent overcrowding
min_copy_amount: $200  # Quality over quantity
copy_sl_enabled: true  # Force stop losses
transparency: full     # All trades visible
```

## Analytics Dashboard
```
Your Copier Stats:
├── Total Copiers: 127
├── New This Month: +23
├── Left This Month: -8
├── Avg Copy Amount: $2,000
├── Copier Satisfaction: 4.6/5
└── Comments This Week: 34
```

## Compliance
- No manipulation
- Disclose conflicts
- Maintain activity (min 1 trade/month)
- Respond to copiers (24h)

## Commands
```bash
kit popular-investor apply
kit popular-investor status
kit popular-investor stats
kit popular-investor earnings
kit popular-investor copiers --list
kit popular-investor post --idea "BTC looks bullish..."
```
