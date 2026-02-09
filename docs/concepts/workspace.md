---
summary: "K.I.T. Workspace und Datenverzeichnis"
read_when:
  - Workspace-Struktur verstehen
  - Dateien und Logs finden
title: "Workspace"
---

# Workspace

Der K.I.T. Workspace ist das zentrale Verzeichnis für Konfiguration, Daten und Logs.

## Standardpfad

| OS | Pfad |
|----|------|
| Windows | `C:\Users\<username>\.kit` |
| macOS | `~/.kit` |
| Linux | `~/.kit` |

Überschreiben mit:
```bash
export KIT_HOME="/path/to/workspace"
```

## Verzeichnisstruktur

```
~/.kit/
├── config.json              # Hauptkonfiguration
├── state.json              # Runtime-State
│
├── exchanges/              # Exchange-Credentials
│   ├── binance.json       # Verschlüsselt
│   ├── kraken.json
│   └── metatrader.json
│
├── skills/                 # Skill-Module
│   ├── exchange-connector/
│   ├── portfolio-tracker/
│   ├── alert-system/
│   └── custom-skills/
│
├── strategies/             # Trading-Strategien
│   ├── trend-following.json
│   ├── mean-reversion.json
│   └── custom/
│
├── data/                   # Marktdaten-Cache
│   ├── ohlcv/             # Candlestick-Daten
│   ├── orderbook/         # Orderbook-Snapshots
│   └── tickers/           # Ticker-Cache
│
├── backtest/               # Backtesting-Ergebnisse
│   ├── results/
│   └── reports/
│
├── logs/                   # Log-Dateien
│   ├── kit.log            # Haupt-Log
│   ├── trades.log         # Trade-History
│   ├── errors.log         # Fehler
│   └── archive/           # Alte Logs
│
├── sessions/               # User-Sessions
│   └── telegram/
│
└── backup/                 # Automatische Backups
    └── 2024-01-15/
```

## Wichtige Dateien

### config.json

Hauptkonfiguration:

```json
{
  "ai": { ... },
  "exchanges": { ... },
  "channels": { ... },
  "risk": { ... },
  "trading": { ... }
}
```

Siehe [Konfiguration](/start/configuration) für Details.

### state.json

Runtime-State (nicht manuell bearbeiten):

```json
{
  "lastSync": "2024-01-15T10:30:00Z",
  "openPositions": [...],
  "activeAlerts": [...],
  "sessionIds": {...}
}
```

### exchanges/*.json

Verschlüsselte Exchange-Credentials:

```json
{
  "apiKey": "encrypted:...",
  "apiSecret": "encrypted:...",
  "lastUsed": "2024-01-15T10:30:00Z"
}
```

## Daten-Management

### Marktdaten-Cache

K.I.T. cached Marktdaten lokal für schnellere Analyse:

```bash
# Cache-Status
kit data status

# Cache leeren
kit data clear

# Cache-Größe begrenzen
kit config set data.maxCacheSize "5GB"
```

### Backtest-Daten

```bash
# Historische Daten laden
kit data download BTC/USDT --from 2023-01-01 --to 2024-01-01

# Daten anzeigen
kit data list
```

## Logs

### Log-Level

```bash
# Log-Level setzen
kit config set logging.level debug  # debug, info, warn, error

# Logs in Echtzeit
kit logs -f

# Nur Trades
kit logs --filter trades

# Nur Fehler
kit logs --filter errors
```

### Log-Rotation

```json
{
  "logging": {
    "maxSize": "100MB",
    "maxFiles": 10,
    "compress": true
  }
}
```

## Backups

### Automatische Backups

```json
{
  "backup": {
    "enabled": true,
    "interval": "daily",
    "keepLast": 7,
    "include": ["config.json", "strategies/", "state.json"]
  }
}
```

### Manuelles Backup

```bash
# Backup erstellen
kit backup create

# Backup wiederherstellen
kit backup restore 2024-01-15

# Backups auflisten
kit backup list
```

## Workspace-Befehle

```bash
# Workspace-Info
kit workspace info

# Workspace-Pfad
kit workspace path

# Workspace bereinigen
kit workspace clean

# Workspace validieren
kit workspace validate

# Workspace exportieren
kit workspace export ./kit-backup.zip

# Workspace importieren
kit workspace import ./kit-backup.zip
```

## Multi-Workspace

Für verschiedene Setups (z.B. Test/Produktion):

```bash
# Workspace erstellen
kit workspace create test

# Workspace wechseln
kit workspace use test

# Workspace auflisten
kit workspace list

# Output:
# * default  ~/.kit
#   test     ~/.kit-test
#   prod     ~/.kit-prod
```

## Sicherheit

<Warning>
**Sensible Dateien:**
- `exchanges/*.json` - API-Keys
- `config.json` - Kann Tokens enthalten
- `sessions/` - User-Sessions

Diese Dateien sollten:
- Nicht in Git commited werden
- Regelmäßig gesichert werden
- Mit restriktiven Permissions gespeichert werden
</Warning>

### Permissions setzen

```bash
# Linux/macOS
chmod 700 ~/.kit
chmod 600 ~/.kit/exchanges/*
chmod 600 ~/.kit/config.json
```

## Nächste Schritte

<Columns>
  <Card title="Konfiguration" href="/start/configuration" icon="settings">
    Konfigurationsoptionen im Detail.
  </Card>
  <Card title="Skills" href="/concepts/skills" icon="plug">
    Skill-System verstehen.
  </Card>
  <Card title="Sicherheit" href="/security/api-keys" icon="shield">
    Best Practices für Sicherheit.
  </Card>
</Columns>
