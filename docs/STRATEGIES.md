# K.I.T. Trading Strategies Documentation

## Overview

K.I.T. (Künstliche Intelligenz Trading) implements multiple trading strategies using the `technicalindicators` library. Each strategy can run independently or be combined for consensus-based trading decisions.

---

## Strategy Architecture

### Base Class (`base.ts`)

All advanced strategies extend `BaseStrategy` which provides:

- **Signal Interface**: Standardized trading signal format
- **Configuration Management**: Enable/disable, parameter tuning
- **Helper Methods**: Price extraction, position sizing, confidence normalization
- **Risk Management**: Stop-loss and take-profit calculations

```typescript
interface Signal {
  symbol: string;
  exchange: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  strategy: string;
  confidence: number;  // 0-1 scale
  timestamp: Date;
  reason?: string;
  indicators?: Record<string, number>;
  stopLoss?: number;
  takeProfit?: number;
}
```

---

## Advanced Strategies

### 1. SMA/EMA Crossover Strategy (`sma-crossover.ts`)

**Type:** Trend Following  
**Indicators:** SMA, EMA

#### How It Works
- Calculates fast and slow moving averages
- **Golden Cross**: Fast MA crosses above slow MA → Buy signal
- **Death Cross**: Fast MA crosses below slow MA → Sell signal

#### Default Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `fastPeriod` | 9 | Fast MA period |
| `slowPeriod` | 21 | Slow MA period |
| `useEMA` | true | Use EMA instead of SMA |
| `confirmationBars` | 1 | Bars to confirm crossover |
| `minCrossoverStrength` | 0.001 | Minimum MA separation |

#### Signal Confidence Factors
- Crossover strength (MA separation)
- Trend alignment
- ATR-based volatility

---

### 2. RSI Strategy (`rsi.ts`)

**Type:** Mean Reversion / Momentum  
**Indicators:** RSI, SMA (trend filter)

#### How It Works
- Identifies overbought (>70) and oversold (<30) conditions
- Waits for RSI reversal from extremes
- Detects bullish/bearish divergences

#### Default Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `period` | 14 | RSI calculation period |
| `overbought` | 70 | Overbought threshold |
| `oversold` | 30 | Oversold threshold |
| `divergenceLookback` | 14 | Bars to check for divergence |
| `useDivergence` | true | Enable divergence detection |
| `trendFilter` | true | Only trade with trend |
| `trendPeriod` | 50 | SMA period for trend |

#### Signal Types
1. **Oversold Reversal**: RSI < 30 and turning up → Buy
2. **Overbought Reversal**: RSI > 70 and turning down → Sell
3. **Bullish Divergence**: Price lower lows, RSI higher lows → Buy
4. **Bearish Divergence**: Price higher highs, RSI lower highs → Sell

---

### 3. MACD Strategy (`macd.ts`)

**Type:** Trend Following / Momentum  
**Indicators:** MACD, Signal Line, Histogram, EMA

#### How It Works
- Monitors MACD line crossing signal line
- Tracks histogram momentum changes
- Zero line crossovers for trend confirmation

#### Default Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `fastPeriod` | 12 | Fast EMA period |
| `slowPeriod` | 26 | Slow EMA period |
| `signalPeriod` | 9 | Signal line period |
| `histogramThreshold` | 0 | Min histogram for signal |
| `trendFilter` | true | 200 EMA trend filter |
| `trendPeriod` | 200 | Long-term trend EMA |
| `zeroCrossEnabled` | true | Zero line cross signals |

#### Signal Types
1. **Bullish Crossover**: MACD crosses above signal line
2. **Bearish Crossover**: MACD crosses below signal line
3. **Zero Line Cross**: MACD crosses zero (trend confirmation)
4. **Histogram Momentum**: Early warning from histogram changes

---

### 4. Bollinger Bands Strategy (`bollinger.ts`)

**Type:** Mean Reversion / Volatility  
**Indicators:** Bollinger Bands, RSI, %B

#### How It Works
- Tracks price relative to bands (upper/middle/lower)
- Identifies band touches for mean reversion
- Detects squeeze patterns for breakouts

#### Default Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `period` | 20 | Bollinger period |
| `stdDev` | 2 | Standard deviations |
| `useRSIFilter` | true | Confirm with RSI |
| `rsiPeriod` | 14 | RSI period |
| `rsiOverbought` | 70 | RSI overbought level |
| `rsiOversold` | 30 | RSI oversold level |
| `bandwidthThreshold` | 0.1 | Squeeze threshold |
| `squeezePeriod` | 20 | Squeeze lookback |

#### Signal Types
1. **Lower Band Touch**: Price at lower band + RSI oversold → Buy
2. **Upper Band Touch**: Price at upper band + RSI overbought → Sell
3. **Squeeze Breakout**: Low bandwidth expanding → Direction signal
4. **Middle Band Cross**: Trend following on MA cross

#### Key Metrics
- **%B (Percent B)**: Position within bands (0 = lower, 1 = upper)
- **Bandwidth**: (Upper - Lower) / Middle = volatility measure

---

### 5. Ichimoku Cloud Strategy (`ichimoku.ts`)

**Type:** Comprehensive Trend System  
**Indicators:** Tenkan-sen, Kijun-sen, Senkou Span A/B, Chikou Span

#### How It Works
- Complete trading system with multiple confirmation levels
- TK Cross (Tenkan/Kijun crossover)
- Kumo (Cloud) breakouts
- Chikou Span confirmation

