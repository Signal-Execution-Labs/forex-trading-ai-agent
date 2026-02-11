#!/usr/bin/env python3
"""
MT5 Auto-Connect - Verbindet zum laufenden MT5 Terminal OHNE Credentials
K.I.T. braucht NIEMALS dein Passwort!
"""

import MetaTrader5 as mt5
import json
import sys

def connect():
    """Verbindet zum bereits laufenden MT5 Terminal"""
    if not mt5.initialize():
        return {"success": False, "error": "MT5 Terminal nicht gestartet oder nicht eingeloggt"}
    
    account = mt5.account_info()
    if account is None:
        mt5.shutdown()
        return {"success": False, "error": "Keine Account-Info verfügbar"}
    
    return {
        "success": True,
        "account": {
            "login": account.login,
            "name": account.name,
            "server": account.server,
            "balance": account.balance,
            "equity": account.equity,
            "margin": account.margin,
            "free_margin": account.margin_free,
            "currency": account.currency,
            "leverage": account.leverage,
            "trade_allowed": account.trade_allowed
        }
    }

def get_positions():
    """Holt alle offenen Positionen"""
    if not mt5.initialize():
        return {"success": False, "error": "MT5 nicht verbunden"}
    
    positions = mt5.positions_get()
    if positions is None:
        return {"success": True, "positions": []}
    
    result = []
    for pos in positions:
        result.append({
            "ticket": pos.ticket,
            "symbol": pos.symbol,
            "type": "buy" if pos.type == 0 else "sell",
            "volume": pos.volume,
            "price_open": pos.price_open,
            "price_current": pos.price_current,
            "sl": pos.sl,
            "tp": pos.tp,
            "profit": pos.profit
        })
    
    return {"success": True, "positions": result}

def market_order(symbol: str, order_type: str, volume: float, sl: float = None, tp: float = None):
    """Führt eine Market Order aus"""
    if not mt5.initialize():
        return {"success": False, "error": "MT5 nicht verbunden"}
    
    symbol_info = mt5.symbol_info(symbol)
    if symbol_info is None:
        return {"success": False, "error": f"Symbol {symbol} nicht gefunden"}
    
    if not symbol_info.visible:
        mt5.symbol_select(symbol, True)
    
    tick = mt5.symbol_info_tick(symbol)
    price = tick.ask if order_type.lower() == "buy" else tick.bid
    
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": volume,
        "type": mt5.ORDER_TYPE_BUY if order_type.lower() == "buy" else mt5.ORDER_TYPE_SELL,
        "price": price,
        "deviation": 20,
        "magic": 123456,
        "comment": "K.I.T. Trade",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    if sl:
        request["sl"] = sl
    if tp:
        request["tp"] = tp
    
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return {"success": False, "error": f"Order failed: {result.comment}", "retcode": result.retcode}
    
    return {
        "success": True,
        "ticket": result.order,
        "price": result.price,
        "volume": volume
    }

def close_position(ticket: int):
    """Schließt eine Position"""
    if not mt5.initialize():
        return {"success": False, "error": "MT5 nicht verbunden"}
    
    position = mt5.positions_get(ticket=ticket)
    if not position:
        return {"success": False, "error": f"Position {ticket} nicht gefunden"}
    
    pos = position[0]
    tick = mt5.symbol_info_tick(pos.symbol)
    
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": pos.symbol,
        "volume": pos.volume,
        "type": mt5.ORDER_TYPE_SELL if pos.type == 0 else mt5.ORDER_TYPE_BUY,
        "position": ticket,
        "price": tick.bid if pos.type == 0 else tick.ask,
        "deviation": 20,
        "magic": 123456,
        "comment": "K.I.T. Close",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return {"success": False, "error": f"Close failed: {result.comment}"}
    
    return {"success": True, "profit": pos.profit}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps(connect()))
    else:
        cmd = sys.argv[1]
        if cmd == "connect":
            print(json.dumps(connect()))
        elif cmd == "positions":
            print(json.dumps(get_positions()))
        elif cmd == "buy" and len(sys.argv) >= 4:
            print(json.dumps(market_order(sys.argv[2], "buy", float(sys.argv[3]))))
        elif cmd == "sell" and len(sys.argv) >= 4:
            print(json.dumps(market_order(sys.argv[2], "sell", float(sys.argv[3]))))
        elif cmd == "close" and len(sys.argv) >= 3:
            print(json.dumps(close_position(int(sys.argv[2]))))
        else:
            print(json.dumps({"error": "Unknown command", "usage": "python auto_connect.py [connect|positions|buy SYMBOL VOL|sell SYMBOL VOL|close TICKET]"}))
