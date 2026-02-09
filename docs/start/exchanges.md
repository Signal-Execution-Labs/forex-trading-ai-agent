---
summary: "Exchanges mit K.I.T. verbinden"
read_when:
  - Exchange-APIs einrichten
  - Neue Börse hinzufügen
title: "Exchanges verbinden"
---

# Exchanges verbinden

K.I.T. unterstützt alle großen Crypto-Exchanges und MetaTrader für Forex. Dieser Guide zeigt, wie du sie sicher verbindest.

## Unterstützte Exchanges

| Exchange | Typ | Features |
|----------|-----|----------|
| Binance | Crypto | Spot, Futures, Margin |
| Kraken | Crypto | Spot, Futures |
| Coinbase | Crypto | Spot |
| MetaTrader 4/5 | Forex | CFDs, Forex, Indizes |
| Bybit | Crypto | Spot, Derivatives |
| KuCoin | Crypto | Spot, Futures |
| OKX | Crypto | Spot, Derivatives |

## Quick Setup

<Steps>
  <Step title="Exchange auswählen">
    ```bash
    kit exchanges add
    ```
    
    Interaktiver Wizard zur Exchange-Auswahl.
  </Step>
  
  <Step title="API-Key erstellen">
    Erstelle einen API-Key auf der Exchange mit:
    - ✅ Lesen (Read)
    - ✅ Trading (Trade)
    - ❌ Withdrawal (NIEMALS!)
    
    Optional: IP-Whitelist für mehr Sicherheit.
  </Step>
  
  <Step title="Credentials speichern">
    ```bash
    kit exchanges add binance \
      --api-key "your_api_key" \
      --secret "your_api_secret"
    ```
    
    Die Credentials werden verschlüsselt in `~/.kit/exchanges/` gespeichert.
  </Step>
  
  <Step title="Verbindung testen">
    ```bash
    kit exchanges test binance
    ```
  </Step>
</Steps>

## Binance Setup

