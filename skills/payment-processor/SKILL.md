# Payment Processor Skill

> Send, receive, and manage fiat payments

## Supported Services

| Service | Send | Receive | Balance | Status |
|---------|------|---------|---------|--------|
| **PayPal** | ✅ | ✅ | ✅ | 🚧 Planned |
| **Skrill** | ✅ | ✅ | ✅ | 🚧 Planned |
| **Wise** | ✅ | ✅ | ✅ | 🚧 Planned |
| **Revolut** | ✅ | ✅ | ✅ | 🚧 Planned |
| **Stripe** | - | ✅ | ✅ | 🚧 Planned |
| **Bank (Open Banking)** | ✅ | ✅ | ✅ | 🚧 Planned |

---

## Capabilities

### View Balances
```python
from skills.payment_processor import PaymentManager

pm = PaymentManager()

# Get all balances
balances = pm.get_all_balances()
# {
#   "paypal": {"USD": 1250.00, "EUR": 340.00},
#   "skrill": {"USD": 890.00},
#   "wise": {"USD": 2100.00, "EUR": 1500.00, "GBP": 800.00}
# }
```

### Send Money
```python
# Send via PayPal
pm.send(
    service="paypal",
    to="recipient@email.com",
    amount=100.00,
    currency="USD",
    note="Payment for services"
)

# Send via Wise
pm.send(
    service="wise",
    to="recipient_account_id",
    amount=500.00,
    currency="EUR"
)
```

### Receive Payments
```python
# Create PayPal invoice
invoice = pm.create_invoice(
    service="paypal",
    amount=250.00,
    currency="USD",
    description="Consulting services",
    recipient_email="client@company.com"
)

# Create payment link
link = pm.create_payment_link(
    amount=50.00,
    currency="USD",
    services=["paypal", "stripe", "crypto"]
)
```

### Currency Exchange
```python
# Convert EUR to USD via Wise
pm.convert(
    service="wise",
    from_currency="EUR",
    to_currency="USD",
    amount=1000.00
)
```

---

## K.I.T. Integration

### Natural Language Commands

```
"Send $100 to john@email.com via PayPal"
"What's my PayPal balance?"
"Convert €500 to USD on Wise"
"Create an invoice for $200"
"Show all my fiat balances"
"Transfer $500 from Skrill to PayPal"
```

### Automation Rules

```
"Every month, if PayPal > $2000, transfer excess to Wise"
"When I receive a payment > $500, notify me"
"Auto-pay my Netflix subscription from PayPal"
```

---

## Security

### API Authentication
- OAuth 2.0 for PayPal, Wise
- API keys stored encrypted
- Token refresh handled automatically

### Transaction Security
- Daily/weekly limits configurable
- Whitelist recipients
- 2FA for large transactions
- Audit log of all transactions

---

## Configuration

```yaml
# config/payments.yaml
paypal:
  client_id: ${PAYPAL_CLIENT_ID}
  client_secret: ${PAYPAL_CLIENT_SECRET}
  mode: sandbox  # or 'live'

skrill:
  email: ${SKRILL_EMAIL}
  api_password: ${SKRILL_API_PASSWORD}

wise:
  api_key: ${WISE_API_KEY}
  profile_id: ${WISE_PROFILE_ID}
```

---

## Files

```
skills/payment-processor/
├── SKILL.md
├── scripts/
│   ├── paypal.py
│   ├── skrill.py
│   ├── wise.py
│   ├── revolut.py
│   └── manager.py
└── examples/
    ├── send_payment.py
    └── check_balances.py
```

---

**Version:** 1.0.0  
**Status:** Planning Phase
