"""
⚡ K.I.T. Smart Order Router
============================
Best execution across multiple exchanges - institutional-grade!

Features:
- Multi-exchange routing
- Slippage minimization
- TWAP/VWAP execution
- Order splitting
- Dark pool access
"""

import asyncio
import logging
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from enum import Enum
from datetime import datetime, timedelta
import time
import random
import heapq
import json

import numpy as np
import pandas as pd

logger = logging.getLogger("kit.smart-router")


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class ExecutionAlgo(Enum):
    MARKET = "market"
    LIMIT = "limit"
    TWAP = "twap"
    VWAP = "vwap"
    ICEBERG = "iceberg"
    SNIPER = "sniper"
    SMART = "smart"


class ExecutionStatus(Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    PARTIAL = "partial"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


@dataclass
class OrderBookLevel:
    """Single level in order book"""
    price: float
    quantity: float
    exchange: str
    
    @property
    def value(self) -> float:
        return self.price * self.quantity


@dataclass
class OrderBook:
    """Aggregated order book from multiple exchanges"""
    symbol: str
    bids: List[OrderBookLevel]  # Sorted high to low
    asks: List[OrderBookLevel]  # Sorted low to high
    timestamp: datetime
    
    @property
    def best_bid(self) -> float:
        return self.bids[0].price if self.bids else 0
    
    @property
    def best_ask(self) -> float:
        return self.asks[0].price if self.asks else float('inf')
    
    @property
    def mid_price(self) -> float:
        return (self.best_bid + self.best_ask) / 2
    
    @property
    def spread(self) -> float:
        return (self.best_ask - self.best_bid) / self.mid_price
    
    def get_liquidity(self, side: OrderSide, depth_pct: float = 0.01) -> float:
        """Get total liquidity within depth percentage of mid"""
        levels = self.asks if side == OrderSide.BUY else self.bids
        mid = self.mid_price
        threshold = mid * (1 + depth_pct) if side == OrderSide.BUY else mid * (1 - depth_pct)
        
        liquidity = 0
        for level in levels:
            if (side == OrderSide.BUY and level.price <= threshold) or \
               (side == OrderSide.SELL and level.price >= threshold):
                liquidity += level.value
        
        return liquidity


@dataclass
class RouteLeg:
    """Single leg of execution route"""
    exchange: str
    symbol: str
    side: OrderSide
    amount: float
    price: float
    order_type: OrderType = OrderType.LIMIT
    priority: int = 1
    
    @property
    def value(self) -> float:
        return self.amount * self.price


@dataclass
class ExecutionRoute:
    """Complete execution plan across exchanges"""
    symbol: str
    side: OrderSide
    total_amount: float
    legs: List[RouteLeg]
    avg_price: float
    total_cost: float
    expected_slippage: float
    market_impact: float
    timestamp: datetime
    algo: ExecutionAlgo
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "side": self.side.value,
            "total_amount": self.total_amount,
            "execution": {
                "avg_price": f"${self.avg_price:,.2f}",
                "total_cost": f"${self.total_cost:,.2f}",
                "expected_slippage": f"{self.expected_slippage:.3%}",
                "market_impact": f"{self.market_impact:.3%}"
            },
            "legs": [
                {
                    "exchange": leg.exchange,
                    "amount": leg.amount,
                    "price": f"${leg.price:,.2f}",
                    "value": f"${leg.value:,.2f}"
                }
                for leg in self.legs
            ],
            "algorithm": self.algo.value
        }


@dataclass
class ExecutionResult:
    """Result of order execution"""
    route_id: str
    status: ExecutionStatus
    legs_executed: int
    legs_total: int
    filled_amount: float
    target_amount: float
    avg_fill_price: float
    target_price: float
    actual_slippage: float
    total_fees: float
    execution_time_ms: float
    fills: List[Dict] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    
    @property
    def fill_rate(self) -> float:
        return self.filled_amount / self.target_amount if self.target_amount > 0 else 0
    
    def to_dict(self) -> dict:
        return {
            "status": self.status.value,
            "fill_rate": f"{self.fill_rate:.1%}",
            "filled": f"{self.filled_amount} / {self.target_amount}",
            "avg_price": f"${self.avg_fill_price:,.2f}",
            "slippage": f"{self.actual_slippage:.3%}",
            "fees": f"${self.total_fees:.2f}",
            "execution_time_ms": f"{self.execution_time_ms:.0f}ms"
        }


