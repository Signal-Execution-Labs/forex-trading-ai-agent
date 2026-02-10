---
name: session-memory
description: "Saves session context to memory when /new is issued"
metadata:
  {
    "openclaw":
      {
        "emoji": "💾",
        "events": ["command:new"]
      }
  }
---

# Session Memory

Saves session context to your workspace memory directory when you issue `/new`.

## What It Does

1. Captures the pre-reset session conversation
2. Extracts the last 15 lines of conversation
3. Generates a descriptive filename
4. Saves session metadata to a dated memory file

## Output

Files are saved to: `~/.kit/workspace/memory/YYYY-MM-DD-slug.md`

Example output:

```markdown
# Session: 2026-02-10 14:30:00 UTC

- **Session Key**: agent:main:main
- **Session ID**: abc123def456
- **Source**: telegram

## Last 15 Messages

[Conversation excerpt...]
```

## Enable

```bash
kit hooks enable session-memory
```

## Configuration

No configuration needed. The hook automatically uses your workspace directory.
