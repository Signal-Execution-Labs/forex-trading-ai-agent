---
summary: "Install and set up K.I.T."
read_when:
  - First installation of K.I.T.
  - Reinstallation or update
title: "Installation"
---

# Installation

Goal: Get K.I.T. from zero to running in minutes.

<Info>
Fastest way to trading: Start with demo mode without real exchange connection.
```bash
kit demo
```
</Info>

## Prerequisites

- **Node.js 18** or newer (22+ recommended)
- **npm** or **yarn**
- **Git** (optional, for development)

<Tip>
Check your Node version with `node --version`.
</Tip>

## Installation

<Steps>
  <Step title="Install K.I.T. globally">
    <Tabs>
      <Tab title="npm">
        ```bash
        npm install -g kit-trading@latest
        ```
      </Tab>
      <Tab title="yarn">
        ```bash
        yarn global add kit-trading@latest
        ```
      </Tab>
      <Tab title="From Source">
        ```bash
        git clone https://github.com/kayzaa/k.i.t.-bot.git
        cd k.i.t.-bot
        npm install
        npm link
        ```
      </Tab>
    </Tabs>
  </Step>
  
  <Step title="Verify installation">
    ```bash
    kit --version
    kit doctor
    ```
  </Step>
  
  <Step title="Initial configuration">
    ```bash
    kit init
    ```
    
    The wizard guides you through:
    - API key configuration (Anthropic/OpenAI)
    - Exchange selection
    - Channel configuration
  </Step>
</Steps>

## System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 2 GB | 4 GB |
| Disk | 500 MB | 2 GB |
| CPU | 2 Cores | 4 Cores |
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Latest |

## Directory Structure

After installation:

```
~/.kit/
├── config.json          # Main configuration
├── exchanges/           # Exchange credentials (encrypted)
├── strategies/          # Your trading strategies
├── logs/                # Log files
├── data/                # Market data cache
└── backtest/            # Backtesting results
```

## Environment Variables

<Tabs>
  <Tab title="Windows (PowerShell)">
    ```powershell
    $env:KIT_HOME = "C:\Users\YourName\.kit"
    $env:ANTHROPIC_API_KEY = "sk-ant-..."
    ```
  </Tab>
  <Tab title="Linux/macOS">
    ```bash
    export KIT_HOME="$HOME/.kit"
    export ANTHROPIC_API_KEY="sk-ant-..."
    ```
  </Tab>
</Tabs>

## Docker (Alternative)

```bash
docker pull binaryfaster/kit:latest
docker run -d \
  -v ~/.kit:/root/.kit \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  --name kit \
  binaryfaster/kit:latest
```

## Troubleshooting

<AccordionGroup>
  <Accordion title="npm install fails">
    ```bash
    # Clear cache
    npm cache clean --force
    
    # With admin rights (Windows)
    npm install -g kit-trading --force
    ```
  </Accordion>
  
  <Accordion title="kit command not found">
    ```bash
    # Check npm bin directory
    npm config get prefix
    
    # Add to PATH (Linux/macOS)
    export PATH="$(npm config get prefix)/bin:$PATH"
    ```
  </Accordion>
  
  <Accordion title="Permission denied">
    ```bash
    # Linux/macOS: install without sudo
    npm config set prefix ~/.npm-global
    export PATH=~/.npm-global/bin:$PATH
    npm install -g kit-trading
    ```
  </Accordion>
</AccordionGroup>

## Next Steps

<Columns>
  <Card title="Configuration" href="/start/configuration" icon="settings">
    Customize K.I.T. for your needs.
  </Card>
  <Card title="Connect Exchanges" href="/start/exchanges" icon="link">
    Set up exchange APIs.
  </Card>
  <Card title="First Trade" href="/start/first-trade" icon="trending-up">
    Execute your first trade.
  </Card>
</Columns>

## Uninstallation

```bash
npm uninstall -g kit-trading
rm -rf ~/.kit  # Delete configuration (optional)
```

<Warning>
Deleting `~/.kit` removes all configurations, strategies, and cached data.
</Warning>
