---
summary: "Backtester Skill - Strategien mit historischen Daten testen"
read_when:
  - Strategien testen
  - Performance analysieren
title: "Backtester"
---

# Backtester

Der Backtester ermöglicht es, Trading-Strategien mit historischen Daten zu testen, bevor echtes Kapital eingesetzt wird.

## Warum Backtesting?

<Tip>
**Vorteile:**
- Strategie validieren ohne Risiko
- Parameter optimieren
- Erwartete Performance verstehen
- Schwächen identifizieren
- Selbstvertrauen aufbauen
</Tip>

<Warning>
**Limitationen:**
- Vergangene Performance garantiert keine zukünftige
- Slippage und Latenz nicht perfekt simuliert
- Overfitting-Gefahr bei zu viel Optimierung
</Warning>

## Quick Start

```bash
kit backtest trend-following --pair BTC/USDT --period 1y
```

Telegram:
```
"Backtest Trend-Following auf BTC letztes Jahr"
```

## Backtest durchführen

### Basic Backtest

```bash
kit backtest <strategy> \
  --pair BTC/USDT \
  --from 2023-01-01 \
  --to 2024-01-01 \
  --capital 10000
```

### Mit Custom-Parametern

```bash
kit backtest mean-reversion \
  --pair ETH/USDT \
  --from 2023-06-01 \
  --to 2024-01-01 \
  --capital 5000 \
  --rsi-period 14 \
  --rsi-buy 25 \
  --rsi-sell 75
```

### Multi-Pair Backtest

```bash
kit backtest trend-following \
  --pairs BTC/USDT,ETH/USDT,SOL/USDT \
  --from 2023-01-01 \
  --to 2024-01-01
```

## Ergebnis-Analyse

```
📊 Backtest Ergebnisse
═══════════════════════════════════════
Strategie: Trend-Following
Pair: BTC/USDT
Zeitraum: 01.01.2023 - 01.01.2024
Startkapital: $10,000

💰 PERFORMANCE
─────────────────────
Total Return: +85.2% ($8,520)
Annualized: +85.2%
vs Buy & Hold: +12.3%

Max Drawdown: -15.2% ($1,520)
Max Drawdown Duration: 23 Tage

📈 TRADE-STATISTIKEN
─────────────────────
Total Trades: 47
Gewinner: 27 (57.4%)
Verlierer: 20 (42.6%)

Avg Win: +8.2%
Avg Loss: -4.5%
Largest Win: +22.3%
Largest Loss: -8.1%

Profit Factor: 2.1
Expectancy: +1.8%

📊 RISIKO-METRIKEN
─────────────────────
Sharpe Ratio: 2.1
Sortino Ratio: 2.8
Calmar Ratio: 5.6

Win/Loss Ratio: 1.82
Recovery Factor: 5.6

📅 MONATLICHE PERFORMANCE
─────────────────────
Jan: +5.2%  | Jul: +12.3%
Feb: +3.1%  | Aug: -2.5%
Mar: -1.2%  | Sep: +8.7%
Apr: +8.5%  | Oct: +15.2%
May: +6.3%  | Nov: +10.1%
Jun: -3.2%  | Dec: +7.5%
```

## Visualisierung

### Equity-Kurve

```bash
kit backtest trend-following --pair BTC/USDT --chart equity
```

```
📈 Equity-Kurve
$18,520 ┤                                    ╭─────
        │                              ╭─────╯
        │                         ╭────╯
$15,000 ┤                    ╭────╯
        │               ╭────╯
        │          ╭────╯
$12,000 ┤     ╭────╯
        │╭────╯
$10,000 ┼╯
        └───────────────────────────────────────
         Jan    Mar    May    Jul    Sep    Nov
```

### Drawdown-Chart

```bash
kit backtest trend-following --pair BTC/USDT --chart drawdown
```

```
📉 Drawdown
    0% ┼────╮    ╭───╮         ╭───────────────
       │    ╰────╯   │    ╭────╯
   -5% ┤             ╰────╯
       │
  -10% ┤
       │                         ╭─╮
  -15% ┤─────────────────────────╯ ╰───────────
       └───────────────────────────────────────
         Jan    Mar    May    Jul    Sep    Nov
```

## Parameter-Optimierung

### Grid-Search

