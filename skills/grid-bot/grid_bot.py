#!/usr/bin/env python3
"""
K.I.T. Grid Trading Bot

Automated grid trading strategy inspired by Pionex.
Places buy and sell orders at regular intervals to profit from market volatility.

Usage:
    python grid_bot.py calculate --symbol BTCUSDT --lower 40000 --upper 50000 --grids 10 --investment 1000
    python grid_bot.py start --symbol BTCUSDT --lower 40000 --upper 50000 --grids 10 --investment 1000
    python grid_bot.py status
    python grid_bot.py stop --symbol BTCUSDT
"""

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any
import math

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('GridBot')


# ============================================
# Types
# ============================================

class GridType(Enum):
    SPOT = "spot"           # Classic grid
    INFINITY = "infinity"   # No upper limit
    REVERSE = "reverse"     # For shorts


class GridSpacing(Enum):
    ARITHMETIC = "arithmetic"  # Equal $ spacing
    GEOMETRIC = "geometric"    # Equal % spacing


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(Enum):
    PENDING = "pending"
    OPEN = "open"
    FILLED = "filled"
    CANCELLED = "cancelled"


@dataclass
class GridLevel:
    """A single grid level"""
    index: int
    price: float
    buy_order_id: Optional[str] = None
    sell_order_id: Optional[str] = None
    buy_filled: bool = False
    sell_filled: bool = False
    quantity: float = 0.0
    profit_realized: float = 0.0


@dataclass
class GridConfig:
    """Grid bot configuration"""
    symbol: str
    lower_price: float
    upper_price: float
    num_grids: int
    investment: float
    grid_type: GridType = GridType.SPOT
    spacing: GridSpacing = GridSpacing.ARITHMETIC
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    max_position: Optional[float] = None


@dataclass
class GridBotState:
    """Current state of a grid bot"""
    config: GridConfig
    grid_levels: List[GridLevel] = field(default_factory=list)
    is_running: bool = False
    total_profit: float = 0.0
    total_trades: int = 0
    start_time: Optional[datetime] = None
    current_price: float = 0.0
    base_balance: float = 0.0  # e.g., BTC
    quote_balance: float = 0.0  # e.g., USDT


# ============================================
# Grid Calculator
# ============================================

