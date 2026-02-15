# Drawdown Alert Hook

Monitors your portfolio equity and alerts you when drawdowns reach dangerous levels.

## Events

- `equity_update` - When portfolio equity changes
- `trade_closed` - After a trade closes (uses portfolio.equity)

## Alert Levels

| Level | Threshold | Action |
|-------|-----------|--------|
| ⚠️ Warning | 5% | Review positions |
| ❌ Critical | 10% | Close risky positions |
| 🚨 Emergency | 15% | Consider pausing all trading |

## Features

- Tracks peak equity (high water mark)
- Calculates real-time drawdown percentage
- Tracks maximum drawdown for the session
- Alert cooldown to prevent spam (30 min default)
- Recovery notifications when drawdown improves
- Suggests `kit trading pause` on emergency

## State File

State is stored in `~/.kit/drawdown-state.json`

```json
{
  "peakEquity": 10000,
  "currentEquity": 9200,
  "currentDrawdown": 8.0,
  "maxDrawdown": 12.5,
  "lastAlert": "critical",
  "emergencyTriggered": false
}
```

## Example Alerts

```
[drawdown-alert] ⚠️ WARNING: 5.00% drawdown. Current equity: $9500.00, Peak: $10000.00
[drawdown-alert] ❌ CRITICAL: 10.00% drawdown! Lost $1000.00 from peak. Review open positions.
[drawdown-alert] 🚨 EMERGENCY: 15.00% drawdown! Lost $1500.00 from peak of $10000.00. Consider pausing trading!
[drawdown-alert] 🛑 Consider running: kit trading pause
[drawdown-alert] ✅ Drawdown recovered to 3.50%
```

## Configuration

Edit the thresholds in the handler if needed:

```typescript
const THRESHOLDS = {
  warning: 5,      // Adjust warning level
  critical: 10,    // Adjust critical level
  emergency: 15,   // Adjust emergency level
};
```
