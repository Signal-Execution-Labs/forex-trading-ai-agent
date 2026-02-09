---
summary: "K.I.T. Skill-System und Erweiterungen"
read_when:
  - Skills verstehen
  - Eigene Skills entwickeln
title: "Skills"
---

# Skills

Skills sind modulare Erweiterungen, die K.I.T. um Funktionalitäten erweitern. Sie kapseln Trading-Logik, Exchange-Anbindungen und Analyse-Tools.

## Übersicht

```
~/.kit/skills/
├── exchange-connector/    # Exchange-APIs
├── portfolio-tracker/     # Portfolio-Verwaltung
├── alert-system/         # Preis-Alerts
├── market-analysis/      # Technische Analyse
├── auto-trader/          # Automatisches Trading
└── backtester/           # Strategie-Testing
```

## Eingebaute Skills

| Skill | Beschreibung | Befehle |
|-------|--------------|---------|
| `exchange-connector` | Exchange-API-Verbindungen | buy, sell, balance |
| `portfolio-tracker` | Portfolio-Übersicht | portfolio, holdings |
| `alert-system` | Preis-Alerts | alert, alerts, remove-alert |
| `market-analysis` | Marktanalyse | analyze, chart, indicators |
| `auto-trader` | Automatische Trades | strategy, run, stop |
| `backtester` | Backtesting | backtest, optimize |

## Skill-Struktur

Jeder Skill folgt dieser Struktur:

```
my-skill/
├── SKILL.md           # Dokumentation für die AI
├── index.ts           # Hauptlogik
├── config.json        # Konfiguration
├── commands/          # Befehls-Handler
│   ├── main-command.ts
│   └── sub-command.ts
├── lib/               # Hilfs-Funktionen
└── tests/             # Tests
```

### SKILL.md

Dokumentation, die der AI den Skill erklärt:

```markdown
# My Skill

## Beschreibung
Dieser Skill macht XYZ.

## Befehle
- `my-command [arg]` - Führt XYZ aus

## Beispiele
- "Führe my-command aus"
- "my-command mit option X"
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

## Skill-Management

```bash
# Alle Skills auflisten
kit skills list

# Skill aktivieren/deaktivieren
kit skills enable market-analysis
kit skills disable backtester

# Skill-Status
kit skills status

# Skill neu laden
kit skills reload exchange-connector

# Skill installieren (Community)
kit skills install @community/my-skill
```

## Skill-Kommunikation

Skills können untereinander kommunizieren:

```typescript
// In market-analysis/commands/analyze.ts
import { useSkill } from '@kit/core';

export async function analyze(pair: string) {
  // Exchange-Connector für Preisdaten nutzen
  const exchange = useSkill('exchange-connector');
  const ohlcv = await exchange.getOHLCV(pair, '1h', 100);
  
  // Analyse durchführen
  const analysis = calculateIndicators(ohlcv);
  
  return analysis;
}
```

## Events

Skills können Events emittieren und empfangen:

```typescript
import { events } from '@kit/core';

// Event emittieren
events.emit('price-alert', { pair: 'BTC/USDT', price: 70000 });

// Event empfangen
events.on('trade-executed', (trade) => {
  console.log(`Trade: ${trade.pair} ${trade.side} ${trade.amount}`);
});
```

## Eigenen Skill erstellen

<Steps>
  <Step title="Skill-Verzeichnis erstellen">
    ```bash
    kit skills create my-skill
    ```
    
    Oder manuell:
    ```bash
    mkdir -p ~/.kit/skills/my-skill
    cd ~/.kit/skills/my-skill
    ```
  </Step>
  
  <Step title="SKILL.md schreiben">
    ```markdown
    # My Custom Skill
    
    ## Beschreibung
    Beschreibt, was der Skill macht.
    
    ## Befehle
    - `my-command` - Was es tut
    
    ## Beispiele
    - "Nutze my-command"
    ```
  </Step>
  
  <Step title="index.ts implementieren">
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
          
          // Skill-Logik hier
          const result = await doSomething(args);
          
          await reply(`Ergebnis: ${result}`);
        }
      }
    };
    ```
  </Step>
  
  <Step title="Skill registrieren">
    ```bash
    kit skills register ./my-skill
    kit skills enable my-skill
    ```
  </Step>
</Steps>

## Skill-Kontext

Jeder Command-Handler erhält einen Context:

```typescript
interface Context {
  // User-Info
  user: { id: string; name: string };
  
  // Channel-Info
  channel: { type: 'telegram' | 'discord'; id: string };
  
  // Parsed Arguments
  args: Record<string, any>;
  
  // Original Message
  message: string;
  
  // Response-Methoden
  reply: (text: string) => Promise<void>;
  replyWithButtons: (text: string, buttons: Button[]) => Promise<void>;
  
  // Andere Skills nutzen
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
**Skill-Entwicklung:**
1. Halte Skills fokussiert (Single Responsibility)
2. Schreibe gute SKILL.md Dokumentation
3. Handle Fehler gracefully
4. Nutze TypeScript für Type-Safety
5. Schreibe Tests
</Tip>

## Beispiel: Price Alert Skill

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
    // Preis-Updates abonnieren
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
      await ctx.reply(`✅ Alert gesetzt: ${pair} ${condition} ${price}`);
    },
    
    'alerts': async (ctx: Context) => {
      const userAlerts = alerts.filter(a => a.userId === ctx.user.id);
      
      if (userAlerts.length === 0) {
        await ctx.reply('Keine aktiven Alerts.');
        return;
      }
      
      const list = userAlerts.map(a => 
        `• ${a.pair} ${a.condition} ${a.price}`
      ).join('\n');
      
      await ctx.reply(`📋 Deine Alerts:\n${list}`);
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
      // Alert entfernen
      alerts.splice(alerts.indexOf(alert), 1);
    });
  }
};
```

## Nächste Schritte

<Columns>
  <Card title="Exchange Connector" href="/skills/exchange-connector" icon="link">
    Exchange-Anbindung im Detail.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Automatische Trading-Strategien.
  </Card>
  <Card title="Market Analysis" href="/skills/market-analysis" icon="bar-chart">
    Technische Analyse Tools.
  </Card>
</Columns>
