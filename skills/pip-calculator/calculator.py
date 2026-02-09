"""
Pip Calculator - Core Logic

Calculates pip values, profit/loss, and price conversions.
"""

from typing import Dict, Any, Optional, Tuple
from dataclasses import dataclass


# Pip sizes for different symbol types
SYMBOL_PIP_SIZES = {
    # Forex Majors (4 decimal places, 5-digit broker)
    "EURUSD": 0.0001,
    "GBPUSD": 0.0001,
    "AUDUSD": 0.0001,
    "NZDUSD": 0.0001,
    "USDCAD": 0.0001,
    "USDCHF": 0.0001,
    
    # JPY Pairs (2 decimal places, 3-digit broker)
    "USDJPY": 0.01,
    "EURJPY": 0.01,
    "GBPJPY": 0.01,
    "AUDJPY": 0.01,
    "NZDJPY": 0.01,
    "CADJPY": 0.01,
    "CHFJPY": 0.01,
    
    # Crosses
    "EURGBP": 0.0001,
    "EURAUD": 0.0001,
    "GBPAUD": 0.0001,
    "AUDNZD": 0.0001,
    "AUDCAD": 0.0001,
    
    # Gold & Silver
    "XAUUSD": 0.1,    # 1 pip = $0.10 movement
    "XAGUSD": 0.01,   # 1 pip = $0.01 movement
    
    # Indices (varies by broker)
    "US30": 1.0,
    "NAS100": 0.1,
    "SPX500": 0.1,
    "GER40": 0.1,
    "UK100": 0.1,
    
    # Crypto
    "BTCUSD": 1.0,
    "ETHUSD": 0.1,
}

# Contract sizes (units per 1 lot)
SYMBOL_CONTRACT_SIZES = {
    # Forex: 100,000 units
    "EURUSD": 100000,
    "GBPUSD": 100000,
    "AUDUSD": 100000,
    "NZDUSD": 100000,
    "USDCAD": 100000,
    "USDCHF": 100000,
    "USDJPY": 100000,
    "EURJPY": 100000,
    "GBPJPY": 100000,
    
    # Gold: 100 oz per lot
    "XAUUSD": 100,
    
    # Silver: 5000 oz per lot
    "XAGUSD": 5000,
    
    # Indices: varies
    "US30": 1,
    "NAS100": 1,
    "SPX500": 1,
    
    # Crypto: 1 unit
    "BTCUSD": 1,
    "ETHUSD": 1,
}


@dataclass
class PipResult:
    """Result of pip calculation"""
    symbol: str
    pip_size: float
    pip_value: float
    lot_size: float
    account_currency: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'symbol': self.symbol,
            'pip_size': self.pip_size,
            'pip_value': self.pip_value,
            'lot_size': self.lot_size,
            'account_currency': self.account_currency
        }


