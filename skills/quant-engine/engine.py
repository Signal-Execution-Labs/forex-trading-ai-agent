"""
📈 K.I.T. Quant Engine
======================
Wall Street-level quantitative trading algorithms!

Features:
- Statistical Arbitrage (Pairs Trading)
- Momentum Strategies
- Mean Reversion
- Factor Models
- Advanced Backtesting
"""

import numpy as np
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple, Callable
from enum import Enum
from datetime import datetime, timedelta
import asyncio
import logging
import json

# Stats libraries
try:
    from scipy import stats
    from scipy.optimize import minimize
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False

try:
    import statsmodels.api as sm
    from statsmodels.tsa.stattools import coint, adfuller
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False

try:
    from sklearn.linear_model import LinearRegression, Ridge, Lasso
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger("kit.quant-engine")


class SignalDirection(Enum):
    LONG = "LONG"
    SHORT = "SHORT"
    FLAT = "FLAT"


class StrategyType(Enum):
    STAT_ARB = "statistical_arbitrage"
    MOMENTUM = "momentum"
    MEAN_REVERSION = "mean_reversion"
    FACTOR = "factor_model"


@dataclass
class CointegrationResult:
    """Result of cointegration test"""
    asset1: str
    asset2: str
    coint_stat: float
    coint_pvalue: float
    hedge_ratio: float
    spread_mean: float
    spread_std: float
    half_life: float
    zscore: float
    is_cointegrated: bool
    
    def to_dict(self) -> dict:
        return {
            "pair": f"{self.asset1}/{self.asset2}",
            "cointegration": {
                "statistic": round(self.coint_stat, 4),
                "p-value": round(self.coint_pvalue, 4),
                "is_cointegrated": self.is_cointegrated
            },
            "trading": {
                "hedge_ratio": round(self.hedge_ratio, 4),
                "current_zscore": round(self.zscore, 2),
                "half_life_days": round(self.half_life, 1)
            }
        }


@dataclass
class TradingSignal:
    """Trading signal with context"""
    symbol: str
    direction: SignalDirection
    strength: float  # 0-1
    strategy: StrategyType
    entry_price: Optional[float] = None
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    position_size: float = 1.0
    metadata: Dict = field(default_factory=dict)
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "direction": self.direction.value,
            "strength": f"{self.strength:.1%}",
            "strategy": self.strategy.value,
            "levels": {
                "entry": self.entry_price,
                "stop_loss": self.stop_loss,
                "take_profit": self.take_profit
            },
            "position_size": self.position_size,
            "timestamp": self.timestamp.isoformat()
        }


@dataclass
class MomentumScore:
    """Momentum analysis result"""
    symbol: str
    return_1d: float
    return_5d: float
    return_20d: float
    return_60d: float
    momentum_score: float
    volatility: float
    sharpe: float
    rank: int


@dataclass
class BacktestResult:
    """Backtest performance result"""
    strategy: str
    symbol: str
    start_date: datetime
    end_date: datetime
    initial_capital: float
    final_capital: float
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    win_rate: float
    profit_factor: float
    total_trades: int
    avg_trade_return: float
    avg_holding_period: float
    trades: List[Dict] = field(default_factory=list)
    equity_curve: List[float] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "strategy": self.strategy,
            "symbol": self.symbol,
            "period": f"{self.start_date.date()} to {self.end_date.date()}",
            "performance": {
                "total_return": f"{self.total_return:.1%}",
                "annualized_return": f"{self.annualized_return:.1%}",
                "sharpe_ratio": round(self.sharpe_ratio, 2),
                "sortino_ratio": round(self.sortino_ratio, 2),
                "max_drawdown": f"{self.max_drawdown:.1%}"
            },
            "trades": {
                "total": self.total_trades,
                "win_rate": f"{self.win_rate:.1%}",
                "profit_factor": round(self.profit_factor, 2),
                "avg_return": f"{self.avg_trade_return:.2%}"
            }
        }


