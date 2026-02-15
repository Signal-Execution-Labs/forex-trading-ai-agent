---
name: api-health-monitor
description: "Monitors exchange API connectivity and latency, alerts on degradation"
version: "1.0.0"
metadata:
  kit:
    emoji: "🏥"
    events: ["gateway:startup", "trade:executed"]
    priority: 90
---

# API Health Monitor Hook

Monitors exchange API connectivity and latency, alerting when APIs are degraded or offline.

## What It Does

- Checks API health on gateway startup for all configured exchanges
- Monitors latency before trade execution
- Alerts when APIs go offline or become degraded (high latency)
- Tracks uptime statistics per exchange

## Supported Exchanges

- Binance, Coinbase, Kraken, Bybit, OKX
- KuCoin, Gate.io, MEXC, HTX, Bitget

## Configuration

Configure in your kit.yaml:

```yaml
hooks:
  api-health-monitor:
    enabled: true
    config:
      latencyThresholdMs: 500
      alertOnDegradation: true
      exchanges: ["binance", "coinbase", "kraken"]
```

## Output

```
🏥 API Health Check
🟢 binance: 45ms
🟢 coinbase: 120ms
🟡 kraken: 650ms (degraded)
```
