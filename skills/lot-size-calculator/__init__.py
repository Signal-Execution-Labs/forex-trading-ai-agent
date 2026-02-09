"""
Lot Size Calculator - Risk-based Position Sizing für K.I.T.

Berechnet die optimale Positionsgröße basierend auf:
- Account Balance
- Risiko Prozent
- Stop Loss in Pips
- Symbol und Pip Value

Usage:
    from skills.lot_size_calculator import calculate_lot_size, LotSizeCalculator
    
    result = calculate_lot_size(
        balance=10000,
        risk_percent=2.0,
        stop_loss_pips=30,
        symbol="EURUSD"
    )
"""

from .calculator import (
    LotSizeCalculator,
    calculate_lot_size,
    get_pip_value,
    PIP_VALUES,
    SYMBOL_TYPES
)

__version__ = "1.0.0"
__all__ = [
    'LotSizeCalculator',
    'calculate_lot_size', 
    'get_pip_value',
    'PIP_VALUES',
    'SYMBOL_TYPES'
]
