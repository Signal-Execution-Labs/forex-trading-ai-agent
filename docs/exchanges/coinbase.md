---
summary: "Coinbase Exchange Setup"
read_when:
  - Connect Coinbase to K.I.T.
  - Configure Coinbase API
title: "Coinbase"
---

# Coinbase Setup

Connect your Coinbase (Advanced Trade) account to K.I.T. for cryptocurrency trading.

## Supported Features

| Feature | Status |
|---------|--------|
| Market Orders | ✅ Stable |
| Limit Orders | ✅ Stable |
| Stop-Loss | ✅ Stable |
| Portfolio Sync | ✅ Stable |
| Price Streams | ✅ Stable |

## Quick Setup

### 1. Create API Key

1. Log in to [Coinbase](https://www.coinbase.com)
2. Go to **Settings** → **API**
3. Click **New API Key**
4. Select portfolio (usually "Default")
5. Configure permissions
6. Complete 2FA verification
7. **Save API Key, Secret, and Passphrase**

### 2. Configure Permissions

Required permissions:
- ✅ **View** - Read account info
- ✅ **Trade** - Execute trades
- ✅ **Transfer** - Transfer between portfolios (optional)
- ❌ **Withdraw** - NOT recommended

### 3. Add to K.I.T.

#### Via CLI

```bash
kit connect coinbase
```

#### Via Environment Variables

```bash
# .env
COINBASE_API_KEY=your_api_key
COINBASE_SECRET=your_secret
COINBASE_PASSPHRASE=your_passphrase
```

<Warning>
Coinbase requires a passphrase in addition to API key and secret.
</Warning>

## Test Connection

```bash
kit test-connection coinbase
```

## Trading Commands

```bash
# Buy crypto
kit buy BTC/USD 100 --exchange coinbase

# Sell crypto
kit sell ETH/USD 0.5 --exchange coinbase

# Check balance
kit balance coinbase
```

## Coinbase-Specific Notes

- Uses Coinbase Advanced Trade API
- Passphrase is required (you set it during key creation)
- Lower fees than standard Coinbase

## Troubleshooting

<AccordionGroup>
  <Accordion title="Invalid Passphrase">
    The passphrase is set when creating the API key. If forgotten, create a new key.
  </Accordion>
  
  <Accordion title="Insufficient Funds">
    Ensure funds are in the correct portfolio (Default vs. Trading).
  </Accordion>
</AccordionGroup>

## Related

- [Exchange Connector](/skills/exchange-connector)
- [API Keys Security](/security/api-keys)
