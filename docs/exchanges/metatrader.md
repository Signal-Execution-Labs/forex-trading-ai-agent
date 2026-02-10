---
summary: "MetaTrader 4/5 Setup for Forex Trading"
read_when:
  - Connect MT4/MT5 to K.I.T.
  - Trade Forex with K.I.T.
title: "MetaTrader"
---

# MetaTrader Setup

Connect MetaTrader 4 or 5 to K.I.T. for Forex and CFD trading.

<Warning>
**Windows Only:** MetaTrader integration requires Windows with MT5 installed. For Linux/macOS, use a Windows VPS.
</Warning>

## Supported Features

| Feature | MT4 | MT5 | Status |
|---------|-----|-----|--------|
| Market Orders | ✅ | ✅ | Stable |
| Limit Orders | ✅ | ✅ | Stable |
| Stop-Loss | ✅ | ✅ | Stable |
| Take-Profit | ✅ | ✅ | Stable |
| Position Sync | ✅ | ✅ | Stable |
| Multi-Account | ❌ | ✅ | Stable |

## Supported Brokers

K.I.T. works with any MT4/MT5 broker:

| Broker | Recommended |
|--------|-------------|
| RoboForex | ⭐⭐⭐ |
| IC Markets | ⭐⭐⭐ |
| Pepperstone | ⭐⭐ |
| XM | ⭐⭐ |
| OANDA | ⭐⭐ |

## Quick Setup

### 1. Install MetaTrader

Download MT5 from your broker or [MetaQuotes](https://www.metatrader5.com/).

### 2. Enable Algo Trading

In MT5:
1. **Tools** → **Options** → **Expert Advisors**
2. Enable **Allow algorithmic trading**
3. Enable **Allow DLL imports**

### 3. Get Login Credentials

From your broker:
- **Server name** (e.g., "RoboForex-ECN")
- **Login** (account number)
- **Password** (trading password)

### 4. Add to K.I.T.

#### Via CLI

```bash
kit connect metatrader
# Follow the prompts
```

#### Via Environment Variables

```bash
# .env
MT5_SERVER=RoboForex-ECN
MT5_LOGIN=12345678
MT5_PASSWORD=your_password
```

## Test Connection

```bash
kit test-connection metatrader
```

Expected output:
```
✅ MetaTrader Connection Test
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server:       RoboForex-ECN
Account:      12345678
Name:         John Doe
Balance:      $10,000.00
Equity:       $10,125.50
Margin Free:  $9,875.50
Leverage:     1:500
```

## Trading Commands

### Basic Trading

```bash
# Buy EURUSD
kit buy EURUSD 0.1 --exchange metatrader

# Sell with SL/TP
kit sell GBPUSD 0.1 --sl 50 --tp 100 --exchange metatrader

# Close position
kit close EURUSD --exchange metatrader
```

### Via Telegram

```
"Buy 0.1 lots EURUSD"
"Sell GBPJPY with 30 pip stop loss"
"Close all positions"
```

## Position Sizing

```bash
# By lots
kit buy EURUSD 0.1

# By risk percentage
kit buy EURUSD --risk 2%

# By USD amount
kit buy EURUSD --amount 500
```

## Market Hours

Forex markets are open 24/5:
- **Sydney:** 22:00 - 07:00 UTC
- **Tokyo:** 00:00 - 09:00 UTC
- **London:** 08:00 - 17:00 UTC
- **New York:** 13:00 - 22:00 UTC

K.I.T. respects market hours automatically.

## VPS Setup

For 24/7 trading, use a Windows VPS:

1. **Get a VPS**: AWS, DigitalOcean, Vultr
2. **Install Windows Server**
3. **Install MetaTrader**
4. **Install K.I.T.**
5. **Configure auto-start**

See [Windows VPS Guide](/start/windows-vps) for detailed instructions.

## Troubleshooting

<AccordionGroup>
  <Accordion title="MT5 not found">
    Ensure MT5 is installed in the default location or set:
    ```bash
    MT5_PATH="C:\Program Files\MetaTrader 5\terminal64.exe"
    ```
  </Accordion>
  
  <Accordion title="Login failed">
    - Verify credentials with your broker
    - Check server name is exact
    - Ensure account is active (not expired demo)
  </Accordion>
  
  <Accordion title="Trade failed">
    Common reasons:
    - Insufficient margin
    - Market closed
    - Invalid lot size (check broker minimums)
  </Accordion>
</AccordionGroup>

## Related

- [Exchange Connector](/skills/exchange-connector)
- [Windows VPS Setup](/start/windows-vps)
- [Risk Management](/concepts/risk-management)
