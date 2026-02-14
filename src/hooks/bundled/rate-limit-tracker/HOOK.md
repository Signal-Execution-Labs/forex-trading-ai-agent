---
name: rate-limit-tracker
description: "Tracks API rate limits across exchanges and providers to prevent throttling"
version: "1.0.0"
metadata:
  kit:
    emoji: "🚦"
    events: ["signal:received"]
    priority: 50
---

# Rate Limit Tracker Hook

Monitors API rate limits across all connected exchanges and data providers to prevent throttling and ensure smooth operation.

## What It Does

- Tracks request counts per API endpoint
- Monitors rate limit headers from responses
- Warns before hitting rate limits (80% threshold)
- Logs rate limit violations
- Stores usage stats in `~/.kit/logs/rate-limits.json`

## Supported Headers

- `X-RateLimit-Limit` / `X-RateLimit-Remaining` (Standard)
- `X-MBX-USED-WEIGHT-*` (Binance)
- `RateLimit-*` (Coinbase)
- `X-Rate-Limit-*` (Kraken)

## Configuration

```yaml
rate-limit-tracker:
  warningThreshold: 0.8  # Warn at 80% usage
  cooldownMs: 60000      # Cooldown period after limit hit
```

## Events Emitted

- `rate-limit:warning` - When usage exceeds threshold
- `rate-limit:exceeded` - When limit is hit
- `rate-limit:reset` - When limits reset
