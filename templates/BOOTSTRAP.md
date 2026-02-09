# BOOTSTRAP.md - K.I.T. First Run Setup

_Welcome to K.I.T. Let's get you set up for trading._

## 🎯 What This Does

This guide walks you through:
1. Exchange connection
2. Risk profile setup
3. First strategies
4. Verification

**Delete this file when setup is complete.**

---

## Step 1: Basic Identity

### Fill out USER.md
Open `USER.md` and complete at minimum:
- [ ] Your name and timezone
- [ ] Risk tolerance level
- [ ] Max position size
- [ ] Daily loss limit
- [ ] Primary trading timeframe
- [ ] Trading hours

### Verify IDENTITY.md
Check if default K.I.T. identity works for you, or customize:
- [ ] Name preference
- [ ] Communication style

---

## Step 2: Exchange Connection

### Choose Your Exchange(s)
Supported out of the box:
- Binance (Spot & Futures)
- Bybit
- Coinbase Pro
- Kraken
- Any CCXT-compatible exchange

### Create API Keys

**For your primary exchange:**

1. Log into exchange
2. Go to API Management
3. Create new API key with:
   - ✅ Read permissions
   - ✅ Trade permissions (if you want auto-execution)
   - ❌ Withdraw permissions (NEVER enable this)
4. Set IP whitelist if available
5. Save key and secret securely

### Store Credentials

Create `credentials.json` in your workspace root:
```json
{
  "primary_exchange": {
    "exchange": "binance",
    "apiKey": "your-api-key-here",
    "secret": "your-secret-here",
    "testnet": false
  }
}
```

⚠️ This file should be in `.gitignore`!

### Test Connection

Ask K.I.T.: "Test my exchange connection"

Expected response:
- Account balance visible
- No errors
- Correct account type (spot/futures)

---

## Step 3: Risk Profile

### Answer These Questions

**How much can you afford to lose?**
Be honest. This isn't your target loss — it's the worst case.
→ This becomes your `max_drawdown`

**How much per trade?**
Professional traders risk 1-2% per trade. Beginners should stay at 1%.
→ This becomes your `max_position_pct`

**Daily loss limit?**
After losing this much in a day, stop trading. Prevents tilt.
→ This becomes your `max_daily_loss`

**Leverage?**
- None (spot only): Safest
- Low (2-5x): Moderate
- High (10x+): Experts only

### Verify in USER.md
- [ ] max_position_pct is set
- [ ] max_daily_loss is set  
- [ ] max_drawdown is set
- [ ] leverage_preference is set

---

## Step 4: Define Your Watchlist

### Tier 1: Always Monitor (3-5 assets max)
These are your bread and butter. You know them well.
```
Example:
- BTC/USDT
- ETH/USDT
```

### Tier 2: Daily Check (5-10 assets)
Interesting opportunities, check once a day.

### Tier 3: Occasional (unlimited)
On radar but not active focus.

**Add to USER.md under Watchlist section.**

---

## Step 5: First Strategy

Don't start with something complex. Pick ONE:

### Option A: Simple Trend Following
```yaml
name: Simple Trend
timeframe: 4h
rules:
  - Buy when 20 EMA crosses above 50 EMA
  - Sell when 20 EMA crosses below 50 EMA
  - Stop-loss: 3% below entry
  - Take-profit: 9% above entry (3:1 R:R)
position_size: 1% of portfolio
```

### Option B: Support/Resistance
```yaml
name: S/R Bounce
timeframe: 1h
rules:
  - Identify key support levels
  - Buy on touch of support with confirmation
  - Stop-loss: 1% below support
  - Take-profit: At resistance
position_size: 1% of portfolio
```

### Option C: DCA (Safest)
```yaml
name: Weekly DCA
rules:
  - Buy fixed $ amount every week
  - No timing, no stress
  - Long-term only
```

**Add your choice to TOOLS.md under Strategy Configurations.**

---

## Step 6: Trading Mode

Choose your comfort level:

### 🟢 Alert-Only Mode (Recommended for Beginners)
- K.I.T. monitors and alerts
- YOU make all trading decisions
- Lowest risk of mistakes

### 🟡 Semi-Auto Mode
- K.I.T. can execute within strict parameters
- Large trades still require approval
- Good for busy traders

### 🔴 Manual Mode
- K.I.T. provides analysis only
- You use exchange directly
- K.I.T. tracks for you

**Set in TOOLS.md under Automation Settings.**

---

## Step 7: Verify Setup

Ask K.I.T. to verify:

1. "Show me my current setup"
   - Should display exchange, risk params, watchlist

2. "What's my portfolio status?"
   - Should show balances

3. "Analyze BTC for me"
   - Should provide basic analysis

4. "What would a 1% position size be?"
   - Should calculate correctly

---

## Step 8: First Trade (Paper or Small)

Before risking real money:

1. **Paper trade** your strategy for at least 20 trades
   - Or use testnet if available

2. **Start small** when going live
   - Use minimum position sizes
   - Verify everything works

3. **Document everything**
   - Every trade in daily memory
   - Lessons learned

---

## ✅ Setup Checklist

- [ ] USER.md completed (especially risk section)
- [ ] credentials.json created with API keys
- [ ] Exchange connection tested
- [ ] Watchlist defined
- [ ] At least one strategy documented
- [ ] Trading mode selected
- [ ] Verification checks passed

---

## 🎉 You're Ready

Once all boxes are checked:

1. Delete this BOOTSTRAP.md file
2. Start your first trading session
3. Remember: Discipline > Profits

**First command to try:** "Good morning K.I.T., what's the market looking like?"

---

_Welcome to systematic trading. Let's build something great._
