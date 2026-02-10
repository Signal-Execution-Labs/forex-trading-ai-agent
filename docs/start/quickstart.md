---
summary: "Get K.I.T. running in 5 minutes"
read_when:
  - Quick start without details
  - See first demo
title: "Quickstart"
---

# 🚀 Quickstart - K.I.T. in 5 Minutes

Want to see K.I.T. in action right away? Let's go!

<Info>
**No exchange API needed!** For this demo we use sandbox mode.
</Info>

## Step 1: Install (1 minute)

```bash
npm install -g kit-trading
```

Verify installation:
```bash
kit --version
# K.I.T. v1.0.0 🚗
```

## Step 2: Initialize (30 seconds)

```bash
kit init --demo
```

This creates a workspace with demo configuration:
```
~/.kit/
├── config.json       # ✅ Demo settings
├── exchanges/        # ✅ Sandbox exchange
└── workspace/        # ✅ Agent files
```

## Step 3: Start Gateway (30 seconds)

```bash
kit gateway start
```

You'll see:
```
🚀 K.I.T. Gateway started on 127.0.0.1:18800
📊 Skills loaded: exchange-connector, portfolio-tracker, market-analysis
🔌 Exchanges: binance-sandbox (connected)
✅ Ready for action!
```

## Step 4: First Commands (3 minutes)

### Check Portfolio
```bash
kit portfolio
```

Output:
```
📊 Portfolio Snapshot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Value: $10,000.00 (Demo)

Assets:
  USDT    $10,000.00  100%
  
Positions: None
```

### Get Market Data
```bash
kit market BTC/USDT
```

Output:
```
📈 BTC/USDT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Price:   $67,250.00
24h:     +2.3% (+$1,512)
High:    $68,100.00
Low:     $65,800.00
Volume:  $2.5B
```

### Run Analysis
```bash
kit analyze BTC/USDT
```

Output:
```
🔍 BTC/USDT Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trend:     BULLISH 📈
RSI (14):  58 (Neutral)
MACD:      Bullish crossover
Support:   $65,000
Resistance: $70,000

Signal: BUY
Confidence: 72%
```

### Execute Demo Trade
```bash
kit trade buy BTC/USDT 100 --demo
```

Output:
```
✅ Order Executed (Demo)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Order ID:  demo-12345
Side:      BUY
Pair:      BTC/USDT
Amount:    0.00149 BTC
Price:     $67,250.00
Total:     $100.00
Fee:       $0.10 (0.1%)
```

### Check Portfolio Again
```bash
kit portfolio
```

```
📊 Portfolio Snapshot
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Value: $10,000.00 (Demo)

Assets:
  USDT    $9,899.90   99.0%
  BTC     $100.10     1.0%   ↑ +0.1%
  
Positions:
  BTC/USDT Long  +$0.10 (+0.1%)
```

## 🎉 Done!

You just:
- ✅ Installed K.I.T.
- ✅ Started the gateway
- ✅ Retrieved market data
- ✅ Ran an analysis
- ✅ Executed a demo trade

## Next Steps

<Columns>
  <Card title="Connect Exchange" href="/start/exchanges" icon="link">
    Connect real exchange (Binance, Kraken, etc.)
  </Card>
  <Card title="Set up Telegram" href="/channels/telegram" icon="message-circle">
    Control K.I.T. via chat
  </Card>
  <Card title="Activate Autopilot" href="/concepts/autopilot" icon="robot">
    Automated trading
  </Card>
</Columns>

## CLI Cheatsheet

| Command | Description |
|---------|-------------|
| `kit gateway start` | Start gateway |
| `kit gateway stop` | Stop gateway |
| `kit portfolio` | Show portfolio |
| `kit market <pair>` | Get price |
| `kit analyze <pair>` | Technical analysis |
| `kit trade buy <pair> <amount>` | Buy |
| `kit trade sell <pair> <amount>` | Sell |
| `kit backtest --strategy <name>` | Run backtest |
| `kit help` | Show help |

## Troubleshooting

<AccordionGroup>
  <Accordion title="kit: command not found">
    ```bash
    # Add npm global bin path to PATH
    export PATH="$(npm config get prefix)/bin:$PATH"
    ```
  </Accordion>
  
  <Accordion title="Gateway won't start">
    ```bash
    # Check port
    kit gateway status
    
    # Use different port
    KIT_GATEWAY_PORT=18801 kit gateway start
    ```
  </Accordion>
  
  <Accordion title="Demo data not available">
    ```bash
    # Reinitialize workspace
    kit init --demo --force
    ```
  </Accordion>
</AccordionGroup>

---

<Tip>
**Pro Tip:** Use `kit --help` for all available commands and options.
</Tip>