class StatisticalArbitrage:
    """
    Statistical Arbitrage / Pairs Trading
    Find and trade cointegrated asset pairs
    """
    
    def __init__(self):
        self.pairs: Dict[str, CointegrationResult] = {}
        
    def test_cointegration(
        self,
        series1: pd.Series,
        series2: pd.Series,
        significance: float = 0.05
    ) -> CointegrationResult:
        """Test if two price series are cointegrated"""
        asset1 = series1.name or "Asset1"
        asset2 = series2.name or "Asset2"
        
        if not STATSMODELS_AVAILABLE:
            # Fallback: simple correlation
            corr = series1.corr(series2)
            return CointegrationResult(
                asset1=asset1,
                asset2=asset2,
                coint_stat=corr,
                coint_pvalue=0.01 if abs(corr) > 0.8 else 0.5,
                hedge_ratio=1.0,
                spread_mean=0,
                spread_std=1,
                half_life=10,
                zscore=0,
                is_cointegrated=abs(corr) > 0.8
            )
        
        # Engle-Granger cointegration test
        coint_stat, coint_pvalue, _ = coint(series1, series2)
        
        # Calculate hedge ratio using OLS
        model = sm.OLS(series1, sm.add_constant(series2))
        results = model.fit()
        hedge_ratio = results.params.iloc[1] if len(results.params) > 1 else 1.0
        
        # Calculate spread
        spread = series1 - hedge_ratio * series2
        spread_mean = spread.mean()
        spread_std = spread.std()
        
        # Calculate half-life of mean reversion
        spread_lag = spread.shift(1).dropna()
        spread_diff = spread.diff().dropna()
        
        if len(spread_lag) > 0 and len(spread_diff) > 0:
            model_hl = sm.OLS(spread_diff, spread_lag.iloc[1:])
            results_hl = model_hl.fit()
            lambda_param = results_hl.params.iloc[0] if len(results_hl.params) > 0 else -0.1
            half_life = -np.log(2) / lambda_param if lambda_param < 0 else 999
        else:
            half_life = 10
        
        # Current z-score
        zscore = (spread.iloc[-1] - spread_mean) / spread_std if spread_std > 0 else 0
        
        return CointegrationResult(
            asset1=asset1,
            asset2=asset2,
            coint_stat=coint_stat,
            coint_pvalue=coint_pvalue,
            hedge_ratio=hedge_ratio,
            spread_mean=spread_mean,
            spread_std=spread_std,
            half_life=half_life,
            zscore=zscore,
            is_cointegrated=coint_pvalue < significance
        )
    
    def find_cointegrated_pairs(
        self,
        price_data: Dict[str, pd.Series],
        significance: float = 0.05
    ) -> List[CointegrationResult]:
        """Find all cointegrated pairs from a set of assets"""
        pairs = []
        symbols = list(price_data.keys())
        
        for i in range(len(symbols)):
            for j in range(i + 1, len(symbols)):
                result = self.test_cointegration(
                    price_data[symbols[i]],
                    price_data[symbols[j]],
                    significance
                )
                
                if result.is_cointegrated:
                    pairs.append(result)
        
        # Sort by p-value (lower is better)
        return sorted(pairs, key=lambda x: x.coint_pvalue)
    
    def get_signal(
        self,
        pair: CointegrationResult,
        entry_zscore: float = 2.0,
        exit_zscore: float = 0.5,
        stop_zscore: float = 4.0
    ) -> Tuple[TradingSignal, TradingSignal]:
        """Get trading signals for a cointegrated pair"""
        zscore = pair.zscore
        
        # Determine direction based on z-score
        if zscore >= entry_zscore:
            # Spread too high - short asset1, long asset2
            signal1 = TradingSignal(
                symbol=pair.asset1,
                direction=SignalDirection.SHORT,
                strength=min(1.0, abs(zscore) / stop_zscore),
                strategy=StrategyType.STAT_ARB,
                position_size=1.0,
                metadata={"hedge_ratio": pair.hedge_ratio, "zscore": zscore}
            )
            signal2 = TradingSignal(
                symbol=pair.asset2,
                direction=SignalDirection.LONG,
                strength=min(1.0, abs(zscore) / stop_zscore),
                strategy=StrategyType.STAT_ARB,
                position_size=pair.hedge_ratio,
                metadata={"hedge_ratio": pair.hedge_ratio, "zscore": zscore}
            )
        elif zscore <= -entry_zscore:
            # Spread too low - long asset1, short asset2
            signal1 = TradingSignal(
                symbol=pair.asset1,
                direction=SignalDirection.LONG,
                strength=min(1.0, abs(zscore) / stop_zscore),
                strategy=StrategyType.STAT_ARB,
                position_size=1.0,
                metadata={"hedge_ratio": pair.hedge_ratio, "zscore": zscore}
            )
            signal2 = TradingSignal(
                symbol=pair.asset2,
                direction=SignalDirection.SHORT,
                strength=min(1.0, abs(zscore) / stop_zscore),
                strategy=StrategyType.STAT_ARB,
                position_size=pair.hedge_ratio,
                metadata={"hedge_ratio": pair.hedge_ratio, "zscore": zscore}
            )
        else:
            # Z-score within exit threshold - flatten positions
            signal1 = TradingSignal(
                symbol=pair.asset1,
                direction=SignalDirection.FLAT,
                strength=0,
                strategy=StrategyType.STAT_ARB
            )
            signal2 = TradingSignal(
                symbol=pair.asset2,
                direction=SignalDirection.FLAT,
                strength=0,
                strategy=StrategyType.STAT_ARB
            )
        
        return signal1, signal2


