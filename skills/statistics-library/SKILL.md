# Statistics Library Skill

> 120+ statistical calculations in a single library - TradingView Featured Scripts inspired

## Overview

Comprehensive statistics library providing 120+ calculations for quantitative analysis, risk metrics, and strategy optimization. Based on TradingView's featured statistical libraries with K.I.T. enhancements.

## Categories

### 1. Descriptive Statistics (20+)
| Function | Description |
|----------|-------------|
| `mean()` | Arithmetic mean |
| `median()` | Median value |
| `mode()` | Most frequent value |
| `variance()` | Population variance |
| `stdev()` | Standard deviation |
| `skewness()` | Distribution asymmetry |
| `kurtosis()` | Distribution tail heaviness |
| `range()` | Max - Min |
| `iqr()` | Interquartile range |
| `percentile()` | Nth percentile |
| `zscore()` | Standardized score |
| `mad()` | Mean absolute deviation |
| `cv()` | Coefficient of variation |
| `sem()` | Standard error of mean |
| `gmean()` | Geometric mean |
| `hmean()` | Harmonic mean |
| `wmean()` | Weighted mean |
| `trimean()` | Tukey trimean |
| `winsorize()` | Winsorized mean |
| `entropy()` | Shannon entropy |

### 2. Risk Metrics (25+)
| Function | Description |
|----------|-------------|
| `sharpe()` | Sharpe ratio |
| `sortino()` | Sortino ratio (downside) |
| `calmar()` | Calmar ratio |
| `treynor()` | Treynor ratio |
| `omega()` | Omega ratio |
| `sterling()` | Sterling ratio |
| `burke()` | Burke ratio |
| `ulcer()` | Ulcer index |
| `pain()` | Pain index |
| `var()` | Value at Risk |
| `cvar()` | Conditional VaR (Expected Shortfall) |
| `maxDrawdown()` | Maximum drawdown |
| `avgDrawdown()` | Average drawdown |
| `recoveryTime()` | Time to recover from DD |
| `kellyFraction()` | Kelly criterion position sizing |
| `profitFactor()` | Gross profit / Gross loss |
| `expectancy()` | Expected value per trade |
| `sqn()` | System Quality Number |
| `lakeRatio()` | Lake ratio |
| `gainPain()` | Gain to pain ratio |
| `tail()` | Tail ratio |
| `commonSense()` | Common sense ratio |
| `cpc()` | CPC index |
| `kRatio()` | K-ratio |
| `martin()` | Martin ratio |

### 3. Correlation & Regression (20+)
| Function | Description |
|----------|-------------|
| `pearson()` | Pearson correlation |
| `spearman()` | Spearman rank correlation |
| `kendall()` | Kendall tau correlation |
| `beta()` | Market beta |
| `alpha()` | Jensen's alpha |
| `r2()` | R-squared |
| `adjR2()` | Adjusted R-squared |
| `covariance()` | Covariance |
| `autocorr()` | Autocorrelation |
| `crosscorr()` | Cross-correlation |
| `linearReg()` | Linear regression |
| `polyReg()` | Polynomial regression |
| `expReg()` | Exponential regression |
| `logReg()` | Logarithmic regression |
| `powerReg()` | Power regression |
| `residuals()` | Regression residuals |
| `durbin()` | Durbin-Watson statistic |
| `vif()` | Variance inflation factor |
| `partialCorr()` | Partial correlation |
| `semiCorr()` | Semi-correlation |

### 4. Time Series (25+)
| Function | Description |
|----------|-------------|
| `sma()` | Simple moving average |
| `ema()` | Exponential moving average |
| `wma()` | Weighted moving average |
| `hma()` | Hull moving average |
| `vwma()` | Volume-weighted MA |
| `dema()` | Double EMA |
| `tema()` | Triple EMA |
| `alma()` | Arnaud Legoux MA |
| `kama()` | Kaufman adaptive MA |
| `mcgd()` | McGinley dynamic |
| `linreg()` | Linear regression value |
| `diff()` | First difference |
| `pctChange()` | Percent change |
| `logReturn()` | Logarithmic returns |
| `momentum()` | Price momentum |
| `roc()` | Rate of change |
| `atr()` | Average true range |
| `tr()` | True range |
| `highest()` | Highest value |
| `lowest()` | Lowest value |
| `stoch()` | Stochastic oscillator |
| `rsi()` | Relative strength index |
| `cci()` | Commodity channel index |
| `adx()` | Average directional index |
| `aroon()` | Aroon indicator |

### 5. Distribution & Probability (15+)
| Function | Description |
|----------|-------------|
| `normalPdf()` | Normal probability density |
| `normalCdf()` | Normal cumulative distribution |
| `normalInv()` | Inverse normal |
| `tPdf()` | Student's t PDF |
| `tCdf()` | Student's t CDF |
| `chiSqPdf()` | Chi-squared PDF |
| `chiSqCdf()` | Chi-squared CDF |
| `fPdf()` | F-distribution PDF |
| `fCdf()` | F-distribution CDF |
| `binomPmf()` | Binomial PMF |
| `binomCdf()` | Binomial CDF |
| `poissonPmf()` | Poisson PMF |
| `poissonCdf()` | Poisson CDF |
| `expPdf()` | Exponential PDF |
| `expCdf()` | Exponential CDF |

### 6. Hypothesis Testing (15+)
| Function | Description |
|----------|-------------|
| `tTest()` | Student's t-test |
| `zTest()` | Z-test |
| `chiSqTest()` | Chi-squared test |
| `fTest()` | F-test |
| `anova()` | Analysis of variance |
| `mannWhitney()` | Mann-Whitney U test |
| `wilcoxon()` | Wilcoxon signed-rank |
| `kruskal()` | Kruskal-Wallis test |
| `levene()` | Levene's test |
| `shapiro()` | Shapiro-Wilk normality |
| `jarqueBera()` | Jarque-Bera normality |
| `adf()` | Augmented Dickey-Fuller |
| `kpss()` | KPSS stationarity |
| `granger()` | Granger causality |
| `cointegration()` | Cointegration test |

## Usage

```typescript
import stats from '@kit/statistics-library';

// Calculate Sharpe ratio
const sharpe = stats.sharpe(returns, riskFreeRate);

// Get full risk report
const riskReport = stats.riskReport(equity, {
  riskFreeRate: 0.02,
  benchmark: 'SPY',
  confidence: 0.95
});

// Correlation matrix
const corrMatrix = stats.correlationMatrix([btc, eth, sol, avax]);

// Regression analysis
const reg = stats.linearReg(x, y, { 
  includeStats: true,
  forecast: 10 
});
```

## Commands

- `kit stats calc <function> <data>` - Calculate statistic
- `kit stats risk <equity>` - Full risk report
- `kit stats corr <symbols>` - Correlation matrix
- `kit stats test <hypothesis> <data>` - Run hypothesis test
- `kit stats export <format>` - Export calculations

## Performance

- **Vectorized:** Operations use SIMD where available
- **Streaming:** Handle infinite data streams
- **Cached:** Memoized calculations
- **GPU:** Optional GPU acceleration for large datasets
