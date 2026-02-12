# Pi Cycle Top/Bottom Indicator

**Skill #80** | Category: Analysis | Inspired by: TradingView Pi Cycle Indicator

Detect Bitcoin market cycle tops and bottoms using the Pi Cycle indicator - historically accurate for identifying major BTC peaks.

## Overview

The Pi Cycle Top Indicator uses the 111-day and 350-day moving averages (multiplied by 2) to identify market cycle tops. When the 111 DMA crosses above the 350 DMA x2, it has historically signaled BTC cycle tops with remarkable accuracy.

## Historical Accuracy

| Date | Event | BTC Price | Accuracy |
|------|-------|-----------|----------|
| Apr 2013 | Cycle Top | $230 | ✅ Within 3 days |
| Dec 2013 | Cycle Top | $1,150 | ✅ Within 3 days |
| Dec 2017 | Cycle Top | $19,800 | ✅ Within 3 days |
| Apr 2021 | Local Top | $64,000 | ✅ Within 3 days |
| Nov 2021 | Cycle Top | $69,000 | ✅ Within 1 week |

## How It Works

### Top Detection
```
Condition: 111 DMA > (350 DMA × 2)
Signal: Extreme overheating - potential cycle top
```

### Bottom Detection (Extended)
```
Condition: Price < 200 WMA and RSI(Monthly) < 30
Signal: Extreme oversold - potential cycle bottom
```

## K.I.T. Enhancements

Beyond basic Pi Cycle, K.I.T. adds:

1. **Distance Tracking**: How far until crossover?
2. **Velocity Analysis**: Rate of MA convergence
3. **Time Estimation**: "~X days until potential crossover"
4. **Multi-Asset**: Apply to ETH, SOL, other crypto
5. **Alert System**: Notify when approaching danger zone
6. **Bottom Indicator**: Extended version for bottoms
7. **Confidence Score**: Based on convergence pattern

## Usage

```typescript
import { getPiCycleStatus } from 'kit/skills/pi-cycle';

const status = await getPiCycleStatus('BTCUSD');

console.log(status);
// {
//   symbol: 'BTCUSD',
//   ma111: 68500,
//   ma350x2: 72000,
//   distance: -4.86%,    // Negative = not crossed
//   velocity: 0.5%/day,  // Rate of convergence
//   daysToConvergence: 10,
//   signal: 'Approaching',
//   riskLevel: 'High',
//   historicalContext: 'Similar to Nov 2021 pattern'
// }
```

## Alerts

```typescript
import { setPiCycleAlert } from 'kit/skills/pi-cycle';

// Alert when within 5% of crossover
setPiCycleAlert({
  symbol: 'BTCUSD',
  threshold: 5, // percent
  notify: ['telegram', 'email']
});
```

## Risk Zones

| Distance | Risk Level | Action |
|----------|------------|--------|
| > 20% | Low | Accumulate |
| 10-20% | Medium | Be cautious |
| 5-10% | High | Consider taking profits |
| 0-5% | Extreme | Exit most positions |
| Crossed | TOP SIGNAL | Max defense mode |

## API

### Endpoints

- `GET /api/pi-cycle/:symbol` - Current Pi Cycle status
- `GET /api/pi-cycle/:symbol/history` - Historical crossovers
- `POST /api/pi-cycle/alert` - Set alert

### WebSocket

Subscribe to real-time Pi Cycle updates:

```typescript
ws.subscribe('pi-cycle:BTCUSD');
// Receives updates when distance changes significantly
```

## Comparison

| Feature | TradingView | Glassnode | K.I.T. |
|---------|-------------|-----------|--------|
| Top indicator | ✅ | ✅ | ✅ |
| Bottom indicator | ❌ | ✅ | ✅ |
| Distance tracking | ❌ | ❌ | ✅ |
| Time estimation | ❌ | ❌ | ✅ |
| Multi-asset | ❌ | ❌ | ✅ |
| Alerts | Paid | Paid | ✅ Free |
| API | ❌ | Paid | ✅ Free |
