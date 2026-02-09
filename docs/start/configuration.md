---
summary: "K.I.T. Konfiguration und Einstellungen"
read_when:
  - Konfiguration anpassen
  - Neue Exchanges oder Channels einrichten
title: "Konfiguration"
---

# Konfiguration

K.I.T. wird über `~/.kit/config.json` konfiguriert. Dieser Guide erklärt alle Optionen.

## Konfigurationsdatei

<Tabs>
  <Tab title="Minimal">
    ```json
    {
      "ai": {
        "provider": "anthropic",
        "apiKey": "sk-ant-..."
      },
      "exchanges": {
        "binance": {
          "enabled": true
        }
      }
    }
    ```
  </Tab>
  
  <Tab title="Vollständig">
    ```json
    {
      "ai": {
        "provider": "anthropic",
        "apiKey": "sk-ant-...",
        "model": "claude-sonnet-4-20250514",
        "maxTokens": 4096
      },
      "exchanges": {
        "binance": {
          "enabled": true,
          "testnet": false,
          "defaultPairs": ["BTC/USDT", "ETH/USDT"]
        },
        "kraken": {
          "enabled": true
        }
      },
      "channels": {
        "telegram": {
          "enabled": true,
          "allowFrom": ["@your_username"],
          "alertChannel": "-1001234567890"
        }
      },
      "risk": {
        "maxPositionSize": 0.1,
        "maxDailyLoss": 0.05,
        "stopLossDefault": 0.02,
        "takeProfitDefault": 0.06,
        "maxOpenPositions": 5
      },
      "trading": {
        "paperTrading": false,
        "confirmTrades": true,
        "minTradeSize": 10,
        "maxTradeSize": 1000
      },
      "alerts": {
        "priceChange": 0.05,
        "volumeSpike": 3,
        "trendChange": true
      },
      "logging": {
        "level": "info",
        "file": true,
        "console": true
      }
    }
    ```
  </Tab>
</Tabs>

## KI-Provider

```json
{
  "ai": {
    "provider": "anthropic",      // oder "openai", "openrouter"
    "apiKey": "sk-ant-...",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 4096,
    "temperature": 0.3           // Niedriger = konsistentere Antworten
  }
}
```

Unterstützte Provider:
- **Anthropic**: Claude-Modelle (empfohlen)
- **OpenAI**: GPT-4, GPT-3.5
- **OpenRouter**: Verschiedene Modelle

## Exchange-Konfiguration

```json
{
  "exchanges": {
    "binance": {
      "enabled": true,
      "testnet": false,           // true für Paper-Trading
      "apiKey": "...",            // Oder in ~/.kit/exchanges/binance.json
      "apiSecret": "...",
      "defaultPairs": ["BTC/USDT", "ETH/USDT"],
      "rateLimit": 1200           // Requests pro Minute
    }
  }
}
```

<Tip>
Speichere API-Keys separat in `~/.kit/exchanges/<exchange>.json` für bessere Sicherheit.
</Tip>

## Channel-Konfiguration

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "...",
      "allowFrom": ["@username1", "@username2"],
      "alertChannel": "-1001234567890",
      "tradeConfirmation": true
    },
    "discord": {
      "enabled": true,
      "botToken": "...",
      "guildId": "...",
      "alertChannel": "..."
    }
  }
}
```

## Risiko-Management

```json
{
  "risk": {
    "maxPositionSize": 0.1,       // Max 10% pro Position
    "maxDailyLoss": 0.05,         // Max 5% Tagesverlust
    "maxWeeklyLoss": 0.15,        // Max 15% Wochenverlust
    "stopLossDefault": 0.02,      // 2% Stop-Loss
    "takeProfitDefault": 0.06,    // 6% Take-Profit (3:1 Ratio)
    "maxOpenPositions": 5,        // Max offene Positionen
    "maxLeverage": 3,             // Max Hebel
    "trailingStop": {
      "enabled": true,
      "activation": 0.02,         // Aktivierung bei 2% Gewinn
      "distance": 0.01            // 1% Abstand
    }
  }
}
```

## Trading-Einstellungen

```json
{
  "trading": {
    "paperTrading": false,        // Paper-Trading Modus
    "confirmTrades": true,        // Bestätigung vor Trade
    "minTradeSize": 10,           // Minimum in USD
    "maxTradeSize": 1000,         // Maximum in USD
    "slippage": 0.001,            // 0.1% Slippage-Toleranz
    "orderTypes": {
      "defaultEntry": "limit",
      "defaultExit": "market"
    },
    "fees": {
      "maker": 0.001,
      "taker": 0.001
    }
  }
}
```

## Alert-Konfiguration

```json
{
  "alerts": {
    "priceChange": 0.05,          // 5% Preisänderung
    "volumeSpike": 3,             // 3x normales Volumen
    "trendChange": true,          // Trend-Änderungen
    "indicators": {
      "rsi": {
        "overbought": 70,
        "oversold": 30
      },
      "macd": {
        "crossover": true
      }
    },
    "news": {
      "enabled": true,
      "keywords": ["bitcoin", "ethereum", "fed", "sec"]
    }
  }
}
```

## CLI-Konfiguration

```bash
# Konfiguration anzeigen
kit config show

# Einzelne Werte setzen
kit config set risk.maxPositionSize 0.05
kit config set trading.paperTrading true

# Exchange hinzufügen
kit config add-exchange kraken

# Konfiguration validieren
kit config validate
```

## Umgebungsvariablen

Überschreiben Werte aus `config.json`:

| Variable | Beschreibung |
|----------|--------------|
| `KIT_HOME` | Konfigurationsverzeichnis |
| `KIT_CONFIG` | Alternativer Pfad zur config.json |
| `ANTHROPIC_API_KEY` | AI-Provider Key |
| `KIT_TESTNET` | Force Testnet-Modus |
| `KIT_LOG_LEVEL` | Log-Level (debug/info/warn/error) |

## Profile

Mehrere Konfigurationen verwalten:

```bash
# Profil erstellen
kit config profile create aggressive
kit config profile create conservative

# Profil wechseln
kit config profile use aggressive

# Profil-spezifische Einstellungen
kit config set --profile aggressive risk.maxPositionSize 0.2
kit config set --profile conservative risk.maxPositionSize 0.05
```

## Nächste Schritte

<Columns>
  <Card title="Exchanges verbinden" href="/start/exchanges" icon="link">
    API-Keys einrichten und Börsen verbinden.
  </Card>
  <Card title="Erster Trade" href="/start/first-trade" icon="trending-up">
    Trading starten.
  </Card>
  <Card title="Risiko-Management" href="/concepts/risk-management" icon="shield">
    Risiko-Einstellungen verstehen.
  </Card>
</Columns>
