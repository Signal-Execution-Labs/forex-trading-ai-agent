---
name: boot-md
description: "Runs BOOT.md on gateway startup"
metadata:
  openclaw:
    emoji: "🚀"
    events: ["gateway:startup"]
---

# Boot MD Hook

Executes the instructions in `BOOT.md` when the K.I.T. gateway starts.

## What It Does

1. Reads `BOOT.md` from your workspace
2. Runs the instructions through the AI agent
3. Sends any outbound messages via configured channels

## Requirements

- `BOOT.md` must exist in the workspace
- Internal hooks must be enabled

## Example BOOT.md

```markdown
# Startup Tasks

- Check market status
- Review overnight alerts
- Send good morning message to Telegram
```

## Enable

In config:
```json
{
  "hooks": {
    "enabled": true,
    "entries": {
      "boot-md": { "enabled": true }
    }
  }
}
```
