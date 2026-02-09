"""
⚠️ K.I.T. Risk Calculator
=========================
Portfolio risk analysis and position sizing.

Features:
- Value at Risk (VaR)
- Sharpe/Sortino ratios
- Maximum drawdown
- Correlation analysis
- Position sizing
- Stress testing
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import math

logger = logging.getLogger("kit.risk-calculator")

# Try to import numpy/pandas, fall back to pure Python if not available
try:
    import numpy as np
    import pandas as pd
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
    logger.warning("NumPy/Pandas not available - using pure Python calculations")

try:
    from scipy import stats
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


class RiskLevel(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class Position:
    """Portfolio position"""
    asset: str
    quantity: float
    entry_price: float
    current_price: float
    value_usd: float
    pnl: float
    pnl_percent: float
    weight: float  # % of portfolio


@dataclass
class RiskMetrics:
    """Comprehensive risk metrics"""
    # Basic metrics
    portfolio_value: float
    total_pnl: float
    total_pnl_percent: float
    
    # Value at Risk
    var_95_daily: float
    var_99_daily: float
    var_95_weekly: float
    cvar_95: float  # Conditional VaR
    
    # Ratios
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    
    # Drawdown
    current_drawdown: float
    max_drawdown: float
    max_drawdown_duration: int  # days
    
    # Volatility
    daily_volatility: float
    annualized_volatility: float
    beta: float  # vs benchmark
    
    # Concentration
    herfindahl_index: float  # Concentration measure
    diversification_score: float  # 0-100
    top_position_weight: float
    
    # Risk level
    risk_level: RiskLevel
    risk_score: int  # 0-100
    warnings: List[str] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        return {
            "portfolio_value": self.portfolio_value,
            "pnl": f"${self.total_pnl:+,.2f} ({self.total_pnl_percent:+.1%})",
            "var_95_daily": f"${self.var_95_daily:,.2f}",
            "var_99_daily": f"${self.var_99_daily:,.2f}",
            "sharpe_ratio": round(self.sharpe_ratio, 2),
            "sortino_ratio": round(self.sortino_ratio, 2),
            "max_drawdown": f"{self.max_drawdown:.1%}",
            "current_drawdown": f"{self.current_drawdown:.1%}",
            "volatility_annual": f"{self.annualized_volatility:.1%}",
            "diversification": f"{self.diversification_score:.0f}/100",
            "risk_level": self.risk_level.value,
            "risk_score": self.risk_score,
            "warnings": self.warnings
        }


@dataclass
class PositionSizeResult:
    """Position sizing calculation result"""
    asset: str
    quantity: float
    value_usd: float
    risk_amount: float
    risk_percent: float
    stop_loss_price: float
    take_profit_price: Optional[float]
    leverage: float
    kelly_fraction: float
    method: str
    warnings: List[str] = field(default_factory=list)


@dataclass
class StressScenario:
    """Stress test scenario result"""
    name: str
    description: str
    market_change: float  # e.g., -0.30 for -30%
    portfolio_impact: float
    portfolio_value_after: float
    positions_at_risk: List[str]
    margin_call_risk: bool


@dataclass
class CorrelationResult:
    """Correlation analysis result"""
    matrix: Dict[str, Dict[str, float]]
    highest_correlation: Tuple[str, str, float]
    lowest_correlation: Tuple[str, str, float]
    avg_correlation: float
    diversification_score: float
    recommendations: List[str]


class RiskCalculator:
    """
    Advanced Portfolio Risk Calculator for K.I.T.
    
    Calculates VaR, Sharpe ratio, position sizing, and more.
    """
    
    # Z-scores for confidence levels
    Z_SCORES = {
        0.90: 1.282,
        0.95: 1.645,
        0.99: 2.326
    }
    
    # Risk-free rate (approximate)
    RISK_FREE_RATE = 0.05  # 5% annual
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        
        # Risk limits
        self.max_var = self.config.get("max_portfolio_var", 0.05)
        self.max_position = self.config.get("max_position_size", 0.20)
        self.max_correlation = self.config.get("max_correlation", 0.85)
        self.default_risk = self.config.get("default_risk_per_trade", 0.02)
        self.kelly_fraction = self.config.get("kelly_fraction", 0.25)
        
        logger.info("⚠️ Risk Calculator initialized")
    
    async def analyze_portfolio(
        self,
        positions: List[Position],
        returns: Optional[List[float]] = None,
        benchmark_returns: Optional[List[float]] = None
    ) -> RiskMetrics:
        """
        Comprehensive portfolio risk analysis
        
        Args:
            positions: List of portfolio positions
            returns: Historical daily returns (if available)
            benchmark_returns: Benchmark returns for beta calculation
            
        Returns:
            RiskMetrics with full risk analysis
        """
        logger.info("📊 Analyzing portfolio risk...")
        
        # Portfolio basics
        portfolio_value = sum(p.value_usd for p in positions)
        total_pnl = sum(p.pnl for p in positions)
        total_pnl_percent = total_pnl / (portfolio_value - total_pnl) if portfolio_value > total_pnl else 0
        
        # Position weights
        weights = [p.value_usd / portfolio_value for p in positions] if portfolio_value > 0 else []
        
        # Generate mock returns if not provided
        if not returns:
            returns = self._generate_mock_returns(90)  # 90 days
        
        if not benchmark_returns:
            benchmark_returns = self._generate_mock_returns(90, volatility=0.02)
        
        # Calculate volatility
        daily_vol = self._calculate_volatility(returns)
        annual_vol = daily_vol * math.sqrt(252)
        
        # Value at Risk
        var_95_daily = self._calculate_var(portfolio_value, daily_vol, 0.95)
        var_99_daily = self._calculate_var(portfolio_value, daily_vol, 0.99)
        var_95_weekly = self._calculate_var(portfolio_value, daily_vol, 0.95, days=5)
        cvar_95 = self._calculate_cvar(portfolio_value, returns, 0.95)
        
        # Performance ratios
        avg_return = sum(returns) / len(returns) if returns else 0
        sharpe = self._calculate_sharpe(returns, daily_vol)
        sortino = self._calculate_sortino(returns)
        
        # Drawdown analysis
        max_dd, current_dd, dd_duration = self._calculate_drawdown(returns)
        calmar = abs(avg_return * 252 / max_dd) if max_dd != 0 else 0
        
        # Beta
        beta = self._calculate_beta(returns, benchmark_returns)
        
        # Concentration metrics
        hhi = sum(w ** 2 for w in weights) if weights else 0
        diversification = max(0, 100 * (1 - hhi))  # Higher is better
        top_weight = max(weights) if weights else 0
        
        # Determine risk level
        risk_score, risk_level, warnings = self._assess_risk_level(
            var_95_daily / portfolio_value if portfolio_value > 0 else 0,
            max_dd,
            current_dd,
            sharpe,
            diversification,
            top_weight
        )
        
        return RiskMetrics(
            portfolio_value=portfolio_value,
            total_pnl=total_pnl,
            total_pnl_percent=total_pnl_percent,
            var_95_daily=var_95_daily,
            var_99_daily=var_99_daily,
            var_95_weekly=var_95_weekly,
            cvar_95=cvar_95,
            sharpe_ratio=sharpe,
            sortino_ratio=sortino,
            calmar_ratio=calmar,
            current_drawdown=current_dd,
            max_drawdown=max_dd,
            max_drawdown_duration=dd_duration,
            daily_volatility=daily_vol,
            annualized_volatility=annual_vol,
            beta=beta,
            herfindahl_index=hhi,
            diversification_score=diversification,
            top_position_weight=top_weight,
            risk_level=risk_level,
            risk_score=risk_score,
            warnings=warnings
        )
    
    def calculate_position_size(
        self,
        portfolio_value: float,
        entry_price: float,
        stop_loss: float,
        risk_per_trade: float = None,
        take_profit: float = None,
        win_rate: float = 0.55,
        leverage: float = 1.0
    ) -> PositionSizeResult:
        """
        Calculate optimal position size
        
        Args:
            portfolio_value: Total portfolio value
            entry_price: Entry price for trade
            stop_loss: Stop loss price
            risk_per_trade: Risk per trade (default: 2%)
            take_profit: Take profit price (optional)
            win_rate: Historical win rate for Kelly
            leverage: Leverage to use
            
        Returns:
            PositionSizeResult with sizing details
        """
        risk_per_trade = risk_per_trade or self.default_risk
        
        # Calculate risk per unit
        risk_per_unit = abs(entry_price - stop_loss) / entry_price
        
        if risk_per_unit == 0:
            raise ValueError("Stop loss cannot equal entry price")
        
        # Fixed risk position sizing
        risk_amount = portfolio_value * risk_per_trade
        position_value = risk_amount / risk_per_unit
        quantity = position_value / entry_price
        
        # Apply leverage
        position_value_leveraged = position_value * leverage
        quantity_leveraged = quantity * leverage
        
        # Kelly Criterion
        if take_profit:
            reward_per_unit = abs(take_profit - entry_price) / entry_price
            win_loss_ratio = reward_per_unit / risk_per_unit
            kelly = self._kelly_criterion(win_rate, win_loss_ratio)
        else:
            kelly = self._kelly_criterion(win_rate, 1.5)  # Assume 1.5:1 R:R
        
        # Conservative Kelly (use fraction)
        conservative_kelly = kelly * self.kelly_fraction
        kelly_position = portfolio_value * conservative_kelly
        
        # Warnings
        warnings = []
        
        if position_value > portfolio_value * self.max_position:
            warnings.append(f"Position exceeds {self.max_position:.0%} limit")
        
        if leverage > 5:
            warnings.append("High leverage - increased liquidation risk")
        
        if risk_per_unit > 0.10:
            warnings.append("Wide stop loss - consider tighter risk management")
        
        return PositionSizeResult(
            asset="",  # To be filled by caller
            quantity=quantity_leveraged,
            value_usd=position_value_leveraged,
            risk_amount=risk_amount,
            risk_percent=risk_per_trade,
            stop_loss_price=stop_loss,
            take_profit_price=take_profit,
            leverage=leverage,
            kelly_fraction=conservative_kelly,
            method="Fixed Fractional Risk",
            warnings=warnings
        )
    
    async def correlation_matrix(
        self,
        assets: List[str],
        returns_data: Optional[Dict[str, List[float]]] = None,
        days: int = 90
    ) -> CorrelationResult:
        """
        Calculate correlation matrix for assets
        
        Args:
            assets: List of asset symbols
            returns_data: Historical returns per asset
            days: Lookback period
            
        Returns:
            CorrelationResult with matrix and analysis
        """
        logger.info(f"📈 Calculating correlation for {len(assets)} assets...")
        
        # Generate mock returns if not provided
        if not returns_data:
            returns_data = {}
            base_returns = self._generate_mock_returns(days)
            for i, asset in enumerate(assets):
                # Add some variation but keep correlation
                noise = [r * (0.7 + 0.3 * (i / len(assets))) + 
                         (self._random_normal() * 0.005) for r in base_returns]
                returns_data[asset] = noise
        
        # Calculate correlation matrix
        matrix: Dict[str, Dict[str, float]] = {}
        
        for asset1 in assets:
            matrix[asset1] = {}
            for asset2 in assets:
                if asset1 == asset2:
                    matrix[asset1][asset2] = 1.0
                else:
                    corr = self._calculate_correlation(
                        returns_data[asset1],
                        returns_data[asset2]
                    )
                    matrix[asset1][asset2] = round(corr, 3)
        
        # Find highest and lowest correlations
        highest = ("", "", -1.0)
        lowest = ("", "", 1.0)
        all_corrs = []
        
        for i, asset1 in enumerate(assets):
            for j, asset2 in enumerate(assets):
                if i < j:  # Upper triangle only
                    corr = matrix[asset1][asset2]
                    all_corrs.append(corr)
                    if corr > highest[2]:
                        highest = (asset1, asset2, corr)
                    if corr < lowest[2]:
                        lowest = (asset1, asset2, corr)
        
        avg_corr = sum(all_corrs) / len(all_corrs) if all_corrs else 0
        
        # Diversification score (lower avg correlation = better)
        div_score = max(0, 100 * (1 - avg_corr))
        
        # Recommendations
        recommendations = []
        if avg_corr > 0.7:
            recommendations.append("High correlation - consider adding uncorrelated assets")
        if highest[2] > self.max_correlation:
            recommendations.append(f"Very high correlation between {highest[0]} and {highest[1]}")
        if div_score < 40:
            recommendations.append("Low diversification - portfolio moves together")
        if div_score > 70:
            recommendations.append("Good diversification achieved")
        
        return CorrelationResult(
            matrix=matrix,
            highest_correlation=highest,
            lowest_correlation=lowest,
            avg_correlation=avg_corr,
            diversification_score=div_score,
            recommendations=recommendations
        )
    
    async def stress_test(
        self,
        positions: List[Position],
        custom_scenarios: Optional[List[Dict]] = None
    ) -> List[StressScenario]:
        """
        Run stress test scenarios on portfolio
        
        Args:
            positions: Current portfolio positions
            custom_scenarios: Custom scenarios to test
            
        Returns:
            List of StressScenario results
        """
        logger.info("⚡ Running stress tests...")
        
        portfolio_value = sum(p.value_usd for p in positions)
        
        # Default scenarios
        scenarios = [
            {"name": "Flash Crash (-10%)", "change": -0.10, "desc": "Sudden 10% market drop"},
            {"name": "Correction (-20%)", "change": -0.20, "desc": "Standard market correction"},
            {"name": "Bear Market (-30%)", "change": -0.30, "desc": "Prolonged bear market"},
            {"name": "Crash (-50%)", "change": -0.50, "desc": "Major market crash (2020 COVID)"},
            {"name": "Black Swan (-70%)", "change": -0.70, "desc": "Extreme tail event"},
            {"name": "Rally (+20%)", "change": 0.20, "desc": "Strong market rally"},
            {"name": "Blow-off Top (+50%)", "change": 0.50, "desc": "Parabolic move up"},
        ]
        
        if custom_scenarios:
            scenarios.extend(custom_scenarios)
        
        results = []
        
        for scenario in scenarios:
            change = scenario["change"]
            
            # Calculate impact (simplified - assumes 1:1 beta for all assets)
            impact = portfolio_value * change
            value_after = portfolio_value + impact
            
            # Identify positions at risk
            at_risk = []
            for p in positions:
                if change < 0 and p.weight > 0.15:  # Large positions
                    at_risk.append(p.asset)
            
            # Check margin call risk (simplified)
            margin_risk = change < -0.30 and any(p.weight > 0.25 for p in positions)
            
            results.append(StressScenario(
                name=scenario["name"],
                description=scenario["desc"],
                market_change=change,
                portfolio_impact=impact,
                portfolio_value_after=value_after,
                positions_at_risk=at_risk,
                margin_call_risk=margin_risk
            ))
        
        return results
    
    # === Helper Methods ===
    
    def _calculate_var(
        self,
        portfolio_value: float,
        volatility: float,
        confidence: float,
        days: int = 1
    ) -> float:
        """Calculate Value at Risk"""
        z_score = self.Z_SCORES.get(confidence, 1.645)
        return portfolio_value * z_score * volatility * math.sqrt(days)
    
    def _calculate_cvar(
        self,
        portfolio_value: float,
        returns: List[float],
        confidence: float
    ) -> float:
        """Calculate Conditional VaR (Expected Shortfall)"""
        if not returns:
            return 0
            
        sorted_returns = sorted(returns)
        cutoff_idx = int(len(sorted_returns) * (1 - confidence))
        tail_returns = sorted_returns[:max(cutoff_idx, 1)]
        avg_tail = sum(tail_returns) / len(tail_returns)
        return abs(portfolio_value * avg_tail)
    
    def _calculate_volatility(self, returns: List[float]) -> float:
        """Calculate standard deviation of returns"""
        if len(returns) < 2:
            return 0
            
        mean = sum(returns) / len(returns)
        variance = sum((r - mean) ** 2 for r in returns) / (len(returns) - 1)
        return math.sqrt(variance)
    
    def _calculate_sharpe(self, returns: List[float], volatility: float) -> float:
        """Calculate Sharpe Ratio"""
        if volatility == 0 or not returns:
            return 0
            
        avg_return = sum(returns) / len(returns)
        daily_rf = self.RISK_FREE_RATE / 252
        excess_return = avg_return - daily_rf
        
        # Annualize
        annual_excess = excess_return * 252
        annual_vol = volatility * math.sqrt(252)
        
        return annual_excess / annual_vol if annual_vol > 0 else 0
    
    def _calculate_sortino(self, returns: List[float]) -> float:
        """Calculate Sortino Ratio (downside deviation only)"""
        if not returns:
            return 0
            
        daily_rf = self.RISK_FREE_RATE / 252
        excess_returns = [r - daily_rf for r in returns]
        negative_returns = [r for r in excess_returns if r < 0]
        
        if not negative_returns:
            return float('inf')  # No negative returns
        
        downside_var = sum(r ** 2 for r in negative_returns) / len(negative_returns)
        downside_dev = math.sqrt(downside_var)
        
        avg_excess = sum(excess_returns) / len(excess_returns)
        annual_excess = avg_excess * 252
        annual_downside = downside_dev * math.sqrt(252)
        
        return annual_excess / annual_downside if annual_downside > 0 else 0
    
    def _calculate_drawdown(
        self,
        returns: List[float]
    ) -> Tuple[float, float, int]:
        """Calculate max drawdown, current drawdown, and duration"""
        if not returns:
            return 0, 0, 0
        
        # Convert returns to cumulative returns
        cumulative = [1.0]
        for r in returns:
            cumulative.append(cumulative[-1] * (1 + r))
        
        # Calculate drawdowns
        peak = cumulative[0]
        max_dd = 0
        current_dd = 0
        dd_start = 0
        max_dd_duration = 0
        
        for i, value in enumerate(cumulative):
            if value > peak:
                peak = value
                dd_start = i
            
            dd = (peak - value) / peak
            if dd > max_dd:
                max_dd = dd
                max_dd_duration = i - dd_start
            
            current_dd = dd
        
        return max_dd, current_dd, max_dd_duration
    
    def _calculate_beta(
        self,
        returns: List[float],
        benchmark_returns: List[float]
    ) -> float:
        """Calculate beta vs benchmark"""
        if len(returns) != len(benchmark_returns) or len(returns) < 2:
            return 1.0
        
        # Covariance
        mean_r = sum(returns) / len(returns)
        mean_b = sum(benchmark_returns) / len(benchmark_returns)
        
        covar = sum((r - mean_r) * (b - mean_b) 
                    for r, b in zip(returns, benchmark_returns)) / (len(returns) - 1)
        
        # Benchmark variance
        bench_var = sum((b - mean_b) ** 2 for b in benchmark_returns) / (len(benchmark_returns) - 1)
        
        return covar / bench_var if bench_var > 0 else 1.0
    
    def _calculate_correlation(
        self,
        returns1: List[float],
        returns2: List[float]
    ) -> float:
        """Calculate correlation between two return series"""
        if len(returns1) != len(returns2) or len(returns1) < 2:
            return 0
        
        mean1 = sum(returns1) / len(returns1)
        mean2 = sum(returns2) / len(returns2)
        
        # Covariance
        covar = sum((r1 - mean1) * (r2 - mean2) 
                    for r1, r2 in zip(returns1, returns2)) / (len(returns1) - 1)
        
        # Standard deviations
        std1 = math.sqrt(sum((r - mean1) ** 2 for r in returns1) / (len(returns1) - 1))
        std2 = math.sqrt(sum((r - mean2) ** 2 for r in returns2) / (len(returns2) - 1))
        
        if std1 == 0 or std2 == 0:
            return 0
        
        return covar / (std1 * std2)
    
    def _kelly_criterion(self, win_rate: float, win_loss_ratio: float) -> float:
        """Calculate Kelly Criterion optimal bet fraction"""
        # f* = (p * b - q) / b
        # p = win rate, q = 1 - p, b = win/loss ratio
        q = 1 - win_rate
        kelly = (win_rate * win_loss_ratio - q) / win_loss_ratio
        return max(0, min(kelly, 1))  # Clamp to [0, 1]
    
    def _assess_risk_level(
        self,
        var_ratio: float,
        max_dd: float,
        current_dd: float,
        sharpe: float,
        diversification: float,
        top_weight: float
    ) -> Tuple[int, RiskLevel, List[str]]:
        """Assess overall risk level"""
        warnings = []
        score = 50  # Start neutral
        
        # VaR impact
        if var_ratio > 0.10:
            score += 20
            warnings.append(f"High VaR ({var_ratio:.1%} daily)")
        elif var_ratio > 0.05:
            score += 10
        elif var_ratio < 0.02:
            score -= 10
        
        # Drawdown impact
        if current_dd > 0.20:
            score += 25
            warnings.append(f"Deep drawdown ({current_dd:.1%})")
        elif current_dd > 0.10:
            score += 15
            warnings.append(f"Significant drawdown ({current_dd:.1%})")
        
        if max_dd > 0.30:
            score += 10
            warnings.append(f"Historical max drawdown severe ({max_dd:.1%})")
        
        # Sharpe impact
        if sharpe < 0:
            score += 15
            warnings.append("Negative Sharpe ratio")
        elif sharpe < 0.5:
            score += 10
            warnings.append("Low Sharpe ratio (<0.5)")
        elif sharpe > 2:
            score -= 15
        elif sharpe > 1:
            score -= 5
        
        # Diversification impact
        if diversification < 30:
            score += 15
            warnings.append("Poor diversification")
        elif diversification > 70:
            score -= 10
        
        # Concentration impact
        if top_weight > 0.50:
            score += 20
            warnings.append(f"High concentration ({top_weight:.0%} in one asset)")
        elif top_weight > 0.30:
            score += 10
        
        # Clamp score
        score = max(0, min(100, score))
        
        # Determine level
        if score >= 75:
            level = RiskLevel.CRITICAL
        elif score >= 55:
            level = RiskLevel.HIGH
        elif score >= 35:
            level = RiskLevel.MEDIUM
        else:
            level = RiskLevel.LOW
        
        return score, level, warnings
    
    def _generate_mock_returns(
        self,
        days: int,
        volatility: float = 0.025
    ) -> List[float]:
        """Generate mock daily returns"""
        import random
        returns = []
        for _ in range(days):
            # Normal-ish distribution
            r = self._random_normal() * volatility
            returns.append(r)
        return returns
    
    def _random_normal(self) -> float:
        """Box-Muller transform for normal distribution"""
        import random
        u1 = random.random()
        u2 = random.random()
        return math.sqrt(-2 * math.log(u1)) * math.cos(2 * math.pi * u2)
    
    async def generate_report(
        self,
        positions: List[Position]
    ) -> str:
        """Generate risk report"""
        metrics = await self.analyze_portfolio(positions)
        
        report = []
        report.append("⚠️ K.I.T. Risk Report")
        report.append("=" * 50)
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        report.append("")
        
        report.append(f"📊 Portfolio Value: ${metrics.portfolio_value:,.2f}")
        report.append(f"P&L: ${metrics.total_pnl:+,.2f} ({metrics.total_pnl_percent:+.1%})")
        report.append("")
        
        report.append("📉 VALUE AT RISK")
        report.append("-" * 30)
        report.append(f"Daily VaR (95%):  ${metrics.var_95_daily:,.2f}")
        report.append(f"Daily VaR (99%):  ${metrics.var_99_daily:,.2f}")
        report.append(f"Weekly VaR (95%): ${metrics.var_95_weekly:,.2f}")
        report.append("")
        
        report.append("📈 PERFORMANCE RATIOS")
        report.append("-" * 30)
        report.append(f"Sharpe Ratio:  {metrics.sharpe_ratio:.2f}")
        report.append(f"Sortino Ratio: {metrics.sortino_ratio:.2f}")
        report.append(f"Calmar Ratio:  {metrics.calmar_ratio:.2f}")
        report.append("")
        
        report.append("📊 DRAWDOWN")
        report.append("-" * 30)
        report.append(f"Current:  {metrics.current_drawdown:.1%}")
        report.append(f"Maximum:  {metrics.max_drawdown:.1%}")
        report.append(f"Duration: {metrics.max_drawdown_duration} days")
        report.append("")
        
        report.append("🎯 RISK ASSESSMENT")
        report.append("-" * 30)
        report.append(f"Risk Score: {metrics.risk_score}/100")
        report.append(f"Risk Level: {metrics.risk_level.value.upper()}")
        report.append(f"Diversification: {metrics.diversification_score:.0f}/100")
        report.append("")
        
        if metrics.warnings:
            report.append("⚠️ WARNINGS")
            report.append("-" * 30)
            for w in metrics.warnings:
                report.append(f"• {w}")
        
        return "\n".join(report)


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("⚠️ K.I.T. Risk Calculator Demo")
        print("=" * 50)
        
        calc = RiskCalculator()
        
        # Sample positions
        positions = [
            Position("BTC", 0.5, 48000, 50000, 25000, 1000, 0.04, 0.55),
            Position("ETH", 5.0, 2800, 3000, 15000, 1000, 0.07, 0.33),
            Position("SOL", 100, 90, 100, 10000, 1000, 0.11, 0.22),
        ]
        
        # Portfolio analysis
        risk = await calc.analyze_portfolio(positions)
        print("\n📊 Risk Metrics:")
        print(f"  Portfolio: ${risk.portfolio_value:,.2f}")
        print(f"  VaR (95%): ${risk.var_95_daily:,.2f}")
        print(f"  Sharpe: {risk.sharpe_ratio:.2f}")
        print(f"  Max DD: {risk.max_drawdown:.1%}")
        print(f"  Risk Level: {risk.risk_level.value}")
        
        # Position sizing
        print("\n🎯 Position Sizing:")
        size = calc.calculate_position_size(
            portfolio_value=50000,
            entry_price=50000,
            stop_loss=48000,
            risk_per_trade=0.02,
            take_profit=55000
        )
        print(f"  Quantity: {size.quantity:.4f}")
        print(f"  Value: ${size.value_usd:,.2f}")
        print(f"  Risk: ${size.risk_amount:,.2f} ({size.risk_percent:.0%})")
        print(f"  Kelly: {size.kelly_fraction:.1%}")
        
        # Correlation
        print("\n📈 Correlation:")
        corr = await calc.correlation_matrix(["BTC", "ETH", "SOL"])
        print(f"  BTC-ETH: {corr.matrix['BTC']['ETH']:.2f}")
        print(f"  Diversification: {corr.diversification_score:.0f}/100")
        
        # Stress test
        print("\n⚡ Stress Test:")
        scenarios = await calc.stress_test(positions)
        for s in scenarios[:3]:
            print(f"  {s.name}: ${s.portfolio_impact:+,.0f}")
        
        # Full report
        print("\n" + "=" * 50)
        report = await calc.generate_report(positions)
        print(report)
    
    asyncio.run(demo())
