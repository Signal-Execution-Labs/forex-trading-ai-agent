---
name: command-logger
description: "Logs all command events to a centralized audit file"
metadata:
  {
    "openclaw":
      {
        "emoji": "📝",
        "events": ["command"]
      }
  }
---

# Command Logger

Logs all command events to a centralized audit file for troubleshooting and compliance.

## What It Does

1. Captures event details (command action, timestamp, session key, sender ID, source)
2. Appends to log file in JSONL format
3. Runs silently in the background

## Output

Logs are saved to: `~/.kit/logs/commands.log`

Example log entries:

```jsonl
{"timestamp":"2026-02-10T14:30:00.000Z","action":"new","sessionKey":"agent:main:main","senderId":"+1234567890","source":"telegram"}
{"timestamp":"2026-02-10T15:45:22.000Z","action":"stop","sessionKey":"agent:main:main","senderId":"user@example.com","source":"whatsapp"}
```

## View Logs

```bash
# View recent commands
tail -n 20 ~/.kit/logs/commands.log

# Pretty-print with jq
cat ~/.kit/logs/commands.log | jq .

# Filter by action
grep '"action":"new"' ~/.kit/logs/commands.log | jq .
```

## Enable

```bash
kit hooks enable command-logger
```
