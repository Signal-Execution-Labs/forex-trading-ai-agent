# Funding Rate Arbitrage Skill

Exploit funding rate differences between perpetual futures contracts.

## Capabilities

### Rate Monitoring
- Real-time funding rates from 10+ exchanges
- Historical funding rate database
- Rate prediction using ML
- Cross-exchange comparison matrix
- Countdown timers to funding events

### Arbitrage Strategies

#### Cash-and-Carry
- Long spot + short perp when funding positive
- Short spot (margin) + long perp when funding negative
- Automated entry/exit based on rate thresholds
- Position sizing based on expected APY

#### Cross-Exchange Funding Arb
- Long perp on low-rate exchange
- Short perp on high-rate exchange
- Delta-neutral positioning
- Fee optimization

#### Rate Prediction Trading
- Enter before funding rates spike
- ML-based rate prediction (LSTM)
- Sentiment correlation analysis
- Open interest impact modeling

### Risk Management
- Maximum position per exchange
- Liquidation price monitoring
- Margin utilization alerts
- Basis risk hedging
- Exchange counterparty limits

### Supported Exchanges
- Binance Futures
- Bybit
- OKX
- dYdX
- GMX
- Hyperliquid
- Drift Protocol
- Vertex Protocol
- BitMEX
- Kraken Futures

## Configuration

```json
{
  "skills": {
    "funding-rate-arb": {
      "enabled": true,
      "minAnnualizedRate": 10,
      "maxPositionSize": 10000,
      "exchanges": ["binance", "bybit", "okx"],
      "strategy": "cash-and-carry",
      "autoRebalance": true,
      "marginBuffer": 0.2
    }
  }
}
```

## Commands

- `funding rates` - Show current rates across exchanges
- `funding opportunities` - List profitable arb opportunities
- `funding history [symbol]` - Historical rates chart
- `funding predict [symbol]` - ML rate prediction
- `funding start [strategy]` - Start automated funding arb
- `funding positions` - Show current arb positions
- `funding pnl` - Calculate funding earned

## API Endpoints

- `GET /api/funding/rates` - Current rates
- `GET /api/funding/opportunities` - Arb opportunities
- `GET /api/funding/history/:symbol` - Historical data
- `POST /api/funding/strategy` - Start strategy
- `GET /api/funding/positions` - Active positions

## Example Output

```
📊 Funding Rate Opportunities

BTC-PERP:
├─ Binance: +0.0234% (8h) → 28.5% APY
├─ Bybit:   +0.0189% (8h) → 23.0% APY
├─ OKX:     +0.0156% (8h) → 19.0% APY
└─ Best Arb: Long Bybit / Short Binance = 5.5% APY spread

ETH-PERP:
├─ Binance: +0.0312% (8h) → 37.9% APY
├─ dYdX:    +0.0089% (8h) → 10.8% APY
└─ Best Arb: Long dYdX / Short Binance = 27.1% APY spread

💰 Recommended: BTC cash-and-carry on Binance
   Expected APY: 28.5% (minus 2% fees = 26.5% net)
   Suggested size: $5,000 spot + $5,000 short
```

## Safety Features

- Position limits per exchange
- Automatic deleveraging detection
- Funding rate sanity checks
- Exchange API rate limiting
- Liquidation proximity alerts
