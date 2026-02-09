"""
MT5 Connector - MetaTrader 5 Connection Management für K.I.T.

Handles:
- Terminal initialization
- Account login/logout  
- Connection status
- Account information
"""

import MetaTrader5 as mt5
from typing import Optional, Dict, Any
from dataclasses import dataclass
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MT5Connector")


class MT5Error(Exception):
    """Custom exception for MT5 errors"""
    def __init__(self, code: int, message: str):
        self.code = code
        self.message = message
        super().__init__(f"MT5 Error {code}: {message}")


@dataclass
class AccountInfo:
    """Account information structure"""
    login: int
    balance: float
    equity: float
    margin: float
    free_margin: float
    margin_level: float
    leverage: int
    currency: str
    server: str
    name: str
    company: str
    trade_allowed: bool
    trade_expert: bool


class MT5Connector:
    """
    MetaTrader 5 Connection Manager
    
    Usage:
        mt5 = MT5Connector()
        mt5.connect(account=123456, password="pass", server="Broker-Demo")
        info = mt5.get_account_info()
        mt5.disconnect()
    """
    
    def __init__(self):
        self._connected = False
        self._account = None
        
    def connect(
        self,
        account: Optional[int] = None,
        password: Optional[str] = None,
        server: Optional[str] = None,
        path: Optional[str] = None,
        timeout: int = 60000
    ) -> bool:
        """
        Connect to MetaTrader 5 terminal
        
        Args:
            account: Account number (optional if already logged in)
            password: Account password
            server: Broker server name (e.g., "ICMarketsSC-Demo")
            path: Path to MT5 terminal (optional, auto-detected)
            timeout: Connection timeout in milliseconds
            
        Returns:
            True if connected successfully
            
        Raises:
            MT5Error: If connection fails
        """
        # Initialize MT5 terminal
        init_params = {"timeout": timeout}
        if path:
            init_params["path"] = path
            
        if not mt5.initialize(**init_params):
            error = mt5.last_error()
            raise MT5Error(error[0], f"MT5 initialization failed: {error[1]}")
        
        logger.info("MT5 terminal initialized")
        
        # Login if credentials provided
        if account and password and server:
            if not mt5.login(account, password=password, server=server):
                error = mt5.last_error()
                mt5.shutdown()
                raise MT5Error(error[0], f"Login failed: {error[1]}")
            
            logger.info(f"Logged in to account {account} on {server}")
            self._account = account
        
        self._connected = True
        return True
    
    def disconnect(self) -> None:
        """Disconnect from MT5 terminal"""
        if self._connected:
            mt5.shutdown()
            self._connected = False
            self._account = None
            logger.info("Disconnected from MT5")
    
    def is_connected(self) -> bool:
        """Check if connected to MT5"""
        if not self._connected:
            return False
        
        # Verify connection is still alive
        terminal_info = mt5.terminal_info()
        return terminal_info is not None
    
    def get_account_info(self) -> Dict[str, Any]:
        """
        Get account information
        
        Returns:
            Dictionary with account details
        """
        self._ensure_connected()
        
        info = mt5.account_info()
        if info is None:
            error = mt5.last_error()
            raise MT5Error(error[0], f"Failed to get account info: {error[1]}")
        
        return {
            'login': info.login,
            'balance': info.balance,
            'equity': info.equity,
            'margin': info.margin,
            'free_margin': info.margin_free,
            'margin_level': info.margin_level if info.margin_level else 0.0,
            'leverage': info.leverage,
            'currency': info.currency,
            'server': info.server,
            'name': info.name,
            'company': info.company,
            'trade_allowed': info.trade_allowed,
            'trade_expert': info.trade_expert
        }
    
    def get_terminal_info(self) -> Dict[str, Any]:
        """
        Get MT5 terminal information
        
        Returns:
            Dictionary with terminal details
        """
        self._ensure_connected()
        
        info = mt5.terminal_info()
        if info is None:
            error = mt5.last_error()
            raise MT5Error(error[0], f"Failed to get terminal info: {error[1]}")
        
        return {
            'connected': info.connected,
            'dlls_allowed': info.dlls_allowed,
            'trade_allowed': info.trade_allowed,
            'tradeapi_disabled': info.tradeapi_disabled,
            'email_enabled': info.email_enabled,
            'ftp_enabled': info.ftp_enabled,
            'notifications_enabled': info.notifications_enabled,
            'mqid': info.mqid,
            'build': info.build,
            'maxbars': info.maxbars,
            'codepage': info.codepage,
            'ping_last': info.ping_last,
            'community_account': info.community_account,
            'community_connection': info.community_connection,
            'community_balance': info.community_balance,
            'company': info.company,
            'name': info.name,
            'language': info.language,
            'path': info.path,
            'data_path': info.data_path,
            'commondata_path': info.commondata_path
        }
    
    def is_trading_allowed(self) -> bool:
        """Check if trading is allowed"""
        self._ensure_connected()
        
        terminal = mt5.terminal_info()
        account = mt5.account_info()
        
        if terminal is None or account is None:
            return False
            
        return (
            terminal.trade_allowed and 
            not terminal.tradeapi_disabled and
            account.trade_allowed and
            account.trade_expert
        )
    
    def _ensure_connected(self) -> None:
        """Ensure connection is active, raise error if not"""
        if not self.is_connected():
            raise MT5Error(0, "Not connected to MT5. Call connect() first.")
    
    def __enter__(self):
        """Context manager entry"""
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.disconnect()
        return False


# Convenience functions for direct use
def connect(account: int = None, password: str = None, server: str = None) -> MT5Connector:
    """Quick connect function"""
    connector = MT5Connector()
    connector.connect(account=account, password=password, server=server)
    return connector


def get_last_error() -> tuple:
    """Get last MT5 error"""
    return mt5.last_error()


if __name__ == "__main__":
    # Test connection (requires MT5 terminal running)
    print("Testing MT5 Connector...")
    
    connector = MT5Connector()
    
    try:
        # Try to connect to already logged-in terminal
        connector.connect()
        
        print("\n✅ Connected to MT5!")
        
        # Get account info
        info = connector.get_account_info()
        print(f"\n📊 Account Info:")
        print(f"  Login: {info['login']}")
        print(f"  Balance: {info['balance']} {info['currency']}")
        print(f"  Equity: {info['equity']}")
        print(f"  Server: {info['server']}")
        print(f"  Trading allowed: {info['trade_allowed']}")
        
        # Get terminal info
        terminal = connector.get_terminal_info()
        print(f"\n🖥️ Terminal Info:")
        print(f"  Build: {terminal['build']}")
        print(f"  Company: {terminal['company']}")
        print(f"  Connected: {terminal['connected']}")
        
    except MT5Error as e:
        print(f"\n❌ Error: {e}")
        print("Make sure MT5 terminal is running and logged in.")
        
    finally:
        connector.disconnect()
        print("\n👋 Disconnected")
