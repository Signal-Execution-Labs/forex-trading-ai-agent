# K.I.T. Developer SDK

> Build your own trading bots, apps, and integrations with K.I.T.

K.I.T. is not just a trading bot - it's a **framework** for building your own trading applications.

## What You Can Build

| Project Type | Description | Example |
|--------------|-------------|---------|
| **Trading Bots** | Automated strategies | RSI Bot, Grid Bot, DCA Bot |
| **Signal Apps** | Signal provider or receiver | Telegram Signal Bot |
| **Portfolio Apps** | Tracking & analytics | Portfolio Dashboard |
| **Copy Trading** | Master/Follower systems | Social Trading Platform |
| **Alert Systems** | Price and indicator alerts | Discord Alert Bot |
| **Analytics Tools** | Backtesting, reporting | Strategy Analyzer |
| **Arbitrage Bots** | Cross-exchange arbitrage | CEX-DEX Arb Bot |
| **Market Makers** | Liquidity provision | MM Bot |

---

## Quick Start for Developers

### 1. Install K.I.T. as a Library

```bash
npm install kit-trading
# or
yarn add kit-trading
```

### 2. Create Your First Bot

```typescript
import { 
  KitAgent, 
  ExchangeManager, 
  Strategy,
  createBot 
} from 'kit-trading';

// Simple bot in 10 lines
const bot = createBot({
  name: 'MyFirstBot',
  exchange: 'binance',
  strategy: 'rsi-oversold',
  pair: 'BTC/USDT',
  risk: 0.02,
});

bot.start();
```

---

## SDK Modules

### Core Modules

```typescript
import {
  // Agent & Gateway
  KitAgent,           // AI Agent Core
  GatewayServer,      // WebSocket Server
  SessionManager,     // Chat Sessions
  
  // Exchanges
  ExchangeManager,    // Multi-Exchange Manager
  BinanceConnector,   // Binance API
  KrakenConnector,    // Kraken API
  MT5Connector,       // MetaTrader 5
  
  // Trading
  OrderManager,       // Order Execution
  PositionManager,    // Position Tracking
  RiskManager,        // Risk Controls
  
  // Analysis
  TechnicalAnalysis,  // TA Indicators
  Backtester,         // Strategy Testing
  
  // Notifications
  TelegramChannel,    // Telegram Bot
  DiscordChannel,     // Discord Bot
  WebhookChannel,     // Custom Webhooks
} from 'kit-trading';
```

---

## Exchange Connectors

K.I.T. provides unified APIs for all exchanges:

### Crypto Exchanges

```typescript
import { ExchangeManager } from 'kit-trading';

const exchanges = new ExchangeManager();

// Binance
await exchanges.connect('binance', {
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET,
  testnet: true,  // Testnet for development
});

// Kraken
await exchanges.connect('kraken', {
  apiKey: process.env.KRAKEN_API_KEY,
  secret: process.env.KRAKEN_SECRET,
});

// Bybit
await exchanges.connect('bybit', {
  apiKey: process.env.BYBIT_API_KEY,
  secret: process.env.BYBIT_SECRET,
});

// Unified API for all
const balance = await exchanges.get('binance').fetchBalance();
const ticker = await exchanges.get('kraken').fetchTicker('BTC/USD');
```

### Forex Brokers (MT4/MT5)

```typescript
import { MT5Connector } from 'kit-trading';

const mt5 = new MT5Connector();

await mt5.connect({
  account: 12345678,
  password: process.env.MT5_PASSWORD,
  server: 'RoboForex-Demo',  // or ECN, Pro, etc.
});

// Trading
await mt5.marketOrder('EURUSD', 'buy', 0.1);
await mt5.limitOrder('GBPUSD', 'sell', 0.1, 1.2650);

// Data
const candles = await mt5.getCandles('EURUSD', 'H1', 100);
const positions = await mt5.getPositions();
```

### DeFi (Web3)

```typescript
import { DeFiConnector } from 'kit-trading';

const defi = new DeFiConnector({
  rpc: 'https://eth.llamarpc.com',
  privateKey: process.env.WALLET_PRIVATE_KEY,
});

// Uniswap Swap
await defi.swap({
  from: 'ETH',
  to: 'USDC',
  amount: 1.0,
  slippage: 0.5,
});

// Aave
await defi.lend('USDC', 1000);
await defi.borrow('ETH', 0.5);
```

---

## Strategy Development

### Create Custom Strategy

```typescript
import { Strategy, Candle, Signal } from 'kit-trading';

class MyRSIStrategy extends Strategy {
  name = 'RSI Oversold/Overbought';
  
  // Configuration
  config = {
    period: 14,
    oversold: 30,
    overbought: 70,
  };
  
  // Signal logic
  async analyze(candles: Candle[]): Promise<Signal | null> {
    const rsi = this.indicators.rsi(candles, this.config.period);
    const currentRSI = rsi[rsi.length - 1];
    
    if (currentRSI < this.config.oversold) {
      return { action: 'buy', confidence: 0.8 };
    }
    
    if (currentRSI > this.config.overbought) {
      return { action: 'sell', confidence: 0.8 };
    }
    
    return null;
  }
  
  // Risk Management
  getRiskParams() {
    return {
      stopLoss: 0.02,      // 2%
      takeProfit: 0.04,    // 4%
      maxPosition: 0.1,    // 10% of portfolio
    };
  }
}

// Use the strategy
const strategy = new MyRSIStrategy();
const bot = createBot({ strategy, exchange: 'binance', pair: 'BTC/USDT' });
```

