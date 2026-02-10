---
summary: "Complete K.I.T. API Reference"
title: "API Reference"
---

# K.I.T. API Reference 📖

Complete reference of all API methods with examples.

---

## 📡 Connection

### Base URL

```
WebSocket: ws://localhost:18799
HTTP:      http://localhost:18799
```

### Authentication

```javascript
// Token-based auth (Header)
const ws = new WebSocket('ws://localhost:18799', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
});

// Or in connect params
ws.send(JSON.stringify({
  type: 'req',
  id: '1',
  method: 'connect',
  params: {
    auth: { token: 'YOUR_TOKEN' }
  }
}));
```

---

## 🔌 Core Methods

### `connect`

Establish connection to the gateway.

**Request:**
```json
{
  "type": "req",
  "id": "conn_1",
  "method": "connect",
  "params": {
    "auth": { "token": "optional" },
    "device": {
      "id": "client_123",
      "name": "My Bot",
      "type": "desktop"
    },
    "role": "operator"
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "conn_1",
  "ok": true,
  "payload": {
    "sessionId": "sess_abc123",
    "gatewayId": "kit-gateway-main",
    "version": "1.0.0"
  }
}
```

### `disconnect`

Cleanly disconnect.

```json
{
  "type": "req",
  "id": "disc_1",
  "method": "disconnect"
}
```

### `ping`

Keep-alive ping.

```json
{
  "type": "req",
  "id": "ping_1",
  "method": "ping"
}
```

**Response:**
```json
{
  "type": "res",
  "id": "ping_1",
  "ok": true,
  "payload": { "pong": 1707555600000 }
}
```

---

## 💬 Chat Methods

### `chat.send`

Send message to the AI agent.

**Request:**
```json
{
  "type": "req",
  "id": "chat_1",
  "method": "chat.send",
  "params": {
    "message": "Analyze BTC/USDT",
    "sessionId": "sess_123",
    "stream": true
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | string | ✅ | User message |
| `sessionId` | string | ❌ | Session ID (default: main) |
| `stream` | boolean | ❌ | Stream response chunks |

**Events (when stream=true):**
```javascript
// Start
{ "type": "event", "event": "chat.start", "payload": { "sessionId": "sess_123", "requestId": "req_1" } }

// Chunks
{ "type": "event", "event": "chat.chunk", "payload": { "chunk": "BTC is currently..." } }

// Tool Call
{ "type": "event", "event": "chat.tool_call", "payload": { "toolCall": { "name": "market_analyze" } } }

