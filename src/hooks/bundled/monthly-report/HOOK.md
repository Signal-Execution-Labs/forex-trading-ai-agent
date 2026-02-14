---
name: monthly-report
description: "Generates comprehensive monthly trading performance report at month end"
metadata:
  openclaw:
    emoji: "📅"
    events: ["schedule:monthly"]
    requires:
      config: ["workspace.dir"]
---

# Monthly Report Hook

Generates a comprehensive monthly performance report including:
- Month-to-date P&L and comparison with previous months
- Detailed trading statistics
- Monthly trends and patterns
- Strategy effectiveness analysis
- Risk metrics and portfolio health

## Output

Reports are saved to `<workspace>/reports/monthly-YYYY-MM.md` and optionally sent as a notification.

## Configuration

```json
{
  "hooks": {
    "internal": {
      "entries": {
        "monthly-report": {
          "enabled": true,
          "dayOfMonth": 1,
          "hour": 8,
          "notify": true
        }
      }
    }
  }
}
```
