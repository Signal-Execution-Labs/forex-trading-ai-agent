"""
Pip Calculator - Pip Value & Profit Calculator für K.I.T.

Berechnet Pip-Werte, Gewinn/Verlust und Pip-Distanzen.

Usage:
    from skills.pip_calculator import (
        calculate_pip_value,
        calculate_profit,
        price_to_pips
    )
    
    value = calculate_pip_value("EURUSD", 0.1)
    profit = calculate_profit("EURUSD", 50, 0.1)
"""

from .calculator import (
    PipCalculator,
    calculate_pip_value,
    calculate_profit,
    price_to_pips,
    pips_to_price,
    get_pip_size,
    SYMBOL_PIP_SIZES,
    SYMBOL_CONTRACT_SIZES
)

__version__ = "1.0.0"
__all__ = [
    'PipCalculator',
    'calculate_pip_value',
    'calculate_profit',
    'price_to_pips',
    'pips_to_price',
    'get_pip_size',
    'SYMBOL_PIP_SIZES',
    'SYMBOL_CONTRACT_SIZES'
]
