#!/usr/bin/env python3
"""
K.I.T. Paper Trading System

Risk-free trading simulation with real market data.
Test strategies without risking real money.

Usage:
    python paper_trading.py init --balance 10000
    python paper_trading.py buy BTCUSDT 0.1
    python paper_trading.py sell BTCUSDT 0.05 --price 50000
    python paper_trading.py portfolio
    python paper_trading.py report
"""

import asyncio
import json
import os
import random
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Any
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('PaperTrading')


# ============================================
# Types
# ============================================

class OrderType(Enum):
    MARKET = "market"
    LIMIT = "limit"
    STOP = "stop"
    STOP_LIMIT = "stop_limit"


class OrderSide(Enum):
    BUY = "buy"
    SELL = "sell"


class OrderStatus(Enum):
    OPEN = "open"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


@dataclass
class Position:
    """Open position"""
    symbol: str
    quantity: float
    avg_price: float
    unrealized_pnl: float = 0.0
    realized_pnl: float = 0.0
    opened_at: datetime = field(default_factory=datetime.now)


@dataclass
class Order:
    """Trading order"""
    id: str
    symbol: str
    side: OrderSide
    order_type: OrderType
    quantity: float
    price: Optional[float] = None
    stop_price: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    status: OrderStatus = OrderStatus.OPEN
    filled_quantity: float = 0.0
    filled_price: float = 0.0
    fee: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    filled_at: Optional[datetime] = None


@dataclass
class Trade:
    """Executed trade"""
    id: str
    order_id: str
    symbol: str
    side: OrderSide
    quantity: float
    price: float
    fee: float
    pnl: float
    timestamp: datetime


@dataclass
class AccountSettings:
    """Account settings"""
    fee_rate: float = 0.001  # 0.1%
    slippage_min: float = 0.0001  # 0.01%
    slippage_max: float = 0.0005  # 0.05%
    simulate_delays: bool = True
    partial_fills: bool = False


# ============================================
# Price Feed (Mock/Real)
# ============================================

class PriceFeed:
    """Price feed for paper trading"""
    
    # Mock prices for common pairs
    MOCK_PRICES = {
        'BTCUSDT': 45000.0,
        'ETHUSDT': 2500.0,
        'BNBUSDT': 350.0,
        'SOLUSDT': 100.0,
        'XRPUSDT': 0.55,
        'ADAUSDT': 0.45,
        'DOGEUSDT': 0.08,
        'MATICUSDT': 0.85,
        'LINKUSDT': 15.0,
        'AVAXUSDT': 35.0,
    }
    
    @classmethod
    async def get_price(cls, symbol: str) -> float:
        """Get current price for symbol"""
        # In production, this would fetch from exchange API
        base_price = cls.MOCK_PRICES.get(symbol.upper(), 100.0)
        # Add some random variation (+/- 0.5%)
        variation = random.uniform(-0.005, 0.005)
        return base_price * (1 + variation)
    
    @classmethod
    async def get_prices(cls, symbols: List[str]) -> Dict[str, float]:
        """Get prices for multiple symbols"""
        return {s: await cls.get_price(s) for s in symbols}


# ============================================
# Paper Trading Account
# ============================================

