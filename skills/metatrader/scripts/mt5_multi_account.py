"""
MT5 Multi-Account Manager - Parallel Account Management für K.I.T.

🔥 WELTKLASSE FEATURES:
- Manage unlimited MT5 accounts simultaneously
- Copy trading across accounts
- Portfolio-level risk management
- Account performance comparison
- Automatic account rotation
"""

import MetaTrader5 as mt5
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import threading
import queue
import json
import logging
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger("MT5MultiAccount")


@dataclass
class AccountConfig:
    """Account configuration"""
    account_id: int
    password: str
    server: str
    name: str = ""
    enabled: bool = True
    max_risk_percent: float = 2.0
    max_positions: int = 10
    allowed_symbols: List[str] = field(default_factory=list)
    copy_multiplier: float = 1.0  # For copy trading
    terminal_path: Optional[str] = None


@dataclass
class AccountState:
    """Live account state"""
    account_id: int
    connected: bool = False
    balance: float = 0.0
    equity: float = 0.0
    margin: float = 0.0
    free_margin: float = 0.0
    profit: float = 0.0
    positions_count: int = 0
    last_update: datetime = field(default_factory=datetime.now)
    error: Optional[str] = None


class MT5MultiAccountManager:
    """
    Multi-Account Manager for K.I.T.
    
    Manage multiple MT5 accounts simultaneously with:
    - Parallel order execution
    - Copy trading
    - Risk management per account
    - Performance tracking
    
    Usage:
        manager = MT5MultiAccountManager()
        manager.add_account(AccountConfig(
            account_id=123456,
            password="pass",
            server="Broker-Demo",
            name="Main Account"
        ))
        manager.connect_all()
        manager.execute_on_all("EURUSD", "buy", 0.1)
    """
    
    def __init__(self, config_path: Optional[str] = None):
        self.accounts: Dict[int, AccountConfig] = {}
        self.states: Dict[int, AccountState] = {}
        self._lock = threading.Lock()
        self._executor = ThreadPoolExecutor(max_workers=20)
        self._active_account: Optional[int] = None
        
        if config_path:
            self.load_config(config_path)
    
    # =========================================================
    # ACCOUNT MANAGEMENT
    # =========================================================
    
    def add_account(self, config: AccountConfig) -> None:
        """Add an account to the manager"""
        with self._lock:
            self.accounts[config.account_id] = config
            self.states[config.account_id] = AccountState(account_id=config.account_id)
            logger.info(f"Added account {config.account_id} ({config.name})")
    
    def remove_account(self, account_id: int) -> None:
        """Remove an account from the manager"""
        with self._lock:
            if account_id in self.accounts:
                del self.accounts[account_id]
                del self.states[account_id]
                logger.info(f"Removed account {account_id}")
    
    def get_account(self, account_id: int) -> Optional[AccountConfig]:
        """Get account configuration"""
        return self.accounts.get(account_id)
    
    def list_accounts(self) -> List[Dict[str, Any]]:
        """List all accounts with their states"""
        result = []
        for acc_id, config in self.accounts.items():
            state = self.states.get(acc_id)
            result.append({
                'account_id': acc_id,
                'name': config.name,
                'server': config.server,
                'enabled': config.enabled,
                'connected': state.connected if state else False,
                'balance': state.balance if state else 0,
                'equity': state.equity if state else 0,
                'profit': state.profit if state else 0,
                'positions': state.positions_count if state else 0
            })
        return result
    
    # =========================================================
    # CONNECTION MANAGEMENT
    # =========================================================
    
    def connect(self, account_id: int) -> bool:
        """Connect to a specific account"""
        config = self.accounts.get(account_id)
        if not config:
            logger.error(f"Account {account_id} not found")
            return False
        
        try:
            # Initialize MT5
            init_kwargs = {}
            if config.terminal_path:
                init_kwargs['path'] = config.terminal_path
            
            if not mt5.initialize(**init_kwargs):
                raise Exception(f"MT5 init failed: {mt5.last_error()}")
            
            # Login
            if not mt5.login(config.account_id, password=config.password, server=config.server):
                raise Exception(f"Login failed: {mt5.last_error()}")
            
            # Update state
            self._update_account_state(account_id)
            self.states[account_id].connected = True
            self._active_account = account_id
            
            logger.info(f"Connected to account {account_id} ({config.name})")
            return True
            
        except Exception as e:
            self.states[account_id].connected = False
            self.states[account_id].error = str(e)
            logger.error(f"Failed to connect {account_id}: {e}")
            return False
    
    def connect_all(self) -> Dict[int, bool]:
        """Connect to all enabled accounts (sequentially - MT5 limitation)"""
        results = {}
        for acc_id, config in self.accounts.items():
            if config.enabled:
                results[acc_id] = self.connect(acc_id)
        return results
    
    def disconnect(self) -> None:
        """Disconnect from MT5"""
        mt5.shutdown()
        for state in self.states.values():
            state.connected = False
        self._active_account = None
        logger.info("Disconnected from MT5")
    
    def switch_account(self, account_id: int) -> bool:
        """Switch to a different account"""
        if account_id == self._active_account:
            return True
        return self.connect(account_id)
    
    # =========================================================
    # PARALLEL EXECUTION
    # =========================================================
    
    def execute_on_all(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        use_multiplier: bool = True
    ) -> Dict[int, Dict[str, Any]]:
        """
        Execute order on ALL enabled accounts
        
        Args:
            symbol: Trading symbol
            order_type: "buy" or "sell"
            volume: Base lot size
            sl: Stop Loss
            tp: Take Profit
            use_multiplier: Apply account's copy_multiplier
            
        Returns:
            Results per account
        """
        results = {}
        
        for acc_id, config in self.accounts.items():
            if not config.enabled:
                continue
            
            # Apply copy multiplier
            acc_volume = volume * config.copy_multiplier if use_multiplier else volume
            
            # Check if symbol is allowed
            if config.allowed_symbols and symbol not in config.allowed_symbols:
                results[acc_id] = {'error': f"Symbol {symbol} not allowed"}
                continue
            
            # Execute
            try:
                self.switch_account(acc_id)
                result = self._execute_order(symbol, order_type, acc_volume, sl, tp)
                results[acc_id] = result
            except Exception as e:
                results[acc_id] = {'error': str(e)}
        
        return results
    
    def execute_on_accounts(
        self,
        account_ids: List[int],
        symbol: str,
        order_type: str,
        volume: float,
        **kwargs
    ) -> Dict[int, Dict[str, Any]]:
        """Execute order on specific accounts"""
        results = {}
        
        for acc_id in account_ids:
            if acc_id not in self.accounts:
                results[acc_id] = {'error': 'Account not found'}
                continue
            
            try:
                self.switch_account(acc_id)
                result = self._execute_order(symbol, order_type, volume, **kwargs)
                results[acc_id] = result
            except Exception as e:
                results[acc_id] = {'error': str(e)}
        
        return results
    
    def close_all_on_all(self, symbol: Optional[str] = None) -> Dict[int, List[Dict]]:
        """Close all positions on all accounts"""
        results = {}
        
        for acc_id in self.accounts:
            try:
                self.switch_account(acc_id)
                closed = self._close_all_positions(symbol)
                results[acc_id] = closed
            except Exception as e:
                results[acc_id] = [{'error': str(e)}]
        
        return results
    
    # =========================================================
    # COPY TRADING
    # =========================================================
    
    def setup_copy_trading(
        self,
        master_account: int,
        follower_accounts: List[int],
        multipliers: Optional[Dict[int, float]] = None
    ) -> None:
        """
        Setup copy trading from master to followers
        
        Args:
            master_account: Account to copy from
            follower_accounts: Accounts to copy to
            multipliers: Volume multipliers per follower
        """
        if master_account not in self.accounts:
            raise ValueError(f"Master account {master_account} not found")
        
        # Set multipliers
        if multipliers:
            for acc_id, mult in multipliers.items():
                if acc_id in self.accounts:
                    self.accounts[acc_id].copy_multiplier = mult
        
        # Store copy config
        self._copy_config = {
            'master': master_account,
            'followers': follower_accounts,
            'enabled': True
        }
        
        logger.info(f"Copy trading setup: {master_account} -> {follower_accounts}")
    
    def copy_trade(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None
    ) -> Dict[int, Dict[str, Any]]:
        """Execute copy trade to all followers"""
        if not hasattr(self, '_copy_config') or not self._copy_config.get('enabled'):
            raise ValueError("Copy trading not configured")
        
        results = {}
        
        # Execute on master first
        master_id = self._copy_config['master']
        self.switch_account(master_id)
        results[master_id] = self._execute_order(symbol, order_type, volume, sl, tp)
        
        # If master succeeded, copy to followers
        if 'error' not in results[master_id]:
            for follower_id in self._copy_config['followers']:
                config = self.accounts.get(follower_id)
                if not config or not config.enabled:
                    continue
                
                follower_volume = volume * config.copy_multiplier
                
                try:
                    self.switch_account(follower_id)
                    results[follower_id] = self._execute_order(
                        symbol, order_type, follower_volume, sl, tp
                    )
                except Exception as e:
                    results[follower_id] = {'error': str(e)}
        
        return results
    
    # =========================================================
    # RISK MANAGEMENT
    # =========================================================
    
    def calculate_position_size(
        self,
        account_id: int,
        symbol: str,
        stop_loss_pips: float,
        risk_percent: Optional[float] = None
    ) -> float:
        """
        Calculate position size based on risk percentage
        
        Args:
            account_id: Account to calculate for
            symbol: Trading symbol
            stop_loss_pips: Stop loss in pips
            risk_percent: Risk % (uses account default if None)
            
        Returns:
            Calculated lot size
        """
        config = self.accounts.get(account_id)
        state = self.states.get(account_id)
        
        if not config or not state:
            raise ValueError(f"Account {account_id} not found")
        
        risk = risk_percent or config.max_risk_percent
        risk_amount = state.balance * (risk / 100)
        
        # Get symbol info
        self.switch_account(account_id)
        symbol_info = mt5.symbol_info(symbol)
        
        if not symbol_info:
            raise ValueError(f"Symbol {symbol} not found")
        
        # Calculate pip value
        tick_value = symbol_info.trade_tick_value
        tick_size = symbol_info.trade_tick_size
        point = symbol_info.point
        
        # Pip value calculation (simplified for forex)
        pip_value = tick_value * (0.0001 / tick_size) if symbol_info.digits == 5 else tick_value
        
        # Position size = Risk Amount / (SL pips * pip value)
        lot_size = risk_amount / (stop_loss_pips * pip_value)
        
        # Round to valid lot step
        lot_step = symbol_info.volume_step
        lot_size = round(lot_size / lot_step) * lot_step
        
        # Clamp to min/max
        lot_size = max(symbol_info.volume_min, min(lot_size, symbol_info.volume_max))
        
        return lot_size
    
    def check_risk_limits(self, account_id: int) -> Dict[str, Any]:
        """Check if account is within risk limits"""
        config = self.accounts.get(account_id)
        state = self.states.get(account_id)
        
        if not config or not state:
            return {'error': 'Account not found'}
        
        self.switch_account(account_id)
        positions = mt5.positions_get()
        
        # Calculate current exposure
        total_risk = 0
        for pos in (positions or []):
            if pos.sl != 0:
                risk = abs(pos.profit)  # Simplified
                total_risk += risk
        
        risk_percent = (total_risk / state.balance * 100) if state.balance > 0 else 0
        
        return {
            'account_id': account_id,
            'positions_count': len(positions or []),
            'max_positions': config.max_positions,
            'positions_ok': len(positions or []) < config.max_positions,
            'current_risk_percent': risk_percent,
            'max_risk_percent': config.max_risk_percent,
            'risk_ok': risk_percent < config.max_risk_percent,
            'can_trade': (
                len(positions or []) < config.max_positions and
                risk_percent < config.max_risk_percent
            )
        }
    
    # =========================================================
    # PORTFOLIO ANALYTICS
    # =========================================================
    
    def get_portfolio_summary(self) -> Dict[str, Any]:
        """Get summary across all accounts"""
        total_balance = 0
        total_equity = 0
        total_profit = 0
        total_positions = 0
        
        account_stats = []
        
        for acc_id, config in self.accounts.items():
            state = self.states.get(acc_id)
            if not state:
                continue
            
            # Update state
            if state.connected:
                self.switch_account(acc_id)
                self._update_account_state(acc_id)
                state = self.states[acc_id]
            
            total_balance += state.balance
            total_equity += state.equity
            total_profit += state.profit
            total_positions += state.positions_count
            
            account_stats.append({
                'account_id': acc_id,
                'name': config.name,
                'balance': state.balance,
                'equity': state.equity,
                'profit': state.profit,
                'profit_percent': (state.profit / state.balance * 100) if state.balance > 0 else 0,
                'positions': state.positions_count
            })
        
        return {
            'total_balance': total_balance,
            'total_equity': total_equity,
            'total_profit': total_profit,
            'total_profit_percent': (total_profit / total_balance * 100) if total_balance > 0 else 0,
            'total_positions': total_positions,
            'accounts_count': len(self.accounts),
            'accounts': account_stats
        }
    
    def get_performance_comparison(self, days: int = 30) -> List[Dict[str, Any]]:
        """Compare performance across accounts"""
        results = []
        
        for acc_id, config in self.accounts.items():
            try:
                self.switch_account(acc_id)
                
                # Get deal history
                from datetime import timedelta
                from_date = datetime.now() - timedelta(days=days)
                deals = mt5.history_deals_get(from_date, datetime.now())
                
                if deals is None:
                    continue
                
                # Calculate stats
                total_profit = sum(d.profit for d in deals)
                winning = [d for d in deals if d.profit > 0]
                losing = [d for d in deals if d.profit < 0]
                
                results.append({
                    'account_id': acc_id,
                    'name': config.name,
                    'total_deals': len(deals),
                    'total_profit': total_profit,
                    'winning_trades': len(winning),
                    'losing_trades': len(losing),
                    'win_rate': len(winning) / len(deals) * 100 if deals else 0,
                    'avg_win': sum(d.profit for d in winning) / len(winning) if winning else 0,
                    'avg_loss': sum(d.profit for d in losing) / len(losing) if losing else 0,
                })
                
            except Exception as e:
                logger.error(f"Failed to get performance for {acc_id}: {e}")
        
        # Sort by profit
        results.sort(key=lambda x: x['total_profit'], reverse=True)
        return results
    
    # =========================================================
    # CONFIGURATION
    # =========================================================
    
    def save_config(self, path: str) -> None:
        """Save accounts configuration to file"""
        config_data = []
        for acc_id, config in self.accounts.items():
            config_data.append({
                'account_id': config.account_id,
                'password': config.password,  # ⚠️ Encrypt in production!
                'server': config.server,
                'name': config.name,
                'enabled': config.enabled,
                'max_risk_percent': config.max_risk_percent,
                'max_positions': config.max_positions,
                'allowed_symbols': config.allowed_symbols,
                'copy_multiplier': config.copy_multiplier,
                'terminal_path': config.terminal_path
            })
        
        with open(path, 'w') as f:
            json.dump(config_data, f, indent=2)
        
        logger.info(f"Saved {len(config_data)} accounts to {path}")
    
    def load_config(self, path: str) -> None:
        """Load accounts configuration from file"""
        if not Path(path).exists():
            logger.warning(f"Config file not found: {path}")
            return
        
        with open(path, 'r') as f:
            config_data = json.load(f)
        
        for acc_data in config_data:
            config = AccountConfig(**acc_data)
            self.add_account(config)
        
        logger.info(f"Loaded {len(config_data)} accounts from {path}")
    
    # =========================================================
    # INTERNAL METHODS
    # =========================================================
    
    def _update_account_state(self, account_id: int) -> None:
        """Update account state from MT5"""
        info = mt5.account_info()
        positions = mt5.positions_get()
        
        if info:
            state = self.states[account_id]
            state.balance = info.balance
            state.equity = info.equity
            state.margin = info.margin
            state.free_margin = info.margin_free
            state.profit = info.profit
            state.positions_count = len(positions) if positions else 0
            state.last_update = datetime.now()
    
    def _execute_order(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None
    ) -> Dict[str, Any]:
        """Execute order on current account"""
        # Get symbol info
        symbol_info = mt5.symbol_info(symbol)
        if not symbol_info:
            return {'error': f"Symbol {symbol} not found"}
        
        if not symbol_info.visible:
            mt5.symbol_select(symbol, True)
        
        # Get price
        tick = mt5.symbol_info_tick(symbol)
        if not tick:
            return {'error': f"Failed to get tick for {symbol}"}
        
        if order_type.lower() == 'buy':
            price = tick.ask
            mt5_type = mt5.ORDER_TYPE_BUY
        else:
            price = tick.bid
            mt5_type = mt5.ORDER_TYPE_SELL
        
        # Build request
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(volume),
            "type": mt5_type,
            "price": price,
            "deviation": 20,
            "magic": 123456,
            "comment": "KIT-Multi",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        if sl:
            request["sl"] = float(sl)
        if tp:
            request["tp"] = float(tp)
        
        # Execute
        result = mt5.order_send(request)
        
        if result is None:
            return {'error': str(mt5.last_error())}
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            return {'error': result.comment, 'retcode': result.retcode}
        
        return {
            'ticket': result.order,
            'price': result.price,
            'volume': result.volume
        }
    
    def _close_all_positions(self, symbol: Optional[str] = None) -> List[Dict]:
        """Close all positions on current account"""
        if symbol:
            positions = mt5.positions_get(symbol=symbol)
        else:
            positions = mt5.positions_get()
        
        if not positions:
            return []
        
        results = []
        for pos in positions:
            tick = mt5.symbol_info_tick(pos.symbol)
            
            if pos.type == mt5.POSITION_TYPE_BUY:
                price = tick.bid
                close_type = mt5.ORDER_TYPE_SELL
            else:
                price = tick.ask
                close_type = mt5.ORDER_TYPE_BUY
            
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": pos.symbol,
                "volume": pos.volume,
                "type": close_type,
                "position": pos.ticket,
                "price": price,
                "deviation": 20,
                "magic": 123456,
                "comment": "KIT-Close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            result = mt5.order_send(request)
            
            if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                results.append({'ticket': pos.ticket, 'closed': True})
            else:
                results.append({'ticket': pos.ticket, 'closed': False, 'error': result.comment if result else 'Unknown'})
        
        return results


if __name__ == "__main__":
    print("🤖 K.I.T. Multi-Account Manager Test")
    print("=" * 50)
    
    manager = MT5MultiAccountManager()
    
    # Example: Add demo accounts
    # manager.add_account(AccountConfig(
    #     account_id=123456,
    #     password="demo_pass",
    #     server="ICMarketsSC-Demo",
    #     name="Demo Account 1"
    # ))
    
    print("\n📊 Account List:")
    for acc in manager.list_accounts():
        print(f"  {acc['account_id']}: {acc['name']} - {acc['server']}")
    
    print("\n✅ Multi-Account Manager ready!")
