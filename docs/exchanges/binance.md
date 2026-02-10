---
summary: "Binance Exchange Setup"
read_when:
  - Connect Binance to K.I.T.
  - Configure Binance API
title: "Binance"
---

# Binance Setup

Connect your Binance account to K.I.T. for cryptocurrency trading.

## Supported Features

| Feature | Spot | Futures | Status |
|---------|------|---------|--------|
| Market Orders | ✅ | ✅ | Stable |
| Limit Orders | ✅ | ✅ | Stable |
| Stop-Loss | ✅ | ✅ | Stable |
| Portfolio Sync | ✅ | ✅ | Stable |
| Price Streams | ✅ | ✅ | Stable |
| Margin Trading | ✅ | N/A | Beta |

## Quick Setup

### 1. Create API Key

1. Log in to [Binance](https://www.binance.com)
2. Go to **Account** → **API Management**
3. Click **Create API**
4. Choose **System generated**
5. Complete 2FA verification
6. **Save your API Key and Secret** (shown only once!)

### 2. Configure Permissions

Enable these permissions:
- ✅ **Enable Reading**
- ✅ **Enable Spot & Margin Trading**
- ✅ **Enable Futures** (if using futures)
- ❌ **Enable Withdrawals** (NOT recommended)

<Warning>
**Never enable withdrawals.** K.I.T. doesn't need withdrawal permissions. Keeping it disabled protects your funds even if API keys are compromised.
</Warning>

### 3. IP Restrictions (Recommended)

For maximum security, restrict API access to your IP:

1. Click **Edit restrictions**
2. Select **Restrict access to trusted IPs only**
3. Add your server/home IP address

### 4. Add to K.I.T.

#### Via CLI

```bash
kit connect binance
# Follow the prompts for API key and secret
```

Or with flags:

```bash
kit connect binance --api-key YOUR_KEY --secret YOUR_SECRET
```

#### Via Environment Variables

```bash
# .env
BINANCE_API_KEY=your_api_key_here
BINANCE_SECRET=your_secret_here
BINANCE_SANDBOX=false
```

#### Via Config File

```json
{
  "exchanges": {
    "binance": {
      "apiKey": "your_api_key",
      "secret": "your_secret",
      "sandbox": false,
      "options": {
        "defaultType": "spot",
        "adjustForTimeDifference": true
      }
    }
  }
}
```

## Test Connection

```bash
kit test-connection binance
```

Expected output:
```
✅ Binance Connection Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
API Key:      ****abc123
Permissions:  Reading, Spot Trading
IP Allowed:   All (consider restricting!)

Balance:
  USDT:  $1,250.00
  BTC:   0.05 ($3,362.50)
  ETH:   1.2 ($3,024.00)
  
Total: $7,636.50
```

## Sandbox/Testnet

Use Binance Testnet for paper trading:

```bash
# Enable sandbox mode
kit connect binance --sandbox

# Or via environment
BINANCE_SANDBOX=true
```

Get testnet API keys at: https://testnet.binance.vision

## Trading Commands

### Basic Trading

```bash
# Buy BTC with $100
kit buy BTC/USDT 100 --exchange binance

# Sell 0.01 BTC
kit sell BTC/USDT 0.01 --exchange binance

# Limit order
kit buy BTC/USDT 100 --price 65000 --exchange binance
```

### Check Balance

```bash
kit balance binance
kit balance binance --asset BTC
```

### View Orders

```bash
kit orders binance
kit orders binance --open
kit orders binance --history
```

## Futures Trading

### Enable Futures

```json
{
  "exchanges": {
    "binance": {
      "options": {
        "defaultType": "future"
      }
    }
  }
}
```

### Futures Commands

```bash
# Open long position
kit futures long BTC/USDT 0.01 --leverage 10

# Open short position
kit futures short BTC/USDT 0.01 --leverage 5

# Close position
kit futures close BTC/USDT

# Set leverage
kit futures leverage BTC/USDT 20
```

## Rate Limits

Binance has API rate limits. K.I.T. handles them automatically:

| Endpoint | Limit | K.I.T. Handling |
|----------|-------|----------------|
| Orders | 10/sec | Queue + throttle |
| Weight | 1200/min | Automatic backoff |
| WebSocket | 5 msgs/sec | Batching |

## Troubleshooting

<AccordionGroup>
  <Accordion title="Invalid API Key">
    - Check key is copied correctly (no spaces)
    - Verify key is enabled in Binance
    - Check IP restrictions
  </Accordion>
  
  <Accordion title="Insufficient Balance">
    - Verify funds in correct account (spot vs futures)
    - Check if funds are in open orders
    - Transfer between accounts if needed
  </Accordion>
  
  <Accordion title="Order Rejected">
    Common reasons:
    - Min order size not met ($10 for most pairs)
    - Price too far from market (limit orders)
    - Insufficient margin (futures)
  </Accordion>
  
  <Accordion title="Connection Timeout">
    - Check internet connection
    - Try different Binance endpoint
    - Check Binance status: https://www.binance.com/en/support/announcement
  </Accordion>
</AccordionGroup>

## Best Practices

1. **Use Testnet First** - Practice before real money
2. **Start Small** - Begin with small trades
3. **Enable 2FA** - Always use two-factor authentication
4. **Restrict IP** - Limit API to known IPs
5. **No Withdrawals** - Never enable withdrawal permission
6. **Regular Key Rotation** - Change API keys periodically

## Related

- [Exchange Connector](/skills/exchange-connector) - Full exchange documentation
- [API Keys Security](/security/api-keys) - Security best practices
- [Portfolio Tracker](/skills/portfolio-tracker) - Track across exchanges

---

<Tip>
**Pro Tip:** Use Binance's "Trusted Network" feature to allow API access only from specific networks for maximum security.
</Tip>
