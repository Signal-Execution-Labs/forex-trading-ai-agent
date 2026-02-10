# K.I.T. WebSocket Protocol

The K.I.T. Gateway uses a JSON-RPC inspired protocol over WebSocket for real-time communication.

## Frame Types

### Request Frame

Client sends requests to the gateway:

```json
{
  "type": "req",
  "id": "unique_request_id",
  "method": "method.name",
  "params": {
    "key": "value"
  }
}
```

### Response Frame

Gateway responds to requests:

```json
{
  "type": "res",
  "id": "matching_request_id",
  "ok": true,
  "payload": {
    "result": "data"
  }
}
```

### Error Response

```json
{
  "type": "res",
  "id": "matching_request_id",
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  }
}
```

### Event Frame

Gateway pushes events to clients:

```json
{
  "type": "event",
  "event": "event.name",
  "payload": {
    "data": "value"
  },
  "seq": 42,
  "stateVersion": 1
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `INVALID_FRAME` | Malformed frame structure |
| `UNKNOWN_METHOD` | Method not recognized |
| `MISSING_PARAMS` | Required parameters missing |
| `AUTH_REQUIRED` | Authentication required |
| `AUTH_INVALID` | Invalid credentials |
| `AUTH_EXPIRED` | Token/session expired |
| `SESSION_NOT_FOUND` | Session doesn't exist |
| `AGENT_BUSY` | Agent is processing another request |
| `RATE_LIMITED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

## Connection Lifecycle

### 1. Connect

First frame must be a `connect` request:

```json
{
  "type": "req",
  "id": "conn_1",
  "method": "connect",
  "params": {
    "auth": {
      "token": "optional_auth_token"
    },
    "device": {
      "id": "device_unique_id",
      "name": "My Dashboard",
      "type": "desktop",
      "os": "Windows",
      "version": "1.0.0"
    },
    "role": "operator",
    "caps": ["streaming", "tools"]
  }
}
```

### 2. Hello Response

Gateway responds with session info:

```json
{
  "type": "res",
  "id": "conn_1",
  "ok": true,
  "payload": {
    "sessionId": "sess_abc123",
    "gatewayId": "kit-gateway-main",
    "version": "1.0.0",
    "health": {
      "status": "healthy",
      "uptime": 3600000
    },
    "presence": {
      "agents": {},
      "channels": {}
    }
  }
}
```

### 3. Keep-Alive

Send periodic pings to maintain connection:

```json
{
  "type": "req",
  "id": "ping_1",
  "method": "ping"
}
```

Response:

```json
{
  "type": "res",
  "id": "ping_1",
  "ok": true,
  "payload": {
    "pong": 1705312800000
  }
}
```

### 4. Disconnect

Graceful disconnect:

```json
{
  "type": "req",
  "id": "disc_1",
  "method": "disconnect"
}
```

## Idempotency

For methods with side effects, the gateway caches results by request ID for 60 seconds. Sending the same ID will return the cached result:

- `chat.send`
- `trade.execute`
- `cron.add`
- `cron.remove`
- `sessions.create`
- `sessions.delete`

## Streaming

Chat responses are streamed via events:

```javascript
// 1. Send chat request
ws.send(JSON.stringify({
  type: 'req',
  id: 'chat_1',
  method: 'chat.send',
  params: {
    message: 'Hello K.I.T.!',
    stream: true
  }
}));

// 2. Receive start event
{ type: 'event', event: 'chat.start', payload: { sessionId: 'sess_1', requestId: 'req_1' } }

// 3. Receive chunk events
{ type: 'event', event: 'chat.chunk', payload: { sessionId: 'sess_1', requestId: 'req_1', chunk: 'Hello' } }
{ type: 'event', event: 'chat.chunk', payload: { sessionId: 'sess_1', requestId: 'req_1', chunk: '! How' } }
{ type: 'event', event: 'chat.chunk', payload: { sessionId: 'sess_1', requestId: 'req_1', chunk: ' can I help?' } }

// 4. Receive complete event
{ type: 'event', event: 'chat.complete', payload: { sessionId: 'sess_1', message: {...} } }

// 5. Receive response (also confirms completion)
{ type: 'res', id: 'chat_1', ok: true, payload: { sessionId: 'sess_1', messageId: 'msg_1', requestId: 'req_1' } }
```

## Tool Calls

When the agent uses tools, events are emitted:

```javascript
// Tool being called
{
  type: 'event',
  event: 'chat.tool_call',
  payload: {
    sessionId: 'sess_1',
    requestId: 'req_1',
    toolCall: {
      id: 'call_1',
      name: 'market_analyze',
      arguments: { symbol: 'BTC/USDT', timeframe: '1h' }
    }
  }
}

// Tool result
{
  type: 'event',
  event: 'chat.tool_result',
  payload: {
    sessionId: 'sess_1',
    toolCallId: 'call_1',
    result: { trend: 'bullish', rsi: 65, signal: 'buy' }
  }
}
```

## Rate Limiting

Default limits:

| Method | Limit |
|--------|-------|
| `chat.send` | 10/minute |
| `trade.execute` | 60/minute |
| `*` (other) | 100/minute |

Rate limit error:

```json
{
  "type": "res",
  "id": "req_1",
  "ok": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "details": {
      "retryAfter": 5000
    }
  }
}
```

## TypeScript Types

```typescript
interface ProtocolFrame {
  type: 'req' | 'res' | 'event';
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  event?: string;
  payload?: unknown;
  error?: ProtocolError;
  ok?: boolean;
  seq?: number;
  stateVersion?: number;
}

interface ProtocolError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

interface DeviceIdentity {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'server' | 'node';
  os?: string;
  version?: string;
}
```

## Client Libraries

### JavaScript/TypeScript

```typescript
import { KitClient } from 'kit-trading';

const client = new KitClient({
  url: 'ws://127.0.0.1:18799',
  token: 'your-token'
});

await client.connect();

// Chat with streaming
for await (const chunk of client.chat('Analyze BTC')) {
  process.stdout.write(chunk);
}

// Get portfolio
const portfolio = await client.portfolio.get();
```

### Python

```python
from kit import KitClient

client = KitClient(url="ws://127.0.0.1:18799")
await client.connect()

# Chat
async for chunk in client.chat("Analyze BTC"):
    print(chunk, end="")

# Get portfolio
portfolio = await client.portfolio.get()
```
