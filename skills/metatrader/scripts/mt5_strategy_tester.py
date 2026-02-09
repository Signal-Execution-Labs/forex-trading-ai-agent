"""
MT5 Strategy Tester - Backtesting & Optimization für K.I.T.

🔥 WELTKLASSE FEATURES:
- Historical backtesting with tick data
- Strategy optimization
- Walk-forward analysis
- Monte Carlo simulation
- Performance metrics (Sharpe, Sortino, Max DD, etc.)
"""

import MetaTrader5 as mt5
import pandas as pd
import numpy as np
from typing import Optional, Dict, Any, List, Callable, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
import json
import logging
from pathlib import Path

logger = logging.getLogger("MT5StrategyTester")


class TradeDirection(Enum):
    BUY = 1
    SELL = -1
    FLAT = 0


@dataclass
class Trade:
    """Trade record for backtesting"""
    entry_time: datetime
    exit_time: Optional[datetime]
    direction: TradeDirection
    entry_price: float
    exit_price: Optional[float]
    volume: float
    sl: Optional[float]
    tp: Optional[float]
    profit: float = 0.0
    pips: float = 0.0
    commission: float = 0.0
    swap: float = 0.0
    comment: str = ""


@dataclass
class BacktestResult:
    """Comprehensive backtest results"""
    # Basic stats
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    
    # Profit metrics
    total_profit: float = 0.0
    total_pips: float = 0.0
    gross_profit: float = 0.0
    gross_loss: float = 0.0
    profit_factor: float = 0.0
    
    # Risk metrics
    max_drawdown: float = 0.0
    max_drawdown_percent: float = 0.0
    max_consecutive_wins: int = 0
    max_consecutive_losses: int = 0
    
    # Performance ratios
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    calmar_ratio: float = 0.0
    
    # Trade stats
    avg_win: float = 0.0
    avg_loss: float = 0.0
    largest_win: float = 0.0
    largest_loss: float = 0.0
    avg_trade_duration: float = 0.0  # in hours
    
    # Equity curve
    equity_curve: List[float] = field(default_factory=list)
    trades: List[Trade] = field(default_factory=list)
    
    # Period
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    

class Strategy:
    """Base class for trading strategies"""
    
    def __init__(self, name: str = "BaseStrategy"):
        self.name = name
        self.parameters: Dict[str, Any] = {}
    
    def on_bar(self, data: pd.DataFrame, index: int) -> Optional[TradeDirection]:
        """
        Called on each bar
        
        Args:
            data: Full OHLCV DataFrame
            index: Current bar index
            
        Returns:
            TradeDirection or None for no action
        """
        raise NotImplementedError("Implement on_bar in your strategy")
    
    def get_sl_tp(self, data: pd.DataFrame, index: int, direction: TradeDirection) -> Tuple[Optional[float], Optional[float]]:
        """Get SL/TP for a trade"""
        return None, None
    
    def set_parameters(self, **kwargs) -> None:
        """Set strategy parameters"""
        self.parameters.update(kwargs)


class MovingAverageCrossStrategy(Strategy):
    """Example: Moving Average Crossover Strategy"""
    
    def __init__(self):
        super().__init__("MA Crossover")
        self.parameters = {
            'fast_period': 10,
            'slow_period': 20,
            'sl_pips': 20,
            'tp_pips': 40
        }
    
    def on_bar(self, data: pd.DataFrame, index: int) -> Optional[TradeDirection]:
        if index < self.parameters['slow_period']:
            return None
        
        fast = data['close'].iloc[index-self.parameters['fast_period']:index].mean()
        slow = data['close'].iloc[index-self.parameters['slow_period']:index].mean()
        
        fast_prev = data['close'].iloc[index-self.parameters['fast_period']-1:index-1].mean()
        slow_prev = data['close'].iloc[index-self.parameters['slow_period']-1:index-1].mean()
        
        # Crossover
        if fast > slow and fast_prev <= slow_prev:
            return TradeDirection.BUY
        elif fast < slow and fast_prev >= slow_prev:
            return TradeDirection.SELL
        
        return None
    
    def get_sl_tp(self, data: pd.DataFrame, index: int, direction: TradeDirection) -> Tuple[Optional[float], Optional[float]]:
        price = data['close'].iloc[index]
        pip = 0.0001  # For forex
        
        if direction == TradeDirection.BUY:
            sl = price - self.parameters['sl_pips'] * pip
            tp = price + self.parameters['tp_pips'] * pip
        else:
            sl = price + self.parameters['sl_pips'] * pip
            tp = price - self.parameters['tp_pips'] * pip
        
        return sl, tp


