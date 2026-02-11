# Market Profile Skill

TPO (Time Price Opportunity) and Volume Profile analysis for understanding market structure.

## Overview

Market Profile reveals:
- **Value Area** - Where 70% of trading occurred
- **Point of Control (POC)** - Price level with most activity
- **High/Low Volume Nodes** - Support/resistance zones
- **Market Balance** - Institutional reference points

## Commands

- `profile daily <symbol>` - Today's developing profile
- `profile weekly <symbol>` - Weekly composite profile
- `profile vp <symbol>` - Volume Profile (fixed range)
- `profile vwap <symbol>` - VWAP with standard deviations
- `profile session <symbol>` - Session-based profiles (Asia/London/NY)
- `profile poc <symbol>` - Find Point of Control
- `profile va <symbol>` - Calculate Value Area

## Key Concepts

### TPO Profile
- **TPO Letters** - Each 30min period = one letter (A, B, C...)
- **Initial Balance** - First hour of trading (A+B)
- **Range Extension** - Trading beyond initial balance
- **Single Prints** - Areas with single TPO (no revisit)

### Volume Profile
- **POC** - Point of Control (highest volume price)
- **VAH** - Value Area High (70% of volume above this)
- **VAL** - Value Area Low (70% of volume below this)
- **HVN** - High Volume Nodes (support/resistance)
- **LVN** - Low Volume Nodes (fast moves through these)

### Profile Shapes
- **Normal/Bell** - Balanced, rotational market
- **P-Shape** - Shorts trapped, potential breakout up
- **b-Shape** - Longs trapped, potential breakout down
- **D-Shape** - Trend day, directional conviction
- **Double** - Two distributions, look for breakout

## Configuration

```yaml
market-profile:
  tpo_period: 30        # Minutes per TPO letter
  value_area: 0.70      # 70% of volume for VA
  session_times:
    asia: "00:00-08:00"
    london: "08:00-12:00"
    ny: "12:00-21:00"
  vwap_deviations: [1, 2, 3]
```

## Output Example

```
┌─────────────────────────────────────────────────────────┐
│  MARKET PROFILE: ES (S&P 500 Futures)                  │
│  Date: Feb 11, 2026                                    │
├─────────────────────────────────────────────────────────┤
│                                                        │
│  5095 │                    J                           │
│  5094 │                  GGHIJ                         │
│  5093 │                DDEFGGHK   ◀─ VAH               │
│  5092 │              BCCDEEFGK                         │
│  5091 │            AABBCCDDEF    ◀─ POC (5091.50)     │
│  5090 │              ABBBCCDE                          │
│  5089 │                ABBCD      ◀─ VAL               │
│  5088 │                  ABC                           │
│  5087 │                    B                           │
│                                                        │
├─────────────────────────────────────────────────────────┤
│  Profile Shape: P-Shape (Bullish)                      │
│  Initial Balance: 5088.00 - 5092.00                    │
│  Range Extension: UP (to 5095)                         │
│                                                        │
│  Key Levels:                                           │
│  • POC: 5091.50 (support)                             │
│  • VAH: 5093.25 (resistance)                          │
│  • VAL: 5089.00 (support)                             │
│  • Single Print: 5087 (magnet)                        │
│                                                        │
│  Volume Analysis:                                      │
│  • Total: 1.2M contracts                              │
│  • POC Volume: 185K (15.4%)                           │
│  • Above POC: 55%                                     │
│  • Below POC: 45%                                     │
└─────────────────────────────────────────────────────────┘
```

## Trading Applications

### Value Area Play
- Open inside VA → Expect rotation to opposite VA boundary
- Open outside VA → Expect drive to POC or continuation

### POC Reference
- Price above POC → Bullish bias
- Price below POC → Bearish bias
- POC migration → Trend direction

### Single Print Magnet
- Single prints act as magnets - price tends to return and fill

## Integration

Works with:
- `order-flow` - Delta and volume footprint
- `session-timer` - Session-based profiles
- `wyckoff-analysis` - Combined structural analysis
- `alert-system` - Level alerts (POC, VAH, VAL)
