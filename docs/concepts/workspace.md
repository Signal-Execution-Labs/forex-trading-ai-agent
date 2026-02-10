---
summary: "K.I.T. workspace and data directory"
read_when:
  - Understand workspace structure
  - Find files and logs
title: "Workspace"
---

# Workspace

The K.I.T. workspace is the central directory for configuration, data, and logs.

## Default Path

| OS | Path |
|----|------|
| Windows | `C:\Users\<username>\.kit` |
| macOS | `~/.kit` |
| Linux | `~/.kit` |

Override with:
```bash
export KIT_HOME="/path/to/workspace"
```

## Directory Structure

```
~/.kit/
├── config.json              # Main configuration
├── state.json              # Runtime state
│
├── exchanges/              # Exchange credentials
│   ├── binance.json       # Encrypted
│   ├── kraken.json
│   └── metatrader.json
│
├── skills/                 # Skill modules
│   ├── exchange-connector/
│   ├── portfolio-tracker/
│   ├── alert-system/
│   └── custom-skills/
│
├── strategies/             # Trading strategies
│   ├── trend-following.json
│   ├── mean-reversion.json
│   └── custom/
│
├── data/                   # Market data cache
│   ├── ohlcv/             # Candlestick data
│   ├── orderbook/         # Orderbook snapshots
│   └── tickers/           # Ticker cache
│
├── backtest/               # Backtesting results
│   ├── results/
│   └── reports/
│
├── logs/                   # Log files
│   ├── kit.log            # Main log
│   ├── trades.log         # Trade history
│   ├── errors.log         # Errors
│   └── archive/           # Old logs
│
├── sessions/               # User sessions
│   └── telegram/
│
└── backup/                 # Automatic backups
    └── 2024-01-15/
```

## Important Files

### config.json

Main configuration:

```json
{
  "ai": { ... },
  "exchanges": { ... },
  "channels": { ... },
  "risk": { ... },
  "trading": { ... }
}
```

See [Configuration](/start/configuration) for details.

### state.json

Runtime state (do not edit manually):

```json
{
  "lastSync": "2024-01-15T10:30:00Z",
  "openPositions": [...],
  "activeAlerts": [...],
  "sessionIds": {...}
}
```

### exchanges/*.json

Encrypted exchange credentials:

```json
{
  "apiKey": "encrypted:...",
  "apiSecret": "encrypted:...",
  "lastUsed": "2024-01-15T10:30:00Z"
}
```

## Data Management

### Market Data Cache

K.I.T. caches market data locally for faster analysis:

```bash
# Cache status
kit data status

# Clear cache
kit data clear

# Limit cache size
kit config set data.maxCacheSize "5GB"
```

### Backtest Data

```bash
# Download historical data
kit data download BTC/USDT --from 2023-01-01 --to 2024-01-01

# Show data
kit data list
```

## Logs

### Log Level

```bash
# Set log level
kit config set logging.level debug  # debug, info, warn, error

# Real-time logs
kit logs -f

# Only trades
kit logs --filter trades

# Only errors
kit logs --filter errors
```

### Log Rotation

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

### Automatic Backups

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

### Manual Backup

```bash
# Create backup
kit backup create

# Restore backup
kit backup restore 2024-01-15

# List backups
kit backup list
```

## Workspace Commands

```bash
# Workspace info
kit workspace info

# Workspace path
kit workspace path

# Clean workspace
kit workspace clean

# Validate workspace
kit workspace validate

# Export workspace
kit workspace export ./kit-backup.zip

# Import workspace
kit workspace import ./kit-backup.zip
```

## Multi-Workspace

For different setups (e.g. test/production):

```bash
# Create workspace
kit workspace create test

# Switch workspace
kit workspace use test

# List workspaces
kit workspace list

# Output:
# * default  ~/.kit
#   test     ~/.kit-test
#   prod     ~/.kit-prod
```

## Security

<Warning>
**Sensitive Files:**
- `exchanges/*.json` - API keys
- `config.json` - May contain tokens
- `sessions/` - User sessions

These files should:
- Not be committed to Git
- Be backed up regularly
- Be stored with restrictive permissions
</Warning>

### Set Permissions

```bash
# Linux/macOS
chmod 700 ~/.kit
chmod 600 ~/.kit/exchanges/*
chmod 600 ~/.kit/config.json
```

## Next Steps

<Columns>
  <Card title="Configuration" href="/start/configuration" icon="settings">
    Configuration options in detail.
  </Card>
  <Card title="Skills" href="/concepts/skills" icon="plug">
    Understand skill system.
  </Card>
  <Card title="Security" href="/security/api-keys" icon="shield">
    Security best practices.
  </Card>
</Columns>
