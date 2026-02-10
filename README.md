# K.I.T. - Knight Industries Trading

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Your Autonomous AI Financial Agent** 🤖💰

K.I.T. is your **personal AI trading agent** - like having a professional trader working for you 24/7. Just tell it what you want, and it handles everything else.

```
"One man can make a difference... especially with proper position sizing."
   - K.I.T.
```

---

## 🚀 One-Line Installation

### Windows (CMD or PowerShell)

```cmd
cd C:\ && git clone https://github.com/kayzaa/k.i.t.-bot.git && cd k.i.t.-bot && npm install && npm run build && npm link
```

### Linux / macOS

```bash
cd ~ && git clone https://github.com/kayzaa/k.i.t.-bot.git && cd k.i.t.-bot && npm install && npm run build && npm link
```

**That's it!** Now you can use `kit` from anywhere:

```cmd
kit --help
kit start
kit dashboard
```

---

## 🎯 Two Ways to Use K.I.T.

### 1️⃣ As Your Personal AI Trader (No Coding!)

Just install, connect, and chat. K.I.T. does the rest.

```bash
kit start                    # Start K.I.T.
kit connect binance          # Connect exchange
kit connect telegram         # Connect Telegram
# Done! Chat with K.I.T. via Telegram
```

**K.I.T. can:**
- 📊 Trade autonomously based on your goals
- 💬 Understand natural language ("Buy BTC when RSI below 30")
- 📡 Copy signals from Telegram channels automatically
- 🔔 Alert you about important market events
- 📈 Analyze any market on request
- 🛡️ Manage risk automatically

### 2️⃣ As a Framework for Developers

Build your own trading bots, apps, and services.

```typescript
import { createBot } from 'kit';
const bot = createBot({ exchange: 'binance', strategy: 'rsi' });
bot.start();
```

👉 See [Developer SDK](docs/developers/sdk.md)

---

## 🚀 Quick Start

### Install

```bash
# Clone repository
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot

# Install dependencies
npm install

# Build
npm run build

# Start
npm start
```

### Initialize

```bash
# Interactive setup wizard
kit init

# Or start with demo mode (no API keys needed!)
kit init --demo
```

### Start Trading

```bash
# Start the Gateway
kit gateway start

# Check your portfolio
kit portfolio

# Analyze a pair
kit analyze BTC/USDT

# Execute your first trade (demo mode)
kit trade buy BTC/USDT 100 --demo
```

**That's it!** 🎉 K.I.T. is running.

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🤖 **Autonomous Trading** | Trades 24/7/365 across all markets |
| 📊 **Portfolio Management** | Unified view across all exchanges |
| 📈 **Technical Analysis** | RSI, MACD, Bollinger, MA, and more |
| 🛡️ **Risk Management** | Stop-loss, position sizing, daily limits |
| ⏮️ **Backtesting** | Test strategies with historical data |
| 🔔 **Alerts** | Price, indicator, and portfolio alerts |
| 📰 **News Integration** | Sentiment analysis and event tracking |
| 💬 **Multi-Channel** | Control via Telegram, Discord, CLI |
| 🛠️ **Developer SDK** | Build your own trading bots & apps |

---

## 💰 Supported Markets

| Market | Exchanges/Brokers | Status |
|--------|------------------|--------|
| 🪙 **Crypto** | Binance, Kraken, Coinbase, OKX, Bybit | ✅ Ready |
| 💱 **Forex** | MetaTrader 4/5, RoboForex, IC Markets, OANDA, Pepperstone, XM | ✅ Ready |
| 📈 **Stocks** | Interactive Brokers, Alpaca | 🚧 Beta |
| 🏦 **DeFi** | Uniswap, Aave, Lido | 📋 Planned |

---

## 🏗️ Architecture

