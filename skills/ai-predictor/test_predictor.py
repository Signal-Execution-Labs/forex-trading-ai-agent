#!/usr/bin/env python3
"""
Quick test for K.I.T. AI Market Predictor
Works without TensorFlow using sklearn only
"""
import sys
import os

# Fix Windows encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import json

# Test sklearn availability
try:
    from sklearn.preprocessing import MinMaxScaler
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    print("[OK] scikit-learn available")
except ImportError:
    print("[ERROR] scikit-learn not installed!")
    sys.exit(1)

# Test xgboost
try:
    import xgboost as xgb
    print("[OK] XGBoost available")
    XGB_AVAILABLE = True
except ImportError:
    print("[WARN] XGBoost not available, using sklearn only")
    XGB_AVAILABLE = False

print("\n" + "="*60)
print("K.I.T. AI Market Predictor - Live Test")
print("="*60)

# Generate synthetic market data
def generate_market_data(symbol: str, n: int = 500):
    """Generate realistic-looking price data"""
    np.random.seed(42)
    
    # Start price based on symbol
    if "BTC" in symbol:
        base_price = 97000
        volatility = 500
    elif "ETH" in symbol:
        base_price = 2700
        volatility = 50
    elif "SOL" in symbol:
        base_price = 195
        volatility = 5
    else:
        base_price = 100
        volatility = 2
    
    # Random walk with trend
    returns = np.random.randn(n) * 0.02 + 0.0001  # Slight upward bias
    prices = base_price * np.cumprod(1 + returns)
    
    df = pd.DataFrame({
        'timestamp': pd.date_range(end=datetime.now(), periods=n, freq='1h'),
        'open': prices + np.random.randn(n) * volatility * 0.1,
        'close': prices,
        'volume': np.random.uniform(1000, 10000, n)
    })
    df['high'] = df[['open', 'close']].max(axis=1) + np.random.uniform(0, volatility, n)
    df['low'] = df[['open', 'close']].min(axis=1) - np.random.uniform(0, volatility, n)
    df.set_index('timestamp', inplace=True)
    
    return df

