---
summary: "Auto-Trader Skill - Automatische Trading-Strategien"
read_when:
  - Automatisches Trading einrichten
  - Strategien konfigurieren
title: "Auto-Trader"
---

# Auto-Trader

Der Auto-Trader führt vordefinierte Trading-Strategien automatisch aus. Du definierst die Regeln, K.I.T. handelt.

<Warning>
**Risiko-Hinweis:** Automatisches Trading kann zu erheblichen Verlusten führen. Teste jede Strategie ausgiebig mit Backtesting und Paper-Trading, bevor du echtes Kapital einsetzt.
</Warning>

## Übersicht

```mermaid
flowchart TD
    A[Marktdaten] --> B[Strategie-Engine]
    B --> C{Signal?}
    C -->|Ja| D[Risk Check]
    D -->|Pass| E[Order ausführen]
    D -->|Fail| F[Ablehnen]
    C -->|Nein| A
    E --> G[Position überwachen]
    G --> H{Exit-Signal?}
    H -->|Ja| I[Position schließen]
    H -->|Nein| G
```

## Eingebaute Strategien

### Trend Following

Folgt etablierten Trends mit Moving Averages.

```json
{
  "strategy": "trend-following",
  "params": {
    "fastMA": 20,
    "slowMA": 50,
    "confirmationCandles": 2,
    "stopLoss": 0.02,
    "takeProfit": 0.06
  }
}
```

**Signale:**
- **Long:** Fast MA kreuzt über Slow MA
- **Short:** Fast MA kreuzt unter Slow MA

### Mean Reversion

Handelt Rückkehr zum Mittelwert bei Übertreibungen.

```json
{
  "strategy": "mean-reversion",
  "params": {
    "rsiPeriod": 14,
    "rsiBuyLevel": 30,
    "rsiSellLevel": 70,
    "bollingerPeriod": 20,
    "bollingerStdDev": 2
  }
}
```

**Signale:**
- **Long:** RSI < 30 ODER Preis unter unterem BB
- **Short:** RSI > 70 ODER Preis über oberem BB

### Breakout

Handelt Ausbrüche aus Konsolidierungen.

```json
{
  "strategy": "breakout",
  "params": {
    "lookbackPeriod": 20,
    "volumeMultiplier": 1.5,
    "breakoutThreshold": 0.02
  }
}
```

### Grid Trading

Platziert Orders in einem Preis-Raster.

```json
{
  "strategy": "grid",
  "params": {
    "upperPrice": 70000,
    "lowerPrice": 60000,
    "gridLevels": 10,
    "orderSize": 100
  }
}
```

### DCA (Dollar Cost Averaging)

Regelmäßige Käufe unabhängig vom Preis.

```json
{
  "strategy": "dca",
  "params": {
    "amount": 100,
    "interval": "weekly",
    "day": "monday",
    "time": "09:00"
  }
}
```

## Strategie starten

### Via CLI

```bash
# Strategie starten
kit auto-trader start trend-following \
  --pair BTC/USDT \
  --capital 1000

# Mit Custom-Parametern
kit auto-trader start mean-reversion \
  --pair ETH/USDT \
  --capital 500 \
  --rsi-buy 25 \
  --rsi-sell 75
```

### Via Telegram

```
"Starte Trend-Following für BTC mit 1000$"
"Auto-Trade Mean-Reversion auf ETH"
```

## Strategie-Verwaltung

```bash
# Aktive Strategien anzeigen
kit auto-trader status

# Strategie pausieren
kit auto-trader pause trend-following-btc

# Strategie fortsetzen
kit auto-trader resume trend-following-btc

# Strategie stoppen
kit auto-trader stop trend-following-btc

# Alle stoppen
kit auto-trader stop-all
```

## Status-Dashboard

```bash
kit auto-trader dashboard
```

```
🤖 Auto-Trader Dashboard
═══════════════════════════════════════
Aktive Strategien: 3

┌─────────────────────────────────────────────────┐
│ #1 Trend-Following (BTC/USDT)                   │
├─────────────────────────────────────────────────┤
│ Status: 🟢 Aktiv                                │
│ Kapital: $1,000 | Position: Long $500           │
│ PnL: +$52.30 (+5.23%)                          │
│ Trades: 12 | Win Rate: 67%                      │
│ Laufzeit: 7 Tage                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ #2 Mean-Reversion (ETH/USDT)                    │
├─────────────────────────────────────────────────┤
│ Status: ⏳ Wartet auf Signal                     │
│ Kapital: $500 | Position: Keine                 │
│ PnL: +$23.50 (+4.7%)                           │
│ Trades: 8 | Win Rate: 62%                       │
│ Laufzeit: 5 Tage                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ #3 DCA (BTC/USDT)                               │
├─────────────────────────────────────────────────┤
│ Status: 🟢 Aktiv                                │
│ Investiert: $400 | Nächster Kauf: Mo 09:00     │
│ Avg Entry: $65,200 | Aktuell: $67,500          │
│ PnL: +$14.00 (+3.5%)                           │
└─────────────────────────────────────────────────┘

Gesamt-PnL: +$89.80 (+5.98%)
```

