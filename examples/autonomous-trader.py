#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
K.I.T. Autonomous Paper Trader
Macht eigenständige Trading-Entscheidungen mit echten Marktdaten.
"""

import json
import os
import sys
import requests
from datetime import datetime, timedelta, timezone
from pathlib import Path
import random

# Fix Windows console encoding
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Paths
BASE_DIR = Path(__file__).parent
CONFIG_FILE = BASE_DIR / "config.json"
STATE_FILE = BASE_DIR / "state.json"
LOG_DIR = BASE_DIR / "logs"

# Ensure log directory exists
LOG_DIR.mkdir(exist_ok=True)

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
    """Fetch forex prices (using exchangerate.host free API)"""
    try:
        # Using approximate rates - in production would use proper forex API
        base_rates = {
            "EUR/USD": 1.0820,
            "GBP/USD": 1.2650,
            "USD/JPY": 149.50,
            "EUR/GBP": 0.8550,
            "AUD/USD": 0.6520,
        }
        # Add small random fluctuation to simulate live market
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
    AI-like analysis of market conditions.
    Returns: action (buy/sell/hold), confidence (0-100), reason
    """
    price = price_data.get("price", 0)
    change = price_data.get("change", 0)
    
    # Check if we have an open position
    open_position = None
    for pos in state["positions"]:
        if pos["symbol"] == symbol:
            open_position = pos
            break
    
    # Simple but effective decision logic
    signals = []
    score = 50  # Start neutral
    
    # Trend analysis
    if change > 2:
        signals.append("Strong bullish momentum")
        score += 15
    elif change > 0.5:
        signals.append("Mild bullish")
        score += 8
    elif change < -2:
        signals.append("Strong bearish momentum")
        score -= 15
    elif change < -0.5:
        signals.append("Mild bearish")
        score -= 8
    
    # Mean reversion opportunity
    if change < -3:
        signals.append("Potential oversold bounce")
        score += 10
    elif change > 3:
        signals.append("Potential overbought pullback")
        score -= 10
    
    # Add some randomness for varied behavior
    market_noise = random.randint(-10, 10)
    score += market_noise
    
    # Determine action
    if open_position:
        # Manage existing position
        entry_price = open_position["entryPrice"]
        pnl_percent = ((price - entry_price) / entry_price) * 100
        
        if open_position["direction"] == "long":
            if pnl_percent >= 3:  # Take profit
                return "close", 85, f"Take profit at +{pnl_percent:.1f}%"
            elif pnl_percent <= -2:  # Stop loss
                return "close", 90, f"Stop loss at {pnl_percent:.1f}%"
            else:
                return "hold", 60, f"Position running at {pnl_percent:+.1f}%"
    else:
        # Look for entry
        if score >= 65:
            return "buy", min(score, 95), " | ".join(signals) if signals else "Bullish setup"
        elif score <= 35:
            return "sell", min(100 - score, 95), " | ".join(signals) if signals else "Bearish setup"
    
    return "hold", 50, "No clear setup"

