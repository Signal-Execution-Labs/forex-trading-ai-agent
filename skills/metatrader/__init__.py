"""
MetaTrader 4/5 Skill für K.I.T.

Forex & CFD Trading via MetaTrader 5 Python API
"""

from .scripts.mt5_connector import MT5Connector, MT5Error
from .scripts.mt5_orders import MT5Orders, MT5OrderError
from .scripts.mt5_data import MT5Data

__version__ = "1.0.0"
__all__ = ['MT5Connector', 'MT5Orders', 'MT5Data', 'MT5Error', 'MT5OrderError']