# Feature engineering
def calculate_features(df: pd.DataFrame) -> pd.DataFrame:
    """Calculate technical indicators"""
    features = pd.DataFrame(index=df.index)
    
    # Returns
    features['returns'] = df['close'].pct_change()
    features['log_returns'] = np.log(df['close'] / df['close'].shift(1))
    
    # Moving averages
    for period in [7, 14, 21, 50]:
        features[f'sma_{period}'] = df['close'].rolling(period).mean()
        features[f'ema_{period}'] = df['close'].ewm(span=period).mean()
        features[f'price_sma_{period}_ratio'] = df['close'] / features[f'sma_{period}']
    
    # RSI
    for period in [7, 14]:
        delta = df['close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        rs = gain / (loss + 1e-10)
        features[f'rsi_{period}'] = 100 - (100 / (1 + rs))
    
    # MACD
    exp1 = df['close'].ewm(span=12).mean()
    exp2 = df['close'].ewm(span=26).mean()
    features['macd'] = exp1 - exp2
    features['macd_signal'] = features['macd'].ewm(span=9).mean()
    
    # Bollinger Bands position
    sma20 = df['close'].rolling(20).mean()
    std20 = df['close'].rolling(20).std()
    features['bb_upper'] = sma20 + (std20 * 2)
    features['bb_lower'] = sma20 - (std20 * 2)
    features['bb_position'] = (df['close'] - features['bb_lower']) / (features['bb_upper'] - features['bb_lower'] + 1e-10)
    
    # Volatility
    features['volatility'] = features['returns'].rolling(20).std()
    
    # Volume
    features['volume_sma'] = df['volume'].rolling(20).mean()
    features['volume_ratio'] = df['volume'] / (features['volume_sma'] + 1e-10)
    
    # Momentum
    for period in [5, 10, 20]:
        features[f'momentum_{period}'] = df['close'] / df['close'].shift(period) - 1
    
    return features.replace([np.inf, -np.inf], np.nan).dropna()

# Ensemble predictor
class SimpleEnsemblePredictor:
    def __init__(self):
        self.models = {}
        self.scaler = MinMaxScaler()
        
    def train(self, X: np.ndarray, y: np.ndarray):
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Random Forest
        self.models['rf'] = RandomForestRegressor(n_estimators=50, max_depth=8, n_jobs=-1)
        self.models['rf'].fit(X_scaled, y)
        
        # Gradient Boosting
        self.models['gb'] = GradientBoostingRegressor(n_estimators=50, max_depth=4, learning_rate=0.1)
        self.models['gb'].fit(X_scaled, y)
        
        # XGBoost if available
        if XGB_AVAILABLE:
            self.models['xgb'] = xgb.XGBRegressor(n_estimators=50, max_depth=5, learning_rate=0.1, verbosity=0)
            self.models['xgb'].fit(X_scaled, y)
    
    def predict(self, X: np.ndarray):
        X_scaled = self.scaler.transform(X.reshape(1, -1))
        
        predictions = []
        for name, model in self.models.items():
            pred = model.predict(X_scaled)[0]
            predictions.append(pred)
        
        mean_pred = np.mean(predictions)
        std_pred = np.std(predictions) if len(predictions) > 1 else 0
        
        # Confidence based on model agreement
        confidence = max(0.3, min(0.95, 1 - (std_pred / (abs(mean_pred) + 1e-10))))
        
        return mean_pred, confidence

# Main prediction function
def predict_price(symbol: str, horizon: int = 24):
    """Predict price for a symbol"""
    print(f"\n[PREDICT] {symbol} - {horizon}h ahead")
    
    # Get data
    df = generate_market_data(symbol)
    features = calculate_features(df)
    
    current_price = df['close'].iloc[-1]
    print(f"  Current price: ${current_price:,.2f}")
    print(f"  Features calculated: {len(features.columns)}")
    
    # Prepare training data
    X = features.values
    y = df['close'].iloc[len(df) - len(features):].values
    
    # Use last 80% for training, predict from last row
    train_size = int(len(X) * 0.8)
    X_train, y_train = X[:train_size], y[:train_size]
    
    # Train ensemble
    print("  Training ensemble models...")
    ensemble = SimpleEnsemblePredictor()
    ensemble.train(X_train, y_train)
    
    # Predict
    pred_price, confidence = ensemble.predict(X[-1])
    
    # Adjust for horizon (momentum extrapolation)
    recent_momentum = (df['close'].iloc[-1] / df['close'].iloc[-horizon] - 1) if len(df) > horizon else 0
    pred_price = pred_price * (1 + recent_momentum * 0.3)  # Partial momentum continuation
    
    # Direction
    change = (pred_price - current_price) / current_price
    if change > 0.01:
        direction = "UP"
    elif change < -0.01:
        direction = "DOWN"
    else:
        direction = "NEUTRAL"
    
    # Prediction range
    vol = df['close'].pct_change().std() * np.sqrt(horizon)
    low = pred_price * (1 - vol * 2)
    high = pred_price * (1 + vol * 2)
    
    result = {
        "symbol": symbol,
        "current_price": round(current_price, 2),
        "predicted_price": round(pred_price, 2),
        "direction": direction,
        "confidence": round(confidence * 100, 1),
        "expected_return": f"{change*100:+.2f}%",
        "range": {"low": round(low, 2), "high": round(high, 2)},
        "horizon_hours": horizon,
        "models_used": list(ensemble.models.keys())
    }
    
    print(f"\n  PREDICTION: {direction} to ${pred_price:,.2f}")
    print(f"  Confidence: {confidence*100:.1f}%")
    print(f"  Expected return: {change*100:+.2f}%")
    print(f"  Range: ${low:,.2f} - ${high:,.2f}")
    
    return result

# Run tests
if __name__ == "__main__":
    print("\n" + "-"*60)
    print("Running predictions...")
    print("-"*60)
    
    symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
    results = []
    
    for symbol in symbols:
        result = predict_price(symbol, horizon=24)
        results.append(result)
    
    print("\n" + "="*60)
    print("SUMMARY - 24h Predictions")
    print("="*60)
    print(f"{'Symbol':<12} {'Direction':<10} {'Predicted':>12} {'Conf':>8} {'Return':>10}")
    print("-"*60)
    
    for r in results:
        print(f"{r['symbol']:<12} {r['direction']:<10} ${r['predicted_price']:>10,.2f} {r['confidence']:>7.1f}% {r['expected_return']:>10}")
    
    print("\n[SUCCESS] AI Predictor test completed!")
    print(f"Models used: {results[0]['models_used']}")
