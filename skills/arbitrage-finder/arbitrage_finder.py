"""
⚡ K.I.T. Arbitrage Finder
=========================
Real-time cross-exchange arbitrage detection.

Features:
- Simple arbitrage (buy low, sell high)
- Triangular arbitrage
- DEX-CEX arbitrage
- Futures-spot arbitrage
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import json
import random

logger = logging.getLogger("kit.arbitrage-finder")


class ArbitrageType(Enum):
    SIMPLE = "simple"              # Buy on A, sell on B
    TRIANGULAR = "triangular"      # A → B → C → A on same exchange
    DEX_CEX = "dex_cex"           # DEX to CEX or vice versa
    FUTURES_SPOT = "futures_spot"  # Cash and carry


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class OpportunityStatus(Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    EXECUTING = "executing"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class ExchangePrice:
    """Price data from an exchange"""
    exchange: str
    symbol: str
    bid: float          # Best buy price
    ask: float          # Best sell price
    bid_size: float     # Available at bid
    ask_size: float     # Available at ask
    timestamp: datetime
    
    @property
    def spread(self) -> float:
        return (self.ask - self.bid) / self.bid if self.bid > 0 else 0


@dataclass
class ArbitrageOpportunity:
    """Detected arbitrage opportunity"""
    id: str
    type: ArbitrageType
    symbol: str
    
    # Where to buy
    buy_exchange: str
    buy_price: float
    buy_size: float
    
    # Where to sell
    sell_exchange: str
    sell_price: float
    sell_size: float
    
    # Profit calculation
    spread_percent: float
    gross_profit: float
    fees_estimate: float
    net_profit: float
    net_profit_percent: float
    
    # Execution details
    max_size: float          # Limited by liquidity
    recommended_size: float  # Optimal trade size
    
    # Timing
    detected_at: datetime
    expires_at: datetime
    
    # Risk
    risk: RiskLevel
    execution_time_estimate: int  # seconds
    
    # Path (for triangular)
    path: Optional[List[str]] = None
    
    # Status
    status: OpportunityStatus = OpportunityStatus.ACTIVE
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "symbol": self.symbol,
            "buy": f"{self.buy_exchange} @ ${self.buy_price:,.2f}",
            "sell": f"{self.sell_exchange} @ ${self.sell_price:,.2f}",
            "spread": f"{self.spread_percent:.3%}",
            "net_profit": f"${self.net_profit:,.2f}",
            "net_profit_pct": f"{self.net_profit_percent:.3%}",
            "max_size": f"${self.max_size:,.2f}",
            "risk": self.risk.value,
            "path": " → ".join(self.path) if self.path else None
        }


@dataclass
class ExecutionResult:
    """Result of arbitrage execution"""
    opportunity_id: str
    success: bool
    
    # Execution details
    buy_filled: bool
    buy_price_actual: float
    buy_quantity: float
    
    sell_filled: bool
    sell_price_actual: float
    sell_quantity: float
    
    # P&L
    gross_profit: float
    fees_paid: float
    net_profit: float
    slippage: float
    
    # Timing
    started_at: datetime
    completed_at: datetime
    execution_time_ms: int
    
    error: Optional[str] = None


@dataclass
class ArbitrageStats:
    """Arbitrage statistics"""
    period: str
    opportunities_detected: int
    opportunities_executed: int
    total_profit: float
    success_rate: float
    avg_profit: float
    best_profit: float
    worst_profit: float
    by_type: Dict[str, int]


class PriceFetcher:
    """
    Fetch prices from multiple exchanges
    """
    
    # Supported exchanges
    EXCHANGES = ["binance", "kraken", "coinbase", "okx", "bybit", "kucoin"]
    
    def __init__(self):
        self._price_cache: Dict[str, Dict[str, ExchangePrice]] = {}
        self._last_fetch: Optional[datetime] = None
    
    async def fetch_prices(
        self,
        symbol: str,
        exchanges: List[str] = None
    ) -> Dict[str, ExchangePrice]:
        """Fetch current prices from all exchanges"""
        exchanges = exchanges or self.EXCHANGES
        
        # In production, would use real exchange APIs
        # For demo, generate realistic mock data
        return self._generate_mock_prices(symbol, exchanges)
    
    def _generate_mock_prices(
        self,
        symbol: str,
        exchanges: List[str]
    ) -> Dict[str, ExchangePrice]:
        """Generate realistic mock prices with slight variations"""
        
        # Base prices for common symbols
        base_prices = {
            "BTC/USDT": 50000,
            "ETH/USDT": 3000,
            "SOL/USDT": 100,
            "AVAX/USDT": 35,
            "LINK/USDT": 15,
            "MATIC/USDT": 0.80,
            "DOT/USDT": 7.50,
            "ADA/USDT": 0.50,
        }
        
        base_price = base_prices.get(symbol, 100)
        prices = {}
        
        for exchange in exchanges:
            # Add small random variation (-0.3% to +0.3%)
            variation = random.uniform(-0.003, 0.003)
            mid_price = base_price * (1 + variation)
            
            # Spread varies by exchange (0.01% to 0.05%)
            spread_pct = random.uniform(0.0001, 0.0005)
            
            bid = mid_price * (1 - spread_pct / 2)
            ask = mid_price * (1 + spread_pct / 2)
            
            # Random size available
            bid_size = random.uniform(1, 100) * (base_price / 50000)
            ask_size = random.uniform(1, 100) * (base_price / 50000)
            
            prices[exchange] = ExchangePrice(
                exchange=exchange,
                symbol=symbol,
                bid=bid,
                ask=ask,
                bid_size=bid_size * base_price,  # In USD
                ask_size=ask_size * base_price,
                timestamp=datetime.now()
            )
        
        return prices
    
    async def fetch_orderbook(
        self,
        symbol: str,
        exchange: str,
        depth: int = 5
    ) -> Dict:
        """Fetch orderbook with depth"""
        # Mock orderbook
        price = await self.fetch_prices(symbol, [exchange])
        if exchange not in price:
            return {}
        
        p = price[exchange]
        
        return {
            "bids": [(p.bid * (1 - i * 0.0001), random.uniform(0.1, 10)) for i in range(depth)],
            "asks": [(p.ask * (1 + i * 0.0001), random.uniform(0.1, 10)) for i in range(depth)]
        }


class ArbitrageFinder:
    """
    Main Arbitrage Detection Engine for K.I.T.
    
    Scans multiple exchanges for arbitrage opportunities
    and can execute them automatically.
    """
    
    # Fee estimates per exchange (maker/taker)
    FEES = {
        "binance": 0.001,    # 0.1%
        "kraken": 0.0016,    # 0.16%
        "coinbase": 0.004,   # 0.4%
        "okx": 0.001,        # 0.1%
        "bybit": 0.001,      # 0.1%
        "kucoin": 0.001,     # 0.1%
    }
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        
        self.price_fetcher = PriceFetcher()
        
        # Configuration
        self.min_profit_percent = self.config.get("min_profit_percent", 0.001)  # 0.1%
        self.min_profit_usd = self.config.get("min_profit_usd", 10)
        self.max_trade_size = self.config.get("max_single_trade", 5000)
        
        # Track opportunities
        self._opportunities: Dict[str, ArbitrageOpportunity] = {}
        self._stats = ArbitrageStats(
            period="24h",
            opportunities_detected=0,
            opportunities_executed=0,
            total_profit=0,
            success_rate=1.0,
            avg_profit=0,
            best_profit=0,
            worst_profit=0,
            by_type={}
        )
        
        logger.info("⚡ Arbitrage Finder initialized")
    
    async def scan(
        self,
        symbols: List[str] = None,
        exchanges: List[str] = None,
        types: List[ArbitrageType] = None
    ) -> List[ArbitrageOpportunity]:
        """
        Scan for arbitrage opportunities
        
        Args:
            symbols: List of trading pairs to scan
            exchanges: List of exchanges to check
            types: Types of arbitrage to look for
            
        Returns:
            List of ArbitrageOpportunity
        """
        symbols = symbols or ["BTC/USDT", "ETH/USDT", "SOL/USDT"]
        exchanges = exchanges or PriceFetcher.EXCHANGES
        types = types or [ArbitrageType.SIMPLE, ArbitrageType.TRIANGULAR]
        
        logger.info(f"⚡ Scanning {len(symbols)} pairs across {len(exchanges)} exchanges...")
        
        opportunities = []
        
        for symbol in symbols:
            # Fetch prices from all exchanges
            prices = await self.price_fetcher.fetch_prices(symbol, exchanges)
            
            # Find simple arbitrage
            if ArbitrageType.SIMPLE in types:
                simple_opps = self._find_simple_arbitrage(symbol, prices)
                opportunities.extend(simple_opps)
            
            # Find triangular arbitrage
            if ArbitrageType.TRIANGULAR in types:
                for exchange in exchanges:
                    tri_opps = await self._find_triangular_arbitrage(exchange)
                    opportunities.extend(tri_opps)
        
        # Filter by minimum profit
        opportunities = [
            o for o in opportunities
            if o.net_profit_percent >= self.min_profit_percent
            and o.net_profit >= self.min_profit_usd
        ]
        
        # Sort by profit
        opportunities.sort(key=lambda x: x.net_profit, reverse=True)
        
        # Update cache
        for opp in opportunities:
            self._opportunities[opp.id] = opp
        
        self._stats.opportunities_detected += len(opportunities)
        
        logger.info(f"✅ Found {len(opportunities)} arbitrage opportunities")
        
        return opportunities
    
    def _find_simple_arbitrage(
        self,
        symbol: str,
        prices: Dict[str, ExchangePrice]
    ) -> List[ArbitrageOpportunity]:
        """Find simple cross-exchange arbitrage"""
        opportunities = []
        
        exchanges = list(prices.keys())
        
        # Compare all exchange pairs
        for i, buy_exchange in enumerate(exchanges):
            for sell_exchange in exchanges[i+1:]:
                buy_price = prices[buy_exchange]
                sell_price = prices[sell_exchange]
                
                # Check if we can buy on A and sell on B
                opp = self._check_simple_arb(symbol, buy_price, sell_price)
                if opp:
                    opportunities.append(opp)
                
                # Check reverse direction
                opp = self._check_simple_arb(symbol, sell_price, buy_price)
                if opp:
                    opportunities.append(opp)
        
        return opportunities
    
    def _check_simple_arb(
        self,
        symbol: str,
        buy_from: ExchangePrice,
        sell_to: ExchangePrice
    ) -> Optional[ArbitrageOpportunity]:
        """Check if simple arbitrage exists between two prices"""
        
        # Buy at ask, sell at bid
        buy_price = buy_from.ask
        sell_price = sell_to.bid
        
        # No opportunity if sell <= buy
        if sell_price <= buy_price:
            return None
        
        # Calculate spread
        spread = (sell_price - buy_price) / buy_price
        
        # Estimate fees
        buy_fee = self.FEES.get(buy_from.exchange, 0.001)
        sell_fee = self.FEES.get(sell_to.exchange, 0.001)
        total_fees = buy_fee + sell_fee
        
        # Net spread after fees
        net_spread = spread - total_fees
        
        # Not profitable after fees
        if net_spread <= 0:
            return None
        
        # Calculate trade size (limited by liquidity)
        max_buy = buy_from.ask_size
        max_sell = sell_to.bid_size
        max_size = min(max_buy, max_sell, self.max_trade_size)
        
        # Recommended size (use 80% of max for safety)
        recommended_size = max_size * 0.8
        
        # Calculate profit
        gross_profit = recommended_size * spread
        fees_estimate = recommended_size * total_fees
        net_profit = recommended_size * net_spread
        
        # Determine risk
        if spread > 0.005:  # >0.5% spread
            risk = RiskLevel.LOW
        elif spread > 0.002:
            risk = RiskLevel.MEDIUM
        else:
            risk = RiskLevel.HIGH
        
        return ArbitrageOpportunity(
            id=f"arb_{buy_from.exchange}_{sell_to.exchange}_{int(datetime.now().timestamp())}",
            type=ArbitrageType.SIMPLE,
            symbol=symbol,
            buy_exchange=buy_from.exchange,
            buy_price=buy_price,
            buy_size=max_buy,
            sell_exchange=sell_to.exchange,
            sell_price=sell_price,
            sell_size=max_sell,
            spread_percent=spread,
            gross_profit=gross_profit,
            fees_estimate=fees_estimate,
            net_profit=net_profit,
            net_profit_percent=net_spread,
            max_size=max_size,
            recommended_size=recommended_size,
            detected_at=datetime.now(),
            expires_at=datetime.now() + timedelta(seconds=30),
            risk=risk,
            execution_time_estimate=5
        )
    
    async def _find_triangular_arbitrage(
        self,
        exchange: str
    ) -> List[ArbitrageOpportunity]:
        """Find triangular arbitrage on single exchange"""
        opportunities = []
        
        # Common triangular paths
        paths = [
            ["USDT", "BTC", "ETH", "USDT"],
            ["USDT", "ETH", "BNB", "USDT"],
            ["USDT", "BTC", "SOL", "USDT"],
        ]
        
        for path in paths:
            opp = await self._check_triangular_path(exchange, path)
            if opp:
                opportunities.append(opp)
        
        return opportunities
    
    async def _check_triangular_path(
        self,
        exchange: str,
        path: List[str]
    ) -> Optional[ArbitrageOpportunity]:
        """Check if triangular arbitrage exists for a path"""
        
        # Simulate path execution
        # Start with 1000 USDT
        amount = 1000
        original = amount
        
        for i in range(len(path) - 1):
            base = path[i]
            quote = path[i + 1]
            
            # Get price (mock)
            symbol = f"{quote}/{base}"
            prices = await self.price_fetcher.fetch_prices(symbol, [exchange])
            
            if exchange not in prices:
                return None
            
            price = prices[exchange]
            
            # Apply fee
            fee = self.FEES.get(exchange, 0.001)
            
            # Execute trade
            if i == 0 or i == 2:  # Buy
                amount = (amount / price.ask) * (1 - fee)
            else:  # Sell
                amount = (amount * price.bid) * (1 - fee)
        
        # Calculate profit
        profit = amount - original
        profit_pct = profit / original
        
        if profit_pct <= 0.0005:  # 0.05% minimum
            return None
        
        return ArbitrageOpportunity(
            id=f"tri_{exchange}_{'_'.join(path)}_{int(datetime.now().timestamp())}",
            type=ArbitrageType.TRIANGULAR,
            symbol=" → ".join(path),
            buy_exchange=exchange,
            buy_price=0,
            buy_size=10000,
            sell_exchange=exchange,
            sell_price=0,
            sell_size=10000,
            spread_percent=profit_pct,
            gross_profit=profit * 10,  # Scaled to $10k
            fees_estimate=30 * 0.003,
            net_profit=profit * 10 - 30 * 0.003,
            net_profit_percent=profit_pct,
            max_size=10000,
            recommended_size=5000,
            detected_at=datetime.now(),
            expires_at=datetime.now() + timedelta(seconds=10),
            risk=RiskLevel.LOW,
            execution_time_estimate=3,
            path=path
        )
    
    async def execute(
        self,
        opportunity_id: str,
        size: float = None
    ) -> ExecutionResult:
        """
        Execute an arbitrage opportunity
        
        Args:
            opportunity_id: ID of opportunity to execute
            size: Trade size (uses recommended if not specified)
            
        Returns:
            ExecutionResult with outcome
        """
        opp = self._opportunities.get(opportunity_id)
        
        if not opp:
            return ExecutionResult(
                opportunity_id=opportunity_id,
                success=False,
                buy_filled=False,
                buy_price_actual=0,
                buy_quantity=0,
                sell_filled=False,
                sell_price_actual=0,
                sell_quantity=0,
                gross_profit=0,
                fees_paid=0,
                net_profit=0,
                slippage=0,
                started_at=datetime.now(),
                completed_at=datetime.now(),
                execution_time_ms=0,
                error="Opportunity not found"
            )
        
        opp.status = OpportunityStatus.EXECUTING
        started = datetime.now()
        
        size = size or opp.recommended_size
        
        logger.info(f"⚡ Executing arbitrage {opportunity_id} (${size:,.2f})")
        
        # Simulate execution with slight slippage
        slippage = random.uniform(0, 0.001)  # 0-0.1% slippage
        
        buy_price_actual = opp.buy_price * (1 + slippage)
        sell_price_actual = opp.sell_price * (1 - slippage)
        
        quantity = size / buy_price_actual
        
        # Calculate actual profit
        gross = quantity * (sell_price_actual - buy_price_actual)
        fees = size * (self.FEES.get(opp.buy_exchange, 0.001) + self.FEES.get(opp.sell_exchange, 0.001))
        net = gross - fees
        
        completed = datetime.now()
        execution_ms = int((completed - started).total_seconds() * 1000)
        
        # Update stats
        opp.status = OpportunityStatus.COMPLETED
        self._stats.opportunities_executed += 1
        self._stats.total_profit += net
        
        if net > self._stats.best_profit:
            self._stats.best_profit = net
        if net < self._stats.worst_profit:
            self._stats.worst_profit = net
        
        return ExecutionResult(
            opportunity_id=opportunity_id,
            success=True,
            buy_filled=True,
            buy_price_actual=buy_price_actual,
            buy_quantity=quantity,
            sell_filled=True,
            sell_price_actual=sell_price_actual,
            sell_quantity=quantity,
            gross_profit=gross,
            fees_paid=fees,
            net_profit=net,
            slippage=slippage,
            started_at=started,
            completed_at=completed,
            execution_time_ms=execution_ms
        )
    
    def get_stats(self, period: str = "24h") -> ArbitrageStats:
        """Get arbitrage statistics"""
        # Calculate averages
        if self._stats.opportunities_executed > 0:
            self._stats.avg_profit = self._stats.total_profit / self._stats.opportunities_executed
            self._stats.success_rate = 1.0  # Mock - all successful in demo
        
        return self._stats
    
    async def start_auto_mode(
        self,
        min_profit: float = 10,
        max_risk: RiskLevel = RiskLevel.MEDIUM,
        interval: int = 5
    ):
        """
        Start automatic arbitrage detection and execution
        
        Args:
            min_profit: Minimum profit in USD to execute
            max_risk: Maximum risk level to accept
            interval: Scan interval in seconds
        """
        logger.info(f"🤖 Starting auto-mode (min profit: ${min_profit}, max risk: {max_risk.value})")
        
        while True:
            opportunities = await self.scan()
            
            for opp in opportunities:
                # Filter by criteria
                if opp.net_profit < min_profit:
                    continue
                
                risk_order = [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]
                if risk_order.index(opp.risk) > risk_order.index(max_risk):
                    continue
                
                # Execute
                result = await self.execute(opp.id)
                
                if result.success:
                    logger.info(f"✅ Executed {opp.id}: ${result.net_profit:+.2f}")
                else:
                    logger.warning(f"❌ Failed {opp.id}: {result.error}")
            
            await asyncio.sleep(interval)
    
    async def generate_report(self) -> str:
        """Generate arbitrage report"""
        stats = self.get_stats()
        
        lines = []
        lines.append("⚡ K.I.T. Arbitrage Report")
        lines.append("=" * 45)
        lines.append(f"Period: {stats.period}")
        lines.append("")
        
        lines.append("📊 STATISTICS")
        lines.append("-" * 30)
        lines.append(f"Opportunities Detected: {stats.opportunities_detected}")
        lines.append(f"Opportunities Executed: {stats.opportunities_executed}")
        lines.append(f"Success Rate: {stats.success_rate:.0%}")
        lines.append(f"Total Profit: ${stats.total_profit:,.2f}")
        lines.append(f"Average Profit: ${stats.avg_profit:,.2f}")
        lines.append(f"Best Profit: ${stats.best_profit:,.2f}")
        lines.append("")
        
        # Current opportunities
        active = [o for o in self._opportunities.values() if o.status == OpportunityStatus.ACTIVE]
        
        if active:
            lines.append("🔥 ACTIVE OPPORTUNITIES")
            lines.append("-" * 30)
            for opp in active[:5]:
                lines.append(f"• {opp.symbol} ({opp.type.value})")
                lines.append(f"  Buy: {opp.buy_exchange} @ ${opp.buy_price:,.2f}")
                lines.append(f"  Sell: {opp.sell_exchange} @ ${opp.sell_price:,.2f}")
                lines.append(f"  Net Profit: ${opp.net_profit:,.2f} ({opp.net_profit_percent:.3%})")
                lines.append(f"  Risk: {opp.risk.value}")
                lines.append("")
        
        return "\n".join(lines)


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("⚡ K.I.T. Arbitrage Finder Demo")
        print("=" * 50)
        
        finder = ArbitrageFinder()
        
        # Scan for opportunities
        print("\n🔍 Scanning for arbitrage...")
        opportunities = await finder.scan(
            symbols=["BTC/USDT", "ETH/USDT", "SOL/USDT"],
            exchanges=["binance", "kraken", "coinbase", "okx"]
        )
        
        print(f"\n📊 Found {len(opportunities)} opportunities:")
        for opp in opportunities[:5]:
            print(f"\n  {opp.type.value.upper()}: {opp.symbol}")
            print(f"  Buy:  {opp.buy_exchange} @ ${opp.buy_price:,.2f}")
            print(f"  Sell: {opp.sell_exchange} @ ${opp.sell_price:,.2f}")
            print(f"  Spread: {opp.spread_percent:.3%}")
            print(f"  Net Profit: ${opp.net_profit:,.2f} ({opp.net_profit_percent:.3%})")
            print(f"  Risk: {opp.risk.value}")
        
        # Execute one
        if opportunities:
            print("\n⚡ Executing best opportunity...")
            result = await finder.execute(opportunities[0].id)
            
            print(f"\n{'✅' if result.success else '❌'} Execution Result:")
            print(f"  Buy: ${result.buy_price_actual:,.2f} x {result.buy_quantity:.6f}")
            print(f"  Sell: ${result.sell_price_actual:,.2f} x {result.sell_quantity:.6f}")
            print(f"  Gross Profit: ${result.gross_profit:,.2f}")
            print(f"  Fees: ${result.fees_paid:,.2f}")
            print(f"  Net Profit: ${result.net_profit:,.2f}")
            print(f"  Slippage: {result.slippage:.3%}")
            print(f"  Time: {result.execution_time_ms}ms")
        
        # Report
        print("\n" + "=" * 50)
        report = await finder.generate_report()
        print(report)
    
    asyncio.run(demo())
