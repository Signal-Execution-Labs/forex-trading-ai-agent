"""
👥 K.I.T. Copy Trader
=====================
Copy trades from successful traders automatically.
"""

import json
import sys

def main():
    args = {}
    if len(sys.argv) > 1:
        try:
            args = json.loads(sys.argv[1])
        except:
            pass
    
    action = args.get("action", "list")
    
    if action == "list":
        result = {
            "traders": [
                {"id": "trader1", "name": "CryptoKing", "roi_30d": 45.2, "win_rate": 72, "followers": 1250},
                {"id": "trader2", "name": "SwingMaster", "roi_30d": 32.8, "win_rate": 68, "followers": 890},
                {"id": "trader3", "name": "ScalpPro", "roi_30d": 28.5, "win_rate": 81, "followers": 2100}
            ]
        }
    elif action == "follow":
        result = {"status": "following", "trader": args.get("trader_id"), "allocation": args.get("allocation", 1000)}
    else:
        result = {"available_actions": ["list", "follow", "unfollow", "stats"]}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
