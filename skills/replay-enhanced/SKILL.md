# Enhanced Replay Mode

Advanced market replay with tick-by-tick simulation.

## Features

- **True Tick Replay** - Replay market at tick level, not just candles
- **Speed Control** - 0.1x to 100x playback speed
- **Order Simulation** - Place virtual orders during replay
- **Spread Simulation** - Realistic bid/ask spread modeling
- **Slippage Modeling** - Based on historical volatility
- **Multiple Sessions** - Compare different entry/exit decisions
- **Annotation Mode** - Mark and save key moments

## Use Cases

1. **Strategy Development** - Test ideas on historical data
2. **Psychology Training** - Practice without real money
3. **Pattern Recognition** - Study historical setups
4. **Mistake Analysis** - Replay losing trades to learn

## Commands

```
kit replay <symbol> --date 2025-01-15 --speed 1x
kit replay pause
kit replay jump --to 14:30
kit replay place-order --type limit --price 45000
kit replay annotate "Potential breakout setup"
kit replay compare --sessions session1,session2
kit replay export --format json
```

## Limitations

- Tick data availability varies by exchange
- Some spreads are approximated for older data
- Order fill simulation assumes standard queue position