class MomentumStrategy:
    """
    Momentum-based trading strategies
    """
    
    def __init__(self):
        self.lookback_periods = [1, 5, 20, 60]  # days
        
    def calculate_momentum(
        self,
        prices: pd.Series,
        lookback_periods: List[int] = None
    ) -> MomentumScore:
        """Calculate momentum score for single asset"""
        periods = lookback_periods or self.lookback_periods
        symbol = prices.name or "Asset"
        
        returns = {}
        for period in periods:
            if len(prices) > period:
                returns[period] = (prices.iloc[-1] / prices.iloc[-period-1] - 1)
            else:
                returns[period] = 0
        
        # Volatility (annualized)
        daily_returns = prices.pct_change().dropna()
        volatility = daily_returns.std() * np.sqrt(365)
        
        # Sharpe (simplified)
        avg_return = daily_returns.mean() * 365
        sharpe = avg_return / volatility if volatility > 0 else 0
        
        # Composite momentum score (weighted average)
        weights = {1: 0.1, 5: 0.2, 20: 0.4, 60: 0.3}
        momentum_score = sum(returns.get(p, 0) * weights.get(p, 0.25) for p in periods)
        
        return MomentumScore(
            symbol=symbol,
            return_1d=returns.get(1, 0),
            return_5d=returns.get(5, 0),
            return_20d=returns.get(20, 0),
            return_60d=returns.get(60, 0),
            momentum_score=momentum_score,
            volatility=volatility,
            sharpe=sharpe,
            rank=0
        )
    
    def rank_momentum(
        self,
        price_data: Dict[str, pd.Series]
    ) -> List[MomentumScore]:
        """Rank all assets by momentum"""
        scores = []
        
        for symbol, prices in price_data.items():
            score = self.calculate_momentum(prices)
            scores.append(score)
        
        # Sort by momentum score
        scores = sorted(scores, key=lambda x: x.momentum_score, reverse=True)
        
        # Assign ranks
        for i, score in enumerate(scores):
            score.rank = i + 1
        
        return scores
    
    def get_signal(
        self,
        score: MomentumScore,
        top_percentile: float = 0.2,
        bottom_percentile: float = 0.2,
        total_assets: int = 10
    ) -> TradingSignal:
        """Get trading signal based on momentum rank"""
        rank_percentile = score.rank / total_assets
        
        if rank_percentile <= top_percentile:
            direction = SignalDirection.LONG
            strength = 1 - rank_percentile
        elif rank_percentile >= (1 - bottom_percentile):
            direction = SignalDirection.SHORT
            strength = rank_percentile
        else:
            direction = SignalDirection.FLAT
            strength = 0
        
        return TradingSignal(
            symbol=score.symbol,
            direction=direction,
            strength=strength,
            strategy=StrategyType.MOMENTUM,
            metadata={
                "momentum_score": score.momentum_score,
                "rank": score.rank,
                "sharpe": score.sharpe
            }
        )


