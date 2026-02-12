# Floating Bar Tooltip

> TradingView-style floating tooltip for detailed bar analysis on charts

## Overview

Provides a floating tooltip that appears on long-press/hover, displaying OHLCV values and price change for any bar. Follows cursor movement for seamless data inspection across charts.

## Features

### Core Functionality
- **Long-Press Activation:** Touch or click-hold to activate tooltip
- **Cursor Following:** Tooltip follows mouse/finger across chart
- **OHLCV Display:** Open, High, Low, Close, Volume for selected bar
- **Price Change:** Percentage and absolute change from previous bar
- **Multi-Timeframe:** Works on any chart timeframe

### Advanced Data
- **Indicator Values:** Show current indicator readings at bar
- **Volume Analysis:** Volume vs average, buy/sell pressure
- **Time Info:** Full timestamp, session info, day of week
- **Custom Fields:** Add any indicator value to tooltip

### Styling Options
- **Themes:** Dark, light, custom colors
- **Position:** Auto-position to avoid chart edges
- **Size:** Compact, normal, detailed modes
- **Opacity:** Adjustable background transparency

## Usage

```typescript
// Enable floating tooltip
kit.chart.enableTooltip({
  mode: 'detailed',
  showIndicators: ['RSI', 'MACD', 'Volume'],
  theme: 'dark',
  delay: 300  // ms before showing
});

// Custom tooltip fields
kit.chart.addTooltipField('customRSI', (bar) => {
  return `RSI: ${calculateRSI(bar, 14).toFixed(2)}`;
});
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/chart/tooltip/config | Get tooltip configuration |
| PUT | /api/chart/tooltip/config | Update tooltip settings |
| POST | /api/chart/tooltip/fields | Add custom tooltip field |
| DELETE | /api/chart/tooltip/fields/:id | Remove custom field |

## Inspired By

TradingView 2025 Release - Floating tooltip for detailed bar analysis in Cursors menu.
