---
summary: "Signal Channel Setup for K.I.T."
read_when:
  - Set up Signal integration
  - Secure communication
title: "Signal"
---

# Signal

Signal provides end-to-end encrypted communication with K.I.T. — ideal for maximum privacy.

<Info>
Signal integration uses signal-cli or a local Signal instance. No official bot API available.
</Info>

## Prerequisites

- Dedicated phone number for K.I.T.
- [signal-cli](https://github.com/AsamK/signal-cli) installed
- Java Runtime

## Installation

### Install signal-cli

<Tabs>
  <Tab title="Linux">
    ```bash
    # Download latest version
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
    # Download manually and add to PATH
    # https://github.com/AsamK/signal-cli/releases
    ```
  </Tab>
</Tabs>

### Register Signal Number

```bash
# Get captcha token (if needed)
# https://signalcaptchas.org/registration/generate.html

# Register number
signal-cli -u +11234567890 register --captcha "captcha-token"

# Verify
signal-cli -u +11234567890 verify CODE
```

## Setup

<Steps>
  <Step title="Check Signal-CLI">
    ```bash
    signal-cli -u +11234567890 receive
    ```
  </Step>
  
  <Step title="Configure K.I.T.">
    ```bash
    kit channels add signal --number "+11234567890"
    ```
    
    Or in config:
    ```json
    {
      "channels": {
        "signal": {
          "enabled": true,
          "number": "+11234567890",
          "signalCliPath": "/usr/local/bin/signal-cli"
        }
      }
    }
    ```
  </Step>
  
  <Step title="Start channel">
    ```bash
    kit channels start signal
    ```
  </Step>
</Steps>

## Configuration

### Basic Configuration

```json
{
  "channels": {
    "signal": {
      "enabled": true,
      "number": "+11234567890",
      "signalCliPath": "/usr/local/bin/signal-cli",
      "configPath": "~/.local/share/signal-cli",
      "allowFrom": ["+11111111111", "+12222222222"],
      "trustAllKeys": false
    }
  }
}
```

### Group Support

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

### End-to-End Encryption

All messages are encrypted by default. K.I.T. does not permanently store decrypted messages.

### Disappearing Messages

```json
{
  "signal": {
    "disappearingMessages": {
      "enabled": true,
      "timeout": 86400  // 24 hours
    }
  }
}
```

### Reactions

K.I.T. can react to messages:

```json
{
  "signal": {
    "useReactions": true,
    "confirmReaction": "✅",
    "errorReaction": "❌"
  }
}
```

## Commands

Same commands as other channels:

```
portfolio
buy BTC 100
sell ETH 0.5
analyze SOL
alert BTC > 70000
```

## Attachments

K.I.T. can send images and documents:

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

## Daemon Mode

For permanent operation:

```bash
# signal-cli as daemon
signal-cli -u +11234567890 daemon --socket /tmp/signal-cli.socket

# K.I.T. with socket
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

## Security

### Key Verification

```json
{
  "signal": {
    "trustAllKeys": false,
    "trustedKeys": {
      "+11111111111": "safety-number-or-fingerprint"
    }
  }
}
```

### Verified Contacts Only

```json
{
  "signal": {
    "requireVerified": true
  }
}
```

## Troubleshooting

<AccordionGroup>
  <Accordion title="signal-cli error">
    ```bash
    # Check logs
    signal-cli -u +11234567890 --verbose receive
    
    # Repair database
    signal-cli -u +11234567890 updateAccount
    ```
  </Accordion>
  
  <Accordion title="Not receiving messages">
    1. Number verified?
    2. signal-cli daemon running?
    3. Sender in `allowFrom`?
    
    ```bash
    kit channels test signal
    ```
  </Accordion>
  
  <Accordion title="Rate Limiting">
    Signal has rate limits. If too many messages:
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

## Limitations

<Warning>
**Signal Limitations:**
- No inline buttons (text only)
- No rich embeds
- Rate limiting
- Requires dedicated number
- signal-cli sometimes unstable
</Warning>

## Alternatives

If Signal is too complex:
- **Telegram**: Easier bot API, more features
- **Discord**: For communities
- **Matrix**: Open source, self-hosted

## Next Steps

<Columns>
  <Card title="Telegram" href="/channels/telegram" icon="send">
    Easier alternative.
  </Card>
  <Card title="Security" href="/security/api-keys" icon="shield">
    Security best practices.
  </Card>
  <Card title="Alert System" href="/skills/alert-system" icon="bell">
    Configure alerts.
  </Card>
</Columns>
