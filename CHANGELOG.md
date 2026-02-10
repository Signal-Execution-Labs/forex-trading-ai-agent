# Changelog

All notable changes to K.I.T. (Knight Industries Trading) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-02-10

### Documentation
- Added QUICKSTART.md and CHANGELOG.md links to README
- Fixed npm package references (`kit-trading` instead of `@binaryfaster/kit`)
- Fixed GitHub repo URLs (`kayzaa/k.i.t.-bot`)
- Added missing documentation:
  - News Tracker skill documentation
  - Autopilot concept guide
  - Binance exchange setup
  - API Keys security guide
- Updated Node.js version requirement (18+, 22+ recommended)

---

## [2.0.0] - 2026-02-10

### Added
- **Complete Onboarding Wizard** - 16-step interactive setup
  - Provider/Model/API Key configuration
  - User profile creation (generates SOUL.md/USER.md)
  - Trading connections (MT5, BinaryFaster, Binance, MetaMask, Ledger, etc.)
  - Skills selection across all categories
  - Channel setup (Telegram, Discord, Slack)
- **TradingView Realtime Skill** - Live market data streaming
- **Welcome message** - Shows onboarding hint with trigger words (start/setup/onboard)
- **Stocks/ETFs and Swap/Liquidity** skill categories
- **Web, Automation, Communication, Advanced** capabilities in skills step
- **Auto-detect AI provider keys** - OpenAI, Anthropic, Google, Groq, xAI

### Changed
- **Onboarding overhaul** - Sequential platform/wallet setup flow
- Autonomy manager status summary formatting improved

### Fixed
- Windows SAPI TTS escaping
- Wizard continues after API key is set (checks active onboarding state first)

### Tests
- Onboarding flow test (all 16 steps pass)
- Discord and Slack channel verification tests
- Web tools test script
- Sandbox tests automated

## [1.0.0] - 2026-02-09

### Added
- **Core Gateway** - WebSocket-based trading gateway
- **Multi-Exchange Support** - Binance, Kraken, Coinbase, OKX, Bybit
- **MetaTrader Integration** - MT4/MT5 support for Forex trading
- **CLI** - `kit` command-line interface
- **Skills System**
  - Exchange Connector
  - Portfolio Tracker
  - Alert System
  - Market Analysis (RSI, MACD, Bollinger, etc.)
  - Auto-Trader
  - Signal Copier
  - Backtester
- **Operating Modes** - Manual, Semi-Auto, Full-Auto (Autopilot)
- **Risk Management** - Stop-loss, position sizing, daily limits
- **Multi-Channel Support** - Telegram, Discord, Slack
- **Developer SDK** - Build custom trading bots

### Security
- Secure API key storage
- Kill switch for emergency position closure
- Max drawdown protection

---

## How to Update

```bash
git pull
npm install
npm run build
kit gateway restart
```
