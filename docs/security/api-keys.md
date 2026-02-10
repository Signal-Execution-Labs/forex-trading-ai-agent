---
summary: "API Key Security Best Practices"
read_when:
  - Securely store API keys
  - Understand security practices
title: "API Keys Security"
---

# API Keys Security

Proper handling of API keys is critical for protecting your funds. This guide covers best practices for securing your exchange and broker credentials.

## Golden Rules

1. **Never share API keys** - Not even with support
2. **Never enable withdrawals** - K.I.T. doesn't need it
3. **Use IP restrictions** - Limit access to known IPs
4. **Store securely** - Use environment variables, not code
5. **Rotate regularly** - Change keys every 3-6 months

## Secure Storage

### Environment Variables (Recommended)

Store keys in a `.env` file:

```bash
# .env
BINANCE_API_KEY=your_key_here
BINANCE_SECRET=your_secret_here

ANTHROPIC_API_KEY=sk-ant-...
```

<Warning>
**Never commit `.env` to git!** Add it to `.gitignore`.
</Warning>

### Encrypted Config

K.I.T. can encrypt sensitive configuration:

```bash
kit config encrypt
```

This encrypts API keys with a master password.

### Secrets Manager (Advanced)

For production deployments, use a secrets manager:

```bash
# AWS Secrets Manager
kit config --secrets-manager aws

# HashiCorp Vault
kit config --secrets-manager vault
```

## Permission Settings

### Exchange Permissions

Only enable what you need:

| Permission | Required | Risk |
|------------|----------|------|
| Reading | ✅ Yes | None |
| Trading | ✅ Yes | Medium |
| Futures | If using | Medium |
| Margin | If using | High |
| **Withdrawals** | ❌ **No** | **Critical** |

### API Key Types

```
Read-only:     View balances, orders, history
Trading:       Place/cancel orders, read access
Full access:   Trading + withdrawals (NEVER USE)
```

## IP Restrictions

### Why Use IP Restrictions?

Even if someone gets your API key, they can't use it from a different IP.

### Setting Up

1. **Find your IP**: 
   ```bash
   curl ifconfig.me
   ```

2. **Add to exchange**:
   - Binance: API Management → Restrict access to trusted IPs
   - Kraken: Settings → API → IP Whitelist
   - Coinbase: API settings → IP Whitelist

3. **Static IP** (recommended for servers):
   Use a VPS with static IP for trading bots.

## Environment Security

### File Permissions

```bash
# Linux/macOS
chmod 600 .env
chmod 600 ~/.kit/config.json
```

### Windows

Right-click → Properties → Security → Remove "Everyone" access

### Server Security

If running on a VPS:

1. Use SSH keys, not passwords
2. Enable firewall
3. Keep system updated
4. Use non-root user
5. Enable fail2ban

## What to Do If Compromised

If you suspect your API keys are compromised:

### Immediate Actions

1. **Delete the API key** on the exchange immediately
2. **Check recent activity** for unauthorized trades
3. **Change account password** and 2FA
4. **Review all API keys** - delete unused ones

### In K.I.T.

```bash
# Remove old credentials
kit disconnect binance

# Add new ones
kit connect binance --api-key NEW_KEY --secret NEW_SECRET
```

### Prevention

After incident:
1. Review how compromise happened
2. Enable IP restrictions
3. Consider hardware security key for 2FA
4. Set up account alerts

## Security Checklist

Before going live, verify:

- [ ] `.env` is in `.gitignore`
- [ ] No API keys in code or logs
- [ ] Withdrawal permissions disabled
- [ ] IP restrictions enabled
- [ ] 2FA enabled on all exchanges
- [ ] File permissions set correctly
- [ ] Regular backup of encrypted config

## Common Mistakes

### ❌ Don't Do This

```javascript
// NEVER hardcode keys
const client = new Binance({
  apiKey: 'abc123...',  // BAD!
  secret: 'xyz789...'   // BAD!
});
```

### ✅ Do This Instead

```javascript
// Use environment variables
const client = new Binance({
  apiKey: process.env.BINANCE_API_KEY,
  secret: process.env.BINANCE_SECRET
});
```

### ❌ Other Mistakes

- Sharing `.env` file
- Committing config with keys to git
- Using same API key across multiple services
- Enabling withdrawal permissions "just in case"
- Not rotating keys

## Audit Logging

K.I.T. logs all API activity:

```bash
kit logs --type api --days 7
```

Review logs for:
- Unexpected trading activity
- Failed authentication attempts
- Unusual request patterns

## Multi-User Security

If multiple people access K.I.T.:

1. Use separate API keys per user
2. Set appropriate permission levels
3. Enable audit logging
4. Review access regularly

## Related

- [Binance Setup](/exchanges/binance) - Exchange configuration
- [Risk Management](/concepts/risk-management) - Trading safeguards
- [Architecture](/concepts/architecture) - System overview

---

<Warning>
**Remember:** Your API keys are like the keys to your safe. Treat them with the same level of care you would physical access to your money.
</Warning>
