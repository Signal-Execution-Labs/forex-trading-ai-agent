"""
MT5 Data - Market Data & Symbol Information für K.I.T.

Handles:
- Real-time tick data
- Historical candlestick data (OHLCV)
- Symbol information
- Market hours
"""

import MetaTrader5 as mt5
import pandas as pd
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

logger = logging.getLogger("MT5Data")


# Timeframe mapping
TIMEFRAMES = {
    'M1': mt5.TIMEFRAME_M1,
    'M2': mt5.TIMEFRAME_M2,
    'M3': mt5.TIMEFRAME_M3,
    'M4': mt5.TIMEFRAME_M4,
    'M5': mt5.TIMEFRAME_M5,
    'M6': mt5.TIMEFRAME_M6,
    'M10': mt5.TIMEFRAME_M10,
    'M12': mt5.TIMEFRAME_M12,
    'M15': mt5.TIMEFRAME_M15,
    'M20': mt5.TIMEFRAME_M20,
    'M30': mt5.TIMEFRAME_M30,
    'H1': mt5.TIMEFRAME_H1,
    'H2': mt5.TIMEFRAME_H2,
    'H3': mt5.TIMEFRAME_H3,
    'H4': mt5.TIMEFRAME_H4,
    'H6': mt5.TIMEFRAME_H6,
    'H8': mt5.TIMEFRAME_H8,
    'H12': mt5.TIMEFRAME_H12,
    'D1': mt5.TIMEFRAME_D1,
    'W1': mt5.TIMEFRAME_W1,
    'MN1': mt5.TIMEFRAME_MN1,
}


