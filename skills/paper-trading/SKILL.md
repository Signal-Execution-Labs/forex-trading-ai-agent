# Paper Trading

Risk-free trading simulation with real market data. Test strategies without risking real money.

## Features

- **Virtual Balance**: Start with customizable paper money
- **Real-Time Prices**: Uses live market data for realistic execution
- **Order Types**: Market, Limit, Stop-Loss, Take-Profit orders
- **Performance Tracking**: Full P&L, win rate, and analytics
- **Leaderboard**: Compare with other paper traders
- **Strategy Testing**: Test any strategy risk-free

## Quick Start

### Initialize Paper Account

```bash
python paper_trading.py init --balance 10000 --currency USD
```

### Place Orders

```bash
# Market buy
python paper_trading.py buy BTCUSDT 0.1 --type market

# Limit buy
python paper_trading.py buy BTCUSDT 0.1 --type limit --price 42000

# Market sell
python paper_trading.py sell BTCUSDT 0.1 --type market

# With stop-loss and take-profit
python paper_trading.py buy BTCUSDT 0.1 --sl 40000 --tp 50000
```

### Check Portfolio

```bash
python paper_trading.py portfolio
```

### View Trade History

```bash
python paper_trading.py history --limit 20
```

### Performance Report

```bash
python paper_trading.py report
```

## API Usage

```python
from paper_trading import PaperTradingAccount

# Initialize account
account = PaperTradingAccount(initial_balance=10000)

# Place trades
account.buy('BTCUSDT', quantity=0.1, order_type='market')
account.sell('BTCUSDT', quantity=0.05, order_type='limit', price=50000)

# Check status
print(account.get_portfolio())
print(account.get_pnl())
```

## Order Types

| Type | Description |
|------|-------------|
| `market` | Execute immediately at current price |
| `limit` | Execute when price reaches target |
| `stop` | Convert to market when stop price hit |
| `stop_limit` | Convert to limit when stop price hit |

## Realistic Execution

Paper trading simulates realistic conditions:

- **Slippage**: Random 0.01-0.05% slippage on market orders
- **Fees**: Configurable trading fees (default 0.1%)
- **Partial Fills**: Large orders may be partially filled
- **Delays**: Simulated network latency

## Persistence

Account state is saved to `paper_account.json`:

```json
{
  "account_id": "paper_001",
  "created_at": "2025-01-01T00:00:00Z",
  "initial_balance": 10000,
  "current_balance": 10500,
  "positions": {
    "BTCUSDT": {"quantity": 0.1, "avg_price": 45000}
  },
  "trades": [...],
  "settings": {...}
}
```

## Competitions

Run paper trading competitions:

```bash
# Start a competition
python paper_trading.py competition create --name "Weekly Challenge" --duration 7d

# Join competition
python paper_trading.py competition join --id weekly-001

# View leaderboard
python paper_trading.py competition leaderboard --id weekly-001
```

## Reset Account

```bash
# Reset to initial state
python paper_trading.py reset --confirm

# Reset with new balance
python paper_trading.py reset --balance 5000
```

## Integration

Paper trading integrates with:
- All K.I.T. trading tools
- Auto-trader (test mode)
- Grid bot (simulation)
- Backtest validation
