"""
MetaTrader 5 Scripts - Enterprise Trading Toolkit für K.I.T.

🔥 WELTKLASSE FEATURES:
- Core Trading (Connector, Orders, Data)
- Multi-Account Management
- Strategy Backtesting & Optimization
- Signal Provider Service
- Expert Advisor Bridge
- VPS Deployment Infrastructure
"""

# Core
from .mt5_connector import MT5Connector, MT5Error
from .mt5_orders import MT5Orders, MT5OrderError
from .mt5_data import MT5Data, TIMEFRAMES

# Enterprise Features
from .mt5_multi_account import (
    MT5MultiAccountManager,
    AccountConfig,
    AccountState
)

from .mt5_strategy_tester import (
    MT5StrategyTester,
    Strategy,
    MovingAverageCrossStrategy,
    BacktestResult,
    Trade,
    TradeDirection
)

from .mt5_signal_provider import (
    MT5SignalProvider,
    Signal,
    SignalType,
    Subscriber
)

from .mt5_expert_advisor import (
    MT5EABridge,
    EACommand,
    EASignal,
    EATemplateGenerator
)

from .mt5_vps_deployment import (
    MT5VPSDeployment,
    VPSConfig,
    HealthCheck,
    ServiceStatus
)

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

__version__ = "2.0.0"