class MT5Data:
    """
    MetaTrader 5 Market Data
    
    Usage:
        data = MT5Data()
        tick = data.get_tick("EURUSD")
        candles = data.get_candles("EURUSD", "H1", 100)
        info = data.get_symbol_info("EURUSD")
    """
    
    def get_tick(self, symbol: str) -> Dict[str, Any]:
        """
        Get current tick data (bid/ask)
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Dictionary with tick data
        """
        # Ensure symbol is selected
        if not self._select_symbol(symbol):
            raise ValueError(f"Symbol {symbol} not available")
        
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise ValueError(f"Failed to get tick for {symbol}")
        
        return {
            'symbol': symbol,
            'bid': tick.bid,
            'ask': tick.ask,
            'last': tick.last,
            'volume': tick.volume,
            'time': datetime.fromtimestamp(tick.time),
            'flags': tick.flags,
            'volume_real': tick.volume_real
        }
    
    def get_spread(self, symbol: str) -> float:
        """
        Get current spread in pips
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Spread in pips
        """
        tick = self.get_tick(symbol)
        info = self.get_symbol_info(symbol)
        
        spread_points = (tick['ask'] - tick['bid']) / info['point']
        
        # Convert to pips (assuming 5-digit broker for forex)
        if info['digits'] == 5 or info['digits'] == 3:
            return spread_points / 10
        return spread_points
    
    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        count: int = 100
    ) -> pd.DataFrame:
        """
        Get historical candlestick data
        
        Args:
            symbol: Trading symbol
            timeframe: Timeframe (M1, M5, M15, M30, H1, H4, D1, W1, MN1)
            count: Number of candles to retrieve
            
        Returns:
            DataFrame with OHLCV data
        """
        # Validate timeframe
        tf = TIMEFRAMES.get(timeframe.upper())
        if tf is None:
            raise ValueError(f"Invalid timeframe: {timeframe}. Use: {list(TIMEFRAMES.keys())}")
        
        # Ensure symbol is selected
        if not self._select_symbol(symbol):
            raise ValueError(f"Symbol {symbol} not available")
        
        # Get rates
        rates = mt5.copy_rates_from_pos(symbol, tf, 0, count)
        
        if rates is None or len(rates) == 0:
            raise ValueError(f"Failed to get candles for {symbol}")
        
        # Convert to DataFrame
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        df = df.rename(columns={
            'time': 'time',
            'open': 'open',
            'high': 'high',
            'low': 'low',
            'close': 'close',
            'tick_volume': 'volume',
            'spread': 'spread',
            'real_volume': 'real_volume'
        })
        
        return df[['time', 'open', 'high', 'low', 'close', 'volume']]
    
    def get_candles_range(
        self,
        symbol: str,
        timeframe: str,
        date_from: datetime,
        date_to: datetime
    ) -> pd.DataFrame:
        """
        Get candles for a specific date range
        
        Args:
            symbol: Trading symbol
            timeframe: Timeframe string
            date_from: Start date
            date_to: End date
            
        Returns:
            DataFrame with OHLCV data
        """
        # Validate timeframe
        tf = TIMEFRAMES.get(timeframe.upper())
        if tf is None:
            raise ValueError(f"Invalid timeframe: {timeframe}")
        
        # Ensure symbol is selected
        if not self._select_symbol(symbol):
            raise ValueError(f"Symbol {symbol} not available")
        
        # Get rates
        rates = mt5.copy_rates_range(symbol, tf, date_from, date_to)
        
        if rates is None or len(rates) == 0:
            raise ValueError(f"No candles found for {symbol} in date range")
        
        # Convert to DataFrame
        df = pd.DataFrame(rates)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        
        return df[['time', 'open', 'high', 'low', 'close', 'tick_volume']].rename(
            columns={'tick_volume': 'volume'}
        )
    
    def get_ticks(
        self,
        symbol: str,
        count: int = 1000
    ) -> pd.DataFrame:
        """
        Get historical tick data
        
        Args:
            symbol: Trading symbol
            count: Number of ticks to retrieve
            
        Returns:
            DataFrame with tick data
        """
        if not self._select_symbol(symbol):
            raise ValueError(f"Symbol {symbol} not available")
        
        ticks = mt5.copy_ticks_from(symbol, datetime.now(), count, mt5.COPY_TICKS_ALL)
        
        if ticks is None or len(ticks) == 0:
            raise ValueError(f"Failed to get ticks for {symbol}")
        
        df = pd.DataFrame(ticks)
        df['time'] = pd.to_datetime(df['time'], unit='s')
        
        return df[['time', 'bid', 'ask', 'last', 'volume']]
    
    def get_symbol_info(self, symbol: str) -> Dict[str, Any]:
        """
        Get detailed symbol information
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Dictionary with symbol details
        """
        if not self._select_symbol(symbol):
            raise ValueError(f"Symbol {symbol} not available")
        
        info = mt5.symbol_info(symbol)
        if info is None:
            raise ValueError(f"Failed to get info for {symbol}")
        
        tick = mt5.symbol_info_tick(symbol)
        
        return {
            'symbol': info.name,
            'description': info.description,
            'path': info.path,
            'bid': tick.bid if tick else 0,
            'ask': tick.ask if tick else 0,
            'spread': info.spread,
            'digits': info.digits,
            'point': info.point,
            'trade_contract_size': info.trade_contract_size,
            'volume_min': info.volume_min,
            'volume_max': info.volume_max,
            'volume_step': info.volume_step,
            'swap_long': info.swap_long,
            'swap_short': info.swap_short,
            'swap_mode': info.swap_mode,
            'margin_initial': info.margin_initial,
            'currency_base': info.currency_base,
            'currency_profit': info.currency_profit,
            'currency_margin': info.currency_margin,
            'trade_mode': info.trade_mode,
            'trade_calc_mode': info.trade_calc_mode,
            'visible': info.visible,
            'session_open': info.session_open,
            'session_close': info.session_close,
        }
    
    def get_all_symbols(self) -> List[str]:
        """
        Get all available symbols
        
        Returns:
            List of symbol names
        """
        symbols = mt5.symbols_get()
        if symbols is None:
            return []
        
        return [s.name for s in symbols]
    
    def get_symbols_by_group(self, group: str) -> List[str]:
        """
        Get symbols matching a group pattern
        
        Args:
            group: Pattern to match (e.g., "*USD*", "Forex*")
            
        Returns:
            List of matching symbol names
        """
        symbols = mt5.symbols_get(group=group)
        if symbols is None:
            return []
        
        return [s.name for s in symbols]
    
    def get_market_status(self, symbol: str) -> Dict[str, Any]:
        """
        Check if market is open for a symbol
        
        Args:
            symbol: Trading symbol
            
        Returns:
            Market status dictionary
        """
        info = mt5.symbol_info(symbol)
        if info is None:
            raise ValueError(f"Symbol {symbol} not found")
        
        # Trade modes
        trade_modes = {
            0: 'disabled',
            1: 'longonly',
            2: 'shortonly',
            3: 'closeonly',
            4: 'full'
        }
        
        return {
            'symbol': symbol,
            'trade_mode': trade_modes.get(info.trade_mode, 'unknown'),
            'visible': info.visible,
            'session_open': info.session_open,
            'session_close': info.session_close,
            'trade_allowed': info.trade_mode == 4  # SYMBOL_TRADE_MODE_FULL
        }
    
    def _select_symbol(self, symbol: str) -> bool:
        """Ensure symbol is selected in Market Watch"""
        symbol_info = mt5.symbol_info(symbol)
        
        if symbol_info is None:
            return False
        
        if not symbol_info.visible:
            if not mt5.symbol_select(symbol, True):
                return False
        
        return True