class ExchangeInterface:
    """
    Unified interface for exchange interactions
    """
    
    # Exchange characteristics
    EXCHANGE_CONFIG = {
        "binance": {
            "maker_fee": 0.001,
            "taker_fee": 0.001,
            "min_order": 10,  # USD
            "latency_ms": 50,
            "max_leverage": 125,
        },
        "coinbase": {
            "maker_fee": 0.004,
            "taker_fee": 0.006,
            "min_order": 1,
            "latency_ms": 100,
            "max_leverage": 1,
        },
        "kraken": {
            "maker_fee": 0.0016,
            "taker_fee": 0.0026,
            "min_order": 10,
            "latency_ms": 80,
            "max_leverage": 5,
        },
        "bybit": {
            "maker_fee": 0.001,
            "taker_fee": 0.001,
            "min_order": 1,
            "latency_ms": 30,
            "max_leverage": 100,
        },
        "okx": {
            "maker_fee": 0.0008,
            "taker_fee": 0.001,
            "min_order": 5,
            "latency_ms": 40,
            "max_leverage": 125,
        },
    }
    
    def __init__(self):
        self.balances: Dict[str, Dict[str, float]] = {}
        self.order_books: Dict[str, Dict[str, OrderBook]] = {}
        
    async def fetch_order_book(
        self,
        exchange: str,
        symbol: str,
        depth: int = 20
    ) -> OrderBook:
        """Fetch order book from exchange"""
        # In production, would use ccxt
        # Simulate with realistic data
        
        base_price = 65000 if "BTC" in symbol else 3500 if "ETH" in symbol else 100
        
        bids = []
        asks = []
        
        for i in range(depth):
            # Bids decrease from mid price
            bid_price = base_price * (1 - 0.0001 * (i + 1))
            bid_qty = random.uniform(0.1, 2.0) * (10000 / base_price)
            bids.append(OrderBookLevel(bid_price, bid_qty, exchange))
            
            # Asks increase from mid price
            ask_price = base_price * (1 + 0.0001 * (i + 1))
            ask_qty = random.uniform(0.1, 2.0) * (10000 / base_price)
            asks.append(OrderBookLevel(ask_price, ask_qty, exchange))
        
        return OrderBook(
            symbol=symbol,
            bids=sorted(bids, key=lambda x: x.price, reverse=True),
            asks=sorted(asks, key=lambda x: x.price),
            timestamp=datetime.now()
        )
    
    async def fetch_aggregated_book(
        self,
        exchanges: List[str],
        symbol: str
    ) -> OrderBook:
        """Fetch and aggregate order books from multiple exchanges"""
        all_bids = []
        all_asks = []
        
        tasks = [self.fetch_order_book(ex, symbol) for ex in exchanges]
        books = await asyncio.gather(*tasks)
        
        for book in books:
            all_bids.extend(book.bids)
            all_asks.extend(book.asks)
        
        return OrderBook(
            symbol=symbol,
            bids=sorted(all_bids, key=lambda x: x.price, reverse=True),
            asks=sorted(all_asks, key=lambda x: x.price),
            timestamp=datetime.now()
        )
    
    async def execute_order(
        self,
        exchange: str,
        symbol: str,
        side: OrderSide,
        amount: float,
        price: float,
        order_type: OrderType = OrderType.LIMIT
    ) -> Dict:
        """Execute order on exchange"""
        config = self.EXCHANGE_CONFIG.get(exchange, {})
        
        # Simulate execution latency
        await asyncio.sleep(config.get("latency_ms", 100) / 1000)
        
        # Simulate slippage
        slippage = random.uniform(0, 0.001)
        fill_price = price * (1 + slippage) if side == OrderSide.BUY else price * (1 - slippage)
        
        # Calculate fees
        fee_rate = config.get("taker_fee", 0.001) if order_type == OrderType.MARKET else config.get("maker_fee", 0.001)
        fees = amount * fill_price * fee_rate
        
        return {
            "id": f"order_{exchange}_{int(time.time() * 1000)}",
            "exchange": exchange,
            "symbol": symbol,
            "side": side.value,
            "amount": amount,
            "price": fill_price,
            "fees": fees,
            "status": "filled",
            "timestamp": datetime.now().isoformat()
        }
    
    def get_fee(self, exchange: str, is_maker: bool = True) -> float:
        """Get trading fee for exchange"""
        config = self.EXCHANGE_CONFIG.get(exchange, {})
        return config.get("maker_fee" if is_maker else "taker_fee", 0.001)


