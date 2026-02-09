---
name: binary-options
description: "Binary Options trading via BinaryFaster. Execute CALL/PUT trades, manage positions, track results."
metadata:
  {
    "openclaw":
      {
        "emoji": "🎯",
        "requires": { "bins": ["node"], "npm": ["axios"] }
      }
  }
---

# Binary Options Trading (BinaryFaster)

Trade binary options through the BinaryFaster platform.

## Overview

This skill enables K.I.T. to trade binary options on BinaryFaster.com:
- **CALL/PUT Trades** - Predict price direction
- **Multiple Assets** - Forex, Crypto, Commodities
- **Flexible Durations** - 1 min to 1 hour
- **Demo & Real** - Practice or trade real money

## Supported Platform

| Platform | URL | Status |
|----------|-----|--------|
| BinaryFaster | https://binaryfaster.com | ✅ Ready |

## Configuration

Credentials stored in `~/.kit/config.json`:

```json
{
  "exchanges": {
    "binaryfaster": {
      "enabled": true,
      "type": "binary",
      "email": "your@email.com",
      "apiKey": "your-api-key"
    }
  }
}
```

## Trading Commands

### Check Balance

```typescript
const client = new BinaryFasterClient();
await client.login(email, password);

const balance = await client.getBalance();
console.log(`Real: $${balance.real}, Demo: $${balance.demo}`);
```

### Open CALL Trade (Price Goes UP)

```typescript
// Trade $10 on EUR/USD, 60 seconds
await client.call(159, 10, 60);
```

### Open PUT Trade (Price Goes DOWN)

```typescript
// Trade $10 on EUR/USD, 60 seconds
await client.put(159, 10, 60);
```

### Switch to Demo Mode

```typescript
await client.setDemoMode(true);  // Demo
await client.setDemoMode(false); // Real
```

### Get Available Assets

```typescript
const assets = await client.getAssets();
assets.forEach(a => console.log(`${a.id}: ${a.name} (${a.payout}%)`));
```

### Get Trade History

```typescript
const history = await client.getTradeHistory();
history.forEach(t => console.log(`${t.trend} $${t.lot} → ${t.result}`));
```

## Asset IDs

Common assets:

| Asset | ID | Type |
|-------|-----|------|
| EUR/USD | 159 | Forex |
| GBP/USD | 160 | Forex |
| USD/JPY | 161 | Forex |
| AUD/USD | 162 | Forex |
| BTC/USD | 200 | Crypto |
| ETH/USD | 201 | Crypto |
| Gold | 250 | Commodity |

## Trade Durations

| Duration | Seconds |
|----------|---------|
| 1 minute | 60 |
| 2 minutes | 120 |
| 3 minutes | 180 |
| 5 minutes | 300 |
| 15 minutes | 900 |
| 30 minutes | 1800 |
| 1 hour | 3600 |

## Risk Warning

⚠️ **Binary options trading involves significant risk.** 

- Only trade what you can afford to lose
- Start with demo mode to practice
- Use proper risk management
- Past results don't guarantee future performance

## Natural Language Examples

K.I.T. understands natural commands:

```
"Open a CALL on EUR/USD for $10"
"Put $25 on Bitcoin, 5 minutes"
"What's my binary options balance?"
"Show my last 10 trades"
"Switch to demo mode"
```
