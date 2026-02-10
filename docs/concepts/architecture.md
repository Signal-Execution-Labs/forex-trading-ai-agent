---
summary: "K.I.T. system architecture and components"
read_when:
  - Understand architecture
  - Developing K.I.T.
title: "Architecture"
---

# Architecture

K.I.T. is built as a modular system that connects AI-powered trading decisions with exchange APIs and messaging channels.

## Overview

```mermaid
flowchart TB
    subgraph Channels["📱 Channels"]
        TG[Telegram]
        DC[Discord]
        SIG[Signal]
    end
    
    subgraph Core["🧠 K.I.T. Core"]
        GW[Gateway]
        AI[AI Engine]
        TRE[Trading Engine]
        RISK[Risk Manager]
    end
    
    subgraph Skills["⚡ Skills"]
        EX[Exchange Connector]
        PT[Portfolio Tracker]
        AL[Alert System]
        MA[Market Analysis]
        AT[Auto-Trader]
        BT[Backtester]
    end
    
    subgraph External["🌐 External"]
        BIN[Binance]
        KRA[Kraken]
        CB[Coinbase]
        MT[MetaTrader]
        DATA[Market Data]
    end
    
    Channels --> GW
    GW --> AI
    AI --> TRE
    TRE --> RISK
    RISK --> Skills
    Skills --> External
```

## Components

### Gateway

The gateway is the heart of K.I.T. It:

- Receives messages from all channels
- Routes them to the AI Engine
- Manages sessions per user
- Coordinates all skills

```
User Message → Gateway → AI Engine → Action → Response
```

### AI Engine

The AI engine interprets natural language and generates trading decisions:

```json
{
  "engine": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "context": {
      "portfolio": true,
      "marketData": true,
      "openPositions": true,
      "riskLimits": true
    }
  }
}
```

**Responsibilities:**
- Natural language processing
- Intent recognition (buy, sell, analyze, etc.)
- Market interpretation
- Strategy recommendations

### Trading Engine

Executes trading operations:

```mermaid
flowchart LR
    A[Trade Request] --> B{Risk Check}
    B -->|Pass| C[Order Builder]
    B -->|Fail| D[Reject]
    C --> E[Exchange API]
    E --> F[Confirmation]
```

**Features:**
- Order management (limit, market, stop)
- Position tracking
- Order routing to exchanges
- Trade execution reports

### Risk Manager

Protects against excessive losses:

```json
{
  "riskManager": {
    "checks": [
      "maxPositionSize",
      "dailyLossLimit",
      "openPositionLimit",
      "leverageLimit"
    ],
    "actions": {
      "onLimitReached": "reject",
      "onDailyLoss": "halt_trading",
      "onDrawdown": "reduce_exposure"
    }
  }
}
```

## Data Flow

### Trade Execution

```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant AI
    participant RiskMgr
    participant TradingEngine
    participant Exchange
    
    User->>Gateway: "Buy BTC for $100"
    Gateway->>AI: Parse Intent
    AI->>Gateway: {action: "buy", pair: "BTC/USDT", amount: 100}
    Gateway->>RiskMgr: Validate Trade
    RiskMgr->>Gateway: Approved
    Gateway->>TradingEngine: Execute Order
    TradingEngine->>Exchange: POST /order
    Exchange->>TradingEngine: Order Filled
    TradingEngine->>Gateway: Confirmation
    Gateway->>User: "✅ Bought: 0.0015 BTC @ $67,000"
```

### Market Analysis

```mermaid
sequenceDiagram
    participant User
    participant Gateway
    participant AI
    participant MarketAnalysis
    participant DataFeed
    
    User->>Gateway: "Analyze ETH"
    Gateway->>AI: Parse Intent
    AI->>MarketAnalysis: Request Analysis
    MarketAnalysis->>DataFeed: Get OHLCV, Indicators
    DataFeed->>MarketAnalysis: Market Data
    MarketAnalysis->>AI: Technical Analysis
    AI->>Gateway: Formatted Response
    Gateway->>User: "📊 ETH Analysis..."
```

## Skill System

Skills are modular extensions:

```
skills/
├── exchange-connector/     # Exchange APIs
│   ├── binance.ts
│   ├── kraken.ts
│   └── metatrader.ts
├── portfolio-tracker/      # Portfolio Management
├── alert-system/          # Price Alerts
├── market-analysis/       # Technical Analysis
├── auto-trader/           # Automated Strategies
└── backtester/            # Strategy Testing
```

Each skill has:
- `SKILL.md` - Documentation
- `index.ts` - Main logic
- `config.json` - Configuration

## State Management

```json
{
  "state": {
    "portfolio": {
      "storage": "local",
      "sync": "realtime"
    },
    "positions": {
      "storage": "memory + exchange",
      "sync": "polling (5s)"
    },
    "alerts": {
      "storage": "local",
      "persistence": true
    },
    "sessions": {
      "storage": "memory",
      "ttl": "24h"
    }
  }
}
```

## Scalability

### Single Instance

```
┌─────────────────────────────────────┐
│           K.I.T. Instance           │
├─────────────────────────────────────┤
│  Gateway │ AI │ Trading │ Risk      │
├─────────────────────────────────────┤
│     Skills (Exchange, Portfolio)    │
└─────────────────────────────────────┘
         ↕           ↕           ↕
    Binance      Kraken      Telegram
```

### Multi-Instance (Advanced)

```
┌─────────────┐     ┌─────────────┐
│  K.I.T. #1  │     │  K.I.T. #2  │
│  (Crypto)   │     │   (Forex)   │
└──────┬──────┘     └──────┬──────┘
       │                   │
       └───────┬───────────┘
               │
         ┌─────┴─────┐
         │   Redis   │
         │  (State)  │
         └───────────┘
```

## Security Layers

```
1. Channel Auth      → Telegram Bot Token, Discord OAuth
2. Gateway Auth      → API Token for external access
3. Exchange Auth     → API Keys (encrypted)
4. Risk Auth         → Trade limits, IP whitelist
```

## Extensibility

### Add New Skill

```typescript
// skills/my-skill/index.ts
import { Skill } from '@kit/core';

export const mySkill: Skill = {
  name: 'my-skill',
  version: '1.0.0',
  commands: {
    'my-command': async (ctx) => {
      // Skill logic
    }
  }
};
```

### Add New Exchange

```typescript
// skills/exchange-connector/my-exchange.ts
import { Exchange } from '@kit/exchanges';

export class MyExchange extends Exchange {
  async buy(pair: string, amount: number) { ... }
  async sell(pair: string, amount: number) { ... }
  async getBalance() { ... }
}
```

## Next Steps

<Columns>
  <Card title="Skills" href="/concepts/skills" icon="plug">
    Skill system in detail.
  </Card>
  <Card title="Trading Tools" href="/concepts/trading-tools" icon="wrench">
    Available trading tools.
  </Card>
  <Card title="Risk Management" href="/concepts/risk-management" icon="shield">
    Understand risk control.
  </Card>
</Columns>
