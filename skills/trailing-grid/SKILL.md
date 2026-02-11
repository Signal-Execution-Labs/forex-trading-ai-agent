# Trailing Grid Bot

Advanced grid trading bot with auto-trailing capabilities. The grid automatically follows price movements, keeping you in profitable range.

## Features

- **Trailing Up**: Grid shifts upward as price rises (never miss bull runs)
- **Trailing Down**: Grid shifts downward as price falls (stay in range)
- **Infinity Trailing**: Combines infinity grid with trailing stops
- **AI Parameter Optimization**: Analyzes historical data for optimal settings
- **Dynamic Profit Per Grid**: Adjusts based on volatility

## How Trailing Grid Works

Traditional grid is static - if price leaves your range, you're stuck.
Trailing grid automatically adjusts:

```
Traditional Grid Problem:
═══════════════════════════════════════════════════════════════
Upper ────────────────────────── Grid ends here
       │ │ │ │ │ │ │ │ │ │ │
Lower ─────────────────────────
                                  Price keeps going → You miss it! ↗

Trailing Grid Solution:
═══════════════════════════════════════════════════════════════
                                        New Upper ───────────────
       │ │ │ │ │ │ │ │ │ │ │       │ │ │ │ │ │ │ │
Upper ────────────────────────      New Lower ──────────────────
       │ │ │ │ │ │ │ │ │ │ │       Grid trails price ↗
Lower ─────────────────────────

Price moves up → Grid moves up → You keep profiting!
```

## Quick Start

### 1. Start Trailing Grid

```bash
kit trailing-grid start \
    --symbol BTCUSDT \
    --lower 40000 \
    --upper 50000 \
    --grids 20 \
    --investment 2000 \
    --trail-up \
    --trail-trigger 3%  # Shift grid when price is 3% from edge
```

### 2. With AI Optimization

```bash
kit trailing-grid start \
    --symbol ETHUSDT \
    --investment 1000 \
    --ai-optimize \
    --days 30  # Analyze 30 days of history
```

AI will recommend:
- Optimal price range
- Grid count for your investment
- Profit per grid target
- Trail trigger percentage

### 3. Infinity Trailing Mode

```bash
kit trailing-grid start \
    --symbol BTCUSDT \
    --mode infinity-trailing \
    --investment 5000 \
    --profit-per-grid 0.6%
```

## Configuration

```yaml
trailing_grid:
  # Default exchange
  exchange: binance
  
  # Trailing settings
  trail_up: true          # Enable upward trailing
  trail_down: false       # Enable downward trailing
  trail_trigger: 3%       # Distance from edge to trigger trail
  trail_step: 2%          # How much to shift grid
  
  # AI optimization
  ai_optimize: true
  analysis_days: 30
  target_profit_per_grid: 0.5%  # Minimum profit target
  
  # Risk management
  stop_loss_percent: 10
  max_investment: 10000
  
  # Notifications
  notify_on_trail: true
  notify_on_fill: true
```

## Trail Modes

### 1. Trail Up Only (Default for Bulls)

Grid moves up with price, but doesn't move down.
- Great for: Accumulation during uptrends
- Behavior: Price up → Grid up, Price down → Grid stays

```bash
kit trailing-grid start --trail-up --no-trail-down
```

### 2. Trail Down Only (For Bears)

Grid moves down with price, but doesn't move up.
- Great for: Taking profits during downtrends
- Behavior: Price down → Grid down, Price up → Grid stays

```bash
kit trailing-grid start --trail-down --no-trail-up
```

### 3. Trail Both Directions

Grid follows price in both directions.
- Great for: Volatile markets, staying in range
- Behavior: Grid always centers around current price

```bash
kit trailing-grid start --trail-up --trail-down
```

### 4. Infinity Trailing (Advanced)

No upper limit + trailing stops instead of limit orders.
- Great for: Long-term HODL + profit taking
- Behavior: Infinity grid with trailing sell stops

```bash
kit trailing-grid start --mode infinity-trailing
```

## AI Optimization

K.I.T. analyzes historical price data to find optimal parameters:

```bash
kit trailing-grid optimize --symbol BTCUSDT --days 30 --investment 5000
```