class MT5StrategyTester:
    """
    Strategy Tester for K.I.T.
    
    Features:
    - Backtesting on historical data
    - Strategy optimization
    - Walk-forward analysis
    - Monte Carlo simulation
    
    Usage:
        tester = MT5StrategyTester()
        tester.load_data("EURUSD", "H1", days=365)
        
        strategy = MovingAverageCrossStrategy()
        result = tester.run_backtest(strategy)
        
        print(f"Profit: {result.total_profit}")
        print(f"Win Rate: {result.win_rate}%")
    """
    
    def __init__(self, initial_balance: float = 10000.0):
        self.initial_balance = initial_balance
        self.data: Optional[pd.DataFrame] = None
        self.symbol: str = ""
        self.commission_per_lot: float = 7.0  # Default commission
        self.spread_pips: float = 1.0  # Default spread
        self.pip_value: float = 10.0  # Per standard lot
        self.point: float = 0.00001
    
    def load_data(
        self,
        symbol: str,
        timeframe: str,
        days: int = 365,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None
    ) -> pd.DataFrame:
        """
        Load historical data for backtesting
        
        Args:
            symbol: Trading symbol
            timeframe: Timeframe (M1, M5, M15, H1, H4, D1)
            days: Number of days to load
            date_from: Start date (optional)
            date_to: End date (optional)
        """
        # Timeframe mapping
        tf_map = {
            'M1': mt5.TIMEFRAME_M1,
            'M5': mt5.TIMEFRAME_M5,
            'M15': mt5.TIMEFRAME_M15,
            'M30': mt5.TIMEFRAME_M30,
            'H1': mt5.TIMEFRAME_H1,
            'H4': mt5.TIMEFRAME_H4,
            'D1': mt5.TIMEFRAME_D1,
        }
        
        tf = tf_map.get(timeframe.upper())
        if tf is None:
            raise ValueError(f"Invalid timeframe: {timeframe}")
        
        # Calculate dates
        if date_to is None:
            date_to = datetime.now()
        if date_from is None:
            date_from = date_to - timedelta(days=days)
        
        # Get symbol info
        if mt5.initialize():
            symbol_info = mt5.symbol_info(symbol)
            if symbol_info:
                self.point = symbol_info.point
                self.pip_value = symbol_info.trade_tick_value * (0.0001 / symbol_info.trade_tick_size)
            
            # Load data
            rates = mt5.copy_rates_range(symbol, tf, date_from, date_to)
            mt5.shutdown()
        else:
            raise Exception("Failed to initialize MT5")
        
        if rates is None or len(rates) == 0:
            raise ValueError(f"No data found for {symbol}")
        
        # Convert to DataFrame
        self.data = pd.DataFrame(rates)
        self.data['time'] = pd.to_datetime(self.data['time'], unit='s')
        self.data = self.data.rename(columns={'tick_volume': 'volume'})
        self.symbol = symbol
        
        logger.info(f"Loaded {len(self.data)} bars for {symbol} {timeframe}")
        return self.data
    
    def load_csv(self, path: str) -> pd.DataFrame:
        """Load data from CSV file"""
        self.data = pd.read_csv(path, parse_dates=['time'])
        return self.data
    
    def run_backtest(
        self,
        strategy: Strategy,
        volume: float = 0.1,
        use_sl_tp: bool = True
    ) -> BacktestResult:
        """
        Run backtest with a strategy
        
        Args:
            strategy: Strategy instance
            volume: Trade volume in lots
            use_sl_tp: Use SL/TP from strategy
            
        Returns:
            BacktestResult with all metrics
        """
        if self.data is None:
            raise ValueError("No data loaded. Call load_data() first.")
        
        result = BacktestResult()
        result.start_date = self.data['time'].iloc[0]
        result.end_date = self.data['time'].iloc[-1]
        
        balance = self.initial_balance
        equity_curve = [balance]
        trades: List[Trade] = []
        current_trade: Optional[Trade] = None
        
        # Walk through bars
        for i in range(len(self.data)):
            bar = self.data.iloc[i]
            
            # Check SL/TP for current trade
            if current_trade:
                closed = False
                
                # Check SL
                if current_trade.sl:
                    if current_trade.direction == TradeDirection.BUY and bar['low'] <= current_trade.sl:
                        current_trade.exit_price = current_trade.sl
                        closed = True
                    elif current_trade.direction == TradeDirection.SELL and bar['high'] >= current_trade.sl:
                        current_trade.exit_price = current_trade.sl
                        closed = True
                
                # Check TP
                if not closed and current_trade.tp:
                    if current_trade.direction == TradeDirection.BUY and bar['high'] >= current_trade.tp:
                        current_trade.exit_price = current_trade.tp
                        closed = True
                    elif current_trade.direction == TradeDirection.SELL and bar['low'] <= current_trade.tp:
                        current_trade.exit_price = current_trade.tp
                        closed = True
                
                if closed:
                    current_trade.exit_time = bar['time']
                    self._calculate_trade_profit(current_trade)
                    balance += current_trade.profit
                    trades.append(current_trade)
                    current_trade = None
            
            # Get strategy signal
            signal = strategy.on_bar(self.data, i)
            
            # Process signal
            if signal and signal != TradeDirection.FLAT:
                # Close existing trade if opposite direction
                if current_trade and current_trade.direction != signal:
                    current_trade.exit_time = bar['time']
                    current_trade.exit_price = bar['close']
                    self._calculate_trade_profit(current_trade)
                    balance += current_trade.profit
                    trades.append(current_trade)
                    current_trade = None
                
                # Open new trade
                if current_trade is None:
                    sl, tp = None, None
                    if use_sl_tp:
                        sl, tp = strategy.get_sl_tp(self.data, i, signal)
                    
                    # Apply spread
                    entry_price = bar['close']
                    if signal == TradeDirection.BUY:
                        entry_price += self.spread_pips * self.point * 10
                    
                    current_trade = Trade(
                        entry_time=bar['time'],
                        exit_time=None,
                        direction=signal,
                        entry_price=entry_price,
                        exit_price=None,
                        volume=volume,
                        sl=sl,
                        tp=tp,
                        commission=self.commission_per_lot * volume
                    )
            
            equity_curve.append(balance)
        
        # Close any open trade at the end
        if current_trade:
            current_trade.exit_time = self.data['time'].iloc[-1]
            current_trade.exit_price = self.data['close'].iloc[-1]
            self._calculate_trade_profit(current_trade)
            balance += current_trade.profit
            trades.append(current_trade)
        
        # Calculate metrics
        result = self._calculate_metrics(trades, equity_curve)
        result.start_date = self.data['time'].iloc[0]
        result.end_date = self.data['time'].iloc[-1]
        
        return result
    
    def optimize(
        self,
        strategy: Strategy,
        param_grid: Dict[str, List[Any]],
        metric: str = 'total_profit',
        volume: float = 0.1
    ) -> List[Dict[str, Any]]:
        """
        Optimize strategy parameters
        
        Args:
            strategy: Strategy instance
            param_grid: Parameter ranges {'param_name': [values]}
            metric: Optimization metric
            volume: Trade volume
            
        Returns:
            List of results sorted by metric
        """
        from itertools import product
        
        # Generate all combinations
        param_names = list(param_grid.keys())
        param_values = list(param_grid.values())
        combinations = list(product(*param_values))
        
        results = []
        total = len(combinations)
        
        logger.info(f"Optimizing {total} parameter combinations...")
        
        for i, combo in enumerate(combinations):
            # Set parameters
            params = dict(zip(param_names, combo))
            strategy.set_parameters(**params)
            
            # Run backtest
            try:
                result = self.run_backtest(strategy, volume=volume)
                
                results.append({
                    'parameters': params.copy(),
                    'total_profit': result.total_profit,
                    'win_rate': result.win_rate,
                    'profit_factor': result.profit_factor,
                    'sharpe_ratio': result.sharpe_ratio,
                    'max_drawdown': result.max_drawdown_percent,
                    'total_trades': result.total_trades
                })
            except Exception as e:
                logger.warning(f"Optimization failed for {params}: {e}")
            
            if (i + 1) % 10 == 0:
                logger.info(f"Progress: {i+1}/{total}")
        
        # Sort by metric
        results.sort(key=lambda x: x.get(metric, 0), reverse=True)
        
        return results
    
    def walk_forward(
        self,
        strategy: Strategy,
        param_grid: Dict[str, List[Any]],
        in_sample_bars: int = 500,
        out_sample_bars: int = 100,
        step_bars: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Walk-forward optimization
        
        Prevents overfitting by optimizing on in-sample data
        and testing on out-of-sample data
        """
        if self.data is None:
            raise ValueError("No data loaded")
        
        results = []
        total_bars = len(self.data)
        current_start = 0
        
        while current_start + in_sample_bars + out_sample_bars <= total_bars:
            # In-sample period
            is_start = current_start
            is_end = current_start + in_sample_bars
            
            # Out-of-sample period
            oos_start = is_end
            oos_end = is_end + out_sample_bars
            
            # Create in-sample tester
            is_tester = MT5StrategyTester(self.initial_balance)
            is_tester.data = self.data.iloc[is_start:is_end].reset_index(drop=True)
            is_tester.symbol = self.symbol
            is_tester.point = self.point
            is_tester.pip_value = self.pip_value
            
            # Optimize on in-sample
            opt_results = is_tester.optimize(strategy, param_grid)
            
            if not opt_results:
                current_start += step_bars
                continue
            
            # Best parameters
            best_params = opt_results[0]['parameters']
            strategy.set_parameters(**best_params)
            
            # Test on out-of-sample
            oos_tester = MT5StrategyTester(self.initial_balance)
            oos_tester.data = self.data.iloc[oos_start:oos_end].reset_index(drop=True)
            oos_tester.symbol = self.symbol
            oos_tester.point = self.point
            oos_tester.pip_value = self.pip_value
            
            oos_result = oos_tester.run_backtest(strategy)
            
            results.append({
                'period_start': self.data['time'].iloc[oos_start],
                'period_end': self.data['time'].iloc[min(oos_end-1, len(self.data)-1)],
                'best_params': best_params,
                'in_sample_profit': opt_results[0]['total_profit'],
                'out_sample_profit': oos_result.total_profit,
                'out_sample_win_rate': oos_result.win_rate,
                'out_sample_trades': oos_result.total_trades
            })
            
            current_start += step_bars
        
        return results
    
    def monte_carlo(
        self,
        result: BacktestResult,
        simulations: int = 1000
    ) -> Dict[str, Any]:
        """
        Monte Carlo simulation on trade results
        
        Shuffles trade order to estimate distribution of outcomes
        """
        if not result.trades:
            return {}
        
        trade_profits = [t.profit for t in result.trades]
        final_balances = []
        max_drawdowns = []
        
        for _ in range(simulations):
            # Shuffle trades
            shuffled = np.random.permutation(trade_profits)
            
            # Calculate equity curve
            equity = [self.initial_balance]
            for profit in shuffled:
                equity.append(equity[-1] + profit)
            
            final_balances.append(equity[-1])
            
            # Calculate drawdown
            peak = self.initial_balance
            max_dd = 0
            for eq in equity:
                if eq > peak:
                    peak = eq
                dd = (peak - eq) / peak * 100
                if dd > max_dd:
                    max_dd = dd
            max_drawdowns.append(max_dd)
        
        return {
            'simulations': simulations,
            'mean_final_balance': np.mean(final_balances),
            'std_final_balance': np.std(final_balances),
            'median_final_balance': np.median(final_balances),
            'percentile_5': np.percentile(final_balances, 5),
            'percentile_95': np.percentile(final_balances, 95),
            'worst_case': min(final_balances),
            'best_case': max(final_balances),
            'mean_max_drawdown': np.mean(max_drawdowns),
            'worst_drawdown': max(max_drawdowns),
            'probability_profit': sum(1 for b in final_balances if b > self.initial_balance) / simulations * 100
        }
    
    def _calculate_trade_profit(self, trade: Trade) -> None:
        """Calculate profit for a trade"""
        if trade.exit_price is None:
            return
        
        # Pip calculation
        if trade.direction == TradeDirection.BUY:
            pips = (trade.exit_price - trade.entry_price) / (self.point * 10)
        else:
            pips = (trade.entry_price - trade.exit_price) / (self.point * 10)
        
        trade.pips = pips
        trade.profit = pips * self.pip_value * trade.volume - trade.commission
    
    def _calculate_metrics(self, trades: List[Trade], equity_curve: List[float]) -> BacktestResult:
        """Calculate all backtest metrics"""
        result = BacktestResult()
        result.trades = trades
        result.equity_curve = equity_curve
        
        if not trades:
            return result
        
        # Basic stats
        result.total_trades = len(trades)
        result.winning_trades = len([t for t in trades if t.profit > 0])
        result.losing_trades = len([t for t in trades if t.profit <= 0])
        result.win_rate = result.winning_trades / result.total_trades * 100
        
        # Profit metrics
        profits = [t.profit for t in trades]
        result.total_profit = sum(profits)
        result.total_pips = sum(t.pips for t in trades)
        result.gross_profit = sum(p for p in profits if p > 0)
        result.gross_loss = abs(sum(p for p in profits if p < 0))
        result.profit_factor = result.gross_profit / result.gross_loss if result.gross_loss > 0 else float('inf')
        
        # Trade stats
        wins = [p for p in profits if p > 0]
        losses = [p for p in profits if p < 0]
        result.avg_win = np.mean(wins) if wins else 0
        result.avg_loss = np.mean(losses) if losses else 0
        result.largest_win = max(profits) if profits else 0
        result.largest_loss = min(profits) if profits else 0
        
        # Duration
        durations = []
        for t in trades:
            if t.exit_time and t.entry_time:
                duration = (t.exit_time - t.entry_time).total_seconds() / 3600
                durations.append(duration)
        result.avg_trade_duration = np.mean(durations) if durations else 0
        
        # Drawdown
        peak = equity_curve[0]
        max_dd = 0
        max_dd_pct = 0
        for eq in equity_curve:
            if eq > peak:
                peak = eq
            dd = peak - eq
            dd_pct = dd / peak * 100
            if dd > max_dd:
                max_dd = dd
            if dd_pct > max_dd_pct:
                max_dd_pct = dd_pct
        result.max_drawdown = max_dd
        result.max_drawdown_percent = max_dd_pct
        
        # Consecutive wins/losses
        max_cons_wins = 0
        max_cons_losses = 0
        cons_wins = 0
        cons_losses = 0
        for p in profits:
            if p > 0:
                cons_wins += 1
                cons_losses = 0
                max_cons_wins = max(max_cons_wins, cons_wins)
            else:
                cons_losses += 1
                cons_wins = 0
                max_cons_losses = max(max_cons_losses, cons_losses)
        result.max_consecutive_wins = max_cons_wins
        result.max_consecutive_losses = max_cons_losses
        
        # Risk ratios
        returns = np.diff(equity_curve) / equity_curve[:-1]
        if len(returns) > 0 and np.std(returns) > 0:
            result.sharpe_ratio = np.mean(returns) / np.std(returns) * np.sqrt(252)  # Annualized
            
            # Sortino (only downside deviation)
            downside = returns[returns < 0]
            if len(downside) > 0:
                result.sortino_ratio = np.mean(returns) / np.std(downside) * np.sqrt(252)
            
            # Calmar
            if result.max_drawdown_percent > 0:
                annual_return = result.total_profit / self.initial_balance * 100
                result.calmar_ratio = annual_return / result.max_drawdown_percent
        
        return result
    
    def generate_report(self, result: BacktestResult, path: str) -> None:
        """Generate HTML backtest report"""
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>K.I.T. Backtest Report - {self.symbol}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; background: #1a1a2e; color: #eee; }}
        .header {{ background: #16213e; padding: 20px; border-radius: 10px; margin-bottom: 20px; }}
        .metrics {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }}
        .metric {{ background: #0f3460; padding: 15px; border-radius: 8px; text-align: center; }}
        .metric-value {{ font-size: 24px; font-weight: bold; color: #00ff88; }}
        .metric-label {{ font-size: 12px; color: #888; }}
        .negative {{ color: #ff4444; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 20px; }}
        th, td {{ padding: 10px; text-align: left; border-bottom: 1px solid #333; }}
        th {{ background: #16213e; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🤖 K.I.T. Backtest Report</h1>
        <p>Symbol: {self.symbol} | Period: {result.start_date} to {result.end_date}</p>
    </div>
    
    <div class="metrics">
        <div class="metric">
            <div class="metric-value {'negative' if result.total_profit < 0 else ''}">${result.total_profit:,.2f}</div>
            <div class="metric-label">Total Profit</div>
        </div>
        <div class="metric">
            <div class="metric-value">{result.win_rate:.1f}%</div>
            <div class="metric-label">Win Rate</div>
        </div>
        <div class="metric">
            <div class="metric-value">{result.profit_factor:.2f}</div>
            <div class="metric-label">Profit Factor</div>
        </div>
        <div class="metric">
            <div class="metric-value">{result.sharpe_ratio:.2f}</div>
            <div class="metric-label">Sharpe Ratio</div>
        </div>
        <div class="metric">
            <div class="metric-value">{result.total_trades}</div>
            <div class="metric-label">Total Trades</div>
        </div>
        <div class="metric">
            <div class="metric-value class="negative">{result.max_drawdown_percent:.1f}%</div>
            <div class="metric-label">Max Drawdown</div>
        </div>
        <div class="metric">
            <div class="metric-value">${result.avg_win:.2f}</div>
            <div class="metric-label">Average Win</div>
        </div>
        <div class="metric">
            <div class="metric-value class="negative">${result.avg_loss:.2f}</div>
            <div class="metric-label">Average Loss</div>
        </div>
    </div>
    
    <h2>📊 Trade History</h2>
    <table>
        <tr>
            <th>Entry Time</th>
            <th>Exit Time</th>
            <th>Direction</th>
            <th>Entry Price</th>
            <th>Exit Price</th>
            <th>Pips</th>
            <th>Profit</th>
        </tr>
        {''.join(f'''
        <tr>
            <td>{t.entry_time}</td>
            <td>{t.exit_time}</td>
            <td>{'🟢 BUY' if t.direction == TradeDirection.BUY else '🔴 SELL'}</td>
            <td>{t.entry_price:.5f}</td>
            <td>{t.exit_price:.5f if t.exit_price else '-'}</td>
            <td>{t.pips:.1f}</td>
            <td class="{'negative' if t.profit < 0 else ''}">${t.profit:.2f}</td>
        </tr>
        ''' for t in result.trades[-50:])}
    </table>
    
    <p><small>Generated by K.I.T. Strategy Tester | {datetime.now()}</small></p>
</body>
</html>
"""
        with open(path, 'w') as f:
            f.write(html)
        
        logger.info(f"Report saved to {path}")


if __name__ == "__main__":
    print("🤖 K.I.T. Strategy Tester")
    print("=" * 50)
    
    # Example usage
    if mt5.initialize():
        tester = MT5StrategyTester(initial_balance=10000)
        
        try:
            # Load data
            tester.load_data("EURUSD", "H1", days=180)
            
            # Create strategy
            strategy = MovingAverageCrossStrategy()
            
            # Run backtest
            result = tester.run_backtest(strategy, volume=0.1)
            
            print(f"\n📊 Backtest Results:")
            print(f"  Total Trades: {result.total_trades}")
            print(f"  Win Rate: {result.win_rate:.1f}%")
            print(f"  Total Profit: ${result.total_profit:.2f}")
            print(f"  Profit Factor: {result.profit_factor:.2f}")
            print(f"  Max Drawdown: {result.max_drawdown_percent:.1f}%")
            print(f"  Sharpe Ratio: {result.sharpe_ratio:.2f}")
            
            # Monte Carlo
            mc = tester.monte_carlo(result, simulations=1000)
            print(f"\n🎲 Monte Carlo ({mc['simulations']} simulations):")
            print(f"  Mean Final Balance: ${mc['mean_final_balance']:.2f}")
            print(f"  Probability of Profit: {mc['probability_profit']:.1f}%")
            print(f"  5th Percentile: ${mc['percentile_5']:.2f}")
            print(f"  95th Percentile: ${mc['percentile_95']:.2f}")
            
        except Exception as e:
            print(f"Error: {e}")
        
        mt5.shutdown()
    else:
        print("❌ MT5 not available for testing")
    
    print("\n✅ Strategy Tester ready!")
