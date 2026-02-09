---
summary: "Alert System Skill - Intelligente Benachrichtigungen"
read_when:
  - Alerts einrichten
  - Benachrichtigungen konfigurieren
title: "Alert System"
---

# Alert System

Das Alert System überwacht Märkte 24/7 und benachrichtigt dich bei wichtigen Ereignissen.

## Alert-Typen

### Preis-Alerts

```bash
kit alert BTC/USDT price above 70000
kit alert BTC/USDT price below 60000
kit alert ETH/USDT price at 3500
```

Telegram:
```
"Alert wenn BTC über 70k"
"Benachrichtige mich bei ETH unter 3000"
```

### Prozent-Änderung

```bash
kit alert BTC/USDT change +5% --period 1h
kit alert BTC/USDT change -10% --period 24h
```

```
"Alert wenn BTC 5% steigt in 1 Stunde"
```

### Indikator-Alerts

```bash
# RSI
kit alert BTC/USDT rsi above 70
kit alert BTC/USDT rsi below 30

# MACD
kit alert BTC/USDT macd crossover

# Bollinger Bands
kit alert ETH/USDT bb-touch upper
kit alert ETH/USDT bb-touch lower
```

```
"Alert wenn BTC RSI über 70"
"Benachrichtige bei MACD Crossover"
```

### Volumen-Alerts

```bash
kit alert BTC/USDT volume above 200%
kit alert ETH/USDT volume spike
```

### Pattern-Alerts

```bash
kit alert BTC/USDT pattern "bullish engulfing"
kit alert ETH/USDT pattern "head and shoulders"
```

### Portfolio-Alerts

```bash
kit alert portfolio total above 50000
kit alert portfolio total below 10000
kit alert portfolio change -5%
```

## Alert-Verwaltung

### Alerts auflisten

```bash
kit alerts
kit alerts --active
kit alerts --triggered
```

```
"Zeig meine Alerts"
```

Output:
```
📋 Aktive Alerts (5)
═══════════════════════════════════════
ID    Typ       Asset      Bedingung        Status
─────────────────────────────────────────────────
#1    Price     BTC/USDT   > $70,000        ⏳ Aktiv
#2    Price     BTC/USDT   < $60,000        ⏳ Aktiv
#3    RSI       ETH/USDT   < 30             ⏳ Aktiv
#4    Change    SOL/USDT   +10% (24h)       ⏳ Aktiv
#5    Volume    BTC/USDT   > 200%           ⏳ Aktiv

Letzte ausgelöste (3):
─────────────────────────────────────────────────
#6    Price     ETH/USDT   > $3,500         ✅ Vor 2h
#7    RSI       BTC/USDT   > 70             ✅ Gestern
#8    Pattern   BTC/USDT   Bullish Engulf   ✅ 3 Tage
```

### Alert löschen

```bash
kit alerts remove 1
kit alerts remove --all
kit alerts remove --asset BTC/USDT
```

```
"Lösche Alert #1"
"Lösche alle Alerts"
```

### Alert pausieren

```bash
kit alerts pause 1
kit alerts pause --all
kit alerts resume 1
```

## Erweiterte Alerts

### Kombinierte Bedingungen

```bash
kit alert BTC/USDT \
  --price-above 68000 \
  --rsi-below 70 \
  --volume-above 150%
```

Alle Bedingungen müssen erfüllt sein.

### Wiederkehrende Alerts

```bash
kit alert BTC/USDT price above 70000 --repeat
```

Alert wird nach Auslösung wieder aktiviert.

### Zeitbasierte Alerts

```bash
# Nur während Handelszeiten
kit alert BTC/USDT price above 70000 --hours 9-17

# Nur an bestimmten Tagen
kit alert BTC/USDT rsi below 30 --days mon,tue,wed
```

### Cooldown

```bash
kit alert BTC/USDT change +5% --cooldown 1h
```

Mindestens 1 Stunde zwischen Benachrichtigungen.

## Benachrichtigungs-Kanäle

### Konfiguration