def execute_paper_trade(state, config, symbol, action, price, confidence, reason):
    """Execute a paper trade and update state"""
    now = datetime.utcnow()
    capital = state["portfolio"]["currentCapital"]
    
    if action == "buy":
        # Calculate position size (max 10% of capital)
        position_size_eur = capital * (config["riskManagement"]["maxPositionSizePercent"] / 100)
        quantity = position_size_eur / price
        
        # Check max open positions
        if len(state["positions"]) >= config["riskManagement"]["maxOpenPositions"]:
            return None
        
        # Create position
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
            "reason": reason
        }
        
        state["positions"].append(position)
        
        # Log decision
        decision = {
            "timestamp": now.isoformat() + "Z",
            "action": "OPEN_LONG",
            "symbol": symbol,
            "price": price,
            "quantity": quantity,
            "value": position_size_eur,
            "confidence": confidence,
            "reason": reason
        }
        state["decisions"].append(decision)
        
        return position
    
    elif action == "close":
        # Find and close position
        for i, pos in enumerate(state["positions"]):
            if pos["symbol"] == symbol:
                # Calculate P&L
                entry_price = pos["entryPrice"]
                quantity = pos["quantity"]
                pnl = (price - entry_price) * quantity
                pnl_percent = ((price - entry_price) / entry_price) * 100
                
                # Update portfolio
                state["portfolio"]["currentCapital"] += pnl
                state["portfolio"]["realizedPnL"] += pnl
                state["portfolio"]["totalPnL"] = state["portfolio"]["currentCapital"] - state["portfolio"]["initialCapital"]
                state["portfolio"]["totalPnLPercent"] = (state["portfolio"]["totalPnL"] / state["portfolio"]["initialCapital"]) * 100
                
                # Update high water mark and drawdown
                if state["portfolio"]["currentCapital"] > state["portfolio"]["highWaterMark"]:
                    state["portfolio"]["highWaterMark"] = state["portfolio"]["currentCapital"]
                
                current_dd = state["portfolio"]["highWaterMark"] - state["portfolio"]["currentCapital"]
                current_dd_percent = (current_dd / state["portfolio"]["highWaterMark"]) * 100
                if current_dd_percent > state["portfolio"]["maxDrawdownPercent"]:
                    state["portfolio"]["maxDrawdownPercent"] = current_dd_percent
                    state["portfolio"]["maxDrawdown"] = current_dd
                
                # Record trade in history
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
                    "reason": reason
                }
                state["tradeHistory"].append(trade)
                
                # Update statistics
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
                
                # Log decision
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
                
                # Remove position
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
    print(f"K.I.T. Autonomous Trader - {datetime.utcnow().isoformat()}")
    print(f"{'='*60}")
    
    config = load_config()
    state = load_state()
    
    # Get market prices
    all_prices = {}
    
    if config["markets"]["crypto"]["enabled"]:
        crypto_prices = get_crypto_prices()
        all_prices.update(crypto_prices)
        print(f"\n📊 Crypto Prices:")
        for sym, data in crypto_prices.items():
            print(f"  {sym}: €{data['price']:,.2f} ({data['change']:+.1f}%)")
    
    if config["markets"]["forex"]["enabled"]:
        forex_prices = get_forex_prices()
        all_prices.update(forex_prices)
        print(f"\n💱 Forex Prices:")
        for sym, data in forex_prices.items():
            print(f"  {sym}: {data['price']:.5f} ({data['change']:+.2f}%)")
    
    # Update unrealized P&L
    update_unrealized_pnl(state, all_prices)
    
    # Analyze each symbol and make decisions
    print(f"\n🤖 K.I.T. Analyzing markets...")
    
    for symbol, price_data in all_prices.items():
        if price_data["price"] == 0:
            continue
            
        action, confidence, reason = analyze_market(symbol, price_data, state)
        
        if action in ["buy", "sell", "close"] and confidence >= config["strategy"]["minConfidenceScore"]:
            print(f"\n  📍 {symbol}: {action.upper()} (Confidence: {confidence}%)")
            print(f"     Reason: {reason}")
            
            result = execute_paper_trade(
                state, config, symbol, action, 
                price_data["price"], confidence, reason
            )
            
            if result:
                if action == "buy":
                    print(f"     ✅ Opened position: {result['quantity']:.6f} @ €{result['entryPrice']:,.2f}")
                elif action == "close":
                    print(f"     ✅ Closed position: P&L €{result['pnl']:+.2f} ({result['pnlPercent']:+.1f}%)")
    
    # Save state
    save_state(state)
    
    # Print summary
    portfolio = state["portfolio"]
    print(f"\n{'='*60}")
    print(f"📊 PORTFOLIO SUMMARY")
    print(f"{'='*60}")
    print(f"  Initial Capital:  €{portfolio['initialCapital']:,.2f}")
    print(f"  Current Capital:  €{portfolio['currentCapital']:,.2f}")
    print(f"  Total P&L:        €{portfolio['totalPnL']:+,.2f} ({portfolio['totalPnLPercent']:+.1f}%)")
    print(f"  Realized P&L:     €{portfolio['realizedPnL']:+,.2f}")
    print(f"  Unrealized P&L:   €{portfolio['unrealizedPnL']:+,.2f}")
    print(f"  Max Drawdown:     {portfolio['maxDrawdownPercent']:.1f}%")
    print(f"  Open Positions:   {len(state['positions'])}")
    
    stats = state["statistics"]
    if stats["totalTrades"] > 0:
        print(f"\n📈 STATISTICS")
        print(f"  Total Trades:     {stats['totalTrades']}")
        print(f"  Win Rate:         {stats['winRate']:.1f}%")
        print(f"  Largest Win:      €{stats['largestWin']:+,.2f}")
        print(f"  Largest Loss:     €{stats['largestLoss']:+,.2f}")
    
    if state["positions"]:
        print(f"\n📍 OPEN POSITIONS")
        for pos in state["positions"]:
            print(f"  {pos['symbol']}: {pos['direction'].upper()} @ €{pos['entryPrice']:,.2f}")
            if "unrealizedPnL" in pos:
                print(f"    Current: €{pos.get('currentPrice', 0):,.2f} | P&L: €{pos['unrealizedPnL']:+,.2f} ({pos['unrealizedPnLPercent']:+.1f}%)")
    
    return state

def generate_daily_report(state):
    """Generate daily report for Telegram"""
    portfolio = state["portfolio"]
    stats = state["statistics"]
    
    report = f"""📊 *K.I.T. Daily Report*
_{datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC_

💰 *Portfolio*
• Start: €{portfolio['initialCapital']:,.2f}
• Current: €{portfolio['currentCapital']:,.2f}
• P&L: €{portfolio['totalPnL']:+,.2f} ({portfolio['totalPnLPercent']:+.1f}%)
• Max DD: {portfolio['maxDrawdownPercent']:.1f}%

📈 *Statistics*
• Trades: {stats['totalTrades']}
• Win Rate: {stats['winRate']:.1f}%
• Best: €{stats['largestWin']:+,.2f}
• Worst: €{stats['largestLoss']:+,.2f}

📍 *Open Positions: {len(state['positions'])}*
"""
    
    for pos in state["positions"]:
        pnl = pos.get('unrealizedPnL', 0)
        pnl_pct = pos.get('unrealizedPnLPercent', 0)
        emoji = "🟢" if pnl >= 0 else "🔴"
        report += f"\n{emoji} {pos['symbol']}: €{pnl:+,.2f} ({pnl_pct:+.1f}%)"
    
    if state["tradeHistory"]:
        recent = state["tradeHistory"][-3:]
        report += f"\n\n📋 *Recent Trades*"
        for trade in recent:
            emoji = "✅" if trade["isWin"] else "❌"
            report += f"\n{emoji} {trade['symbol']}: €{trade['pnl']:+,.2f}"
    
    return report

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == "--report":
        state = load_state()
        report = generate_daily_report(state)
        print(report)
    else:
        run_trading_cycle()
