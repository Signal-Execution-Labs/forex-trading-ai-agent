# K.I.T. Developer SDK

> Build your own trading bots, apps, and integrations with K.I.T.

K.I.T. ist nicht nur ein Trading-Bot - es ist ein **Framework** zum Entwickeln eigener Trading-Anwendungen.

## 🛠️ Was du bauen kannst

| Projekt-Typ | Beschreibung | Beispiel |
|-------------|--------------|----------|
| **Trading Bots** | Automatisierte Strategien | RSI Bot, Grid Bot, DCA Bot |
| **Signal Apps** | Signal-Provider oder -Empfänger | Telegram Signal Bot |
| **Portfolio Apps** | Tracking & Analytics | Portfolio Dashboard |
| **Copy Trading** | Master/Follower Systeme | Social Trading Platform |
| **Alert Systems** | Preis- und Indikator-Alerts | Discord Alert Bot |
| **Analytics Tools** | Backtesting, Reporting | Strategy Analyzer |
| **Arbitrage Bots** | Cross-Exchange Arbitrage | CEX-DEX Arb Bot |
| **Market Makers** | Liquidity Provision | MM Bot |

---

## 🚀 Quick Start für Entwickler

### 1. K.I.T. als Library installieren

```bash
npm install @binaryfaster/kit
# oder
yarn add @binaryfaster/kit
```

### 2. Deinen ersten Bot erstellen

```typescript
import { 
  KitAgent, 
  ExchangeManager, 
  Strategy,
  createBot 
} from '@binaryfaster/kit';

// Einfacher Bot in 10 Zeilen
const bot = createBot({
  name: 'MeinErsterBot',
  exchange: 'binance',
  strategy: 'rsi-oversold',
  pair: 'BTC/USDT',
  risk: 0.02,
});

bot.start();
```

---

## 📦 SDK Module

### Core Modules

```typescript
import {
  // 🤖 Agent & Gateway
  KitAgent,           // AI Agent Kern
  GatewayServer,      // WebSocket Server
  SessionManager,     // Chat Sessions
  
  // 💱 Exchanges
  ExchangeManager,    // Multi-Exchange Manager
  BinanceConnector,   // Binance API
  KrakenConnector,    // Kraken API
  MT5Connector,       // MetaTrader 5
  
  // 📊 Trading
  OrderManager,       // Order Execution
  PositionManager,    // Position Tracking
  RiskManager,        // Risk Controls
  
  // 📈 Analysis
  TechnicalAnalysis,  // TA Indicators
  Backtester,         // Strategy Testing
  
  // 🔔 Notifications
  TelegramChannel,    // Telegram Bot
  DiscordChannel,     // Discord Bot
  WebhookChannel,     // Custom Webhooks
} from '@binaryfaster/kit';
```

---

## 🔌 Exchange Connectors

K.I.T. bietet einheitliche APIs für alle Exchanges:

### Crypto Exchanges

```typescript
import { ExchangeManager } from '@binaryfaster/kit';

const exchanges = new ExchangeManager();

// Binance
await exchanges.connect('binance', {
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET,
  testnet: true,  // Testnet für Entwicklung
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

// Einheitliche API für alle
const balance = await exchanges.get('binance').fetchBalance();
const ticker = await exchanges.get('kraken').fetchTicker('BTC/USD');
```

### Forex Broker (MT4/MT5)

```typescript
import { MT5Connector } from '@binaryfaster/kit';

const mt5 = new MT5Connector();

await mt5.connect({
  account: 12345678,
  password: process.env.MT5_PASSWORD,
  server: 'RoboForex-Demo',  // oder ECN, Pro, etc.
});

// Trading
await mt5.marketOrder('EURUSD', 'buy', 0.1);
await mt5.limitOrder('GBPUSD', 'sell', 0.1, 1.2650);

// Daten
const candles = await mt5.getCandles('EURUSD', 'H1', 100);
const positions = await mt5.getPositions();
```

### Binary Options

```typescript
import { BinaryConnector } from '@binaryfaster/kit';

const binary = new BinaryConnector('binaryfaster');

await binary.connect({
  email: process.env.BINARY_EMAIL,
  password: process.env.BINARY_PASSWORD,
});

// Trade
await binary.trade({
  asset: 'EURUSD',
  direction: 'call',
  amount: 10,
  expiry: 300,  // 5 Minuten
});
```

### DeFi (Web3)

```typescript
import { DeFiConnector } from '@binaryfaster/kit';

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

## 📊 Strategy Development

### Custom Strategy erstellen

```typescript
import { Strategy, Candle, Signal } from '@binaryfaster/kit';

