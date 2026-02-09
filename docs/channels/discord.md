---
summary: "Discord Channel Setup für K.I.T."
read_when:
  - Discord Bot einrichten
  - Discord-Integration
title: "Discord"
---

# Discord

Discord-Integration für K.I.T. mit Server-Support, Slash-Commands und Rich-Embeds.

## Quick Setup

<Steps>
  <Step title="Discord Application erstellen">
    1. Gehe zu [Discord Developer Portal](https://discord.com/developers/applications)
    2. Klicke "New Application"
    3. Gib einen Namen ein (z.B. "K.I.T. Trading")
    4. Gehe zu "Bot" → "Add Bot"
    5. Kopiere den Bot-Token
  </Step>
  
  <Step title="Bot-Berechtigungen setzen">
    Unter "Bot" aktivieren:
    - ✅ Message Content Intent
    - ✅ Server Members Intent (optional)
    
    Unter "OAuth2" → "URL Generator":
    - Scopes: `bot`, `applications.commands`
    - Bot Permissions: `Send Messages`, `Embed Links`, `Read Messages`
  </Step>
  
  <Step title="Bot zum Server hinzufügen">
    Kopiere die generierte OAuth2-URL und öffne sie im Browser.
    Wähle deinen Server aus.
  </Step>
  
  <Step title="Token konfigurieren">
    ```bash
    kit channels add discord --token "YOUR_BOT_TOKEN"
    ```
  </Step>
  
  <Step title="Bot starten">
    ```bash
    kit channels start discord
    ```
  </Step>
</Steps>

## Konfiguration

### Basis-Konfiguration

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

### Channel-Konfiguration

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

### Rollen-basierte Berechtigungen

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

K.I.T. registriert automatisch Slash-Commands:

| Command | Beschreibung |
|---------|--------------|
| `/portfolio` | Portfolio anzeigen |
| `/buy <pair> <amount>` | Kaufen |
| `/sell <pair> <amount>` | Verkaufen |
| `/analyze <pair>` | Marktanalyse |
| `/alert <pair> <condition>` | Alert setzen |
| `/positions` | Offene Positionen |
| `/balance` | Guthaben |

### Commands registrieren

```bash
kit discord register-commands
kit discord register-commands --guild YOUR_GUILD_ID
```

## Rich Embeds

K.I.T. nutzt Discord-Embeds für übersichtliche Darstellung:

```
┌─────────────────────────────────────┐
│ 📊 BTC/USDT Analyse                 │
├─────────────────────────────────────┤
│ Preis: $67,432.50 (+1.2%)          │
│                                     │
│ Indikatoren                         │
│ RSI: 58 | MACD: Bullish | ADX: 28  │
│                                     │
│ Support: $65,000                    │
│ Resistance: $70,000                 │
│                                     │
│ 🟢 Bullish Bias                     │
├─────────────────────────────────────┤
│ [📈 Chart] [🛒 Kaufen] [🔔 Alert]   │
└─────────────────────────────────────┘
```

## Button-Interaktionen

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

## Thread-Support

K.I.T. kann in Threads arbeiten:

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

## Alert-Kanal

Dedizierter Kanal für Alerts:

```json
{
  "discord": {
    "alertChannel": "123456789",
    "alertRole": "Trading Alerts",
    "alertMention": true
  }
}
```

Alert-Beispiel:
```
@Trading Alerts
🔔 ALERT: BTC/USDT
━━━━━━━━━━━━━━━━━━━
Bedingung: Preis > $70,000
Aktuell: $70,150

[📊 Analyse] [💰 Kaufen]
```

## Mehrere Server

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

## Voice-Channel Status

K.I.T. kann seinen Status anzeigen:

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

## DM-Support

Direkte Nachrichten für private Trading-Infos:

```json
{
  "discord": {
    "allowDMs": true,
    "dmUsers": ["123456789"],
    "privateTrades": true
  }
}
```

## Webhook-Integration

Für Alerts von externen Systemen:

```bash
kit discord create-webhook --channel alerts
```

## Logging

Alle Aktivitäten in einen Log-Channel:

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

## Fehlerbehebung

<AccordionGroup>
  <Accordion title="Bot offline">
    1. Token korrekt?
    2. Intents aktiviert?
    3. Bot hat Server-Berechtigung?
    
    ```bash
    kit channels test discord
    ```
  </Accordion>
  
  <Accordion title="Slash Commands fehlen">
    ```bash
    # Commands neu registrieren
    kit discord register-commands --force
    
    # Guild-spezifisch (schneller)
    kit discord register-commands --guild YOUR_GUILD_ID
    ```
  </Accordion>
  
  <Accordion title="Keine Berechtigung">
    - Bot-Rolle hat Nachrichten-Rechte?
    - Channel-spezifische Berechtigungen?
    - User-Rolle erlaubt?
  </Accordion>
</AccordionGroup>

## Best Practices

<Tip>
**Discord-Setup:**
1. Separate Channels für Commands/Alerts/Logs
2. Rollen-basierte Berechtigungen nutzen
3. Private Trades in DMs
4. Alert-Rolle für wichtige Notifications
5. Threads für Trade-Diskussionen
</Tip>

## Nächste Schritte

<Columns>
  <Card title="Telegram" href="/channels/telegram" icon="send">
    Telegram-Integration.
  </Card>
  <Card title="Signal" href="/channels/signal" icon="shield">
    Signal-Integration.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Alerts konfigurieren.
  </Card>
</Columns>
