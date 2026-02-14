# Social Proof System

> Verified trader badges, performance proofs, and trust signals

## Overview

Build trust in the K.I.T. community with verified performance, badges, and transparent track records.

## Verification Levels

### 🔵 Basic Verified
- Email confirmed
- Account active 7+ days
- At least 1 completed trade

### ✅ Performance Verified
- 30+ days trading history
- All trades auditable
- Connected to verified exchange API

### 🏆 Track Record Verified
- 90+ days history
- Third-party audit completed
- Risk metrics published

### ⭐ Elite Verified
- 365+ days consistent trading
- External audit (CPA/Auditor)
- Video identity verification

## Badges

### Achievement Badges
- 🎯 **Sharpshooter:** 70%+ win rate (100+ trades)
- 📈 **Bull Runner:** +100% annual return
- 🛡️ **Risk Manager:** <10% max drawdown
- 🔥 **Hot Streak:** 20 consecutive winners
- 💎 **Diamond Hands:** Held winning position 30+ days
- 🌙 **Night Trader:** 100+ profitable night trades
- 🌍 **Global Trader:** Traded 10+ asset classes

### Milestone Badges
- 🥉 100 Trades
- 🥈 1,000 Trades
- 🥇 10,000 Trades
- 💰 First $10K profit
- 🚀 First $100K profit

### Community Badges
- 👥 **Mentor:** Helped 10+ new traders
- 📝 **Educator:** Published 50+ ideas
- 🤝 **Team Player:** Active in 5+ discussions/week

## Performance Cards

Shareable cards showing:
- Verified P&L (absolute and %)
- Win rate and profit factor
- Max drawdown
- Risk-adjusted returns (Sharpe)
- Trading frequency
- Best/worst trade

Cards are:
- Cryptographically signed
- QR code for verification
- Embed code for websites
- Share to Twitter/Discord/Telegram

## Trust Score

Composite score (0-100) based on:
- Verification level (25%)
- Track record length (20%)
- Performance metrics (25%)
- Community reputation (15%)
- Transparency (15%)

## Commands

- `kit verify apply` - Start verification
- `kit verify status` - Check verification status
- `kit badges` - View your badges
- `kit card generate` - Create performance card
- `kit trustscore` - View your trust score

## API Endpoints

- `POST /api/verify/apply` - Apply for verification
- `GET /api/verify/status` - Verification status
- `GET /api/badges/:user_id` - User's badges
- `GET /api/card/:user_id` - Performance card
- `POST /api/card/verify` - Verify a card's authenticity
- `GET /api/trustscore/:user_id` - Trust score
