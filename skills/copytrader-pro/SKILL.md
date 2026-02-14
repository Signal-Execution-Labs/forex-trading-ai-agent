# CopyTrader Pro

> eToro-inspired copy trading with advanced filtering and risk management

## Features

### Trader Discovery
- Filter by performance (ROI, win rate, max drawdown)
- Filter by sector focus (crypto, forex, stocks, commodities)
- Filter by strategy type (scalping, swing, position)
- Risk score matching (1-10 scale)
- Copy up to 100 traders simultaneously

### Smart Copying
- **Proportional Copying:** Mirrors trader's position sizes as % of portfolio
- **Fixed Amount:** Set max allocation per copied trade
- **Risk-Adjusted:** Automatically reduce size for high-risk trades
- **Selective Copying:** Choose which asset classes to copy

### Risk Management
- **Max Drawdown Limit:** Auto-stop copying at X% loss
- **Copy Stop-Loss:** Individual CSL per copied trader
- **Diversification Rules:** Max 20% portfolio per trader
- **Pause on Losing Streak:** Auto-pause after N consecutive losses

### Performance Analytics
- Real-time P&L tracking per copied trader
- Attribution analysis (which trader contributed what)
- Copy efficiency score
- Historical performance charts

## Configuration

```yaml
copytrader:
  max_traders: 100
  default_allocation_pct: 5
  max_allocation_per_trader: 20
  copy_mode: proportional # proportional | fixed | risk_adjusted
  risk_matching: true
  pause_after_losses: 5
  max_drawdown_pct: 15
```

## Commands

- `kit copy search [query]` - Find traders to copy
- `kit copy follow <trader_id>` - Start copying a trader
- `kit copy unfollow <trader_id>` - Stop copying
- `kit copy list` - List all copied traders
- `kit copy stats` - Performance attribution

## API Endpoints

- `POST /api/copy/follow` - Follow a trader
- `DELETE /api/copy/follow/:id` - Unfollow
- `GET /api/copy/traders` - Search traders
- `GET /api/copy/portfolio` - Copy portfolio status
- `GET /api/copy/attribution` - P&L attribution