class MeanReversionStrategy:
    """
    Mean reversion trading strategies
    """
    
    def __init__(self):
        self.bb_period = 20
        self.bb_std = 2.0
        self.rsi_period = 14
        self.rsi_oversold = 30
        self.rsi_overbought = 70
        
    def calculate_bollinger_bands(
        self,
        prices: pd.Series,
        period: int = None,
        num_std: float = None
    ) -> Dict[str, pd.Series]:
        """Calculate Bollinger Bands"""
        period = period or self.bb_period
        num_std = num_std or self.bb_std
        
        sma = prices.rolling(period).mean()
        std = prices.rolling(period).std()
        
        return {
            "middle": sma,
            "upper": sma + (std * num_std),
            "lower": sma - (std * num_std),
            "width": (sma + std * num_std - (sma - std * num_std)) / sma,
            "position": (prices - (sma - std * num_std)) / ((sma + std * num_std) - (sma - std * num_std))
        }
    
    def calculate_rsi(
        self,
        prices: pd.Series,
        period: int = None
    ) -> pd.Series:
        """Calculate RSI"""
        period = period or self.rsi_period
        
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    def get_signal(
        self,
        prices: pd.Series,
        use_bollinger: bool = True,
        use_rsi: bool = True
    ) -> TradingSignal:
        """Get mean reversion signal"""
        symbol = prices.name or "Asset"
        signals = []
        
        if use_bollinger:
            bb = self.calculate_bollinger_bands(prices)
            bb_position = bb["position"].iloc[-1]
            
            if bb_position <= 0:  # Below lower band
                signals.append(("LONG", abs(bb_position)))
            elif bb_position >= 1:  # Above upper band
                signals.append(("SHORT", bb_position - 1))
        
        if use_rsi:
            rsi = self.calculate_rsi(prices)
            current_rsi = rsi.iloc[-1]
            
            if current_rsi <= self.rsi_oversold:
                signals.append(("LONG", (self.rsi_oversold - current_rsi) / self.rsi_oversold))
            elif current_rsi >= self.rsi_overbought:
                signals.append(("SHORT", (current_rsi - self.rsi_overbought) / (100 - self.rsi_overbought)))
        
        # Combine signals
        if not signals:
            return TradingSignal(
                symbol=symbol,
                direction=SignalDirection.FLAT,
                strength=0,
                strategy=StrategyType.MEAN_REVERSION
            )
        
        # Count long/short signals
        long_signals = [s for s in signals if s[0] == "LONG"]
        short_signals = [s for s in signals if s[0] == "SHORT"]
        
        if len(long_signals) > len(short_signals):
            direction = SignalDirection.LONG
            strength = sum(s[1] for s in long_signals) / len(long_signals)
        elif len(short_signals) > len(long_signals):
            direction = SignalDirection.SHORT
            strength = sum(s[1] for s in short_signals) / len(short_signals)
        else:
            direction = SignalDirection.FLAT
            strength = 0
        
        current_price = prices.iloc[-1]
        bb = self.calculate_bollinger_bands(prices)
        
        return TradingSignal(
            symbol=symbol,
            direction=direction,
            strength=min(1.0, strength),
            strategy=StrategyType.MEAN_REVERSION,
            entry_price=current_price,
            stop_loss=current_price * (0.95 if direction == SignalDirection.LONG else 1.05),
            take_profit=bb["middle"].iloc[-1],
            metadata={
                "bb_position": bb["position"].iloc[-1],
                "rsi": self.calculate_rsi(prices).iloc[-1]
            }
        )


