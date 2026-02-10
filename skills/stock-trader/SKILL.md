---
name: stock-trader
description: "Trade US stocks and ETFs via Alpaca and Interactive Brokers. Paper trading supported."
metadata:
  {
    "openclaw":
      {
        "emoji": "📈",
        "requires": { "bins": ["node"], "env": ["ALPACA_API_KEY", "ALPACA_API_SECRET"] }
      }
  }
---

# Stock Trader Skill 📈

Trade US stocks, ETFs, and options with K.I.T.

## Supported Brokers

| Broker | Status | Markets | Features |
|--------|--------|---------|----------|
| **Alpaca** | ✅ Ready | US Stocks, ETFs | Commission-free, Paper trading |
| **Interactive Brokers** | 🚧 Coming | Global | Stocks, Options, Futures, Forex |
| **Tradier** | 📋 Planned | US Stocks | Commission-free options |

## Quick Start

### 1. Get Alpaca API Keys

1. Go to [alpaca.markets](https://alpaca.markets)
2. Create account (free)
3. Go to "Paper Trading" → "API Keys"
4. Generate and copy your keys

### 2. Configure K.I.T.

```bash
# Environment variables
export ALPACA_API_KEY="your-api-key"
export ALPACA_API_SECRET="your-secret-key"
export ALPACA_PAPER="true"  # Start with paper trading!
```

Or in `~/.kit/config.json`:

```json
{
  "exchanges": {
    "alpaca": {
      "apiKey": "your-api-key",
      "apiSecret": "your-secret-key",
      "paper": true
    }
  }
}
```

### 3. Test Connection

```typescript
import { createStockConnector } from '@binaryfaster/kit';

const stocks = createStockConnector();

await stocks.connect({
  broker: 'alpaca',
  apiKey: process.env.ALPACA_API_KEY!,
  apiSecret: process.env.ALPACA_API_SECRET!,
  paper: true,
});

// Check account
const account = await stocks.getAccount();
console.log(`Balance: $${account.portfolioValue}`);

// Get positions
const positions = await stocks.getPositions();
console.log('Positions:', positions);
```

## Features

### 📊 Portfolio Management

```typescript
// Get full portfolio
const portfolio = await stocks.getPortfolio();
console.log(`Total Value: $${portfolio.account.portfolioValue}`);
console.log(`P&L: $${portfolio.totalPL} (${portfolio.totalPLPercent.toFixed(2)}%)`);

// List positions
for (const pos of portfolio.positions) {
  console.log(`${pos.symbol}: ${pos.qty} shares, ${pos.unrealizedPLPercent.toFixed(2)}%`);
}
```

### ⚡ Trading

```typescript
// Market buy
const buyOrder = await stocks.buy('AAPL', 10);

// Limit buy
const limitBuy = await stocks.buy('TSLA', 5, {
  type: 'limit',
  limitPrice: 200.00,
});

// Sell
const sellOrder = await stocks.sell('AAPL', 5);

// Close position (all shares)
await stocks.closePosition('AAPL');

// Close all positions (PANIC BUTTON!)
await stocks.closeAllPositions();
```

### 📈 Market Data

```typescript
// Get quote
const quote = await stocks.getQuote('AAPL');
console.log(`AAPL: $${quote.price}`);

// Check market hours
const isOpen = await stocks.isMarketOpen();
console.log(`Market is ${isOpen ? 'OPEN' : 'CLOSED'}`);

// Pivot points
const pivots = await stocks.analyzePivotPoints('SPY');
console.log(`Support: $${pivots.s1} | Pivot: $${pivots.pivot} | Resistance: $${pivots.r1}`);
```

### 📋 Order Management

```typescript
// Get open orders
const openOrders = await stocks.getOrders('open');

// Cancel specific order
await stocks.cancelOrder(order.id);

// Cancel ALL orders
await stocks.cancelAllOrders();
```

### 📊 Reports

```typescript
const report = await stocks.generateReport();
console.log(report);
```

Output:
```
📊 STOCK PORTFOLIO REPORT
============================================================

ACCOUNT
------------------------------------------------------------
Cash:           $50,000.00
Portfolio:      $52,450.00
Buying Power:   $100,000.00
Day Trades:     1/3
Market:         🟢 OPEN

POSITIONS (3)
------------------------------------------------------------
AAPL     10 shares @ $175.50 | $1,780.00 📈 +1.43%
TSLA     5 shares @ $195.00  | $985.00  📉 -1.03%
MSFT     8 shares @ $400.25  | $3,250.00 📈 +1.87%

TOTALS
------------------------------------------------------------
Unrealized P&L: $85.00 (+1.68%)
```

## K.I.T. Commands

After integration, K.I.T. understands:

- *"Buy 10 shares of Apple"*
- *"Sell half my Tesla position"*
- *"What's my stock portfolio worth?"*
- *"Show me all my open orders"*
- *"Close all positions"* (be careful!)
- *"Is the market open?"*
- *"What's the price of NVIDIA?"*

## Order Types

| Type | Description | Example |
|------|-------------|---------|
| `market` | Execute immediately at best price | `stocks.buy('AAPL', 10)` |
| `limit` | Execute only at specified price or better | `stocks.buy('AAPL', 10, { type: 'limit', limitPrice: 170 })` |
| `stop` | Trigger market order when price reached | `stocks.buy('AAPL', 10, { type: 'stop', stopPrice: 180 })` |
| `stop_limit` | Trigger limit order when price reached | Combined stop + limit |
| `trailing_stop` | Dynamic stop that follows price | `trailPercent: 5` |

## Time In Force

| TIF | Description |
|-----|-------------|
| `day` | Valid for current trading day |
| `gtc` | Good 'til cancelled (90 days) |
| `ioc` | Immediate or cancel |
| `fok` | Fill or kill |
| `opg` | Market open only |
| `cls` | Market close only |

## Market Hours

**Regular Hours:** 9:30 AM - 4:00 PM ET (Mon-Fri)

**Extended Hours (Alpaca):**
- Pre-market: 4:00 AM - 9:30 AM ET
- After-hours: 4:00 PM - 8:00 PM ET

```typescript
// Trade in extended hours
const order = await stocks.buy('AAPL', 10, { extendedHours: true });
```

## Pattern Day Trader (PDT) Rules

If your account has < $25,000:
- Limited to 3 day trades per 5 business days
- K.I.T. tracks your day trade count automatically
- Use swing trading or upgrade to margin account

## Risk Management

```typescript
// Set stop loss after buying
const buyOrder = await stocks.buy('AAPL', 10);
const stopOrder = await stocks.sell('AAPL', 10, {
  type: 'stop',
  stopPrice: buyOrder.filledAvgPrice * 0.95,  // 5% stop loss
});

// Trailing stop
const trailingStop = await stocks.sell('AAPL', 10, {
  type: 'trailing_stop',
  trailPercent: 5,  // 5% trailing stop
});
```

## Paper vs Live Trading

**ALWAYS START WITH PAPER TRADING!**

```typescript
// Paper trading (simulation)
await stocks.connect({
  broker: 'alpaca',
  apiKey: 'paper-key',
  apiSecret: 'paper-secret',
  paper: true,  // <-- Paper mode
});

// Live trading (real money!)
await stocks.connect({
  broker: 'alpaca',
  apiKey: 'live-key',
  apiSecret: 'live-secret',
  paper: false,  // <-- Real money!
});
```

## Error Handling

```typescript
try {
  const order = await stocks.buy('AAPL', 1000000);  // Too many shares
} catch (error) {
  console.error('Order failed:', error.message);
  // "Alpaca API Error: 403 - insufficient buying power"
}
```

Common errors:
- `insufficient_buying_power` - Not enough cash
- `account_blocked` - Account restricted
- `market_closed` - Try extended hours
- `symbol_not_found` - Check symbol spelling

## File Structure

```
skills/stock-trader/
├── SKILL.md              # This file
└── examples/
    └── basic-trading.ts  # Example code

src/tools/
└── stock-connector.ts    # Main implementation
```

## Coming Soon

- [ ] Interactive Brokers integration
- [ ] Options trading
- [ ] Watchlist management
- [ ] Earnings calendar alerts
- [ ] Dividend tracking
- [ ] Sector analysis

---

**Version:** 1.0.0  
**Created:** 2026-02-10  
**Author:** K.I.T. [Sprint-Agent]

---

> 📈 **K.I.T. - Your AI Stock Trader**
