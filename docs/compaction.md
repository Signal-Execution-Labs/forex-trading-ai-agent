---
summary: "Context window management and auto-compaction"
title: "Compaction"
---

# Context Window & Compaction

Every model has a **context window** (max tokens it can see). Long-running trading sessions accumulate messages and tool results; once the window is tight, K.I.T. **compacts** older history to stay within limits.

## What Compaction Is

Compaction **summarizes older conversation** into a compact summary entry and keeps recent messages intact. The summary is stored in the session history, so future requests use:

- The compaction summary
- Recent messages after the compaction point

## Configuration

In `config.yml`:

```yaml
compaction:
  enabled: true          # Enable auto-compaction
  threshold: 0.75        # Trigger at 75% context usage
  keepRecent: 10         # Keep last 10 messages uncompacted
  memoryFlush: true      # Save to memory before compacting
  summaryModel: null     # Use current model (or specify override)
```

## Auto-Compaction (Default On)

When a session nears or exceeds the model's context window, K.I.T. triggers auto-compaction and may retry the original request using the compacted context.

You'll see:
- `🧹 Auto-compaction complete` in logs
- `/status` showing `🧹 Compactions: <count>`

## Manual Compaction

Use the `/compact` command to force a compaction pass:

```
/compact Focus on trading decisions and open positions
```

## Context Windows by Model

| Model | Context Window |
|-------|----------------|
| GPT-4o | 128K |
| GPT-4o-mini | 128K |
| Claude 3.5 Sonnet | 200K |
| Claude Opus 4 | 200K |
| Gemini 1.5 Pro | 1M |

## Tips

- Use `/compact` when sessions feel stale or context is bloated
- Large tool outputs are already truncated
- If you need a fresh slate, `/new` or `/reset` starts a new session
- Trading context (positions, P&L) is always preserved
