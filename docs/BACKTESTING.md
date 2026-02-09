# K.I.T. Backtesting Framework

## Overview

The K.I.T. Backtesting Framework allows you to test trading strategies on historical data before deploying them live. It provides accurate simulation of market conditions including fees, slippage, and position sizing.

## Features

- 📊 **Historical Data Loading** - Load data from exchanges (via CCXT), CSV files, or JSON
- 🔄 **Strategy Simulation** - Test multiple strategies simultaneously
- 📈 **Comprehensive Metrics** - Sharpe, Sortino, Calmar ratios, drawdown analysis, and more
- 📝 **Report Generation** - HTML, JSON, and Markdown reports with interactive charts
- ⚙️ **Configurable** - Fees, slippage, position sizing, stop-loss, take-profit
- 🧪 **Synthetic Data** - Generate test data for development

## Quick Start

### Run a Basic Backtest

```bash
# Using npm script
npm run backtest -- --synthetic -v

# Using ts-node directly
npx ts-node src/backtest/runner.ts --synthetic -v
```

### Backtest Real Data

```bash
# Fetch data from Binance
npm run backtest -- -s BTC/USDT -e binance --start 2024-01-01 --end 2024-06-01

# Load from CSV file
npm run backtest -- -f data/btc_history.csv --capital 50000

# Generate HTML report
npm run backtest -- -s ETH/USDT --format html -o reports/eth_backtest.html
```

## CLI Reference

### Data Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --symbol <symbol>` | Trading pair | BTC/USDT |
| `-e, --exchange <exchange>` | Exchange name | binance |
| `-t, --timeframe <tf>` | Candle timeframe | 1h |
| `--start <date>` | Start date (YYYY-MM-DD) | 90 days ago |
| `--end <date>` | End date (YYYY-MM-DD) | today |
| `-f, --file <path>` | Load from CSV/JSON file | - |
| `--synthetic` | Use synthetic test data | false |

### Backtest Options

| Option | Description | Default |
|--------|-------------|---------|
| `-c, --capital <amount>` | Initial capital | 10000 |
| `--fee <percent>` | Trading fee % | 0.1 |
| `--slippage <percent>` | Slippage % | 0.05 |
| `--max-positions <n>` | Max concurrent positions | 5 |
| `--position-size <n>` | Position size value | 2 |
| `--position-sizing <type>` | fixed\|percent\|kelly | percent |
| `--stop-loss <percent>` | Stop loss % | 2 |
| `--take-profit <percent>` | Take profit % | 4 |
| `--no-shorts` | Disable short positions | false |
| `--leverage <n>` | Leverage multiplier | 1 |

### Strategy Options

| Option | Description | Default |
|--------|-------------|---------|
| `--strategy <name>` | Strategy to test | all |
| `--lookback <n>` | Candles for indicators | 50 |

**Available Strategies:**
- `TrendFollower` - SMA crossover trend following
- `MeanReversion` - Bollinger Bands mean reversion
- `Momentum` - RSI-based momentum trading
- `Breakout` - Support/resistance breakout trading
- `all` - Run all strategies simultaneously

### Output Options

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <path>` | Output file path | - |
| `--format <fmt>` | console\|html\|json\|md | console |
| `-v, --verbose` | Show detailed logs | false |

## Programmatic Usage

### Basic Example

```typescript
import { BacktestEngine, BacktestDataLoader, ReportGenerator } from './backtest/runner';

// Load historical data
const dataLoader = new BacktestDataLoader();
const data = await dataLoader.loadFromExchange({
  exchange: 'binance',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-06-01')
});

// Configure and run backtest
const engine = new BacktestEngine({
  initialCapital: 10000,
  feeRate: 0.001,
  positionSizing: 'percent',
  positionSize: 2
});

// Add your strategy
engine.addStrategy({
  name: 'MyStrategy',
  description: 'Custom strategy',
  configure: () => {},
  analyze: async (marketData) => {
    // Return signals based on market data
    return [];
  }
});

// Run backtest
const result = await engine.run(data);

// Generate report
const reporter = new ReportGenerator();
reporter.printSummary(result);
await reporter.saveReport(result, 'reports/backtest.html');
```

### Custom Strategy Implementation

```typescript
import { Strategy, Signal } from '../strategies/manager';
import { MarketData } from '../exchanges/manager';

const myStrategy: Strategy = {
  name: 'CustomStrategy',
  description: 'My custom trading strategy',
  
  configure: (params) => {
    // Configure strategy parameters
  },
  
  analyze: async (data: MarketData[]): Promise<Signal[]> => {
    const signals: Signal[] = [];
    
    for (const market of data) {
      // Access OHLCV data for indicators
      const ohlcv = (market as any).ohlcv || [];
      
      // Your strategy logic here
      const shouldBuy = /* your condition */;
      
      if (shouldBuy) {
        signals.push({
          symbol: market.symbol,
          exchange: market.exchange,
          side: 'buy',
          amount: 0.01,
          price: market.price,
          strategy: 'CustomStrategy',
          confidence: 0.75, // 0-1 confidence score
          timestamp: new Date()
        });
      }
    }
    
    return signals;
  }
};
```

### Loading Data

```typescript
const dataLoader = new BacktestDataLoader();

// From exchange (requires internet)
const exchangeData = await dataLoader.loadFromExchange({
  exchange: 'binance',
  symbol: 'BTC/USDT',
  timeframe: '1h',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-06-01')
});

// From CSV file
const csvData = await dataLoader.loadFromCSV('data/btc_history.csv', {
  symbol: 'BTC/USDT',
  startDate: new Date('2024-01-01')
});

