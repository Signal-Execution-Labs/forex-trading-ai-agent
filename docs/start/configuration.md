---
summary: "K.I.T. configuration and settings"
read_when:
  - Customize configuration
  - Set up new exchanges or channels
title: "Configuration"
---

# Configuration

K.I.T. is configured via `~/.kit/config.json`. This guide explains all options.

## Configuration File

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
  
  <Tab title="Complete">
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

## AI Provider

```json
{
  "ai": {
    "provider": "anthropic",      // or "openai", "openrouter"
    "apiKey": "sk-ant-...",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 4096,
    "temperature": 0.3           // Lower = more consistent responses
  }
}
```

Supported providers:
- **Anthropic**: Claude models (recommended)
- **OpenAI**: GPT-4, GPT-3.5
- **OpenRouter**: Various models

## Exchange Configuration

```json
{
  "exchanges": {
    "binance": {
      "enabled": true,
      "testnet": false,           // true for paper trading
      "apiKey": "...",            // Or in ~/.kit/exchanges/binance.json
      "apiSecret": "...",
      "defaultPairs": ["BTC/USDT", "ETH/USDT"],
      "rateLimit": 1200           // Requests per minute
    }
  }
}
```

<Tip>
Store API keys separately in `~/.kit/exchanges/<exchange>.json` for better security.
</Tip>

## Channel Configuration

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

## Risk Management

```json
{
  "risk": {
    "maxPositionSize": 0.1,       // Max 10% per position
    "maxDailyLoss": 0.05,         // Max 5% daily loss
    "maxWeeklyLoss": 0.15,        // Max 15% weekly loss
    "stopLossDefault": 0.02,      // 2% stop-loss
    "takeProfitDefault": 0.06,    // 6% take-profit (3:1 ratio)
    "maxOpenPositions": 5,        // Max open positions
    "maxLeverage": 3,             // Max leverage
    "trailingStop": {
      "enabled": true,
      "activation": 0.02,         // Activation at 2% profit
      "distance": 0.01            // 1% distance
    }
  }
}
```

## Trading Settings

```json
{
  "trading": {
    "paperTrading": false,        // Paper trading mode
    "confirmTrades": true,        // Confirmation before trade
    "minTradeSize": 10,           // Minimum in USD
    "maxTradeSize": 1000,         // Maximum in USD
    "slippage": 0.001,            // 0.1% slippage tolerance
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

## Alert Configuration

```json
{
  "alerts": {
    "priceChange": 0.05,          // 5% price change
    "volumeSpike": 3,             // 3x normal volume
    "trendChange": true,          // Trend changes
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

## CLI Configuration

```bash
# Show configuration
kit config show

# Set individual values
kit config set risk.maxPositionSize 0.05
kit config set trading.paperTrading true

# Add exchange
kit config add-exchange kraken

# Validate configuration
kit config validate
```

## Environment Variables

Override values from `config.json`:

| Variable | Description |
|----------|-------------|
| `KIT_HOME` | Configuration directory |
| `KIT_CONFIG` | Alternative path to config.json |
| `ANTHROPIC_API_KEY` | AI provider key |
| `KIT_TESTNET` | Force testnet mode |
| `KIT_LOG_LEVEL` | Log level (debug/info/warn/error) |

## Profiles

Manage multiple configurations:

```bash
# Create profile
kit config profile create aggressive
kit config profile create conservative

# Switch profile
kit config profile use aggressive

# Profile-specific settings
kit config set --profile aggressive risk.maxPositionSize 0.2
kit config set --profile conservative risk.maxPositionSize 0.05
```

## Next Steps

<Columns>
  <Card title="Connect Exchanges" href="/start/exchanges" icon="link">
    Set up API keys and connect exchanges.
  </Card>
  <Card title="First Trade" href="/start/first-trade" icon="trending-up">
    Start trading.
  </Card>
  <Card title="Risk Management" href="/concepts/risk-management" icon="shield">
    Understand risk settings.
  </Card>
</Columns>