class GridCalculator:
    """Calculate grid parameters"""
    
    @staticmethod
    def calculate_grid_prices(config: GridConfig) -> List[float]:
        """Calculate all grid level prices"""
        prices = []
        
        if config.spacing == GridSpacing.ARITHMETIC:
            # Equal dollar spacing
            step = (config.upper_price - config.lower_price) / config.num_grids
            for i in range(config.num_grids + 1):
                prices.append(config.lower_price + i * step)
        else:
            # Geometric (equal percentage spacing)
            ratio = (config.upper_price / config.lower_price) ** (1 / config.num_grids)
            for i in range(config.num_grids + 1):
                prices.append(config.lower_price * (ratio ** i))
        
        return prices
    
    @staticmethod
    def calculate_quantity_per_grid(config: GridConfig) -> float:
        """Calculate how much to buy/sell at each grid level"""
        # Investment divided by number of grids
        investment_per_grid = config.investment / config.num_grids
        # Average price in range
        avg_price = (config.lower_price + config.upper_price) / 2
        # Quantity per grid
        return investment_per_grid / avg_price
    
    @staticmethod
    def calculate_profit_per_grid(config: GridConfig) -> float:
        """Calculate expected profit per grid fill"""
        if config.spacing == GridSpacing.ARITHMETIC:
            step = (config.upper_price - config.lower_price) / config.num_grids
            avg_price = (config.lower_price + config.upper_price) / 2
            return (step / avg_price) * (config.investment / config.num_grids)
        else:
            # Geometric
            ratio = (config.upper_price / config.lower_price) ** (1 / config.num_grids)
            return (ratio - 1) * (config.investment / config.num_grids)
    
    @staticmethod
    def calculate_grid_spacing_percent(config: GridConfig) -> float:
        """Calculate percentage between grid levels"""
        if config.spacing == GridSpacing.ARITHMETIC:
            step = (config.upper_price - config.lower_price) / config.num_grids
            avg_price = (config.lower_price + config.upper_price) / 2
            return (step / avg_price) * 100
        else:
            ratio = (config.upper_price / config.lower_price) ** (1 / config.num_grids)
            return (ratio - 1) * 100
    
    @classmethod
    def get_summary(cls, config: GridConfig) -> str:
        """Get a formatted summary of grid parameters"""
        prices = cls.calculate_grid_prices(config)
        qty_per_grid = cls.calculate_quantity_per_grid(config)
        profit_per_grid = cls.calculate_profit_per_grid(config)
        spacing_pct = cls.calculate_grid_spacing_percent(config)
        
        step = prices[1] - prices[0] if len(prices) > 1 else 0
        
        return f"""
╔═══════════════════════════════════════════════════════════╗
║              K.I.T. GRID BOT CALCULATOR                   ║
╚═══════════════════════════════════════════════════════════╝

📊 PARAMETERS
   Symbol:           {config.symbol}
   Grid Type:        {config.grid_type.value.upper()}
   Spacing:          {config.spacing.value.capitalize()}
   
💰 INVESTMENT
   Total:            ${config.investment:,.2f}
   Per Grid:         ${config.investment / config.num_grids:,.2f}
   
📈 PRICE RANGE
   Lower Price:      ${config.lower_price:,.2f}
   Upper Price:      ${config.upper_price:,.2f}
   Range:            ${config.upper_price - config.lower_price:,.2f} ({((config.upper_price/config.lower_price)-1)*100:.1f}%)
   
🔢 GRID LEVELS
   Number of Grids:  {config.num_grids}
   Grid Spacing:     ${step:,.2f} ({spacing_pct:.2f}%)
   
📦 ORDER SIZE
   Quantity/Grid:    {qty_per_grid:.8f} {config.symbol.replace('USDT','').replace('USD','')}
   Value/Grid:       ${qty_per_grid * (config.lower_price + config.upper_price)/2:,.2f}
   
💵 PROFIT ESTIMATE
   Per Grid Fill:    ${profit_per_grid:,.2f} ({spacing_pct:.2f}%)
   If All Fill (1x): ${profit_per_grid * config.num_grids:,.2f}
   
🛡️ RISK MANAGEMENT
   Stop Loss:        {f"${config.stop_loss:,.2f}" if config.stop_loss else "Not set"}
   Take Profit:      {f"${config.take_profit:,.2f}" if config.take_profit else "Not set"}

═══════════════════════════════════════════════════════════════

📋 Grid Levels (first/last 5):
"""
        + cls._format_grid_levels(prices[:5] + ['...'] + prices[-5:] if len(prices) > 10 else prices)
    
    @staticmethod
    def _format_grid_levels(prices: List) -> str:
        """Format grid levels for display"""
        lines = []
        for i, p in enumerate(prices):
            if p == '...':
                lines.append("   ...")
            else:
                lines.append(f"   Level {i+1:3}: ${p:,.2f}")
        return '\n'.join(lines)


# ============================================
# Grid Bot Engine
# ============================================

