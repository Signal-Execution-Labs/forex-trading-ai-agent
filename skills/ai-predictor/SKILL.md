# AI Market Predictor

**K.I.T.'s brain for price predictions - Machine Learning that WORKS!**

## Features

### 🔮 LSTM Neural Networks
- Time Series Prediction mit Deep Learning
- Multi-Step Forecasting (1h, 4h, 24h, 7d)
- Attention Mechanisms für wichtige Patterns

### 📊 Feature Engineering
- Technical Indicators (RSI, MACD, Bollinger, 50+ mehr)
- Volume Profile Analysis
- Order Flow Imbalance
- Funding Rates (Perps)
- Open Interest Changes

### 🎯 Confidence Scoring
- Monte Carlo Dropout für Uncertainty Estimation
- Ensemble Models für robustere Predictions
- Dynamische Confidence basierend auf Volatilität

### 🏆 Model Performance
- Rolling Backtests
- Walk-Forward Optimization
- Real-time Model Retraining

## Usage

```python
from ai_predictor import MarketPredictor

predictor = MarketPredictor()

# Single prediction
prediction = await predictor.predict(
    symbol="BTC/USDT",
    timeframe="1h",
    horizon=24  # hours ahead
)

print(f"Price: ${prediction.price:.2f}")
print(f"Direction: {prediction.direction}")  # UP/DOWN/NEUTRAL
print(f"Confidence: {prediction.confidence:.1%}")
print(f"Range: ${prediction.low:.2f} - ${prediction.high:.2f}")

# Batch predictions
predictions = await predictor.predict_batch(
    symbols=["BTC/USDT", "ETH/USDT", "SOL/USDT"],
    timeframe="4h",
    horizon=168  # 1 week
)
```

## Models

| Model | Use Case | Accuracy |
|-------|----------|----------|
| LSTM-Attention | Short-term (1-24h) | ~65% direction |
| Transformer | Medium-term (1-7d) | ~58% direction |
| XGBoost Ensemble | Volatility Prediction | MAE < 2% |
| CNN-LSTM | Pattern Recognition | ~62% breakouts |

## Configuration

```yaml
ai_predictor:
  models:
    lstm:
      layers: [128, 64, 32]
      dropout: 0.2
      attention: true
    ensemble_size: 5
  
  features:
    technical: true
    orderflow: true
    sentiment: true  # requires sentiment-analyzer
    
  training:
    lookback: 168  # hours
    retrain_interval: 24h
    min_samples: 1000
```

## Dependencies
- tensorflow>=2.15.0
- scikit-learn>=1.3.0
- ta-lib (technical analysis)
- numpy, pandas
