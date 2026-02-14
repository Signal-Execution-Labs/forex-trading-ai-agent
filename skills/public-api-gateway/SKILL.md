# Public API Gateway

> Self-hosted API for third-party access (eToro Open API inspired)

## Overview

Expose your K.I.T. data via REST API. Let external apps, dashboards, or services access your portfolio, signals, and market data.

## Features

### Market Data API
- Real-time quotes (1s refresh)
- Historical OHLCV data
- Order book depth
- 24h statistics

### Portfolio API
- Current positions
- Open orders
- Trade history
- P&L calculations
- Equity curve

### Social API
- Your signals
- Follower data
- Performance metrics
- Leaderboard position

### Execution API (Restricted)
- Place orders
- Modify/cancel orders
- Set SL/TP
- Requires additional auth

## Authentication

- **API Key:** For read-only access
- **API Key + Secret:** For portfolio data
- **OAuth 2.0:** For execution (user approval required)

## Rate Limits

| Tier | Requests/min | Data Calls/day |
|------|--------------|----------------|
| Free | 60 | 10,000 |
| Pro | 300 | 100,000 |
| Enterprise | 1,000 | Unlimited |

## Endpoints

### Market Data
```
GET /public/api/v1/quotes/:symbol
GET /public/api/v1/candles/:symbol
GET /public/api/v1/orderbook/:symbol
GET /public/api/v1/ticker/24h
```

### Portfolio (Auth Required)
```
GET /public/api/v1/portfolio
GET /public/api/v1/positions
GET /public/api/v1/orders
GET /public/api/v1/trades
GET /public/api/v1/equity
```

### Social
```
GET /public/api/v1/signals
GET /public/api/v1/profile/:user_id
GET /public/api/v1/leaderboard
GET /public/api/v1/followers
```

### Execution (OAuth Required)
```
POST /public/api/v1/orders
PUT /public/api/v1/orders/:id
DELETE /public/api/v1/orders/:id
```

## Webhooks

Subscribe to real-time events:
- `signal.new` - New signal published
- `trade.opened` - Position opened
- `trade.closed` - Position closed
- `price.alert` - Price target hit

## Commands

- `kit api keys` - Manage API keys
- `kit api logs` - View API usage
- `kit api webhooks` - Manage webhooks
- `kit api docs` - Open API documentation

## Security

- All endpoints over HTTPS
- IP whitelisting available
- Request signing for sensitive endpoints
- Audit log for all API calls
