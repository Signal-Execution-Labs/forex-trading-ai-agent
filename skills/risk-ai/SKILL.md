---
name: risk-ai
description: Hedge fund-level AI risk management. Real-time portfolio risk assessment, VaR calculation, stress testing, and automatic hedging.
metadata:
  {
    "kit":
      {
        "emoji": "🛡️",
        "category": "risk",
        "tier": "premium",
        "requires": { 
          "skills": ["portfolio-tracker", "market-analysis"]
        }
      }
  }
---

# Risk AI 🛡️

**Your portfolio's guardian angel.** Institutional-grade risk management that protects your capital 24/7.

## Risk Metrics

### Value at Risk (VaR)
Maximum expected loss at a given confidence level.

```bash
kit risk var

# Output:
📊 Value at Risk Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Portfolio Value: $100,000

VaR (1 Day):
• 95% Confidence: -$3,450 (-3.45%)
  → 95% sure we won't lose more than $3,450 today
  
• 99% Confidence: -$5,230 (-5.23%)
  → 99% sure we won't lose more than $5,230 today

VaR (1 Week):
• 95% Confidence: -$7,820 (-7.82%)
• 99% Confidence: -$11,450 (-11.45%)

Historical VaR (Based on last 252 days):
• Worst Day: -8.7% ($8,700)
• Worst Week: -15.2% ($15,200)
• Worst Month: -28.4% ($28,400)

Current Risk Level: MODERATE ⚠️
Suggested Action: Consider reducing BTC exposure by 10%
```

### Expected Shortfall (CVaR)
Average loss when VaR is exceeded.

```bash
kit risk cvar

# Output:
📊 Expected Shortfall (CVaR)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If we exceed our 95% VaR, the expected loss is:
• 1 Day CVaR: -$5,120 (-5.12%)
• 1 Week CVaR: -$11,890 (-11.89%)

Interpretation:
On the worst 5% of days, we expect to lose ~$5,120 on average.
This is the "tail risk" that VaR doesn't capture.
```

### Portfolio Beta
Correlation with overall market.

```bash
kit risk beta

# Output:
📊 Portfolio Beta Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Overall Portfolio Beta: 1.23
→ Portfolio moves 23% more than the market

By Asset:
┌─────────┬────────┬─────────┬────────────────────┐
│ Asset   │ Weight │ Beta    │ Contribution       │
├─────────┼────────┼─────────┼────────────────────┤
│ BTC     │ 50%    │ 1.00    │ 0.50               │
│ ETH     │ 30%    │ 1.35    │ 0.41               │
│ SOL     │ 10%    │ 1.80    │ 0.18               │
│ USDT    │ 10%    │ 0.00    │ 0.00               │
└─────────┴────────┴─────────┴────────────────────┘

Recommendation:
Portfolio is 23% more volatile than market.
To reduce to beta of 1.0, reduce SOL and ETH exposure.
```

## Stress Testing

```bash
kit risk stress

# Output:
🔥 Stress Test Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Scenario Analysis:

1. 📉 2022 Bear Market (-75% BTC)
   Portfolio Impact: -$58,000 (-58%)
   Recovery Time: ~18 months
   Survival: ✅ (if no leverage)

2. 📉 March 2020 Crash (-50% in 24h)
   Portfolio Impact: -$42,000 (-42%)
   Margin Call Risk: ⚠️ if using 2x leverage
   Survival: ✅

3. 📉 Exchange Hack (lose 20% of assets)
   Portfolio Impact: -$20,000 (-20%)
   Mitigation: Spread across 3+ exchanges
   Current Status: Assets on 2 exchanges ⚠️

4. 📉 Stablecoin Depeg (USDT to $0.90)
   Portfolio Impact: -$1,000 (-1%)
   Exposure: 10% in USDT
   Survival: ✅

5. 📉 Black Swan (-90% all crypto)
   Portfolio Impact: -$81,000 (-81%)
   Survival: ✅ (but painful)

Stress Test Score: 7/10
Recommendation: Diversify exchange exposure
```

## Real-Time Risk Monitor

