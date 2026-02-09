"""
📊 K.I.T. Performance Report Generator
======================================
Generate comprehensive trading performance reports.

Features:
- Daily/weekly/monthly reports
- P&L analysis
- Trade statistics
- Insights and recommendations
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from typing import List, Dict, Optional, Tuple
from enum import Enum
import json

logger = logging.getLogger("kit.performance-report")


class ReportPeriod(Enum):
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    CUSTOM = "custom"


class TradeDirection(Enum):
    LONG = "long"
    SHORT = "short"


class TradeStatus(Enum):
    OPEN = "open"
    CLOSED = "closed"
    CANCELLED = "cancelled"


@dataclass
class Trade:
    """Individual trade record"""
    id: str
    asset: str
    direction: TradeDirection
    entry_time: datetime
    entry_price: float
    quantity: float
    exit_time: Optional[datetime] = None
    exit_price: Optional[float] = None
    pnl: float = 0
    pnl_percent: float = 0
    fees: float = 0
    status: TradeStatus = TradeStatus.OPEN
    strategy: str = "manual"
    notes: str = ""
    
    @property
    def is_winner(self) -> bool:
        return self.pnl > 0
    
    @property
    def duration(self) -> Optional[timedelta]:
        if self.exit_time:
            return self.exit_time - self.entry_time
        return None


@dataclass
class TradeStatistics:
    """Trading statistics summary"""
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    
    total_pnl: float
    realized_pnl: float
    unrealized_pnl: float
    fees_paid: float
    
    average_win: float
    average_loss: float
    largest_win: float
    largest_loss: float
    
    profit_factor: float
    expectancy: float
    
    average_hold_time: timedelta
    best_asset: str
    worst_asset: str
    
    def to_dict(self) -> dict:
        return {
            "total_trades": self.total_trades,
            "win_rate": f"{self.win_rate:.1%}",
            "total_pnl": f"${self.total_pnl:+,.2f}",
            "profit_factor": round(self.profit_factor, 2),
            "expectancy": f"${self.expectancy:+,.2f}",
            "average_win": f"${self.average_win:+,.2f}",
            "average_loss": f"${self.average_loss:+,.2f}",
            "best_asset": self.best_asset,
            "worst_asset": self.worst_asset
        }


@dataclass
class AssetPerformance:
    """Performance breakdown by asset"""
    asset: str
    total_pnl: float
    pnl_percent: float
    trade_count: int
    win_rate: float
    average_pnl: float


@dataclass
class TimeAnalysis:
    """Time-based performance analysis"""
    best_hour: int
    best_hour_pnl: float
    best_day: str
    best_day_pnl: float
    average_duration_winners: timedelta
    average_duration_losers: timedelta


@dataclass
class Insight:
    """Performance insight"""
    type: str  # "success", "warning", "tip"
    message: str
    priority: int = 1


@dataclass
class PerformanceReport:
    """Complete performance report"""
    period: ReportPeriod
    start_date: datetime
    end_date: datetime
    generated_at: datetime
    
    # Balances
    starting_balance: float
    ending_balance: float
    net_change: float
    net_change_percent: float
    
    # Statistics
    statistics: TradeStatistics
    
    # Breakdowns
    by_asset: List[AssetPerformance]
    by_strategy: Dict[str, float]
    
    # Time analysis
    time_analysis: TimeAnalysis
    
    # Top/bottom trades
    top_trades: List[Trade]
    worst_trades: List[Trade]
    
    # Insights
    insights: List[Insight]
    
    # Benchmark comparison
    benchmark_returns: Dict[str, float]
    
    def to_dict(self) -> dict:
        return {
            "period": self.period.value,
            "start": self.start_date.isoformat(),
            "end": self.end_date.isoformat(),
            "starting_balance": self.starting_balance,
            "ending_balance": self.ending_balance,
            "net_pnl": f"${self.net_change:+,.2f} ({self.net_change_percent:+.2%})",
            "statistics": self.statistics.to_dict(),
            "top_asset": self.by_asset[0].asset if self.by_asset else "N/A",
            "insights": [i.message for i in self.insights[:5]]
        }


class PerformanceReporter:
    """
    Performance Report Generator for K.I.T.
    
    Generates comprehensive trading performance reports
    with P&L analysis, statistics, and insights.
    """
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        
        # Mock trade history (in production, would load from database)
        self._trades: List[Trade] = []
        self._balance_history: Dict[date, float] = {}
        
        logger.info("📊 Performance Reporter initialized")
    
    async def generate(
        self,
        period: str = "weekly",
        start_date: datetime = None,
        end_date: datetime = None,
        include_open: bool = True
    ) -> PerformanceReport:
        """
        Generate performance report
        
        Args:
            period: Report period (daily, weekly, monthly, etc.)
            start_date: Custom start date
            end_date: Custom end date
            include_open: Include open positions in analysis
            
        Returns:
            PerformanceReport with full analysis
        """
        # Determine date range
        period_enum = ReportPeriod(period) if period != "custom" else ReportPeriod.CUSTOM
        start, end = self._get_date_range(period_enum, start_date, end_date)
        
        logger.info(f"📊 Generating {period} report: {start.date()} to {end.date()}")
        
        # Get trades for period
        trades = self._get_trades_for_period(start, end, include_open)
        
        # If no real trades, generate mock data for demo
        if not trades:
            trades = self._generate_mock_trades(period_enum)
        
        # Calculate statistics
        stats = self._calculate_statistics(trades)
        
        # Calculate balances
        starting_balance = self._get_balance_at(start) or 43500.0
        ending_balance = self._get_balance_at(end) or (starting_balance + stats.total_pnl)
        net_change = ending_balance - starting_balance
        net_change_pct = net_change / starting_balance if starting_balance > 0 else 0
        
        # Asset breakdown
        by_asset = self._calculate_asset_performance(trades)
        
        # Strategy breakdown
        by_strategy = self._calculate_strategy_performance(trades)
        
        # Time analysis
        time_analysis = self._analyze_timing(trades)
        
        # Top/worst trades
        closed_trades = [t for t in trades if t.status == TradeStatus.CLOSED]
        sorted_by_pnl = sorted(closed_trades, key=lambda t: t.pnl, reverse=True)
        top_trades = sorted_by_pnl[:5]
        worst_trades = sorted_by_pnl[-5:][::-1]
        
        # Generate insights
        insights = self._generate_insights(stats, by_asset, time_analysis, trades)
        
        # Benchmark comparison
        benchmarks = await self._get_benchmark_returns(start, end)
        
        return PerformanceReport(
            period=period_enum,
            start_date=start,
            end_date=end,
            generated_at=datetime.now(),
            starting_balance=starting_balance,
            ending_balance=ending_balance,
            net_change=net_change,
            net_change_percent=net_change_pct,
            statistics=stats,
            by_asset=by_asset,
            by_strategy=by_strategy,
            time_analysis=time_analysis,
            top_trades=top_trades,
            worst_trades=worst_trades,
            insights=insights,
            benchmark_returns=benchmarks
        )
    
    def _get_date_range(
        self,
        period: ReportPeriod,
        start: datetime = None,
        end: datetime = None
    ) -> Tuple[datetime, datetime]:
        """Get date range for period"""
        now = datetime.now()
        
        if period == ReportPeriod.CUSTOM and start and end:
            return start, end
        
        if period == ReportPeriod.DAILY:
            start = now.replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == ReportPeriod.WEEKLY:
            # Start of week (Monday)
            start = now - timedelta(days=now.weekday())
            start = start.replace(hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == ReportPeriod.MONTHLY:
            start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == ReportPeriod.QUARTERLY:
            quarter = (now.month - 1) // 3
            start = now.replace(month=quarter * 3 + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
            end = now
        elif period == ReportPeriod.YEARLY:
            start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            end = now
        else:
            # Default to last 7 days
            start = now - timedelta(days=7)
            end = now
        
        return start, end
    
    def _get_trades_for_period(
        self,
        start: datetime,
        end: datetime,
        include_open: bool
    ) -> List[Trade]:
        """Get trades within date range"""
        trades = []
        for trade in self._trades:
            # Include if entry is in range or if it's an open position
            if trade.entry_time >= start and trade.entry_time <= end:
                trades.append(trade)
            elif include_open and trade.status == TradeStatus.OPEN:
                trades.append(trade)
        return trades
    
    def _calculate_statistics(self, trades: List[Trade]) -> TradeStatistics:
        """Calculate comprehensive trading statistics"""
        if not trades:
            return TradeStatistics(
                total_trades=0, winning_trades=0, losing_trades=0, win_rate=0,
                total_pnl=0, realized_pnl=0, unrealized_pnl=0, fees_paid=0,
                average_win=0, average_loss=0, largest_win=0, largest_loss=0,
                profit_factor=0, expectancy=0, average_hold_time=timedelta(0),
                best_asset="N/A", worst_asset="N/A"
            )
        
        closed = [t for t in trades if t.status == TradeStatus.CLOSED]
        open_trades = [t for t in trades if t.status == TradeStatus.OPEN]
        
        winners = [t for t in closed if t.is_winner]
        losers = [t for t in closed if not t.is_winner and t.pnl != 0]
        
        # Basic counts
        total = len(closed)
        winning = len(winners)
        losing = len(losers)
        win_rate = winning / total if total > 0 else 0
        
        # P&L
        realized_pnl = sum(t.pnl for t in closed)
        unrealized_pnl = sum(t.pnl for t in open_trades)
        total_pnl = realized_pnl + unrealized_pnl
        fees = sum(t.fees for t in trades)
        
        # Win/loss averages
        avg_win = sum(t.pnl for t in winners) / len(winners) if winners else 0
        avg_loss = sum(t.pnl for t in losers) / len(losers) if losers else 0
        largest_win = max((t.pnl for t in winners), default=0)
        largest_loss = min((t.pnl for t in losers), default=0)
        
        # Profit factor
        gross_profit = sum(t.pnl for t in winners)
        gross_loss = abs(sum(t.pnl for t in losers))
        profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf') if gross_profit > 0 else 0
        
        # Expectancy
        expectancy = (win_rate * avg_win) - ((1 - win_rate) * abs(avg_loss)) if total > 0 else 0
        
        # Average hold time
        durations = [t.duration for t in closed if t.duration]
        avg_duration = sum(durations, timedelta()) / len(durations) if durations else timedelta(0)
        
        # Best/worst asset
        asset_pnl = {}
        for t in closed:
            asset_pnl[t.asset] = asset_pnl.get(t.asset, 0) + t.pnl
        
        best_asset = max(asset_pnl, key=asset_pnl.get) if asset_pnl else "N/A"
        worst_asset = min(asset_pnl, key=asset_pnl.get) if asset_pnl else "N/A"
        
        return TradeStatistics(
            total_trades=total,
            winning_trades=winning,
            losing_trades=losing,
            win_rate=win_rate,
            total_pnl=total_pnl,
            realized_pnl=realized_pnl,
            unrealized_pnl=unrealized_pnl,
            fees_paid=fees,
            average_win=avg_win,
            average_loss=avg_loss,
            largest_win=largest_win,
            largest_loss=largest_loss,
            profit_factor=profit_factor,
            expectancy=expectancy,
            average_hold_time=avg_duration,
            best_asset=best_asset,
            worst_asset=worst_asset
        )
    
    def _calculate_asset_performance(self, trades: List[Trade]) -> List[AssetPerformance]:
        """Calculate performance breakdown by asset"""
        asset_data = {}
        
        for trade in trades:
            if trade.asset not in asset_data:
                asset_data[trade.asset] = {"pnl": 0, "trades": 0, "winners": 0, "total_value": 0}
            
            asset_data[trade.asset]["pnl"] += trade.pnl
            asset_data[trade.asset]["trades"] += 1
            asset_data[trade.asset]["total_value"] += trade.entry_price * trade.quantity
            if trade.is_winner:
                asset_data[trade.asset]["winners"] += 1
        
        results = []
        for asset, data in asset_data.items():
            pnl_pct = data["pnl"] / data["total_value"] if data["total_value"] > 0 else 0
            win_rate = data["winners"] / data["trades"] if data["trades"] > 0 else 0
            avg_pnl = data["pnl"] / data["trades"] if data["trades"] > 0 else 0
            
            results.append(AssetPerformance(
                asset=asset,
                total_pnl=data["pnl"],
                pnl_percent=pnl_pct,
                trade_count=data["trades"],
                win_rate=win_rate,
                average_pnl=avg_pnl
            ))
        
        # Sort by P&L
        results.sort(key=lambda x: x.total_pnl, reverse=True)
        return results
    
    def _calculate_strategy_performance(self, trades: List[Trade]) -> Dict[str, float]:
        """Calculate performance by strategy"""
        strategy_pnl = {}
        for trade in trades:
            strategy = trade.strategy or "manual"
            strategy_pnl[strategy] = strategy_pnl.get(strategy, 0) + trade.pnl
        return strategy_pnl
    
    def _analyze_timing(self, trades: List[Trade]) -> TimeAnalysis:
        """Analyze trading performance by time"""
        hour_pnl = {}
        day_pnl = {}
        winner_durations = []
        loser_durations = []
        
        for trade in trades:
            if trade.status != TradeStatus.CLOSED:
                continue
            
            hour = trade.entry_time.hour
            day = trade.entry_time.strftime("%A")
            
            hour_pnl[hour] = hour_pnl.get(hour, 0) + trade.pnl
            day_pnl[day] = day_pnl.get(day, 0) + trade.pnl
            
            if trade.duration:
                if trade.is_winner:
                    winner_durations.append(trade.duration)
                else:
                    loser_durations.append(trade.duration)
        
        best_hour = max(hour_pnl, key=hour_pnl.get) if hour_pnl else 12
        best_hour_pnl = hour_pnl.get(best_hour, 0)
        best_day = max(day_pnl, key=day_pnl.get) if day_pnl else "Monday"
        best_day_pnl = day_pnl.get(best_day, 0)
        
        avg_winner_dur = sum(winner_durations, timedelta()) / len(winner_durations) if winner_durations else timedelta(hours=4)
        avg_loser_dur = sum(loser_durations, timedelta()) / len(loser_durations) if loser_durations else timedelta(hours=2)
        
        return TimeAnalysis(
            best_hour=best_hour,
            best_hour_pnl=best_hour_pnl,
            best_day=best_day,
            best_day_pnl=best_day_pnl,
            average_duration_winners=avg_winner_dur,
            average_duration_losers=avg_loser_dur
        )
    
    def _generate_insights(
        self,
        stats: TradeStatistics,
        by_asset: List[AssetPerformance],
        time_analysis: TimeAnalysis,
        trades: List[Trade]
    ) -> List[Insight]:
        """Generate actionable insights"""
        insights = []
        
        # Win rate insights
        if stats.win_rate >= 0.6:
            insights.append(Insight("success", f"Strong win rate ({stats.win_rate:.0%}) - keep it up!", 1))
        elif stats.win_rate < 0.4:
            insights.append(Insight("warning", f"Low win rate ({stats.win_rate:.0%}) - review trade selection", 2))
        
        # Profit factor
        if stats.profit_factor > 2:
            insights.append(Insight("success", f"Excellent profit factor ({stats.profit_factor:.2f})", 1))
        elif stats.profit_factor < 1:
            insights.append(Insight("warning", "Profit factor below 1 - losing money on average", 3))
        
        # Risk/reward
        if stats.average_win > 0 and stats.average_loss < 0:
            rr_ratio = abs(stats.average_win / stats.average_loss)
            if rr_ratio < 1:
                insights.append(Insight("warning", f"Risk/reward ratio is low ({rr_ratio:.1f}:1) - let winners run", 2))
            elif rr_ratio > 2:
                insights.append(Insight("success", f"Great R:R ratio ({rr_ratio:.1f}:1)", 1))
        
        # Asset performance
        if by_asset and len(by_asset) > 1:
            best = by_asset[0]
            worst = by_asset[-1]
            if best.total_pnl > 0:
                insights.append(Insight("tip", f"{best.asset} is your best performer - consider increasing allocation", 2))
            if worst.total_pnl < 0:
                insights.append(Insight("warning", f"{worst.asset} is underperforming - review strategy", 2))
        
        # Timing insights
        insights.append(Insight("tip", f"Best trading hour: {time_analysis.best_hour}:00 UTC", 3))
        insights.append(Insight("tip", f"Best day: {time_analysis.best_day}", 3))
        
        # Hold time analysis
        winners_hold = time_analysis.average_duration_winners
        losers_hold = time_analysis.average_duration_losers
        if losers_hold > winners_hold:
            insights.append(Insight("warning", "Holding losers longer than winners - cut losses faster", 2))
        
        # Overall P&L
        if stats.total_pnl > 0:
            insights.append(Insight("success", f"Profitable period! Net P&L: ${stats.total_pnl:+,.2f}", 1))
        else:
            insights.append(Insight("warning", f"Net loss this period: ${stats.total_pnl:+,.2f}", 1))
        
        # Sort by priority
        insights.sort(key=lambda x: x.priority)
        
        return insights
    
    async def _get_benchmark_returns(
        self,
        start: datetime,
        end: datetime
    ) -> Dict[str, float]:
        """Get benchmark returns for comparison"""
        # Mock benchmark data
        days = (end - start).days
        return {
            "BTC": 0.05 + (days * 0.001),   # Mock ~5% + variance
            "ETH": 0.04 + (days * 0.0008),
            "SPY": 0.02 + (days * 0.0003),
        }
    
    def _get_balance_at(self, dt: datetime) -> Optional[float]:
        """Get balance at specific date"""
        return self._balance_history.get(dt.date())
    
    def _generate_mock_trades(self, period: ReportPeriod) -> List[Trade]:
        """Generate mock trades for demo"""
        import random
        
        now = datetime.now()
        
        if period == ReportPeriod.DAILY:
            num_trades = random.randint(3, 8)
            days_back = 1
        elif period == ReportPeriod.WEEKLY:
            num_trades = random.randint(15, 30)
            days_back = 7
        elif period == ReportPeriod.MONTHLY:
            num_trades = random.randint(40, 80)
            days_back = 30
        else:
            num_trades = 20
            days_back = 7
        
        assets = ["BTC", "ETH", "SOL", "AVAX", "LINK", "MATIC"]
        strategies = ["trend_follow", "mean_reversion", "breakout", "manual"]
        
        trades = []
        for i in range(num_trades):
            asset = random.choice(assets)
            direction = random.choice([TradeDirection.LONG, TradeDirection.SHORT])
            
            # Entry time within period
            hours_back = random.randint(1, days_back * 24)
            entry_time = now - timedelta(hours=hours_back)
            
            # Prices
            base_price = {"BTC": 50000, "ETH": 3000, "SOL": 100, "AVAX": 35, "LINK": 15, "MATIC": 0.8}
            price = base_price.get(asset, 100) * (1 + random.uniform(-0.05, 0.05))
            
            # 60% win rate
            is_winner = random.random() < 0.6
            
            if is_winner:
                pnl_pct = random.uniform(0.01, 0.08)  # 1-8% win
            else:
                pnl_pct = -random.uniform(0.005, 0.04)  # 0.5-4% loss
            
            quantity = random.uniform(100, 2000) / price
            pnl = quantity * price * pnl_pct
            
            # Exit time
            hold_hours = random.randint(1, 48)
            exit_time = entry_time + timedelta(hours=hold_hours)
            if exit_time > now:
                exit_time = now
            
            exit_price = price * (1 + pnl_pct) if direction == TradeDirection.LONG else price * (1 - pnl_pct)
            
            trades.append(Trade(
                id=f"trade_{i}",
                asset=asset,
                direction=direction,
                entry_time=entry_time,
                entry_price=price,
                quantity=quantity,
                exit_time=exit_time,
                exit_price=exit_price,
                pnl=pnl,
                pnl_percent=pnl_pct,
                fees=abs(pnl) * 0.001,  # 0.1% fees
                status=TradeStatus.CLOSED,
                strategy=random.choice(strategies)
            ))
        
        return trades
    
    async def export(
        self,
        report: PerformanceReport,
        format: str = "markdown",
        path: str = "./"
    ) -> str:
        """Export report to file"""
        filename = f"report_{report.period.value}_{report.end_date.strftime('%Y%m%d')}.{format}"
        filepath = f"{path}/{filename}"
        
        if format == "markdown":
            content = self._to_markdown(report)
        elif format == "json":
            content = json.dumps(report.to_dict(), indent=2)
        else:
            content = self._to_markdown(report)
        
        # In production, would write to file
        logger.info(f"📄 Exported report to {filepath}")
        
        return filepath
    
    def _to_markdown(self, report: PerformanceReport) -> str:
        """Convert report to markdown"""
        lines = []
        
        lines.append(f"# 📊 K.I.T. {report.period.value.title()} Performance Report")
        lines.append("")
        lines.append(f"**Period:** {report.start_date.strftime('%b %d')} - {report.end_date.strftime('%b %d, %Y')}")
        lines.append(f"**Generated:** {report.generated_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append("")
        
        lines.append("## 💰 P&L Summary")
        lines.append("")
        lines.append(f"| Metric | Value |")
        lines.append(f"|--------|-------|")
        lines.append(f"| Starting Balance | ${report.starting_balance:,.2f} |")
        lines.append(f"| Ending Balance | ${report.ending_balance:,.2f} |")
        lines.append(f"| Net P&L | ${report.net_change:+,.2f} ({report.net_change_percent:+.2%}) |")
        lines.append(f"| Fees Paid | ${report.statistics.fees_paid:,.2f} |")
        lines.append("")
        
        lines.append("## 📈 Trading Statistics")
        lines.append("")
        stats = report.statistics
        lines.append(f"| Metric | Value |")
        lines.append(f"|--------|-------|")
        lines.append(f"| Total Trades | {stats.total_trades} |")
        lines.append(f"| Win Rate | {stats.win_rate:.1%} |")
        lines.append(f"| Profit Factor | {stats.profit_factor:.2f} |")
        lines.append(f"| Expectancy | ${stats.expectancy:+,.2f}/trade |")
        lines.append(f"| Average Win | ${stats.average_win:+,.2f} |")
        lines.append(f"| Average Loss | ${stats.average_loss:+,.2f} |")
        lines.append("")
        
        if report.top_trades:
            lines.append("## 🏆 Top Trades")
            lines.append("")
            for t in report.top_trades[:3]:
                lines.append(f"- **{t.asset}** {t.direction.value}: ${t.pnl:+,.2f} ({t.pnl_percent:+.1%})")
            lines.append("")
        
        if report.insights:
            lines.append("## 💡 Insights")
            lines.append("")
            for i in report.insights[:5]:
                emoji = "✅" if i.type == "success" else "⚠️" if i.type == "warning" else "💡"
                lines.append(f"{emoji} {i.message}")
            lines.append("")
        
        return "\n".join(lines)
    
    async def generate_text_report(
        self,
        period: str = "weekly"
    ) -> str:
        """Generate plain text report for display"""
        report = await self.generate(period=period)
        
        lines = []
        lines.append(f"📊 K.I.T. {period.title()} Performance Report")
        lines.append("━" * 45)
        lines.append(f"Period: {report.start_date.strftime('%b %d')} - {report.end_date.strftime('%b %d, %Y')}")
        lines.append(f"Generated: {report.generated_at.strftime('%Y-%m-%d %H:%M')}")
        lines.append("")
        
        lines.append("💰 P&L SUMMARY")
        lines.append("━" * 45)
        lines.append(f"Starting Balance:   ${report.starting_balance:,.2f}")
        lines.append(f"Ending Balance:     ${report.ending_balance:,.2f}")
        lines.append(f"Net P&L:            ${report.net_change:+,.2f} ({report.net_change_percent:+.1%})")
        lines.append("")
        
        stats = report.statistics
        lines.append("📈 TRADING ACTIVITY")
        lines.append("━" * 45)
        lines.append(f"Total Trades:       {stats.total_trades}")
        lines.append(f"Winning Trades:     {stats.winning_trades} ({stats.win_rate:.0%})")
        lines.append(f"Losing Trades:      {stats.losing_trades}")
        
        wr_emoji = "✅" if stats.win_rate >= 0.5 else "⚠️"
        lines.append(f"Win Rate:           {stats.win_rate:.1%} {wr_emoji}")
        lines.append("")
        
        lines.append(f"Average Win:        ${stats.average_win:+,.2f}")
        lines.append(f"Average Loss:       ${stats.average_loss:+,.2f}")
        
        pf_emoji = "✅" if stats.profit_factor >= 1.5 else "⚠️" if stats.profit_factor >= 1 else "❌"
        lines.append(f"Profit Factor:      {stats.profit_factor:.2f} {pf_emoji}")
        lines.append(f"Expectancy:         ${stats.expectancy:+,.2f}/trade")
        lines.append("")
        
        if report.top_trades:
            lines.append("🏆 TOP PERFORMERS")
            lines.append("━" * 45)
            for i, t in enumerate(report.top_trades[:3], 1):
                lines.append(f"{i}. {t.asset} {t.direction.value.title()}: ${t.pnl:+,.2f} ({t.pnl_percent:+.1%})")
            lines.append("")
        
        if report.worst_trades and report.worst_trades[0].pnl < 0:
            lines.append("📉 WORST TRADES")
            lines.append("━" * 45)
            for i, t in enumerate(report.worst_trades[:2], 1):
                lines.append(f"{i}. {t.asset} {t.direction.value.title()}: ${t.pnl:+,.2f} ({t.pnl_percent:+.1%})")
            lines.append("")
        
        if report.by_asset:
            lines.append("📊 BY ASSET")
            lines.append("━" * 45)
            for asset in report.by_asset[:4]:
                lines.append(f"{asset.asset}: ${asset.total_pnl:+,.2f} ({asset.trade_count} trades, {asset.win_rate:.0%} win)")
            lines.append("")
        
        if report.insights:
            lines.append("💡 INSIGHTS")
            lines.append("━" * 45)
            for i in report.insights[:5]:
                emoji = "✅" if i.type == "success" else "⚠️" if i.type == "warning" else "💡"
                lines.append(f"{emoji} {i.message}")
            lines.append("")
        
        # Footer
        if report.statistics.total_pnl > 0:
            lines.append('"Another profitable period. Keep this up!" - K.I.T.')
        else:
            lines.append('"Every setback is a setup for a comeback." - K.I.T.')
        
        return "\n".join(lines)


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("📊 K.I.T. Performance Report Demo")
        print("=" * 50)
        
        reporter = PerformanceReporter()
        
        # Generate weekly report
        report = await reporter.generate_text_report("weekly")
        print(report)
    
    asyncio.run(demo())