# Utility functions

def get_timeframe_minutes(timeframe: str) -> int:
    """Convert timeframe string to minutes"""
    tf_minutes = {
        'M1': 1, 'M2': 2, 'M3': 3, 'M4': 4, 'M5': 5,
        'M6': 6, 'M10': 10, 'M12': 12, 'M15': 15,
        'M20': 20, 'M30': 30, 'H1': 60, 'H2': 120,
        'H3': 180, 'H4': 240, 'H6': 360, 'H8': 480,
        'H12': 720, 'D1': 1440, 'W1': 10080, 'MN1': 43200
    }
    return tf_minutes.get(timeframe.upper(), 0)


def pips_to_points(pips: float, symbol: str) -> int:
    """Convert pips to points for a symbol"""
    info = mt5.symbol_info(symbol)
    if info is None:
        return 0
    
    # 5-digit forex or 3-digit JPY pairs
    if info.digits == 5 or info.digits == 3:
        return int(pips * 10)
    return int(pips)


def points_to_pips(points: int, symbol: str) -> float:
    """Convert points to pips for a symbol"""
    info = mt5.symbol_info(symbol)
    if info is None:
        return 0.0
    
    if info.digits == 5 or info.digits == 3:
        return points / 10
    return float(points)


if __name__ == "__main__":
    # Test data functions (requires connected MT5)
    print("Testing MT5 Data...")
    
    # Initialize MT5
    if not mt5.initialize():
        print("❌ MT5 initialization failed")
        exit()
    
    data = MT5Data()
    
    try:
        # Test symbol
        symbol = "EURUSD"
        
        # Get tick
        tick = data.get_tick(symbol)
        print(f"\n📊 {symbol} Tick:")
        print(f"  Bid: {tick['bid']}")
        print(f"  Ask: {tick['ask']}")
        print(f"  Spread: {data.get_spread(symbol):.1f} pips")
        
        # Get symbol info
        info = data.get_symbol_info(symbol)
        print(f"\n📋 {symbol} Info:")
        print(f"  Description: {info['description']}")
        print(f"  Digits: {info['digits']}")
        print(f"  Point: {info['point']}")
        print(f"  Contract Size: {info['trade_contract_size']}")
        print(f"  Min Volume: {info['volume_min']}")
        
        # Get candles
        candles = data.get_candles(symbol, "H1", 10)
        print(f"\n🕯️ Last 10 H1 Candles:")
        print(candles.to_string())
        
        # Get available symbols
        forex = data.get_symbols_by_group("*USD*")
        print(f"\n💱 USD Symbols: {len(forex)}")
        print(f"  Examples: {forex[:5]}")
        
    except Exception as e:
        print(f"❌ Error: {e}")
    
    mt5.shutdown()
    print("\n✅ Test complete")
