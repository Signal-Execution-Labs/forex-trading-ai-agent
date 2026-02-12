---
name: command-logger
description: "Logs all command events for auditing"
metadata:
  openclaw:
    emoji: "📝"
    events: ["command"]
---

# Command Logger

Logs all commands issued to K.I.T. for auditing and troubleshooting.

## What It Does

- Captures all command events (reset, new, stop, etc.)
- Logs to `~/.kit/logs/commands.log` in JSONL format
- Includes timestamp, action, session key, and source

## Output

Each command is logged as a JSON line:

```jsonl
{"timestamp":"2026-02-12T18:00:00.000Z","action":"new","sessionKey":"kit:main","source":"telegram"}
```

## View Logs

```bash
# View recent commands
tail -n 20 ~/.kit/logs/commands.log

# Pretty-print with jq
cat ~/.kit/logs/commands.log | jq .
```
