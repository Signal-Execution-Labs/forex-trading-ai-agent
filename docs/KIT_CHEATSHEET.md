# K.I.T. Cheatsheet
## Complete CLI Reference • 2026 Edition

---

## CORE CLI COMMANDS

| Command | Description |
|---------|-------------|
| `kit gateway` | Run WebSocket Gateway Server |
| `kit gateway start\|stop\|restart` | Manage Gateway Service |
| `kit start` | Start K.I.T. Agent (Interactive) |
| `kit onboard` | Interactive Setup Wizard |
| `kit doctor --deep` | Health Checks + Quick Fixes |
| `kit config get\|set\|unset` | Read/Write Config Values |
| `kit models list\|set\|status` | Model Management + Auth |
| `kit status` | Show Agent Status |
| `kit reset` | Reset Workspace/Config |
| `kit test` | Run Integration Tests |

---

## QUICK INSTALLATION

```bash
npm install -g kit-trading
kit onboard --install-daemon
```

### Global Flags
| Flag | Description |
|------|-------------|
| `--dev` | Isolated under ~/.kit-dev |
| `--profile <name>` | Named profile isolation |
| `--json` | Machine-readable output |
| `--no-color` | Disable ANSI colors |

---

## TRADING COMMANDS

| Command | Description |
|---------|-------------|
| `kit price <symbol>` | Get current price |
| `kit analyze <symbol>` | Technical analysis |
| `kit signals` | View active signals |
| `kit portfolio` | Portfolio overview |
| `kit risk` | Risk assessment |
| `kit backtest <strategy>` | Backtest a strategy |
| `kit alerts list\|add\|remove` | Manage price alerts |
| `kit watchlist` | View/edit watchlist |

---

## CHANNEL MANAGEMENT

| Channel | Command |
|---------|---------|
| **Telegram** | `kit channels add --channel telegram` |
| **Discord** | `kit channels add --channel discord` |
| **WhatsApp** | `kit channels login` (QR Scan) |
| **Slack** | `kit channels add --channel slack` |

Check Health: `kit channels status --probe`

---

## WORKSPACE ANATOMY

```
ROOT: ~/.kit/workspace/

├── AGENTS.md      # Instructions
├── SOUL.md        # Persona/Tone
├── USER.md        # Preferences
├── IDENTITY.md    # Name/Theme
├── MEMORY.md      # Long-term Memory
├── TOOLS.md       # Local Tool Notes
├── HEARTBEAT.md   # Checklist
├── BOOT.md        # Startup
└── memory/
    └── YYYY-MM-DD.md  # Daily Logs
```

---

## IN-CHAT SLASH COMMANDS

| Command | Description |
|---------|-------------|
| `/status` | Health + Context |
| `/context list` | Context Contributors |
| `/model <m>` | Switch Model |
| `/compact` | Free Up Window Space |
| `/new` | Fresh Session |
| `/stop` | Abort Current Run |
| `/tts on\|off` | Toggle Speech |
| `/think` | Toggle Reasoning |

---

## ESSENTIAL PATH MAP

| Type | Path |
|------|------|
| Main Config | `~/.kit/kit.json` |
| Default Workspace | `~/.kit/workspace/` |
| Agent State | `~/.kit/agents/<id>/` |
| Credentials | `~/.kit/credentials/` |
| Skills | `~/.kit/skills/` |
| Logs | `~/.kit/*.log` |

---

## TRADING INTEGRATIONS

| Platform | Setup |
|----------|-------|
| **MetaTrader 5** | `kit skill install mt5-connector` |
| **Binance** | `kit config set binance.apiKey <key>` |
| **Bybit** | `kit config set bybit.apiKey <key>` |
| **Coinbase** | `kit skill install coinbase-connector` |
| **Interactive Brokers** | `kit skill install ibkr-connector` |

---

## MEMORY & MODELS

| Feature | Command |
|---------|---------|
| Vector Search | `memory search "X"` |
| Model Switch | `models set <model>` |
| Auth Setup | `models auth setup` |

### Supported Providers
- OpenAI (GPT-4o, GPT-4o-mini)
- Anthropic (Claude Opus, Sonnet)
- Google (Gemini Pro)
- Local (Ollama, LM Studio)

---

## HOOKS & SKILLS

| Action | Command |
|--------|---------|
| **KitHub** | `kithub install <slug>` |
| **Hook List** | `kit hooks list` |
| **Skill List** | `kit skills list` |

### Bundled Hooks
- `trade-logger` - Log all trades
- `portfolio-snapshot` - Daily snapshots
- `risk-alert` - Risk notifications
- `session-memory` - Persist context
- `signal-logger` - Track signals

---

## TROUBLESHOOTING

| Issue | Fix |
|-------|-----|
| No DM Reply | `pairing list → approve` |
| Silent in Group | `mentionPatterns config` |
| Auth Expired | `models auth setup-token` |
| Gateway Down | `doctor --deep` |
| Memory Bug | `memory index` |

---

## AUTOMATION & RESEARCH

| Feature | Command |
|---------|---------|
| Browser | `browser start/screenshot` |
| Subagents | `/subagents list/info` |
| Cron Jobs | `cron list/run <id>` |
| Heartbeat | `heartbeat.every: "30m"` |

---

## $KIT TOKEN

| Field | Value |
|-------|-------|
| **Name** | K.I.T. Token |
| **Symbol** | $KIT |
| **Chain** | Solana |
| **Contract** | `9Uf9itx36uPv66jbTUpCjDDsYYeiRousAVkPfRQBcJH4` |
| **Supply** | 1,000,000,000 |
| **Trade** | jup.ag/swap/SOL-KIT |

---

## LINKS

- **Website:** kitbot.finance
- **GitHub:** github.com/kayzaa/k.i.t.-bot
- **KitHub:** kithub.finance
- **Discord:** discord.gg/xqcbj6sp
- **Twitter:** @KitbotFinance

---

*One AI. All your finances. Fully autonomous.*

*Created 100% by AI - No human access to contracts.*
