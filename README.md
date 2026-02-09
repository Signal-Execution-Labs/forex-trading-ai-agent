# K.I.T. - Knight Industries Trading

[![npm version](https://img.shields.io/npm/v/@binaryfaster/kit.svg)](https://www.npmjs.com/package/@binaryfaster/kit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

> **Your Autonomous AI Financial Agent** 🤖💰

K.I.T. is an **AI Agent Framework** that takes full control of your financial life. It trades crypto, forex, stocks, ETFs, and DeFi - all on autopilot.

```
"One man can make a difference... especially with proper position sizing."
   - K.I.T.
```

<p align="center">
  <img src="docs/assets/kit-dashboard.png" alt="K.I.T. Dashboard" width="600">
</p>

## 🚀 Quick Start

### Install

```bash
# Install globally
npm install -g @binaryfaster/kit

# Verify installation
kit --version
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

## 📖 Table of Contents

- [Features](#-features)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Operating Modes](#-operating-modes)
- [Architecture](#-architecture)
- [CLI Commands](#-cli-commands)
- [API Reference](#-api-reference)
- [Examples](#-examples)
- [Safety & Risk Management](#-safety--risk-management)
- [Contributing](#-contributing)
- [License](#-license)

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

---

## 📦 Installation

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org))
- **npm** or **yarn**

### NPM (Recommended)

```bash
npm install -g @binaryfaster/kit
```

### Yarn

```bash
yarn global add @binaryfaster/kit
```

### From Source

```bash
git clone https://github.com/kayzaa/k.i.t.-bot.git
cd k.i.t.-bot
npm install
npm run build
npm link
```

### Docker

```bash
docker pull binaryfaster/kit:latest
docker run -d --name kit \
  -v ~/.kit:/root/.kit \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  binaryfaster/kit:latest
```

### Verify Installation

```bash
kit --version
kit doctor  # Check system requirements
```

---

## ⚙️ Configuration

### Interactive Setup

```bash
kit setup
```

This wizard guides you through:
1. AI Provider (Anthropic/OpenAI) API key
2. Exchange connections
3. Risk parameters
4. Notification channels

### Manual Configuration

Create `~/.kit/config.json`:

```json
{
  "ai": {
    "provider": "anthropic",
    "model": "claude-3-sonnet-20240229"
  },
  "gateway": {
    "port": 18800,
    "host": "127.0.0.1"
  },
  "risk": {
    "maxDailyLoss": 5,
    "maxDrawdown": 15,
    "maxPositionSize": 10
  }
}
```

### Environment Variables

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export KIT_GATEWAY_PORT="18800"
export KIT_GATEWAY_TOKEN="your-secret-token"
```

---

## 💡 Usage

### Start the Gateway

```bash
# Foreground
kit gateway start

# Background (daemon)
kit gateway start --daemon
```

### Portfolio Overview

```bash
kit portfolio
```

Output:
```
📊 Portfolio Snapshot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Value: $45,231.50 (+2.3%)

Assets:
  BTC     $33,750.00   74.6%  ↑ +3.2%
  ETH      $8,750.00   19.3%  ↑ +1.8%
  USDT     $2,731.50    6.0%
  
Positions:
  BTC/USDT Long  +$156 (+3.2%)
```

### Market Analysis

```bash
kit analyze BTC/USDT
```

Output:
```
🔍 BTC/USDT Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trend:      BULLISH 📈
RSI (14):   58 (Neutral)
MACD:       Bullish crossover
Support:    $65,000
Resistance: $70,000

Signal: BUY
Confidence: 72%
```

### Execute Trades

```bash
# Market buy
kit trade buy BTC/USDT 100

# Limit order
kit trade buy BTC/USDT 0.01 --type limit --price 65000

# With risk management
kit trade buy ETH/USDT 500 --sl 3200 --tp 4000
```

### Backtesting

```bash
kit backtest --strategy ma_cross --pair BTC/USDT --period 2025
```

Output:
```
📊 Backtest Results: ma_cross
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Period:        2025-01-01 to 2025-12-31
Total Return:  +28.5%
Buy & Hold:    +45.2%
Max Drawdown:  -12.3%
Sharpe Ratio:  1.85
Win Rate:      62%
Total Trades:  48
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

### 3. Full-Auto Mode (Autopilot) 🛫
K.I.T. takes full control. You get daily reports. It handles the rest.

```bash
kit autopilot enable --mode full-auto
```

---

## 🏗️ Architecture

```
kit/
├── gateway/              # The Brain
│   ├── server.ts         # WebSocket Gateway
│   ├── autopilot.ts      # 🤖 Autonomous Decision Engine
│   ├── scheduler.ts      # ⏰ Task Automation
│   ├── protocol.ts       # Message Protocol
│   ├── skill-loader.ts   # Plugin System
│   └── tool-registry.ts  # Agent Actions
│
├── skills/               # Modular Capabilities
│   ├── exchange-connector/   # 🔌 Exchange APIs
│   ├── portfolio-tracker/    # 💼 Holdings & P&L
│   ├── alert-system/         # 🔔 Price Alerts
│   ├── market-analysis/      # 📈 Technical Analysis
│   ├── auto-trader/          # 🤖 Strategy Execution
│   ├── backtester/           # ⏮️ Historical Testing
│   └── news-tracker/         # 📰 News & Sentiment
│
├── workspace/            # Your Agent's Home
│   ├── SOUL.md           # K.I.T.'s Personality
│   ├── AGENTS.md         # Trading Instructions
│   ├── TOOLS.md          # Your Configuration
│   └── HEARTBEAT.md      # Monitoring Tasks
│
└── cli/                  # Command Line Interface
    └── kit.ts
```

---

## 💰 Supported Markets

| Market | Exchanges/Brokers | Status |
|--------|------------------|--------|
| 🪙 **Crypto** | Binance, Kraken, Coinbase, OKX, Bybit | ✅ Ready |
| 💱 **Forex** | MetaTrader 4/5, **RoboForex**, OANDA, IC Markets | ✅ Ready |
| 📈 **Stocks** | Interactive Brokers, Alpaca | 🚧 Beta |
| 📊 **ETFs** | Same as Stocks | 🚧 Beta |
| 🏦 **DeFi** | Uniswap, Aave, Lido | 📋 Planned |

---

## 🔧 CLI Commands

### Gateway
```bash
kit gateway start       # Start the Gateway
kit gateway stop        # Stop the Gateway
kit gateway status      # Check status
kit gateway logs        # View logs
```

### Portfolio
```bash
kit portfolio           # Portfolio summary
kit portfolio --detailed # Full breakdown
kit portfolio pnl       # P&L analysis
kit portfolio history   # Historical performance
```

### Trading
```bash
kit trade buy <pair> <amount>    # Buy
kit trade sell <pair> <amount>   # Sell
kit trade positions              # Open positions
kit trade history                # Trade history
kit trade cancel <order-id>      # Cancel order
```

### Analysis
```bash
kit analyze <pair>               # Full analysis
kit analyze <pair> --tf 1h       # Specific timeframe
kit market <pair>                # Price & volume
```

### Autopilot
```bash
kit autopilot status             # Check autopilot
kit autopilot enable             # Enable autopilot
kit autopilot disable            # Disable autopilot
kit autopilot decisions          # Pending decisions
kit autopilot approve <id>       # Approve decision
kit autopilot reject <id>        # Reject decision
```

### Alerts
```bash
kit alert list                   # List alerts
kit alert price BTC above 70000  # Price alert
kit alert rsi BTC below 30       # Indicator alert
kit alert delete <id>            # Delete alert
```

### Backtest
```bash
kit backtest --strategy <name> --pair <pair>
kit backtest list                # Available strategies
kit backtest report <id>         # View report
```

---

## 📚 API Reference

K.I.T. exposes a WebSocket API on port 18800.

### Connect

```javascript
const ws = new WebSocket('ws://127.0.0.1:18800');

ws.send(JSON.stringify({
  type: 'req',
  id: '1',
  method: 'connect',
  params: {
    client: { id: 'my-bot', version: '1.0.0' },
    auth: { token: 'your-token' }
  }
}));
```

### Execute Trade

```javascript
ws.send(JSON.stringify({
  type: 'req',
  id: '2',
  method: 'trade.execute',
  params: {
    action: 'buy',
    pair: 'BTC/USDT',
    amount: 100,
    type: 'market'
  }
}));
```

### Get Portfolio

```javascript
ws.send(JSON.stringify({
  type: 'req',
  id: '3',
  method: 'portfolio.snapshot',
  params: { action: 'snapshot' }
}));
```

📖 **Full API documentation:** [docs/api/gateway.md](docs/api/gateway.md)

---

## 📝 Examples

### Basic Bot

```typescript
import { KitClient } from '@binaryfaster/kit';

const client = new KitClient({ url: 'ws://127.0.0.1:18800' });
await client.connect();

// Get portfolio
const portfolio = await client.portfolio();
console.log('Portfolio:', portfolio.totalValueUsd);

// Execute trade
const order = await client.trade({
  action: 'buy',
  pair: 'BTC/USDT',
  amount: 100,
  type: 'market'
});
console.log('Order:', order.orderId);
```

### Signal Copier

```typescript
// Copy signals from webhook to K.I.T.
app.post('/signal', async (req, res) => {
  const signal = parseSignal(req.body);
  const order = await client.trade({
    action: signal.action,
    pair: signal.pair,
    amount: calculatePositionSize(signal),
    type: 'market',
    stopLoss: signal.sl,
    takeProfit: signal.tp
  });
  res.json({ success: true, orderId: order.orderId });
});
```

📁 **More examples:** [examples/](examples/)

---

## 🛡️ Safety & Risk Management

### Built-in Protections

| Protection | Default | Description |
|------------|---------|-------------|
| Max Daily Loss | 5% | Stop trading after 5% daily loss |
| Max Drawdown | 15% | Emergency stop at 15% from peak |
| Max Position | 10% | No single position > 10% of portfolio |
| Approval Mode | Manual | All trades need approval initially |

### Kill Switch

```bash
kit trade kill  # Instantly close all positions
```

### Risk Configuration

```json
{
  "risk": {
    "maxDailyLoss": 5,
    "maxDrawdown": 15,
    "maxPositionSize": 10,
    "maxLeverage": 5,
    "cooldownAfterLoss": 3600
  }
}
```

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
  <a href="https://github.com/kayzaa/k.i.t.-bot">GitHub</a> •
  <a href="https://binaryfaster.com/kit">Website</a> •
  <a href="https://discord.gg/binaryfaster">Discord</a> •
  <a href="https://twitter.com/binaryfaster">Twitter</a>
</p>
