# Market Correlation Matrix Analyzer

## Description
Real-time correlation analysis between assets for portfolio optimization and risk management.

## Features
- **Rolling Correlation** - 20/50/100 day rolling windows
- **Cross-Asset Analysis** - Stocks vs Crypto vs Forex vs Commodities
- **Regime Detection** - Detect correlation regime changes (risk-on/risk-off)
- **Heatmap Visualization** - Visual correlation matrices
- **Diversification Scorer** - Portfolio diversification quality score
- **Beta Calculation** - Asset beta to benchmark (SPY, BTC)
- **Pair Clustering** - K-means clustering of correlated assets
- **Stress Testing** - Correlation behavior during market stress

## Use Cases
1. **Portfolio Construction** - Find uncorrelated assets for diversification
2. **Risk Management** - Monitor correlation breakdown during crises
3. **Pairs Trading** - Identify highly correlated pairs for spread trading
4. **Regime Trading** - Adapt strategy based on correlation regimes
5. **Sector Rotation** - Track sector correlations for rotation strategies

## Commands
```
analyze correlation BTC ETH GOLD SPY --window 30d
correlation heatmap my-portfolio
diversification score my-portfolio
find uncorrelated BTC --min-assets 5
correlation regime --detect
stress test my-portfolio --scenario 2020-covid
beta calculate NVDA --benchmark SPY
cluster assets --method kmeans --k 5
```

## Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| window | string | 30d | Rolling window for correlation |
| method | string | pearson | pearson, spearman, or kendall |
| min_correlation | float | 0.7 | Minimum correlation for pairs |
| max_correlation | float | 0.3 | Maximum for diversification |
| regime_threshold | float | 0.2 | Change threshold for regime detection |
| benchmark | string | SPY | Benchmark for beta calculation |

## Outputs
- Correlation matrix (JSON/CSV/visual heatmap)
- Diversification score (0-100)
- Beta values per asset
- Regime change alerts
- Cluster assignments
- Portfolio optimization suggestions

## Technical Implementation
- Uses Pandas for correlation calculations
- NumPy for matrix operations
- SciPy for clustering algorithms
- Matplotlib/Plotly for visualizations
- Real-time updates via WebSocket data feeds

## Risk Considerations
- Correlations change over time (non-stationary)
- Past correlations don't guarantee future behavior
- Crisis correlations typically spike (diversification fails when needed most)
- Use multiple timeframes for robust analysis