class GridBot:
    """Grid Trading Bot Engine"""
    
    def __init__(self, config: GridConfig, exchange: Optional[Any] = None):
        self.config = config
        self.exchange = exchange  # Exchange API client (None = simulation)
        self.state = GridBotState(config=config)
        self.running = False
        self._task: Optional[asyncio.Task] = None
        
        # Initialize grid levels
        self._init_grid_levels()
    
    def _init_grid_levels(self):
        """Initialize grid levels"""
        prices = GridCalculator.calculate_grid_prices(self.config)
        qty = GridCalculator.calculate_quantity_per_grid(self.config)
        
        self.state.grid_levels = [
            GridLevel(index=i, price=p, quantity=qty)
            for i, p in enumerate(prices)
        ]
        logger.info(f"Initialized {len(self.state.grid_levels)} grid levels")
    
    async def start(self):
        """Start the grid bot"""
        if self.running:
            logger.warning("Grid bot already running")
            return
        
        logger.info(f"Starting Grid Bot for {self.config.symbol}")
        self.running = True
        self.state.is_running = True
        self.state.start_time = datetime.now()
        
        # Place initial orders
        await self._place_initial_orders()
        
        # Start monitoring loop
        self._task = asyncio.create_task(self._monitor_loop())
    
    async def stop(self):
        """Stop the grid bot"""
        logger.info("Stopping Grid Bot...")
        self.running = False
        self.state.is_running = False
        
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        # Cancel all open orders
        await self._cancel_all_orders()
        logger.info("Grid Bot stopped")
    
    async def _place_initial_orders(self):
        """Place initial buy and sell orders"""
        current_price = await self._get_current_price()
        self.state.current_price = current_price
        
        logger.info(f"Current price: ${current_price:,.2f}")
        
        # Find which grid level we're at
        current_level = self._find_current_level(current_price)
        
        # Place buy orders below current price
        for level in self.state.grid_levels:
            if level.price < current_price:
                await self._place_buy_order(level)
        
        # Place sell orders above current price
        for level in self.state.grid_levels:
            if level.price > current_price:
                await self._place_sell_order(level)
        
        logger.info("Initial orders placed")
    
    def _find_current_level(self, price: float) -> int:
        """Find which grid level the current price is at"""
        for i, level in enumerate(self.state.grid_levels):
            if level.price >= price:
                return max(0, i - 1)
        return len(self.state.grid_levels) - 1
    
    async def _place_buy_order(self, level: GridLevel):
        """Place a buy order at grid level"""
        if self.exchange:
            # Real exchange order
            try:
                order = await self.exchange.create_limit_buy_order(
                    self.config.symbol,
                    level.quantity,
                    level.price
                )
                level.buy_order_id = order['id']
                logger.info(f"Buy order placed at ${level.price:,.2f}")
            except Exception as e:
                logger.error(f"Failed to place buy order: {e}")
        else:
            # Simulation
            level.buy_order_id = f"SIM_BUY_{level.index}_{int(time.time())}"
            logger.info(f"[SIM] Buy order at ${level.price:,.2f}")
    
    async def _place_sell_order(self, level: GridLevel):
        """Place a sell order at grid level"""
        if self.exchange:
            # Real exchange order
            try:
                order = await self.exchange.create_limit_sell_order(
                    self.config.symbol,
                    level.quantity,
                    level.price
                )
                level.sell_order_id = order['id']
                logger.info(f"Sell order placed at ${level.price:,.2f}")
            except Exception as e:
                logger.error(f"Failed to place sell order: {e}")
        else:
            # Simulation
            level.sell_order_id = f"SIM_SELL_{level.index}_{int(time.time())}"
            logger.info(f"[SIM] Sell order at ${level.price:,.2f}")
    
    async def _monitor_loop(self):
        """Main monitoring loop"""
        logger.info("Starting monitor loop...")
        
        while self.running:
            try:
                # Get current price
                current_price = await self._get_current_price()
                self.state.current_price = current_price
                
                # Check for filled orders
                await self._check_filled_orders()
                
                # Check stop loss / take profit
                if await self._check_risk_limits(current_price):
                    break
                
                # Wait before next check
                await asyncio.sleep(5)  # Check every 5 seconds
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Monitor loop error: {e}")
                await asyncio.sleep(10)
    
    async def _get_current_price(self) -> float:
        """Get current market price"""
        if self.exchange:
            ticker = await self.exchange.fetch_ticker(self.config.symbol)
            return ticker['last']
        else:
            # Simulation - return middle of range with some variation
            import random
            mid = (self.config.lower_price + self.config.upper_price) / 2
            return mid * (1 + random.uniform(-0.02, 0.02))
    
    async def _check_filled_orders(self):
        """Check for filled orders and place corresponding orders"""
        for level in self.state.grid_levels:
            # Check buy order
            if level.buy_order_id and not level.buy_filled:
                is_filled = await self._is_order_filled(level.buy_order_id)
                if is_filled:
                    level.buy_filled = True
                    self.state.total_trades += 1
                    logger.info(f"✅ Buy filled at ${level.price:,.2f}")
                    
                    # Place sell order at next level up
                    if level.index < len(self.state.grid_levels) - 1:
                        next_level = self.state.grid_levels[level.index + 1]
                        await self._place_sell_order(next_level)
            
            # Check sell order
            if level.sell_order_id and not level.sell_filled:
                is_filled = await self._is_order_filled(level.sell_order_id)
                if is_filled:
                    level.sell_filled = True
                    self.state.total_trades += 1
                    
                    # Calculate profit
                    if level.index > 0:
                        prev_level = self.state.grid_levels[level.index - 1]
                        profit = (level.price - prev_level.price) * level.quantity
                        level.profit_realized = profit
                        self.state.total_profit += profit
                        logger.info(f"✅ Sell filled at ${level.price:,.2f} | Profit: ${profit:,.2f}")
                    
                    # Place buy order at level below
                    if level.index > 0:
                        prev_level = self.state.grid_levels[level.index - 1]
                        prev_level.buy_filled = False  # Reset for re-buy
                        await self._place_buy_order(prev_level)
    
    async def _is_order_filled(self, order_id: str) -> bool:
        """Check if an order is filled"""
        if self.exchange:
            try:
                order = await self.exchange.fetch_order(order_id, self.config.symbol)
                return order['status'] == 'closed'
            except:
                return False
        else:
            # Simulation - randomly fill orders for demo
            import random
            return random.random() < 0.1  # 10% chance per check
    
    async def _check_risk_limits(self, current_price: float) -> bool:
        """Check stop loss and take profit"""
        if self.config.stop_loss and current_price <= self.config.stop_loss:
            logger.warning(f"🛑 Stop loss triggered at ${current_price:,.2f}")
            await self.stop()
            return True
        
        if self.config.take_profit and current_price >= self.config.take_profit:
            logger.info(f"🎯 Take profit triggered at ${current_price:,.2f}")
            await self.stop()
            return True
        
        return False
    
    async def _cancel_all_orders(self):
        """Cancel all open orders"""
        for level in self.state.grid_levels:
            if level.buy_order_id and not level.buy_filled:
                if self.exchange:
                    try:
                        await self.exchange.cancel_order(level.buy_order_id, self.config.symbol)
                    except:
                        pass
                level.buy_order_id = None
            
            if level.sell_order_id and not level.sell_filled:
                if self.exchange:
                    try:
                        await self.exchange.cancel_order(level.sell_order_id, self.config.symbol)
                    except:
                        pass
                level.sell_order_id = None
    
    def get_status(self) -> str:
        """Get formatted status"""
        runtime = ""
        if self.state.start_time:
            delta = datetime.now() - self.state.start_time
            hours = delta.total_seconds() / 3600
            runtime = f"{hours:.1f} hours"
        
        active_buys = sum(1 for l in self.state.grid_levels if l.buy_order_id and not l.buy_filled)
        active_sells = sum(1 for l in self.state.grid_levels if l.sell_order_id and not l.sell_filled)
        
        return f"""
╔═══════════════════════════════════════════════════════════╗
║              K.I.T. GRID BOT STATUS                       ║
╚═══════════════════════════════════════════════════════════╝

📊 BOT INFO
   Symbol:           {self.config.symbol}
   Status:           {"🟢 RUNNING" if self.running else "🔴 STOPPED"}
   Runtime:          {runtime or "Not started"}
   
💰 PERFORMANCE
   Total Profit:     ${self.state.total_profit:,.2f}
   Total Trades:     {self.state.total_trades}
   Profit/Trade:     ${self.state.total_profit/max(1,self.state.total_trades):,.2f}
   
📈 MARKET
   Current Price:    ${self.state.current_price:,.2f}
   Price Range:      ${self.config.lower_price:,.2f} - ${self.config.upper_price:,.2f}
   
📋 ORDERS
   Active Buys:      {active_buys}
   Active Sells:     {active_sells}
   Grid Levels:      {len(self.state.grid_levels)}
"""


