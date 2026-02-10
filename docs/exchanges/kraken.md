---
summary: "Kraken Exchange Setup"
read_when:
  - Connect Kraken to K.I.T.
  - Configure Kraken API
title: "Kraken"
---

# Kraken Setup

Connect your Kraken account to K.I.T. for cryptocurrency trading.

## Supported Features

| Feature | Spot | Futures | Status |
|---------|------|---------|--------|
| Market Orders | ✅ | ✅ | Stable |
| Limit Orders | ✅ | ✅ | Stable |
| Stop-Loss | ✅ | ✅ | Stable |
| Portfolio Sync | ✅ | ✅ | Stable |
| Price Streams | ✅ | ✅ | Stable |

## Quick Setup

### 1. Create API Key

1. Log in to [Kraken](https://www.kraken.com)
2. Go to **Settings** → **API**
3. Click **Generate New Key**
4. Enter a key name (e.g., "K.I.T. Trading Bot")
5. Configure permissions (see below)
6. **Save your API Key and Private Key**

### 2. Configure Permissions

Enable these permissions:
- ✅ **Query Funds**
- ✅ **Query Open Orders & Trades**
- ✅ **Query Closed Orders & Trades**
- ✅ **Create & Modify Orders**
- ✅ **Cancel/Close Orders**
- ❌ **Withdraw Funds** (NOT recommended)
- ❌ **Export Data** (not needed)

### 3. Add to K.I.T.

#### Via CLI

```bash
kit connect kraken
# Follow the prompts
```

#### Via Environment Variables

```bash
# .env
KRAKEN_API_KEY=your_api_key
KRAKEN_SECRET=your_private_key
```

#### Via Config File

```json
{
  "exchanges": {
    "kraken": {
      "apiKey": "your_api_key",
      "secret": "your_private_key"
    }
  }
}
```

## Test Connection

```bash
kit test-connection kraken
```

## Trading Commands

```bash
# Buy crypto
kit buy BTC/USD 100 --exchange kraken

# Sell crypto
kit sell ETH/USD 0.5 --exchange kraken

# Check balance
kit balance kraken
```

## Kraken-Specific Notes

- Uses USD (not USDT) for fiat pairs
- API pairs use X prefix (XXBT, XETH) - K.I.T. handles this automatically
- 2FA is separate from API authentication

## Troubleshooting

<AccordionGroup>
  <Accordion title="Invalid Nonce">
    Kraken requires increasing nonces. If you see this error:
    1. Wait a few seconds
    2. Check system time is accurate
    3. Regenerate API key if persistent
  </Accordion>
  
  <Accordion title="Permission Denied">
    Verify API key has required permissions in Kraken settings.
  </Accordion>
</AccordionGroup>

## Related

- [Exchange Connector](/skills/exchange-connector)
- [API Keys Security](/security/api-keys)