class PipCalculator:
    """
    Pip Calculator for Forex and other assets
    
    Usage:
        calc = PipCalculator()
        value = calc.get_pip_value("EURUSD", 0.1)
        profit = calc.calculate_profit("EURUSD", 50, 0.1)
    """
    
    def __init__(self, account_currency: str = "USD"):
        self.account_currency = account_currency
    
    def get_pip_size(self, symbol: str) -> float:
        """
        Get pip size for a symbol
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Pip size (e.g., 0.0001 for EURUSD)
        """
        symbol = self._normalize_symbol(symbol)
        
        if symbol in SYMBOL_PIP_SIZES:
            return SYMBOL_PIP_SIZES[symbol]
        
        # Infer from symbol
        if "JPY" in symbol:
            return 0.01
        elif "XAU" in symbol or "GOLD" in symbol:
            return 0.1
        elif "XAG" in symbol or "SILVER" in symbol:
            return 0.01
        elif "BTC" in symbol:
            return 1.0
        else:
            return 0.0001  # Default for forex
    
    def get_contract_size(self, symbol: str) -> float:
        """Get contract size for 1 lot"""
        symbol = self._normalize_symbol(symbol)
        return SYMBOL_CONTRACT_SIZES.get(symbol, 100000)
    
    def get_pip_value(
        self,
        symbol: str,
        lot_size: float = 1.0,
        current_price: Optional[float] = None
    ) -> float:
        """
        Calculate pip value in account currency
        
        Args:
            symbol: Trading symbol
            lot_size: Position size in lots
            current_price: Current price (needed for some calculations)
            
        Returns:
            Pip value in account currency
        """
        symbol = self._normalize_symbol(symbol)
        pip_size = self.get_pip_size(symbol)
        contract_size = self.get_contract_size(symbol)
        
        # Base pip value calculation
        # Pip Value = Pip Size × Contract Size × Lot Size
        
        # For pairs where quote currency is USD (EURUSD, GBPUSD, etc.)
        if symbol.endswith("USD"):
            pip_value = pip_size * contract_size * lot_size
            
        # For pairs where USD is base (USDJPY, USDCAD, etc.)
        elif symbol.startswith("USD"):
            if current_price:
                pip_value = (pip_size * contract_size * lot_size) / current_price
            else:
                # Estimate - actual value varies with rate
                pip_value = pip_size * contract_size * lot_size * 0.0067  # ~1/150 for JPY
                
        # For cross pairs (EURGBP, etc.)
        else:
            # Would need exchange rate to convert
            # Using approximate value
            pip_value = pip_size * contract_size * lot_size
        
        return round(pip_value, 4)
    
    def calculate_profit(
        self,
        symbol: str,
        pips: float,
        lot_size: float = 1.0,
        current_price: Optional[float] = None
    ) -> float:
        """
        Calculate profit/loss for given pip movement
        
        Args:
            symbol: Trading symbol
            pips: Pip movement (positive for profit, negative for loss)
            lot_size: Position size in lots
            current_price: Current price
            
        Returns:
            Profit/loss in account currency
        """
        pip_value = self.get_pip_value(symbol, lot_size, current_price)
        return round(pips * pip_value, 2)
    
    def price_to_pips(
        self,
        symbol: str,
        price1: float,
        price2: float
    ) -> float:
        """
        Convert price difference to pips
        
        Args:
            symbol: Trading symbol
            price1: First price (entry)
            price2: Second price (exit)
            
        Returns:
            Pip difference
        """
        pip_size = self.get_pip_size(symbol)
        diff = price2 - price1
        return round(diff / pip_size, 1)
    
    def pips_to_price(
        self,
        symbol: str,
        base_price: float,
        pips: float
    ) -> float:
        """
        Convert pips to price difference
        
        Args:
            symbol: Trading symbol
            base_price: Starting price
            pips: Pip movement
            
        Returns:
            Target price
        """
        pip_size = self.get_pip_size(symbol)
        price_diff = pips * pip_size
        return round(base_price + price_diff, 5)
    
    def calculate_sl_tp_prices(
        self,
        symbol: str,
        entry_price: float,
        direction: str,
        sl_pips: float,
        tp_pips: float
    ) -> Dict[str, float]:
        """
        Calculate SL and TP prices from pip distances
        
        Args:
            symbol: Trading symbol
            entry_price: Entry price
            direction: "buy" or "sell"
            sl_pips: Stop loss in pips
            tp_pips: Take profit in pips
            
        Returns:
            Dictionary with sl and tp prices
        """
        pip_size = self.get_pip_size(symbol)
        
        if direction.lower() == "buy":
            sl = entry_price - (sl_pips * pip_size)
            tp = entry_price + (tp_pips * pip_size)
        else:
            sl = entry_price + (sl_pips * pip_size)
            tp = entry_price - (tp_pips * pip_size)
        
        # Determine decimal places
        decimals = 5 if pip_size == 0.0001 else 3 if pip_size == 0.01 else 2
        
        return {
            'entry': round(entry_price, decimals),
            'stop_loss': round(sl, decimals),
            'take_profit': round(tp, decimals),
            'sl_pips': sl_pips,
            'tp_pips': tp_pips,
            'risk_reward': round(tp_pips / sl_pips, 2) if sl_pips > 0 else 0
        }
    
    def _normalize_symbol(self, symbol: str) -> str:
        """Normalize symbol name"""
        return symbol.upper().replace("/", "").replace("_", "").replace(".", "")


