# K.I.T. - Knight Industries Trading

<p align="center">
  <img src="https://img.shields.io/badge/🎬_POWERED_BY-TRADERLIFESTYLE_ON_YT-red?style=for-the-badge&labelColor=black" alt="Powered by TraderLifestyle"/>
</p>

<h3 align="center">
  ⭐ POWERED BY <a href="https://youtube.com/@TraderLifestyle">TRADERLIFESTYLE ON YOUTUBE</a> ⭐
</h3>

---

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

### Windows (CMD)

```cmd
cd C:\ && git clone https://github.com/kayzaa/k.i.t.-bot.git && cd k.i.t.-bot && npm install && npm run build && npm link && kit start
```

### Linux / macOS

```bash
cd ~ && git clone https://github.com/kayzaa/k.i.t.-bot.git && cd k.i.t.-bot && npm install && npm run build && sudo npm link && kit start
```

**That's it!** Dashboard opens automatically at `http://localhost:18799/`

After installation, use `kit` from anywhere:

```cmd
kit start       # Start gateway + dashboard
kit --help      # Show all commands
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
| 📜 **Pine Script Generator** | Create TradingView indicators & strategies |
| 👥 **Social Trading** | Copy signals from bots & top traders |
| 🐦 **Twitter Integration** | Auto-post signals & analysis to Twitter/X |

---

## 💰 Supported Markets

| Market | Exchanges/Brokers | Status |
|--------|------------------|--------|
| 🪙 **Crypto** | Binance, Kraken, Coinbase, OKX, Bybit | ✅ Ready |
| 💱 **Forex** | MetaTrader 4/5, RoboForex, IC Markets, OANDA, Pepperstone, XM | ✅ Ready |
| 📈 **Stocks** | Interactive Brokers, Alpaca | 🚧 Beta |
| 🏦 **DeFi** | Uniswap, Aave, Lido | 📋 Planned |

---

## 🆕 New Skills

### 📜 TradingView Script Generator

Generate Pine Script v5 code for TradingView from simple descriptions:

```bash
# Generate RSI indicator
kit pine indicator --type rsi --name "My RSI"

# Generate MA crossover strategy
kit pine strategy --name "MA Cross" --indicators "ema:9,ema:21" --entry "cross_above" --exit "cross_below"

# Generate from description
kit pine describe "Create a strategy that buys when RSI is below 30"
```

**Features:**
- Natural language → Pine Script conversion
- Indicator templates (RSI, MACD, Bollinger, EMA)
- Strategy templates with TP/SL
- Auto-generate K.I.T. webhook alerts

👉 See [TradingView Script Skill](skills/tradingview-script/SKILL.md)

---

### 👥 Social Trading

Copy trades from signal providers, Telegram bots, and top traders:

```bash
# Add a signal source
kit social add telegram @CryptoSignalsVIP

# List sources
kit social sources

# View performance
kit social stats
```

**Supported Sources:**
- 📱 Telegram channels & bots
- 💬 Discord servers
- 🐦 Twitter/X accounts
- 🔗 Custom webhooks
- 📊 Binance Copy Trading

**Features:**
- Universal signal parser (multiple formats)
- Risk-adjusted position sizing
- Duplicate detection
- Performance tracking per source

👉 See [Social Trading Skill](skills/social-trading/SKILL.md)

---

### 🐦 Twitter Posting

Automatically share signals and analysis on Twitter/X:

```bash
# Post a signal
kit twitter signal BTC/USDT LONG 45000 --tp 47000 --sl 44000

# Post analysis
kit twitter analysis ETH/USDT --timeframe 4H