### Backtesting

```typescript
import { Backtester } from 'kit-trading';

const backtester = new Backtester({
  strategy: new MyRSIStrategy(),
  exchange: 'binance',
  pair: 'BTC/USDT',
  timeframe: '1h',
  startDate: '2024-01-01',
  endDate: '2024-12-31',
  initialBalance: 10000,
});

const results = await backtester.run();

console.log(`
  Profit: ${results.profit}%
  Win Rate: ${results.winRate}%
  Max Drawdown: ${results.maxDrawdown}%
  Sharpe Ratio: ${results.sharpeRatio}
  Total Trades: ${results.totalTrades}
`);
```

---

## Notification Channels

### Telegram Bot

```typescript
import { TelegramChannel } from 'kit-trading';

const telegram = new TelegramChannel({
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
});

// Send messages
await telegram.send('Trade executed: BUY BTC/USDT @ $45,000');

// Receive commands
telegram.onCommand('/status', async (ctx) => {
  const portfolio = await bot.getPortfolio();
  ctx.reply(`Portfolio: $${portfolio.total}`);
});

telegram.onCommand('/trade', async (ctx) => {
  const [_, action, pair, amount] = ctx.message.split(' ');
  await bot.trade(action, pair, parseFloat(amount));
  ctx.reply(`Done: ${action.toUpperCase()} ${amount} ${pair}`);
});
```

### Discord Bot

```typescript
import { DiscordChannel } from 'kit-trading';

const discord = new DiscordChannel({
  token: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
});

// Trade Alerts
bot.on('trade', (trade) => {
  discord.send('trades', `${trade.side} ${trade.symbol} @ ${trade.price}`);
});

// Slash Commands
discord.addCommand('portfolio', async (interaction) => {
  const portfolio = await bot.getPortfolio();
  interaction.reply({ embeds: [createPortfolioEmbed(portfolio)] });
});
```

### Webhooks

```typescript
import { WebhookChannel } from 'kit-trading';

const webhook = new WebhookChannel({
  url: 'https://your-app.com/webhook',
  secret: process.env.WEBHOOK_SECRET,
});

// Forward all events
bot.on('*', (event) => {
  webhook.send(event);
});
```

---

## App Architecture

### Full Trading App Example

```typescript
// app.ts
import { 
  KitAgent, 
  GatewayServer,
  ExchangeManager,
  TelegramChannel,
  Dashboard 
} from 'kit-trading';

async function main() {
  // 1. Connect exchanges
  const exchanges = new ExchangeManager();
  await exchanges.connect('binance', { /* ... */ });
  await exchanges.connect('mt5', { /* ... */ });

  // 2. Create AI Agent
  const agent = new KitAgent({
    name: 'TradingBot',
    model: 'claude-opus-4-5-20251101',
    exchanges,
  });

  // 3. Gateway Server (WebSocket API)
  const gateway = new GatewayServer({
    port: 18799,
    agent,
  });

  // 4. Telegram Channel
  const telegram = new TelegramChannel({ /* ... */ });
  agent.addChannel(telegram);

  // 5. Web Dashboard
  const dashboard = new Dashboard({
    port: 3000,
    gateway,
  });

  // 6. Start everything
  await gateway.start();
  await dashboard.start();
  
  console.log('K.I.T. Trading App running!');
  console.log('   Gateway: ws://localhost:18799');
  console.log('   Dashboard: http://localhost:3000');
}

main();
```

---

## Example Projects

| Project | Description | Code |
|---------|-------------|------|
| [Basic Bot](../examples/basic-bot.ts) | Simple trading bot | `examples/basic-bot.ts` |
| [Signal Copier](../examples/signal-copier-example.ts) | Telegram signal copy | `examples/signal-copier-example.ts` |
| [Portfolio Tracker](../examples/portfolio-tracker-example.ts) | Multi-exchange portfolio | `examples/portfolio-tracker-example.ts` |
| Grid Bot | Grid trading strategy | `examples/grid-bot.ts` |
| Arbitrage Bot | CEX arbitrage | `examples/arbitrage-bot.ts` |
| DCA Bot | Dollar cost averaging | `examples/dca-bot.ts` |

---

## Best Practices

1. **API Keys**: Never in code - always use environment variables
2. **Testnet First**: Always develop on testnet/demo first
3. **Risk Limits**: Always set stop-loss and max-position
4. **Error Handling**: Catch all exchange errors
5. **Logging**: Log all trades for analysis
6. **Rate Limits**: Respect exchange rate limits

---

## Support

- **Docs**: https://github.com/kayzaa/k.i.t.-bot/docs
- **Issues**: https://github.com/kayzaa/k.i.t.-bot/issues

---

*"Your wealth is my mission."* - K.I.T.
