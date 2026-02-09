"""
Trade Journal - Core Logic

Automatic trade documentation and performance tracking.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from pathlib import Path
import csv
from enum import Enum


class TradeDirection(Enum):
    BUY = "buy"
    SELL = "sell"


class TradeResult(Enum):
    WIN = "win"
    LOSS = "loss"
    BREAKEVEN = "breakeven"


@dataclass
class Trade:
    """Single trade record"""
    symbol: str
    direction: str
    entry_price: float
    exit_price: float
    lot_size: float
    
    # Calculated fields
    pips: float = 0
    profit: float = 0
    
    # Timestamps
    entry_time: Optional[datetime] = None
    exit_time: Optional[datetime] = None
    
    # Optional metadata
    setup: str = ""
    notes: str = ""
    tags: List[str] = field(default_factory=list)
    screenshot: str = ""
    
    # Identifiers
    id: str = ""
    ticket: int = 0
    magic: int = 0
    
    # Risk management
    stop_loss: float = 0
    take_profit: float = 0
    risk_amount: float = 0
    risk_reward: float = 0
    r_multiple: float = 0
    
    def __post_init__(self):
        # Generate ID if not provided
        if not self.id:
            ts = self.entry_time or datetime.now()
            self.id = f"T{ts.strftime('%Y%m%d%H%M%S')}"
        
        # Set timestamps
        if not self.entry_time:
            self.entry_time = datetime.now()
        if not self.exit_time:
            self.exit_time = datetime.now()
        
        # Calculate pips if not provided
        if self.pips == 0:
            self._calculate_pips()
        
        # Calculate R-multiple if risk is set
        if self.risk_amount > 0 and self.profit != 0:
            self.r_multiple = round(self.profit / self.risk_amount, 2)
    
    def _calculate_pips(self):
        """Calculate pips from prices"""
        diff = self.exit_price - self.entry_price
        
        if self.direction.lower() == "sell":
            diff = -diff
        
        # Determine pip size
        if "JPY" in self.symbol.upper():
            pip_size = 0.01
        elif "XAU" in self.symbol.upper() or "GOLD" in self.symbol.upper():
            pip_size = 0.1
        else:
            pip_size = 0.0001
        
        self.pips = round(diff / pip_size, 1)
    
    @property
    def result(self) -> TradeResult:
        """Get trade result"""
        if self.profit > 0:
            return TradeResult.WIN
        elif self.profit < 0:
            return TradeResult.LOSS
        return TradeResult.BREAKEVEN
    
    @property
    def duration(self) -> timedelta:
        """Trade duration"""
        if self.entry_time and self.exit_time:
            return self.exit_time - self.entry_time
        return timedelta(0)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        data = asdict(self)
        data['entry_time'] = self.entry_time.isoformat() if self.entry_time else None
        data['exit_time'] = self.exit_time.isoformat() if self.exit_time else None
        data['result'] = self.result.value
        data['duration_minutes'] = self.duration.total_seconds() / 60
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Trade':
        """Create from dictionary"""
        # Parse datetime strings
        if data.get('entry_time') and isinstance(data['entry_time'], str):
            data['entry_time'] = datetime.fromisoformat(data['entry_time'])
        if data.get('exit_time') and isinstance(data['exit_time'], str):
            data['exit_time'] = datetime.fromisoformat(data['exit_time'])
        
        # Remove calculated fields that will be regenerated
        data.pop('result', None)
        data.pop('duration_minutes', None)
        
        return cls(**data)


@dataclass
class TradeStatistics:
    """Trading statistics"""
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    breakeven_trades: int = 0
    
    total_profit: float = 0
    gross_profit: float = 0
    gross_loss: float = 0
    
    largest_win: float = 0
    largest_loss: float = 0
    average_win: float = 0
    average_loss: float = 0
    
    win_rate: float = 0
    profit_factor: float = 0
    expectancy: float = 0
    
    total_pips: float = 0
    average_pips: float = 0
    
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    
    average_r_multiple: float = 0
    best_r_multiple: float = 0
    
    best_symbol: str = ""
    worst_symbol: str = ""
    best_setup: str = ""
    
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['period_start'] = self.period_start.isoformat() if self.period_start else None
        data['period_end'] = self.period_end.isoformat() if self.period_end else None
        return data


class TradeJournal:
    """
    Trade Journal for tracking and analyzing trades
    
    Usage:
        journal = TradeJournal("./journal_data")
        journal.add_trade(trade)
        stats = journal.get_statistics()
    """
    
    def __init__(self, data_path: str = "./trade_journal"):
        self.data_path = Path(data_path)
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.trades_file = self.data_path / "trades.json"
        self._trades: List[Trade] = []
        self._load_trades()
    
    def _load_trades(self):
        """Load trades from file"""
        if self.trades_file.exists():
            try:
                with open(self.trades_file, 'r') as f:
                    data = json.load(f)
                    self._trades = [Trade.from_dict(t) for t in data]
            except Exception as e:
                print(f"Error loading trades: {e}")
                self._trades = []
    
    def _save_trades(self):
        """Save trades to file"""
        with open(self.trades_file, 'w') as f:
            json.dump([t.to_dict() for t in self._trades], f, indent=2)
    
    def add_trade(self, trade: Trade) -> str:
        """
        Add a trade to the journal
        
        Args:
            trade: Trade object
            
        Returns:
            Trade ID
        """
        self._trades.append(trade)
        self._save_trades()
        return trade.id
    
    def add_trade_from_data(
        self,
        symbol: str,
        direction: str,
        entry_price: float,
        exit_price: float,
        lot_size: float,
        profit: float = None,
        **kwargs
    ) -> str:
        """
        Add trade from individual parameters
        
        Returns:
            Trade ID
        """
        trade = Trade(
            symbol=symbol,
            direction=direction,
            entry_price=entry_price,
            exit_price=exit_price,
            lot_size=lot_size,
            profit=profit or 0,
            **kwargs
        )
        return self.add_trade(trade)
    
    def get_trade(self, trade_id: str) -> Optional[Trade]:
        """Get trade by ID"""
        for trade in self._trades:
            if trade.id == trade_id:
                return trade
        return None
    
    def update_trade(self, trade_id: str, **updates) -> bool:
        """Update trade fields"""
        trade = self.get_trade(trade_id)
        if trade:
            for key, value in updates.items():
                if hasattr(trade, key):
                    setattr(trade, key, value)
            self._save_trades()
            return True
        return False
    
    def delete_trade(self, trade_id: str) -> bool:
        """Delete a trade"""
        trade = self.get_trade(trade_id)
        if trade:
            self._trades.remove(trade)
            self._save_trades()
            return True
        return False
    
    def get_trades(
        self,
        symbol: Optional[str] = None,
        direction: Optional[str] = None,
        setup: Optional[str] = None,
        tags: Optional[List[str]] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        result: Optional[str] = None,
        limit: int = None
    ) -> List[Trade]:
        """
        Get trades with optional filters
        
        Args:
            symbol: Filter by symbol
            direction: Filter by direction (buy/sell)
            setup: Filter by setup name
            tags: Filter by tags (any match)
            start_date: Start of period
            end_date: End of period
            result: Filter by result (win/loss/breakeven)
            limit: Max number of trades
            
        Returns:
            List of matching trades
        """
        filtered = self._trades.copy()
        
        if symbol:
            filtered = [t for t in filtered if t.symbol.upper() == symbol.upper()]
        
        if direction:
            filtered = [t for t in filtered if t.direction.lower() == direction.lower()]
        
        if setup:
            filtered = [t for t in filtered if setup.lower() in t.setup.lower()]
        
        if tags:
            filtered = [t for t in filtered if any(tag in t.tags for tag in tags)]
        
        if start_date:
            filtered = [t for t in filtered if t.entry_time and t.entry_time >= start_date]
        
        if end_date:
            filtered = [t for t in filtered if t.entry_time and t.entry_time <= end_date]
        
        if result:
            filtered = [t for t in filtered if t.result.value == result]
        
        # Sort by entry time (newest first)
        filtered.sort(key=lambda t: t.entry_time or datetime.min, reverse=True)
        
        if limit:
            filtered = filtered[:limit]
        
        return filtered
    
    def get_statistics(
        self,
        symbol: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        period: Optional[str] = None  # "day", "week", "month", "year"
    ) -> TradeStatistics:
        """
        Calculate trading statistics
        
        Args:
            symbol: Filter by symbol
            start_date: Start of period
            end_date: End of period
            period: Predefined period ("day", "week", "month", "year")
            
        Returns:
            TradeStatistics object
        """
        # Handle period shortcuts
        now = datetime.now()
        if period:
            if period == "day":
                start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif period == "week":
                start_date = now - timedelta(days=7)
            elif period == "month":
                start_date = now - timedelta(days=30)
            elif period == "year":
                start_date = now - timedelta(days=365)
        
        # Get filtered trades
        trades = self.get_trades(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date
        )
        
        if not trades:
            return TradeStatistics()
        
        # Calculate statistics
        stats = TradeStatistics()
        stats.total_trades = len(trades)
        stats.period_start = start_date
        stats.period_end = end_date or now
        
        wins = [t for t in trades if t.result == TradeResult.WIN]
        losses = [t for t in trades if t.result == TradeResult.LOSS]
        
        stats.winning_trades = len(wins)
        stats.losing_trades = len(losses)
        stats.breakeven_trades = len(trades) - len(wins) - len(losses)
        
        # Profit calculations
        stats.gross_profit = sum(t.profit for t in wins) if wins else 0
        stats.gross_loss = abs(sum(t.profit for t in losses)) if losses else 0
        stats.total_profit = stats.gross_profit - stats.gross_loss
        
        if wins:
            stats.largest_win = max(t.profit for t in wins)
            stats.average_win = stats.gross_profit / len(wins)
        
        if losses:
            stats.largest_loss = min(t.profit for t in losses)
            stats.average_loss = stats.gross_loss / len(losses)
        
        # Ratios
        stats.win_rate = (len(wins) / len(trades)) * 100 if trades else 0
        stats.profit_factor = (stats.gross_profit / stats.gross_loss) if stats.gross_loss > 0 else float('inf')
        
        # Expectancy: (Win% × Avg Win) - (Loss% × Avg Loss)
        if trades:
            win_pct = len(wins) / len(trades)
            loss_pct = len(losses) / len(trades)
            stats.expectancy = (win_pct * stats.average_win) - (loss_pct * stats.average_loss)
        
        # Pips
        stats.total_pips = sum(t.pips for t in trades)
        stats.average_pips = stats.total_pips / len(trades) if trades else 0
        
        # R-multiples
        r_trades = [t for t in trades if t.r_multiple != 0]
        if r_trades:
            stats.average_r_multiple = sum(t.r_multiple for t in r_trades) / len(r_trades)
            stats.best_r_multiple = max(t.r_multiple for t in r_trades)
        
        # Best/worst symbols
        symbol_profits = {}
        for t in trades:
            symbol_profits[t.symbol] = symbol_profits.get(t.symbol, 0) + t.profit
        
        if symbol_profits:
            stats.best_symbol = max(symbol_profits, key=symbol_profits.get)
            stats.worst_symbol = min(symbol_profits, key=symbol_profits.get)
        
        # Best setup
        setup_stats = {}
        for t in trades:
            if t.setup:
                if t.setup not in setup_stats:
                    setup_stats[t.setup] = {'wins': 0, 'total': 0}
                setup_stats[t.setup]['total'] += 1
                if t.result == TradeResult.WIN:
                    setup_stats[t.setup]['wins'] += 1
        
        if setup_stats:
            best_setup = max(
                setup_stats.items(),
                key=lambda x: x[1]['wins'] / x[1]['total'] if x[1]['total'] > 0 else 0
            )
            stats.best_setup = best_setup[0]
        
        # Consecutive wins/losses
        current_streak = 0
        max_wins = 0
        max_losses = 0
        
        for t in sorted(trades, key=lambda x: x.entry_time or datetime.min):
            if t.result == TradeResult.WIN:
                if current_streak > 0:
                    current_streak += 1
                else:
                    current_streak = 1
                max_wins = max(max_wins, current_streak)
            elif t.result == TradeResult.LOSS:
                if current_streak < 0:
                    current_streak -= 1
                else:
                    current_streak = -1
                max_losses = max(max_losses, abs(current_streak))
            else:
                current_streak = 0
        
        stats.max_consecutive_wins = max_wins
        stats.max_consecutive_losses = max_losses
        
        return stats
    
    def export_to_csv(
        self,
        filepath: Optional[str] = None,
        **filters
    ) -> str:
        """
        Export trades to CSV file
        
        Args:
            filepath: Output file path
            **filters: Filters to pass to get_trades()
            
        Returns:
            Path to exported file
        """
        trades = self.get_trades(**filters)
        
        if not filepath:
            filepath = str(self.data_path / f"trades_export_{datetime.now().strftime('%Y%m%d')}.csv")
        
        fieldnames = [
            'id', 'symbol', 'direction', 'entry_time', 'exit_time',
            'entry_price', 'exit_price', 'lot_size', 'pips', 'profit',
            'setup', 'tags', 'notes', 'stop_loss', 'take_profit',
            'risk_amount', 'r_multiple', 'result'
        ]
        
        with open(filepath, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for trade in trades:
                row = trade.to_dict()
                row['tags'] = ','.join(row.get('tags', []))
                writer.writerow({k: row.get(k, '') for k in fieldnames})
        
        return filepath
    
    def format_report(
        self,
        period: str = "week"
    ) -> str:
        """
        Generate a formatted text report
        
        Args:
            period: "day", "week", "month", or "year"
            
        Returns:
            Formatted report string
        """
        stats = self.get_statistics(period=period)
        trades = self.get_trades()
        
        lines = [
            "📔 K.I.T. TRADE JOURNAL",
            "━" * 45,
            f"📅 Period: {period.capitalize()}",
            "",
            "📊 OVERVIEW",
            f"   Total Trades:     {stats.total_trades}",
            f"   Winning Trades:   {stats.winning_trades} ({stats.win_rate:.1f}%)",
            f"   Losing Trades:    {stats.losing_trades}",
            "",
            "💰 PERFORMANCE",
            f"   Total Profit:     ${stats.total_profit:,.2f}",
            f"   Profit Factor:    {stats.profit_factor:.2f}" if stats.profit_factor != float('inf') else "   Profit Factor:    ∞",
            f"   Average Win:      ${stats.average_win:,.2f}",
            f"   Average Loss:     -${stats.average_loss:,.2f}",
            f"   Expectancy:       ${stats.expectancy:,.2f}",
            "",
            "📏 PIPS",
            f"   Total Pips:       {stats.total_pips:.1f}",
            f"   Average Pips:     {stats.average_pips:.1f}",
            "",
            "🏆 HIGHLIGHTS",
            f"   Largest Win:      ${stats.largest_win:,.2f}",
            f"   Largest Loss:     ${stats.largest_loss:,.2f}",
            f"   Best Symbol:      {stats.best_symbol}",
            f"   Best Setup:       {stats.best_setup}" if stats.best_setup else "",
            "",
            "📈 STREAKS",
            f"   Max Consecutive Wins:   {stats.max_consecutive_wins}",
            f"   Max Consecutive Losses: {stats.max_consecutive_losses}",
        ]
        
        return "\n".join(line for line in lines if line or line == "")


# Convenience functions with default journal
_default_journal = None


def _get_default_journal() -> TradeJournal:
    global _default_journal
    if _default_journal is None:
        _default_journal = TradeJournal()
    return _default_journal


def add_trade(trade: Trade) -> str:
    """Add trade to default journal"""
    return _get_default_journal().add_trade(trade)


def get_trades(**filters) -> List[Trade]:
    """Get trades from default journal"""
    return _get_default_journal().get_trades(**filters)


def get_statistics(**filters) -> TradeStatistics:
    """Get statistics from default journal"""
    return _get_default_journal().get_statistics(**filters)


def export_to_csv(filepath: Optional[str] = None, **filters) -> str:
    """Export from default journal"""
    return _get_default_journal().export_to_csv(filepath, **filters)


# CLI for testing
if __name__ == "__main__":
    journal = TradeJournal("./test_journal")
    
    # Add some test trades
    test_trades = [
        Trade("EURUSD", "buy", 1.0850, 1.0892, 0.1, profit=42.0, setup="Breakout"),
        Trade("GBPUSD", "sell", 1.2650, 1.2680, 0.1, profit=-30.0, setup="Reversal"),
        Trade("USDJPY", "buy", 149.50, 150.00, 0.1, profit=33.5, setup="Trend"),
        Trade("EURUSD", "buy", 1.0900, 1.0850, 0.1, profit=-50.0, setup="Breakout"),
        Trade("XAUUSD", "buy", 2050.0, 2065.0, 0.05, profit=75.0, setup="Support"),
    ]
    
    for trade in test_trades:
        journal.add_trade(trade)
    
    # Print report
    print(journal.format_report("month"))
    
    # Export
    csv_path = journal.export_to_csv()
    print(f"\n📁 Exported to: {csv_path}")
