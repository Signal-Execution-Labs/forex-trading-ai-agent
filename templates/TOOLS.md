# TOOLS.md - Exchange & Tool Configuration

## Exchange Connections

### Primary Exchange
- **Exchange:** [e.g., Binance]
- **Account Type:** [Spot / Futures / Both]
- **API Permissions:** [Read-only / Trade / Withdraw]
- **Rate Limits:** [requests/min]
- **Notes:** 

### Secondary Exchange
- **Exchange:** [e.g., Bybit]
- **Account Type:** 
- **API Permissions:** 
- **Notes:** 

---

## API Key Storage

⚠️ **NEVER put actual API keys in this file!**

Keys should be stored in `credentials.json` (gitignored) with this structure:
```json
{
  "binance": {
    "apiKey": "your-api-key",
    "secret": "your-secret",
    "sandbox": false
  },
  "bybit": {
    "apiKey": "your-api-key", 
    "secret": "your-secret",
    "sandbox": true
  }
}
```

### Key Security Checklist
- [ ] API keys have IP whitelist
- [ ] Trade-enabled keys have withdrawal disabled
- [ ] Using read-only keys for monitoring where possible
- [ ] Keys are NOT in any git-tracked file
- [ ] 2FA enabled on exchange accounts

---

## Preferred Trading Pairs

### High Priority (Best liquidity, main focus)
| Pair | Exchange | Notes |
|------|----------|-------|
| BTC/USDT | Binance | Main trading pair |
| ETH/USDT | Binance | |
| | | |

### Medium Priority (Regular monitoring)
| Pair | Exchange | Notes |
|------|----------|-------|

### Watchlist Only (Opportunities)
| Pair | Exchange | Notes |
|------|----------|-------|

---

## Strategy Configurations

### Strategy 1: [Name]
```yaml
type: trend_following
timeframe: 4h
indicators:
  - ema_20
  - ema_50
entry: ema_20 crosses above ema_50
exit: ema_20 crosses below ema_50
stop_loss: 2%
take_profit: 6%
position_size: 2%
```

### Strategy 2: [Name]
```yaml
type: support_resistance
timeframe: 1h
entry: bounce from identified support
exit: approach to resistance
stop_loss: below support
take_profit: at resistance
position_size: 1.5%
```

---

## Data Sources

### Price Data
- **Primary:** Exchange WebSocket
- **Backup:** [CoinGecko / CryptoCompare]
- **Historical:** [Exchange API / TradingView]

### News & Sentiment
- **Crypto News:** [CryptoPanic / CoinDesk RSS]
- **Economic Calendar:** [Forex Factory / Investing.com]
- **Social Sentiment:** [LunarCrush / Santiment]

### On-Chain (if applicable)
- **Explorer:** [Etherscan / Blockchain.com]
- **Analytics:** [Glassnode / IntoTheBlock]

---

## Automation Settings

### Order Types Available
- [ ] Market Orders
- [ ] Limit Orders
- [ ] Stop-Loss Orders
- [ ] Take-Profit Orders
- [ ] Trailing Stops
- [ ] OCO (One-Cancels-Other)

### Automation Level
- **Current Mode:** [Manual / Semi-Auto / Alert-Only]
- **Auto-Execute Allowed:** [Yes/No]
- **Max Auto Position Size:** [$XXX]
- **Require Confirmation For:** [All trades / Large trades only / None]

---

## Alert Channels

### Notification Methods
| Priority | Channel | Use For |
|----------|---------|---------|
| Urgent | [Telegram/Discord/SMS] | Stop triggered, large losses |
| Normal | [Telegram/Discord] | Trade signals, daily summary |
| Low | [Email] | Weekly reports |

### Alert Thresholds
- Price move alert: [±X%]
- P&L alert: [±$XXX or ±X%]
- Drawdown warning: [X%]

---

## Backtesting Tools

- **Platform:** [TradingView / Backtrader / Custom]
- **Data Source:** [Exchange historical / Paid feed]
- **Minimum Backtest Period:** [X months/years]

---

## Local Notes

### Exchange-Specific Quirks
- Binance: Rate limit is 1200/min for orders
- Bybit: Funding every 8h on perpetuals
- [Add your discoveries]

### Things That Broke Before
- [Document issues so you don't repeat them]

---

_Keep this file updated as you add exchanges and refine strategies._
