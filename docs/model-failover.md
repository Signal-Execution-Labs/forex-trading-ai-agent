---
summary: "How K.I.T. rotates auth profiles and falls back across models"
title: "Model Failover"
---

# Model Failover

K.I.T. handles API failures in two stages:

1. **Auth profile rotation** within the current provider
2. **Model fallback** to the next model in your fallback list

## Configuration

In `config.yml`:

```yaml
ai:
  model: gpt-4o              # Primary model
  fallbacks:                 # Fallback chain
    - anthropic/claude-3.5-sonnet
    - google/gemini-1.5-pro
  
failover:
  enabled: true
  maxRetries: 3
  cooldownMs: 60000          # 1 minute cooldown for failing profiles
  rotateOnRateLimit: true    # Try another profile on 429
  rotateOnTimeout: true      # Retry on timeout
  sessionSticky: true        # Pin profile per session
```

## Auth Profiles

K.I.T. supports multiple API keys per provider:

```yaml
auth:
  profiles:
    - id: openai:primary
      provider: openai
      type: api_key
    - id: openai:backup
      provider: openai
      type: api_key
```

Credentials are stored in `~/.kit/auth-profiles.json`.

## Profile Rotation Order

When a provider has multiple profiles:

1. **Explicit config**: `auth.order[provider]` if set
2. **OAuth before API keys**: OAuth profiles are tried first
3. **Round-robin**: Oldest used first

### Session Stickiness

K.I.T. **pins the chosen auth profile per session** to keep provider caches warm. The pinned profile is reused until:

- The session is reset (`/new` or `/reset`)
- A compaction completes
- The profile is in cooldown

## Cooldowns

When a profile fails (rate limit, auth error):

- **Rate limit (429)**: Profile enters cooldown, next profile tried
- **Auth error (401/403)**: Profile disabled until manual re-enable
- **Timeout**: Retry same profile, then rotate

Cooldown duration: configurable via `failover.cooldownMs`

## Fallback Chain

If all profiles for the current model fail:

1. K.I.T. moves to the next model in `fallbacks`
2. Resets profile rotation for the new model
3. If all fallbacks exhausted, returns error

## Monitoring

Check failover status:

```bash
kit status --verbose
```

Shows:
- Current model and profile
- Profiles in cooldown
- Fallback index

## Best Practices

1. **Multiple profiles**: Add 2-3 API keys per provider for resilience
2. **Diverse fallbacks**: Mix providers (OpenAI + Anthropic + Google)
3. **Monitor usage**: Watch for profiles hitting rate limits
4. **Budget alerts**: Set spending limits per profile
