"""
MetaTrader 4/5 Skill für K.I.T. 🚀

DER BESTE TRADING AGENT DER WELT

Enterprise Features:
- Core Trading (Connector, Orders, Data)
- Multi-Account Management
- Strategy Backtesting & Optimization
- Signal Provider Service
- Expert Advisor Bridge  
- VPS Deployment Infrastructure

Usage:
    from skills.metatrader import MT5Connector, MT5Orders, MT5Data
    
    mt5 = MT5Connector()
    mt5.connect(account=123456, password="pass", server="Broker-Demo")
    
    orders = MT5Orders()
    orders.market_order("EURUSD", "buy", 0.1)
"""

from .scripts import (
    # Core
    MT5Connector, MT5Error,
    MT5Orders, MT5OrderError,
    MT5Data, TIMEFRAMES,
    
    # Multi-Account
    MT5MultiAccountManager, AccountConfig, AccountState,
    
    # Strategy Tester
    MT5StrategyTester, Strategy, MovingAverageCrossStrategy,
    BacktestResult, Trade, TradeDirection,
    
    # Signal Provider
    MT5SignalProvider, Signal, SignalType, Subscriber,
    
    # Expert Advisor
    MT5EABridge, EACommand, EASignal, EATemplateGenerator,
    
    # VPS Deployment
    MT5VPSDeployment, VPSConfig, HealthCheck, ServiceStatus
)

__version__ = "2.0.0"
__all__ = [
    # Core
    'MT5Connector', 'MT5Error',
    'MT5Orders', 'MT5OrderError', 
    'MT5Data', 'TIMEFRAMES',
    
    # Multi-Account
    'MT5MultiAccountManager', 'AccountConfig', 'AccountState',
    
    # Strategy Tester
    'MT5StrategyTester', 'Strategy', 'MovingAverageCrossStrategy',
    'BacktestResult', 'Trade', 'TradeDirection',
    
    # Signal Provider
    'MT5SignalProvider', 'Signal', 'SignalType', 'Subscriber',
    
    # Expert Advisor
    'MT5EABridge', 'EACommand', 'EASignal', 'EATemplateGenerator',
    
    # VPS Deployment
    'MT5VPSDeployment', 'VPSConfig', 'HealthCheck', 'ServiceStatus'
]
