---
name: performance-benchmark
description: "Tracks execution times and performance metrics for K.I.T. operations"
version: "1.0.0"
metadata:
  kit:
    emoji: "⏱️"
    events: ["trade:executed", "trade:closed"]
    priority: 10
---

# Performance Benchmark Hook

Monitors execution times and performance metrics across all K.I.T. operations for optimization insights.

## What It Does

- Tracks execution time for all operations
- Calculates average, min, max, p95, p99 latencies
- Identifies slow operations (> 1s)
- Generates performance reports
- Stores metrics in `~/.kit/logs/performance.json`

## Tracked Operations

- Trade execution latency
- Signal generation time
- Analysis computation time
- API request/response cycles
- Strategy evaluation time

## Configuration

```yaml
performance-benchmark:
  slowThresholdMs: 1000  # Log operations slower than this
  sampleRate: 1.0        # Sample rate (1.0 = all, 0.1 = 10%)
```

## Metrics Available

```json
{
  "operation": "trade:execute",
  "count": 150,
  "avgMs": 45.2,
  "minMs": 12,
  "maxMs": 890,
  "p95Ms": 120,
  "p99Ms": 450
}
```
