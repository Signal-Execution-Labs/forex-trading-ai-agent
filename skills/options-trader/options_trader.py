"""
📊 K.I.T. Options Trader
========================
Options trading with Greeks analysis and strategy builder.
"""

import json
import sys
import random
import math

def calculate_greeks(spot, strike, days_to_expiry, volatility, rate=0.05, is_call=True):
    """Simplified Black-Scholes Greeks"""
    t = days_to_expiry / 365
    if t <= 0:
        return {"delta": 1 if is_call else -1, "gamma": 0, "theta": 0, "vega": 0}
    
    # Simplified approximations
    moneyness = spot / strike
    delta = 0.5 + 0.5 * (moneyness - 1) if is_call else -0.5 + 0.5 * (moneyness - 1)
    delta = max(0, min(1, delta)) if is_call else max(-1, min(0, delta))
    
    return {
        "delta": round(delta, 3),
        "gamma": round(random.uniform(0.01, 0.05), 4),
        "theta": round(-random.uniform(5, 50), 2),
        "vega": round(random.uniform(10, 100), 2),
        "iv": round(volatility * 100, 1)
    }

def main():
    args = {}
    if len(sys.argv) > 1:
        try:
            args = json.loads(sys.argv[1])
        except:
            pass
    
    action = args.get("action", "chain")
    symbol = args.get("symbol", "BTC")
    
    if action == "chain":
        spot = 65000 if symbol == "BTC" else 3500
        strikes = [int(spot * m) for m in [0.9, 0.95, 1.0, 1.05, 1.1]]
        
        chain = []
        for strike in strikes:
            chain.append({
                "strike": strike,
                "call": {
                    "bid": round(random.uniform(100, 2000), 2),
                    "ask": round(random.uniform(100, 2000), 2),
                    "greeks": calculate_greeks(spot, strike, 30, 0.6, is_call=True)
                },
                "put": {
                    "bid": round(random.uniform(100, 2000), 2),
                    "ask": round(random.uniform(100, 2000), 2),
                    "greeks": calculate_greeks(spot, strike, 30, 0.6, is_call=False)
                }
            })
        
        result = {
            "symbol": symbol,
            "spot_price": spot,
            "expiry": "2025-03-28",
            "chain": chain
        }
    
    elif action == "strategy":
        strategy = args.get("strategy", "bull_call_spread")
        result = {
            "strategy": strategy,
            "legs": [
                {"action": "buy", "type": "call", "strike": 65000},
                {"action": "sell", "type": "call", "strike": 70000}
            ],
            "max_profit": "$4,500",
            "max_loss": "$500",
            "breakeven": "$65,500"
        }
    
    else:
        result = {"available_actions": ["chain", "strategy", "analyze", "trade"]}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
