# 🤖 K.I.T. - AI Financial Agent Framework

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-0.1.0--alpha-blue.svg)](https://github.com/kayzaa/k.i.t.-bot/releases)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)](https://nodejs.org/)

> **Like OpenClaw, but for finance.** Your autonomous AI agent that takes over your entire financial life.

K.I.T. (Künstliche Intelligenz Trading) is not just a trading bot - it's a **complete AI agent framework** that autonomously manages your entire financial portfolio across all markets.

## 🎯 The Vision

**One AI. All your finances. Fully autonomous.**

K.I.T. doesn't just execute trades - it **becomes your personal financial manager**:

- 📊 **Analyzes** markets 24/7 across crypto, forex, stocks, ETFs, commodities
- 🧠 **Decides** when to buy, sell, hold, or rebalance
- ⚡ **Executes** trades automatically across all your connected exchanges
- 📱 **Reports** to you via Telegram, Discord, Signal, or WhatsApp
- 🛡️ **Protects** your portfolio with intelligent risk management
- 📈 **Grows** your wealth while you sleep

## ✨ What Makes K.I.T. Different

### It's a Framework, Not a Bot

Like [OpenClaw](https://github.com/openclaw/openclaw), K.I.T. gives you the **power to build your own financial AI**:

- 📝 **SOUL.md** - Define your agent's personality and risk tolerance
- 🛠️ **Skills** - Modular capabilities you can enable/disable
- 🔧 **Tools** - Trading primitives you control
- 💬 **Channels** - Talk to your agent wherever you are
- 🧠 **Memory** - Your agent remembers everything

### Full Autonomy Levels

| Level | Mode | Description |
|-------|------|-------------|
| 🟢 | **Manual** | K.I.T. suggests, you confirm |
| 🟡 | **Semi-Auto** | K.I.T. executes within limits, asks for big trades |
| 🔴 | **Full Auto** | K.I.T. manages everything autonomously |

## 💹 Supported Markets

| Market | Platforms | Status |
|--------|-----------|--------|
| 🪙 **Crypto** | Binance, Kraken, Coinbase, Bybit, OKX | ✅ |
| 💱 **Forex** | MetaTrader 4, MetaTrader 5, OANDA | ✅ |
| 📈 **Stocks** | Alpaca, Interactive Brokers | 🔄 Coming |
| 📊 **ETFs** | Via stock brokers | 🔄 Coming |
| 🥇 **Commodities** | Via MT4/MT5, futures brokers | 🔄 Coming |
| 🏦 **DeFi** | Uniswap, Aave, Compound, Curve | 🔄 Coming |

## 🔌 Trading Skills

K.I.T. uses a skill-based architecture. Enable what you need:

| Skill | Description |
|-------|-------------|
| 🔗 **exchange-connector** | Connect to any exchange or broker |
| 📊 **portfolio-tracker** | Track holdings, P&L, allocations |
| 🔔 **alert-system** | Price, volume, and indicator alerts |
| 📈 **market-analysis** | Technical analysis and chart patterns |
| 🤖 **auto-trader** | Autonomous strategy execution |
| 🧪 **backtester** | Test strategies on historical data |
| 📰 **news-tracker** | News aggregation and sentiment |
| 💰 **tax-tracker** | Tax reporting for all trades |
| 💵 **dividend-manager** | Track and reinvest dividends |
| ⚖️ **rebalancer** | Automatic portfolio rebalancing |
| 🏦 **defi-connector** | DeFi protocols (staking, lending, yield) |
| 📱 **metatrader** | MT4/MT5 Expert Advisor integration |

## 💬 Communication Channels

Talk to K.I.T. like you'd talk to a human:

- **Telegram** - Full bot with inline buttons
- **Discord** - Server bot with slash commands
- **Signal** - Secure, encrypted messaging
- **WhatsApp** - Business API integration
- **Web Dashboard** - Real-time monitoring

```
You: How's my portfolio doing?
K.I.T.: 📊 Portfolio: $45,230 (+3.2% today)
        Best performer: ETH +8.5%
        I rebalanced BTC allocation this morning.
        Want me to show the full breakdown?

You: Yeah, and set an alert if BTC drops below 40k
K.I.T.: 📋 Here's your breakdown...
        🔔 Alert set: BTC < $40,000
        I'll notify you immediately if it triggers.
```

## 🏗️ Architecture

```
k.i.t./
├── src/
│   ├── gateway/        # WebSocket daemon (like OpenClaw)
│   ├── channels/       # Telegram, Discord, Signal, WhatsApp
│   ├── tools/          # Trading tools (trade, market, portfolio)
│   └── core/           # Agent brain, memory, sessions
│
├── skills/             # Modular trading skills
│   ├── exchange-connector/
│   ├── portfolio-tracker/
│   ├── auto-trader/
│   ├── metatrader/
│   └── ...
│
├── templates/          # Workspace templates for users
│   ├── AGENTS.md       # Operating instructions
│   ├── SOUL.md         # Agent personality
│   ├── USER.md         # User preferences
│   ├── TOOLS.md        # Local tool notes
│   └── HEARTBEAT.md    # Periodic market checks
│
└── docs/               # Full documentation
```

## 🚀 Quick Start

```bash
# Install K.I.T.
npm install -g kit-trading

# Initialize your workspace
kit init

# Configure your first exchange
kit exchange add binance

# Start the gateway
kit gateway

# Talk to K.I.T. via Telegram
# ... or any other configured channel
```

## ⚙️ Configuration

### Workspace Files (You Control Everything)

**SOUL.md** - Define your agent's personality:
```markdown
# My Trading Agent

## Personality
- Conservative risk approach
- Focus on long-term growth
- Explain decisions clearly

## Risk Tolerance
- Max 5% per position
- Stop loss at 10%
- Never use leverage above 2x
```

**HEARTBEAT.md** - What K.I.T. checks automatically:
```markdown
# Every 30 Minutes
- Check portfolio balance
- Scan for price alerts
- Monitor open positions

# Daily
- Generate performance report
- Rebalance if needed
- Check news for holdings
```

## 🛡️ Security

- 🔐 API keys stored locally, never transmitted
- 🔑 Optional 2FA for trade confirmations
- 📋 Withdrawal address whitelist
- ⚠️ Configurable trade limits
- 🚫 Kill switch for emergencies

## 📊 Dashboard

Access the web dashboard at `http://localhost:3000`:

- Real-time portfolio overview
- P&L tracking and charts
- Trade history
- Strategy performance
- Risk metrics
- Live market data

## 🤝 The Team

K.I.T. is being developed by a team of AI agents, coordinated by humans who believe in autonomous financial freedom.

## ⚠️ Disclaimer

Trading involves significant risk. K.I.T. is experimental software. Only trade what you can afford to lose. Past performance does not guarantee future results. You are responsible for your own financial decisions.

## 📄 License

MIT License - See [LICENSE](LICENSE)

---

<div align="center">

**🤖 K.I.T. - Your AI Financial Agent**

*Built with love by the K.I.T. Agent Team*

*Inspired by [OpenClaw](https://github.com/openclaw/openclaw)*

[Documentation](docs/) · [Skills](skills/) · [Discord](#) · [Twitter](#)

</div>