class MyRSIStrategy extends Strategy {
  name = 'RSI Oversold/Overbought';
  
  // Konfiguration
  config = {
    period: 14,
    oversold: 30,
    overbought: 70,
  };
  
  // Signal-Logik
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
      maxPosition: 0.1,    // 10% des Portfolios
    };
  }
}

// Strategie verwenden
const strategy = new MyRSIStrategy();
const bot = createBot({ strategy, exchange: 'binance', pair: 'BTC/USDT' });
```

### Backtesting

```typescript
import { Backtester } from '@binaryfaster/kit';

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

## 🔔 Notification Channels

### Telegram Bot

```typescript
import { TelegramChannel } from '@binaryfaster/kit';

const telegram = new TelegramChannel({
  token: process.env.TELEGRAM_BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
});

// Nachrichten senden
await telegram.send('🚀 Trade executed: BUY BTC/USDT @ $45,000');

// Commands empfangen
telegram.onCommand('/status', async (ctx) => {
  const portfolio = await bot.getPortfolio();
  ctx.reply(`Portfolio: $${portfolio.total}`);
});

telegram.onCommand('/trade', async (ctx) => {
  const [_, action, pair, amount] = ctx.message.split(' ');
  await bot.trade(action, pair, parseFloat(amount));
  ctx.reply(`✅ ${action.toUpperCase()} ${amount} ${pair}`);
});
```

### Discord Bot

```typescript
import { DiscordChannel } from '@binaryfaster/kit';

const discord = new DiscordChannel({
  token: process.env.DISCORD_BOT_TOKEN,
  guildId: process.env.DISCORD_GUILD_ID,
});

// Trade Alerts
bot.on('trade', (trade) => {
  discord.send('trades', `⚡ ${trade.side} ${trade.symbol} @ ${trade.price}`);
});

// Slash Commands
discord.addCommand('portfolio', async (interaction) => {
  const portfolio = await bot.getPortfolio();
  interaction.reply({ embeds: [createPortfolioEmbed(portfolio)] });
});
```

### Webhooks

```typescript
import { WebhookChannel } from '@binaryfaster/kit';

const webhook = new WebhookChannel({
  url: 'https://your-app.com/webhook',
  secret: process.env.WEBHOOK_SECRET,
});

// Alle Events forwarden
bot.on('*', (event) => {
  webhook.send(event);
});
```

---

## 🏗️ App Architecture

### Full Trading App Beispiel

```typescript
// app.ts
import { 
  KitAgent, 
  GatewayServer,
  ExchangeManager,
  TelegramChannel,
  Dashboard 
} from '@binaryfaster/kit';

async function main() {
  // 1. Exchanges verbinden
  const exchanges = new ExchangeManager();
  await exchanges.connect('binance', { /* ... */ });
  await exchanges.connect('mt5', { /* ... */ });

  // 2. AI Agent erstellen
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

  // 6. Alles starten
  await gateway.start();
  await dashboard.start();
  
  console.log('🚗 K.I.T. Trading App running!');
  console.log('   Gateway: ws://localhost:18799');
  console.log('   Dashboard: http://localhost:3000');
}

main();
```

---

## 📚 Beispiel-Projekte

| Projekt | Beschreibung | Code |
|---------|--------------|------|
| [Basic Bot](../examples/basic-bot.ts) | Einfacher Trading Bot | `examples/basic-bot.ts` |
| [Signal Copier](../examples/signal-copier-example.ts) | Telegram Signal Copy | `examples/signal-copier-example.ts` |
| [Portfolio Tracker](../examples/portfolio-tracker-example.ts) | Multi-Exchange Portfolio | `examples/portfolio-tracker-example.ts` |
| Grid Bot | Grid Trading Strategy | `examples/grid-bot.ts` |
| Arbitrage Bot | CEX Arbitrage | `examples/arbitrage-bot.ts` |
| DCA Bot | Dollar Cost Averaging | `examples/dca-bot.ts` |

---

## 🔐 Best Practices

1. **API Keys**: Niemals im Code - immer Environment Variables
2. **Testnet First**: Entwickle immer erst auf Testnet/Demo
3. **Risk Limits**: Setze immer Stop-Loss und Max-Position
4. **Error Handling**: Fange alle Exchange-Errors ab
5. **Logging**: Logge alle Trades für Analyse
6. **Rate Limits**: Respektiere Exchange Rate Limits

---

## 🆘 Support

- **Docs**: https://github.com/kayzaa/k.i.t.-bot/docs
- **Discord**: [K.I.T. Community](https://discord.gg/kit)
- **Issues**: https://github.com/kayzaa/k.i.t.-bot/issues

---

*"Your wealth is my mission."* - K.I.T.
