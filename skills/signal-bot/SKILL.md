# Signal Bot

Intelligent signal execution engine inspired by 3Commas Signal Bot. Receives external signals (TradingView, custom webhooks, AI) and executes with advanced order management.

## Category
Trading Automation

## Inspired By
- 3Commas Signal Bot ($29-99/mo)
- Cornix Trading Bot ($30+/mo)
- WunderTrading Signal Bot ($24-90/mo)

## What It Does

Receives trading signals from ANY source and executes them with professional-grade order management:

1. **Signal Reception**: Webhooks, Telegram, API, internal AI signals
2. **Signal Filtering**: Only execute when conditions are met (RSI, trend, time)
3. **Auto Order Management**: Add TP, SL, DCA to any signal automatically
4. **Multi-Account Execution**: Same signal → multiple exchange accounts
5. **Position Sizing**: Risk-based, Kelly criterion, fixed, or signal-defined
6. **Signal Scoring**: Rate signal quality based on historical accuracy

## Key Features

### Signal Sources
- **Webhooks**: TradingView, custom, any HTTP POST
- **Telegram**: Parse signals from channels/groups
- **API**: Direct integration with signal providers
- **Internal**: K.I.T. AI signals, screener alerts

### Execution Modes
- **Instant**: Execute immediately on signal
- **Limit**: Place limit order at signal price
- **Scaled Entry**: Split into multiple entries (DCA style)
- **Conditional**: Wait for price confirmation before entry

### Order Management (Auto-Applied)
- **Take Profit**: Single, multiple TPs, trailing TP
- **Stop Loss**: Fixed, trailing, break-even after X%
- **DCA**: Average down/up on predefined levels
- **Timeout**: Auto-close if no movement after X hours

### Signal Filtering
```typescript
// Only trade signals when conditions are met
const filter: SignalFilter = {
  rsiRange: [20, 80],          // RSI must be in range
  trendAlignment: true,         // Signal must align with higher TF trend
  volumeMin: 1.2,              // Volume must be 120% of average
  spreadMax: 0.1,              // Max spread in %
  timeWindows: ['08:00-16:00'], // Trading hours only
  maxDailyTrades: 10,          // Limit trades per day
  minSignalScore: 0.7          // Minimum confidence score
};
```

### Signal Scoring
Scores incoming signals 0-1 based on:
- Historical accuracy of source
- Alignment with market conditions
- Risk/reward ratio
- Timing (London/NY session, news events)

## Configuration

```typescript
interface SignalBotConfig {
  // Signal source
  webhookSecret: string;
  telegramChannels?: string[];
  
  // Execution
  exchanges: string[];              // ['binance', 'bybit']
  accountAllocation: Record<string, number>;  // Percent per account
  
  // Position sizing
  sizeMode: 'fixed' | 'risk-percent' | 'kelly' | 'signal';
  riskPercent?: number;            // % of account per trade
  maxPositionSize?: number;        // Cap in USD
  
  // Auto order management
  autoTakeProfit: {
    enabled: boolean;
    targets: Array<{percent: number; closePercent: number}>;
    trailing?: {activation: number; callback: number};
  };
  autoStopLoss: {
    enabled: boolean;
    percent: number;
    trailing?: boolean;
    breakEven?: {activation: number; offset: number};
  };
  autoDCA: {
    enabled: boolean;
    levels: Array<{dropPercent: number; sizeMultiplier: number}>;
    maxOrders: number;
  };
  
  // Filtering
  filter?: SignalFilter;
  
  // Risk management
  maxDailyLoss: number;           // Stop trading after X% loss
  maxConcurrentTrades: number;
  blacklist?: string[];            // Don't trade these symbols
}
```

## Signal Format

### Standard Webhook Payload
```json
{
  "signal": "buy",
  "symbol": "BTCUSDT",
  "price": 105000,
  "tp": [107000, 110000, 115000],
  "sl": 102000,
  "confidence": 0.85,
  "source": "tradingview",
  "strategy": "RSI_Divergence",
  "message": "Bullish divergence on 4H"
}
```

### TradingView Alert Format
```
{{strategy.order.action}} {{ticker}} @ {{close}}
TP: {{strategy.order.tp}}
SL: {{strategy.order.sl}}
```

### Telegram Signal Parsing
Automatically parses common signal formats:
- "BUY BTCUSDT @ 105000"
- "🟢 LONG BTC Entry: 105000 TP: 107000 SL: 102000"
- Custom regex patterns

## API Endpoints

```
POST /api/signals/webhook         - Receive webhook signal
POST /api/signals/execute         - Manual signal execution
GET  /api/signals/history         - Signal execution history
GET  /api/signals/stats           - Signal source statistics
POST /api/signals/filter/test     - Test filter on historical signals
PUT  /api/signals/config          - Update bot configuration
GET  /api/signals/sources         - List connected signal sources
POST /api/signals/sources/add     - Add new signal source
```

## Usage Examples

### Basic Signal Execution
```typescript
import { SignalBot } from 'kit-trading/skills/signal-bot';

const bot = new SignalBot({
  webhookSecret: process.env.WEBHOOK_SECRET,
  exchanges: ['binance'],
  sizeMode: 'risk-percent',
  riskPercent: 1,
  autoTakeProfit: {
    enabled: true,
    targets: [
      { percent: 2, closePercent: 50 },
      { percent: 5, closePercent: 100 }
    ]
  },
  autoStopLoss: {
    enabled: true,
    percent: 2,
    trailing: true
  }
});

bot.start();
```

### Multi-Account with DCA
```typescript
const bot = new SignalBot({
  exchanges: ['binance', 'bybit', 'okx'],
  accountAllocation: { binance: 50, bybit: 30, okx: 20 },
  autoDCA: {
    enabled: true,
    levels: [
      { dropPercent: 2, sizeMultiplier: 1.5 },
      { dropPercent: 5, sizeMultiplier: 2 },
      { dropPercent: 10, sizeMultiplier: 3 }
    ],
    maxOrders: 5
  }
});
```

### Signal Filtering
```typescript
const bot = new SignalBot({
  filter: {
    rsiRange: [25, 75],
    trendAlignment: true,
    timeWindows: ['08:00-12:00', '14:00-18:00'],
    maxDailyTrades: 5,
    minSignalScore: 0.7
  }
});
```

## K.I.T. Advantages

| Feature | 3Commas | Cornix | WunderTrading | K.I.T. |
|---------|---------|--------|---------------|--------|
| Multi-exchange | ✅ | ✅ | ✅ | ✅ |
| Telegram parsing | ❌ | ✅ | ❌ | ✅ |
| AI signal scoring | ❌ | ❌ | ❌ | ✅ |
| Custom filters | Limited | Limited | Basic | ✅ Full |
| DCA on signal | ✅ | Limited | ✅ | ✅ |
| Break-even SL | ✅ | ❌ | ✅ | ✅ |
| Signal source stats | Basic | ❌ | Basic | ✅ Advanced |
| Self-hosted | ❌ | ❌ | ❌ | ✅ |
| Price | $29-99/mo | $30+/mo | $24-90/mo | **Free** |

## Performance Tracking

Tracks per signal source:
- Win rate, average R:R
- Best/worst trades
- Accuracy by market condition
- Drawdown statistics
- Profit factor

## Files

- `SKILL.md` - This documentation
- `signal-bot.ts` - Main implementation
- `telegram-parser.ts` - Telegram signal parsing
- `signal-scorer.ts` - AI signal scoring
- `index.ts` - Exports