```bash
kit risk monitor

# Output:
🛡️ Risk Monitor - LIVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Last Update: 2 seconds ago

RISK STATUS: ✅ HEALTHY

Current Metrics:
├─ Portfolio Value:  $100,000
├─ Daily P&L:        +$1,234 (+1.23%)
├─ Open Risk:        $4,500 (4.5%)
├─ Max Drawdown:     -$2,100 (-2.1%)
└─ Margin Used:      0% (no leverage)

Position Risks:
┌─────────┬───────────┬───────────┬──────────┐
│ Asset   │ Position  │ Risk      │ Stop     │
├─────────┼───────────┼───────────┼──────────┤
│ BTC     │ $50,000 L │ $2,500    │ $47,500  │
│ ETH     │ $30,000 L │ $1,500    │ $2,850   │
│ SOL     │ $10,000 L │ $500      │ $95      │
└─────────┴───────────┴───────────┴──────────┘

Risk Limits:
├─ Daily Loss Limit:  -5% [-1.23% used]  ████░░░░░░
├─ Max Drawdown:      -15% [-2.1% used]  ██░░░░░░░░
├─ Position Limit:    10% [5% max]       █████░░░░░
└─ Leverage Limit:    3x [1x used]       ███░░░░░░░

No alerts. Portfolio within all risk parameters.
```

## Automatic Hedging

```bash
kit risk hedge

# Output:
🛡️ Hedge Recommendations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current Exposure: 90% Long Crypto
Risk Level: HIGH

Recommended Hedges:

1. BTC Put Options
   ├─ Strike: $45,000 (-10%)
   ├─ Expiry: 30 days
   ├─ Cost: $1,200 (1.2% of portfolio)
   ├─ Protection: Covers losses below $45K
   └─ [EXECUTE HEDGE]

2. Short BTC Futures (Partial)
   ├─ Size: 0.2 BTC (20% of position)
   ├─ This creates a delta-neutral portion
   ├─ Reduces portfolio beta to 0.95
   └─ [EXECUTE HEDGE]

3. Increase Stablecoin Allocation
   ├─ Current: 10%
   ├─ Recommended: 20%
   ├─ Sell: $10,000 of crypto
   └─ [REBALANCE]

Auto-Hedge Settings:
kit risk hedge --auto --threshold 0.15  # Auto-hedge if VaR > 15%
```

## Correlation Matrix

```bash
kit risk correlation

# Output:
📊 Asset Correlation Matrix
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        BTC    ETH    SOL    SPX    Gold
BTC     1.00   0.85   0.78   0.45   0.12
ETH     0.85   1.00   0.82   0.42   0.08
SOL     0.78   0.82   1.00   0.38   0.05
SPX     0.45   0.42   0.38   1.00   0.15
Gold    0.12   0.08   0.05   0.15   1.00

Analysis:
⚠️ BTC-ETH correlation very high (0.85)
   → Not much diversification benefit
   
✅ Crypto-Gold correlation low (0.05-0.12)
   → Gold is a good hedge

Diversification Score: 4/10
Recommendation: Add uncorrelated assets (Gold, Bonds)
```

## Risk Alerts

```yaml
# TOOLS.md
risk:
  alerts:
    # Position risk
    - type: position_loss
      threshold: 5%
      action: notify
      
    - type: position_loss
      threshold: 10%
      action: close_50%
      
    # Portfolio risk
    - type: daily_loss
      threshold: 3%
      action: notify
      
    - type: daily_loss
      threshold: 5%
      action: pause_trading
      
    # Drawdown
    - type: drawdown
      threshold: 10%
      action: notify
      
    - type: drawdown
      threshold: 15%
      action: reduce_exposure
      
    # VaR breach
    - type: var_breach
      threshold: 1.5x  # 150% of normal VaR
      action: hedge
```

## API

```typescript
import { RiskAI } from '@binaryfaster/kit';

const risk = new RiskAI();

// Get VaR
const var95 = await risk.calculateVaR(0.95, '1d');

// Stress test
const stressResults = await risk.stressTest([
  { name: '2022 Bear', btcDrop: -75 },
  { name: 'Flash Crash', allAssets: -50 }
]);

// Monitor risk
risk.on('risk_alert', (alert) => {
  console.log(`Risk Alert: ${alert.type} - ${alert.message}`);
});

// Auto-hedge
await risk.enableAutoHedge({
  maxVaR: 0.10,  // 10%
  hedgeInstrument: 'btc_put',
  maxHedgeCost: 0.02  // 2% of portfolio
});
```

## Configuration

```yaml
# TOOLS.md
risk_ai:
  enabled: true
  
  # Risk limits
  limits:
    max_daily_loss: 5%
    max_drawdown: 15%
    max_position_size: 10%
    max_portfolio_var: 10%
    max_leverage: 3x
    
  # Auto-actions
  auto_actions:
    reduce_on_drawdown: true
    hedge_on_var_breach: true
    close_on_stop_loss: true
    
  # Monitoring
  monitor_interval: 1m
  alert_channels: ["telegram"]
  
  # Stress testing
  run_stress_tests: daily
  custom_scenarios:
    - name: "Regulatory FUD"
      btc: -30%
      alts: -50%
```
