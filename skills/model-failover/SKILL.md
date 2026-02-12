# Skill #85: Model Failover Manager

Enterprise-grade AI provider rotation, cooldowns, and automatic failover for K.I.T.'s trading decisions.

## Why Model Failover?

AI providers have rate limits, outages, and billing issues. K.I.T. needs:
- **24/7 uptime** for autonomous trading
- **Automatic recovery** from provider failures
- **Cost optimization** across providers
- **Quality maintenance** when switching models

## Features

### Multi-Provider Support
| Provider | Models | Rate Limit Handling |
|----------|--------|---------------------|
| Anthropic | Claude Opus, Sonnet, Haiku | Per-minute, per-day |
| OpenAI | GPT-4o, GPT-4-turbo, o1 | TPM, RPM |
| Google | Gemini 2.0, 1.5 Pro | Per-minute |
| xAI | Grok 2 | Per-minute |
| DeepSeek | DeepSeek V3, R1 | Per-minute |
| Groq | Llama, Mixtral | Per-minute, free tier |
| OpenRouter | All models | Aggregated |
| Local | Ollama, vLLM | No limits |

### Failover Strategies

**1. Round-Robin Rotation**
Distributes load across providers:
```
Request 1 → Anthropic
Request 2 → OpenAI
Request 3 → Google
Request 4 → Anthropic (back to start)
```

**2. Priority Cascade**
Falls back through priority order:
```
Primary:   Claude Opus 4
Fallback1: GPT-4o
Fallback2: Gemini 2.0
Fallback3: Local Ollama (never fails)
```

**3. Cost-Optimized**
Routes to cheapest available provider:
```
Simple queries → Haiku ($0.25/1M)
Complex analysis → Sonnet ($3/1M)
Critical decisions → Opus ($15/1M)
```

**4. Latency-Optimized**
Tracks response times and routes to fastest:
```
Groq:     ~200ms (when available)
Anthropic: ~800ms
OpenAI:   ~1200ms
```

### Cooldown System

Exponential backoff for failures:
```
1st failure:  1 minute cooldown
2nd failure:  5 minutes
3rd failure:  25 minutes
4th+ failure: 1 hour (cap)
```

Separate handling for:
- **Rate limits**: Standard cooldown + retry
- **Auth errors**: Immediate failover, longer cooldown
- **Billing issues**: 5-hour initial backoff, doubles each time
- **Timeouts**: Shorter cooldown (30 seconds)

### Session Stickiness

K.I.T. pins a provider per trading session to:
- Keep provider caches warm
- Maintain conversation context
- Avoid inconsistent analysis

Re-pins only when:
- Session resets
- Current provider enters cooldown
- User manually switches

## Usage

```
kit model status              # Show provider health
kit model failover --test     # Simulate failover
kit model cooldown anthropic  # Manually cooldown a provider
kit model priority            # Show/edit fallback order
```

### Configuration

```json
{
  "ai": {
    "defaultProvider": "anthropic",
    "defaultModel": "claude-opus-4-5-20251101",
    "failover": {
      "enabled": true,
      "strategy": "priority",
      "fallbacks": [
        "anthropic/claude-opus-4-5-20251101",
        "openai/gpt-4o",
        "google/gemini-2.0-flash-exp",
        "ollama/llama3.3"
      ],
      "cooldowns": {
        "rateLimit": [60, 300, 1500, 3600],
        "authError": 3600,
        "billing": 18000,
        "timeout": 30
      },
      "sessionSticky": true,
      "costOptimize": false
    },
    "providers": {
      "anthropic": { "apiKey": "sk-ant-..." },
      "openai": { "apiKey": "sk-..." },
      "google": { "apiKey": "AIza..." }
    }
  }
}
```

## Health Dashboard

```
🧠 AI Provider Status

Provider      Model              Status    Latency   Cooldown
────────────────────────────────────────────────────────────
anthropic     claude-opus-4.5    ✅ OK     823ms     -
openai        gpt-4o             ✅ OK     1.2s      -
google        gemini-2.0         ⚠️ COOL   -         3m left
xai           grok-2             ✅ OK     650ms     -
deepseek      deepseek-v3        ❌ BILLING -        4h left
ollama        llama3.3           ✅ LOCAL  180ms     -

Session: Pinned to anthropic (42 requests)
Strategy: Priority cascade
```

## Trading Integration

### High-Stakes Decisions
For critical trading decisions, force best model:
```javascript
const decision = await kit.ai.complete({
  prompt: "Should I exit this BTC position?",
  model: "claude-opus-4-5-20251101",
  failover: false  // Don't downgrade for critical decisions
});
```

### Parallel Consensus
For important decisions, query multiple models:
```javascript
const opinions = await kit.ai.consensus({
  prompt: "Analyze NVDA earnings impact",
  models: ["claude-opus-4-5", "gpt-4o", "gemini-2.0"],
  threshold: 2/3  // Need 2 of 3 to agree
});
```

### Cost-Aware Routing
```javascript
// Route based on task complexity
const response = await kit.ai.smart({
  prompt: userMessage,
  complexity: 'auto',  // Analyzes prompt to choose model
  maxCost: 0.01       // Cap at $0.01 per request
});
```

## Metrics & Logging

Tracks per provider:
- Request count / success rate
- Average latency (p50, p95, p99)
- Token usage / cost
- Error types and frequencies
- Cooldown history

Daily report:
```
📊 AI Provider Report (24h)

Provider     Requests  Success  Latency  Cost
─────────────────────────────────────────────
anthropic    847       99.2%    812ms    $2.45
openai       156       98.7%    1.1s     $0.87
google       23        91.3%    650ms    $0.12
local        412       100%     180ms    $0.00

Total: 1438 requests, $3.44 cost
Failovers: 12 (0.8%)
```

## Related Skills

- **#11 LLM Agent Core**: Base AI integration
- **#52 AI Screener**: Uses AI for stock screening
- **#57 Economic Calendar**: AI interprets events
- **#83 Deal Manager**: AI-powered position management

## References

- OpenClaw Model Failover: `/concepts/model-failover.md`
- Auth Profile Rotation: `/concepts/oauth.md`
- Provider Docs: `/providers/`
