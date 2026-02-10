# Grid Trading Bot

Automated grid trading strategy inspired by Pionex. Places a series of buy and sell orders at regular price intervals to profit from market volatility.

## Features

- **Spot Grid Trading**: Classic grid for ranging markets
- **Infinity Grid**: No upper limit, profits from uptrends
- **Reverse Grid**: For downtrend markets
- **Arithmetic & Geometric Grids**: Different spacing methods
- **Auto Profit Taking**: Automatic profit per grid
- **Backtesting**: Test grid parameters before live trading

## How Grid Trading Works

```
Upper Price ─────────────────────── SELL ← Takes Profit
           │   │   │   │   │   │
Grid Level │ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ SELL
           │   │   │   │   │   │
Grid Level │ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ SELL
           │   │   │   │   │   │
Current ───┼───●───────────────────
           │   │   │   │   │   │
Grid Level │ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ BUY
           │   │   │   │   │   │
Grid Level │ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ ┼ ─ BUY
           │   │   │   │   │   │
Lower Price ─────────────────────── BUY ← Accumulates
```

When price moves up → Sells at next grid → Takes profit
When price moves down → Buys at next grid → Accumulates position

## Quick Start

### 1. Calculate Grid Parameters

```bash
python grid_bot.py calculate \
    --symbol BTCUSDT \
    --lower 40000 \
    --upper 50000 \
    --grids 10 \
    --investment 1000
```

Output:
```
Grid Bot Calculator
═══════════════════════════════════════
Symbol:        BTCUSDT
Investment:    $1,000.00
Price Range:   $40,000 - $50,000
Grid Count:    10
Grid Spacing:  $1,000 (2.50%)
Profit/Grid:   ~2.44%
Total Orders:  20 (10 buy + 10 sell)
Order Size:    $100 per grid
```

### 2. Start Grid Bot

```bash
python grid_bot.py start \
    --symbol BTCUSDT \
    --lower 40000 \
    --upper 50000 \
    --grids 10 \
    --investment 1000
```

### 3. Check Status

```bash
python grid_bot.py status
```

### 4. Stop Bot

```bash
python grid_bot.py stop --symbol BTCUSDT
```

## Configuration

Create `config.yaml`:

```yaml
grid_bot:
  # Default exchange
  exchange: binance
  
  # Default parameters
  default_grids: 20
  min_profit_per_grid: 0.3  # 0.3%
  
  # Risk management
  max_investment: 10000
  stop_loss_percent: 15
  take_profit_percent: 50
  
  # Notification
  notify_on_fill: true
  notify_on_profit: true
```

## Grid Types

### 1. Spot Grid (Default)
- Best for: Sideways/ranging markets
- Buys low, sells high within range
- Requires defining upper and lower price

```bash
python grid_bot.py start --type spot --lower 40000 --upper 50000
```

### 2. Infinity Grid
- Best for: Long-term uptrends
- No upper price limit
- Uses geometric spacing
- Never sells all holdings

```bash
python grid_bot.py start --type infinity --lower 40000 --grids 50
```

### 3. Reverse Grid
- Best for: Downtrends (short selling)
- Sells high, buys low
- Profits from price decreases

```bash
python grid_bot.py start --type reverse --upper 50000 --lower 40000
```

## Grid Spacing Methods

### Arithmetic (Equal $ spacing)
Each grid level is equally spaced in dollar terms.
- Example: $40000, $41000, $42000, $43000...

```bash
python grid_bot.py start --spacing arithmetic
```

### Geometric (Equal % spacing)
Each grid level is equally spaced in percentage terms.
- Example: $40000, $41200 (+3%), $42436 (+3%)...

```bash
python grid_bot.py start --spacing geometric
```

## Profit Calculation

**Profit per grid** = (Grid spacing / Grid price) × Investment per grid

Example:
- Grid spacing: $1,000
- Grid price: $45,000
- Investment per grid: $100

Profit per grid = ($1,000 / $45,000) × $100 = $2.22 per filled grid

**Annualized return** depends on volatility:
- Low volatility: 10-30% APY
- Medium volatility: 30-80% APY
- High volatility: 80-200%+ APY

## Risk Management

### Stop Loss
Automatically stops bot and sells all if price drops below threshold:

```bash
python grid_bot.py start --stop-loss 35000
```

### Take Profit
Automatically stops bot and sells all if price rises above threshold:

```bash
python grid_bot.py start --take-profit 55000
```

### Max Position
Limit maximum position size:

```bash
python grid_bot.py start --max-position 0.5  # Max 0.5 BTC
```

## Backtesting

Test your grid parameters with historical data:

```bash
python grid_bot.py backtest \
    --symbol BTCUSDT \
    --lower 40000 \
    --upper 50000 \
    --grids 20 \
    --investment 1000 \
    --days 30
```

Output:
```
Backtest Results (30 days)
═══════════════════════════════════════
Total Trades:      156
Win Rate:          100% (grid always profits)
Total Profit:      $127.45 (12.7%)
Annualized:        154.7%
Max Drawdown:      -8.2%
Price in Range:    78.5% of time
```

## API Integration

### Supported Exchanges
- Binance
- Bybit
- OKX
- Kraken

### Environment Variables
```bash
export BINANCE_API_KEY="your-key"
export BINANCE_API_SECRET="your-secret"
```

## Troubleshooting

### "Price out of range"
Current price is outside your grid range. Either:
1. Adjust your upper/lower prices
2. Wait for price to return to range
3. Use Infinity Grid for no upper limit

### "Insufficient balance"
Not enough funds for all grid orders. Either:
1. Reduce investment amount
2. Reduce number of grids
3. Add more funds

### "Min order size"
Order size too small for exchange. Either:
1. Increase investment
2. Reduce number of grids

## Advanced Usage

### Multiple Bots
Run multiple grid bots on different pairs:

```bash
python grid_bot.py start --symbol BTCUSDT --lower 40000 --upper 50000
python grid_bot.py start --symbol ETHUSDT --lower 2000 --upper 3000
```

### Dynamic Grid Adjustment
Enable auto-adjustment based on volatility:

```bash
python grid_bot.py start --auto-adjust --volatility-factor 1.5
```

## Integration with K.I.T.

The Grid Bot integrates with K.I.T. for:
- Unified portfolio tracking
- Cross-strategy risk management
- Telegram/Discord notifications
- Performance analytics
