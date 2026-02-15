#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
K.I.T. Autonomous Paper Trader v2.0
Now with Machine Learning predictions!

Features:
- Real market data from CoinGecko
- ML-based price prediction (sklearn ensemble)
- Technical indicator analysis
- Risk management
- Position tracking
"""

import json
import os
import sys
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
import random
import numpy as np

# Fix Windows console encoding
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except:
        pass

# ML imports
try:
    from sklearn.preprocessing import MinMaxScaler
    from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
    ML_AVAILABLE = True
    print("[ML] scikit-learn loaded - ML predictions enabled")
except ImportError:
    ML_AVAILABLE = False
    print("[ML] scikit-learn not available - using rule-based only")

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False
    print("[WARN] pandas not available - limited ML features")

# Paths
BASE_DIR = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "config.json"
STATE_FILE = BASE_DIR / "state.json"
LOG_DIR = BASE_DIR / "logs"
ML_CACHE_DIR = BASE_DIR / "ml_cache"

# Ensure directories exist
LOG_DIR.mkdir(exist_ok=True)
ML_CACHE_DIR.mkdir(exist_ok=True)


# =============================================================================
# ML PREDICTOR - Integrated from ai-predictor skill
# =============================================================================

class MLPredictor:
    """
    Machine Learning predictor for K.I.T.
    Uses sklearn ensemble (Random Forest + Gradient Boosting)
    """
    
    def __init__(self):
        self.models = {}
        self.scaler = MinMaxScaler() if ML_AVAILABLE else None
        self.price_history = {}  # symbol -> list of prices
        self.history_limit = 200
        
    def add_price(self, symbol: str, price: float, change: float):
        """Add price to history for ML training"""
        if symbol not in self.price_history:
            self.price_history[symbol] = []
        
        self.price_history[symbol].append({
            'price': price,
            'change': change,
            'timestamp': datetime.utcnow().isoformat()
        })
        
        # Keep limited history
        if len(self.price_history[symbol]) > self.history_limit:
            self.price_history[symbol] = self.price_history[symbol][-self.history_limit:]
    
    def calculate_features(self, prices: list) -> np.ndarray:
        """Calculate technical indicators from price history"""
        if len(prices) < 20:
            return None
        
        close = np.array([p['price'] for p in prices])
        changes = np.array([p['change'] for p in prices])
        
        features = []
        
        # Price momentum
        features.append(close[-1] / close[-5] - 1 if len(close) >= 5 else 0)  # 5-period momentum
        features.append(close[-1] / close[-10] - 1 if len(close) >= 10 else 0)  # 10-period momentum
        features.append(close[-1] / close[-20] - 1 if len(close) >= 20 else 0)  # 20-period momentum
        
        # Moving averages ratio
        sma5 = np.mean(close[-5:]) if len(close) >= 5 else close[-1]
        sma10 = np.mean(close[-10:]) if len(close) >= 10 else close[-1]
        sma20 = np.mean(close[-20:]) if len(close) >= 20 else close[-1]
        
        features.append(close[-1] / sma5 - 1)
        features.append(close[-1] / sma10 - 1)
        features.append(close[-1] / sma20 - 1)
        features.append(sma5 / sma20 - 1)  # MA crossover signal
        
        # RSI approximation
        gains = np.maximum(np.diff(close[-15:]), 0)
        losses = np.abs(np.minimum(np.diff(close[-15:]), 0))
        avg_gain = np.mean(gains) if len(gains) > 0 else 0.001
        avg_loss = np.mean(losses) if len(losses) > 0 else 0.001
        rs = avg_gain / (avg_loss + 1e-10)
        rsi = 100 - (100 / (1 + rs))
        features.append(rsi / 100)  # Normalized RSI
        
        # Volatility
        returns = np.diff(close[-20:]) / close[-20:-1]
        volatility = np.std(returns) if len(returns) > 1 else 0
        features.append(volatility)
        
        # Recent change
        features.append(changes[-1] / 100 if len(changes) > 0 else 0)
        
        # Trend strength (price above/below MAs)
        above_sma5 = 1 if close[-1] > sma5 else 0
        above_sma10 = 1 if close[-1] > sma10 else 0
        above_sma20 = 1 if close[-1] > sma20 else 0
        features.append((above_sma5 + above_sma10 + above_sma20) / 3)
        
        return np.array(features)
    
    def train_model(self, symbol: str):
        """Train ML model for a symbol"""
        if not ML_AVAILABLE or symbol not in self.price_history:
            return False
        
        prices = self.price_history[symbol]
        if len(prices) < 50:  # Need minimum data
            return False
        
        # Prepare training data
        X, y = [], []
        for i in range(30, len(prices) - 1):
            features = self.calculate_features(prices[:i])
            if features is not None:
                X.append(features)
                # Target: next price direction (1 = up, 0 = down)
                next_change = (prices[i+1]['price'] - prices[i]['price']) / prices[i]['price']
                y.append(1 if next_change > 0 else 0)
        
        if len(X) < 20:
            return False
        
        X = np.array(X)
        y = np.array(y)
        
        # Train ensemble
        self.models[symbol] = {
            'rf': RandomForestRegressor(n_estimators=30, max_depth=5, n_jobs=-1),
            'gb': GradientBoostingRegressor(n_estimators=30, max_depth=3, learning_rate=0.1)
        }
        
        for name, model in self.models[symbol].items():
            model.fit(X, y)
        
        print(f"  [ML] Trained model for {symbol} with {len(X)} samples")
        return True
    
    def predict(self, symbol: str) -> tuple:
        """
        Predict price direction for a symbol
        Returns: (direction, confidence)
        - direction: 'up', 'down', 'neutral'
        - confidence: 0-100
        """
        if not ML_AVAILABLE or symbol not in self.price_history:
            return 'neutral', 50
        
        prices = self.price_history[symbol]
        if len(prices) < 20:
            return 'neutral', 50
        
        # Train if not already trained
        if symbol not in self.models:
            if not self.train_model(symbol):
                return 'neutral', 50
        
        # Calculate features
        features = self.calculate_features(prices)
        if features is None:
            return 'neutral', 50
        
        # Get predictions from ensemble
        predictions = []
        for name, model in self.models[symbol].items():
            try:
                pred = model.predict(features.reshape(1, -1))[0]
                predictions.append(pred)
            except Exception as e:
                print(f"  [ML] Prediction error: {e}")
        
        if not predictions:
            return 'neutral', 50
        
        # Average prediction
        avg_pred = np.mean(predictions)
        
        # Determine direction and confidence
        if avg_pred > 0.6:
            direction = 'up'
            confidence = int(min(95, 50 + (avg_pred - 0.5) * 100))
        elif avg_pred < 0.4:
            direction = 'down'
            confidence = int(min(95, 50 + (0.5 - avg_pred) * 100))
        else:
            direction = 'neutral'
            confidence = 50
        
        return direction, confidence


# Global ML predictor instance
ml_predictor = MLPredictor() if ML_AVAILABLE else None


# =============================================================================
# CORE FUNCTIONS
# =============================================================================

def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)

def load_state():
    with open(STATE_FILE) as f:
        return json.load(f)

def save_state(state):
    state["lastUpdate"] = datetime.utcnow().isoformat() + "Z"
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def get_crypto_prices():
    """Fetch real crypto prices from CoinGecko"""
    try:
        url = "https://api.coingecko.com/api/v3/simple/price"
        params = {
            "ids": "bitcoin,ethereum,solana,binancecoin,ripple",
            "vs_currencies": "eur",
            "include_24hr_change": "true"
        }
        resp = requests.get(url, params=params, timeout=10)
        data = resp.json()
        return {
            "BTC/EUR": {"price": data.get("bitcoin", {}).get("eur", 0), "change": data.get("bitcoin", {}).get("eur_24h_change", 0)},
            "ETH/EUR": {"price": data.get("ethereum", {}).get("eur", 0), "change": data.get("ethereum", {}).get("eur_24h_change", 0)},
            "SOL/EUR": {"price": data.get("solana", {}).get("eur", 0), "change": data.get("solana", {}).get("eur_24h_change", 0)},
            "BNB/EUR": {"price": data.get("binancecoin", {}).get("eur", 0), "change": data.get("binancecoin", {}).get("eur_24h_change", 0)},
            "XRP/EUR": {"price": data.get("ripple", {}).get("eur", 0), "change": data.get("ripple", {}).get("eur_24h_change", 0)},
        }
    except Exception as e:
        print(f"Error fetching crypto prices: {e}")
        return {}

def get_forex_prices():
    """Fetch forex prices (using approximate rates with fluctuation)"""
    try:
        base_rates = {
            "EUR/USD": 1.0820,
            "GBP/USD": 1.2650,
            "USD/JPY": 149.50,
            "EUR/GBP": 0.8550,
            "AUD/USD": 0.6520,
        }
        prices = {}
        for pair, base in base_rates.items():
            fluctuation = random.uniform(-0.002, 0.002)
            prices[pair] = {
                "price": round(base * (1 + fluctuation), 5),
                "change": round(random.uniform(-0.5, 0.5), 2)
            }
        return prices
    except Exception as e:
        print(f"Error fetching forex prices: {e}")
        return {}

def analyze_market(symbol, price_data, state):
    """
    Hybrid analysis: ML predictions + rule-based signals
    Returns: action (buy/sell/hold), confidence (0-100), reason
    """
    price = price_data.get("price", 0)
    change = price_data.get("change", 0)
    
    # Add to ML history
    if ml_predictor:
        ml_predictor.add_price(symbol, price, change)
    
    # Check for open position
    open_position = None
    for pos in state["positions"]:
        if pos["symbol"] == symbol:
            open_position = pos
            break
    
    # =========================================================================
    # HYBRID ANALYSIS: ML + Rules
    # =========================================================================
    
    signals = []
    score = 50  # Start neutral
    ml_direction = 'neutral'
    ml_confidence = 50
    
    # 1. ML Prediction (if available)
    if ml_predictor and len(ml_predictor.price_history.get(symbol, [])) >= 20:
        ml_direction, ml_confidence = ml_predictor.predict(symbol)
        
        if ml_direction == 'up':
            signals.append(f"ML: Bullish ({ml_confidence}%)")
            score += (ml_confidence - 50) * 0.5
        elif ml_direction == 'down':
            signals.append(f"ML: Bearish ({ml_confidence}%)")
            score -= (ml_confidence - 50) * 0.5
    
    # 2. Rule-based signals
    if change > 2:
        signals.append("Strong bullish momentum")
        score += 12
    elif change > 0.5:
        signals.append("Mild bullish")
        score += 6
    elif change < -2:
        signals.append("Strong bearish momentum")
        score -= 12
    elif change < -0.5:
        signals.append("Mild bearish")
        score -= 6
    
    # Mean reversion opportunity
    if change < -3:
        signals.append("Potential oversold bounce")
        score += 8
    elif change > 3:
        signals.append("Potential overbought pullback")
        score -= 8
    
    # Add small market noise
    market_noise = random.randint(-5, 5)
    score += market_noise
    
    # =========================================================================
    # POSITION MANAGEMENT
    # =========================================================================
    
    if open_position:
        entry_price = open_position["entryPrice"]
        pnl_percent = ((price - entry_price) / entry_price) * 100
        
        if open_position["direction"] == "long":
            # Take profit
            if pnl_percent >= 3:
                return "close", 85, f"Take profit at +{pnl_percent:.1f}%"
            # Stop loss
            elif pnl_percent <= -2:
                return "close", 90, f"Stop loss at {pnl_percent:.1f}%"
            # ML says strong down - consider early exit
            elif ml_direction == 'down' and ml_confidence >= 70 and pnl_percent > 0:
                return "close", 75, f"ML exit signal ({ml_confidence}%) at +{pnl_percent:.1f}%"
            else:
                return "hold", 60, f"Position running at {pnl_percent:+.1f}%"
    else:
        # Look for entry
        if score >= 65:
            confidence = min(int(score), 95)
            return "buy", confidence, " | ".join(signals) if signals else "Bullish setup"
        elif score <= 35:
            confidence = min(100 - int(score), 95)
            return "sell", confidence, " | ".join(signals) if signals else "Bearish setup"
    
    return "hold", 50, "No clear setup"

def execute_paper_trade(state, config, symbol, action, price, confidence, reason):
    """Execute a paper trade and update state"""
    now = datetime.utcnow()
    capital = state["portfolio"]["currentCapital"]
    
    if action == "buy":
        position_size_eur = capital * (config["riskManagement"]["maxPositionSizePercent"] / 100)
        quantity = position_size_eur / price
        
        if len(state["positions"]) >= config["riskManagement"]["maxOpenPositions"]:
            return None
        
        position = {
            "id": f"pos_{now.strftime('%Y%m%d%H%M%S')}_{symbol.replace('/', '')}",
            "symbol": symbol,
            "direction": "long",
            "entryPrice": price,
            "quantity": quantity,
            "entryTime": now.isoformat() + "Z",
            "stopLoss": price * (1 - config["riskManagement"]["defaultStopLossPercent"] / 100),
            "takeProfit": price * (1 + config["riskManagement"]["defaultTakeProfitPercent"] / 100),
            "confidence": confidence,
            "reason": reason,
            "mlEnabled": ML_AVAILABLE
        }
        
        state["positions"].append(position)
        
        decision = {
            "timestamp": now.isoformat() + "Z",
            "action": "OPEN_LONG",
            "symbol": symbol,
            "price": price,
            "quantity": quantity,
            "value": position_size_eur,
            "confidence": confidence,
            "reason": reason,
            "mlPrediction": ml_predictor.predict(symbol) if ml_predictor else None
        }
        state["decisions"].append(decision)
        
        return position
    
    elif action == "close":
        for i, pos in enumerate(state["positions"]):
            if pos["symbol"] == symbol:
                entry_price = pos["entryPrice"]
                quantity = pos["quantity"]
                pnl = (price - entry_price) * quantity
                pnl_percent = ((price - entry_price) / entry_price) * 100
                
                state["portfolio"]["currentCapital"] += pnl
                state["portfolio"]["realizedPnL"] += pnl
                state["portfolio"]["totalPnL"] = state["portfolio"]["currentCapital"] - state["portfolio"]["initialCapital"]
                state["portfolio"]["totalPnLPercent"] = (state["portfolio"]["totalPnL"] / state["portfolio"]["initialCapital"]) * 100
                
                if state["portfolio"]["currentCapital"] > state["portfolio"]["highWaterMark"]:
                    state["portfolio"]["highWaterMark"] = state["portfolio"]["currentCapital"]
                
                current_dd = state["portfolio"]["highWaterMark"] - state["portfolio"]["currentCapital"]
                current_dd_percent = (current_dd / state["portfolio"]["highWaterMark"]) * 100
                if current_dd_percent > state["portfolio"]["maxDrawdownPercent"]:
                    state["portfolio"]["maxDrawdownPercent"] = current_dd_percent
                    state["portfolio"]["maxDrawdown"] = current_dd
                
                trade = {
                    "id": pos["id"],
                    "symbol": symbol,
                    "direction": pos["direction"],
                    "entryPrice": entry_price,
                    "exitPrice": price,
                    "quantity": quantity,
                    "entryTime": pos["entryTime"],
                    "exitTime": now.isoformat() + "Z",
                    "pnl": round(pnl, 2),
                    "pnlPercent": round(pnl_percent, 2),
                    "isWin": pnl > 0,
                    "reason": reason,
                    "mlEnabled": pos.get("mlEnabled", False)
                }
                state["tradeHistory"].append(trade)
                
                stats = state["statistics"]
                stats["totalTrades"] += 1
                if pnl > 0:
                    stats["winningTrades"] += 1
                    if pnl > stats["largestWin"]:
                        stats["largestWin"] = pnl
                else:
                    stats["losingTrades"] += 1
                    if pnl < stats["largestLoss"]:
                        stats["largestLoss"] = pnl
                
                if stats["totalTrades"] > 0:
                    stats["winRate"] = (stats["winningTrades"] / stats["totalTrades"]) * 100
                
                decision = {
                    "timestamp": now.isoformat() + "Z",
                    "action": "CLOSE_LONG",
                    "symbol": symbol,
                    "entryPrice": entry_price,
                    "exitPrice": price,
                    "pnl": round(pnl, 2),
                    "pnlPercent": round(pnl_percent, 2),
                    "reason": reason
                }
                state["decisions"].append(decision)
                
                state["positions"].pop(i)
                return trade
    
    return None

def update_unrealized_pnl(state, prices):
    """Update unrealized P&L for open positions"""
    unrealized = 0
    for pos in state["positions"]:
        symbol = pos["symbol"]
        if symbol in prices:
            current_price = prices[symbol]["price"]
            entry_price = pos["entryPrice"]
            quantity = pos["quantity"]
            pnl = (current_price - entry_price) * quantity
            unrealized += pnl
            pos["currentPrice"] = current_price
            pos["unrealizedPnL"] = round(pnl, 2)
            pos["unrealizedPnLPercent"] = round(((current_price - entry_price) / entry_price) * 100, 2)
    
    state["portfolio"]["unrealizedPnL"] = round(unrealized, 2)

def run_trading_cycle():
    """Main trading cycle - called periodically"""
    print(f"\n{'='*60}")
    print(f"K.I.T. Autonomous Trader v2.0 - {datetime.utcnow().isoformat()}")
    print(f"ML Predictions: {'ENABLED' if ML_AVAILABLE else 'DISABLED'}")
    print(f"{'='*60}")
    
    config = load_config()
    state = load_state()
    
    all_prices = {}
    
    if config["markets"]["crypto"]["enabled"]:
        crypto_prices = get_crypto_prices()
        all_prices.update(crypto_prices)
        print(f"\n[CRYPTO] Prices:")
        for sym, data in crypto_prices.items():
            print(f"  {sym}: EUR {data['price']:,.2f} ({data['change']:+.1f}%)")
    
    if config["markets"]["forex"]["enabled"]:
        forex_prices = get_forex_prices()
        all_prices.update(forex_prices)
        print(f"\n[FOREX] Prices:")
        for sym, data in forex_prices.items():
            print(f"  {sym}: {data['price']:.5f} ({data['change']:+.2f}%)")
    
    update_unrealized_pnl(state, all_prices)
    
    print(f"\n[K.I.T.] Analyzing markets...")
    
    for symbol, price_data in all_prices.items():
        if price_data["price"] == 0:
            continue
            
        action, confidence, reason = analyze_market(symbol, price_data, state)
        
        if action in ["buy", "sell", "close"] and confidence >= config["strategy"]["minConfidenceScore"]:
            print(f"\n  >> {symbol}: {action.upper()} (Confidence: {confidence}%)")
            print(f"     Reason: {reason}")
            
            result = execute_paper_trade(
                state, config, symbol, action, 
                price_data["price"], confidence, reason
            )
            
            if result:
                if action == "buy":
                    print(f"     [OK] Opened position: {result['quantity']:.6f} @ EUR {result['entryPrice']:,.2f}")
                elif action == "close":
                    print(f"     [OK] Closed position: P&L EUR {result['pnl']:+.2f} ({result['pnlPercent']:+.1f}%)")
    
    save_state(state)
    
    portfolio = state["portfolio"]
    print(f"\n{'='*60}")
    print(f"[PORTFOLIO]")
    print(f"{'='*60}")
    print(f"  Initial Capital:  EUR {portfolio['initialCapital']:,.2f}")
    print(f"  Current Capital:  EUR {portfolio['currentCapital']:,.2f}")
    print(f"  Total P&L:        EUR {portfolio['totalPnL']:+,.2f} ({portfolio['totalPnLPercent']:+.1f}%)")
    print(f"  Realized P&L:     EUR {portfolio['realizedPnL']:+,.2f}")
    print(f"  Unrealized P&L:   EUR {portfolio['unrealizedPnL']:+,.2f}")
    print(f"  Max Drawdown:     {portfolio['maxDrawdownPercent']:.1f}%")
    print(f"  Open Positions:   {len(state['positions'])}")
    
    stats = state["statistics"]
    if stats["totalTrades"] > 0:
        print(f"\n[STATISTICS]")
        print(f"  Total Trades:     {stats['totalTrades']}")
        print(f"  Win Rate:         {stats['winRate']:.1f}%")
        print(f"  Largest Win:      EUR {stats['largestWin']:+,.2f}")
        print(f"  Largest Loss:     EUR {stats['largestLoss']:+,.2f}")
    
    if state["positions"]:
        print(f"\n[OPEN POSITIONS]")
        for pos in state["positions"]:
            ml_tag = "[ML]" if pos.get("mlEnabled") else ""
            print(f"  {pos['symbol']}: {pos['direction'].upper()} @ EUR {pos['entryPrice']:,.2f} {ml_tag}")
            if "unrealizedPnL" in pos:
                print(f"    Current: EUR {pos.get('currentPrice', 0):,.2f} | P&L: EUR {pos['unrealizedPnL']:+,.2f} ({pos['unrealizedPnLPercent']:+.1f}%)")
    
    return state

def generate_daily_report(state):
    """Generate daily report for Telegram"""
    portfolio = state["portfolio"]
    stats = state["statistics"]
    
    ml_status = "ON" if ML_AVAILABLE else "OFF"
    
    report = f"""[K.I.T. Daily Report]
{datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC
ML Predictions: {ml_status}

[Portfolio]
* Start: EUR {portfolio['initialCapital']:,.2f}
* Current: EUR {portfolio['currentCapital']:,.2f}
* P&L: EUR {portfolio['totalPnL']:+,.2f} ({portfolio['totalPnLPercent']:+.1f}%)
* Max DD: {portfolio['maxDrawdownPercent']:.1f}%

[Statistics]
* Trades: {stats['totalTrades']}
* Win Rate: {stats['winRate']:.1f}%
* Best: EUR {stats['largestWin']:+,.2f}
* Worst: EUR {stats['largestLoss']:+,.2f}

[Open Positions: {len(state['positions'])}]
"""
    
    for pos in state["positions"]:
        pnl = pos.get('unrealizedPnL', 0)
        pnl_pct = pos.get('unrealizedPnLPercent', 0)
        tag = "[+]" if pnl >= 0 else "[-]"
        report += f"\n{tag} {pos['symbol']}: EUR {pnl:+,.2f} ({pnl_pct:+.1f}%)"
    
    if state["tradeHistory"]:
        recent = state["tradeHistory"][-3:]
        report += f"\n\n[Recent Trades]"
        for trade in recent:
            tag = "[W]" if trade["isWin"] else "[L]"
            ml_tag = " (ML)" if trade.get("mlEnabled") else ""
            report += f"\n{tag} {trade['symbol']}: EUR {trade['pnl']:+,.2f}{ml_tag}"
    
    return report

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--report":
        state = load_state()
        report = generate_daily_report(state)
        print(report)
    elif len(sys.argv) > 1 and sys.argv[1] == "--test-ml":
        print("Testing ML Predictor...")
        if ml_predictor:
            # Add test data
            for i in range(50):
                price = 95000 + random.uniform(-1000, 1000) + i * 10
                ml_predictor.add_price("BTC/EUR", price, random.uniform(-2, 2))
            
            direction, confidence = ml_predictor.predict("BTC/EUR")
            print(f"BTC/EUR: {direction} ({confidence}%)")
        else:
            print("ML not available!")
    else:
        run_trading_cycle()
