# AI Strategy Generator

> **Skill #71** - Generate trading strategies with AI

## Overview

Inspired by OctoBot AI and ChatGPT Agent trading. Use natural language to describe your trading idea and let AI generate a complete, backtestable strategy.

## Features

- **Natural Language Input:** Describe strategy in plain English
- **Code Generation:** Outputs K.I.T.-compatible strategy
- **Iterative Refinement:** AI improves based on backtest results
- **Multiple Formats:** Pine Script, Python, K.I.T. native
- **Risk Parameters:** Auto-add risk management
- **Optimization Ready:** Parameters ready for walk-forward

## Usage

```bash
# Generate from description
kit skill strategy-gen --describe "Buy when RSI is oversold and MACD crosses up"

# With target metrics
kit skill strategy-gen --describe "Momentum strategy for crypto" --target-sharpe 1.5

# Iterate on existing strategy
kit skill strategy-gen --improve strategy_v1.json --feedback "reduce drawdown"
```

## Configuration

```yaml
strategy_generator:
  ai_model: "claude-opus-4.5"
  
  output_formats:
    - kit_native    # K.I.T. JSON strategy
    - python        # Python class
    - pinescript    # TradingView Pine Script
  
  auto_features:
    risk_management: true
    position_sizing: true
    stop_loss: true
    take_profit: true
  
  constraints:
    max_indicators: 5
    min_trades_backtest: 100
    max_drawdown: 20%
```

## Example Generation

**Input:**
```
"I want a swing trading strategy for BTC. 
Buy when price pulls back to the 50 EMA in an uptrend.
Sell when RSI gets overbought above 70.
Risk 2% per trade."
```

**Output (K.I.T. Strategy):**
```json
{
  "name": "BTC EMA Pullback",
  "version": "1.0.0",
  "type": "swing",
  "timeframe": "4h",
  
  "entry": {
    "conditions": [
      {"indicator": "trend", "period": 50, "direction": "up"},
      {"indicator": "price", "crosses": "ema_50", "direction": "up"},
      {"indicator": "rsi", "period": 14, "below": 50}
    ],
    "type": "limit",
    "offset": "0.1%"
  },
  
  "exit": {
    "conditions": [
      {"indicator": "rsi", "period": 14, "above": 70}
    ],
    "stop_loss": "2%",
    "take_profit": "6%"
  },
  
  "risk": {
    "per_trade": "2%",
    "max_positions": 3,
    "max_drawdown": "10%"
  }
}
```

## Workflow

```
┌────────────────────────────────────────────────────────┐
│                 AI Strategy Generator                   │
├────────────────────────────────────────────────────────┤
│                                                         │
│   1. DESCRIBE ──▶ 2. GENERATE ──▶ 3. BACKTEST          │
│        │               │               │                │
│        ▼               ▼               ▼                │
│   "Buy when..."   Strategy JSON   Performance           │
│                                    Report               │
│                         │                               │
│                         ▼                               │
│                    4. ITERATE                           │
│                         │                               │
│                         ▼                               │
│              "Reduce drawdown by..."                    │
│                         │                               │
│                         ▼                               │
│                 5. FINAL STRATEGY                       │
│                                                         │
└────────────────────────────────────────────────────────┘
```

## AI Capabilities

- Suggest indicator combinations
- Optimize parameter ranges
- Identify logical flaws
- Add missing risk rules
- Convert between formats
- Explain strategy logic
- Generate documentation

## Safety Features

- Generated strategies marked as "unverified"
- Mandatory paper trading period (7 days)
- Backtest requirement before live
- Risk limit enforcement
- Human approval for live deployment