```bash
kit backtest optimize trend-following \
  --pair BTC/USDT \
  --param fast-ma 10,20,30 \
  --param slow-ma 50,100,200 \
  --metric sharpe
```

```
📊 Optimierungs-Ergebnisse
═══════════════════════════════════════
Parameter-Kombinationen: 9

Top 3:
1. fast=20, slow=50  | Sharpe: 2.4 | Return: +92%
2. fast=20, slow=100 | Sharpe: 2.1 | Return: +85%
3. fast=30, slow=50  | Sharpe: 1.9 | Return: +78%

⚠️ Warnung: Overfitting-Risiko bei zu viel Optimierung
```

### Walk-Forward Analyse

Vermeidet Overfitting durch rollierendes Testen:

```bash
kit backtest walk-forward trend-following \
  --pair BTC/USDT \
  --train-period 3m \
  --test-period 1m \
  --windows 12
```

## Monte-Carlo Simulation

Testet Robustheit der Strategie:

```bash
kit backtest monte-carlo trend-following \
  --pair BTC/USDT \
  --simulations 1000
```

```
📊 Monte-Carlo Simulation (1000 Runs)
═══════════════════════════════════════
Return Distribution:
• 5th Percentile:  +35%
• 25th Percentile: +55%
• Median:          +72%
• 75th Percentile: +95%
• 95th Percentile: +125%

Drawdown Distribution:
• 5th Percentile:  -8%
• Median:          -15%
• 95th Percentile: -28%

Ruin Probability: 0.5%
```

## Vergleichs-Backtest

```bash
kit backtest compare \
  trend-following mean-reversion breakout \
  --pair BTC/USDT \
  --period 1y
```

```
📊 Strategie-Vergleich
═══════════════════════════════════════
         Trend    Mean-Rev   Breakout
─────────────────────────────────────
Return   +85%     +45%       +62%
MaxDD    -15%     -12%       -22%
Sharpe   2.1      1.5        1.3
Trades   47       82         35
Win%     57%      52%        60%

Empfehlung: Trend-Following (beste risikoadjustierte Rendite)
```

## Kosten-Simulation

```bash
kit backtest trend-following \
  --pair BTC/USDT \
  --fees 0.1% \
  --slippage 0.05%
```

```
📊 Kosten-Analyse
═══════════════════════════════════════
                  Ohne Kosten   Mit Kosten
─────────────────────────────────────────
Brutto-Return     +92%          +85%
Trading Fees      -             -$620
Slippage          -             -$310
Netto-Return      +92%          +85%

Impact: -7% durch Kosten
```

## Export & Reports

### PDF-Report

```bash
kit backtest trend-following --pair BTC/USDT --export pdf
```

### CSV-Export (Trades)

```bash
kit backtest trend-following --pair BTC/USDT --export-trades trades.csv
```

### JSON-Export (Full)

```bash
kit backtest trend-following --pair BTC/USDT --export-json backtest.json
```

## Historische Daten

### Daten herunterladen

```bash
# Binance Daten laden
kit data download BTC/USDT --from 2020-01-01 --source binance

# Alle verfügbaren Daten anzeigen
kit data list

# Daten-Qualität prüfen
kit data quality BTC/USDT
```

### Daten-Anforderungen

| Timeframe | Empfohlene Historie |
|-----------|---------------------|
| 1m | Mindestens 3 Monate |
| 5m | Mindestens 6 Monate |
| 1h | Mindestens 1 Jahr |
| 4h | Mindestens 2 Jahre |
| 1d | Mindestens 3 Jahre |

## Best Practices

<Tip>
**Backtesting-Checkliste:**

1. ✅ Genug historische Daten (min. 2 Jahre)
2. ✅ Realistische Kosten (Fees + Slippage)
3. ✅ Out-of-Sample Testing
4. ✅ Walk-Forward Analyse
5. ✅ Monte-Carlo für Robustheit
6. ✅ Verschiedene Marktphasen testen
7. ❌ Nicht zu viel optimieren (Overfitting)
</Tip>

## Nächste Schritte

<Columns>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Getestete Strategie live schalten.
  </Card>
  <Card title="Market Analysis" href="/skills/market-analysis" icon="bar-chart">
    Bessere Strategien entwickeln.
  </Card>
  <Card title="Risk Management" href="/concepts/risk-management" icon="shield">
    Risiko-Parameter optimieren.
  </Card>
</Columns>
