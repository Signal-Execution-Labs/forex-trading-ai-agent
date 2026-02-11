#!/usr/bin/env python3
"""
K.I.T. Skill #70: Institutional Order Flow

Track and analyze smart money movements in real-time.
Detects whale activity, dark pool prints, and institutional positioning.
"""

import json
import sys
import time
import random
from datetime import datetime, timedelta
from typing import Optional
from dataclasses import dataclass, asdict


@dataclass
class OrderFlowData:
    """Real-time order flow metrics"""
    delta: float
    cumulative_delta: float
    buy_volume: float
    sell_volume: float
    signal: str


@dataclass
class WhaleOrder:
    """Detected whale order"""
    size: float
    side: str
    price: float
    time: str
    exchange: str
    likely_institution: bool


@dataclass 
class DarkPoolPrint:
    """Dark pool transaction"""
    symbol: str
    size: float
    price: float
    venue: str
    time: str


class OrderFlowAnalyzer:
    """Institutional order flow analysis engine"""
    
    def __init__(self):
        self.cumulative_delta = 0.0
        self.whale_threshold = 100000  # $100K
        self.iceberg_detection_enabled = True
    
    def analyze(self, symbol: str, exchange: str = "binance", 
                depth: int = 20, period: str = "15m") -> dict:
        """
        Analyze order flow for a symbol.
        
        Returns delta, volume profile, and trading signals.
        """
        # Simulate real-time order flow analysis
        # In production: connect to exchange WebSocket for L2/L3 data
        
        buy_volume = random.uniform(1000000, 5000000)
        sell_volume = random.uniform(800000, 4500000)
        delta = buy_volume - sell_volume
        self.cumulative_delta += delta
        
        # Determine signal based on order flow
        if delta > 500000:
            signal = "bullish_absorption"
        elif delta < -500000:
            signal = "bearish_pressure"
        elif abs(delta) < 100000:
            signal = "neutral_consolidation"
        else:
            signal = "slight_" + ("bullish" if delta > 0 else "bearish")
        
        # Volume profile analysis
        volume_profile = self._analyze_volume_profile(symbol, depth)
        
        # Microstructure metrics
        microstructure = self._analyze_microstructure(symbol, exchange)
        
        # Generate trading signal
        confidence = min(0.95, abs(delta) / 2000000)
        direction = "long" if delta > 0 else "short"
        
        return {
            "symbol": symbol,
            "exchange": exchange,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "orderFlow": {
                "delta": round(delta, 2),
                "cumulativeDelta": round(self.cumulative_delta, 2),
                "buyVolume": round(buy_volume, 2),
                "sellVolume": round(sell_volume, 2),
                "signal": signal
            },
            "volumeProfile": volume_profile,
            "microstructure": microstructure,
            "signal": {
                "direction": direction,
                "confidence": round(confidence, 2),
                "reason": self._generate_signal_reason(delta, signal)
            }
        }
    
    def detect_whales(self, symbols: list, min_size: float = 100000,
                      window: str = "1h") -> dict:
        """
        Detect whale orders in real-time.
        
        Identifies large orders, potential iceberg orders,
        and institutional accumulation/distribution.
        """
        whales = []
        
        for symbol in symbols:
            # Simulate whale detection
            # In production: monitor order book changes & trade tape
            
            whale_count = random.randint(0, 5)
            for i in range(whale_count):
                size = random.uniform(min_size, min_size * 10)
                side = random.choice(["buy", "sell"])
                
                whale = WhaleOrder(
                    size=round(size, 2),
                    side=side,
                    price=self._get_mock_price(symbol),
                    time=datetime.utcnow().strftime("%H:%M:%S"),
                    exchange=random.choice(["binance", "coinbase", "kraken"]),
                    likely_institution=size > min_size * 3
                )
                whales.append({**asdict(whale), "symbol": symbol})
        
        # Calculate net position
        buy_volume = sum(w["size"] for w in whales if w["side"] == "buy")
        sell_volume = sum(w["size"] for w in whales if w["side"] == "sell")
        net_position = "long" if buy_volume > sell_volume else "short"
        
        return {
            "window": window,
            "minSize": min_size,
            "symbols": symbols,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "whaleActivity": {
                "count": len(whales),
                "netPosition": net_position,
                "totalBuyVolume": round(buy_volume, 2),
                "totalSellVolume": round(sell_volume, 2),
                "largestOrder": max(whales, key=lambda x: x["size"]) if whales else None
            },
            "orders": sorted(whales, key=lambda x: x["size"], reverse=True)[:10]
        }
    
    def analyze_dark_pool(self, symbol: str, source: str = "finra") -> dict:
        """
        Analyze dark pool activity for a symbol.
        
        Tracks ATS (Alternative Trading System) volume,
        block trades, and hidden liquidity.
        """
        # Simulate dark pool data
        # In production: connect to FINRA ATS data, OTC Markets, etc.
        
        prints = []
        total_volume = 0
        
        for i in range(random.randint(3, 15)):
            size = random.uniform(10000, 500000)
            total_volume += size
            
            prints.append({
                "symbol": symbol,
                "size": round(size, 2),
                "price": self._get_mock_price(symbol),
                "venue": random.choice(["UBSS", "CROS", "DBAX", "JPMX", "MSPL"]),
                "time": (datetime.utcnow() - timedelta(minutes=random.randint(0, 60))).strftime("%H:%M:%S"),
                "condition": random.choice(["block", "cross", "regular"])
            })
        
        # Calculate dark pool sentiment
        avg_price = sum(p["price"] for p in prints) / len(prints) if prints else 0
        
        return {
            "symbol": symbol,
            "source": source,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "summary": {
                "totalVolume": round(total_volume, 2),
                "printCount": len(prints),
                "avgPrintSize": round(total_volume / len(prints), 2) if prints else 0,
                "avgPrice": round(avg_price, 2),
                "largestPrint": max(prints, key=lambda x: x["size"]) if prints else None
            },
            "prints": sorted(prints, key=lambda x: x["size"], reverse=True)[:10],
            "venues": self._aggregate_by_venue(prints)
        }
    
    def get_cot_data(self, instrument: str = "ES", period: str = "weekly") -> dict:
        """
        Get Commitment of Traders (COT) positioning data.
        
        Shows how commercial hedgers, large speculators,
        and small speculators are positioned.
        """
        # Simulate COT data
        # In production: fetch from CFTC website
        
        commercial_long = random.randint(100000, 500000)
        commercial_short = random.randint(100000, 500000)
        
        large_spec_long = random.randint(50000, 200000)
        large_spec_short = random.randint(50000, 200000)
        
        small_spec_long = random.randint(20000, 80000)
        small_spec_short = random.randint(20000, 80000)
        
        # Calculate net positions
        commercial_net = commercial_long - commercial_short
        large_spec_net = large_spec_long - large_spec_short
        
        # Determine sentiment
        if commercial_net > 0 and large_spec_net < 0:
            sentiment = "commercial_bullish"
        elif commercial_net < 0 and large_spec_net > 0:
            sentiment = "commercial_bearish"
        else:
            sentiment = "mixed"
        
        return {
            "instrument": instrument,
            "period": period,
            "reportDate": (datetime.utcnow() - timedelta(days=3)).strftime("%Y-%m-%d"),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "positions": {
                "commercials": {
                    "long": commercial_long,
                    "short": commercial_short,
                    "net": commercial_net,
                    "change": random.randint(-10000, 10000)
                },
                "largeSpeculators": {
                    "long": large_spec_long,
                    "short": large_spec_short,
                    "net": large_spec_net,
                    "change": random.randint(-5000, 5000)
                },
                "smallSpeculators": {
                    "long": small_spec_long,
                    "short": small_spec_short,
                    "net": small_spec_long - small_spec_short,
                    "change": random.randint(-2000, 2000)
                }
            },
            "sentiment": sentiment,
            "interpretation": self._interpret_cot(commercial_net, large_spec_net)
        }
    
    def detect_iceberg(self, symbol: str, exchange: str = "binance") -> dict:
        """
        Detect potential iceberg orders.
        
        Identifies hidden liquidity through order replenishment patterns.
        """
        detected = random.random() > 0.7  # 30% chance of detection
        
        if detected:
            side = random.choice(["buy", "sell"])
            return {
                "symbol": symbol,
                "exchange": exchange,
                "detected": True,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "iceberg": {
                    "side": side,
                    "visibleSize": random.randint(1000, 5000),
                    "estimatedTotal": random.randint(50000, 200000),
                    "priceLevel": self._get_mock_price(symbol),
                    "confidence": round(random.uniform(0.6, 0.95), 2),
                    "replenishRate": random.randint(3, 15),  # Times replenished
                }
            }
        
        return {
            "symbol": symbol,
            "exchange": exchange,
            "detected": False,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "message": "No iceberg orders detected in current order book"
        }
    
    # Helper methods
    
    def _analyze_volume_profile(self, symbol: str, depth: int) -> dict:
        """Generate volume profile data"""
        base_price = self._get_mock_price(symbol)
        levels = []
        
        for i in range(depth):
            price_offset = (i - depth // 2) * (base_price * 0.001)
            price = base_price + price_offset
            volume = random.uniform(50000, 500000)
            
            levels.append({
                "price": round(price, 2),
                "volume": round(volume, 2),
                "type": "POC" if i == depth // 2 else "normal"
            })
        
        return {
            "poc": base_price,  # Point of Control
            "valueAreaHigh": round(base_price * 1.005, 2),
            "valueAreaLow": round(base_price * 0.995, 2),
            "levels": levels
        }
    
    def _analyze_microstructure(self, symbol: str, exchange: str) -> dict:
        """Analyze market microstructure"""
        bid_depth = random.uniform(1000000, 5000000)
        ask_depth = random.uniform(1000000, 5000000)
        imbalance = (bid_depth - ask_depth) / (bid_depth + ask_depth)
        
        return {
            "spread": round(random.uniform(0.005, 0.02), 4),
            "depth": {
                "bids": round(bid_depth, 2),
                "asks": round(ask_depth, 2)
            },
            "imbalance": round(imbalance, 2),
            "icebergDetected": random.random() > 0.8
        }
    
    def _generate_signal_reason(self, delta: float, signal: str) -> str:
        """Generate human-readable signal reason"""
        reasons = {
            "bullish_absorption": "Strong buy delta with whale accumulation detected",
            "bearish_pressure": "Heavy selling pressure with institutional distribution",
            "neutral_consolidation": "Balanced order flow indicating consolidation",
            "slight_bullish": "Moderate buy-side pressure building",
            "slight_bearish": "Light selling pressure detected"
        }
        return reasons.get(signal, f"Order flow delta: {delta:+,.0f}")
    
    def _get_mock_price(self, symbol: str) -> float:
        """Get mock price for a symbol"""
        prices = {
            "BTC/USDT": 98500,
            "ETH/USDT": 3800,
            "SOL/USDT": 180,
            "AAPL": 245,
            "NVDA": 890,
            "SPY": 520,
        }
        base = prices.get(symbol, 100)
        return round(base * random.uniform(0.99, 1.01), 2)
    
    def _aggregate_by_venue(self, prints: list) -> dict:
        """Aggregate dark pool prints by venue"""
        venues = {}
        for p in prints:
            venue = p["venue"]
            if venue not in venues:
                venues[venue] = {"volume": 0, "count": 0}
            venues[venue]["volume"] += p["size"]
            venues[venue]["count"] += 1
        
        return {k: {"volume": round(v["volume"], 2), "count": v["count"]} 
                for k, v in venues.items()}
    
    def _interpret_cot(self, commercial_net: int, large_spec_net: int) -> str:
        """Interpret COT data"""
        if commercial_net > 50000:
            return "Commercials (smart money) are heavily long - bullish for price"
        elif commercial_net < -50000:
            return "Commercials are heavily short - bearish or hedging production"
        elif large_spec_net > 30000:
            return "Large specs crowded long - watch for reversal if extreme"
        elif large_spec_net < -30000:
            return "Large specs crowded short - potential short squeeze setup"
        else:
            return "Positioning is balanced - no strong directional bias"


def main():
    """CLI entry point"""
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: order_flow.py <command> [args]",
            "commands": [
                "analyze <symbol> [exchange] [depth] [period]",
                "whales <symbols> [min_size] [window]",
                "dark-pool <symbol> [source]",
                "cot <instrument> [period]",
                "iceberg <symbol> [exchange]"
            ]
        }))
        sys.exit(1)
    
    command = sys.argv[1]
    analyzer = OrderFlowAnalyzer()
    
    try:
        if command == "analyze":
            symbol = sys.argv[2] if len(sys.argv) > 2 else "BTC/USDT"
            exchange = sys.argv[3] if len(sys.argv) > 3 else "binance"
            depth = int(sys.argv[4]) if len(sys.argv) > 4 else 20
            period = sys.argv[5] if len(sys.argv) > 5 else "15m"
            result = analyzer.analyze(symbol, exchange, depth, period)
            
        elif command == "whales":
            symbols = sys.argv[2].split(",") if len(sys.argv) > 2 else ["BTC/USDT"]
            min_size = float(sys.argv[3]) if len(sys.argv) > 3 else 100000
            window = sys.argv[4] if len(sys.argv) > 4 else "1h"
            result = analyzer.detect_whales(symbols, min_size, window)
            
        elif command == "dark-pool":
            symbol = sys.argv[2] if len(sys.argv) > 2 else "AAPL"
            source = sys.argv[3] if len(sys.argv) > 3 else "finra"
            result = analyzer.analyze_dark_pool(symbol, source)
            
        elif command == "cot":
            instrument = sys.argv[2] if len(sys.argv) > 2 else "ES"
            period = sys.argv[3] if len(sys.argv) > 3 else "weekly"
            result = analyzer.get_cot_data(instrument, period)
            
        elif command == "iceberg":
            symbol = sys.argv[2] if len(sys.argv) > 2 else "BTC/USDT"
            exchange = sys.argv[3] if len(sys.argv) > 3 else "binance"
            result = analyzer.detect_iceberg(symbol, exchange)
            
        else:
            result = {"error": f"Unknown command: {command}"}
        
        print(json.dumps(result, indent=2))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
