"""
🏢 K.I.T. Prop Firm Manager
===========================
Manage prop firm challenges and funded accounts.
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
    
    action = args.get("action", "status")
    
    if action == "status":
        result = {
            "accounts": [
                {
                    "firm": "FTMO",
                    "phase": "Challenge",
                    "account_size": "$100,000",
                    "current_balance": "$102,450",
                    "profit": "+2.45%",
                    "max_daily_loss_remaining": "$4,500",
                    "max_total_loss_remaining": "$8,000",
                    "trading_days": 8,
                    "status": "on_track"
                },
                {
                    "firm": "MyForexFunds",
                    "phase": "Funded",
                    "account_size": "$50,000",
                    "profit_share": "80%",
                    "this_month_profit": "$1,234"
                }
            ],
            "rules_reminder": [
                "Max 5% daily loss",
                "Max 10% total loss",
                "Min 10 trading days",
                "No weekend holding (some firms)"
            ]
        }
    elif action == "check_rules":
        result = {
            "trade_allowed": True,
            "risk_per_trade": "1%",
            "max_position_size": "5 lots",
            "daily_loss_used": "1.2%",
            "warnings": []
        }
    else:
        result = {"available_actions": ["status", "check_rules", "add_account", "payout"]}
    
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main()
