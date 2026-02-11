# Fundamental Comparator

Compare key financial metrics across multiple symbols on a single chart. Overlay price charts with fundamentals for direct, side-by-side comparison.

## Category
Analysis

## Inspired By
- TradingView Fundamental Graphs
- Koyfin
- FinViz

## Features

### 100+ Metrics Available
- **Valuation**: P/E, P/B, P/S, EV/EBITDA, PEG Ratio
- **Profitability**: ROE, ROA, ROIC, Net Margin, Gross Margin
- **Growth**: Revenue Growth, EPS Growth, Free Cash Flow Growth
- **Dividends**: Yield, Payout Ratio, Dividend Growth Rate
- **Debt**: Debt/Equity, Interest Coverage, Current Ratio
- **Efficiency**: Asset Turnover, Inventory Turnover
- **Per Share**: EPS, Book Value, Revenue, Free Cash Flow

### Comparison Modes
- **Cross-Company**: Compare AAPL vs MSFT vs GOOGL
- **Sector Average**: Company vs sector benchmark
- **Historical**: Same company over time
- **Peer Group**: Auto-selected industry peers

### Visualization
- **Multi-Line Charts**: Overlay any metrics
- **Price + Fundamental**: Dual-axis charts
- **Heatmaps**: Sector-wide metric comparison
- **Scatter Plots**: Correlation analysis (P/E vs Growth)
- **Ranking Tables**: Sort by any metric

### Screening Integration
- **Undervalued Finder**: P/E < sector + growth > sector
- **Quality Score**: Composite fundamental rating
- **Momentum + Value**: Combine technical and fundamental
- **Dividend Aristocrats**: Filter by dividend history

### AI Analysis
- **Metric Interpretation**: "Why is this P/E ratio concerning?"
- **Peer Comparison**: "How does this compare to competitors?"
- **Trend Analysis**: "Are margins improving or declining?"
- **Risk Assessment**: "What does this debt level mean?"

## Usage

```typescript
import { FundamentalComparator } from 'kit-trading/skills/fundamental-comparator';

const comparator = new FundamentalComparator();

// Compare P/E ratios
const comparison = await comparator.compare(
  ['AAPL', 'MSFT', 'GOOGL', 'META'],
  ['peRatio', 'revenueGrowth', 'netMargin']
);

// Get fundamental score
const score = await comparator.score('NVDA');
// { overall: 85, valuation: 60, profitability: 95, growth: 98 }

// Find undervalued stocks
const undervalued = await comparator.screen({
  peRatio: { lt: 15 },
  revenueGrowth: { gt: 20 },
  debtToEquity: { lt: 0.5 }
});
```

## API Endpoints

- `GET /api/fundamentals/:symbol` - Full fundamental data
- `POST /api/fundamentals/compare` - Multi-symbol comparison
- `GET /api/fundamentals/metrics` - Available metrics list
- `POST /api/fundamentals/screen` - Filter by fundamentals
- `GET /api/fundamentals/:symbol/history` - Historical metrics