# ============================================
# Backtester
# ============================================

class GridBacktester:
    """Backtest grid bot strategy with historical data"""
    
    @staticmethod
    async def backtest(config: GridConfig, price_data: List[float]) -> Dict[str, Any]:
        """Run backtest with price data"""
        
        prices = GridCalculator.calculate_grid_prices(config)
        qty = GridCalculator.calculate_quantity_per_grid(config)
        
        total_profit = 0.0
        total_trades = 0
        max_drawdown = 0.0
        peak_profit = 0.0
        
        # Track filled grids
        bought_at: Dict[int, bool] = {}  # level_index -> bought
        
        prev_price = price_data[0]
        
        for current_price in price_data:
            # Check each grid level
            for i, level_price in enumerate(prices):
                # Buy trigger: price crosses below level
                if prev_price >= level_price > current_price:
                    if not bought_at.get(i, False):
                        bought_at[i] = True
                        total_trades += 1
                
                # Sell trigger: price crosses above level
                if prev_price <= level_price < current_price:
                    if bought_at.get(i - 1, False):
                        profit = (level_price - prices[i-1]) * qty
                        total_profit += profit
                        bought_at[i - 1] = False
                        total_trades += 1
            
            # Track drawdown
            if total_profit > peak_profit:
                peak_profit = total_profit
            drawdown = peak_profit - total_profit
            if drawdown > max_drawdown:
                max_drawdown = drawdown
            
            prev_price = current_price
        
        # Calculate time in range
        in_range = sum(1 for p in price_data if config.lower_price <= p <= config.upper_price)
        time_in_range = in_range / len(price_data) * 100
        
        return {
            'total_profit': total_profit,
            'total_trades': total_trades,
            'profit_per_trade': total_profit / max(1, total_trades),
            'max_drawdown': max_drawdown,
            'time_in_range': time_in_range,
            'roi': (total_profit / config.investment) * 100,
            'data_points': len(price_data)
        }


