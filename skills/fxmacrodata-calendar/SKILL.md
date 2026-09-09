---
name: fxmacrodata-calendar
description: Fetch official FXMacroData macro release-calendar events for forex, stock-index, crypto, and rates trade planning. Use before opening trades around CPI, NFP, GDP, PCE, retail sales, PMI, and central-bank decisions.
---

# FXMacroData Calendar

Use this skill when a trading workflow needs scheduled macro event risk from
FXMacroData.

## Run

```bash
python skills/fxmacrodata-calendar/scripts/fetch_calendar.py --currency usd --min-tier 1
```

Set `FXMACRODATA_API_KEY` when calling authenticated FXMacroData endpoints. The
public USD release calendar can be fetched without a key.

## Output

The script prints JSON containing:

- `currency`
- `timezone`
- `data_quality`
- filtered `events`

Use top-tier events to pause new entries, lower leverage, widen monitoring
windows, or route the trade idea to a human review step.
