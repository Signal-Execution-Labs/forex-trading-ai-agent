"""
K.I.T. Social Trading Skill

Copy trades from signal providers, bots, and top traders.
"""

from .social_trader import (
    SocialTrader, 
    SignalParser, 
    Signal, 
    SignalSource, 
    SignalAction,
    TrustLevel,
    RiskManager
)

__all__ = [
    'SocialTrader', 
    'SignalParser', 
    'Signal', 
    'SignalSource', 
    'SignalAction',
    'TrustLevel',
    'RiskManager'
]
