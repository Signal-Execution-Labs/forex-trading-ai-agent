"""
🐋 K.I.T. Whale Tracker
Track large wallet movements and smart money flows.
"""

from .whale_tracker import (
    WhaleTracker,
    WhaleMovement,
    WalletInfo,
    ExchangeFlow,
    SmartMoneySignal,
    MovementType,
    Signal,
    KnownWallets
)

__all__ = [
    "WhaleTracker",
    "WhaleMovement",
    "WalletInfo", 
    "ExchangeFlow",
    "SmartMoneySignal",
    "MovementType",
    "Signal",
    "KnownWallets"
]