```
kit/
├── gateway/              # The Brain
│   ├── server.ts         # WebSocket Gateway
│   ├── autopilot.ts      # Autonomous Decision Engine
│   ├── scheduler.ts      # Task Automation
│   └── skill-loader.ts   # Plugin System
│
├── skills/               # Modular Capabilities
│   ├── exchange-connector/   # Exchange APIs
│   ├── portfolio-tracker/    # Holdings & P&L
│   ├── alert-system/         # Price Alerts
│   ├── market-analysis/      # Technical Analysis
│   ├── auto-trader/          # Strategy Execution
│   ├── metatrader/           # MT4/MT5 Integration
│   ├── signal-copier/        # Copy Trading
│   └── backtester/           # Historical Testing
│
├── workspace/            # Your Agent's Home
│   ├── SOUL.md           # K.I.T.'s Personality
│   ├── AGENTS.md         # Trading Instructions
│   └── TOOLS.md          # Your Configuration
│
└── cli/                  # Command Line Interface
```

---

## 🎯 Operating Modes

### 1. Manual Mode (Training Wheels)
Every trade requires your approval. K.I.T. suggests, you decide.

```bash
kit autopilot disable
```

### 2. Semi-Auto Mode (Co-Pilot)
Small trades execute automatically. Large or risky trades need approval.

```bash
kit autopilot enable --mode semi-auto
kit autopilot threshold 500  # Auto-approve trades under $500
```

### 3. Full-Auto Mode (Autopilot)
K.I.T. takes full control. You get daily reports. It handles the rest.

```bash
kit autopilot enable --mode full-auto
```

---

## 🔧 CLI Commands

### Gateway
```bash
kit gateway start       # Start the Gateway
kit gateway stop        # Stop the Gateway
kit gateway status      # Check status
```

### Portfolio
```bash
kit portfolio           # Portfolio summary
kit portfolio pnl       # P&L analysis
```

### Trading
```bash
kit trade buy <pair> <amount>    # Buy
kit trade sell <pair> <amount>   # Sell
kit trade positions              # Open positions
```

### Analysis
```bash
kit analyze <pair>               # Full analysis
kit market <pair>                # Price & volume
```

---

## 🛡️ Safety & Risk Management

### Built-in Protections

| Protection | Default | Description |
|------------|---------|-------------|
| Max Daily Loss | 5% | Stop trading after 5% daily loss |
| Max Drawdown | 15% | Emergency stop at 15% from peak |
| Max Position | 10% | No single position > 10% of portfolio |

### Kill Switch

```bash
kit trade kill  # Instantly close all positions
```

---

## 👨‍💻 Developer SDK

K.I.T. is not just a trading bot - it's a **framework**!

```typescript
import { createBot, RSIStrategy } from 'kit';

// Create your own bot in 10 lines
const bot = createBot({
  name: 'MyBot',
  exchange: 'binance',      // or: kraken, mt5, roboforex...
  pair: 'BTC/USDT',
  strategy: new RSIStrategy(),
  risk: { stopLoss: 0.02, takeProfit: 0.04 },
});

bot.start();
```

**What you can build:**
- 🤖 Trading Bots (Grid, DCA, Arbitrage, Signal Copier)
- 📱 Telegram/Discord Bots
- 🌐 Web Dashboards
- 📊 Portfolio Trackers
- 🔔 Alert Systems
- 📡 Signal Services

👉 **[Full SDK Documentation](docs/developers/sdk.md)**

---

## 📝 Examples

See the [examples/](examples/) folder:

- `basic-bot.ts` - Simple trading bot
- `signal-copier-example.ts` - Copy signals from Telegram
- `portfolio-tracker-example.ts` - Track portfolio across exchanges

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

```bash
# Fork & clone
git clone https://github.com/YOUR_USERNAME/k.i.t.-bot.git
cd k.i.t.-bot

# Install dependencies
npm install

# Run tests
npm test

# Development mode
npm run dev
```

---

## ⚠️ Disclaimer

K.I.T. is a **tool**, not financial advice. Trading involves risk.

- ⚠️ Always start with paper/demo trading
- ⚠️ Never risk more than you can afford to lose
- ⚠️ Past performance doesn't guarantee future results
- ⚠️ You are responsible for your own financial decisions

---

## 📄 License

[MIT License](LICENSE) - Build something amazing!

---

<p align="center">
  <b>K.I.T. - Because your wealth deserves an AI that never sleeps.</b> 🌙
</p>

<p align="center">
  <a href="https://github.com/kayzaa/k.i.t.-bot">GitHub</a>
</p>
