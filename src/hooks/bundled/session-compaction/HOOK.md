# session-compaction

Auto-compacts session history when context window usage exceeds threshold.

## Events
- `session.message` - Checks context usage after each message

## Behavior
When a session's token count approaches the model's context window limit:
1. Summarizes older messages using AI
2. Replaces old messages with a compact summary
3. Keeps recent messages intact

## Configuration
Set in `config.yml`:
```yaml
compaction:
  enabled: true
  threshold: 0.75      # Trigger at 75% context usage
  keepRecent: 10       # Keep last 10 messages uncompacted
  memoryFlush: true    # Save to memory before compacting
```

## Output
- Logs compaction events with token counts
- Updates session history in-place
- Shows 🧹 indicator in /status after compaction