# ============================================
# CLI Interface
# ============================================

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='K.I.T. Grid Trading Bot')
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Calculate command
    calc_parser = subparsers.add_parser('calculate', help='Calculate grid parameters')
    calc_parser.add_argument('--symbol', required=True, help='Trading pair (e.g., BTCUSDT)')
    calc_parser.add_argument('--lower', type=float, required=True, help='Lower price')
    calc_parser.add_argument('--upper', type=float, required=True, help='Upper price')
    calc_parser.add_argument('--grids', type=int, required=True, help='Number of grids')
    calc_parser.add_argument('--investment', type=float, required=True, help='Total investment')
    calc_parser.add_argument('--spacing', choices=['arithmetic', 'geometric'], default='arithmetic')
    
    # Start command
    start_parser = subparsers.add_parser('start', help='Start grid bot')
    start_parser.add_argument('--symbol', required=True)
    start_parser.add_argument('--lower', type=float, required=True)
    start_parser.add_argument('--upper', type=float, required=True)
    start_parser.add_argument('--grids', type=int, required=True)
    start_parser.add_argument('--investment', type=float, required=True)
    start_parser.add_argument('--type', choices=['spot', 'infinity', 'reverse'], default='spot')
    start_parser.add_argument('--spacing', choices=['arithmetic', 'geometric'], default='arithmetic')
    start_parser.add_argument('--stop-loss', type=float)
    start_parser.add_argument('--take-profit', type=float)
    start_parser.add_argument('--simulate', action='store_true', help='Run in simulation mode')
    
    # Status command
    status_parser = subparsers.add_parser('status', help='Show bot status')
    
    # Stop command
    stop_parser = subparsers.add_parser('stop', help='Stop grid bot')
    stop_parser.add_argument('--symbol', required=True)
    
    # Backtest command
    bt_parser = subparsers.add_parser('backtest', help='Backtest grid strategy')
    bt_parser.add_argument('--symbol', required=True)
    bt_parser.add_argument('--lower', type=float, required=True)
    bt_parser.add_argument('--upper', type=float, required=True)
    bt_parser.add_argument('--grids', type=int, required=True)
    bt_parser.add_argument('--investment', type=float, required=True)
    bt_parser.add_argument('--days', type=int, default=30)
    
    args = parser.parse_args()
    
    if args.command == 'calculate':
        config = GridConfig(
            symbol=args.symbol,
            lower_price=args.lower,
            upper_price=args.upper,
            num_grids=args.grids,
            investment=args.investment,
            spacing=GridSpacing(args.spacing)
        )
        print(GridCalculator.get_summary(config))
    
    elif args.command == 'start':
        config = GridConfig(
            symbol=args.symbol,
            lower_price=args.lower,
            upper_price=args.upper,
            num_grids=args.grids,
            investment=args.investment,
            grid_type=GridType(args.type),
            spacing=GridSpacing(args.spacing),
            stop_loss=args.stop_loss,
            take_profit=args.take_profit
        )
        
        bot = GridBot(config, exchange=None if args.simulate else None)  # Add exchange client
        
        print(GridCalculator.get_summary(config))
        print("\n🚀 Starting Grid Bot...")
        print("   Press Ctrl+C to stop\n")
        
        try:
            asyncio.run(bot.start())
            # Keep running
            while bot.running:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n⏹️  Stopping...")
            asyncio.run(bot.stop())
        
        print(bot.get_status())
    
    elif args.command == 'status':
        print("📊 Grid Bot Status")
        print("   (No active bots in this session)")
    
    elif args.command == 'stop':
        print(f"⏹️  Stopping bot for {args.symbol}...")
    
    elif args.command == 'backtest':
        config = GridConfig(
            symbol=args.symbol,
            lower_price=args.lower,
            upper_price=args.upper,
            num_grids=args.grids,
            investment=args.investment
        )
        
        # Generate mock price data for backtest
        import random
        random.seed(42)
        
        mid = (args.lower + args.upper) / 2
        prices = [mid]
        for _ in range(args.days * 24 * 60):  # Minute data
            change = random.gauss(0, 0.001)
            new_price = prices[-1] * (1 + change)
            # Mean reversion
            if new_price > args.upper * 1.1:
                new_price *= 0.99
            if new_price < args.lower * 0.9:
                new_price *= 1.01
            prices.append(new_price)
        
        print(f"\n📊 Running backtest with {len(prices):,} data points ({args.days} days)...\n")
        
        result = asyncio.run(GridBacktester.backtest(config, prices))
        
        print(f"""
╔═══════════════════════════════════════════════════════════╗
║              GRID BOT BACKTEST RESULTS                    ║
╚═══════════════════════════════════════════════════════════╝

📊 PARAMETERS
   Symbol:           {args.symbol}
   Price Range:      ${args.lower:,.2f} - ${args.upper:,.2f}
   Grid Count:       {args.grids}
   Investment:       ${args.investment:,.2f}
   Test Period:      {args.days} days
   
💰 RESULTS
   Total Profit:     ${result['total_profit']:,.2f}
   ROI:              {result['roi']:.2f}%
   Annualized:       {result['roi'] * 365 / args.days:.1f}%
   
📈 TRADES
   Total Trades:     {result['total_trades']}
   Profit/Trade:     ${result['profit_per_trade']:,.2f}
   
🛡️ RISK
   Max Drawdown:     ${result['max_drawdown']:,.2f}
   Time in Range:    {result['time_in_range']:.1f}%
""")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