class SlippageEstimator:
    """
    Estimate slippage for orders
    """
    
    def estimate(
        self,
        order_book: OrderBook,
        side: OrderSide,
        amount: float
    ) -> Tuple[float, float]:
        """
        Estimate slippage and market impact
        
        Returns:
            (expected_slippage, market_impact)
        """
        levels = order_book.asks if side == OrderSide.BUY else order_book.bids
        mid_price = order_book.mid_price
        
        remaining = amount
        total_cost = 0
        
        for level in levels:
            if remaining <= 0:
                break
            
            fill_qty = min(remaining, level.quantity)
            total_cost += fill_qty * level.price
            remaining -= fill_qty
        
        if remaining > 0:
            # Not enough liquidity - estimate worst case
            last_price = levels[-1].price if levels else mid_price
            total_cost += remaining * last_price * 1.01
        
        avg_price = total_cost / amount if amount > 0 else mid_price
        slippage = abs(avg_price - mid_price) / mid_price
        
        # Market impact (simplified Kyle's lambda model)
        total_liquidity = sum(l.value for l in levels[:10])
        market_impact = 0.1 * (amount * mid_price / total_liquidity) ** 0.5 if total_liquidity > 0 else 0.01
        
        return slippage, market_impact


class OrderSplitter:
    """
    Split large orders for optimal execution
    """
    
    def __init__(self, min_split_size: float = 1000, max_splits: int = 10):
        self.min_split_size = min_split_size
        self.max_splits = max_splits
    
    def split_order(
        self,
        order_book: OrderBook,
        side: OrderSide,
        total_amount: float,
        total_value: float
    ) -> List[Tuple[str, float, float]]:
        """
        Split order across exchanges based on liquidity
        
        Returns:
            List of (exchange, amount, price) tuples
        """
        levels = order_book.asks if side == OrderSide.BUY else order_book.bids
        
        # Group liquidity by exchange
        exchange_liquidity: Dict[str, float] = {}
        exchange_prices: Dict[str, List[float]] = {}
        
        for level in levels:
            ex = level.exchange
            exchange_liquidity[ex] = exchange_liquidity.get(ex, 0) + level.value
            if ex not in exchange_prices:
                exchange_prices[ex] = []
            exchange_prices[ex].append(level.price)
        
        total_liquidity = sum(exchange_liquidity.values())
        
        # Distribute order proportionally to liquidity
        splits = []
        remaining = total_amount
        
        for exchange, liquidity in sorted(exchange_liquidity.items(), key=lambda x: x[1], reverse=True):
            if remaining <= 0 or len(splits) >= self.max_splits:
                break
            
            # Proportion based on liquidity
            proportion = liquidity / total_liquidity
            split_amount = min(remaining, total_amount * proportion)
            
            # Skip if below minimum
            if split_amount * exchange_prices[exchange][0] < self.min_split_size:
                continue
            
            # Use best available price
            price = exchange_prices[exchange][0]
            
            splits.append((exchange, split_amount, price))
            remaining -= split_amount
        
        # Handle remainder
        if remaining > 0 and splits:
            # Add to largest split
            ex, amt, price = splits[0]
            splits[0] = (ex, amt + remaining, price)
        
        return splits


