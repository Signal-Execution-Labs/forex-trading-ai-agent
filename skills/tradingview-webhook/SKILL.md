# TradingView Webhook Receiver

Receive TradingView alerts via webhook and execute trades automatically.

## Features

- HTTP webhook server (configurable port)
- Parse JSON and text alert formats
- Support TradingView placeholders ({{strategy.order.*}})
- Multi-strategy routing
- Trade execution via exchange connectors
- Alert logging and history

## Setup

### 1. Start the Webhook Server

```bash
# Start webhook server on port 8080 (default)
python webhook_server.py

# Or specify custom port
python webhook_server.py --port 3333
```

### 2. Configure TradingView Alert

In TradingView:
1. Create an alert on your indicator/strategy
2. Set webhook URL: `http://your-server:8080/webhook`
3. Alert message format (JSON recommended):

```json
{
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "price": {{close}},
  "quantity": {{strategy.order.contracts}},
  "strategy": "my-strategy-name",
  "secret": "your-secret-key"
}
```

### 3. Text Format (Alternative)

```
BUY BTCUSDT @ 45000 qty=0.1 tp=47000 sl=44000
```

## Alert Message Formats

### JSON Format (Recommended)

```json
{
  "action": "buy|sell|close",
  "symbol": "BTCUSDT",
  "price": 45000,
  "quantity": 0.1,
  "take_profit": 47000,
  "stop_loss": 44000,
  "strategy": "strategy-name",
  "secret": "your-webhook-secret"
}
```

### Pine Script Strategy Placeholders

| Placeholder | Description |
|-------------|-------------|
| `{{strategy.order.action}}` | buy, sell |
| `{{strategy.order.contracts}}` | Position size |
| `{{strategy.order.price}}` | Order price |
| `{{strategy.order.id}}` | Order ID |
| `{{strategy.order.alert_message}}` | Custom message |
| `{{ticker}}` | Symbol |
| `{{close}}` | Close price |
| `{{time}}` | Alert time |

## Configuration

Edit `config.yaml`:

```yaml
webhook:
  port: 8080
  secret: "your-secret-key"  # Optional authentication
  
strategies:
  my-ma-cross:
    exchange: binance
    default_quantity: 0.01
    use_market_orders: true
    
  my-rsi-strategy:
    exchange: bybit
    default_quantity: 100
    use_market_orders: false

logging:
  level: INFO
  file: webhook_alerts.log
```

## Security

- Use HTTPS in production (nginx reverse proxy)
- Set a webhook secret and validate it
- Whitelist TradingView IP ranges (optional)
- Rate limit incoming requests

## Example Alerts

### Simple Buy Alert
```json
{"action": "buy", "symbol": "BTCUSDT", "quantity": 0.01}
```

### Full Strategy Alert
```json
{
  "action": "{{strategy.order.action}}",
  "symbol": "{{ticker}}",
  "price": {{strategy.order.price}},
  "quantity": {{strategy.order.contracts}},
  "take_profit": {{plot_0}},
  "stop_loss": {{plot_1}},
  "strategy": "golden-cross",
  "comment": "{{strategy.order.comment}}",
  "secret": "abc123"
}
```

### Close Position
```json
{"action": "close", "symbol": "BTCUSDT", "strategy": "my-strategy"}
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook` | POST | Receive TradingView alerts |
| `/status` | GET | Server status |
| `/history` | GET | Recent alerts |
| `/strategies` | GET | List configured strategies |

## Troubleshooting

### Alert Not Received
1. Check server is running: `curl http://localhost:8080/status`
2. Verify firewall allows incoming connections
3. Check TradingView webhook URL is correct
4. Review logs: `tail -f webhook_alerts.log`

### Trade Not Executed
1. Check exchange API keys are configured
2. Verify symbol format matches exchange
3. Check available balance
4. Review error in response

## Integration with K.I.T.

Alerts are forwarded to K.I.T. SignalManager for:
- Performance tracking
- Risk management
- Portfolio coordination
