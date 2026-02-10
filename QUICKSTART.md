# 🚀 K.I.T. Quickstart

Get K.I.T. running in under 5 minutes.

## One-Line Install

### Windows (PowerShell)

```powershell
cd C:\; git clone https://github.com/kayzaa/k.i.t.-bot.git; cd k.i.t.-bot; npm install; npm run build; npm link; kit start
```

### Linux / macOS

```bash
cd ~ && git clone https://github.com/kayzaa/k.i.t.-bot.git && cd k.i.t.-bot && npm install && npm run build && sudo npm link && kit start
```

**Done!** Dashboard opens at `http://localhost:18799/`

---

## Manual Install

```bash
# 1. Clone
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot

# 2. Install
npm install

# 3. Build
npm run build

# 4. Link globally (optional)
npm link   # Use 'sudo npm link' on Linux/macOS

# 5. Start
kit start
```

---

## First Commands

```bash
kit start              # Start gateway + dashboard
kit portfolio          # View portfolio
kit market BTC/USDT    # Get price
kit analyze BTC/USDT   # Technical analysis
kit trade buy BTC/USDT 100 --demo  # Demo trade
kit --help             # All commands
```

---

## Configure

1. Copy `.env.example` to `.env`
2. Add your API keys:
   - AI provider (Anthropic, OpenAI, etc.)
   - Exchange (Binance, Kraken, etc.)
   - Messaging (Telegram bot token)

```bash
cp .env.example .env
# Edit .env with your keys
```

---

## Connect Telegram

```bash
kit connect telegram
```

Then chat with your bot to control K.I.T.!

---

## Demo Mode

No API keys? No problem:

```bash
kit init --demo
kit start
```

Trade with fake money to learn the system.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `kit: command not found` | Run `npm link` again or use `npx kit` |
| Gateway won't start | Check if port 18799 is in use |
| Build fails | Ensure Node.js >= 18 installed |

---

## Learn More

- 📖 [Full Documentation](docs/index.md)
- 🔧 [Configuration Guide](docs/start/configuration.md)
- 💱 [Exchange Setup](docs/start/exchanges.md)
- 🤖 [Auto-Trading](docs/concepts/autopilot.md)

---

**Need help?** Open an issue on [GitHub](https://github.com/kayzaa/k.i.t.-bot/issues)