class Backtester:
    """
    Advanced backtesting engine
    """
    
    def __init__(
        self,
        initial_capital: float = 100000,
        commission: float = 0.001,
        slippage: float = 0.0005
    ):
        self.initial_capital = initial_capital
        self.commission = commission
        self.slippage = slippage
        
    def run(
        self,
        prices: pd.Series,
        signals: pd.Series,  # +1 for long, -1 for short, 0 for flat
        strategy_name: str = "Strategy"
    ) -> BacktestResult:
        """Run backtest on historical data"""
        symbol = prices.name or "Asset"
        
        # Initialize
        capital = self.initial_capital
        position = 0
        position_price = 0
        equity_curve = [capital]
        trades = []
        
        returns = prices.pct_change().fillna(0)
        
        for i in range(1, len(prices)):
            date = prices.index[i] if isinstance(prices.index, pd.DatetimeIndex) else i
            price = prices.iloc[i]
            signal = signals.iloc[i] if i < len(signals) else 0
            
            # Apply slippage
            execution_price = price * (1 + self.slippage * signal) if signal != 0 else price
            
            # Check for signal change
            if signal != position:
                # Close existing position
                if position != 0:
                    pnl = position * (price - position_price) / position_price
                    pnl -= self.commission * 2  # Entry and exit commission
                    capital *= (1 + pnl)
                    
                    trades.append({
                        "exit_date": str(date),
                        "direction": "LONG" if position > 0 else "SHORT",
                        "entry_price": position_price,
                        "exit_price": price,
                        "pnl": pnl
                    })
                
                # Open new position
                position = signal
                position_price = execution_price if signal != 0 else 0
            
            # Mark-to-market
            if position != 0:
                mtm_pnl = position * (price - position_price) / position_price
                equity_curve.append(capital * (1 + mtm_pnl))
            else:
                equity_curve.append(capital)
        
        # Close final position
        if position != 0:
            pnl = position * (prices.iloc[-1] - position_price) / position_price
            capital *= (1 + pnl - self.commission)
            equity_curve[-1] = capital
        
        # Calculate metrics
        equity_series = pd.Series(equity_curve)
        returns_series = equity_series.pct_change().dropna()
        
        total_return = (capital - self.initial_capital) / self.initial_capital
        
        # Annualized return
        days = len(prices)
        annualized_return = ((1 + total_return) ** (365 / days)) - 1 if days > 0 else 0
        
        # Sharpe ratio
        if len(returns_series) > 0 and returns_series.std() > 0:
            sharpe = returns_series.mean() / returns_series.std() * np.sqrt(365)
        else:
            sharpe = 0
        
        # Sortino ratio
        downside_returns = returns_series[returns_series < 0]
        if len(downside_returns) > 0 and downside_returns.std() > 0:
            sortino = returns_series.mean() / downside_returns.std() * np.sqrt(365)
        else:
            sortino = 0
        
        # Max drawdown
        peak = equity_series.cummax()
        drawdown = (equity_series - peak) / peak
        max_drawdown = drawdown.min()
        
        # Trade statistics
        if trades:
            winning_trades = [t for t in trades if t["pnl"] > 0]
            win_rate = len(winning_trades) / len(trades)
            
            gross_profit = sum(t["pnl"] for t in winning_trades)
            gross_loss = abs(sum(t["pnl"] for t in trades if t["pnl"] < 0))
            profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
            
            avg_trade_return = sum(t["pnl"] for t in trades) / len(trades)
        else:
            win_rate = 0
            profit_factor = 0
            avg_trade_return = 0
        
        return BacktestResult(
            strategy=strategy_name,
            symbol=symbol,
            start_date=prices.index[0] if isinstance(prices.index, pd.DatetimeIndex) else datetime.now() - timedelta(days=len(prices)),
            end_date=prices.index[-1] if isinstance(prices.index, pd.DatetimeIndex) else datetime.now(),
            initial_capital=self.initial_capital,
            final_capital=capital,
            total_return=total_return,
            annualized_return=annualized_return,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            max_drawdown=max_drawdown,
            win_rate=win_rate,
            profit_factor=profit_factor,
            total_trades=len(trades),
            avg_trade_return=avg_trade_return,
            avg_holding_period=days / max(len(trades), 1),
            trades=trades,
            equity_curve=equity_curve
        )