class PaperTradingAccount:
    """Paper trading account with simulated execution"""
    
    def __init__(
        self,
        account_id: Optional[str] = None,
        initial_balance: float = 10000.0,
        currency: str = "USD",
        settings: Optional[AccountSettings] = None,
        data_file: Optional[str] = None
    ):
        self.account_id = account_id or f"paper_{int(time.time())}"
        self.currency = currency
        self.settings = settings or AccountSettings()
        self.data_file = data_file or f"paper_account_{self.account_id}.json"
        
        # Account state
        self.initial_balance = initial_balance
        self.balance = initial_balance
        self.positions: Dict[str, Position] = {}
        self.open_orders: Dict[str, Order] = {}
        self.trades: List[Trade] = []
        self.created_at = datetime.now()
        
        # Try to load existing state
        self._load_state()
    
    # ----------------------------------------
    # Order Management
    # ----------------------------------------
    
    async def buy(
        self,
        symbol: str,
        quantity: float,
        order_type: str = "market",
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None
    ) -> Order:
        """Place a buy order"""
        return await self._place_order(
            symbol=symbol,
            side=OrderSide.BUY,
            quantity=quantity,
            order_type=OrderType(order_type),
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit
        )
    
    async def sell(
        self,
        symbol: str,
        quantity: float,
        order_type: str = "market",
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None
    ) -> Order:
        """Place a sell order"""
        return await self._place_order(
            symbol=symbol,
            side=OrderSide.SELL,
            quantity=quantity,
            order_type=OrderType(order_type),
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit
        )
    
    async def _place_order(
        self,
        symbol: str,
        side: OrderSide,
        quantity: float,
        order_type: OrderType,
        price: Optional[float] = None,
        stop_loss: Optional[float] = None,
        take_profit: Optional[float] = None
    ) -> Order:
        """Internal order placement"""
        
        # Create order
        order = Order(
            id=f"order_{int(time.time()*1000)}_{random.randint(1000, 9999)}",
            symbol=symbol.upper(),
            side=side,
            order_type=order_type,
            quantity=quantity,
            price=price,
            stop_loss=stop_loss,
            take_profit=take_profit
        )
        
        # Validate order
        current_price = await PriceFeed.get_price(symbol)
        order_value = quantity * current_price
        
        if side == OrderSide.BUY:
            if order_value > self.balance:
                raise ValueError(f"Insufficient balance: need ${order_value:.2f}, have ${self.balance:.2f}")
        else:
            position = self.positions.get(symbol.upper())
            if not position or position.quantity < quantity:
                available = position.quantity if position else 0
                raise ValueError(f"Insufficient position: need {quantity}, have {available}")
        
        # Execute market orders immediately
        if order_type == OrderType.MARKET:
            await self._execute_order(order, current_price)
        else:
            # Add to open orders
            self.open_orders[order.id] = order
            logger.info(f"Limit order placed: {side.value} {quantity} {symbol} @ ${price:,.2f}")
        
        self._save_state()
        return order
    
    async def _execute_order(self, order: Order, current_price: float):
        """Execute an order at given price"""
        
        # Apply slippage for market orders
        if order.order_type == OrderType.MARKET:
            slippage = random.uniform(self.settings.slippage_min, self.settings.slippage_max)
            if order.side == OrderSide.BUY:
                current_price *= (1 + slippage)  # Pay more
            else:
                current_price *= (1 - slippage)  # Receive less
        
        # Calculate fee
        order_value = order.quantity * current_price
        fee = order_value * self.settings.fee_rate
        
        # Calculate P&L for sells
        pnl = 0.0
        if order.side == OrderSide.SELL:
            position = self.positions.get(order.symbol)
            if position:
                pnl = (current_price - position.avg_price) * order.quantity - fee
        
        # Update balances
        if order.side == OrderSide.BUY:
            self.balance -= (order_value + fee)
            # Update position
            if order.symbol in self.positions:
                pos = self.positions[order.symbol]
                total_qty = pos.quantity + order.quantity
                pos.avg_price = (pos.avg_price * pos.quantity + current_price * order.quantity) / total_qty
                pos.quantity = total_qty
            else:
                self.positions[order.symbol] = Position(
                    symbol=order.symbol,
                    quantity=order.quantity,
                    avg_price=current_price
                )
        else:  # SELL
            self.balance += (order_value - fee)
            # Update position
            if order.symbol in self.positions:
                pos = self.positions[order.symbol]
                pos.quantity -= order.quantity
                pos.realized_pnl += pnl
                if pos.quantity <= 0:
                    del self.positions[order.symbol]
        
        # Update order status
        order.status = OrderStatus.FILLED
        order.filled_quantity = order.quantity
        order.filled_price = current_price
        order.fee = fee
        order.filled_at = datetime.now()
        
        # Record trade
        trade = Trade(
            id=f"trade_{int(time.time()*1000)}",
            order_id=order.id,
            symbol=order.symbol,
            side=order.side,
            quantity=order.quantity,
            price=current_price,
            fee=fee,
            pnl=pnl,
            timestamp=datetime.now()
        )
        self.trades.append(trade)
        
        # Remove from open orders
        if order.id in self.open_orders:
            del self.open_orders[order.id]
        
        logger.info(
            f"✅ {order.side.value.upper()} {order.quantity} {order.symbol} @ ${current_price:,.2f} "
            f"| Fee: ${fee:.2f} | P&L: ${pnl:,.2f}"
        )
    
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an open order"""
        if order_id in self.open_orders:
            order = self.open_orders[order_id]
            order.status = OrderStatus.CANCELLED
            del self.open_orders[order_id]
            self._save_state()
            logger.info(f"Order {order_id} cancelled")
            return True
        return False
    
    # ----------------------------------------
    # Position Management
    # ----------------------------------------
    
    async def update_positions(self):
        """Update unrealized P&L for all positions"""
        for symbol, position in self.positions.items():
            current_price = await PriceFeed.get_price(symbol)
            position.unrealized_pnl = (current_price - position.avg_price) * position.quantity
    
    def get_position(self, symbol: str) -> Optional[Position]:
        """Get position for symbol"""
        return self.positions.get(symbol.upper())
    
    # ----------------------------------------
    # Portfolio & Analytics
    # ----------------------------------------
    
    async def get_portfolio_value(self) -> float:
        """Calculate total portfolio value"""
        await self.update_positions()
        positions_value = sum(
            p.quantity * await PriceFeed.get_price(p.symbol)
            for p in self.positions.values()
        )
        return self.balance + positions_value
    
    def get_pnl(self) -> Dict[str, float]:
        """Get P&L statistics"""
        realized = sum(t.pnl for t in self.trades)
        unrealized = sum(p.unrealized_pnl for p in self.positions.values())
        
        return {
            'realized_pnl': realized,
            'unrealized_pnl': unrealized,
            'total_pnl': realized + unrealized,
            'pnl_percent': ((self.balance + realized - self.initial_balance) / self.initial_balance) * 100
        }
    
    def get_trade_stats(self) -> Dict[str, Any]:
        """Get trading statistics"""
        if not self.trades:
            return {
                'total_trades': 0,
                'winning_trades': 0,
                'losing_trades': 0,
                'win_rate': 0,
                'avg_win': 0,
                'avg_loss': 0,
                'profit_factor': 0
            }
        
        winning = [t for t in self.trades if t.pnl > 0]
        losing = [t for t in self.trades if t.pnl < 0]
        
        total_wins = sum(t.pnl for t in winning) if winning else 0
        total_losses = abs(sum(t.pnl for t in losing)) if losing else 0
        
        return {
            'total_trades': len(self.trades),
            'winning_trades': len(winning),
            'losing_trades': len(losing),
            'win_rate': len(winning) / len(self.trades) * 100 if self.trades else 0,
            'avg_win': total_wins / len(winning) if winning else 0,
            'avg_loss': total_losses / len(losing) if losing else 0,
            'profit_factor': total_wins / total_losses if total_losses > 0 else float('inf'),
            'total_fees': sum(t.fee for t in self.trades)
        }
    
    async def get_portfolio_summary(self) -> str:
        """Get formatted portfolio summary"""
        await self.update_positions()
        total_value = await self.get_portfolio_value()
        pnl = self.get_pnl()
        stats = self.get_trade_stats()
        
        lines = [
            "",
            "╔═══════════════════════════════════════════════════════════╗",
            "║           K.I.T. PAPER TRADING PORTFOLIO                  ║",
            "╚═══════════════════════════════════════════════════════════╝",
            "",
            f"Account ID:      {self.account_id}",
            f"Created:         {self.created_at.strftime('%Y-%m-%d %H:%M')}",
            "",
            "💰 BALANCES",
            f"   Cash:         ${self.balance:,.2f}",
            f"   Positions:    ${total_value - self.balance:,.2f}",
            f"   Total Value:  ${total_value:,.2f}",
            "",
            "📈 PERFORMANCE",
            f"   Realized P&L:   ${pnl['realized_pnl']:+,.2f}",
            f"   Unrealized P&L: ${pnl['unrealized_pnl']:+,.2f}",
            f"   Total P&L:      ${pnl['total_pnl']:+,.2f} ({pnl['pnl_percent']:+.2f}%)",
            "",
            "📊 STATISTICS",
            f"   Total Trades:  {stats['total_trades']}",
            f"   Win Rate:      {stats['win_rate']:.1f}%",
            f"   Profit Factor: {stats['profit_factor']:.2f}",
            f"   Total Fees:    ${stats['total_fees']:.2f}",
            "",
        ]
        
        if self.positions:
            lines.append("📦 OPEN POSITIONS")
            for symbol, pos in self.positions.items():
                price = await PriceFeed.get_price(symbol)
                pnl_pct = (price - pos.avg_price) / pos.avg_price * 100
                lines.append(
                    f"   {symbol}: {pos.quantity:.8f} @ ${pos.avg_price:,.2f} "
                    f"| Now: ${price:,.2f} ({pnl_pct:+.2f}%)"
                )
            lines.append("")
        
        if self.open_orders:
            lines.append("📋 OPEN ORDERS")
            for order in self.open_orders.values():
                lines.append(
                    f"   {order.side.value.upper()} {order.quantity} {order.symbol} "
                    f"@ ${order.price:,.2f} [{order.order_type.value}]"
                )
            lines.append("")
        
        return '\n'.join(lines)
    
    # ----------------------------------------
    # Persistence
    # ----------------------------------------
    
    def _save_state(self):
        """Save account state to file"""
        state = {
            'account_id': self.account_id,
            'created_at': self.created_at.isoformat(),
            'initial_balance': self.initial_balance,
            'balance': self.balance,
            'currency': self.currency,
            'positions': {
                k: {
                    'symbol': v.symbol,
                    'quantity': v.quantity,
                    'avg_price': v.avg_price,
                    'unrealized_pnl': v.unrealized_pnl,
                    'realized_pnl': v.realized_pnl,
                    'opened_at': v.opened_at.isoformat()
                }
                for k, v in self.positions.items()
            },
            'trades': [
                {
                    'id': t.id,
                    'order_id': t.order_id,
                    'symbol': t.symbol,
                    'side': t.side.value,
                    'quantity': t.quantity,
                    'price': t.price,
                    'fee': t.fee,
                    'pnl': t.pnl,
                    'timestamp': t.timestamp.isoformat()
                }
                for t in self.trades
            ],
            'settings': asdict(self.settings)
        }
        
        with open(self.data_file, 'w') as f:
            json.dump(state, f, indent=2)
    
    def _load_state(self):
        """Load account state from file"""
        if not os.path.exists(self.data_file):
            return
        
        try:
            with open(self.data_file, 'r') as f:
                state = json.load(f)
            
            self.account_id = state['account_id']
            self.created_at = datetime.fromisoformat(state['created_at'])
            self.initial_balance = state['initial_balance']
            self.balance = state['balance']
            self.currency = state.get('currency', 'USD')
            
            self.positions = {
                k: Position(
                    symbol=v['symbol'],
                    quantity=v['quantity'],
                    avg_price=v['avg_price'],
                    unrealized_pnl=v.get('unrealized_pnl', 0),
                    realized_pnl=v.get('realized_pnl', 0),
                    opened_at=datetime.fromisoformat(v['opened_at'])
                )
                for k, v in state.get('positions', {}).items()
            }
            
            self.trades = [
                Trade(
                    id=t['id'],
                    order_id=t['order_id'],
                    symbol=t['symbol'],
                    side=OrderSide(t['side']),
                    quantity=t['quantity'],
                    price=t['price'],
                    fee=t['fee'],
                    pnl=t['pnl'],
                    timestamp=datetime.fromisoformat(t['timestamp'])
                )
                for t in state.get('trades', [])
            ]
            
            logger.info(f"Loaded account state: {self.account_id}")
            
        except Exception as e:
            logger.error(f"Failed to load state: {e}")
    
    def reset(self, new_balance: Optional[float] = None):
        """Reset account to initial state"""
        self.balance = new_balance or self.initial_balance
        self.initial_balance = self.balance
        self.positions = {}
        self.open_orders = {}
        self.trades = []
        self.created_at = datetime.now()
        self._save_state()
        logger.info(f"Account reset with balance ${self.balance:,.2f}")


# ============================================
# CLI Interface
# ============================================

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='K.I.T. Paper Trading')
    subparsers = parser.add_subparsers(dest='command', help='Commands')
    
    # Init command
    init_parser = subparsers.add_parser('init', help='Initialize paper account')
    init_parser.add_argument('--balance', type=float, default=10000, help='Initial balance')
    init_parser.add_argument('--currency', default='USD', help='Currency')
    init_parser.add_argument('--id', help='Account ID')
    
    # Buy command
    buy_parser = subparsers.add_parser('buy', help='Place buy order')
    buy_parser.add_argument('symbol', help='Trading pair')
    buy_parser.add_argument('quantity', type=float, help='Quantity to buy')
    buy_parser.add_argument('--type', choices=['market', 'limit'], default='market')
    buy_parser.add_argument('--price', type=float, help='Limit price')
    buy_parser.add_argument('--sl', type=float, help='Stop loss')
    buy_parser.add_argument('--tp', type=float, help='Take profit')
    
    # Sell command
    sell_parser = subparsers.add_parser('sell', help='Place sell order')
    sell_parser.add_argument('symbol', help='Trading pair')
    sell_parser.add_argument('quantity', type=float, help='Quantity to sell')
    sell_parser.add_argument('--type', choices=['market', 'limit'], default='market')
    sell_parser.add_argument('--price', type=float, help='Limit price')
    
    # Portfolio command
    portfolio_parser = subparsers.add_parser('portfolio', help='Show portfolio')
    
    # History command
    history_parser = subparsers.add_parser('history', help='Show trade history')
    history_parser.add_argument('--limit', type=int, default=20, help='Number of trades')
    
    # Report command
    report_parser = subparsers.add_parser('report', help='Show performance report')
    
    # Reset command
    reset_parser = subparsers.add_parser('reset', help='Reset account')
    reset_parser.add_argument('--balance', type=float, help='New balance')
    reset_parser.add_argument('--confirm', action='store_true', help='Confirm reset')
    
    args = parser.parse_args()
    
    # Load or create account
    account = PaperTradingAccount()
    
    if args.command == 'init':
        account = PaperTradingAccount(
            account_id=args.id,
            initial_balance=args.balance,
            currency=args.currency
        )
        account._save_state()
        print(f"\n✅ Paper trading account initialized!")
        print(f"   ID: {account.account_id}")
        print(f"   Balance: ${args.balance:,.2f} {args.currency}\n")
    
    elif args.command == 'buy':
        order = await account.buy(
            symbol=args.symbol,
            quantity=args.quantity,
            order_type=args.type,
            price=args.price,
            stop_loss=args.sl,
            take_profit=args.tp
        )
        print(f"\n✅ Buy order placed: {order.id}\n")
    
    elif args.command == 'sell':
        order = await account.sell(
            symbol=args.symbol,
            quantity=args.quantity,
            order_type=args.type,
            price=args.price
        )
        print(f"\n✅ Sell order placed: {order.id}\n")
    
    elif args.command == 'portfolio':
        print(await account.get_portfolio_summary())
    
    elif args.command == 'history':
        trades = account.trades[-args.limit:]
        print(f"\n📜 Recent Trades ({len(trades)})\n")
        for t in reversed(trades):
            print(
                f"   {t.timestamp.strftime('%Y-%m-%d %H:%M')} | "
                f"{t.side.value.upper():4} {t.quantity:.8f} {t.symbol} @ ${t.price:,.2f} "
                f"| P&L: ${t.pnl:+,.2f}"
            )
        print()
    
    elif args.command == 'report':
        stats = account.get_trade_stats()
        pnl = account.get_pnl()
        
        print(f"""
╔═══════════════════════════════════════════════════════════╗
║           K.I.T. PAPER TRADING REPORT                     ║
╚═══════════════════════════════════════════════════════════╝

💰 PROFIT & LOSS
   Total P&L:      ${pnl['total_pnl']:+,.2f}
   Return:         {pnl['pnl_percent']:+.2f}%
   
📊 TRADE STATISTICS
   Total Trades:   {stats['total_trades']}
   Winning:        {stats['winning_trades']}
   Losing:         {stats['losing_trades']}
   Win Rate:       {stats['win_rate']:.1f}%
   
💵 AVERAGES
   Avg Win:        ${stats['avg_win']:,.2f}
   Avg Loss:       ${stats['avg_loss']:,.2f}
   Profit Factor:  {stats['profit_factor']:.2f}
   
💸 COSTS
   Total Fees:     ${stats['total_fees']:,.2f}
""")
    
    elif args.command == 'reset':
        if args.confirm:
            account.reset(args.balance)
            print(f"\n✅ Account reset. New balance: ${account.balance:,.2f}\n")
        else:
            print("\n⚠️  Use --confirm to reset account\n")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    asyncio.run(main())
