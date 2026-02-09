"""
🎯 K.I.T. Arbitrage Hunter
==========================
Find FREE MONEY across exchanges - the ultimate profit machine!

Features:
- Cross-exchange arbitrage detection
- Triangular arbitrage paths
- DeFi vs CEX opportunities
- Latency-optimized execution
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple, Set
from enum import Enum
import json
import time
import heapq

logger = logging.getLogger("kit.arbitrage-hunter")


class ArbitrageType(Enum):
    CROSS_EXCHANGE = "cross_exchange"
    TRIANGULAR = "triangular"
    DEFI_CEX = "defi_cex"
    FUTURES_SPOT = "futures_spot"


class ExecutionStatus(Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


@dataclass
class ExchangePrice:
    """Price data from a single exchange"""
    exchange: str
    symbol: str
    bid: float
    ask: float
    bid_volume: float
    ask_volume: float
    timestamp: datetime
    latency_ms: float = 0
    
    @property
    def spread(self) -> float:
        return (self.ask - self.bid) / self.bid
    
    @property
    def mid_price(self) -> float:
        return (self.bid + self.ask) / 2


@dataclass
class ArbitrageOpportunity:
    """Single arbitrage opportunity"""
    id: str
    type: ArbitrageType
    symbol: str
    buy_exchange: str
    buy_price: float
    buy_volume: float
    sell_exchange: str
    sell_price: float
    sell_volume: float
    gross_spread: float
    fees: float
    net_spread: float
    net_profit: float
    max_volume: float
    confidence: float
    timestamp: datetime
    path: List[str] = field(default_factory=list)  # For triangular
    expires_at: datetime = None
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "symbol": self.symbol,
            "buy": {"exchange": self.buy_exchange, "price": self.buy_price},
            "sell": {"exchange": self.sell_exchange, "price": self.sell_price},
            "spread": f"{self.gross_spread:.3%}",
            "net_spread": f"{self.net_spread:.3%}",
            "net_profit": f"${self.net_profit:.2f}",
            "max_volume": f"${self.max_volume:.2f}",
            "confidence": f"{self.confidence:.1%}",
            "path": self.path if self.path else None
        }


@dataclass
class ExecutionResult:
    """Result of arbitrage execution"""
    opportunity_id: str
    status: ExecutionStatus
    buy_order_id: Optional[str]
    sell_order_id: Optional[str]
    executed_volume: float
    executed_buy_price: float
    executed_sell_price: float
    actual_profit: float
    fees_paid: float
    execution_time_ms: float
    error: Optional[str] = None


class ExchangeConnector:
    """
    Unified exchange connector for arbitrage
    """
    
    # Exchange fee structure (maker/taker)
    FEES = {
        "binance": (0.001, 0.001),
        "coinbase": (0.004, 0.006),
        "kraken": (0.0016, 0.0026),
        "kucoin": (0.001, 0.001),
        "bybit": (0.001, 0.001),
        "okx": (0.0008, 0.001),
        "bitfinex": (0.001, 0.002),
        "huobi": (0.002, 0.002),
        "gateio": (0.002, 0.002),
        "mexc": (0.0, 0.001),
    }
    
    # Withdrawal fees (approximate, in asset units)
    WITHDRAWAL_FEES = {
        "BTC": 0.0001,
        "ETH": 0.001,
        "USDT": 1.0,
        "USDC": 1.0,
    }
    
    def __init__(self):
        self.prices: Dict[str, Dict[str, ExchangePrice]] = {}
        self.balances: Dict[str, Dict[str, float]] = {}
        self.last_update: Dict[str, datetime] = {}
        
    async def fetch_prices(
        self,
        exchanges: List[str],
        symbols: List[str]
    ) -> Dict[str, Dict[str, ExchangePrice]]:
        """Fetch prices from multiple exchanges"""
        prices = {}
        
        # In production, would use ccxt or exchange APIs
        # For now, simulate with realistic data
        import random
        
        base_prices = {
            "BTC/USDT": 65000,
            "ETH/USDT": 3500,
            "SOL/USDT": 150,
            "XRP/USDT": 0.55,
            "ADA/USDT": 0.45,
            "DOT/USDT": 7.5,
            "AVAX/USDT": 35,
            "LINK/USDT": 15,
        }
        
        for exchange in exchanges:
            prices[exchange] = {}
            
            for symbol in symbols:
                base = base_prices.get(symbol, 100)
                
                # Add exchange-specific variance (0.01% - 0.3%)
                variance = random.uniform(-0.003, 0.003)
                mid = base * (1 + variance)
                
                # Add spread (0.01% - 0.1%)
                spread = random.uniform(0.0001, 0.001)
                
                bid = mid * (1 - spread / 2)
                ask = mid * (1 + spread / 2)
                
                prices[exchange][symbol] = ExchangePrice(
                    exchange=exchange,
                    symbol=symbol,
                    bid=bid,
                    ask=ask,
                    bid_volume=random.uniform(1, 100) * (10000 / base),
                    ask_volume=random.uniform(1, 100) * (10000 / base),
                    timestamp=datetime.now(),
                    latency_ms=random.uniform(5, 50)
                )
        
        self.prices = prices
        return prices
    
    def get_fees(self, exchange: str, is_maker: bool = False) -> float:
        """Get trading fee for exchange"""
        fees = self.FEES.get(exchange.lower(), (0.002, 0.002))
        return fees[0] if is_maker else fees[1]
    
    async def execute_order(
        self,
        exchange: str,
        symbol: str,
        side: str,
        amount: float,
        price: float
    ) -> Dict:
        """Execute order on exchange (simulated)"""
        # In production, would use ccxt
        await asyncio.sleep(0.05)  # Simulate latency
        
        slippage = 0.0001 * (1 if side == "buy" else -1)
        executed_price = price * (1 + slippage)
        
        return {
            "id": f"order_{int(time.time() * 1000)}",
            "exchange": exchange,
            "symbol": symbol,
            "side": side,
            "amount": amount,
            "price": executed_price,
            "status": "filled",
            "timestamp": datetime.now().isoformat()
        }


class CrossExchangeArbitrage:
    """
    Cross-exchange arbitrage detection
    Buy low on one exchange, sell high on another
    """
    
    def __init__(self, connector: ExchangeConnector):
        self.connector = connector
        
    def find_opportunities(
        self,
        prices: Dict[str, Dict[str, ExchangePrice]],
        min_spread: float = 0.001,
        max_volume: float = 10000
    ) -> List[ArbitrageOpportunity]:
        """Find cross-exchange arbitrage opportunities"""
        opportunities = []
        
        # Get all symbols
        all_symbols = set()
        for exchange_prices in prices.values():
            all_symbols.update(exchange_prices.keys())
        
        for symbol in all_symbols:
            # Get all exchange prices for this symbol
            symbol_prices = []
            for exchange, exchange_prices in prices.items():
                if symbol in exchange_prices:
                    symbol_prices.append(exchange_prices[symbol])
            
            if len(symbol_prices) < 2:
                continue
            
            # Find best buy (lowest ask) and best sell (highest bid)
            best_buy = min(symbol_prices, key=lambda x: x.ask)
            best_sell = max(symbol_prices, key=lambda x: x.bid)
            
            # Skip if same exchange
            if best_buy.exchange == best_sell.exchange:
                continue
            
            # Calculate gross spread
            gross_spread = (best_sell.bid - best_buy.ask) / best_buy.ask
            
            if gross_spread <= 0:
                continue
            
            # Calculate fees
            buy_fee = self.connector.get_fees(best_buy.exchange)
            sell_fee = self.connector.get_fees(best_sell.exchange)
            total_fees = buy_fee + sell_fee
            
            # Calculate net spread
            net_spread = gross_spread - total_fees
            
            if net_spread < min_spread:
                continue
            
            # Calculate max volume (limited by order book depth)
            available_volume = min(
                best_buy.ask_volume * best_buy.ask,
                best_sell.bid_volume * best_sell.bid,
                max_volume
            )
            
            # Calculate potential profit
            net_profit = available_volume * net_spread
            
            # Confidence based on spread stability and volume
            confidence = min(0.95, 0.5 + (net_spread * 50) + (available_volume / max_volume) * 0.3)
            
            opp = ArbitrageOpportunity(
                id=f"arb_{symbol}_{best_buy.exchange}_{best_sell.exchange}_{int(time.time() * 1000)}",
                type=ArbitrageType.CROSS_EXCHANGE,
                symbol=symbol,
                buy_exchange=best_buy.exchange,
                buy_price=best_buy.ask,
                buy_volume=best_buy.ask_volume,
                sell_exchange=best_sell.exchange,
                sell_price=best_sell.bid,
                sell_volume=best_sell.bid_volume,
                gross_spread=gross_spread,
                fees=total_fees,
                net_spread=net_spread,
                net_profit=net_profit,
                max_volume=available_volume,
                confidence=confidence,
                timestamp=datetime.now(),
                expires_at=datetime.now() + timedelta(seconds=5)
            )
            
            opportunities.append(opp)
        
        # Sort by net profit
        return sorted(opportunities, key=lambda x: x.net_profit, reverse=True)


class TriangularArbitrage:
    """
    Triangular arbitrage detection
    A → B → C → A cycles to profit from price inefficiencies
    """
    
    def __init__(self, connector: ExchangeConnector):
        self.connector = connector
        
    def find_opportunities(
        self,
        prices: Dict[str, ExchangePrice],
        base_asset: str = "USDT",
        min_profit: float = 0.0005
    ) -> List[ArbitrageOpportunity]:
        """Find triangular arbitrage opportunities within single exchange"""
        opportunities = []
        
        # Build graph of tradeable pairs
        pairs = {}
        for symbol, price in prices.items():
            base, quote = symbol.split('/')
            
            if base not in pairs:
                pairs[base] = {}
            if quote not in pairs:
                pairs[quote] = {}
            
            pairs[base][quote] = ('sell', price)
            pairs[quote][base] = ('buy', price)
        
        # Find all triangular paths starting from base_asset
        if base_asset not in pairs:
            return []
        
        visited = set()
        
        for asset1 in pairs[base_asset]:
            if asset1 == base_asset:
                continue
                
            for asset2 in pairs.get(asset1, {}):
                if asset2 == base_asset or asset2 == asset1:
                    continue
                
                if base_asset not in pairs.get(asset2, {}):
                    continue
                
                # Found triangular path: base → asset1 → asset2 → base
                path = [base_asset, asset1, asset2, base_asset]
                path_key = tuple(sorted([asset1, asset2]))
                
                if path_key in visited:
                    continue
                visited.add(path_key)
                
                # Calculate profit
                profit = self._calculate_path_profit(path, pairs)
                
                if profit > min_profit:
                    opp = ArbitrageOpportunity(
                        id=f"tri_{base_asset}_{asset1}_{asset2}_{int(time.time() * 1000)}",
                        type=ArbitrageType.TRIANGULAR,
                        symbol=f"{asset1}/{asset2}",
                        buy_exchange=prices[list(prices.keys())[0]].exchange,
                        buy_price=0,
                        buy_volume=0,
                        sell_exchange=prices[list(prices.keys())[0]].exchange,
                        sell_price=0,
                        sell_volume=0,
                        gross_spread=profit,
                        fees=0.003,  # Approximate 3 trades
                        net_spread=profit - 0.003,
                        net_profit=1000 * (profit - 0.003),  # Per $1000
                        max_volume=10000,
                        confidence=0.7,
                        timestamp=datetime.now(),
                        path=path,
                        expires_at=datetime.now() + timedelta(seconds=2)
                    )
                    opportunities.append(opp)
        
        return sorted(opportunities, key=lambda x: x.net_profit, reverse=True)
    
    def _calculate_path_profit(
        self,
        path: List[str],
        pairs: Dict[str, Dict[str, Tuple[str, ExchangePrice]]]
    ) -> float:
        """Calculate profit for a triangular path"""
        amount = 1.0  # Start with 1 unit
        
        for i in range(len(path) - 1):
            from_asset = path[i]
            to_asset = path[i + 1]
            
            if to_asset not in pairs.get(from_asset, {}):
                return 0
            
            direction, price = pairs[from_asset][to_asset]
            
            if direction == 'buy':
                # We're buying to_asset with from_asset
                amount = amount / price.ask
            else:
                # We're selling from_asset for to_asset
                amount = amount * price.bid
        
        # Profit is the excess over starting amount
        return amount - 1.0


class DeFiArbitrage:
    """
    DeFi vs CEX arbitrage detection
    Exploit price differences between DEXes and centralized exchanges
    """
    
    # DEX addresses
    DEXES = {
        "uniswap_v3": "0x...",
        "sushiswap": "0x...",
        "curve": "0x...",
        "balancer": "0x...",
    }
    
    def __init__(self, connector: ExchangeConnector):
        self.connector = connector
        
    async def get_dex_price(
        self,
        dex: str,
        token_in: str,
        token_out: str,
        amount: float
    ) -> Tuple[float, float]:
        """Get price quote from DEX (simulated)"""
        # In production, would use web3.py and DEX contracts
        import random
        
        # Simulate DEX price with higher variance
        base_price = 3500 if token_in == "ETH" or token_out == "ETH" else 1.0
        variance = random.uniform(-0.005, 0.005)
        price = base_price * (1 + variance)
        
        # Higher slippage for larger amounts
        slippage = min(0.01, amount / 100000)
        
        return price, slippage
    
    async def find_opportunities(
        self,
        cex_prices: Dict[str, Dict[str, ExchangePrice]],
        tokens: List[str],
        min_spread: float = 0.005
    ) -> List[ArbitrageOpportunity]:
        """Find DEX vs CEX arbitrage opportunities"""
        opportunities = []
        
        for token in tokens:
            symbol = f"{token}/USDT"
            
            # Get best CEX prices
            cex_bids = []
            cex_asks = []
            
            for exchange, prices in cex_prices.items():
                if symbol in prices:
                    cex_bids.append((exchange, prices[symbol].bid))
                    cex_asks.append((exchange, prices[symbol].ask))
            
            if not cex_bids or not cex_asks:
                continue
            
            best_cex_bid = max(cex_bids, key=lambda x: x[1])
            best_cex_ask = min(cex_asks, key=lambda x: x[1])
            
            # Check DEX prices
            for dex_name in self.DEXES.keys():
                dex_price, slippage = await self.get_dex_price(
                    dex_name, token, "USDT", 1000
                )
                
                # DEX buy, CEX sell
                buy_spread = (best_cex_bid[1] - dex_price * (1 + slippage)) / dex_price
                
                if buy_spread > min_spread:
                    opportunities.append(ArbitrageOpportunity(
                        id=f"defi_{token}_{dex_name}_{best_cex_bid[0]}_{int(time.time() * 1000)}",
                        type=ArbitrageType.DEFI_CEX,
                        symbol=symbol,
                        buy_exchange=dex_name,
                        buy_price=dex_price * (1 + slippage),
                        buy_volume=1000,
                        sell_exchange=best_cex_bid[0],
                        sell_price=best_cex_bid[1],
                        sell_volume=1000,
                        gross_spread=buy_spread,
                        fees=0.005,  # Gas + CEX fees
                        net_spread=buy_spread - 0.005,
                        net_profit=1000 * (buy_spread - 0.005),
                        max_volume=10000,
                        confidence=0.6,  # Lower due to DEX risks
                        timestamp=datetime.now(),
                        path=[dex_name, best_cex_bid[0]]
                    ))
                
                # CEX buy, DEX sell
                sell_spread = (dex_price * (1 - slippage) - best_cex_ask[1]) / best_cex_ask[1]
                
                if sell_spread > min_spread:
                    opportunities.append(ArbitrageOpportunity(
                        id=f"defi_{token}_{best_cex_ask[0]}_{dex_name}_{int(time.time() * 1000)}",
                        type=ArbitrageType.DEFI_CEX,
                        symbol=symbol,
                        buy_exchange=best_cex_ask[0],
                        buy_price=best_cex_ask[1],
                        buy_volume=1000,
                        sell_exchange=dex_name,
                        sell_price=dex_price * (1 - slippage),
                        sell_volume=1000,
                        gross_spread=sell_spread,
                        fees=0.005,
                        net_spread=sell_spread - 0.005,
                        net_profit=1000 * (sell_spread - 0.005),
                        max_volume=10000,
                        confidence=0.6,
                        timestamp=datetime.now(),
                        path=[best_cex_ask[0], dex_name]
                    ))
        
        return sorted(opportunities, key=lambda x: x.net_profit, reverse=True)


class ArbitrageHunter:
    """
    Main Arbitrage Hunter for K.I.T.
    Combines all arbitrage strategies for maximum profit
    """
    
    # Default exchanges to monitor
    DEFAULT_EXCHANGES = [
        "binance", "coinbase", "kraken", "kucoin", "bybit", "okx"
    ]
    
    # Default symbols to monitor
    DEFAULT_SYMBOLS = [
        "BTC/USDT", "ETH/USDT", "SOL/USDT", "XRP/USDT",
        "ADA/USDT", "DOT/USDT", "AVAX/USDT", "LINK/USDT"
    ]
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.connector = ExchangeConnector()
        self.cross_exchange = CrossExchangeArbitrage(self.connector)
        self.triangular = TriangularArbitrage(self.connector)
        self.defi = DeFiArbitrage(self.connector)
        
        # Tracking
        self.opportunities_found = 0
        self.opportunities_executed = 0
        self.total_profit = 0.0
        self.last_scan = None
        
    async def scan_cross_exchange(
        self,
        symbols: List[str] = None,
        exchanges: List[str] = None,
        min_spread: float = 0.001,
        max_volume: float = 10000
    ) -> List[ArbitrageOpportunity]:
        """Scan for cross-exchange arbitrage opportunities"""
        symbols = symbols or self.DEFAULT_SYMBOLS
        exchanges = exchanges or self.DEFAULT_EXCHANGES
        
        logger.info(f"🔍 Scanning {len(exchanges)} exchanges for {len(symbols)} symbols...")
        
        # Fetch prices from all exchanges
        prices = await self.connector.fetch_prices(exchanges, symbols)
        
        # Find opportunities
        opportunities = self.cross_exchange.find_opportunities(
            prices, min_spread, max_volume
        )
        
        self.opportunities_found += len(opportunities)
        self.last_scan = datetime.now()
        
        logger.info(f"✅ Found {len(opportunities)} cross-exchange opportunities")
        
        return opportunities
    
    async def scan_triangular(
        self,
        exchange: str = "binance",
        base_asset: str = "USDT",
        min_profit: float = 0.0005
    ) -> List[ArbitrageOpportunity]:
        """Scan for triangular arbitrage within exchange"""
        logger.info(f"🔺 Scanning triangular arbitrage on {exchange}...")
        
        # Fetch prices for triangular pairs
        symbols = [
            "BTC/USDT", "ETH/USDT", "ETH/BTC",
            "SOL/USDT", "SOL/BTC", "SOL/ETH",
            "XRP/USDT", "XRP/BTC", "XRP/ETH"
        ]
        
        prices = await self.connector.fetch_prices([exchange], symbols)
        
        # Find opportunities
        opportunities = self.triangular.find_opportunities(
            prices[exchange], base_asset, min_profit
        )
        
        self.opportunities_found += len(opportunities)
        
        logger.info(f"✅ Found {len(opportunities)} triangular opportunities")
        
        return opportunities
    
    async def scan_defi(
        self,
        tokens: List[str] = None,
        min_spread: float = 0.005
    ) -> List[ArbitrageOpportunity]:
        """Scan for DeFi vs CEX arbitrage"""
        tokens = tokens or ["ETH", "WBTC", "LINK", "UNI"]
        
        logger.info(f"🔗 Scanning DeFi arbitrage for {len(tokens)} tokens...")
        
        # Get CEX prices
        symbols = [f"{t}/USDT" for t in tokens]
        cex_prices = await self.connector.fetch_prices(
            self.DEFAULT_EXCHANGES[:3], symbols
        )
        
        # Find DeFi opportunities
        opportunities = await self.defi.find_opportunities(
            cex_prices, tokens, min_spread
        )
        
        self.opportunities_found += len(opportunities)
        
        logger.info(f"✅ Found {len(opportunities)} DeFi arbitrage opportunities")
        
        return opportunities
    
    async def scan_all(
        self,
        min_spread: float = 0.001,
        max_volume: float = 10000
    ) -> Dict[str, List[ArbitrageOpportunity]]:
        """Scan all arbitrage types"""
        results = {}
        
        # Run all scans in parallel
        cross_task = self.scan_cross_exchange(min_spread=min_spread, max_volume=max_volume)
        tri_task = self.scan_triangular(min_profit=min_spread)
        defi_task = self.scan_defi(min_spread=min_spread * 2)
        
        cross, tri, defi = await asyncio.gather(cross_task, tri_task, defi_task)
        
        results["cross_exchange"] = cross
        results["triangular"] = tri
        results["defi"] = defi
        
        total = len(cross) + len(tri) + len(defi)
        logger.info(f"🎯 Total opportunities found: {total}")
        
        return results
    
    async def execute(
        self,
        opportunity: ArbitrageOpportunity,
        volume: float = None
    ) -> ExecutionResult:
        """Execute an arbitrage opportunity"""
        start_time = time.time()
        
        volume = volume or min(opportunity.max_volume, 5000)  # Default max $5k
        
        logger.info(f"⚡ Executing arbitrage: {opportunity.symbol}")
        logger.info(f"   Buy: {opportunity.buy_exchange} @ ${opportunity.buy_price:.2f}")
        logger.info(f"   Sell: {opportunity.sell_exchange} @ ${opportunity.sell_price:.2f}")
        logger.info(f"   Volume: ${volume:.2f}")
        
        try:
            # Calculate amounts
            base_asset = opportunity.symbol.split('/')[0]
            buy_amount = volume / opportunity.buy_price
            
            # Execute buy order
            buy_order = await self.connector.execute_order(
                opportunity.buy_exchange,
                opportunity.symbol,
                "buy",
                buy_amount,
                opportunity.buy_price
            )
            
            # Execute sell order
            sell_order = await self.connector.execute_order(
                opportunity.sell_exchange,
                opportunity.symbol,
                "sell",
                buy_amount,
                opportunity.sell_price
            )
            
            # Calculate actual profit
            buy_cost = buy_order["amount"] * buy_order["price"]
            sell_revenue = sell_order["amount"] * sell_order["price"]
            
            buy_fee = buy_cost * self.connector.get_fees(opportunity.buy_exchange)
            sell_fee = sell_revenue * self.connector.get_fees(opportunity.sell_exchange)
            
            actual_profit = sell_revenue - buy_cost - buy_fee - sell_fee
            
            execution_time = (time.time() - start_time) * 1000
            
            self.opportunities_executed += 1
            self.total_profit += actual_profit
            
            logger.info(f"✅ Arbitrage executed! Profit: ${actual_profit:.2f}")
            
            return ExecutionResult(
                opportunity_id=opportunity.id,
                status=ExecutionStatus.COMPLETED,
                buy_order_id=buy_order["id"],
                sell_order_id=sell_order["id"],
                executed_volume=volume,
                executed_buy_price=buy_order["price"],
                executed_sell_price=sell_order["price"],
                actual_profit=actual_profit,
                fees_paid=buy_fee + sell_fee,
                execution_time_ms=execution_time
            )
            
        except Exception as e:
            logger.error(f"❌ Arbitrage execution failed: {e}")
            
            return ExecutionResult(
                opportunity_id=opportunity.id,
                status=ExecutionStatus.FAILED,
                buy_order_id=None,
                sell_order_id=None,
                executed_volume=0,
                executed_buy_price=0,
                executed_sell_price=0,
                actual_profit=0,
                fees_paid=0,
                execution_time_ms=(time.time() - start_time) * 1000,
                error=str(e)
            )
    
    async def monitor(
        self,
        interval: float = 1.0,
        auto_execute: bool = False,
        min_profit: float = 5.0
    ):
        """Continuous monitoring loop"""
        logger.info(f"🔄 Starting arbitrage monitor (interval: {interval}s)")
        
        while True:
            try:
                opportunities = await self.scan_cross_exchange()
                
                for opp in opportunities:
                    if opp.net_profit >= min_profit:
                        logger.info(f"🎯 Profitable opportunity: {opp.symbol}")
                        logger.info(f"   Net profit: ${opp.net_profit:.2f}")
                        
                        if auto_execute:
                            await self.execute(opp)
                
                await asyncio.sleep(interval)
                
            except Exception as e:
                logger.error(f"Monitor error: {e}")
                await asyncio.sleep(5)
    
    def get_stats(self) -> dict:
        """Get arbitrage statistics"""
        return {
            "opportunities_found": self.opportunities_found,
            "opportunities_executed": self.opportunities_executed,
            "total_profit": f"${self.total_profit:.2f}",
            "success_rate": f"{self.opportunities_executed / max(1, self.opportunities_found):.1%}",
            "last_scan": self.last_scan.isoformat() if self.last_scan else None
        }


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("🎯 K.I.T. Arbitrage Hunter Demo")
        print("=" * 50)
        
        hunter = ArbitrageHunter()
        
        # Scan all types
        results = await hunter.scan_all(min_spread=0.0005)
        
        print("\n💰 Cross-Exchange Opportunities:")
        for opp in results["cross_exchange"][:5]:
            print(f"  {opp.symbol}: Buy {opp.buy_exchange} @ ${opp.buy_price:.2f}")
            print(f"          Sell {opp.sell_exchange} @ ${opp.sell_price:.2f}")
            print(f"          Net: {opp.net_spread:.3%} = ${opp.net_profit:.2f}")
            print()
        
        print("\n🔺 Triangular Opportunities:")
        for opp in results["triangular"][:3]:
            print(f"  Path: {' → '.join(opp.path)}")
            print(f"  Profit: {opp.net_spread:.3%} per cycle")
            print()
        
        print("\n🔗 DeFi Opportunities:")
        for opp in results["defi"][:3]:
            print(f"  {opp.symbol}: {opp.path[0]} → {opp.path[1]}")
            print(f"  Spread: {opp.net_spread:.3%}")
            print()
        
        # Execute best opportunity
        if results["cross_exchange"]:
            best = results["cross_exchange"][0]
            print(f"\n⚡ Executing best opportunity: {best.symbol}")
            result = await hunter.execute(best, volume=1000)
            print(f"   Status: {result.status.value}")
            print(f"   Profit: ${result.actual_profit:.2f}")
        
        # Stats
        print("\n📊 Statistics:")
        print(json.dumps(hunter.get_stats(), indent=2))
    
    asyncio.run(demo())
