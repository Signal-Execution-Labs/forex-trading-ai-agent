# K.I.T. Multi-Asset Market Data Setup

K.I.T. now supports **Stocks, Forex, and Crypto** analysis with free APIs!

## Quick Start

### 1. Get Free API Keys (5 minutes)

**Alpha Vantage (Stocks + Forex + Crypto)**
- Go to: https://www.alphavantage.co/support/#api-key
- Enter any email & click "GET FREE API KEY"
- Copy your key (looks like: `DEMO` or `ABCD1234EFGH5678`)
- **Free tier:** 25 requests/day (enough for casual use)

**Twelve Data (Backup - 800 requests/day)**
- Go to: https://twelvedata.com/
- Click "Get free API key"
- Sign up with email
- Copy your key
- **Free tier:** 800 requests/day!

### 2. Configure K.I.T.

Add to your `~/.kit/config.json`:

```json
{
  "marketData": {
    "alphaVantageKey": "YOUR_ALPHA_VANTAGE_KEY",
    "twelveDataKey": "YOUR_TWELVE_DATA_KEY"
  }
}
```

Or set environment variables:
```bash
export ALPHA_VANTAGE_API_KEY=YOUR_KEY
export TWELVE_DATA_API_KEY=YOUR_KEY
```

Or use the chat command:
```
Configure market data with Alpha Vantage key XXXXX and Twelve Data key YYYYY
```

### 3. Test It!

```bash
# CLI
kit analyze symbol AAPL      # Apple Stock
kit analyze symbol EURUSD    # Euro/Dollar Forex
kit analyze symbol BTC       # Bitcoin (always works via Binance)

# Or ask K.I.T. in chat:
"Analyze EUR/USD for me"
"What's the price of Apple stock?"
"Give me a market overview"
```

## Data Sources (Priority Order)

1. **Alpha Vantage** - Stocks, Forex, Crypto (25/day free)
2. **Twelve Data** - All markets (800/day free)
3. **Binance** - Crypto only (unlimited, no key needed)
4. **Simulated** - Fallback if all fail

## Supported Symbols

### Crypto
`BTC`, `ETH`, `SOL`, `BNB`, `XRP`, `ADA`, `DOGE`, `DOT`, `AVAX`, `MATIC`, `LINK`, etc.

### Forex
`EUR/USD`, `GBP/USD`, `USD/JPY`, `USD/CHF`, `AUD/USD`, `USD/CAD`, `NZD/USD`, `EUR/GBP`, `EUR/JPY`, `GBP/JPY`, etc.

### Stocks
`AAPL`, `MSFT`, `GOOGL`, `AMZN`, `NVDA`, `TSLA`, `META`, `JPM`, `V`, `WMT`, etc.

## Premium Options (If You Need More)

| Service | Free Tier | Premium |
|---------|-----------|---------|
| Alpha Vantage | 25/day | $49.99/mo (unlimited) |
| Twelve Data | 800/day | $29/mo (8000/day) |
| Polygon.io | 5/min | $29/mo (unlimited) |

---

For questions: https://github.com/kayzaa/k.i.t.-bot/issues