// From JSON file
const jsonData = await dataLoader.loadFromJSON('data/btc_history.json');

// Generate synthetic data (for testing)
const syntheticData = dataLoader.generateSyntheticData({
  symbol: 'TEST/USDT',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-06-01'),
  timeframe: '1h',
  startPrice: 50000,
  volatility: 2,  // % per candle
  trend: 0.01     // % bias (positive = uptrend)
});

// Save data for caching
await dataLoader.saveToFile(exchangeData, 'cache/btc_data.json');
```

## Performance Metrics

### Basic Metrics

| Metric | Description |
|--------|-------------|
| Total Trades | Number of completed trades |
| Win Rate | Percentage of winning trades |
| Profit Factor | Gross profit / Gross loss |
| Total P&L | Total profit/loss in currency |
| Net Profit | P&L after fees |

### Risk Metrics

| Metric | Description |
|--------|-------------|
| Max Drawdown | Largest peak-to-trough decline |
| Max DD Duration | Longest time to recover from drawdown |
| Recovery Factor | Net profit / Max drawdown |

### Risk-Adjusted Returns

| Metric | Description | Good Value |
|--------|-------------|------------|
| Sharpe Ratio | Risk-adjusted return (vs risk-free rate) | > 1.0 |
| Sortino Ratio | Like Sharpe, but only considers downside risk | > 1.5 |
| Calmar Ratio | Annual return / Max drawdown | > 0.5 |

### Expectancy

```
Expectancy = (Win Rate × Avg Win) - (Loss Rate × Avg Loss)
```

A positive expectancy means the strategy is profitable on average.

## CSV/JSON Data Format

### CSV Format

```csv
timestamp,open,high,low,close,volume
2024-01-01T00:00:00Z,42000.00,42500.00,41800.00,42300.00,1234.56
2024-01-01T01:00:00Z,42300.00,42600.00,42200.00,42550.00,987.65
```

### JSON Format

```json
{
  "symbol": "BTC/USDT",
  "exchange": "binance",
  "timeframe": "1h",
  "candles": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "open": 42000.00,
      "high": 42500.00,
      "low": 41800.00,
      "close": 42300.00,
      "volume": 1234.56
    }
  ]
}
```

## Report Formats

### HTML Report
Interactive report with:
- Summary cards (key metrics at a glance)
- Equity curve chart
- Drawdown chart
- Monthly returns bar chart
- Strategy breakdown table
- Full trade list

### JSON Report
Machine-readable format including:
- Complete metrics object
- All trades with timestamps
- Full equity curve data
- Configuration used

### Markdown Report
Human-readable text format suitable for:
- GitHub READMEs
- Documentation
- Email reports

## Architecture

```
src/backtest/
├── runner.ts       # CLI interface & main entry point
├── engine.ts       # Simulation engine
├── data-loader.ts  # Historical data loading
├── metrics.ts      # Performance calculations
└── report.ts       # Report generation
```

### Engine Flow

1. **Data Loading** - Fetch/load historical OHLCV data
2. **Initialization** - Reset state, configure positions
3. **Simulation Loop** - For each candle:
   - Check stop-loss/take-profit on open positions
   - Run strategy analysis
   - Execute valid signals
   - Update equity curve
4. **Cleanup** - Close remaining positions
5. **Metrics** - Calculate performance statistics
6. **Reporting** - Generate output

## Best Practices

### Data Quality
- Use at least 3-6 months of data for meaningful results
- Higher timeframes (1h+) are more reliable for backtesting
- Account for different market conditions (trending, ranging)

### Avoiding Overfitting
- Use out-of-sample testing (train on one period, test on another)
- Keep strategy rules simple
- Test across multiple assets/timeframes
- Be skeptical of perfect results

### Realistic Simulation
- Set appropriate fee rates (typically 0.1% for crypto)
- Include slippage (especially for larger positions)
- Use conservative position sizing (1-3% per trade)
- Account for margin/leverage properly

### Position Sizing

| Method | Description | Use When |
|--------|-------------|----------|
| `fixed` | Fixed dollar amount per trade | Consistent risk |
| `percent` | Percentage of capital | Scale with account |
| `kelly` | Kelly criterion (auto-calculated) | Advanced |

## Examples

### Trend Following Backtest

```bash
npm run backtest -- \
  -s BTC/USDT \
  -e binance \
  --start 2024-01-01 \
  --end 2024-06-01 \
  --strategy TrendFollower \
  --capital 10000 \
  --stop-loss 3 \
  --take-profit 6 \
  --format html \
  -o reports/trend_following.html
```

### Mean Reversion with No Shorts

```bash
npm run backtest -- \
  -s ETH/USDT \
  --strategy MeanReversion \
  --no-shorts \
  --position-size 3 \
  --format json \
  -o reports/mean_reversion.json
```

### All Strategies Comparison

```bash
npm run backtest -- \
  --synthetic \
  --strategy all \
  --capital 50000 \
  -v \
  --format html \
  -o reports/strategy_comparison.html
```

## Troubleshooting

### "Exchange not supported"
Make sure the exchange name is valid (e.g., `binance`, `kraken`, `coinbase`). Run with `-v` for more details.

### "Insufficient data"
The strategy needs enough historical data for its indicators. Increase the date range or reduce the lookback period.

### "No trades executed"
- Check strategy confidence thresholds
- Verify data contains valid price action
- Try running with `--verbose` to see signal generation

### Rate Limiting
When loading large amounts of data from exchanges, the loader automatically includes delays. For very long periods, consider saving data locally and using file loading.

---

*K.I.T. Backtesting Framework - Built for the K.I.T. Trading Bot Project*
