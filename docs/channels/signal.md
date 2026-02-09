---
summary: "Signal Channel Setup für K.I.T."
read_when:
  - Signal-Integration einrichten
  - Sichere Kommunikation
title: "Signal"
---

# Signal

Signal bietet Ende-zu-Ende-verschlüsselte Kommunikation mit K.I.T. — ideal für maximale Privatsphäre.

<Info>
Signal-Integration nutzt signal-cli oder eine lokale Signal-Instanz. Kein offizieller Bot-API verfügbar.
</Info>

## Voraussetzungen

- Dedizierte Telefonnummer für K.I.T.
- [signal-cli](https://github.com/AsamK/signal-cli) installiert
- Java Runtime

## Installation

### signal-cli installieren

<Tabs>
  <Tab title="Linux">
    ```bash
    # Aktuellste Version herunterladen
    wget https://github.com/AsamK/signal-cli/releases/download/v0.12.0/signal-cli-0.12.0-Linux.tar.gz
    tar -xzf signal-cli-0.12.0-Linux.tar.gz
    sudo mv signal-cli-0.12.0/bin/signal-cli /usr/local/bin/
    ```
  </Tab>
  
  <Tab title="macOS">
    ```bash
    brew install signal-cli
    ```
  </Tab>
  
  <Tab title="Windows">
    ```powershell
    # Manuell herunterladen und in PATH
    # https://github.com/AsamK/signal-cli/releases
    ```
  </Tab>
</Tabs>

### Signal-Nummer registrieren

```bash
# Captcha-Token holen (falls nötig)
# https://signalcaptchas.org/registration/generate.html

# Nummer registrieren
signal-cli -u +491234567890 register --captcha "captcha-token"

# Verifizieren
signal-cli -u +491234567890 verify CODE
```

## Setup

<Steps>
  <Step title="Signal-CLI prüfen">
    ```bash
    signal-cli -u +491234567890 receive
    ```
  </Step>
  
  <Step title="K.I.T. konfigurieren">
    ```bash
    kit channels add signal --number "+491234567890"
    ```
    
    Oder in Config:
    ```json
    {
      "channels": {
        "signal": {
          "enabled": true,
          "number": "+491234567890",
          "signalCliPath": "/usr/local/bin/signal-cli"
        }
      }
    }
    ```
  </Step>
  
  <Step title="Kanal starten">
    ```bash
    kit channels start signal
    ```
  </Step>
</Steps>

## Konfiguration

### Basis-Konfiguration

```json
{
  "channels": {
    "signal": {
      "enabled": true,
      "number": "+491234567890",
      "signalCliPath": "/usr/local/bin/signal-cli",
      "configPath": "~/.local/share/signal-cli",
      "allowFrom": ["+491111111111", "+492222222222"],
      "trustAllKeys": false
    }
  }
}
```

### Gruppen-Support

```json
{
  "signal": {
    "allowGroups": true,
    "groups": {
      "base64-group-id": {
        "name": "Trading Group",
        "requireMention": true,
        "allowedCommands": ["analyze", "portfolio"]
      }
    }
  }
}
```

## Features

### Ende-zu-Ende-Verschlüsselung

Alle Nachrichten sind standardmäßig verschlüsselt. K.I.T. speichert keine entschlüsselten Nachrichten permanent.

### Disappearing Messages

```json
{
  "signal": {
    "disappearingMessages": {
      "enabled": true,
      "timeout": 86400  // 24 Stunden
    }
  }
}
```

### Reactions

K.I.T. kann auf Nachrichten reagieren:

```json
{
  "signal": {
    "useReactions": true,
    "confirmReaction": "✅",
    "errorReaction": "❌"
  }
}
```

## Befehle

Gleiche Befehle wie bei anderen Channels:

```
portfolio
buy BTC 100
sell ETH 0.5
analyze SOL
alert BTC > 70000
```

## Attachments

K.I.T. kann Bilder und Dokumente senden:

```json
{
  "signal": {
    "attachments": {
      "charts": true,
      "reports": true,
      "maxSize": 5242880  // 5 MB
    }
  }
}
```

## Daemon-Modus

Für permanenten Betrieb:

```bash
# signal-cli als Daemon
signal-cli -u +491234567890 daemon --socket /tmp/signal-cli.socket

# K.I.T. mit Socket
kit channels start signal --socket /tmp/signal-cli.socket
```

```json
{
  "signal": {
    "mode": "socket",
    "socketPath": "/tmp/signal-cli.socket"
  }
}
```

## Sicherheit

### Key-Verification

```json
{
  "signal": {
    "trustAllKeys": false,
    "trustedKeys": {
      "+491111111111": "safety-number-or-fingerprint"
    }
  }
}
```

### Nur verifizierte Kontakte

```json
{
  "signal": {
    "requireVerified": true
  }
}
```

## Fehlerbehebung

<AccordionGroup>
  <Accordion title="signal-cli Fehler">
    ```bash
    # Logs prüfen
    signal-cli -u +491234567890 --verbose receive
    
    # Datenbank reparieren
    signal-cli -u +491234567890 updateAccount
    ```
  </Accordion>
  
  <Accordion title="Keine Nachrichten empfangen">
    1. Nummer verifiziert?
    2. signal-cli Daemon läuft?
    3. Absender in `allowFrom`?
    
    ```bash
    kit channels test signal
    ```
  </Accordion>
  
  <Accordion title="Rate Limiting">
    Signal hat Rate-Limits. Bei zu vielen Nachrichten:
    ```json
    {
      "signal": {
        "rateLimit": {
          "messagesPerMinute": 20,
          "delayMs": 500
        }
      }
    }
    ```
  </Accordion>
</AccordionGroup>

## Einschränkungen

<Warning>
**Signal-Einschränkungen:**
- Keine Inline-Buttons (nur Text)
- Keine Rich-Embeds
- Rate-Limiting
- Benötigt dedizierte Nummer
- signal-cli manchmal instabil
</Warning>

## Alternativen

Wenn Signal zu komplex:
- **Telegram**: Einfacherer Bot-API, mehr Features
- **Discord**: Für Communities
- **Matrix**: Open Source, selbst-gehostet

## Nächste Schritte

<Columns>
  <Card title="Telegram" href="/channels/telegram" icon="send">
    Einfachere Alternative.
  </Card>
  <Card title="Sicherheit" href="/security/api-keys" icon="shield">
    Security Best Practices.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Alerts konfigurieren.
  </Card>
</Columns>
