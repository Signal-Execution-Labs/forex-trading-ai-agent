---
summary: "Telegram Channel Setup für K.I.T."
read_when:
  - Telegram Bot einrichten
  - Telegram-Integration
title: "Telegram"
---

# Telegram

Telegram ist der empfohlene Kanal für K.I.T. — schnell, zuverlässig und mit Rich-Features wie Inline-Buttons.

## Quick Setup

<Steps>
  <Step title="Bot erstellen">
    1. Öffne [@BotFather](https://t.me/BotFather) in Telegram
    2. Sende `/newbot`
    3. Wähle einen Namen (z.B. "K.I.T. Trading")
    4. Wähle einen Username (z.B. "kit_trading_bot")
    5. Kopiere den Bot-Token
  </Step>
  
  <Step title="Token konfigurieren">
    ```bash
    kit channels add telegram --token "YOUR_BOT_TOKEN"
    ```
    
    Oder in `~/.kit/config.json`:
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
  
  <Step title="Bot starten">
    ```bash
    kit channels start telegram
    ```
  </Step>
  
  <Step title="Mit Bot chatten">
    Öffne deinen Bot in Telegram und sende `/start`.
  </Step>
</Steps>

## Konfiguration

### Basis-Konfiguration

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN",
      "allowFrom": ["@your_username"],
      "adminUsers": ["@your_username"],
      "language": "de"
    }
  }
}
```

### Zugriffssteuerung

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

### Alert-Channel

Alerts an einen separaten Kanal/Gruppe senden:

```json
{
  "channels": {
    "telegram": {
      "alertChannel": "-1001234567890"
    }
  }
}
```

So findest du die Channel-ID:
1. Füge [@userinfobot](https://t.me/userinfobot) zum Channel hinzu
2. Der Bot zeigt die Channel-ID

## Features

### Inline-Buttons

K.I.T. nutzt Telegram-Buttons für Bestätigungen:

```
⚠️ Trade-Bestätigung
──────────────────────
KAUFEN BTC/USDT
$100 @ Market
Stop-Loss: $65,000

[✅ Bestätigen] [❌ Abbrechen]
```

### Trade-Bestätigung

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

### Reply-Keyboard

Quick-Actions per Tastatur:

```json
{
  "channels": {
    "telegram": {
      "quickKeyboard": true,
      "keyboardButtons": [
        ["📊 Portfolio", "📈 Analyse"],
        ["🔔 Alerts", "📋 Positionen"],
        ["⚙️ Settings"]
      ]
    }
  }
}
```

## Befehle

### Standard-Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `/start` | Bot starten |
| `/help` | Hilfe anzeigen |
| `/portfolio` | Portfolio-Übersicht |
| `/buy` | Kaufen |
| `/sell` | Verkaufen |
| `/analyze` | Marktanalyse |
| `/alerts` | Alerts verwalten |
| `/settings` | Einstellungen |

### Befehle registrieren

```bash
kit telegram set-commands
```

Oder manuell bei @BotFather:
```
/setcommands
```

## Natürliche Sprache

Neben Befehlen versteht K.I.T. auch natürliche Sprache:

```
Du: "Wie sieht BTC aus?"
K.I.T.: 📊 BTC/USDT Analyse...

Du: "Kaufe ETH für 200$"
K.I.T.: ⚠️ Trade-Bestätigung...

Du: "Zeig mein Portfolio"
K.I.T.: 💰 Portfolio Übersicht...
```

## Gruppen-Support

### Bot zu Gruppe hinzufügen

1. Bot zur Gruppe hinzufügen
2. Bot als Admin setzen (für Nachrichten-Zugriff)
3. Gruppe in Config erlauben:

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

### Mention-Requirement

In Gruppen nur auf Mentions reagieren:

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

## Benachrichtigungen

### Alert-Format

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

### Stille Benachrichtigungen

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

## Media-Support

### Charts senden

```bash
kit chart BTC/USDT --telegram
```

K.I.T. kann Charts als Bilder senden:

```
📈 BTC/USDT 4h Chart
[Chart-Bild]
RSI: 58 | MACD: Bullish
```

### Dokumente

Portfolio-Reports als Datei:

```bash
kit portfolio export --telegram
```

## Webhook-Modus (Optional)

Für bessere Performance bei hohem Traffic:

```json
{
  "telegram": {
    "mode": "webhook",
    "webhookUrl": "https://your-domain.com/telegram/webhook",
    "webhookPort": 8443
  }
}
```

## Fehlerbehebung

<AccordionGroup>
  <Accordion title="Bot antwortet nicht">
    1. Token korrekt?
    ```bash
    kit channels test telegram
    ```
    
    2. User in `allowFrom`?
    
    3. Bot-Status prüfen:
    ```bash
    kit channels status telegram
    ```
  </Accordion>
  
  <Accordion title="Keine Benachrichtigungen">
    1. Alert-Channel konfiguriert?
    2. Bot ist Admin im Channel?
    3. Notifications nicht stumm?
  </Accordion>
  
  <Accordion title="Buttons funktionieren nicht">
    Telegram-Version aktuell?
    Bot neu starten:
    ```bash
    kit channels restart telegram
    ```
  </Accordion>
</AccordionGroup>

## Sicherheit

<Tip>
**Best Practices:**
1. `allowFrom` immer setzen
2. Keine sensiblen Daten in Gruppen
3. Trade-Bestätigung aktivieren
4. Bot-Token geheim halten
</Tip>

## Nächste Schritte

<Columns>
  <Card title="Discord" href="/channels/discord" icon="message-circle">
    Discord-Integration einrichten.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Intelligente Alerts konfigurieren.
  </Card>
  <Card title="Erster Trade" href="/start/first-trade" icon="trending-up">
    Ersten Trade durchführen.
  </Card>
</Columns>
