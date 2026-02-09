# K.I.T. Dashboard

## Overview

The K.I.T. Dashboard provides a real-time web interface for monitoring and managing the trading bot. It features portfolio tracking, position management, trade history, strategy performance analytics, and risk metrics visualization.

## Architecture

```
src/dashboard/
├── server.ts          # Express server with WebSocket support
├── api.ts             # REST API endpoints
├── websocket.ts       # Real-time WebSocket updates
└── public/
    ├── index.html     # Single-page application
    ├── css/
    │   └── style.css  # Dark theme styling
    └── js/
        ├── app.js     # Main application logic
        └── charts.js  # Chart.js configurations
```

## Features

### 1. Portfolio Overview
- **Total Equity**: Current portfolio value with real-time updates
- **Unrealized P&L**: Open position profits/losses
- **Today's P&L**: Realized profits for the current day
- **Win Rate**: Percentage of winning trades
- **Sharpe Ratio**: Risk-adjusted return metric
- **Max Drawdown**: Largest peak-to-trough decline

### 2. Open Positions
- Real-time position tracking
- Entry price vs current price comparison
- P&L calculation in dollars and percentage
- Strategy attribution
- Position duration

### 3. Trade History
- Complete trade log with timestamps
- Buy/Sell classification
- Size, price, and fee tracking
- P&L per closed trade
- Strategy attribution

### 4. Strategy Performance
- Individual strategy metrics
- Win rate per strategy
- Total and average P&L
- Sharpe ratio comparison
- Active/Inactive status

### 5. Risk Management
- Risk Score (0-100 gauge)
- Portfolio VaR (Value at Risk)
- Daily VaR limits
- Margin usage monitoring
- Leverage tracking
- Current exposure analysis

### 6. Real-time Charts
- Portfolio performance over time
- P&L distribution by strategy
- Live price charts with multiple timeframes (1m, 5m, 1H, 4H, 1D)
- Risk gauge visualization

## API Endpoints

### REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/health` | GET | Health check |
| `/api/portfolio` | GET | Portfolio summary |
| `/api/positions` | GET | Open positions |
| `/api/trades` | GET | Trade history (query: `limit`) |
| `/api/strategies` | GET | Strategy performance |
| `/api/risk` | GET | Risk metrics |
| `/api/prices/:symbol` | GET | Price history (query: `timeframe`, `limit`) |
| `/api/stats` | GET | Aggregated dashboard stats |

### WebSocket Events

**Client → Server:**
- `subscribe` - Subscribe to a channel
- `unsubscribe` - Unsubscribe from a channel
- `ping` - Heartbeat ping

**Server → Client:**
- `connected` - Connection confirmation
- `prices` / `priceUpdate` - Price ticker updates
- `tradeExecuted` - New trade notification
- `positionUpdate` - Position change notification
- `pong` - Heartbeat response

## Configuration

### Environment Variables

```env
DASHBOARD_PORT=3000      # Server port (default: 3000)
DASHBOARD_HOST=localhost # Server host (default: localhost)
```

### Server Configuration

```typescript
import { DashboardServer } from './dashboard/server';

const dashboard = new DashboardServer({
  port: 3000,
  host: 'localhost',
  enableCors: true
});

await dashboard.start();
```

## Usage

### Starting the Dashboard

```bash
# Development
npx ts-node src/dashboard/server.ts

# Production
npm run build
node dist/dashboard/server.js
```

### Accessing the Dashboard

Open your browser and navigate to:
```
http://localhost:3000
```

## UI Components

### Navigation
- Sidebar with page links
- Connection status indicator
- Logo branding

### Header
- Page title
- Last update timestamp
- Live price ticker

### Cards
- Portfolio metric cards with icons
- Hover animations
- Color-coded values (green/red for P&L)

### Tables
- Sortable columns
- Hover highlighting
- Responsive layout

### Charts
- Chart.js powered visualizations
- Dark theme compatible
- Responsive sizing
- Tooltips with formatted values

## Styling

The dashboard uses a modern dark theme with:
- CSS custom properties for theming
- Gradient accents (blue/cyan/purple)
- Smooth animations and transitions
- Responsive breakpoints (1200px, 768px)

### Color Palette

| Variable | Color | Usage |
|----------|-------|-------|
| `--bg-primary` | #0a0e17 | Page background |
| `--bg-secondary` | #111827 | Sidebar, header |
| `--bg-card` | #1a2332 | Cards, containers |
| `--accent-blue` | #3b82f6 | Primary accent |
| `--accent-cyan` | #22d3ee | Secondary accent |
| `--success` | #10b981 | Positive values |
| `--danger` | #ef4444 | Negative values |

## Dependencies

- **Express**: HTTP server framework
- **ws**: WebSocket library
- **cors**: CORS middleware
- **Chart.js**: Charting library (via CDN)
- **chartjs-adapter-date-fns**: Date adapter for Chart.js

## Security Considerations

1. **Authentication**: Add authentication middleware for production
2. **CORS**: Configure allowed origins in production
3. **Rate Limiting**: Implement request rate limiting
4. **Input Validation**: Validate all API inputs
5. **HTTPS**: Use HTTPS in production

## Future Enhancements

- [ ] User authentication system
- [ ] Position management (open/close from UI)
- [ ] Strategy configuration panel
- [ ] Alerts and notifications
- [ ] Mobile-responsive improvements
- [ ] Dark/Light theme toggle
- [ ] Historical performance reports
- [ ] CSV/PDF export functionality

## Troubleshooting

### WebSocket Connection Issues
1. Check if server is running
2. Verify firewall settings
3. Check browser console for errors
4. Ensure correct WebSocket URL

### Charts Not Loading
1. Verify Chart.js CDN is accessible
2. Check browser console for errors
3. Ensure data is being returned from API

### Slow Performance
1. Reduce WebSocket update frequency
2. Implement data pagination
3. Use production build
4. Enable compression middleware
