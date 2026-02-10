# Wallet & Payment Connector Skill

> Connect K.I.T. to ALL your wallets and payment methods

## Supported Integrations

### 🔐 Hardware Wallets
| Wallet | Status | Features |
|--------|--------|----------|
| **Ledger** | 🚧 Planned | Ledger Live API, multi-chain |
| **Trezor** | 🚧 Planned | Trezor Suite API |

### 💳 Software Wallets
| Wallet | Status | Features |
|--------|--------|----------|
| **MetaMask** | 🚧 Planned | EVM chains, DeFi, NFTs |
| **Electrum** | 🚧 Planned | Bitcoin, Lightning |
| **Trust Wallet** | 🚧 Planned | Multi-chain mobile |
| **Phantom** | 🚧 Planned | Solana ecosystem |
| **Rabby** | 🚧 Planned | Multi-chain DeFi |

### 💰 Payment Processors
| Service | Status | Features |
|---------|--------|----------|
| **PayPal** | 🚧 Planned | Send/receive, balance |
| **Skrill** | 🚧 Planned | Forex funding, transfers |
| **Wise** | 🚧 Planned | Multi-currency, low fees |
| **Revolut** | 🚧 Planned | Crypto + fiat |

### 🪙 Exchange Wallets
| Exchange | Status | Features |
|----------|--------|----------|
| **Binance Pay** | 🚧 Planned | P2P, merchant payments |
| **Coinbase** | 🚧 Planned | Commerce API |
| **Kraken** | 🚧 Planned | Funding, withdrawals |

---

## What K.I.T. Can Do With Wallets

### 1. View All Balances
```
K.I.T., show me my total wealth.

📊 Total Net Worth: $127,450

Breakdown:
├── Binance:      $45,000 (35%)
├── MetaMask:     $32,000 (25%)
├── Ledger:       $28,000 (22%)
├── PayPal:        $8,500 (7%)
├── Bank (Wise):  $12,000 (9%)
└── Skrill:        $1,950 (2%)
```

### 2. Move Money Automatically
```
K.I.T., if my Binance balance exceeds $50k, 
move excess to my Ledger for safety.

✅ Rule created. I'll monitor and transfer automatically.
```

### 3. Optimize Across Platforms
```
K.I.T., find the best yield for my stablecoins.

📊 Analysis:
├── Binance Earn: 5.2% APY
├── Aave (MetaMask): 4.8% APY
├── Compound: 3.9% APY

Recommendation: Move $20k USDC to Binance Earn
Execute? [Yes/No]
```

### 4. Pay Bills & Invoices
```
K.I.T., pay my VPS bill ($50) from PayPal.

✅ Payment sent to Contabo
   Amount: $50.00
   From: PayPal
   Status: Completed
```

### 5. Receive Payments
```
K.I.T., generate an invoice for $500 consulting.

📄 Invoice #2026-0042 created
   Amount: $500
   Accept: PayPal, Binance Pay, ETH, BTC
   Link: https://pay.kit.ai/inv/2026-0042
```

---

## Security Model

### Read-Only by Default
- K.I.T. can VIEW balances without transfer permission
- Transfers require explicit approval OR rule-based automation

### Approval Modes
1. **Manual**: Every transfer needs human approval
2. **Rules-Based**: Pre-approved conditions (e.g., "rebalance if >20% drift")
3. **Full Auto**: K.I.T. manages everything (advanced users only)

### Security Features
- Hardware wallet signing (Ledger/Trezor)
- 2FA integration
- Withdrawal whitelists
- Daily limits
- Anomaly detection

---

## Architecture

```
K.I.T. Wallet Layer
│
├── Hardware Wallets
│   ├── Ledger (USB/Bluetooth)
│   └── Trezor (USB)
│
├── Software Wallets
│   ├── MetaMask (Browser extension / RPC)
│   ├── Electrum (RPC)
│   └── Mobile (WalletConnect)
│
├── Payment APIs
│   ├── PayPal (REST API)
│   ├── Skrill (REST API)
│   ├── Wise (REST API)
│   └── Revolut (Open Banking)
│
└── Exchange APIs
    ├── Binance Pay
    ├── Coinbase Commerce
    └── Others
```

---

## Implementation Priority

### Phase 1: Read-Only Viewing
- [ ] MetaMask balance reading
- [ ] Ledger balance reading
- [ ] PayPal balance reading
- [ ] Binance balance (via exchange-connector)

### Phase 2: Transfers
- [ ] Crypto transfers (with hardware signing)
- [ ] Fiat transfers (PayPal, Skrill)
- [ ] Exchange deposits/withdrawals

### Phase 3: Automation
- [ ] Rule-based rebalancing
- [ ] Automatic bill payments
- [ ] Yield optimization

---

## Example Commands

```
"Show all my wallet balances"
"Transfer 0.5 ETH from MetaMask to Binance"
"Move $1000 from PayPal to Skrill"
"Set up auto-rebalance: 50% crypto, 30% stablecoins, 20% fiat"
"Pay my monthly subscriptions from PayPal"
"If BTC drops 10%, buy $500 worth from my Wise account"
```

---

## Files

```
skills/wallet-connector/
├── SKILL.md              # This documentation
├── scripts/
│   ├── metamask.py       # MetaMask integration
│   ├── ledger.py         # Ledger integration
│   ├── electrum.py       # Electrum integration
│   ├── paypal.py         # PayPal API
│   ├── skrill.py         # Skrill API
│   └── binance_pay.py    # Binance Pay API
└── examples/
    └── portfolio_view.py
```

---

**Version:** 1.0.0  
**Status:** Planning Phase  
**Priority:** HIGH - Core infrastructure for autonomous finance
