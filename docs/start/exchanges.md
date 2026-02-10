---
summary: "Connect exchanges with K.I.T."
read_when:
  - Set up exchange APIs
  - Add new exchange
title: "Connect Exchanges"
---

# Connect Exchanges

K.I.T. supports all major crypto exchanges and MetaTrader for Forex. This guide shows how to connect them securely.

## Supported Exchanges

| Exchange | Type | Features |
|----------|------|----------|
| Binance | Crypto | Spot, Futures, Margin |
| Kraken | Crypto | Spot, Futures |
| Coinbase | Crypto | Spot |
| MetaTrader 4/5 | Forex | CFDs, Forex, Indices |
| Bybit | Crypto | Spot, Derivatives |
| KuCoin | Crypto | Spot, Futures |
| OKX | Crypto | Spot, Derivatives |

## Quick Setup

<Steps>
  <Step title="Select exchange">
    ```bash
    kit exchanges add
    ```
    
    Interactive wizard for exchange selection.
  </Step>
  
  <Step title="Create API key">
    Create an API key on the exchange with:
    - ✅ Read
    - ✅ Trading (Trade)
    - ❌ Withdrawal (NEVER!)
    
    Optional: IP whitelist for more security.
  </Step>
  
  <Step title="Save credentials">
    ```bash
    kit exchanges add binance \
      --api-key "your_api_key" \
      --secret "your_api_secret"
    ```
    
    Credentials are stored encrypted in `~/.kit/exchanges/`.
  </Step>
  
  <Step title="Test connection">
    ```bash
    kit exchanges test binance
    ```
  </Step>
</Steps>

## Binance Setup

<AccordionGroup>
  <Accordion title="1. Create API key">
    1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
    2. Click "Create API"
    3. Choose "System generated"
    4. Enable:
       - ✅ Enable Reading
       - ✅ Enable Spot & Margin Trading
       - ✅ Enable Futures (optional)
    5. **IMPORTANT:** Do NOT enable "Enable Withdrawals"
    6. Optional: Add IP restriction
  </Accordion>
  
  <Accordion title="2. Configure K.I.T.">
    ```bash
    kit exchanges add binance \
      --api-key "vmPUZE6mv9SD5VNHk4..." \
      --secret "NhqPtmdSJYdKjVHjA7PZj..."
    ```
    
    Or manually in `~/.kit/exchanges/binance.json`:
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
    For risk-free testing:
    
    1. Go to [Binance Testnet](https://testnet.binance.vision/)
    2. Create testnet API keys
    3. Configure with `--testnet`:
    
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
  <Accordion title="1. Create API key">
    1. Go to [Kraken Security](https://www.kraken.com/u/security/api)
    2. Click "Add key"
    3. Set permissions:
       - ✅ Query Funds
       - ✅ Query Open Orders & Trades
       - ✅ Query Closed Orders & Trades
       - ✅ Create & Modify Orders
       - ✅ Cancel/Close Orders
    4. **NOT enable:** Withdraw Funds
  </Accordion>
  
  <Accordion title="2. Configure K.I.T.">
    ```bash
    kit exchanges add kraken \
      --api-key "KRAKEN_API_KEY" \
      --secret "KRAKEN_PRIVATE_KEY"
    ```
  </Accordion>
</AccordionGroup>

## Coinbase Setup

<AccordionGroup>
  <Accordion title="1. Create API key">
    1. Go to [Coinbase API Settings](https://www.coinbase.com/settings/api)
    2. Click "New API Key"
    3. Select wallets/accounts
    4. Permissions:
       - ✅ wallet:accounts:read
       - ✅ wallet:trades:create
       - ✅ wallet:trades:read
    5. NOT: wallet:withdrawals
  </Accordion>
  
  <Accordion title="2. Configure K.I.T.">
    ```bash
    kit exchanges add coinbase \
      --api-key "API_KEY" \
      --secret "API_SECRET"
    ```
  </Accordion>
</AccordionGroup>

## MetaTrader Setup

For Forex and CFD trading via MetaTrader:

<AccordionGroup>
  <Accordion title="1. Prepare MT4/MT5">
    1. Open MetaTrader
    2. Tools → Options → Expert Advisors
    3. Enable:
       - ✅ Allow automated trading
       - ✅ Allow DLL imports
       - ✅ Allow WebRequest for listed URLs
    4. Add K.I.T. server URL
  </Accordion>
  
  <Accordion title="2. Install K.I.T. Bridge">
    ```bash
    kit exchanges add metatrader \
      --terminal-path "C:\Program Files\MetaTrader 5" \
      --account 12345678 \
      --server "YourBroker-Server"
    ```
    
    K.I.T. automatically installs the EA (Expert Advisor).
  </Accordion>
  
  <Accordion title="3. Test connection">
    ```bash
    kit exchanges test metatrader
    
    # Output:
    ✅ MetaTrader 5 connected
    Account: 12345678
    Balance: €10,000.00
    Leverage: 1:30
    ```
  </Accordion>
</AccordionGroup>

## Multi-Exchange Setup

K.I.T. can use multiple exchanges simultaneously:

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

## Exchange Commands

```bash
# Show all exchanges
kit exchanges list

# Check status
kit exchanges status

# Get balance
kit exchanges balance binance

# Disable exchange
kit exchanges disable kraken

# Remove exchange
kit exchanges remove coinbase

# Rotate API key
kit exchanges rotate-key binance
```

## Security Best Practices

<Warning>
**NEVER enable withdrawal permissions!**
K.I.T. does not need withdrawal permissions.
</Warning>

<Tip>
**Security Checklist:**
1. ✅ Only Read + Trade permissions
2. ✅ IP whitelist if possible
3. ✅ 2FA enabled on exchange
4. ✅ Rotate API keys regularly
5. ✅ Separate API keys for K.I.T.
6. ❌ NO withdrawal permission
</Tip>

## Troubleshooting

<AccordionGroup>
  <Accordion title="Invalid API Key">
    - API key copied correctly? (no spaces)
    - Permissions sufficient?
    - IP whitelist configured?
    
    ```bash
    kit exchanges test binance --verbose
    ```
  </Accordion>
  
  <Accordion title="Timestamp Error">
    ```bash
    kit config set exchanges.binance.options.adjustForTimeDifference true
    kit config set exchanges.binance.options.recvWindow 60000
    ```
  </Accordion>
  
  <Accordion title="Rate Limit Exceeded">
    K.I.T. handles rate limits automatically. If still problems:
    
    ```bash
    kit config set exchanges.binance.rateLimit 500
    ```
  </Accordion>
</AccordionGroup>

## Next Steps

<Columns>
  <Card title="First Trade" href="/start/first-trade" icon="trending-up">
    Execute your first trade.
  </Card>
  <Card title="Exchange Details" href="/exchanges/binance" icon="building">
    Detailed exchange documentation.
  </Card>
  <Card title="API Key Security" href="/security/api-keys" icon="shield">
    Best practices for API keys.
  </Card>
</Columns>
