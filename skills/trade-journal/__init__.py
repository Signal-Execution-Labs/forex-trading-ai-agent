"""
Trade Journal - Automatisches Trading-Tagebuch für K.I.T.

Dokumentiert Trades mit Notizen, Tags und Performance-Statistiken.

Usage:
    from skills.trade_journal import TradeJournal, Trade
    
    journal = TradeJournal()
    journal.add_trade(trade)
    stats = journal.get_statistics()
"""

from .journal import (
    TradeJournal,
    Trade,
    TradeStatistics,
    add_trade,
    get_trades,
    get_statistics,
    export_to_csv
)

__version__ = "1.0.0"
__all__ = [
    'TradeJournal',
    'Trade',
    'TradeStatistics',
    'add_trade',
    'get_trades',
    'get_statistics',
    'export_to_csv'
]
