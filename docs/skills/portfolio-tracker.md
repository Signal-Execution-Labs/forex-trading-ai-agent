---
summary: "Portfolio Tracker Skill - Vermögensübersicht und Performance"
read_when:
  - Portfolio verwalten
  - Performance tracken
title: "Portfolio Tracker"
---

# Portfolio Tracker

Der Portfolio Tracker bietet eine konsolidierte Übersicht über alle deine Assets auf allen verbundenen Exchanges.

## Übersicht

```mermaid
flowchart LR
    PT[Portfolio Tracker]
    PT --> B[Binance Balance]
    PT --> K[Kraken Balance]
    PT --> M[MetaTrader Balance]
    PT --> A[Aggregation]
    A --> D[Dashboard]
```

## Befehle

### Portfolio anzeigen

```bash
kit portfolio
kit portfolio --detailed
kit portfolio --exchange binance
```

Telegram:
```
"Zeig mein Portfolio"
"Portfolio-Details"
"Wie viel habe ich auf Binance?"
```

Output:
```
💰 Portfolio Übersicht
═══════════════════════════════════════
Total: $15,432.50 (+5.2% MTD)

📊 Asset Allocation:
┌──────────┬──────────┬─────────┬─────────┐
│ Asset    │ Balance  │ Value   │ Share   │
├──────────┼──────────┼─────────┼─────────┤
│ BTC      │ 0.1500   │ $10,050 │ 65.1%   │
│ ETH      │ 1.2000   │ $3,480  │ 22.5%   │
│ USDT     │ 1,902.50 │ $1,902  │ 12.3%   │
└──────────┴──────────┴─────────┴─────────┘

📈 Performance (30d): +$1,250 (+8.8%)
📉 Max Drawdown: -$450 (-2.9%)
```

### Holdings

```bash
kit holdings
kit holdings BTC
```

```
"Was habe ich an BTC?"
"Zeig meine Holdings"
```

### Performance

```bash
kit performance
kit performance --period 7d
kit performance --period 30d
kit performance --period ytd
```

```
"Wie ist meine Performance?"
"Performance letzte Woche"
"Performance dieses Jahr"
```

## Features

### Multi-Exchange Aggregation

Kombiniert Balances von allen Exchanges:

```
📊 Verteilung nach Exchange:
• Binance:   $10,000 (64.8%)
• Kraken:    $3,500 (22.7%)
• MetaTrader: $1,932 (12.5%)
```

### Echtzeit-Updates

```json
{
  "skills": {
    "portfolio-tracker": {
      "updateInterval": 60,        // Sekunden
      "realtime": true,           // WebSocket-Updates
      "priceSource": "binance"    // Preisquelle
    }
  }
}
```

### Historische Snapshots

```bash
kit portfolio history --from 2024-01-01
kit portfolio compare --date 2024-01-01
```

## Analytics

### Performance-Metriken

```bash
kit portfolio analytics
```

```
📊 Portfolio Analytics
═══════════════════════════════════════
Return:
• Daily:   +0.8%
• Weekly:  +3.2%
• Monthly: +8.8%
• YTD:     +45.2%

Risk Metrics:
• Volatility (30d): 12.5%
• Sharpe Ratio: 2.1
• Sortino Ratio: 2.8
• Max Drawdown: -15.2%

Benchmark Comparison:
• vs BTC:  +12.3%
• vs ETH:  +8.5%
• vs S&P:  +35.2%
```

### Korrelationsmatrix

```bash
kit portfolio correlation
```

```
📊 Asset Korrelation
       BTC    ETH    SOL
BTC   1.00   0.85   0.72
ETH   0.85   1.00   0.81
SOL   0.72   0.81   1.00

⚠️ Hohe Korrelation zwischen ETH und SOL
   Diversifikation begrenzt
```

### Sektor-Allocation

```bash
kit portfolio sectors
```

```
📊 Sektor-Verteilung
• Layer 1:    55% (BTC, ETH, SOL)
• DeFi:       20% (AAVE, UNI)
• Stablecoins: 15% (USDT, USDC)
• Gaming:     10% (IMX, GALA)
```

## Alerts

### Wert-Alerts

```bash
kit alert portfolio --total-above 20000
kit alert portfolio --total-below 10000
kit alert portfolio --change -5%
```

### Allocation-Alerts

```bash
kit alert portfolio --asset BTC --share-above 70%
kit alert portfolio --asset USDT --share-below 5%
```

## Rebalancing

### Ziel-Allocation definieren

```json
{
  "portfolio": {
    "targetAllocation": {
      "BTC": 0.50,
      "ETH": 0.30,
      "USDT": 0.20
    }
  }
}
```

### Rebalancing durchführen

```bash
kit portfolio rebalance
kit portfolio rebalance --dry-run
kit portfolio rebalance --threshold 5%
```

```
"Rebalance mein Portfolio"
"Rebalance auf 50% BTC, 30% ETH, 20% USDT"
```

Output:
```
🔄 Rebalancing-Plan
═══════════════════════════════════════
Aktuelle vs. Ziel-Allocation:

Asset    Aktuell    Ziel      Aktion
─────────────────────────────────────
BTC      65.1%      50.0%     Sell $2,330
ETH      22.5%      30.0%     Buy $1,155
USDT     12.3%      20.0%     Buy $1,175

Geschätzte Gebühren: $4.50

[✅ Ausführen] [📋 Nur anzeigen]
```

## Export

### CSV-Export

```bash
kit portfolio export --format csv --output portfolio.csv
```

### JSON-Export

```bash
kit portfolio export --format json --output portfolio.json
```

### Tax-Report

```bash
kit portfolio tax --year 2024 --format csv
```

## Konfiguration

```json
{
  "skills": {
    "portfolio-tracker": {
      "baseCurrency": "USD",
      "priceSource": "coinmarketcap",
      "includeFees": true,
      "trackGas": true,
      "historicalData": true,
      "snapshots": {
        "enabled": true,
        "interval": "daily",
        "retention": 365
      }
    }
  }
}
```

## Dashboard-Widgets

### Telegram Mini-Dashboard

K.I.T. kann regelmäßige Portfolio-Updates senden:

```json
{
  "portfolio": {
    "dailyReport": {
      "enabled": true,
      "time": "09:00",
      "timezone": "Europe/Berlin"
    }
  }
}
```

```
📊 Täglicher Portfolio Report - 15. Januar 2024
═══════════════════════════════════════
Total: $15,432.50 (+1.2% ↗️)

Top Performer: SOL +5.2%
Worst: LINK -2.1%

Offene Positionen: 3
PnL heute: +$180

✨ Guten Handel!
```

## Nächste Schritte

<Columns>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Portfolio-Alerts einrichten.
  </Card>
  <Card title="Risk Management" href="/concepts/risk-management" icon="shield">
    Portfolio-Risiko verstehen.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Automatisches Rebalancing.
  </Card>
</Columns>
