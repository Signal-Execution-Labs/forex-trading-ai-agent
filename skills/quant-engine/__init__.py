"""
📈 K.I.T. Quant Engine
Wall Street Quantitative Trading Algorithms
"""

from .engine import (
    QuantEngine,
    StatisticalArbitrage,
    MomentumStrategy,
    MeanReversionStrategy,
    Backtester,
    CointegrationResult,
    TradingSignal,
    SignalDirection,
    StrategyType,
    MomentumScore,
    BacktestResult
)

__all__ = [
    'QuantEngine',
    'StatisticalArbitrage',
    'MomentumStrategy',
    'MeanReversionStrategy',
    'Backtester',
    'CointegrationResult',
    'TradingSignal',
    'SignalDirection',
    'StrategyType',
    'MomentumScore',
    'BacktestResult'
]