#### Default Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `conversionPeriod` | 9 | Tenkan-sen period |
| `basePeriod` | 26 | Kijun-sen period |
| `spanPeriod` | 52 | Senkou Span B period |
| `displacement` | 26 | Cloud/Chikou displacement |
| `minCloudThickness` | 0.005 | Min cloud for S/R |
| `tkCrossEnabled` | true | TK cross signals |
| `kumoBreakoutEnabled` | true | Cloud breakout signals |
| `chikouConfirmation` | true | Require Chikou confirm |

#### Signal Types
1. **Strong Buy**: TK bullish cross above cloud + Chikou confirms
2. **Strong Sell**: TK bearish cross below cloud
3. **Kumo Breakout**: Price breaks above/below cloud
4. **Weak Signal**: TK cross inside cloud (lower confidence)

#### Ichimoku Components
| Component | Japanese | Calculation |
|-----------|----------|-------------|
| Conversion Line | Tenkan-sen | (9-period High + Low) / 2 |
| Base Line | Kijun-sen | (26-period High + Low) / 2 |
| Leading Span A | Senkou Span A | (Tenkan + Kijun) / 2, shifted 26 forward |
| Leading Span B | Senkou Span B | (52-period High + Low) / 2, shifted 26 forward |
| Lagging Span | Chikou Span | Close, shifted 26 backward |

---

### 6. Volume Profile Strategy (`volume-profile.ts`)

**Type:** Volume Analysis / Support-Resistance  
**Indicators:** OBV, VWAP, Volume Profile, Volume MA

#### How It Works
- Analyzes volume patterns and spikes
- Tracks OBV for divergence detection
- Maps volume profile for key price levels
- VWAP mean reversion

#### Default Parameters
| Parameter | Default | Description |
|-----------|---------|-------------|
| `volumeMAPeriod` | 20 | Volume MA period |
| `volumeSpikeMultiplier` | 2.0 | Spike detection threshold |
| `obySensitivity` | 0.02 | OBV divergence sensitivity |
| `vwapEnabled` | true | Enable VWAP analysis |
| `volumeProfileBins` | 20 | Price level bins |
| `lookbackPeriod` | 50 | Profile lookback |

#### Signal Types
1. **Volume Spike Breakout**: High volume + price move + OBV confirms
2. **OBV Divergence**: Price/OBV divergence for reversals
3. **VWAP Mean Reversion**: Price deviation from VWAP
4. **Key Level Bounce**: Price at high-volume support/resistance

#### Key Metrics
- **OBV (On-Balance Volume)**: Cumulative volume by direction
- **VWAP**: Volume-Weighted Average Price
- **Volume Profile**: Distribution of volume at price levels
- **POC**: Point of Control (highest volume price)

---

## Strategy Manager (`manager.ts`)

### Features

1. **Multi-Strategy Execution**: Runs all strategies in parallel
2. **Signal Aggregation**: Combines signals from multiple sources
3. **Weighted Confidence**: Adjustable strategy weights
4. **Historical Data Cache**: Efficient data management

### Strategy Weights (Default)
| Strategy | Weight | Reason |
|----------|--------|--------|
| Ichimoku Cloud | 1.2 | Comprehensive system |
| SMA Crossover | 1.0 | Standard |
| RSI | 1.0 | Standard |
| MACD | 1.0 | Standard |
| Bollinger Bands | 1.0 | Standard |
| Volume Profile | 0.8 | Confirmation use |
| Legacy Strategies | 0.5 | Simpler logic |

### Usage Example

```typescript
const manager = new StrategyManager();
await manager.loadStrategies();

// Update historical data
manager.updateHistoricalData('binance:BTC/USDT', ohlcvData);

// Get individual signals
const signals = await manager.analyze(marketData);

// Get aggregated signals with consensus
const aggregated = await manager.analyzeWithAggregation(marketData);

// Configure specific strategy
manager.configureStrategy('RSI_Strategy', {
  params: { overbought: 80, oversold: 20 }
});

// Adjust weights
manager.setStrategyWeight('Ichimoku_Cloud', 1.5);
```

### Aggregated Signal Format

```typescript
interface AggregatedSignal extends Signal {
  sources: string[];        // Strategies that agree
  combinedConfidence: number; // Weighted confidence
  agreementRatio: number;   // 0-1 agreement level
}
```

---

## Risk Management

### Position Sizing
All strategies use ATR-based or percentage-based position sizing:

```typescript
positionSize = (accountBalance * riskPercent) / (price - stopLoss)
```

### Stop Loss / Take Profit
Each signal includes recommended levels based on:
- ATR multipliers
- Support/Resistance levels
- Indicator-specific logic

### Confidence Scoring
Confidence (0-1) is calculated from:
- Indicator strength
- Multiple confirmations
- Trend alignment
- Historical performance

---

## Best Practices

### Combining Strategies
1. Use Ichimoku for primary trend direction
2. Confirm with RSI/MACD for timing
3. Validate with Volume Profile
4. Use Bollinger for volatility context

### Parameter Tuning
- Backtest before live trading
- Adjust for market conditions (trending vs. ranging)
- Consider timeframe (longer = more reliable, slower)

### Risk Guidelines
- Never trade signals with confidence < 0.5
- Require 2+ strategy agreement for large positions
- Always use stop-losses
- Max 2% risk per trade

---

## Changelog

### v0.2.0 (2024-02)
- Added 6 advanced indicator-based strategies
- Implemented BaseStrategy abstract class
- Added signal aggregation system
- Historical data caching
- Strategy weight configuration

### v0.1.0 (2024-01)
- Initial release with 4 basic strategies
- Basic signal generation
