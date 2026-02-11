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

def modify_sl(ticket: int, new_sl: float):
    """Modifiziert den Stop Loss einer Position (für Trailing Stop)"""
    if not mt5.initialize():
        return {"success": False, "error": "MT5 nicht verbunden"}
    
    position = mt5.positions_get(ticket=ticket)
    if not position:
        return {"success": False, "error": f"Position {ticket} nicht gefunden"}
    
    pos = position[0]
    
    request = {
        "action": mt5.TRADE_ACTION_SLTP,
        "symbol": pos.symbol,
        "position": ticket,
        "sl": new_sl,
        "tp": pos.tp,
        "magic": 123456,
        "comment": "K.I.T. Trailing SL",
    }
    
    result = mt5.order_send(request)
    
    if result.retcode != mt5.TRADE_RETCODE_DONE:
        return {"success": False, "error": f"Modify failed: {result.comment}"}
    
    return {"success": True, "new_sl": new_sl}

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
            # buy SYMBOL VOL [SL] [TP]
            sl = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "0" else None
            tp = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "0" else None
            print(json.dumps(market_order(sys.argv[2], "buy", float(sys.argv[3]), sl, tp)))
        elif cmd == "sell" and len(sys.argv) >= 4:
            # sell SYMBOL VOL [SL] [TP]
            sl = float(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "0" else None
            tp = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "0" else None
            print(json.dumps(market_order(sys.argv[2], "sell", float(sys.argv[3]), sl, tp)))
        elif cmd == "close" and len(sys.argv) >= 3:
            print(json.dumps(close_position(int(sys.argv[2]))))
        elif cmd == "modify_sl" and len(sys.argv) >= 4:
            # modify_sl TICKET NEW_SL
            print(json.dumps(modify_sl(int(sys.argv[2]), float(sys.argv[3]))))
        elif cmd == "price" and len(sys.argv) >= 3:
            # Get current price
            if not mt5.initialize():
                print(json.dumps({"success": False, "error": "MT5 nicht verbunden"}))
            else:
                symbol = sys.argv[2]
                tick = mt5.symbol_info_tick(symbol)
                if tick:
                    print(json.dumps({"success": True, "symbol": symbol, "bid": tick.bid, "ask": tick.ask, "spread": round((tick.ask - tick.bid) * 100000, 1)}))
                else:
                    print(json.dumps({"success": False, "error": f"Symbol {symbol} nicht gefunden"}))
        elif cmd == "indicators" and len(sys.argv) >= 3:
            # Get technical indicators for a symbol
            # Usage: indicators SYMBOL [TIMEFRAME] [BARS]
            if not mt5.initialize():
                print(json.dumps({"success": False, "error": "MT5 nicht verbunden"}))
            else:
                symbol = sys.argv[2]
                timeframe = mt5.TIMEFRAME_M5  # Default M5
                if len(sys.argv) > 3:
                    tf_map = {
                        "M1": mt5.TIMEFRAME_M1, "M5": mt5.TIMEFRAME_M5, "M15": mt5.TIMEFRAME_M15,
                        "M30": mt5.TIMEFRAME_M30, "H1": mt5.TIMEFRAME_H1, "H4": mt5.TIMEFRAME_H4,
                        "D1": mt5.TIMEFRAME_D1, "W1": mt5.TIMEFRAME_W1, "MN1": mt5.TIMEFRAME_MN1
                    }
                    timeframe = tf_map.get(sys.argv[3].upper(), mt5.TIMEFRAME_M5)
                
                bars = int(sys.argv[4]) if len(sys.argv) > 4 else 100
                
                # Get price data
                rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, bars)
                if rates is None or len(rates) == 0:
                    print(json.dumps({"success": False, "error": f"Keine Daten für {symbol}"}))
                else:
                    import numpy as np
                    closes = np.array([r[4] for r in rates])  # Close prices
                    highs = np.array([r[2] for r in rates])
                    lows = np.array([r[3] for r in rates])
                    
                    # EMA calculation
                    def ema(data, period):
                        alpha = 2 / (period + 1)
                        result = np.zeros_like(data)
                        result[0] = data[0]
                        for i in range(1, len(data)):
                            result[i] = alpha * data[i] + (1 - alpha) * result[i-1]
                        return result
                    
                    # RSI calculation
                    def rsi(data, period=14):
                        deltas = np.diff(data)
                        gains = np.where(deltas > 0, deltas, 0)
                        losses = np.where(deltas < 0, -deltas, 0)
                        avg_gain = np.zeros_like(data)
                        avg_loss = np.zeros_like(data)
                        avg_gain[period] = np.mean(gains[:period])
                        avg_loss[period] = np.mean(losses[:period])
                        for i in range(period + 1, len(data)):
                            avg_gain[i] = (avg_gain[i-1] * (period-1) + gains[i-1]) / period
                            avg_loss[i] = (avg_loss[i-1] * (period-1) + losses[i-1]) / period
                        rs = np.where(avg_loss != 0, avg_gain / avg_loss, 100)
                        return 100 - (100 / (1 + rs))
                    
                    # ATR calculation
                    def atr(high, low, close, period=14):
                        tr = np.zeros(len(close))
                        tr[0] = high[0] - low[0]
                        for i in range(1, len(close)):
                            tr[i] = max(high[i] - low[i], abs(high[i] - close[i-1]), abs(low[i] - close[i-1]))
                        atr_values = np.zeros_like(tr)
                        atr_values[period-1] = np.mean(tr[:period])
                        for i in range(period, len(tr)):
                            atr_values[i] = (atr_values[i-1] * (period-1) + tr[i]) / period
                        return atr_values
                    
                    ema21 = ema(closes, 21)
                    ema50 = ema(closes, 50)
                    rsi14 = rsi(closes, 14)
                    atr14 = atr(highs, lows, closes, 14)
                    
                    current_price = closes[-1]
                    
                    # Determine trend
                    ema_trend = "BULLISH" if ema21[-1] > ema50[-1] else "BEARISH"
                    ema_cross_up = ema21[-2] <= ema50[-2] and ema21[-1] > ema50[-1]
                    ema_cross_down = ema21[-2] >= ema50[-2] and ema21[-1] < ema50[-1]
                    
                    # Pullback detection
                    pullback_to_ema21 = abs(current_price - ema21[-1]) < atr14[-1] * 0.5
                    
                    print(json.dumps({
                        "success": True,
                        "symbol": symbol,
                        "timeframe": sys.argv[3] if len(sys.argv) > 3 else "M5",
                        "current_price": round(current_price, 2),
                        "ema21": round(ema21[-1], 2),
                        "ema50": round(ema50[-1], 2),
                        "ema_trend": ema_trend,
                        "ema_cross_up": ema_cross_up,
                        "ema_cross_down": ema_cross_down,
                        "rsi": round(rsi14[-1], 1),
                        "atr": round(atr14[-1], 2),
                        "pullback_to_ema21": pullback_to_ema21,
                        "signal": {
                            "buy": ema_trend == "BULLISH" and pullback_to_ema21 and rsi14[-1] > 55,
                            "sell": ema_trend == "BEARISH" and pullback_to_ema21 and rsi14[-1] < 45,
                            "sl_distance": round(atr14[-1] * 1.5, 2),
                            "tp_distance": round(atr14[-1] * 3.0, 2)
                        }
                    }))
                mt5.shutdown()
        else:
            print(json.dumps({"error": "Unknown command", "usage": "python auto_connect.py [connect|positions|buy SYMBOL VOL SL TP|sell SYMBOL VOL SL TP|close TICKET|price SYMBOL|indicators SYMBOL TIMEFRAME BARS]"}))