// Complete
{ "type": "event", "event": "chat.complete", "payload": { "message": {...} } }
```

### `chat.history`

Retrieve chat history.

```json
{
  "type": "req",
  "id": "hist_1",
  "method": "chat.history",
  "params": {
    "sessionId": "sess_123",
    "limit": 50,
    "before": "msg_456"
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "hist_1",
  "ok": true,
  "payload": {
    "messages": [
      { "id": "msg_1", "role": "user", "content": "Hello" },
      { "id": "msg_2", "role": "assistant", "content": "Hello! How can I help?" }
    ],
    "hasMore": false
  }
}
```

### `chat.abort`

Abort running request.

```json
{
  "type": "req",
  "id": "abort_1",
  "method": "chat.abort",
  "params": {
    "sessionId": "sess_123",
    "requestId": "req_1"
  }
}
```

---

## 📊 Portfolio Methods

### `portfolio.get`

Retrieve portfolio overview.

```json
{
  "type": "req",
  "id": "port_1",
  "method": "portfolio.get",
  "params": {
    "includeHistory": true,
    "currency": "USD"
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "port_1",
  "ok": true,
  "payload": {
    "totalValueUsd": 45231.50,
    "change24h": 2.3,
    "assets": [
      {
        "symbol": "BTC",
        "amount": 0.5,
        "valueUsd": 33750.00,
        "allocation": 74.6,
        "change24h": 3.2
      },
      {
        "symbol": "ETH",
        "amount": 2.5,
        "valueUsd": 8750.00,
        "allocation": 19.3,
        "change24h": 1.8
      }
    ],
    "positions": [],
    "history": [
      { "timestamp": 1707555600000, "value": 44500 },
      { "timestamp": 1707469200000, "value": 44200 }
    ]
  }
}
```

### `portfolio.pnl`

Profit & Loss analysis.

```json
{
  "type": "req",
  "id": "pnl_1",
  "method": "portfolio.pnl",
  "params": {
    "period": "7d"
  }
}
```

| period | Description |
|--------|-------------|
| `24h` | Last 24 hours |
| `7d` | Last 7 days |
| `30d` | Last 30 days |
| `ytd` | Year to date |
| `all` | All time |

---

## ⚡ Trading Methods

### `trade.execute`

Execute a trade.

```json
{
  "type": "req",
  "id": "trade_1",
  "method": "trade.execute",
  "params": {
    "exchange": "binance",
    "action": "buy",
    "pair": "BTC/USDT",
    "type": "market",
    "amount": 100,
    "amountType": "quote",
    "stopLoss": 65000,
    "takeProfit": 72000
  }
}
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `exchange` | string | ✅ | Exchange ID |
| `action` | string | ✅ | `buy` or `sell` |
| `pair` | string | ✅ | Trading pair |
| `type` | string | ✅ | `market`, `limit`, `stop` |
| `amount` | number | ✅ | Amount |
| `amountType` | string | ❌ | `base` or `quote` |
| `price` | number | ❌ | Limit price |
| `stopLoss` | number | ❌ | Stop loss price |
| `takeProfit` | number | ❌ | Take profit price |

**Response:**
```json
{
  "type": "res",
  "id": "trade_1",
  "ok": true,
  "payload": {
    "orderId": "ord_12345",
    "status": "filled",
    "executedQty": 0.0015,
    "executedPrice": 67250.00,
    "fees": 0.10,
    "timestamp": 1707555600000
  }
}
```

### `trade.positions`

Retrieve open positions.

```json
{
  "type": "req",
  "id": "pos_1",
  "method": "trade.positions",
  "params": {
    "exchange": "binance"
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "pos_1",
  "ok": true,
  "payload": {
    "positions": [
      {
        "id": "pos_123",
        "exchange": "binance",
        "pair": "BTC/USDT",
        "side": "long",
        "size": 0.1,
        "entryPrice": 65000,
        "currentPrice": 67500,
        "unrealizedPnl": 250.00,
        "unrealizedPnlPercent": 3.85,
        "stopLoss": 63000,
        "takeProfit": 70000,
        "openedAt": 1707469200000
      }
    ]
  }
}
```

### `trade.close`

Close position.

```json
{
  "type": "req",
  "id": "close_1",
  "method": "trade.close",
  "params": {
    "positionId": "pos_123",
    "percentage": 100
  }
}
```

### `trade.history`

Retrieve trade history.

```json
{
  "type": "req",
  "id": "thist_1",
  "method": "trade.history",
  "params": {
    "exchange": "binance",
    "pair": "BTC/USDT",
    "limit": 50,
    "from": 1707382800000,
    "to": 1707555600000
  }
}
```

---

## 📈 Market Methods

### `market.analyze`

Perform market analysis.

```json
{
  "type": "req",
  "id": "analyze_1",
  "method": "market.analyze",
  "params": {
    "pair": "BTC/USDT",
    "exchange": "binance",
    "timeframe": "1h",
    "indicators": ["rsi", "macd", "ma"]
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "analyze_1",
  "ok": true,
  "payload": {
    "pair": "BTC/USDT",
    "price": 67500.00,
    "change24h": 2.5,
    "trend": "bullish",
    "indicators": {
      "rsi": { "value": 58, "signal": "neutral" },
      "macd": { "value": 150, "signal": "bullish", "histogram": 25 },
      "ma": {
        "ma20": 66500,
        "ma50": 65000,
        "ma200": 58000
      }
    },
    "support": [65000, 63000, 60000],
    "resistance": [70000, 72000, 75000],
    "signal": "buy",
    "confidence": 72
  }
}
```

### `market.price`

Get current price.

```json
{
  "type": "req",
  "id": "price_1",
  "method": "market.price",
  "params": {
    "pair": "BTC/USDT",
    "exchange": "binance"
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "price_1",
  "ok": true,
  "payload": {
    "pair": "BTC/USDT",
    "bid": 67490.00,
    "ask": 67510.00,
    "last": 67500.00,
    "high24h": 68000.00,
    "low24h": 66000.00,
    "volume24h": 15000.5,
    "timestamp": 1707555600000
  }
}
```

### `market.candles`

Get OHLCV candles.

```json
{
  "type": "req",
  "id": "candles_1",
  "method": "market.candles",
  "params": {
    "pair": "BTC/USDT",
    "exchange": "binance",
    "timeframe": "1h",
    "limit": 100
  }
}
```

---

## 🔔 Alert Methods

### `alert.create`

Create new alert.

```json
{
  "type": "req",
  "id": "alert_1",
  "method": "alert.create",
  "params": {
    "type": "price",
    "pair": "BTC/USDT",
    "condition": "above",
    "value": 70000,
    "message": "BTC reached $70k!",
    "channels": ["telegram"]
  }
}
```

| type | condition | Description |
|------|-----------|-------------|
| `price` | `above`, `below`, `cross` | Price alert |
| `indicator` | `above`, `below`, `cross` | Indicator alert |
| `portfolio` | `above`, `below`, `change` | Portfolio alert |

### `alert.list`

List alerts.

```json
{
  "type": "req",
  "id": "alerts_1",
  "method": "alert.list"
}
```

### `alert.delete`

Delete alert.

```json
{
  "type": "req",
  "id": "del_alert_1",
  "method": "alert.delete",
  "params": {
    "alertId": "alert_123"
  }
}
```

---

## ⏮️ Backtest Methods

### `backtest.run`

Run backtest.

```json
{
  "type": "req",
  "id": "bt_1",
  "method": "backtest.run",
  "params": {
    "strategy": "ma_crossover",
    "pair": "BTC/USDT",
    "timeframe": "1h",
    "from": "2024-01-01",
    "to": "2024-12-31",
    "initialBalance": 10000,
    "params": {
      "fastPeriod": 10,
      "slowPeriod": 20
    }
  }
}
```

**Response:**
```json
{
  "type": "res",
  "id": "bt_1",
  "ok": true,
  "payload": {
    "backtestId": "bt_abc123",
    "strategy": "ma_crossover",
    "pair": "BTC/USDT",
    "results": {
      "totalReturn": 28.5,
      "buyAndHold": 45.2,
      "maxDrawdown": 12.3,
      "sharpeRatio": 1.85,
      "winRate": 62,
      "totalTrades": 48,
      "profitFactor": 1.65
    },
    "trades": [...]
  }
}
```

### `backtest.optimize`

Parameter optimization.

```json
{
  "type": "req",
  "id": "opt_1",
  "method": "backtest.optimize",
  "params": {
    "strategy": "ma_crossover",
    "pair": "BTC/USDT",
    "paramGrid": {
      "fastPeriod": [5, 10, 15, 20],
      "slowPeriod": [20, 30, 40, 50]
    },
    "metric": "sharpeRatio"
  }
}
```

---

## ⏰ Cron Methods

### `cron.list`

List scheduled jobs.

```json
{
  "type": "req",
  "id": "cron_list_1",
  "method": "cron.list"
}
```

### `cron.add`

Create new job.

```json
{
  "type": "req",
  "id": "cron_add_1",
  "method": "cron.add",
  "params": {
    "name": "daily_report",
    "schedule": "0 9 * * *",
    "prompt": "Create my daily portfolio report",
    "enabled": true
  }
}
```

### `cron.run`

Run job manually.

```json
{
  "type": "req",
  "id": "cron_run_1",
  "method": "cron.run",
  "params": {
    "name": "daily_report"
  }
}
```

### `cron.remove`

Delete job.

```json
{
  "type": "req",
  "id": "cron_del_1",
  "method": "cron.remove",
  "params": {
    "name": "daily_report"
  }
}
```

---

## 📊 Session Methods

### `sessions.list`

List sessions.

```json
{
  "type": "req",
  "id": "sess_list_1",
  "method": "sessions.list"
}
```

### `sessions.get`

Get session details.

```json
{
  "type": "req",
  "id": "sess_get_1",
  "method": "sessions.get",
  "params": {
    "sessionId": "sess_123"
  }
}
```

### `sessions.create`

Create new session.

```json
{
  "type": "req",
  "id": "sess_create_1",
  "method": "sessions.create",
  "params": {
    "name": "MT5 Trading Session",
    "mode": "auto"
  }
}
```

---

## 🔍 Memory Methods

### `memory.search`

Search memory.

```json
{
  "type": "req",
  "id": "mem_search_1",
  "method": "memory.search",
  "params": {
    "query": "EURUSD trade",
    "limit": 10
  }
}
```

### `memory.get`

Get memory file.

```json
{
  "type": "req",
  "id": "mem_get_1",
  "method": "memory.get",
  "params": {
    "path": "memory/2024-02-10.md"
  }
}
```

---

## ❌ Error Codes

| Code | HTTP | Description |
|------|------|-------------|
| `INVALID_FRAME` | 400 | Malformed request |
| `MISSING_PARAMS` | 400 | Required parameter missing |
| `INVALID_PARAMS` | 400 | Invalid parameter value |
| `UNKNOWN_METHOD` | 404 | Method not found |
| `AUTH_REQUIRED` | 401 | Authentication required |
| `AUTH_INVALID` | 401 | Invalid credentials |
| `AUTH_EXPIRED` | 401 | Token expired |
| `FORBIDDEN` | 403 | Not authorized |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `AGENT_BUSY` | 503 | Agent processing |
| `INTERNAL_ERROR` | 500 | Server error |

---

## 💻 Client Examples

### JavaScript/TypeScript

```typescript
import { KitClient } from '@binaryfaster/kit';

const client = new KitClient({ url: 'ws://localhost:18799' });
await client.connect();

// Portfolio
const portfolio = await client.portfolio.get();
console.log('Total:', portfolio.totalValueUsd);

// Trade
const order = await client.trade.execute({
  exchange: 'binance',
  action: 'buy',
  pair: 'BTC/USDT',
  type: 'market',
  amount: 100
});

// Stream chat
for await (const chunk of client.chat.stream('Analyze BTC')) {
  process.stdout.write(chunk);
}

await client.disconnect();
```

### Python

```python
import asyncio
from kit import KitClient

async def main():
    client = KitClient(url="ws://localhost:18799")
    await client.connect()
    
    # Portfolio
    portfolio = await client.portfolio.get()
    print(f"Total: ${portfolio['totalValueUsd']:,.2f}")
    
    # Trade
    order = await client.trade.execute(
        exchange="binance",
        action="buy",
        pair="BTC/USDT",
        type="market",
        amount=100
    )
    
    # Chat
    async for chunk in client.chat.stream("Analyze BTC"):
        print(chunk, end="")
    
    await client.disconnect()

asyncio.run(main())
```

### cURL (HTTP)

```bash
# Health check
curl http://localhost:18799/health

# Note: For full API functionality, use WebSocket
```

---

## 📐 Rate Limits

| Method Group | Limit | Window |
|--------------|-------|--------|
| `chat.*` | 10 | 1 min |
| `trade.*` | 60 | 1 min |
| `market.*` | 100 | 1 min |
| `backtest.*` | 5 | 1 min |
| `*` (other) | 100 | 1 min |

---

## 🔄 Changelog

### v1.0.0 (2026-02-10)
- Initial API release
- Full trading capabilities
- Portfolio management
- Market analysis
- Backtesting

---

**Version:** 1.0.0  
**Created:** 2026-02-10  
**Author:** K.I.T. [Sprint-Agent]