```json
{
  "skills": {
    "alert-system": {
      "channels": {
        "telegram": {
          "enabled": true,
          "priority": ["critical", "high", "normal"]
        },
        "discord": {
          "enabled": true,
          "priority": ["critical"]
        },
        "email": {
          "enabled": true,
          "address": "you@example.com",
          "priority": ["critical"]
        }
      }
    }
  }
}
```

### Prioritäten

```bash
# Kritisch - alle Kanäle
kit alert BTC/USDT price below 50000 --priority critical

# Hoch - Telegram + Discord
kit alert BTC/USDT rsi below 30 --priority high

# Normal - nur Telegram
kit alert BTC/USDT price above 70000 --priority normal
```

## Smart Alerts

### KI-gestützte Alerts

K.I.T. kann intelligent Alerts vorschlagen:

```bash
kit alerts suggest BTC/USDT
```

Output:
```
💡 Alert-Vorschläge für BTC/USDT
═══════════════════════════════════════
Basierend auf technischer Analyse:

1. Support-Alert
   Preis: $65,000 (starker Support)
   "Alert wenn BTC unter $65,000"

2. Resistance-Alert
   Preis: $70,000 (Resistance)
   "Alert wenn BTC über $70,000"

3. RSI-Alert
   RSI nähert sich Überkauft (aktuell 65)
   "Alert wenn RSI über 70"

[1] Alle hinzufügen
[2] Auswählen
[3] Ignorieren
```

### Auto-Alerts

```json
{
  "alerts": {
    "auto": {
      "enabled": true,
      "types": [
        "support-break",
        "resistance-break",
        "trend-change",
        "volume-anomaly"
      ]
    }
  }
}
```

## Alert-Aktionen

Alerts können automatische Aktionen auslösen:

```json
{
  "alerts": {
    "actions": {
      "BTC-drop-alert": {
        "condition": "price below 60000",
        "action": "notify",
        "message": "BTC Critical Level!"
      },
      "RSI-oversold": {
        "condition": "rsi below 25",
        "action": "buy",
        "amount": 100,
        "requireConfirmation": true
      }
    }
  }
}
```

## Benachrichtigungs-Format

### Standard-Format

```
🔔 ALERT: BTC/USDT
─────────────────────
Bedingung: Preis > $70,000
Aktuell: $70,150 (+0.2%)

Zeitpunkt: 15.01.2024 14:32 UTC
```

### Detailliertes Format

```
🔔 ALERT: BTC/USDT
═══════════════════════════════════════
Bedingung: RSI < 30 (Überverkauft)
Aktuell: RSI = 28

Kontext:
• Preis: $62,500 (-5.2% 24h)
• Volumen: +180% vs Durchschnitt
• Support: $61,000

Empfehlung: 🟢 Mögliche Kaufgelegenheit

[📊 Chart] [💰 Kaufen] [❌ Ignorieren]
```

## Statistiken

```bash
kit alerts stats
```

```
📊 Alert-Statistiken (30 Tage)
═══════════════════════════════════════
Gesamt erstellt: 45
Ausgelöst: 23 (51%)
Gelöscht: 12
Aktiv: 10

Profitabel (nach Alert-Trade):
• Gewinner: 15 (65%)
• Verlierer: 8 (35%)
• Durchschnitt: +2.3%

Top Alert-Typen:
1. RSI Oversold: 8 Treffer, +4.5% avg
2. Support Break: 6 Treffer, +3.2% avg
3. Volume Spike: 5 Treffer, +2.1% avg
```

## Nächste Schritte

<Columns>
  <Card title="Market Analysis" href="/skills/market-analysis" icon="bar-chart">
    Technische Analyse für bessere Alerts.
  </Card>
  <Card title="Auto-Trader" href="/skills/auto-trader" icon="bot">
    Alerts mit automatischen Trades verbinden.
  </Card>
  <Card title="Telegram Channel" href="/channels/telegram" icon="message-square">
    Telegram-Benachrichtigungen einrichten.
  </Card>
</Columns>