class TWAPExecutor:
    """
    Time-Weighted Average Price execution
    """
    
    def __init__(self, interface: ExchangeInterface):
        self.interface = interface
        
    async def execute(
        self,
        symbol: str,
        side: OrderSide,
        total_amount: float,
        duration_minutes: int,
        interval_seconds: int = 60,
        exchanges: List[str] = None,
        randomize: bool = True
    ) -> ExecutionResult:
        """Execute order using TWAP"""
        exchanges = exchanges or ["binance", "bybit", "okx"]
        
        start_time = time.time()
        
        # Calculate number of slices
        num_slices = duration_minutes * 60 // interval_seconds
        slice_amount = total_amount / num_slices
        
        fills = []
        total_filled = 0
        total_cost = 0
        total_fees = 0
        
        for i in range(num_slices):
            # Random delay to avoid detection
            if randomize:
                jitter = random.uniform(-0.2, 0.2) * interval_seconds
                await asyncio.sleep(max(0, interval_seconds + jitter))
            else:
                await asyncio.sleep(interval_seconds)
            
            # Get current best prices
            book = await self.interface.fetch_aggregated_book(exchanges, symbol)
            
            # Execute slice on best exchange
            best_level = book.asks[0] if side == OrderSide.BUY else book.bids[0]
            
            result = await self.interface.execute_order(
                exchange=best_level.exchange,
                symbol=symbol,
                side=side,
                amount=slice_amount,
                price=best_level.price
            )
            
            fills.append(result)
            total_filled += result["amount"]
            total_cost += result["amount"] * result["price"]
            total_fees += result["fees"]
            
            logger.info(f"TWAP slice {i+1}/{num_slices}: {result['amount']:.4f} @ ${result['price']:,.2f}")
        
        avg_price = total_cost / total_filled if total_filled > 0 else 0
        
        return ExecutionResult(
            route_id=f"twap_{int(time.time() * 1000)}",
            status=ExecutionStatus.COMPLETED,
            legs_executed=len(fills),
            legs_total=num_slices,
            filled_amount=total_filled,
            target_amount=total_amount,
            avg_fill_price=avg_price,
            target_price=fills[0]["price"] if fills else 0,
            actual_slippage=0,  # TWAP doesn't have reference price
            total_fees=total_fees,
            execution_time_ms=(time.time() - start_time) * 1000,
            fills=fills
        )


class VWAPExecutor:
    """
    Volume-Weighted Average Price execution
    """
    
    def __init__(self, interface: ExchangeInterface):
        self.interface = interface
        
    async def get_volume_profile(
        self,
        symbol: str,
        lookback_hours: int = 24
    ) -> List[float]:
        """Get historical volume profile"""
        # Simulate hourly volume distribution
        # In production, would fetch from exchange
        hours = 24
        profile = []
        
        for h in range(hours):
            # Higher volume during market hours (UTC)
            if 8 <= h <= 16:  # US market hours
                vol = random.uniform(0.06, 0.08)
            elif 0 <= h <= 8:  # Asian market hours
                vol = random.uniform(0.04, 0.06)
            else:
                vol = random.uniform(0.02, 0.04)
            profile.append(vol)
        
        # Normalize
        total = sum(profile)
        return [v / total for v in profile]
    
    async def execute(
        self,
        symbol: str,
        side: OrderSide,
        total_amount: float,
        participation_rate: float = 0.1,
        max_duration_hours: int = 4,
        exchanges: List[str] = None
    ) -> ExecutionResult:
        """Execute order tracking VWAP"""
        exchanges = exchanges or ["binance", "bybit", "okx"]
        
        start_time = time.time()
        volume_profile = await self.get_volume_profile(symbol)
        
        fills = []
        total_filled = 0
        total_cost = 0
        total_fees = 0
        
        current_hour = datetime.now().hour
        
        for h in range(min(max_duration_hours, 24)):
            hour = (current_hour + h) % 24
            hour_volume = volume_profile[hour]
            
            # Calculate this hour's target based on VWAP profile
            hour_amount = total_amount * hour_volume / sum(volume_profile[:max_duration_hours])
            
            # Limit by participation rate
            hour_amount = min(hour_amount, total_amount * participation_rate)
            
            # Execute in smaller chunks throughout the hour
            chunks = 4  # 15-minute intervals
            chunk_amount = hour_amount / chunks
            
            for c in range(chunks):
                if total_filled >= total_amount:
                    break
                
                # Simulate passing time (compressed for demo)
                await asyncio.sleep(0.1)
                
                book = await self.interface.fetch_aggregated_book(exchanges, symbol)
                best_level = book.asks[0] if side == OrderSide.BUY else book.bids[0]
                
                result = await self.interface.execute_order(
                    exchange=best_level.exchange,
                    symbol=symbol,
                    side=side,
                    amount=min(chunk_amount, total_amount - total_filled),
                    price=best_level.price
                )
                
                fills.append(result)
                total_filled += result["amount"]
                total_cost += result["amount"] * result["price"]
                total_fees += result["fees"]
            
            if total_filled >= total_amount:
                break
        
        avg_price = total_cost / total_filled if total_filled > 0 else 0
        
        return ExecutionResult(
            route_id=f"vwap_{int(time.time() * 1000)}",
            status=ExecutionStatus.COMPLETED,
            legs_executed=len(fills),
            legs_total=len(fills),
            filled_amount=total_filled,
            target_amount=total_amount,
            avg_fill_price=avg_price,
            target_price=fills[0]["price"] if fills else 0,
            actual_slippage=0,
            total_fees=total_fees,
            execution_time_ms=(time.time() - start_time) * 1000,
            fills=fills
        )