## Eigene Strategie erstellen

### Strategie-Datei

```json
// ~/.kit/strategies/my-strategy.json
{
  "name": "my-strategy",
  "version": "1.0.0",
  "description": "Meine Custom-Strategie",
  "timeframe": "4h",
  "pairs": ["BTC/USDT", "ETH/USDT"],
  
  "entry": {
    "conditions": [
      { "indicator": "rsi", "period": 14, "operator": "<", "value": 30 },
      { "indicator": "macd", "signal": "bullish-crossover" },
      { "indicator": "volume", "operator": ">", "value": "150%" }
    ],
    "logic": "AND"
  },
  
  "exit": {
    "takeProfit": 0.06,
    "stopLoss": 0.02,
    "trailingStop": {
      "activation": 0.03,
      "distance": 0.015
    },
    "conditions": [
      { "indicator": "rsi", "period": 14, "operator": ">", "value": 70 }
    ]
  },
  
  "riskManagement": {
    "maxPositionSize": 0.1,
    "maxOpenTrades": 2,
    "riskPerTrade": 0.01
  }
}
```

### Strategie registrieren

```bash
kit auto-trader add-strategy ./my-strategy.json
kit auto-trader list-strategies
```

### Strategie mit Code (Advanced)

```typescript
// ~/.kit/strategies/custom/index.ts
import { Strategy, Signal, Context } from '@kit/auto-trader';

export const myStrategy: Strategy = {
  name: 'my-custom-strategy',
  
  async analyze(ctx: Context): Promise<Signal | null> {
    const { candles, indicators } = ctx;
    
    const rsi = indicators.rsi(14);
    const macd = indicators.macd(12, 26, 9);
    
    if (rsi < 30 && macd.histogram > 0) {
      return {
        type: 'long',
        confidence: 0.8,
        entry: candles.close,
        stopLoss: candles.close * 0.98,
        takeProfit: candles.close * 1.06
      };
    }
    
    return null;
  }
};
```

## Backtest vor Live

Bevor eine Strategie live geht:

```bash
# Backtest durchführen
kit backtest my-strategy \
  --pair BTC/USDT \
  --from 2023-01-01 \
  --to 2024-01-01

# Paper-Trading testen
kit auto-trader start my-strategy \
  --pair BTC/USDT \
  --paper
```

## Benachrichtigungen

```json
{
  "autoTrader": {
    "notifications": {
      "onSignal": true,
      "onTrade": true,
      "onStopLoss": true,
      "onTakeProfit": true,
      "dailySummary": "18:00"
    }
  }
}
```

Trade-Benachrichtigung:
```
🤖 Auto-Trader: Trade ausgeführt
═══════════════════════════════════════
Strategie: Trend-Following
Aktion: LONG BTC/USDT

Entry: $67,200
Stop-Loss: $65,856 (-2%)
Take-Profit: $71,232 (+6%)

Position: $500 (5% Portfolio)
```

## Sicherheits-Features

### Kill-Switch

```json
{
  "autoTrader": {
    "killSwitch": {
      "maxDailyLoss": 0.05,
      "maxConsecutiveLosses": 5,
      "emergencyStop": true
    }
  }
}
```

### Manuelles Override

```bash
# Alle Auto-Trades sofort stoppen
kit auto-trader emergency-stop

# Bestimmte Strategie überschreiben
kit auto-trader override trend-following --close-all
```

## Performance-Tracking

```bash
kit auto-trader performance
kit auto-trader performance --strategy trend-following
```

```
📊 Auto-Trader Performance
═══════════════════════════════════════
Zeitraum: 30 Tage

Strategie         Trades  Win%   PnL      Sharpe
────────────────────────────────────────────────
Trend-Following   24      67%    +8.5%    1.8
Mean-Reversion    18      56%    +3.2%    1.2
DCA               4       75%    +5.1%    N/A
────────────────────────────────────────────────
Gesamt            46      64%    +6.2%    1.5
```

## Nächste Schritte

<Columns>
  <Card title="Backtester" href="/skills/backtester" icon="history">
    Strategien testen.
  </Card>
  <Card title="Risk Management" href="/concepts/risk-management" icon="shield">
    Risiko-Kontrolle.
  </Card>
  <Card title="Market Analysis" href="/skills/market-analysis" icon="bar-chart">
    Analyse für bessere Strategien.
  </Card>
</Columns>
