# Order Flow Analysis Skill

Professional tape reading and order flow analysis for market microstructure insights.

## Capabilities

### Tape Reading
- Real-time trade tape with filtering
- Large trade highlighting (whale detection)
- Trade classification (buy/sell aggressor)
- Trade velocity and acceleration
- Cluster analysis (price levels with high activity)

### Delta Analysis
- Cumulative Volume Delta (CVD)
- Delta divergence detection
- Delta at price levels
- Session delta profile
- Delta momentum indicators

### Footprint Charts
- Volume footprint (bid/ask at each level)
- Delta footprint
- Imbalance footprint
- Diagonal imbalance detection
- Stacked imbalance patterns

### Order Book Analysis
- Depth of market (DOM) visualization
- Large order detection (icebergs, spoofing)
- Order book imbalance ratio
- Level 2 absorption analysis
- Hidden liquidity estimation

### Market Profile
- Value area (VA) calculation
- Point of Control (POC)
- Single prints detection
- Poor highs/lows identification
- Initial balance analysis

### Volume Profile
- Volume at price (VAP)
- High volume nodes (HVN)
- Low volume nodes (LVN)
- Naked POC levels
- Volume profile shape analysis

## Indicators

### Custom Indicators
- **Aggression Index** - Buy vs sell pressure ratio
- **Absorption Detector** - Large orders absorbing flow
- **Sweep Detector** - Liquidity sweeps
- **Imbalance Scanner** - Bid/ask imbalances
- **Exhaustion Signal** - Volume climax detection

### Standard Indicators
- Cumulative Delta
- Volume-Weighted Average Price (VWAP)
- VWAP bands (1σ, 2σ, 3σ)
- Session volume profile
- Time and Sales filter

## Configuration

```json
{
  "skills": {
    "order-flow": {
      "enabled": true,
      "symbols": ["BTCUSDT", "ES", "NQ"],
      "largeTradeThreshold": 100000,
      "imbalanceRatio": 3.0,
      "deltaAlerts": true,
      "tapeSpeed": "fast",
      "footprintInterval": "5m"
    }
  }
}
```

## Commands

- `flow tape [symbol]` - Show filtered trade tape
- `flow delta [symbol]` - Cumulative delta chart
- `flow footprint [symbol]` - Footprint chart
- `flow profile [symbol]` - Volume profile
- `flow imbalance [symbol]` - Current imbalances
- `flow whales [symbol]` - Large trade alerts
- `flow dom [symbol]` - Depth of market

## API Endpoints

- `GET /api/flow/tape/:symbol` - Real-time tape
- `GET /api/flow/delta/:symbol` - CVD data
- `GET /api/flow/footprint/:symbol` - Footprint data
- `GET /api/flow/profile/:symbol` - Volume profile
- `GET /api/flow/imbalances/:symbol` - Imbalance levels
- `WS /api/flow/stream/:symbol` - WebSocket tape

## Example Output

```
📊 BTC Order Flow Analysis

🔥 Trade Tape (Last 10 Large Trades):
├─ 14:23:45 | BUY  | 2.5 BTC @ $97,234 | $243,085 🐋
├─ 14:23:42 | SELL | 1.8 BTC @ $97,230 | $175,014
├─ 14:23:38 | BUY  | 3.2 BTC @ $97,235 | $311,152 🐋
└─ ...

📈 Delta Analysis:
├─ Session Delta: +$2.4M (bullish)
├─ 5m Delta: +$180K
├─ Delta Divergence: ⚠️ Price up, delta flat
└─ Aggression: 62% buyers

🎯 Key Levels (Volume Profile):
├─ POC: $97,150 (highest volume)
├─ VAH: $97,380 (value area high)
├─ VAL: $96,920 (value area low)
└─ Naked POC: $95,800 (unfilled)

⚡ Imbalances Detected:
├─ $97,300: 4.2x buy imbalance
├─ $97,150: 3.8x sell imbalance
└─ Diagonal: Bullish stacked imbalance

💡 Signal: Buy pressure absorbing at $97,150 POC
   Targets: $97,380 VAH, $97,500 swing high
```

## Integrations

- TradingView (custom indicators)
- Sierra Chart (data export)
- Bookmap (DOM feed)
- QuantTower (footprint sync)
- Exchange WebSocket APIs

## Educational Content

Built-in tutorials for:
- Reading the tape effectively
- Understanding delta divergences
- Using footprint charts
- Identifying absorption patterns
- Trading with order flow confirmation
