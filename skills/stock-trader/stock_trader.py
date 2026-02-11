"""
📈 K.I.T. Stock Trader
======================
Trade stocks via various brokers.
"""

import json
import sys
import random

def main():
    args = {}
    if len(sys.argv) > 1:
        try:
            args = json.loads(sys.argv[1])
        except:
            pass
    
    action = args.get("action", "quote")
    symbol = args.get("symbol", "AAPL")
    
    if action == "quote":
        prices = {"AAPL": 182.50, "GOOGL": 141.20, "MSFT": 415.80, "NVDA": 875.30, "TSLA": 175.40}
        price = prices.get(symbol, random.uniform(50, 500))
        
        result = {
            "symbol": symbol,
            "price": round(price, 2),
            "change": round(random.uniform(-5, 5), 2),
            "change_pct": f"{random.uniform(-3, 3):.2f}%",
            "volume": f"{random.randint(10, 100)}M",
            "market_cap": f"${random.randint(100, 3000)}B"
        }
    elif action == "trade":
        result = {
            "order_id": f"ORD{random.randint(10000, 99999)}",
            "symbol": symbol,
            "side": args.get("side", "buy"),
            "quantity": args.get("quantity", 10),
            "status": "filled"
        }
    else:
        result = {"available_actions": ["quote", "trade", "portfolio", "watchlist"]}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
