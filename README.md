# K.I.T. - Knight Industries Trading

> **Your Autonomous AI Financial Agent**

K.I.T. is an **AI Agent Framework** that takes full control of your financial life. It trades crypto, forex, stocks, ETFs, and DeFi - all on autopilot.

```
"One man can make a difference... especially with proper position sizing."
   - K.I.T.
```

## 🎯 The Vision

**K.I.T. is not a trading bot.** It's your personal AI financial manager that:

- 🤖 **Trades autonomously** across ALL markets
- 📊 **Manages your entire portfolio** 24/7/365
- 🛡️ **Protects your capital** with intelligent risk management
- 📈 **Grows your wealth** through diversified strategies
- 💼 **Handles taxes** and reporting automatically
- 🔄 **Rebalances** your portfolio to maintain target allocations
- 📰 **Reacts to news** and market conditions in real-time

## 🚀 Operating Modes

### 1. Manual Mode (Training Wheels)
Every trade requires your approval. K.I.T. suggests, you decide.

### 2. Semi-Auto Mode (Co-Pilot)
Small trades execute automatically. Large or risky trades need approval.

### 3. Full-Auto Mode (Autopilot) 🛫
K.I.T. takes full control. You get daily reports. It handles the rest.

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

## 💰 Supported Markets

| Market | Exchanges/Brokers | Status |
|--------|------------------|--------|
| 🪙 **Crypto** | Binance, Kraken, Coinbase, OKX, Bybit | ✅ Ready |
| 💱 **Forex** | MetaTrader 4/5, RoboForex, OANDA, IC Markets | ✅ Ready |
| 📈 **Stocks** | Interactive Brokers, Alpaca | 🚧 In Progress |
| 📊 **ETFs** | Same as Stocks | 🚧 In Progress |
| 🏦 **DeFi** | Uniswap, Aave, Lido | 📋 Planned |

## 🛡️ Safety Features

### Risk Management
- **Max Daily Loss**: Stop trading after X% loss
- **Max Drawdown**: Emergency stop at X% from peak
- **Position Limits**: No single position > X% of portfolio
- **Leverage Limits**: Never exceed X leverage

### Kill Switch
```bash
kit trade kill  # Instantly close all positions, stop all trading
```

### Approval System
- Every decision is logged with reasoning
- High-risk trades require manual approval
- Review pending decisions anytime

## 📅 Automated Tasks

K.I.T. runs these tasks automatically:

| Task | Frequency | Description |
|------|-----------|-------------|
| 📊 Daily Report | Daily 8 AM | Portfolio summary |
| 📊 Weekly Report | Monday 9 AM | Week performance review |
| 🔄 Rebalancing | Weekly | Maintain target allocations |
| 🔍 Market Scan | Hourly | Find opportunities |
| 📰 News Digest | Daily 7 AM | Market news analysis |

## 🚀 Quick Start

```bash
# Install K.I.T.
npm install -g @binaryfaster/kit

# Initialize workspace
kit init

# Configure exchanges (interactive)
kit setup

# Start in manual mode (safe!)
kit gateway start

# Check portfolio
kit portfolio

# Analyze an asset
kit analyze BTC/USDT

# When ready for autopilot...
kit autopilot enable --mode semi-auto
```

## 📊 Example Daily Report

```
🤖 K.I.T. Daily Report - Feb 9, 2026
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Portfolio Value: $45,231.50 (+2.3%)
   BTC:  $33,750 (74.6%) ↑ +3.2%
   ETH:  $8,750 (19.3%)  ↑ +1.8%
   Cash: $2,731 (6.0%)

📊 Today's Activity:
   • 2 trades executed
   • Win rate: 100%
   • Net P&L: +$523.40

🎯 Open Positions:
   • BTC/USDT Long: +$156 (+3.2%)
   • ETH/USDT Long: -$24 (-0.8%)

⚠️ Risk Status:
   • Daily P&L: +2.3% (limit: -5%)
   • Drawdown: 0% (limit: 15%)
   • Exposure: 45% (limit: 80%)

📰 Key News:
   • SEC Bitcoin ETF update (bullish)
   • Fed rate decision unchanged

🔮 Tomorrow's Plan:
   • Watch BTC resistance at $52K
   • Consider ETH add if support holds

"Your wealth is my mission. Sleep well."
   - K.I.T.
```

## 🔧 CLI Commands

```bash
# Gateway
kit gateway start       # Start the Gateway
kit gateway stop        # Stop the Gateway
kit gateway status      # Check status

# Portfolio
kit portfolio           # Portfolio summary
kit portfolio --detailed # Full breakdown
kit portfolio pnl       # P&L analysis

# Trading
kit trade buy BTC/USDT 0.01   # Buy
kit trade sell ETH/USDT 1.0   # Sell
kit trade positions           # Open positions
kit trade history             # Trade history

# Analysis
kit analyze BTC/USDT          # Full analysis
kit analyze BTC/USDT --tf 1h  # Specific timeframe

# Autopilot
kit autopilot status          # Check autopilot
kit autopilot enable          # Enable autopilot
kit autopilot disable         # Disable autopilot
kit autopilot decisions       # Pending decisions
kit autopilot approve <id>    # Approve decision

# Alerts
kit alert list                # List alerts
kit alert price BTC above 50000  # Create alert

# Backtest
kit backtest --strategy ma_cross --pair BTC/USDT
```

## 🧠 Decision Making

K.I.T. makes decisions based on:

1. **Technical Analysis** - RSI, MACD, Bollinger, MA crossovers
2. **Market Structure** - Support/Resistance, Trend direction
3. **Risk Assessment** - Position sizing, stop-loss placement
4. **Portfolio Context** - Current exposure, correlation
5. **News Sentiment** - Impact analysis
6. **Historical Performance** - Backtested strategies

Every decision includes:
- Reasoning (why this trade?)
- Confidence score (0-100%)
- Risk assessment (potential loss/gain)
- Approval status (auto/pending/approved)

## ⚠️ Disclaimer

K.I.T. is a **tool**, not financial advice. Trading involves risk.

- Always start with paper trading
- Never risk more than you can afford to lose
- Past performance doesn't guarantee future results
- You are responsible for your own financial decisions

## 📄 License

MIT License - Build something amazing!

---

*K.I.T. - Because your wealth deserves an AI that never sleeps.* 🌙
