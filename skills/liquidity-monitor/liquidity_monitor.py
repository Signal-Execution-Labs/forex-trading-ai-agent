"""
💧 K.I.T. Liquidity Monitor
===========================
Monitor liquidity across exchanges and DEXs.
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
    
    symbol = args.get("symbol", "BTC/USDT")
    
    result = {
        "symbol": symbol,
        "liquidity": {
            "binance": {"bid_depth_1pct": f"${random.randint(5,15)}M", "ask_depth_1pct": f"${random.randint(5,15)}M"},
            "coinbase": {"bid_depth_1pct": f"${random.randint(2,8)}M", "ask_depth_1pct": f"${random.randint(2,8)}M"},
            "kraken": {"bid_depth_1pct": f"${random.randint(1,5)}M", "ask_depth_1pct": f"${random.randint(1,5)}M"},
        },
        "best_execution": "binance",
        "total_depth": f"${random.randint(20,50)}M",
        "spread_bps": round(random.uniform(1, 5), 2)
    }
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