Output:
```
AI Grid Optimization - BTCUSDT
═══════════════════════════════════════════════════════════════
Analysis Period:    30 days
Price Range:        $38,245 - $48,890 (27.8% volatility)
Average True Range: $1,247/day

Recommended Settings:
  Lower Price:      $36,000 (6% below low)
  Upper Price:      $52,000 (6% above high)
  Grid Count:       32
  Investment/Grid:  $156.25
  Profit/Grid:      0.58% ($0.91)
  Trail Trigger:    4%
  Trail Step:       3%

Expected Performance:
  Monthly Fills:    ~180-220 (based on volatility)
  Est. Monthly ROI: 8-15%
  Est. Annual ROI:  96-180%
  
Apply these settings? [y/N]
```

## Risk Management

### Smart Stop Loss

Trailing grid includes intelligent stop loss:

```bash
kit trailing-grid start --stop-loss trailing:5%
```

Options:
- `fixed:35000` - Fixed price stop loss
- `trailing:5%` - Trailing stop 5% below highest grid
- `atr:2` - Stop loss at 2x ATR below

### Maximum Drawdown Exit

Auto-exit when unrealized loss exceeds threshold:

```bash
kit trailing-grid start --max-drawdown 15%
```

### Profit Lock

Lock profits by raising stop loss:

```bash
kit trailing-grid start --profit-lock 50%  # After 50% profit, lock 30%
```

## Performance Tracking

### Real-time Stats

```bash
kit trailing-grid status
```

Output:
```
Trailing Grid Status - BTCUSDT
═══════════════════════════════════════════════════════════════
Status:          RUNNING (5d 12h 34m)
Current Price:   $45,234

Grid Position:
  Original Range: $40,000 - $50,000
  Current Range:  $42,500 - $52,500 (trailed up 2 times)
  Active Grids:   18/20

Performance:
  Total Trades:   89 (43 buys, 46 sells)
  Grid Profit:    $234.56 (11.7%)
  Holding Value:  $1,890.23
  Total Value:    $2,124.79 (+6.2%)
  
Trailing Events:
  - Feb 10 14:22: Trailed up from $40k-$50k to $41k-$51k
  - Feb 11 02:15: Trailed up from $41k-$51k to $42.5k-$52.5k
```

## Integration with K.I.T.

### Combined with DCA Bot

Run trailing grid + DCA for maximum efficiency:

```bash
kit strategy multi-bot \
    --trailing-grid "BTCUSDT:40000-50000" \
    --dca "BTC:weekly:$100"
```

### Telegram Commands

```
/trailing start BTCUSDT 40000 50000 20 1000
/trailing stop BTCUSDT
/trailing status
/trailing optimize ETHUSDT 5000
```

### API Access

```typescript
import { trailingGrid } from 'kit-trading/skills/trailing-grid';

// Start trailing grid
await trailingGrid.start({
  symbol: 'BTCUSDT',
  exchange: 'binance',
  lower: 40000,
  upper: 50000,
  grids: 20,
  investment: 2000,
  trailUp: true,
  trailTrigger: 0.03,  // 3%
  trailStep: 0.02      // 2%
});

// Get status
const status = await trailingGrid.status('BTCUSDT');

// Stop
await trailingGrid.stop('BTCUSDT');
```

## Backtesting

```bash
kit trailing-grid backtest \
    --symbol BTCUSDT \
    --days 90 \
    --investment 5000 \
    --trail-up \
    --trail-trigger 3%
```

Output:
```
Backtest: Trailing Grid vs Static Grid (90 days)
═══════════════════════════════════════════════════════════════
                    Static Grid     Trailing Grid
Trades:             312             478
Grid Profit:        $890            $1,456
Time in Range:      68%             94%
Final ROI:          17.8%           29.1%

→ Trailing Grid outperformed by +63%
```

## Troubleshooting

### "Too many trail events"

Grid is trailing too frequently. Increase trail trigger:
```bash
kit trailing-grid update --trail-trigger 5%
```

### "Grid shifted too far"

Enable trail limits to cap total shift:
```bash
kit trailing-grid start --max-trail 30%  # Max 30% shift from original
```

### "Slippage on trail"

Orders may not fill at exact grid prices during fast moves:
```bash
kit trailing-grid start --trail-method limit-chase  # Chase fills
```
