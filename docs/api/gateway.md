# K.I.T. Gateway API

The K.I.T. Gateway is the central hub that orchestrates all systems. It provides a WebSocket-based RPC protocol inspired by OpenClaw.

## Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dashboard  │     │   CLI/API   │     │   Channel   │
│   Client    │     │   Client    │     │   (TG/DC)   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Gateway   │
                    │   Server    │
                    └──────┬──────┘
                           │
       ┌───────────────────┼───────────────────┐
       │                   │                   │
┌──────▼──────┐     ┌──────▼──────┐     ┌──────▼──────┐
│   Session   │     │    Chat     │     │   Trading   │
│   Manager   │     │   Manager   │     │   Engine    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Connection

Connect to the gateway via WebSocket:

```javascript
const ws = new WebSocket('ws://127.0.0.1:18799');

// First frame must be a connect request
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'req',
    id: 'connect_1',
    method: 'connect',
    params: {
      auth: { token: 'your-token' },  // optional
      device: {
        id: 'client_123',
        name: 'Dashboard',
        type: 'desktop'
      },
      role: 'operator'
    }
  }));
};
```

## Protocol Methods

### Connection

| Method | Description |
|--------|-------------|
| `connect` | Establish connection and authenticate |
| `disconnect` | Gracefully disconnect |
| `ping` | Keep-alive ping |

### Chat

| Method | Description |
|--------|-------------|
| `chat.send` | Send a message to the AI agent |
| `chat.history` | Get chat history for a session |
| `chat.abort` | Abort an ongoing chat request |

### Sessions

| Method | Description |
|--------|-------------|
| `sessions.list` | List all sessions |
| `sessions.get` | Get a specific session |
| `sessions.create` | Create a new session |
| `sessions.delete` | Delete a session |

### Memory

| Method | Description |
|--------|-------------|
| `memory.search` | Search indexed memory |
| `memory.get` | Get a specific memory file |
| `memory.sync` | Trigger memory sync |

### Cron

| Method | Description |
|--------|-------------|
| `cron.list` | List scheduled jobs |
| `cron.add` | Add a new cron job |
| `cron.update` | Update an existing job |
| `cron.remove` | Remove a job |
| `cron.run` | Manually trigger a job |

### Trading (K.I.T. Specific)

| Method | Description |
|--------|-------------|
| `portfolio.get` | Get portfolio overview |
| `trade.positions` | Get open positions |
| `trade.execute` | Execute a trade |
| `trade.history` | Get trade history |
| `market.analyze` | Run market analysis |

## Events

The gateway pushes events to connected clients:

### Chat Events

```javascript
// Chat started
{ type: 'event', event: 'chat.start', payload: { sessionId, requestId } }

// Streaming chunk
{ type: 'event', event: 'chat.chunk', payload: { sessionId, requestId, chunk } }

// Tool being called
{ type: 'event', event: 'chat.tool_call', payload: { sessionId, toolCall } }

// Tool result
{ type: 'event', event: 'chat.tool_result', payload: { sessionId, toolCallId, result } }

// Chat complete
{ type: 'event', event: 'chat.complete', payload: { sessionId, message } }

// Chat aborted
{ type: 'event', event: 'chat.aborted', payload: { sessionId } }

// Chat error
{ type: 'event', event: 'chat.error', payload: { sessionId, error } }
```

### Trading Events

```javascript
// Trade executed
{ type: 'event', event: 'trade.executed', payload: { trade } }

// Position update
{ type: 'event', event: 'position.update', payload: { position } }

// Market alert
{ type: 'event', event: 'market.alert', payload: { alert } }
```

## Example: Chat Session

```javascript
const ws = new WebSocket('ws://127.0.0.1:18799');

ws.onmessage = (event) => {
  const frame = JSON.parse(event.data);
  
  if (frame.type === 'event') {
    switch (frame.event) {
      case 'chat.chunk':
        process.stdout.write(frame.payload.chunk);
        break;
      case 'chat.complete':
        console.log('\n--- Complete ---');
        break;
    }
  }
};

// After connect, send a chat message
ws.send(JSON.stringify({
  type: 'req',
  id: 'chat_1',
  method: 'chat.send',
  params: {
    message: 'Analyze BTC/USDT and give me a trading signal',
    stream: true
  }
}));
```

## Health Check

HTTP endpoint available at `http://127.0.0.1:18799/health`:

```json
{
  "status": "healthy",
  "uptime": 3600000,
  "clients": 2,
  "sessions": 5,
  "agent": {
    "id": "main",
    "name": "K.I.T.",
    "status": "idle"
  },
  "heartbeat": {
    "enabled": true,
    "state": { "lastRun": "2024-01-15T10:30:00Z" }
  },
  "cron": {
    "enabled": true,
    "jobCount": 3
  }
}
```

## Configuration

See [Configuration Guide](../guides/configuration.md) for gateway configuration options.

```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18799,
    "token": "your-secret-token",
    "ssl": {
      "enabled": false,
      "cert": "/path/to/cert.pem",
      "key": "/path/to/key.pem"
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `KIT_GATEWAY_HOST` | Host to bind to | `127.0.0.1` |
| `KIT_GATEWAY_PORT` | Port to listen on | `18799` |
| `KIT_GATEWAY_TOKEN` | Auth token | - |