<AccordionGroup>
  <Accordion title="1. API-Key erstellen">
    1. Gehe zu [Binance API Management](https://www.binance.com/en/my/settings/api-management)
    2. Klicke "Create API"
    3. Wähle "System generated"
    4. Aktiviere:
       - ✅ Enable Reading
       - ✅ Enable Spot & Margin Trading
       - ✅ Enable Futures (optional)
    5. **WICHTIG:** Aktiviere NICHT "Enable Withdrawals"
    6. Optional: IP-Restriction hinzufügen
  </Accordion>
  
  <Accordion title="2. K.I.T. konfigurieren">
    ```bash
    kit exchanges add binance \
      --api-key "vmPUZE6mv9SD5VNHk4..." \
      --secret "NhqPtmdSJYdKjVHjA7PZj..."
    ```
    
    Oder manuell in `~/.kit/exchanges/binance.json`:
    ```json
    {
      "apiKey": "vmPUZE6mv9SD5VNHk4...",
      "apiSecret": "NhqPtmdSJYdKjVHjA7PZj...",
      "testnet": false,
      "options": {
        "defaultType": "spot",
        "adjustForTimeDifference": true
      }
    }
    ```
  </Accordion>
  
  <Accordion title="3. Testnet (Paper Trading)">
    Für risikofreies Testen:
    
    1. Gehe zu [Binance Testnet](https://testnet.binance.vision/)
    2. Erstelle Testnet API-Keys
    3. Konfiguriere mit `--testnet`:
    
    ```bash
    kit exchanges add binance \
      --testnet \
      --api-key "testnet_key" \
      --secret "testnet_secret"
    ```
  </Accordion>
</AccordionGroup>

## Kraken Setup

<AccordionGroup>
  <Accordion title="1. API-Key erstellen">
    1. Gehe zu [Kraken Security](https://www.kraken.com/u/security/api)
    2. Klicke "Add key"
    3. Setze Berechtigungen:
       - ✅ Query Funds
       - ✅ Query Open Orders & Trades
       - ✅ Query Closed Orders & Trades
       - ✅ Create & Modify Orders
       - ✅ Cancel/Close Orders
    4. **NICHT aktivieren:** Withdraw Funds
  </Accordion>
  
  <Accordion title="2. K.I.T. konfigurieren">
    ```bash
    kit exchanges add kraken \
      --api-key "KRAKEN_API_KEY" \
      --secret "KRAKEN_PRIVATE_KEY"
    ```
  </Accordion>
</AccordionGroup>

## Coinbase Setup

<AccordionGroup>
  <Accordion title="1. API-Key erstellen">
    1. Gehe zu [Coinbase API Settings](https://www.coinbase.com/settings/api)
    2. Klicke "New API Key"
    3. Wähle Wallets/Accounts
    4. Berechtigungen:
       - ✅ wallet:accounts:read
       - ✅ wallet:trades:create
       - ✅ wallet:trades:read
    5. NICHT: wallet:withdrawals
  </Accordion>
  
  <Accordion title="2. K.I.T. konfigurieren">
    ```bash
    kit exchanges add coinbase \
      --api-key "API_KEY" \
      --secret "API_SECRET"
    ```
  </Accordion>
</AccordionGroup>

## MetaTrader Setup

Für Forex und CFD-Trading über MetaTrader:

<AccordionGroup>
  <Accordion title="1. MT4/MT5 vorbereiten">
    1. Öffne MetaTrader
    2. Tools → Options → Expert Advisors
    3. Aktiviere:
       - ✅ Allow automated trading
       - ✅ Allow DLL imports
       - ✅ Allow WebRequest for listed URLs
    4. Füge K.I.T. Server-URL hinzu
  </Accordion>
  
  <Accordion title="2. K.I.T. Bridge installieren">
    ```bash
    kit exchanges add metatrader \
      --terminal-path "C:\Program Files\MetaTrader 5" \
      --account 12345678 \
      --server "YourBroker-Server"
    ```
    
    K.I.T. installiert automatisch den EA (Expert Advisor).
  </Accordion>
  
  <Accordion title="3. Verbindung testen">
    ```bash
    kit exchanges test metatrader
    
    # Output:
    ✅ MetaTrader 5 verbunden
    Account: 12345678
    Balance: €10,000.00
    Leverage: 1:30
    ```
  </Accordion>
</AccordionGroup>

## Multi-Exchange Setup

K.I.T. kann mehrere Exchanges gleichzeitig nutzen:

```json
{
  "exchanges": {
    "binance": {
      "enabled": true,
      "priority": 1,
      "pairs": ["BTC/USDT", "ETH/USDT"]
    },
    "kraken": {
      "enabled": true,
      "priority": 2,
      "pairs": ["BTC/EUR", "ETH/EUR"]
    },
    "metatrader": {
      "enabled": true,
      "priority": 1,
      "pairs": ["EURUSD", "GBPUSD"]
    }
  }
}
```

## Exchange-Befehle

```bash
# Alle Exchanges anzeigen
kit exchanges list

# Status prüfen
kit exchanges status

# Balance abrufen
kit exchanges balance binance

# Exchange deaktivieren
kit exchanges disable kraken

# Exchange entfernen
kit exchanges remove coinbase

# API-Key rotieren
kit exchanges rotate-key binance
```

## Sicherheits-Best-Practices

<Warning>
**NIEMALS Withdrawal-Berechtigungen aktivieren!**
K.I.T. benötigt keine Auszahlungsberechtigung.
</Warning>

<Tip>
**Sicherheits-Checkliste:**
1. ✅ Nur Read + Trade Berechtigungen
2. ✅ IP-Whitelist wenn möglich
3. ✅ 2FA auf Exchange aktiviert
4. ✅ API-Keys regelmäßig rotieren
5. ✅ Separate API-Keys für K.I.T.
6. ❌ KEINE Withdrawal-Berechtigung
</Tip>

## Fehlerbehebung

<AccordionGroup>
  <Accordion title="Invalid API Key">
    - API-Key korrekt kopiert? (keine Leerzeichen)
    - Berechtigungen ausreichend?
    - IP-Whitelist konfiguriert?
    
    ```bash
    kit exchanges test binance --verbose
    ```
  </Accordion>
  
  <Accordion title="Timestamp Fehler">
    ```bash
    kit config set exchanges.binance.options.adjustForTimeDifference true
    kit config set exchanges.binance.options.recvWindow 60000
    ```
  </Accordion>
  
  <Accordion title="Rate Limit Exceeded">
    K.I.T. handhabt Rate-Limits automatisch. Falls trotzdem Probleme:
    
    ```bash
    kit config set exchanges.binance.rateLimit 500
    ```
  </Accordion>
</AccordionGroup>

## Nächste Schritte

<Columns>
  <Card title="Erster Trade" href="/start/first-trade" icon="trending-up">
    Deinen ersten Trade durchführen.
  </Card>
  <Card title="Exchange Details" href="/exchanges/binance" icon="building">
    Detaillierte Exchange-Dokumentation.
  </Card>
  <Card title="API-Key Sicherheit" href="/security/api-keys" icon="shield">
    Best Practices für API-Keys.
  </Card>
</Columns>