# Post custom tweet
kit twitter post "Market update..." --image chart.png
```

**Auto-Post Features:**
- 📈 Trading signals with charts
- 📊 Technical analysis summaries
- 📅 Daily/weekly performance reports
- ⚠️ Market alerts

**Safety:**
- Rate limiting (max posts per hour/day)
- Content validation
- Automatic disclaimer inclusion

👉 See [Twitter Posting Skill](skills/twitter-posting/SKILL.md)

---

## 🛠️ 66 Professional Skills

K.I.T. comes packed with **66 trading skills** - your complete trading arsenal!

### 🤖 AI & Analysis (8)
| Skill | Description |
|-------|-------------|
| `ai-predictor` | ML price predictions (LSTM, XGBoost) |
| `ai-screener` | AI market screening |
| `sentiment-analyzer` | Social/news sentiment |
| `market-analysis` | 50+ technical indicators |
| `news-tracker` | Breaking news alerts |
| `quant-engine` | Factor models & alpha |
| `order-flow` | Market microstructure |
| `correlation-matrix` | Asset correlations |

### 📈 Trading (12)
| Skill | Description |
|-------|-------------|
| `auto-trader` | Autonomous trading |
| `smart-router` | TWAP/VWAP execution |
| `smart-order-router` | Best execution routing |
| `signal-copier` | Copy trading signals |
| `options-trader` | Options with Greeks |
| `binary-options` | Binary options analysis |
| `stock-trader` | Stock trading |
| `paper-trading` | Risk-free practice |
| `twap-bot` | Time-weighted execution |
| `session-timer` | Market sessions |
| `lot-size-calculator` | Position sizing |
| `pip-calculator` | Forex pip values |

### 🔄 Automation (10)
| Skill | Description |
|-------|-------------|
| `grid-bot` | Grid trading |
| `leveraged-grid` | Margin grid trading |
| `trailing-grid` | Dynamic trailing grids |
| `dca-bot` | Dollar cost averaging |
| `task-scheduler` | Schedule any task |
| `alert-system` | Price/indicator alerts |
| `multi-condition-alerts` | Complex alert logic |
| `signal-bot` | Generate & broadcast |
| `rebalancer` | Portfolio rebalancing |
| `portfolio-rebalancer` | Advanced rebalancing |

### ⚡ Arbitrage (5)
| Skill | Description |
|-------|-------------|
| `arbitrage-finder` | Cross-exchange arb |
| `arbitrage-hunter` | Aggressive hunting |
| `spot-futures-arb` | Cash & carry |
| `funding-rate-arb` | Perp funding capture |
| `liquidity-monitor` | Depth tracking |

### 🌐 DeFi (5)
| Skill | Description |
|-------|-------------|
| `defi-connector` | Protocol integration |
| `defi-dashboard` | DeFi portfolio |
| `defi-yield` | Yield farming optimizer |
| `debank-aggregator` | DeBank data |
| `wallet-connector` | Multi-wallet |

### 📡 Social (6)
| Skill | Description |
|-------|-------------|
| `social-trading` | Social copy trading |
| `copy-trader` | Copy specific traders |
| `whale-tracker` | Large wallet tracking |
| `twitter-posting` | Auto-post signals |
| `social-feed` | Trading feed |
| `kitbot-forum` | Community integration |

### 🛡️ Risk & Tax (6)
| Skill | Description |
|-------|-------------|
| `tax-calculator` | FIFO/LIFO tax calc |
| `tax-tracker` | Trade tax tracking |
| `risk-calculator` | Position risk |
| `risk-ai` | AI risk analysis |
| `compliance` | Regulatory checks |
| `prop-firm-manager` | Funded accounts |

### 💰 Portfolio (8)
| Skill | Description |
|-------|-------------|
| `portfolio-tracker` | Multi-exchange view |
| `performance-report` | Trading metrics |
| `trade-journal` | Trading diary |
| `backtester` | Strategy testing |
| `dividend-manager` | Dividend tracking |
| `multi-asset` | Multi-asset portfolio |
| `economic-calendar` | Economic events |
| `payment-processor` | Crypto payments |

### 🔗 Connectors (6)
| Skill | Description |
|-------|-------------|
| `exchange-connector` | Universal exchange API |
| `metatrader` | MT4/MT5 integration |
| `etoro-connector` | eToro integration |
| `tradingview-script` | Pine Script generator |
| `tradingview-webhook` | Alert receiver |
| `tradingview-realtime` | Real-time data |

👉 **[Full Skills Documentation](docs/SKILLS.md)**

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
│   ├── backtester/           # Historical Testing
│   ├── tradingview-script/   # Pine Script Generator 🆕
│   ├── social-trading/       # Social Copy Trading 🆕
│   └── twitter-posting/      # Twitter Integration 🆕
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
- `tradingview-script-example.ts` - Generate Pine Script indicators & strategies 🆕
- `social-trading-example.ts` - Copy trades from bots & signal providers 🆕
- `twitter-posting-example.ts` - Auto-post signals & analysis to Twitter 🆕

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

---

<h2 align="center">
  🎬 POWERED BY <a href="https://youtube.com/@TraderLifestyle">TRADERLIFESTYLE ON YOUTUBE</a> 🎬
</h2>

<p align="center">
  <a href="https://youtube.com/@TraderLifestyle">
    <img src="https://img.shields.io/badge/YouTube-TraderLifestyle-red?style=for-the-badge&logo=youtube" alt="TraderLifestyle YouTube"/>
  </a>
</p>

---

<p align="center">
  <a href="https://github.com/kayzaa/k.i.t.-bot">GitHub</a> •
  <a href="QUICKSTART.md">Quick Start</a> •
  <a href="CHANGELOG.md">Changelog</a> •
  <a href="https://youtube.com/@TraderLifestyle">YouTube</a>
</p>
