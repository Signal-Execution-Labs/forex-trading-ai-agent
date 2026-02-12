---
name: session-memory
description: "Saves session context to memory when trading session ends"
version: "1.0.0"
metadata:
  kit:
    emoji: "💾"
    events: ["session:end"]
    priority: 80
---

# Session Memory Hook

Automatically saves session context and summaries to your workspace memory when a trading session ends.

## What It Does

- Captures session end events
- Writes session summary to dated memory files
- Stores in `~/.kit/workspace/memory/YYYY-MM-DD.md`

## Use Cases

- Track daily trading activity
- Review past sessions
- Build trading history
