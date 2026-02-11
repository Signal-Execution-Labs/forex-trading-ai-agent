# Economic Calendar Trading Skill

**Skill #55** | **Category:** Event Trading | **Inspired by:** TradingView Calendar, ForexFactory, Investing.com

## Overview

Event-driven trading automation. Track high-impact economic events (NFP, CPI, FOMC, earnings) and execute strategies around them.

TradingView shows economic calendar but doesn't automate trading around it. We do.

## Features

### 1. Calendar Aggregation
- **Multiple Sources:** ForexFactory, Investing.com, TradingView, DailyFX
- **Event Types:** Economic indicators, central bank meetings, earnings, crypto events
- **Impact Filtering:** High/Medium/Low
- **Custom Events:** Add your own reminders

### 2. Pre-Event Strategies
- **Straddle/Strangle:** Buy volatility before high-impact events
- **Position Squaring:** Auto-close risky positions before events
- **Range Detection:** Calculate expected move from options pricing
- **Buffer Zones:** Auto-stop trading X minutes before events

### 3. Post-Event Strategies
- **Breakout Trading:** Enter on strong deviations from forecast
- **Fade Strategy:** Fade initial spike after 15-30 minutes
- **Continuation:** Ride momentum if break confirms
- **Historical Playback:** How did this event move markets last time?

### 4. Smart Notifications
- **Pre-Event Alerts:** 1h, 15m, 5m before
- **Deviation Alerts:** Actual vs Forecast deviation
- **Position Alerts:** Warn if exposed to event
- **Volatility Alerts:** IV spike detection

### 5. Event Analysis
- **Historical Impact:** Average move for this event (last 12 months)
- **Deviation Correlation:** How much move per deviation unit
- **Best Pairs:** Which instruments react most
- **Duration:** How long effect typically lasts

## Event Types

### Forex/Macro
| Event | Impact | Typical Move | Pairs Affected |
|-------|--------|--------------|----------------|
| NFP (Non-Farm Payrolls) | 🔴 High | 50-150 pips | USD pairs |
| CPI (Inflation) | 🔴 High | 30-100 pips | USD, EUR, GBP |
| FOMC Rate Decision | 🔴 High | 100-200 pips | All USD pairs |
| ECB Rate Decision | 🔴 High | 50-150 pips | EUR pairs |
| GDP | 🟡 Medium | 20-50 pips | Country currency |
| PMI | 🟡 Medium | 15-40 pips | Country currency |
| Retail Sales | 🟡 Medium | 20-40 pips | Country currency |

### Crypto
| Event | Impact | Typical Move |
|-------|--------|--------------|
| FOMC/Rate Decision | 🔴 High | 3-10% |
| CPI Release | 🔴 High | 2-5% |
| ETF Approval/Rejection | 🔴 High | 5-20% |
| Protocol Upgrade | 🟡 Medium | 2-8% |
| Token Unlock | 🟡 Medium | 2-5% (down) |
| Exchange Listing | 🟡 Medium | 5-15% |

### Stocks
| Event | Impact | Typical Move |
|-------|--------|--------------|
| Earnings Release | 🔴 High | 5-20% |
| Guidance Update | 🔴 High | 3-10% |
| FDA Approval | 🔴 High | 10-50% |
| Dividend Announcement | 🟢 Low | 1-3% |
| Stock Split | 🟡 Medium | 2-5% |

## API Reference

```typescript
import { EconomicCalendar } from 'kit/skills/economic-calendar';

const calendar = new EconomicCalendar({
  sources: ['forexfactory', 'investing', 'tradingview'],
  timezone: 'Europe/Berlin',
  minImpact: 'high'
});

// Get upcoming events
const events = await calendar.getUpcoming({
  hours: 24,
  currencies: ['USD', 'EUR'],
  impact: ['high', 'medium']
});

// Subscribe to event alerts
calendar.onEvent('pre', { minutesBefore: 15 }, (event) => {
  console.log(`⚠️ ${event.name} in 15 minutes!`);
});

// Get historical impact
const history = await calendar.getHistoricalImpact('NFP', {
  months: 12,
  pair: 'EURUSD'
});
// → { avgMove: 67, maxMove: 142, avgDuration: '4h' }

// Auto-square positions before events
calendar.enableAutoSquare({
  minutesBefore: 5,
  impactLevel: 'high',
  symbols: ['EURUSD', 'GBPUSD']
});
```

## Strategies

### 1. NFP Straddle (Options)
```typescript
const nfpStrategy = new EventStrategy({
  event: 'NFP',
  minutesBefore: 30,
  action: 'straddle',
  size: 0.01, // lot size
  takeProfit: 50, // pips
  stopLoss: 20
});
```

### 2. CPI Breakout (Spot)
```typescript
const cpiBreakout = new EventStrategy({
  event: 'CPI',
  trigger: 'post',
  condition: {
    deviationPercent: 0.2 // 0.2% deviation from forecast
  },
  action: 'breakout',
  direction: 'deviation', // trade direction of deviation
  entryDelay: '30s', // wait 30 sec after release
  takeProfit: 30,
  stopLoss: 15
});
```

### 3. Earnings Fade
```typescript
const earningsFade = new EventStrategy({
  event: 'earnings',
  symbol: 'AAPL',
  trigger: 'post',
  entryDelay: '15m', // wait for initial spike
  action: 'fade',
  takeProfit: '50%', // 50% retracement
  stopLoss: 'new_high' // stop if new high made
});
```

## Dashboard Widget

The skill adds a dashboard widget showing:
- Next 5 events with countdown timers
- Current exposure to event-sensitive positions
- Historical impact chart
- Quick action buttons (square, hedge, set alerts)

## Configuration

```yaml
# kit.yaml
skills:
  economic-calendar:
    sources:
      - forexfactory
      - investing
      - tradingview
    timezone: Europe/Berlin
    
    alerts:
      telegram: true
      discord: false
      email: true
      
    auto_actions:
      square_before_high_impact: true
      square_minutes: 5
      
    strategies:
      - name: NFP Straddle
        enabled: true
        risk_percent: 1
```

## K.I.T. Advantages

| Feature | TradingView | ForexFactory | K.I.T. |
|---------|-------------|--------------|--------|
| Calendar Display | ✅ | ✅ | ✅ |
| Auto Trading | ❌ | ❌ | ✅ |
| Historical Analysis | Basic | ❌ | ✅ Advanced |
| Position Squaring | ❌ | ❌ | ✅ |
| Multi-Source | ❌ | ❌ | ✅ |
| Custom Events | ❌ | ❌ | ✅ |
| AI Predictions | ❌ | ❌ | ✅ |
| Price | $12.95+/mo | Free | Free |

## Files

- `SKILL.md` - This documentation
- `economic-calendar.ts` - Main implementation
- `strategies.ts` - Pre-built event strategies
- `sources/` - Calendar source adapters
- `index.ts` - Exports
