# Floating Chart Inspector

Interactive tooltip system for detailed bar analysis. Shows OHLCV values, indicator readings, and key metrics on hover.

## Features

- **OHLCV Tooltip**: Open, High, Low, Close, Volume on any bar
- **Price Change**: Percentage and absolute change from previous bar
- **Indicator Values**: RSI, MACD, EMA at cursor position
- **Volume Analysis**: Volume compared to average, buy/sell breakdown
- **Time Context**: Bar time, session info, market hours
- **Quick Actions**: Set alerts, draw levels, mark important bars
- **Multi-Monitor**: Works across chart windows

## Usage

```typescript
import { ChartInspector } from 'kit-trading/skills/floating-chart-inspector';

// Enable inspector on chart
ChartInspector.enable({
  chartId: 'chart_main',
  position: 'follow', // 'follow' | 'fixed_top' | 'fixed_bottom'
  showIndicators: true,
  showVolume: true,
  showChange: true
});

// Get bar data at specific point
const barData = ChartInspector.getBarAt({
  symbol: 'BTCUSDT',
  timestamp: '2026-02-14T12:00:00Z'
});
```

## Tooltip Content

### Basic Mode
- Open / High / Low / Close
- Volume
- Price change (% and absolute)
- Bar timestamp

### Extended Mode (hover hold)
- All basic info
- RSI value
- MACD value/signal/histogram
- EMA values (9, 21, 50)
- Volume vs 20-bar average
- Buy/Sell volume split
- Session context (Asian/London/NY)
- Distance from daily high/low

### Pro Mode (right-click)
- All extended info
- Add quick alert at this price
- Draw horizontal line
- Mark as key level
- Copy bar data to clipboard
- Export to journal

## Configuration

```yaml
floating-chart-inspector:
  enabled: true
  position: follow           # follow | fixed_top | fixed_bottom
  delay_ms: 100              # Delay before showing tooltip
  persist_ms: 500            # How long tooltip stays after leaving bar
  mode: extended             # basic | extended | pro
  show:
    ohlcv: true
    change: true
    indicators: [rsi, macd, ema]
    volume_analysis: true
    session_context: true
  quick_actions:
    alert: true
    draw_line: true
    mark_level: true
    copy_data: true
```

## Output Format

```json
{
  "bar": {
    "timestamp": "2026-02-14T12:00:00Z",
    "open": 42150.50,
    "high": 42380.00,
    "low": 42050.25,
    "close": 42290.75,
    "volume": 1250.45
  },
  "change": {
    "absolute": 140.25,
    "percent": 0.33,
    "direction": "up"
  },
  "indicators": {
    "rsi": 58.4,
    "macd": { "value": 125.5, "signal": 98.2, "histogram": 27.3 },
    "ema9": 42180.50,
    "ema21": 42050.25,
    "ema50": 41800.00
  },
  "volume": {
    "value": 1250.45,
    "average": 980.20,
    "ratio": 1.28,
    "aboveAverage": true,
    "buyVolume": 720.30,
    "sellVolume": 530.15
  },
  "context": {
    "session": "london",
    "marketHours": true,
    "distanceFromDailyHigh": -90.25,
    "distanceFromDailyLow": 240.50
  }
}
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `I` | Toggle inspector mode |
| `Shift+Hover` | Extended info mode |
| `Right-Click` | Pro mode with actions |
| `C` | Copy bar data |
| `A` | Quick alert at price |
| `L` | Draw horizontal line |

## Inspired By

- TradingView floating tooltip for detailed bar analysis
- Professional trading platform data windows
- Cross-bar inspection tools
