"""
Lot Size Calculator - Core Logic

Berechnet risiko-basierte Positionsgrößen für Forex, Gold, Indices und Crypto.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum


class SymbolType(Enum):
    """Asset type classification"""
    FOREX_MAJOR = "forex_major"      # EURUSD, GBPUSD, etc.
    FOREX_JPY = "forex_jpy"          # USDJPY, EURJPY, etc.
    FOREX_CROSS = "forex_cross"      # EURGBP, AUDNZD, etc.
    GOLD = "gold"                    # XAUUSD
    SILVER = "silver"               # XAGUSD
    INDEX = "index"                 # US30, NAS100, etc.
    CRYPTO = "crypto"               # BTCUSD, ETHUSD, etc.
    OIL = "oil"                     # USOIL, UKOIL


# Standard pip values per standard lot (100,000 units) for USD accounts
PIP_VALUES = {
    # Forex Majors (pip = 0.0001)
    "EURUSD": 10.0,
    "GBPUSD": 10.0,
    "AUDUSD": 10.0,
    "NZDUSD": 10.0,
    "USDCAD": 10.0,  # Approx, varies with CAD rate
    "USDCHF": 10.0,  # Approx, varies with CHF rate
    
    # JPY Pairs (pip = 0.01)
    "USDJPY": 9.09,  # Varies with JPY rate (1000/USDJPY rate × 100)
    "EURJPY": 9.09,
    "GBPJPY": 9.09,
    "AUDJPY": 9.09,
    
    # Crosses
    "EURGBP": 12.50,  # Approx, varies with GBP rate
    "EURAUD": 7.50,   # Approx, varies with AUD rate
    
    # Gold (pip = 0.01, 1 lot = 100 oz)
    "XAUUSD": 1.0,  # $1 per pip per 0.01 lot
    
    # Silver
    "XAGUSD": 5.0,  # $5 per pip per 0.01 lot
    
    # US Indices (varies by broker)
    "US30": 1.0,
    "NAS100": 1.0,
    "SPX500": 1.0,
    
    # Crypto (1 pip = $1 usually)
    "BTCUSD": 1.0,
    "ETHUSD": 1.0,
}


# Symbol type mapping
SYMBOL_TYPES = {
    "EURUSD": SymbolType.FOREX_MAJOR,
    "GBPUSD": SymbolType.FOREX_MAJOR,
    "AUDUSD": SymbolType.FOREX_MAJOR,
    "NZDUSD": SymbolType.FOREX_MAJOR,
    "USDCAD": SymbolType.FOREX_MAJOR,
    "USDCHF": SymbolType.FOREX_MAJOR,
    "USDJPY": SymbolType.FOREX_JPY,
    "EURJPY": SymbolType.FOREX_JPY,
    "GBPJPY": SymbolType.FOREX_JPY,
    "AUDJPY": SymbolType.FOREX_JPY,
    "EURGBP": SymbolType.FOREX_CROSS,
    "EURAUD": SymbolType.FOREX_CROSS,
    "XAUUSD": SymbolType.GOLD,
    "XAGUSD": SymbolType.SILVER,
    "US30": SymbolType.INDEX,
    "NAS100": SymbolType.INDEX,
    "SPX500": SymbolType.INDEX,
    "BTCUSD": SymbolType.CRYPTO,
    "ETHUSD": SymbolType.CRYPTO,
}


@dataclass
class LotSizeResult:
    """Result of lot size calculation"""
    lot_size: float
    risk_amount: float
    pip_value: float
    symbol: str
    stop_loss_pips: float
    balance: float
    risk_percent: float
    warning: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'lot_size': self.lot_size,
            'risk_amount': self.risk_amount,
            'pip_value': self.pip_value,
            'symbol': self.symbol,
            'stop_loss_pips': self.stop_loss_pips,
            'balance': self.balance,
            'risk_percent': self.risk_percent,
            'warning': self.warning
        }


class LotSizeCalculator:
    """
    Risk-based lot size calculator
    
    Usage:
        calc = LotSizeCalculator()
        result = calc.calculate(
            balance=10000,
            risk_percent=2.0,
            stop_loss_pips=30,
            symbol="EURUSD"
        )
    """
    
    def __init__(
        self,
        min_lot: float = 0.01,
        max_lot: float = 100.0,
        lot_step: float = 0.01,
        max_risk_percent: float = 10.0
    ):
        self.min_lot = min_lot
        self.max_lot = max_lot
        self.lot_step = lot_step
        self.max_risk_percent = max_risk_percent
    
    def calculate(
        self,
        balance: float,
        risk_percent: float,
        stop_loss_pips: float,
        symbol: str,
        account_currency: str = "USD",
        custom_pip_value: Optional[float] = None
    ) -> LotSizeResult:
        """
        Calculate optimal lot size based on risk parameters
        
        Args:
            balance: Account balance
            risk_percent: Risk percentage (e.g., 2.0 for 2%)
            stop_loss_pips: Stop loss in pips
            symbol: Trading symbol
            account_currency: Account base currency
            custom_pip_value: Override pip value if known
            
        Returns:
            LotSizeResult with calculated lot size and details
        """
        # Validate inputs
        if balance <= 0:
            raise ValueError("Balance must be positive")
        if risk_percent <= 0:
            raise ValueError("Risk percent must be positive")
        if stop_loss_pips <= 0:
            raise ValueError("Stop loss pips must be positive")
        
        # Warning for high risk
        warning = None
        if risk_percent > 5.0:
            warning = f"⚠️ High risk! {risk_percent}% is above recommended 2-5%"
        if risk_percent > self.max_risk_percent:
            warning = f"🚨 Extreme risk! Capped at {self.max_risk_percent}%"
            risk_percent = self.max_risk_percent
        
        # Calculate risk amount in account currency
        risk_amount = balance * (risk_percent / 100)
        
        # Get pip value (per standard lot)
        pip_value = custom_pip_value or self._get_pip_value(
            symbol.upper(), 
            account_currency
        )
        
        # Calculate lot size
        # Formula: Lot Size = Risk Amount / (SL Pips × Pip Value per Lot)
        if stop_loss_pips * pip_value == 0:
            lot_size = 0
        else:
            lot_size = risk_amount / (stop_loss_pips * pip_value)
        
        # Round to lot step
        lot_size = self._round_to_step(lot_size)
        
        # Apply limits
        lot_size = max(self.min_lot, min(self.max_lot, lot_size))
        
        # Recalculate actual risk with rounded lot size
        actual_risk = lot_size * stop_loss_pips * pip_value
        
        return LotSizeResult(
            lot_size=lot_size,
            risk_amount=actual_risk,
            pip_value=pip_value,
            symbol=symbol.upper(),
            stop_loss_pips=stop_loss_pips,
            balance=balance,
            risk_percent=risk_percent,
            warning=warning
        )
    
    def calculate_risk(
        self,
        balance: float,
        lot_size: float,
        stop_loss_pips: float,
        symbol: str
    ) -> Dict[str, float]:
        """
        Calculate risk percentage for a given lot size
        
        Args:
            balance: Account balance
            lot_size: Position size in lots
            stop_loss_pips: Stop loss in pips
            symbol: Trading symbol
            
        Returns:
            Dictionary with risk amount and percentage
        """
        pip_value = self._get_pip_value(symbol.upper(), "USD")
        risk_amount = lot_size * stop_loss_pips * pip_value
        risk_percent = (risk_amount / balance) * 100
        
        return {
            'risk_amount': risk_amount,
            'risk_percent': risk_percent,
            'lot_size': lot_size,
            'stop_loss_pips': stop_loss_pips
        }
    
    def _get_pip_value(self, symbol: str, account_currency: str) -> float:
        """Get pip value for symbol (per standard lot)"""
        # Try exact match
        if symbol in PIP_VALUES:
            return PIP_VALUES[symbol]
        
        # Try with common variations
        symbol_clean = symbol.replace(".", "").replace("/", "").replace("_", "")
        if symbol_clean in PIP_VALUES:
            return PIP_VALUES[symbol_clean]
        
        # Default values based on symbol type
        if "JPY" in symbol:
            return 9.09  # JPY pairs
        elif "XAU" in symbol or "GOLD" in symbol:
            return 1.0   # Gold
        elif "BTC" in symbol or "ETH" in symbol:
            return 1.0   # Crypto
        else:
            return 10.0  # Default forex
    
    def _round_to_step(self, value: float) -> float:
        """Round to lot step"""
        return round(value / self.lot_step) * self.lot_step


# Convenience function
def calculate_lot_size(
    balance: float,
    risk_percent: float,
    stop_loss_pips: float,
    symbol: str = "EURUSD",
    account_currency: str = "USD",
    min_lot: float = 0.01,
    max_lot: float = 100.0
) -> Dict[str, Any]:
    """
    Quick lot size calculation
    
    Args:
        balance: Account balance
        risk_percent: Risk percentage (e.g., 2.0 for 2%)
        stop_loss_pips: Stop loss in pips
        symbol: Trading symbol
        account_currency: Account currency
        min_lot: Minimum lot size
        max_lot: Maximum lot size
        
    Returns:
        Dictionary with lot_size, risk_amount, pip_value, etc.
    """
    calculator = LotSizeCalculator(min_lot=min_lot, max_lot=max_lot)
    result = calculator.calculate(
        balance=balance,
        risk_percent=risk_percent,
        stop_loss_pips=stop_loss_pips,
        symbol=symbol,
        account_currency=account_currency
    )
    return result.to_dict()


def get_pip_value(symbol: str, account_currency: str = "USD") -> float:
    """Get pip value for a symbol"""
    calculator = LotSizeCalculator()
    return calculator._get_pip_value(symbol.upper(), account_currency)


# CLI for testing
if __name__ == "__main__":
    import sys
    
    print("=" * 50)
    print("  K.I.T. Lot Size Calculator")
    print("=" * 50)
    
    # Default values
    balance = 10000
    risk = 2.0
    sl_pips = 30
    symbol = "EURUSD"
    
    # Parse simple args
    if len(sys.argv) > 1:
        balance = float(sys.argv[1])
    if len(sys.argv) > 2:
        risk = float(sys.argv[2])
    if len(sys.argv) > 3:
        sl_pips = float(sys.argv[3])
    if len(sys.argv) > 4:
        symbol = sys.argv[4]
    
    # Calculate
    result = calculate_lot_size(
        balance=balance,
        risk_percent=risk,
        stop_loss_pips=sl_pips,
        symbol=symbol
    )
    
    print(f"\n📊 Calculation:")
    print(f"   Balance:      ${balance:,.2f}")
    print(f"   Risk:         {risk}%")
    print(f"   Stop Loss:    {sl_pips} pips")
    print(f"   Symbol:       {symbol}")
    
    print(f"\n🎯 Result:")
    print(f"   Lot Size:     {result['lot_size']:.2f}")
    print(f"   Risk Amount:  ${result['risk_amount']:.2f}")
    print(f"   Pip Value:    ${result['pip_value']:.2f}/pip/lot")
    
    if result['warning']:
        print(f"\n{result['warning']}")
    
    print("\n" + "=" * 50)