# Convenience functions
def calculate_pip_value(
    symbol: str,
    lot_size: float = 1.0,
    account_currency: str = "USD",
    current_price: Optional[float] = None
) -> float:
    """Quick pip value calculation"""
    calc = PipCalculator(account_currency)
    return calc.get_pip_value(symbol, lot_size, current_price)


def calculate_profit(
    symbol: str,
    pips: float,
    lot_size: float = 1.0,
    account_currency: str = "USD"
) -> float:
    """Quick profit calculation"""
    calc = PipCalculator(account_currency)
    return calc.calculate_profit(symbol, pips, lot_size)


def price_to_pips(
    symbol: str,
    price1: float,
    price2: float
) -> float:
    """Quick price to pips conversion"""
    calc = PipCalculator()
    return calc.price_to_pips(symbol, price1, price2)


def pips_to_price(
    symbol: str,
    base_price: float,
    pips: float
) -> float:
    """Quick pips to price conversion"""
    calc = PipCalculator()
    return calc.pips_to_price(symbol, base_price, pips)


def get_pip_size(symbol: str) -> float:
    """Get pip size for a symbol"""
    calc = PipCalculator()
    return calc.get_pip_size(symbol)


# CLI for testing
if __name__ == "__main__":
    calc = PipCalculator()
    
    print("=" * 50)
    print("  K.I.T. Pip Calculator")
    print("=" * 50)
    
    # Test pip values
    symbols = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"]
    lot_sizes = [1.0, 0.1, 0.01]
    
    print("\n📊 Pip Values per Lot Size:")
    print("-" * 50)
    
    for symbol in symbols:
        print(f"\n  {symbol}:")
        pip_size = calc.get_pip_size(symbol)
        print(f"    Pip Size: {pip_size}")
        for lot in lot_sizes:
            value = calc.get_pip_value(symbol, lot)
            print(f"    {lot} Lot: ${value:.2f}/pip")
    
    # Test profit calculation
    print("\n💰 Profit Examples:")
    print("-" * 50)
    
    profit = calc.calculate_profit("EURUSD", 50, 0.1)
    print(f"  EURUSD, 50 pips, 0.1 lot: ${profit:.2f}")
    
    profit = calc.calculate_profit("GBPJPY", 100, 0.05)
    print(f"  GBPJPY, 100 pips, 0.05 lot: ${profit:.2f}")
    
    # Test price to pips
    print("\n📏 Price to Pips:")
    print("-" * 50)
    
    pips = calc.price_to_pips("EURUSD", 1.0850, 1.0920)
    print(f"  EURUSD: 1.0850 → 1.0920 = {pips} pips")
    
    pips = calc.price_to_pips("USDJPY", 149.500, 150.000)
    print(f"  USDJPY: 149.500 → 150.000 = {pips} pips")
    
    # Test SL/TP calculation
    print("\n🎯 SL/TP Calculation:")
    print("-" * 50)
    
    result = calc.calculate_sl_tp_prices("EURUSD", 1.0900, "buy", 30, 60)
    print(f"  EURUSD BUY @ {result['entry']}")
    print(f"    SL: {result['stop_loss']} (-{result['sl_pips']} pips)")
    print(f"    TP: {result['take_profit']} (+{result['tp_pips']} pips)")
    print(f"    Risk/Reward: 1:{result['risk_reward']}")
    
    print("\n" + "=" * 50)