class QuantEngine:
    """
    Main Quantitative Trading Engine for K.I.T.
    Combines all quant strategies
    """
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        self.stat_arb = StatisticalArbitrage()
        self.momentum = MomentumStrategy()
        self.mean_rev = MeanReversionStrategy()
        self.backtester = Backtester()
        
    async def fetch_prices(
        self,
        symbols: List[str],
        days: int = 90
    ) -> Dict[str, pd.Series]:
        """Fetch historical prices"""
        # In production, would call exchange APIs
        # For now, generate synthetic data
        import numpy as np
        
        prices = {}
        dates = pd.date_range(end=datetime.now(), periods=days, freq='D')
        
        base_prices = {
            "BTC": 65000,
            "ETH": 3500,
            "SOL": 150,
            "AVAX": 35,
            "DOT": 7.5,
            "LINK": 15,
            "UNI": 10,
            "AAVE": 100,
        }
        
        for symbol in symbols:
            base = base_prices.get(symbol, 100)
            
            # Generate correlated returns
            np.random.seed(hash(symbol) % 2**32)
            returns = np.random.randn(days) * 0.03  # 3% daily vol
            
            price_series = base * np.exp(np.cumsum(returns))
            prices[symbol] = pd.Series(price_series, index=dates, name=symbol)
        
        return prices
    
    async def find_cointegrated_pairs(
        self,
        symbols: List[str],
        lookback: int = 90
    ) -> List[CointegrationResult]:
        """Find cointegrated pairs for stat arb"""
        logger.info(f"🔍 Finding cointegrated pairs among {len(symbols)} assets...")
        
        prices = await self.fetch_prices(symbols, lookback)
        pairs = self.stat_arb.find_cointegrated_pairs(prices)
        
        logger.info(f"✅ Found {len(pairs)} cointegrated pairs")
        return pairs
    
    async def get_stat_arb_signal(
        self,
        pair: CointegrationResult,
        entry_zscore: float = 2.0,
        exit_zscore: float = 0.5
    ) -> Tuple[TradingSignal, TradingSignal]:
        """Get statistical arbitrage signals for a pair"""
        return self.stat_arb.get_signal(pair, entry_zscore, exit_zscore)
    
    async def momentum_scan(
        self,
        symbols: List[str],
        lookback: int = 60
    ) -> List[MomentumScore]:
        """Scan and rank assets by momentum"""
        logger.info(f"📈 Scanning momentum for {len(symbols)} assets...")
        
        prices = await self.fetch_prices(symbols, lookback)
        scores = self.momentum.rank_momentum(prices)
        
        logger.info(f"✅ Top momentum: {scores[0].symbol} ({scores[0].momentum_score:.2%})")
        return scores
    
    async def mean_reversion_signals(
        self,
        symbols: List[str],
        lookback: int = 30
    ) -> List[TradingSignal]:
        """Get mean reversion signals for multiple assets"""
        logger.info(f"📉 Analyzing mean reversion for {len(symbols)} assets...")
        
        prices = await self.fetch_prices(symbols, lookback)
        signals = []
        
        for symbol, price_series in prices.items():
            signal = self.mean_rev.get_signal(price_series)
            signals.append(signal)
        
        # Sort by strength
        signals = sorted(signals, key=lambda x: x.strength, reverse=True)
        
        return signals
    
    async def backtest(
        self,
        strategy: str,
        symbol: str,
        start_date: str = None,
        end_date: str = None,
        lookback: int = 365
    ) -> BacktestResult:
        """Backtest a strategy"""
        logger.info(f"🔬 Backtesting {strategy} on {symbol}...")
        
        prices = await self.fetch_prices([symbol], lookback)
        price_series = prices[symbol]
        
        # Generate signals based on strategy
        if strategy == "momentum":
            # Momentum strategy: long when positive momentum
            returns = price_series.pct_change(20).fillna(0)
            signals = pd.Series(np.where(returns > 0, 1, -1), index=price_series.index)
            
        elif strategy == "mean_reversion":
            # Mean reversion: RSI-based
            rsi = self.mean_rev.calculate_rsi(price_series)
            signals = pd.Series(
                np.where(rsi < 30, 1, np.where(rsi > 70, -1, 0)),
                index=price_series.index
            )
            
        elif strategy == "stat_arb" or strategy == "statistical_arbitrage":
            # For stat arb, need two assets - simplified single asset version
            bb = self.mean_rev.calculate_bollinger_bands(price_series)
            signals = pd.Series(
                np.where(bb["position"] < 0, 1, np.where(bb["position"] > 1, -1, 0)),
                index=price_series.index
            )
        else:
            # Default: buy and hold
            signals = pd.Series(1, index=price_series.index)
        
        result = self.backtester.run(price_series, signals, strategy)
        
        logger.info(f"✅ Backtest complete: {result.total_return:.1%} return, {result.sharpe_ratio:.2f} Sharpe")
        
        return result
    
    async def get_all_signals(
        self,
        symbols: List[str]
    ) -> Dict[str, List[TradingSignal]]:
        """Get signals from all strategies"""
        results = {}
        
        # Momentum signals
        momentum_scores = await self.momentum_scan(symbols)
        results["momentum"] = [
            self.momentum.get_signal(score, total_assets=len(symbols))
            for score in momentum_scores
        ]
        
        # Mean reversion signals
        results["mean_reversion"] = await self.mean_reversion_signals(symbols)
        
        # Stat arb pairs
        pairs = await self.find_cointegrated_pairs(symbols)
        results["stat_arb"] = []
        for pair in pairs[:3]:  # Top 3 pairs
            s1, s2 = await self.get_stat_arb_signal(pair)
            results["stat_arb"].extend([s1, s2])
        
        return results


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("📈 K.I.T. Quant Engine Demo")
        print("=" * 50)
        
        engine = QuantEngine()
        symbols = ["BTC", "ETH", "SOL", "AVAX", "DOT"]
        
        # Find cointegrated pairs
        pairs = await engine.find_cointegrated_pairs(symbols)
        print("\n🔗 Cointegrated Pairs:")
        for pair in pairs[:3]:
            print(json.dumps(pair.to_dict(), indent=2))
        
        # Momentum scan
        momentum = await engine.momentum_scan(symbols)
        print("\n🚀 Momentum Rankings:")
        for score in momentum:
            print(f"  #{score.rank} {score.symbol}: {score.momentum_score:.2%} (Sharpe: {score.sharpe:.2f})")
        
        # Mean reversion signals
        signals = await engine.mean_reversion_signals(symbols)
        print("\n📉 Mean Reversion Signals:")
        for signal in signals[:3]:
            if signal.direction != SignalDirection.FLAT:
                print(json.dumps(signal.to_dict(), indent=2))
        
        # Backtest
        print("\n🔬 Backtesting momentum strategy on BTC...")
        result = await engine.backtest("momentum", "BTC", lookback=365)
        print(json.dumps(result.to_dict(), indent=2))
    
    asyncio.run(demo())
