---
summary: "K.I.T. in 5 Minuten zum Laufen bringen"
read_when:
  - Schnellstart ohne Details
  - Erste Demo sehen
title: "Quickstart"
---

# 🚀 Quickstart - K.I.T. in 5 Minuten

Du willst K.I.T. sofort in Aktion sehen? Los geht's!

<Info>
**Keine Exchange-API nötig!** Für diese Demo nutzen wir den Sandbox-Modus.
</Info>

## Schritt 1: Installieren (1 Minute)

```bash
npm install -g @binaryfaster/kit
```

Prüfe die Installation:
```bash
kit --version
# K.I.T. v1.0.0 🚗
```

## Schritt 2: Initialisieren (30 Sekunden)

```bash
kit init --demo
```

Das erstellt ein Workspace mit Demo-Konfiguration:
```
~/.kit/
├── config.json       # ✅ Demo-Einstellungen
├── exchanges/        # ✅ Sandbox-Exchange
└── workspace/        # ✅ Agent-Dateien
```

## Schritt 3: Gateway starten (30 Sekunden)

```bash
kit gateway start
```

Du siehst:
```
🚀 K.I.T. Gateway started on 127.0.0.1:18800
📊 Skills loaded: exchange-connector, portfolio-tracker, market-analysis
🔌 Exchanges: binance-sandbox (connected)
✅ Ready for action!
```

## Schritt 4: Erste Befehle (3 Minuten)

### Portfolio checken
```bash
kit portfolio
```

Ausgabe:
```
📊 Portfolio Snapshot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Value: $10,000.00 (Demo)

Assets:
  USDT    $10,000.00  100%
  
Positions: None
```

### Marktdaten abrufen
```bash
kit market BTC/USDT
```

Ausgabe:
```
📈 BTC/USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Price:   $67,250.00
24h:     +2.3% (+$1,512)
High:    $68,100.00
Low:     $65,800.00
Volume:  $2.5B
```

### Analyse durchführen
```bash
kit analyze BTC/USDT
```

Ausgabe:
```
🔍 BTC/USDT Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trend:     BULLISH 📈
RSI (14):  58 (Neutral)
MACD:      Bullish crossover
Support:   $65,000
Resistance: $70,000

Signal: BUY
Confidence: 72%
```

### Demo-Trade ausführen
```bash
kit trade buy BTC/USDT 100 --demo
```

Ausgabe:
```
✅ Order Executed (Demo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order ID:  demo-12345
Side:      BUY
Pair:      BTC/USDT
Amount:    0.00149 BTC
Price:     $67,250.00
Total:     $100.00
Fee:       $0.10 (0.1%)
```

### Portfolio erneut checken
```bash
kit portfolio
```

```
📊 Portfolio Snapshot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Value: $10,000.00 (Demo)

Assets:
  USDT    $9,899.90   99.0%
  BTC     $100.10     1.0%   ↑ +0.1%
  
Positions:
  BTC/USDT Long  +$0.10 (+0.1%)
```

## 🎉 Geschafft!

Du hast gerade:
- ✅ K.I.T. installiert
- ✅ Das Gateway gestartet
- ✅ Marktdaten abgerufen
- ✅ Eine Analyse durchgeführt
- ✅ Einen Demo-Trade ausgeführt

## Nächste Schritte

<Columns>
  <Card title="Exchange verbinden" href="/start/exchanges" icon="link">
    Echte Börse anbinden (Binance, Kraken, etc.)
  </Card>
  <Card title="Telegram einrichten" href="/channels/telegram" icon="message-circle">
    K.I.T. per Chat steuern
  </Card>
  <Card title="Autopilot aktivieren" href="/concepts/autopilot" icon="robot">
    Automatisiertes Trading
  </Card>
</Columns>

## CLI Cheatsheet

| Befehl | Beschreibung |
|--------|--------------|
| `kit gateway start` | Gateway starten |
| `kit gateway stop` | Gateway stoppen |
| `kit portfolio` | Portfolio anzeigen |
| `kit market <pair>` | Preis abrufen |
| `kit analyze <pair>` | Technische Analyse |
| `kit trade buy <pair> <amount>` | Kaufen |
| `kit trade sell <pair> <amount>` | Verkaufen |
| `kit backtest --strategy <name>` | Backtest starten |
| `kit help` | Hilfe anzeigen |

## Troubleshooting

<AccordionGroup>
  <Accordion title="kit: command not found">
    ```bash
    # npm global bin-Pfad zu PATH hinzufügen
    export PATH="$(npm config get prefix)/bin:$PATH"
    ```
  </Accordion>
  
  <Accordion title="Gateway startet nicht">
    ```bash
    # Port prüfen
    kit gateway status
    
    # Anderen Port nutzen
    KIT_GATEWAY_PORT=18801 kit gateway start
    ```
  </Accordion>
  
  <Accordion title="Demo-Daten nicht verfügbar">
    ```bash
    # Workspace neu initialisieren
    kit init --demo --force
    ```
  </Accordion>
</AccordionGroup>

---

<Tip>
**Pro-Tipp:** Nutze `kit --help` für alle verfügbaren Befehle und Optionen.
</Tip>
