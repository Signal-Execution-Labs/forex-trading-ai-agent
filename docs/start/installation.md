---
summary: "K.I.T. installieren und einrichten"
read_when:
  - Erste Installation von K.I.T.
  - Neuinstallation oder Update
title: "Installation"
---

# Installation

Ziel: K.I.T. von Null auf lauffähig in wenigen Minuten.

<Info>
Schnellster Weg zum Trading: Starte mit dem Demo-Modus ohne echte Exchange-Verbindung.
```bash
kit demo
```
</Info>

## Voraussetzungen

- **Node.js 22** oder neuer
- **npm** oder **yarn**
- **Git** (optional, für Entwicklung)

<Tip>
Prüfe deine Node-Version mit `node --version`.
</Tip>

## Installation

<Steps>
  <Step title="K.I.T. global installieren">
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
      <Tab title="Aus Source">
        ```bash
        git clone https://github.com/binaryfaster/kit-bot.git
        cd kit-bot
        npm install
        npm link
        ```
      </Tab>
    </Tabs>
  </Step>
  
  <Step title="Installation prüfen">
    ```bash
    kit --version
    kit doctor
    ```
  </Step>
  
  <Step title="Erstkonfiguration">
    ```bash
    kit init
    ```
    
    Der Wizard führt dich durch:
    - API-Key Konfiguration (Anthropic/OpenAI)
    - Exchange-Auswahl
    - Channel-Konfiguration
  </Step>
</Steps>

## Systemanforderungen

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| RAM | 2 GB | 4 GB |
| Disk | 500 MB | 2 GB |
| CPU | 2 Cores | 4 Cores |
| OS | Windows 10, macOS 10.15, Ubuntu 20.04 | Aktuell |

## Verzeichnisstruktur

Nach der Installation:

```
~/.kit/
├── config.json          # Hauptkonfiguration
├── exchanges/           # Exchange-Credentials (verschlüsselt)
├── strategies/          # Deine Trading-Strategien
├── logs/                # Log-Dateien
├── data/                # Marktdaten-Cache
└── backtest/            # Backtesting-Ergebnisse
```

## Umgebungsvariablen

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

## Fehlerbehebung

<AccordionGroup>
  <Accordion title="npm install schlägt fehl">
    ```bash
    # Cache leeren
    npm cache clean --force
    
    # Mit Adminrechten (Windows)
    npm install -g kit-trading --force
    ```
  </Accordion>
  
  <Accordion title="kit command not found">
    ```bash
    # npm bin-Verzeichnis prüfen
    npm config get prefix
    
    # PATH ergänzen (Linux/macOS)
    export PATH="$(npm config get prefix)/bin:$PATH"
    ```
  </Accordion>
  
  <Accordion title="Permission denied">
    ```bash
    # Linux/macOS: ohne sudo installieren
    npm config set prefix ~/.npm-global
    export PATH=~/.npm-global/bin:$PATH
    npm install -g kit-trading
    ```
  </Accordion>
</AccordionGroup>

## Nächste Schritte

<Columns>
  <Card title="Konfiguration" href="/start/configuration" icon="settings">
    K.I.T. für deine Bedürfnisse anpassen.
  </Card>
  <Card title="Exchanges verbinden" href="/start/exchanges" icon="link">
    Börsen-APIs einrichten.
  </Card>
  <Card title="Erster Trade" href="/start/first-trade" icon="trending-up">
    Deinen ersten Trade durchführen.
  </Card>
</Columns>

## Deinstallation

```bash
npm uninstall -g kit-trading
rm -rf ~/.kit  # Konfiguration löschen (optional)
```

<Warning>
Das Löschen von `~/.kit` entfernt alle Konfigurationen, Strategien und gecachte Daten.
</Warning>
