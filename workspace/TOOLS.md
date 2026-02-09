# K.I.T. Tools Configuration

Store your exchange configs, API keys, and preferences here.

⚠️ **NEVER commit API keys to version control!**
Use environment variables or encrypted storage.

## Exchange Configuration

```yaml
exchanges:
  # Primary Exchange
  binance:
    api_key: ${KIT_BINANCE_API_KEY}
    secret: ${KIT_BINANCE_SECRET}
    testnet: false
    default: true
    
  # Backup Exchange
  kraken:
    api_key: ${KIT_KRAKEN_API_KEY}
    secret: ${KIT_KRAKEN_SECRET}
    
  # Forex (if trading)
  oanda:
    api_key: ${KIT_OANDA_API_KEY}
    account_id: ${KIT_OANDA_ACCOUNT}
    practice: true  # Switch to false for live
```

## Risk Parameters

```yaml
risk:
  # Position Sizing
  max_position_pct: 10      # Max 10% in single position
  default_risk_pct: 2       # Risk 2% per trade
  
  # Loss Limits
  max_daily_loss_pct: 5     # Stop after 5% daily loss
  max_weekly_loss_pct: 10   # Stop after 10% weekly loss
  max_drawdown_pct: 15      # Emergency stop at 15% drawdown
  
  # Leverage
  max_leverage: 3           # Never exceed 3x
  default_leverage: 1       # Prefer spot
  
  # Diversification
  max_open_positions: 5     # Max concurrent trades
  max_correlation: 0.7      # Avoid highly correlated positions
```

## Trading Preferences

```yaml
trading:
  # Default Settings
  default_timeframe: 4h
  default_pairs:
    - BTC/USDT
    - ETH/USDT
    
  # Order Types
  prefer_limit_orders: true
  limit_offset_pct: 0.1     # Place limits 0.1% from market
  
  # Execution
  use_twap: true            # Split large orders
  max_order_size: 5000      # Max single order in USD
  
  # Confirmations
  require_confirmation: true
  auto_trader_enabled: false
```

## Alert Channels

```yaml
alerts:
  telegram:
    enabled: true
    chat_id: ${KIT_TELEGRAM_CHAT_ID}
    
  discord:
    enabled: false
    webhook: ${KIT_DISCORD_WEBHOOK}
```

## Indicator Defaults

```yaml
indicators:
  rsi:
    period: 14
    overbought: 70
    oversold: 30
    
  macd:
    fast: 12
    slow: 26
    signal: 9
    
  bollinger:
    period: 20
    std_dev: 2
    
  moving_averages:
    fast: 20
    slow: 50
    trend: 200
```

## News & Data Sources

```yaml
news:
  sources:
    - coindesk
    - cointelegraph
    - reuters
    
data:
  primary: binance
  backup: coingecko
  
  # For backtesting
  historical:
    provider: binance
    cache_locally: true
```

## Session Notes

Add your trading notes here:

```markdown
### My Trading Rules
1. Never trade against the trend
2. Wait for confirmation before entry
3. Always use stop-loss
4. Take partial profits at 1R
5. Move stop to breakeven at 2R

### Pairs I Know Well
- BTC/USDT - Main focus
- ETH/USDT - Good for altseason
- SOL/USDT - More volatile

### Pairs to Avoid
- Low liquidity altcoins
- Newly listed tokens
- Memecoins (unless small fun positions)

### Best Trading Times (for me)
- 09:00-12:00 CET (EU session)
- 14:30-17:00 CET (US open)
- Avoid: Late night, weekends
```

## API Key Setup Guide

### Binance
1. Go to binance.com → Account → API Management
2. Create new API key
3. Enable: Read, Spot Trading
4. Disable: Withdrawals, Futures (unless needed)
5. Add IP whitelist for security

### Kraken
1. Go to kraken.com → Settings → API
2. Create new key
3. Enable: Query Funds, Query Orders, Create Orders
4. Add 2FA if available

### OANDA
1. Go to oanda.com → Manage API Access
2. Generate personal access token
3. Note your account ID

## Environment Variables

Set these in your system:

```bash
# Binance
export KIT_BINANCE_API_KEY="your_key"
export KIT_BINANCE_SECRET="your_secret"

# Kraken
export KIT_KRAKEN_API_KEY="your_key"
export KIT_KRAKEN_SECRET="your_secret"

# OANDA
export KIT_OANDA_API_KEY="your_token"
export KIT_OANDA_ACCOUNT="your_account_id"

# Telegram (for alerts)
export KIT_TELEGRAM_CHAT_ID="your_chat_id"
```

Or use a `.env` file (add to .gitignore!):

```
KIT_BINANCE_API_KEY=xxx
KIT_BINANCE_SECRET=xxx
```
