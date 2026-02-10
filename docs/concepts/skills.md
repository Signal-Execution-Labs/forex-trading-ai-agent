---
summary: "K.I.T. skill system and extensions"
read_when:
  - Understand skills
  - Develop custom skills
title: "Skills"
---

# Skills

Skills are modular extensions that add functionality to K.I.T. They encapsulate trading logic, exchange connections, and analysis tools.

## Overview

```
~/.kit/skills/
├── exchange-connector/    # Exchange APIs
├── portfolio-tracker/     # Portfolio management
├── alert-system/         # Price alerts
├── market-analysis/      # Technical analysis
├── auto-trader/          # Automatic trading
└── backtester/           # Strategy testing
```

## Built-in Skills

| Skill | Description | Commands |
|-------|-------------|----------|
| `exchange-connector` | Exchange API connections | buy, sell, balance |
| `portfolio-tracker` | Portfolio overview | portfolio, holdings |
| `alert-system` | Price alerts | alert, alerts, remove-alert |
| `market-analysis` | Market analysis | analyze, chart, indicators |
| `auto-trader` | Automatic trades | strategy, run, stop |
| `backtester` | Backtesting | backtest, optimize |

## Skill Structure

Each skill follows this structure:

```
my-skill/
├── SKILL.md           # Documentation for the AI
├── index.ts           # Main logic
├── config.json        # Configuration
├── commands/          # Command handlers
│   ├── main-command.ts
│   └── sub-command.ts
├── lib/               # Helper functions
└── tests/             # Tests
```

### SKILL.md

Documentation that explains the skill to the AI:

```markdown
# My Skill

## Description
This skill does XYZ.

## Commands
- `my-command [arg]` - Executes XYZ

## Examples
- "Execute my-command"
- "my-command with option X"
```

### config.json

```json
{
  "name": "my-skill",
  "version": "1.0.0",
  "enabled": true,
  "dependencies": ["exchange-connector"],
  "settings": {
    "option1": "value1",
    "option2": 42
  }
}
```

## Skill Management

```bash
# List all skills
kit skills list

# Enable/disable skill
kit skills enable market-analysis
kit skills disable backtester

# Skill status
kit skills status

# Reload skill
kit skills reload exchange-connector

# Install skill (community)
kit skills install @community/my-skill
```

## Skill Communication

Skills can communicate with each other:

```typescript
// In market-analysis/commands/analyze.ts
import { useSkill } from '@kit/core';

export async function analyze(pair: string) {
  // Use exchange connector for price data
  const exchange = useSkill('exchange-connector');
  const ohlcv = await exchange.getOHLCV(pair, '1h', 100);
  
  // Perform analysis
  const analysis = calculateIndicators(ohlcv);
  
  return analysis;
}
```

## Events

Skills can emit and receive events:

```typescript
import { events } from '@kit/core';

// Emit event
events.emit('price-alert', { pair: 'BTC/USDT', price: 70000 });

// Receive event
events.on('trade-executed', (trade) => {
  console.log(`Trade: ${trade.pair} ${trade.side} ${trade.amount}`);
});
```

## Create Your Own Skill

<Steps>
  <Step title="Create skill directory">
    ```bash
    kit skills create my-skill
    ```
    
    Or manually:
    ```bash
    mkdir -p ~/.kit/skills/my-skill
    cd ~/.kit/skills/my-skill
    ```
  </Step>
  
  <Step title="Write SKILL.md">
    ```markdown
    # My Custom Skill
    
    ## Description
    Describes what the skill does.
    
    ## Commands
    - `my-command` - What it does
    
    ## Examples
    - "Use my-command"
    ```
  </Step>
  
  <Step title="Implement index.ts">
    ```typescript
    import { Skill, Context } from '@kit/core';
    
    export const skill: Skill = {
      name: 'my-skill',
      version: '1.0.0',
      
      async init() {
        console.log('My skill initialized');
      },
      
      commands: {
        'my-command': async (ctx: Context) => {
          const { args, reply } = ctx;
          
          // Skill logic here
          const result = await doSomething(args);
          
          await reply(`Result: ${result}`);
        }
      }
    };
    ```
  </Step>
  
  <Step title="Register skill">
    ```bash
    kit skills register ./my-skill
    kit skills enable my-skill
    ```
  </Step>
</Steps>

## Skill Context

Each command handler receives a context:

```typescript
interface Context {
  // User info
  user: { id: string; name: string };
  
  // Channel info
  channel: { type: 'telegram' | 'discord'; id: string };
  
  // Parsed arguments
  args: Record<string, any>;
  
  // Original message
  message: string;
  
  // Response methods
  reply: (text: string) => Promise<void>;
  replyWithButtons: (text: string, buttons: Button[]) => Promise<void>;
  
  // Use other skills
  useSkill: <T>(name: string) => T;
  
  // State
  state: {
    get: (key: string) => any;
    set: (key: string, value: any) => void;
  };
}
```

## Best Practices

<Tip>
**Skill Development:**
1. Keep skills focused (single responsibility)
2. Write good SKILL.md documentation
3. Handle errors gracefully
4. Use TypeScript for type safety
5. Write tests
</Tip>

## Example: Price Alert Skill

```typescript
// skills/price-alert/index.ts
import { Skill, Context, events } from '@kit/core';

interface Alert {
  id: string;
  pair: string;
  price: number;
  condition: 'above' | 'below';
  userId: string;
}

const alerts: Alert[] = [];

export const skill: Skill = {
  name: 'price-alert',
  version: '1.0.0',
  
  async init() {
    // Subscribe to price updates
    events.on('price-update', this.checkAlerts);
  },
  
  commands: {
    'alert': async (ctx: Context) => {
      const { pair, price, condition } = ctx.args;
      
      const alert: Alert = {
        id: generateId(),
        pair,
        price,
        condition,
        userId: ctx.user.id
      };
      
      alerts.push(alert);
      await ctx.reply(`✅ Alert set: ${pair} ${condition} ${price}`);
    },
    
    'alerts': async (ctx: Context) => {
      const userAlerts = alerts.filter(a => a.userId === ctx.user.id);
      
      if (userAlerts.length === 0) {
        await ctx.reply('No active alerts.');
        return;
      }
      
      const list = userAlerts.map(a => 
        `• ${a.pair} ${a.condition} ${a.price}`
      ).join('\n');
      
      await ctx.reply(`📋 Your alerts:\n${list}`);
    }
  },
  
  checkAlerts(priceUpdate: { pair: string; price: number }) {
    const triggered = alerts.filter(alert => {
      if (alert.pair !== priceUpdate.pair) return false;
      if (alert.condition === 'above' && priceUpdate.price >= alert.price) return true;
      if (alert.condition === 'below' && priceUpdate.price <= alert.price) return true;
      return false;
    });
    
    triggered.forEach(alert => {
      events.emit('alert-triggered', alert);
      // Remove alert
      alerts.splice(alerts.indexOf(alert), 1);
    });
  }
};
```

## Next Steps

<Columns>
  <Card title="Exchange Connector" href="/skills/exchange-connector" icon="link">
    Exchange connection in detail.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Automatic trading strategies.
  </Card>
  <Card title="Market Analysis" href="/skills/market-analysis" icon="bar-chart">
    Technical analysis tools.
  </Card>
</Columns>
