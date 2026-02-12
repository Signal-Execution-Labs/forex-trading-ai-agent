# Market Replay

> **Skill #92** - Historical market simulation for strategy testing

## Overview

Replay historical market data in real-time or accelerated speed. Practice trading, test strategies, and learn from past market events without risking capital.

Inspired by TradingView's Replay feature.

## Features

- **9 Replay Speeds:** 0.5x, 1x, 2x, 3x, 5x, 10x, 25x, 50x, 100x
- **Step Mode:** Advance bar-by-bar for precise analysis
- **Multi-Chart Sync:** Replay multiple timeframes together
- **Drawing Tools:** Mark up charts during replay
- **Order Simulation:** Place virtual trades during replay
- **Performance Tracking:** P&L, win rate, stats from replay trades
- **Event Markers:** Jump to news events, earnings, Fed meetings

## Usage

```bash
# Start replay from specific date
kit skill replay --symbol BTCUSDT --date 2024-03-14 --speed 10x

# Step-by-step mode
kit skill replay --symbol EURUSD --date 2024-01-01 --mode step

# Replay with paper trading
kit skill replay --symbol AAPL --date 2024-11-05 --paper-trade

# Jump to event
kit skill replay --symbol SPY --event "2024-fed-rate-cut"
```

## Configuration

```yaml
market_replay:
  default_speed: 5x
  default_timeframe: 5m
  
  speeds:
    - 0.5x
    - 1x
    - 2x
    - 3x
    - 5x
    - 10x
    - 25x
    - 50x
    - 100x
  
  paper_trading:
    initial_balance: 100000
    commission: 0.001
    slippage: 0.0001
  
  saved_events:
    - name: "2024 Bitcoin Halving"
      date: "2024-04-20"
      symbol: "BTCUSDT"
    - name: "2024 US Election"
      date: "2024-11-05"
      symbols: ["SPY", "DXY", "XAUUSD"]
    - name: "2025 Fed Rate Cut"
      date: "2025-01-29"
```

## Controls

| Key | Action |
|-----|--------|
| `Space` | Play/Pause |
| `→` | Next bar (step mode) |
| `←` | Previous bar |
| `+` | Increase speed |
| `-` | Decrease speed |
| `B` | Place buy order |
| `S` | Place sell order |
| `X` | Close position |
| `J` | Jump to date |

## Example Session

```json
{
  "session": {
    "symbol": "BTCUSDT",
    "start_date": "2024-03-14",
    "end_date": "2024-03-14T23:59:59Z",
    "duration_real": "45m",
    "duration_simulated": "24h"
  },
  "paper_results": {
    "trades": 12,
    "winners": 8,
    "losers": 4,
    "win_rate": 66.67,
    "profit": 2340.50,
    "max_drawdown": 890.00,
    "sharpe": 1.42
  },
  "notes": [
    "BTC broke ATH at 73k",
    "Caught long at 71.2k, held through consolidation",
    "Missed short opportunity at rejection"
  ]
}
```

## Educational Scenarios

### Pre-built Learning Sessions
```yaml
scenarios:
  - name: "Flash Crash Trading"
    description: "Learn to trade extreme volatility"
    events: ["2024-08-05-jpycrash", "2022-05-luna"]
  
  - name: "Earnings Trading"
    description: "Practice earnings gap strategies"
    events: ["NVDA-earnings-2024", "AAPL-earnings-2024"]
  
  - name: "News Trading"
    description: "Trade CPI, FOMC, NFP releases"
    events: ["2024-cpi-dates", "2024-fomc-dates"]
```

## Integration

- **Journal:** Auto-log replay sessions and performance
- **Strategy Testing:** Validate strategies on historical events
- **Learning Mode:** Guided tutorials through market events
- **Competition:** Compete on same historical scenarios
