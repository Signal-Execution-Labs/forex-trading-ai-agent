# Build Your Own Trading Bot

> 🤖 Entwickle deinen eigenen Trading Bot mit K.I.T. in unter 30 Minuten!

## Warum K.I.T.?

K.I.T. ist nicht nur ein Trading Bot - es ist ein **Framework** wie OpenClaw. Du kannst:

- ✅ Eigene Trading Bots entwickeln
- ✅ Custom Strategien implementieren
- ✅ Apps für alle unterstützten Plattformen bauen
- ✅ Telegram/Discord Bots erstellen
- ✅ Web Dashboards bauen
- ✅ Signal-Services anbieten

---

## 🚀 In 5 Schritten zum eigenen Bot

### Schritt 1: Projekt erstellen

```bash
mkdir mein-trading-bot
cd mein-trading-bot
npm init -y
npm install @binaryfaster/kit typescript ts-node
```

### Schritt 2: TypeScript konfigurieren

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist"
  }
}
```

### Schritt 3: Bot-Code schreiben

```typescript
// src/bot.ts
import { createBot, RSIStrategy } from '@binaryfaster/kit';

const bot = createBot({
  name: 'MeinRSIBot',
  
  // Exchange
  exchange: 'binance',
  credentials: {
    apiKey: process.env.BINANCE_API_KEY!,
    secret: process.env.BINANCE_SECRET!,
  },
  
  // Trading Pair
  pair: 'BTC/USDT',
  timeframe: '1h',
  
  // Strategie
  strategy: new RSIStrategy({
    period: 14,
    oversold: 30,
    overbought: 70,
  }),
  
  // Risk Management
  risk: {
    maxPositionSize: 0.1,  // 10% pro Trade
    stopLoss: 0.02,        // 2% Stop Loss
    takeProfit: 0.04,      // 4% Take Profit
    maxDailyLoss: 0.05,    // 5% max Tagesverlust
  },
  
  // Notifications
  notifications: {
    telegram: {
      token: process.env.TELEGRAM_BOT_TOKEN!,
      chatId: process.env.TELEGRAM_CHAT_ID!,
    },
  },
});

// Events
bot.on('signal', (signal) => {
  console.log(`📊 Signal: ${signal.action} ${signal.pair}`);
});

bot.on('trade', (trade) => {
  console.log(`⚡ Trade: ${trade.side} ${trade.amount} ${trade.pair}`);
});

bot.on('error', (error) => {
  console.error(`❌ Error: ${error.message}`);
});

// Starten
bot.start();
console.log('🚗 Bot gestartet!');
```

### Schritt 4: Environment Variables

```bash
# .env
BINANCE_API_KEY=dein_api_key
BINANCE_SECRET=dein_secret
TELEGRAM_BOT_TOKEN=dein_bot_token
TELEGRAM_CHAT_ID=dein_chat_id
```

### Schritt 5: Bot starten

```bash
npx ts-node src/bot.ts
```

**Das war's!** 🎉 Dein Bot traded jetzt automatisch.

---

## 📊 Eigene Strategie entwickeln

```typescript
// src/strategies/my-strategy.ts
import { Strategy, Candle, Signal, Indicators } from '@binaryfaster/kit';

export class MeineStrategie extends Strategy {
  name = 'Meine Super Strategie';
  
  private indicators = new Indicators();
  
  async analyze(candles: Candle[]): Promise<Signal | null> {
    // Deine Logik hier
    const closes = candles.map(c => c.close);
    
    // Beispiel: MA Crossover
    const ma20 = this.indicators.sma(closes, 20);
    const ma50 = this.indicators.sma(closes, 50);
    
    const currentMA20 = ma20[ma20.length - 1];
    const currentMA50 = ma50[ma50.length - 1];
    const prevMA20 = ma20[ma20.length - 2];
    const prevMA50 = ma50[ma50.length - 2];
    
    // Golden Cross
    if (prevMA20 <= prevMA50 && currentMA20 > currentMA50) {
      return { action: 'buy', confidence: 0.8 };
    }
    
    // Death Cross
    if (prevMA20 >= prevMA50 && currentMA20 < currentMA50) {
      return { action: 'sell', confidence: 0.8 };
    }
    
    return null;
  }
}
```

---

## 🌐 Unterstützte Plattformen

Du kannst Bots für alle diese Plattformen bauen:

### Crypto
- Binance, Binance Futures
- Kraken, Kraken Futures
- Coinbase Pro
- OKX
- Bybit
- KuCoin

### Forex
- **RoboForex** (MT4/MT5)
- IC Markets
- Pepperstone
- OANDA
- XM

### Binary Options
- BinaryFaster
- IQ Option
- Pocket Option

### DeFi
- Uniswap (v2, v3)
- PancakeSwap
- Aave
- Compound

---

## 💡 Projekt-Ideen

| Projekt | Schwierigkeit | Beschreibung |
|---------|---------------|--------------|
| DCA Bot | ⭐ Einfach | Dollar Cost Averaging |
| Grid Bot | ⭐⭐ Mittel | Grid Trading |
| Arbitrage Bot | ⭐⭐⭐ Schwer | Cross-Exchange Arbitrage |
| Signal Bot | ⭐⭐ Mittel | Telegram Signal Service |
| Copy Trading | ⭐⭐⭐ Schwer | Master-Follower System |
| Portfolio App | ⭐⭐ Mittel | Multi-Exchange Dashboard |
| News Trader | ⭐⭐⭐ Schwer | Event-basiertes Trading |

---

## 🆘 Hilfe & Community

- **Docs**: [K.I.T. Documentation](https://github.com/kayzaa/k.i.t.-bot)
- **Examples**: [Code Examples](https://github.com/kayzaa/k.i.t.-bot/tree/main/examples)
- **Discord**: K.I.T. Developer Community
- **Issues**: [GitHub Issues](https://github.com/kayzaa/k.i.t.-bot/issues)

---

*"Build the future of trading."* 🚗
