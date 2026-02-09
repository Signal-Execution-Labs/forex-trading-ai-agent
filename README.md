# 🤖 K.I.T. - AI Trading Agent

> **Your Personal AI Trading Assistant** - Like OpenClaw, but built for the financial markets.

K.I.T. (Künstliche Intelligenz Trading) is an autonomous AI agent that communicates through your favorite messaging platforms (Telegram, Discord, Signal, WhatsApp) while executing intelligent trading strategies across multiple exchanges.

## ✨ What Makes K.I.T. Special

K.I.T. isn't just a trading bot - it's a **full AI agent** that:

- 💬 **Chats with you** via Telegram, Discord, Signal, WhatsApp
- 📊 **Analyzes markets** in real-time across multiple exchanges
- 🎯 **Executes trades** based on sophisticated strategies
- 📈 **Reports performance** and explains its decisions
- 🛡️ **Manages risk** autonomously with configurable limits
- 🧠 **Learns and adapts** to market conditions

Think of it as having a professional trader available 24/7 who speaks your language.

## 🚀 Features

### Communication Channels
- **Telegram** - Full bot integration with inline buttons
- **Discord** - Server bot with slash commands
- **Signal** - Secure messaging support
- **WhatsApp** - Business API integration
- **Web Dashboard** - Real-time monitoring UI

### Trading Capabilities
- **Multi-Exchange Support**
  - Crypto: Binance, Kraken, Coinbase, Bybit, OKX
  - Forex: OANDA, MetaTrader 4/5
  - Stocks: Alpaca, Interactive Brokers (coming soon)
  
- **Built-in Strategies**
  - Trend Following (SMA/EMA Crossover)
  - Mean Reversion
  - Momentum & Breakout
  - RSI, MACD, Bollinger Bands
  - Ichimoku Cloud
  - Custom Strategy API

- **Risk Management**
  - Position sizing
  - Stop-loss / Take-profit
  - Max drawdown limits
  - Portfolio balancing

### AI Features
- Natural language commands ("Buy $100 of BTC when it drops below 40k")
- Market analysis summaries
- Trade explanations
- Performance reports
- Proactive alerts

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot

# Install dependencies
npm install

# Configure your settings
cp .env.example .env
# Edit .env with your API keys

# Start K.I.T.
npm run start
```

## ⚙️ Configuration

### Messaging Channels

```yaml
# config.yaml
channels:
  telegram:
    enabled: true
    token: "YOUR_BOT_TOKEN"
    
  discord:
    enabled: true
    token: "YOUR_DISCORD_TOKEN"
    
  signal:
    enabled: false
    
  whatsapp:
    enabled: false
```

### Exchange APIs

```env
# .env
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret

KRAKEN_API_KEY=your_key
KRAKEN_API_SECRET=your_secret
```

## 💬 Usage Examples

Talk to K.I.T. naturally:

```
You: What's the current BTC price?
K.I.T.: BTC is at $42,150 (+2.3% 24h). RSI at 58, neutral territory.

You: Start monitoring ETH for a breakout above $2,500
K.I.T.: 👀 Watching ETH. I'll alert you if it breaks $2,500.

You: Buy $50 of SOL
K.I.T.: ✅ Bought 0.52 SOL at $96.15. Position opened.

You: How did we do today?
K.I.T.: 📊 Today's P&L: +$127.50 (+2.1%)
        Trades: 8 wins, 3 losses
        Best: ETH long +$45
        Worst: BTC short -$12
```

## 🏗️ Architecture

```
k.i.t.-bot/
├── src/
│   ├── core/           # Agent core (brain)
│   │   ├── agent.ts    # Main AI agent
│   │   ├── engine.ts   # Trading engine
│   │   └── memory.ts   # Conversation memory
│   │
│   ├── channels/       # Communication channels
│   │   ├── telegram.ts
│   │   ├── discord.ts
│   │   ├── signal.ts
│   │   └── whatsapp.ts
│   │
│   ├── exchanges/      # Exchange integrations
│   │   ├── binance.ts
│   │   ├── kraken.ts
│   │   └── ...
│   │
│   ├── strategies/     # Trading strategies
│   │   ├── trend.ts
│   │   ├── momentum.ts
│   │   └── ...
│   │
│   ├── skills/         # Trading skills (plugins)
│   │   ├── market-analysis/
│   │   ├── portfolio-manager/
│   │   ├── alert-system/
│   │   └── news-tracker/
│   │
│   ├── risk/           # Risk management
│   └── dashboard/      # Web UI
│
├── config/             # Configuration files
├── docs/               # Documentation
└── tests/              # Test suite
```

## 🔌 Skills (Plugins)

K.I.T. uses a skill-based architecture (like OpenClaw):

| Skill | Description |
|-------|-------------|
| 📊 **Market Analysis** | Technical analysis, chart patterns, indicators |
| 💼 **Portfolio Manager** | Track holdings, P&L, allocations |
| 🔔 **Alert System** | Price alerts, strategy triggers |
| 📰 **News Tracker** | Crypto/forex news with sentiment |
| 📈 **Backtester** | Test strategies on historical data |
| 🤖 **Auto-Trader** | Autonomous trading execution |

## 🛡️ Security

- API keys stored locally (never transmitted)
- Optional 2FA for trade confirmations
- Withdrawal whitelist support
- Rate limiting and anti-spam

## 📊 Dashboard

Access the web dashboard at `http://localhost:3000`:

- Real-time portfolio view
- Trade history
- Strategy performance
- Risk metrics
- Live charts

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](docs/CONTRIBUTING.md).

## ⚠️ Disclaimer

Trading involves risk. K.I.T. is experimental software. Only trade what you can afford to lose. Past performance does not guarantee future results.

## 📄 License

MIT License - See [LICENSE](LICENSE)

---

**Built with 🤖 by the K.I.T. Agent Team**

*Inspired by [OpenClaw](https://github.com/openclaw/openclaw)*