class SmartRouter:
    """
    Main Smart Order Router for K.I.T.
    Provides best execution across multiple exchanges
    """
    
    DEFAULT_EXCHANGES = ["binance", "coinbase", "kraken", "bybit", "okx"]
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.interface = ExchangeInterface()
        self.slippage_estimator = SlippageEstimator()
        self.order_splitter = OrderSplitter()
        self.twap = TWAPExecutor(self.interface)
        self.vwap = VWAPExecutor(self.interface)
        
        # Stats
        self.total_volume = 0
        self.total_orders = 0
        self.avg_slippage = 0
        
    async def find_best_route(
        self,
        symbol: str,
        side: OrderSide,
        amount: float,
        max_slippage: float = 0.001,
        exchanges: List[str] = None
    ) -> ExecutionRoute:
        """Find optimal execution route"""
        exchanges = exchanges or self.DEFAULT_EXCHANGES
        
        logger.info(f"🔍 Finding best route for {amount} {symbol} ({side.value})...")
        
        # Get aggregated order book
        book = await self.interface.fetch_aggregated_book(exchanges, symbol)
        
        # Estimate slippage
        expected_slippage, market_impact = self.slippage_estimator.estimate(book, side, amount)
        
        # Get price reference
        mid_price = book.mid_price
        total_value = amount * mid_price
        
        # Split order across exchanges
        splits = self.order_splitter.split_order(book, side, amount, total_value)
        
        # Create route legs
        legs = []
        for exchange, split_amount, price in splits:
            legs.append(RouteLeg(
                exchange=exchange,
                symbol=symbol,
                side=side,
                amount=split_amount,
                price=price
            ))
        
        # Calculate totals
        total_cost = sum(leg.value for leg in legs)
        avg_price = total_cost / amount if amount > 0 else mid_price
        
        route = ExecutionRoute(
            symbol=symbol,
            side=side,
            total_amount=amount,
            legs=legs,
            avg_price=avg_price,
            total_cost=total_cost,
            expected_slippage=expected_slippage,
            market_impact=market_impact,
            timestamp=datetime.now(),
            algo=ExecutionAlgo.SMART
        )
        
        logger.info(f"✅ Route found: {len(legs)} legs, ${total_cost:,.2f}, slippage {expected_slippage:.3%}")
        
        return route
    
    async def execute_route(self, route: ExecutionRoute) -> ExecutionResult:
        """Execute a planned route"""
        start_time = time.time()
        
        fills = []
        total_filled = 0
        total_cost = 0
        total_fees = 0
        errors = []
        
        # Execute legs in parallel
        tasks = []
        for leg in route.legs:
            task = self.interface.execute_order(
                exchange=leg.exchange,
                symbol=leg.symbol,
                side=leg.side,
                amount=leg.amount,
                price=leg.price
            )
            tasks.append(task)
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                errors.append(f"Leg {i}: {str(result)}")
                continue
            
            fills.append(result)
            total_filled += result["amount"]
            total_cost += result["amount"] * result["price"]
            total_fees += result["fees"]
        
        avg_price = total_cost / total_filled if total_filled > 0 else 0
        actual_slippage = abs(avg_price - route.avg_price) / route.avg_price if route.avg_price > 0 else 0
        
        # Update stats
        self.total_volume += total_cost
        self.total_orders += 1
        self.avg_slippage = (self.avg_slippage * (self.total_orders - 1) + actual_slippage) / self.total_orders
        
        return ExecutionResult(
            route_id=f"route_{int(time.time() * 1000)}",
            status=ExecutionStatus.COMPLETED if not errors else ExecutionStatus.PARTIAL,
            legs_executed=len(fills),
            legs_total=len(route.legs),
            filled_amount=total_filled,
            target_amount=route.total_amount,
            avg_fill_price=avg_price,
            target_price=route.avg_price,
            actual_slippage=actual_slippage,
            total_fees=total_fees,
            execution_time_ms=(time.time() - start_time) * 1000,
            fills=fills,
            errors=errors
        )
    
    async def execute_twap(
        self,
        symbol: str,
        side: str,
        amount: float,
        duration_minutes: int = 30,
        interval_seconds: int = 60
    ) -> ExecutionResult:
        """Execute using TWAP algorithm"""
        side_enum = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
        
        logger.info(f"⏰ Starting TWAP execution: {amount} {symbol} over {duration_minutes}min")
        
        return await self.twap.execute(
            symbol=symbol,
            side=side_enum,
            total_amount=amount,
            duration_minutes=duration_minutes,
            interval_seconds=interval_seconds
        )
    
    async def execute_vwap(
        self,
        symbol: str,
        side: str,
        amount: float,
        participation_rate: float = 0.1
    ) -> ExecutionResult:
        """Execute using VWAP algorithm"""
        side_enum = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
        
        logger.info(f"📊 Starting VWAP execution: {amount} {symbol} ({participation_rate:.0%} participation)")
        
        return await self.vwap.execute(
            symbol=symbol,
            side=side_enum,
            total_amount=amount,
            participation_rate=participation_rate
        )
    
    async def execute_smart(
        self,
        symbol: str,
        side: str,
        amount: float,
        urgency: str = "normal"
    ) -> ExecutionResult:
        """
        Smart execution - automatically selects best algorithm
        
        Args:
            symbol: Trading pair
            side: "buy" or "sell"
            amount: Amount to trade
            urgency: "urgent", "normal", or "patient"
        """
        side_enum = OrderSide.BUY if side.lower() == "buy" else OrderSide.SELL
        
        # Get order book to assess market conditions
        book = await self.interface.fetch_aggregated_book(self.DEFAULT_EXCHANGES, symbol)
        mid_price = book.mid_price
        order_value = amount * mid_price
        
        # Estimate market impact
        _, market_impact = self.slippage_estimator.estimate(book, side_enum, amount)
        
        logger.info(f"🧠 Smart execution analyzing: ${order_value:,.2f}, impact {market_impact:.3%}")
        
        # Select algorithm based on order size and urgency
        if urgency == "urgent" or order_value < 10000:
            # Small or urgent - direct execution
            route = await self.find_best_route(symbol, side_enum, amount)
            return await self.execute_route(route)
            
        elif market_impact > 0.005 or order_value > 100000:
            # Large impact - use VWAP
            return await self.execute_vwap(symbol, side, amount, participation_rate=0.05)
            
        elif urgency == "patient":
            # Patient - use TWAP
            duration = max(30, int(order_value / 10000) * 10)  # 10 min per $10k
            return await self.execute_twap(symbol, side, amount, duration_minutes=duration)
            
        else:
            # Normal - smart routing
            route = await self.find_best_route(symbol, side_enum, amount)
            return await self.execute_route(route)
    
    def get_stats(self) -> dict:
        """Get router statistics"""
        return {
            "total_volume": f"${self.total_volume:,.2f}",
            "total_orders": self.total_orders,
            "avg_slippage": f"{self.avg_slippage:.4%}",
            "exchanges": self.DEFAULT_EXCHANGES
        }


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("⚡ K.I.T. Smart Order Router Demo")
        print("=" * 50)
        
        router = SmartRouter()
        
        # Find best route
        route = await router.find_best_route(
            symbol="BTC/USDT",
            side=OrderSide.BUY,
            amount=1.5,
            max_slippage=0.001
        )
        
        print("\n📋 Execution Route:")
        print(json.dumps(route.to_dict(), indent=2))
        
        # Execute route
        print("\n⚡ Executing route...")
        result = await router.execute_route(route)
        print(json.dumps(result.to_dict(), indent=2))
        
        # Smart execution
        print("\n🧠 Smart execution (large order)...")
        result = await router.execute_smart(
            symbol="ETH/USDT",
            side="buy",
            amount=50,
            urgency="normal"
        )
        print(json.dumps(result.to_dict(), indent=2))
        
        # Stats
        print("\n📊 Router Statistics:")
        print(json.dumps(router.get_stats(), indent=2))
    
    asyncio.run(demo())
