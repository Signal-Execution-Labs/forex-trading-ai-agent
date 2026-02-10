---
summary: "Discord Channel Setup for K.I.T."
read_when:
  - Set up Discord Bot
  - Discord integration
title: "Discord"
---

# Discord

Discord integration for K.I.T. with server support, slash commands, and rich embeds.

## Quick Setup

<Steps>
  <Step title="Create Discord Application">
    1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
    2. Click "New Application"
    3. Enter a name (e.g. "K.I.T. Trading")
    4. Go to "Bot" → "Add Bot"
    5. Copy the bot token
  </Step>
  
  <Step title="Set bot permissions">
    Under "Bot" enable:
    - ✅ Message Content Intent
    - ✅ Server Members Intent (optional)
    
    Under "OAuth2" → "URL Generator":
    - Scopes: `bot`, `applications.commands`
    - Bot Permissions: `Send Messages`, `Embed Links`, `Read Messages`
  </Step>
  
  <Step title="Add bot to server">
    Copy the generated OAuth2 URL and open it in your browser.
    Select your server.
  </Step>
  
  <Step title="Configure token">
    ```bash
    kit channels add discord --token "YOUR_BOT_TOKEN"
    ```
  </Step>
  
  <Step title="Start bot">
    ```bash
    kit channels start discord
    ```
  </Step>
</Steps>

## Configuration

### Basic Configuration

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "guildId": "YOUR_SERVER_ID",
      "adminRoles": ["Trading Admin"],
      "adminUsers": ["123456789"]
    }
  }
}
```

### Channel Configuration

```json
{
  "channels": {
    "discord": {
      "channels": {
        "commands": "trading-commands",
        "alerts": "trading-alerts",
        "logs": "trading-logs"
      }
    }
  }
}
```

### Role-based Permissions

```json
{
  "discord": {
    "permissions": {
      "trade": ["Trader", "Admin"],
      "analyze": ["Trader", "Analyst", "Admin"],
      "admin": ["Admin"]
    }
  }
}
```

## Slash Commands

K.I.T. automatically registers slash commands:

| Command | Description |
|---------|-------------|
| `/portfolio` | Show portfolio |
| `/buy <pair> <amount>` | Buy |
| `/sell <pair> <amount>` | Sell |
| `/analyze <pair>` | Market analysis |
| `/alert <pair> <condition>` | Set alert |
| `/positions` | Open positions |
| `/balance` | Balance |

### Register Commands

```bash
kit discord register-commands
kit discord register-commands --guild YOUR_GUILD_ID
```

## Rich Embeds

K.I.T. uses Discord embeds for clear display:

```
┌─────────────────────────────────────┐
│ 📊 BTC/USDT Analysis                │
├─────────────────────────────────────┤
│ Price: $67,432.50 (+1.2%)          │
│                                     │
│ Indicators                          │
│ RSI: 58 | MACD: Bullish | ADX: 28  │
│                                     │
│ Support: $65,000                    │
│ Resistance: $70,000                 │
│                                     │
│ 🟢 Bullish Bias                     │
├─────────────────────────────────────┤
│ [📈 Chart] [🛒 Buy] [🔔 Alert]      │
└─────────────────────────────────────┘
```

## Button Interactions

```json
{
  "discord": {
    "buttons": {
      "confirmTrades": true,
      "quickActions": true,
      "timeout": 60
    }
  }
}
```

## Thread Support

K.I.T. can work in threads:

```json
{
  "discord": {
    "threads": {
      "enabled": true,
      "autoArchive": 1440,
      "createForTrades": true
    }
  }
}
```

## Alert Channel

Dedicated channel for alerts:

```json
{
  "discord": {
    "alertChannel": "123456789",
    "alertRole": "Trading Alerts",
    "alertMention": true
  }
}
```

Alert example:
```
@Trading Alerts
🔔 ALERT: BTC/USDT
━━━━━━━━━━━━━━━━━━━
Condition: Price > $70,000
Current: $70,150

[📊 Analysis] [💰 Buy]
```

## Multiple Servers

```json
{
  "discord": {
    "guilds": {
      "123456789": {
        "name": "Main Trading",
        "channels": { ... },
        "permissions": { ... }
      },
      "987654321": {
        "name": "VIP Trading",
        "channels": { ... },
        "permissions": { ... }
      }
    }
  }
}
```

## Voice Channel Status

K.I.T. can display its status:

```json
{
  "discord": {
    "presence": {
      "enabled": true,
      "status": "online",
      "activity": {
        "type": "watching",
        "name": "BTC: $67,432"
      },
      "updateInterval": 60
    }
  }
}
```

## DM Support

Direct messages for private trading info:

```json
{
  "discord": {
    "allowDMs": true,
    "dmUsers": ["123456789"],
    "privateTrades": true
  }
}
```

## Webhook Integration

For alerts from external systems:

```bash
kit discord create-webhook --channel alerts
```

## Logging

All activities to a log channel:

```json
{
  "discord": {
    "logging": {
      "enabled": true,
      "channel": "kit-logs",
      "events": ["trades", "alerts", "errors"]
    }
  }
}
```

## Troubleshooting

<AccordionGroup>
  <Accordion title="Bot offline">
    1. Token correct?
    2. Intents enabled?
    3. Bot has server permission?
    
    ```bash
    kit channels test discord
    ```
  </Accordion>
  
  <Accordion title="Slash Commands missing">
    ```bash
    # Re-register commands
    kit discord register-commands --force
    
    # Guild-specific (faster)
    kit discord register-commands --guild YOUR_GUILD_ID
    ```
  </Accordion>
  
  <Accordion title="No permission">
    - Bot role has message permissions?
    - Channel-specific permissions?
    - User role allowed?
  </Accordion>
</AccordionGroup>

## Best Practices

<Tip>
**Discord Setup:**
1. Separate channels for commands/alerts/logs
2. Use role-based permissions
3. Private trades in DMs
4. Alert role for important notifications
5. Threads for trade discussions
</Tip>

## Next Steps

<Columns>
  <Card title="Telegram" href="/channels/telegram" icon="send">
    Telegram integration.
  </Card>
  <Card title="Signal" href="/channels/signal" icon="shield">
    Signal integration.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Configure alerts.
  </Card>
</Columns>
