---
summary: "Telegram Channel Setup for K.I.T."
read_when:
  - Set up Telegram Bot
  - Telegram integration
title: "Telegram"
---

# Telegram

Telegram is the recommended channel for K.I.T. — fast, reliable, and with rich features like inline buttons.

## Quick Setup

<Steps>
  <Step title="Create bot">
    1. Open [@BotFather](https://t.me/BotFather) in Telegram
    2. Send `/newbot`
    3. Choose a name (e.g. "K.I.T. Trading")
    4. Choose a username (e.g. "kit_trading_bot")
    5. Copy the bot token
  </Step>
  
  <Step title="Configure token">
    ```bash
    kit channels add telegram --token "YOUR_BOT_TOKEN"
    ```
    
    Or in `~/.kit/config.json`:
    ```json
    {
      "channels": {
        "telegram": {
          "botToken": "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
        }
      }
    }
    ```
  </Step>
  
  <Step title="Start bot">
    ```bash
    kit channels start telegram
    ```
  </Step>
  
  <Step title="Chat with bot">
    Open your bot in Telegram and send `/start`.
  </Step>
</Steps>

## Configuration

### Basic Configuration

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "allowFrom": ["@your_username"],
      "adminUsers": ["@your_username"],
      "language": "en"
    }
  }
}
```

### Access Control

```json
{
  "channels": {
    "telegram": {
      "allowFrom": ["@trader1", "@trader2", "123456789"],
      "denyFrom": ["@spammer"],
      "allowGroups": false,
      "requireStartCommand": true
    }
  }
}
```

### Alert Channel

Send alerts to a separate channel/group:

```json
{
  "channels": {
    "telegram": {
      "alertChannel": "-1001234567890"
    }
  }
}
```

How to find the channel ID:
1. Add [@userinfobot](https://t.me/userinfobot) to the channel
2. The bot shows the channel ID

## Features

### Inline Buttons

K.I.T. uses Telegram buttons for confirmations:

```
⚠️ Trade Confirmation
──────────────────────
BUY BTC/USDT
$100 @ Market
Stop-Loss: $65,000

[✅ Confirm] [❌ Cancel]
```

### Trade Confirmation

```json
{
  "channels": {
    "telegram": {
      "confirmTrades": true,
      "confirmationTimeout": 60
    }
  }
}
```

### Reply Keyboard

Quick actions via keyboard:

```json
{
  "channels": {
    "telegram": {
      "quickKeyboard": true,
      "keyboardButtons": [
        ["📊 Portfolio", "📈 Analysis"],
        ["🔔 Alerts", "📋 Positions"],
        ["⚙️ Settings"]
      ]
    }
  }
}
```

## Commands

### Standard Commands

| Command | Description |
|---------|-------------|
| `/start` | Start bot |
| `/help` | Show help |
| `/portfolio` | Portfolio overview |
| `/buy` | Buy |
| `/sell` | Sell |
| `/analyze` | Market analysis |
| `/alerts` | Manage alerts |
| `/settings` | Settings |

### Register Commands

```bash
kit telegram set-commands
```

Or manually at @BotFather:
```
/setcommands
```

## Natural Language

In addition to commands, K.I.T. also understands natural language:

```
You: "How does BTC look?"
K.I.T.: 📊 BTC/USDT Analysis...

You: "Buy ETH for $200"
K.I.T.: ⚠️ Trade Confirmation...

You: "Show my portfolio"
K.I.T.: 💰 Portfolio Overview...
```

## Group Support

### Add Bot to Group

1. Add bot to the group
2. Set bot as admin (for message access)
3. Allow group in config:

```json
{
  "channels": {
    "telegram": {
      "allowGroups": true,
      "groups": {
        "-1001234567890": {
          "requireMention": true,
          "allowedCommands": ["analyze", "portfolio"]
        }
      }
    }
  }
}
```

### Mention Requirement

Only respond to mentions in groups:

```json
{
  "telegram": {
    "groups": {
      "*": {
        "requireMention": true,
        "mentionNames": ["@kit_bot", "K.I.T."]
      }
    }
  }
}
```

## Notifications

### Alert Format

```json
{
  "telegram": {
    "alertFormat": {
      "sound": true,
      "preview": true,
      "buttons": true
    }
  }
}
```

### Silent Notifications

```json
{
  "telegram": {
    "silentHours": {
      "enabled": true,
      "start": "23:00",
      "end": "07:00",
      "exceptions": ["critical"]
    }
  }
}
```

## Media Support

### Send Charts

```bash
kit chart BTC/USDT --telegram
```

K.I.T. can send charts as images:

```
📈 BTC/USDT 4h Chart
[Chart image]
RSI: 58 | MACD: Bullish
```

### Documents

Portfolio reports as file:

```bash
kit portfolio export --telegram
```

## Webhook Mode (Optional)

For better performance with high traffic:

```json
{
  "telegram": {
    "mode": "webhook",
    "webhookUrl": "https://your-domain.com/telegram/webhook",
    "webhookPort": 8443
  }
}
```

## Troubleshooting

<AccordionGroup>
  <Accordion title="Bot not responding">
    1. Token correct?
    ```bash
    kit channels test telegram
    ```
    
    2. User in `allowFrom`?
    
    3. Check bot status:
    ```bash
    kit channels status telegram
    ```
  </Accordion>
  
  <Accordion title="No notifications">
    1. Alert channel configured?
    2. Bot is admin in channel?
    3. Notifications not muted?
  </Accordion>
  
  <Accordion title="Buttons not working">
    Telegram version up to date?
    Restart bot:
    ```bash
    kit channels restart telegram
    ```
  </Accordion>
</AccordionGroup>

## Security

<Tip>
**Best Practices:**
1. Always set `allowFrom`
2. No sensitive data in groups
3. Enable trade confirmation
4. Keep bot token secret
</Tip>

## Next Steps

<Columns>
  <Card title="Discord" href="/channels/discord" icon="message-circle">
    Set up Discord integration.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Configure intelligent alerts.
  </Card>
  <Card title="First Trade" href="/start/first-trade" icon="trending-up">
    Execute your first trade.
  </Card>
</Columns>
