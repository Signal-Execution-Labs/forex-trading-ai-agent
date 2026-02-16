#!/usr/bin/env python3
"""
K.I.T. Binance Price Fetcher
Fetches real-time crypto prices from Binance API (no API key required for public data)
"""

import sys
import json
import urllib.request
import urllib.error

BINANCE_API = "https://api.binance.com/api/v3"

def get_price(symbol: str) -> dict:
    """Get current price for a symbol"""
    try:
        # Convert symbol format (BTC -> BTCUSDT)
        if not symbol.endswith('USDT'):
            symbol = f"{symbol}USDT"
        
        url = f"{BINANCE_API}/ticker/24hr?symbol={symbol}"
        
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode())
            
            return {
                "symbol": symbol,
                "price": float(data["lastPrice"]),
                "change": float(data["priceChange"]),
                "changePercent": float(data["priceChangePercent"]),
                "high": float(data["highPrice"]),
                "low": float(data["lowPrice"]),
                "volume": float(data["volume"]),
                "quoteVolume": float(data["quoteVolume"]),
                "source": "binance"
            }
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP Error: {e.code}", "symbol": symbol}
    except Exception as e:
        return {"error": str(e), "symbol": symbol}


def get_multiple_prices(symbols: list) -> list:
    """Get prices for multiple symbols"""
    results = []
    for symbol in symbols:
        result = get_price(symbol)
        results.append(result)
    return results


def get_all_prices() -> list:
    """Get all ticker prices"""
    try:
        url = f"{BINANCE_API}/ticker/price"
        
        with urllib.request.urlopen(url, timeout=15) as response:
            data = json.loads(response.read().decode())
            return data
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: binance.py <symbol> [symbol2] ..."}))
        sys.exit(1)
    
    symbols = sys.argv[1:]
    
    if len(symbols) == 1:
        result = get_price(symbols[0])
    else:
        result = get_multiple_prices(symbols)
    
    print(json.dumps(result, indent=2))
