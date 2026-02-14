# AI Code Assist Skill

> Pine Script v6's AI-Assisted Coding Revolution for K.I.T.

## Overview

AI Code Assist enables traders to create custom strategies, indicators, and tools using natural language. No coding experience required. Based on TradingView's AI-assisted Pine Script development.

## Features

### Natural Language to Code
Describe what you want → Get working K.I.T. code:

**Input:** "Create a strategy that buys when RSI crosses above 30 and MACD histogram turns positive"

**Output:** Complete K.I.T. strategy with entry/exit rules, risk management, and backtesting ready.

### Code Generation Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `strategy` | Full trading strategy | Automated trading |
| `indicator` | Custom indicator | Chart analysis |
| `alert` | Alert conditions | Notifications |
| `screener` | Asset filter | Market scanning |
| `backtest` | Backtest config | Strategy validation |
| `risk` | Risk rules | Position sizing |

### AI Capabilities

1. **Code Generation** - Natural language → K.I.T. TypeScript
2. **Code Explanation** - Understand existing strategies
3. **Code Optimization** - Improve performance/efficiency
4. **Bug Detection** - Find and fix issues
5. **Code Translation** - Pine Script → K.I.T. converter
6. **Documentation** - Auto-generate docs

### Supported Conversions

| From | To |
|------|-----|
| Pine Script v4/v5/v6 | K.I.T. TypeScript |
| Python (Backtrader) | K.I.T. TypeScript |
| MQL4/MQL5 | K.I.T. TypeScript |
| TradingView Ideas | K.I.T. Strategy |
| Natural Language | K.I.T. TypeScript |

## Commands

```bash
# Generate from description
kit ai generate "RSI oversold strategy with trailing stop"

# Explain existing code
kit ai explain ./strategies/my-strategy.ts

# Optimize strategy
kit ai optimize ./strategies/slow-strategy.ts

# Convert Pine Script
kit ai convert ./pine/my-indicator.pine

# Fix bugs
kit ai debug ./strategies/broken.ts

# Generate docs
kit ai docs ./strategies/
```

## Interactive Mode

```bash
kit ai chat
```

Opens conversational AI session:

```
You: Create a mean reversion strategy for BTC

AI: I'll create a mean reversion strategy using Bollinger Bands...
    [generates code]
    
    Would you like me to:
    1. Add stop loss/take profit
    2. Optimize parameters
    3. Run a backtest
    
You: Add ATR-based stop loss

AI: Added dynamic stop loss using 2x ATR...
    [updates code]
```

## Template Library

Pre-built templates for common patterns:

- **Trend Following:** MA crossover, breakout, momentum
- **Mean Reversion:** Bollinger bounce, RSI oversold/overbought
- **Smart Money:** Order blocks, FVG, liquidity sweeps
- **Scalping:** Quick in/out with tight stops
- **Grid Trading:** Range-bound accumulation
- **DCA:** Dollar cost averaging with triggers

## Safety Features

### Code Review
All generated code is automatically reviewed for:
- ✅ No hardcoded API keys
- ✅ Proper error handling
- ✅ Risk limits enforced
- ✅ No infinite loops
- ✅ Memory efficient
- ✅ Rate limiting respected

### Paper Trading Required
New AI-generated strategies MUST run in paper trading mode for minimum 7 days before live deployment.

## Example Prompts

### Simple
- "Buy BTC when RSI < 30"
- "Alert when price breaks above 20 EMA"
- "Trailing stop at 3%"

### Intermediate
- "Grid bot for ETH/USDT between $2000-$3000 with 10 grids"
- "DCA into BTC every Monday at market price, $100 per week"
- "Mean reversion on oversold RSI with Bollinger Band confirmation"

### Advanced
- "Smart money order block strategy with FVG entries and liquidity sweep stops"
- "Multi-timeframe trend following: daily trend, 4H momentum, 1H entry"
- "Portfolio rotation based on 30-day relative strength across top 20 altcoins"

## Configuration

```yaml
skill: ai-code-assist
version: 1.0.0
settings:
  model: claude-3.5-sonnet  # AI model for code generation
  temperature: 0.2          # Lower = more deterministic
  maxTokens: 8000           # Max code length
  language: typescript      # Output language
  framework: kit            # Target framework
  safetyChecks: true        # Enable code review
  paperTradingDays: 7       # Min days before live
```

## Model Support

| Provider | Model | Best For |
|----------|-------|----------|
| Anthropic | Claude Opus 4.5 | Complex strategies |
| Anthropic | Claude Sonnet 4 | General coding |
| OpenAI | GPT-4o | Quick iterations |
| OpenAI | o3 | Reasoning-heavy |
| DeepSeek | DeepSeek-V3 | Cost-effective |

## Pine Script Converter

Direct import from TradingView:

```bash
# Single file
kit ai convert --from pine --to kit ./my-indicator.pine

# Bulk convert
kit ai convert --from pine --to kit ./pine-scripts/

# With optimization
kit ai convert --from pine --to kit --optimize ./strategy.pine
```

### Conversion Quality

- **Syntax:** 100% accurate translation
- **Logic:** Preserved exactly
- **Comments:** Converted and enhanced
- **Variables:** Proper TypeScript typing
- **Functions:** Mapped to K.I.T. equivalents
