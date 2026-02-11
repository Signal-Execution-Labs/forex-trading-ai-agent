"""
💰 K.I.T. Tax Calculator
========================
Calculate tax implications of trades and generate tax reports.

Supports:
- Multiple tax methods (FIFO, LIFO, HIFO)
- Multiple jurisdictions (US, DE, UK, EU, CH, SG)
- Crypto, Forex, Stocks, Options
- DeFi transactions (swaps, LP, staking)
"""

import json
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
from decimal import Decimal, ROUND_HALF_UP
import random


class TaxMethod(Enum):
    FIFO = "fifo"      # First In, First Out
    LIFO = "lifo"      # Last In, First Out
    HIFO = "hifo"      # Highest In, First Out
    SPECIFIC = "specific"  # Specific Identification


class Jurisdiction(Enum):
    US = "us"          # United States (IRS)
    DE = "de"          # Germany
    UK = "uk"          # United Kingdom
    EU = "eu"          # European Union
    CH = "ch"          # Switzerland
    SG = "sg"          # Singapore


@dataclass
class TaxLot:
    """A tax lot representing an acquisition"""
    id: str
    asset: str
    quantity: float
    cost_basis: float
    acquisition_date: datetime
    acquisition_type: str = "purchase"  # purchase, mining, staking, airdrop
    remaining_quantity: float = None
    
    def __post_init__(self):
        if self.remaining_quantity is None:
            self.remaining_quantity = self.quantity
    
    @property
    def cost_per_unit(self) -> float:
        return self.cost_basis / self.quantity if self.quantity > 0 else 0


@dataclass
class Trade:
    """A trade/disposal for tax purposes"""
    id: str
    asset: str
    quantity: float
    proceeds: float
    disposal_date: datetime
    disposal_type: str = "sale"  # sale, swap, spend


@dataclass
class CapitalGain:
    """Calculated capital gain/loss"""
    trade_id: str
    asset: str
    quantity: float
    cost_basis: float
    proceeds: float
    gain_loss: float
    holding_period_days: int
    is_long_term: bool  # > 1 year for US
    acquisition_date: datetime
    disposal_date: datetime
    lot_id: str


@dataclass
class TaxSummary:
    """Tax summary for a period"""
    year: int
    jurisdiction: str
    method: str
    
    # Capital gains
    short_term_gains: float = 0
    short_term_losses: float = 0
    long_term_gains: float = 0
    long_term_losses: float = 0
    
    # Income
    staking_income: float = 0
    mining_income: float = 0
    airdrop_income: float = 0
    interest_income: float = 0
    
    # Totals
    total_proceeds: float = 0
    total_cost_basis: float = 0
    net_capital_gain: float = 0
    total_income: float = 0
    
    # Details
    num_transactions: int = 0
    gains: List[CapitalGain] = field(default_factory=list)


class TaxCalculator:
    """
    K.I.T. Tax Calculator
    
    Calculates capital gains using various methods and generates
    tax reports for different jurisdictions.
    """
    
    # Long-term threshold in days by jurisdiction
    LONG_TERM_THRESHOLDS = {
        "us": 365,      # 1 year
        "de": 365,      # 1 year (crypto), then tax-free
        "uk": 365,      # 1 year for CGT annual exemption
        "eu": 365,      # Varies by country
        "ch": 0,        # No capital gains tax for individuals
        "sg": 0,        # Generally tax-free
    }
    
    # Tax rates (simplified)
    SHORT_TERM_RATES = {
        "us": 0.37,     # Up to 37% (ordinary income)
        "de": 0.26,     # ~26% (Abgeltungsteuer)
        "uk": 0.20,     # 20% (higher rate)
        "eu": 0.25,     # Average
        "ch": 0.00,     # No CGT
        "sg": 0.00,     # No CGT
    }
    
    LONG_TERM_RATES = {
        "us": 0.20,     # Up to 20%
        "de": 0.00,     # Tax-free after 1 year
        "uk": 0.20,     # Same rate
        "eu": 0.15,     # Often reduced
        "ch": 0.00,
        "sg": 0.00,
    }
    
    def __init__(
        self,
        method: TaxMethod = TaxMethod.FIFO,
        jurisdiction: Jurisdiction = Jurisdiction.US
    ):
        self.method = method
        self.jurisdiction = jurisdiction
        self.lots: Dict[str, List[TaxLot]] = {}  # asset -> lots
        self.trades: List[Trade] = []
        self.gains: List[CapitalGain] = []
    
    def add_lot(self, lot: TaxLot) -> None:
        """Add a tax lot (acquisition)"""
        if lot.asset not in self.lots:
            self.lots[lot.asset] = []
        self.lots[lot.asset].append(lot)
        
        # Sort based on method
        self._sort_lots(lot.asset)
    
    def _sort_lots(self, asset: str) -> None:
        """Sort lots based on tax method"""
        lots = self.lots.get(asset, [])
        
        if self.method == TaxMethod.FIFO:
            lots.sort(key=lambda x: x.acquisition_date)
        elif self.method == TaxMethod.LIFO:
            lots.sort(key=lambda x: x.acquisition_date, reverse=True)
        elif self.method == TaxMethod.HIFO:
            lots.sort(key=lambda x: x.cost_per_unit, reverse=True)
    
    def process_trade(self, trade: Trade) -> List[CapitalGain]:
        """Process a trade and calculate capital gains"""
        gains = []
        remaining = trade.quantity
        lots = self.lots.get(trade.asset, [])
        
        # Calculate average proceeds per unit
        proceeds_per_unit = trade.proceeds / trade.quantity if trade.quantity > 0 else 0
        
        for lot in lots:
            if remaining <= 0:
                break
            
            if lot.remaining_quantity <= 0:
                continue
            
            # Determine quantity from this lot
            lot_qty = min(remaining, lot.remaining_quantity)
            lot_cost_basis = lot_qty * lot.cost_per_unit
            lot_proceeds = lot_qty * proceeds_per_unit
            
            # Calculate holding period
            holding_days = (trade.disposal_date - lot.acquisition_date).days
            long_term_threshold = self.LONG_TERM_THRESHOLDS.get(self.jurisdiction.value, 365)
            is_long_term = holding_days >= long_term_threshold
            
            # Calculate gain/loss
            gain_loss = lot_proceeds - lot_cost_basis
            
            # Create gain record
            gain = CapitalGain(
                trade_id=trade.id,
                asset=trade.asset,
                quantity=lot_qty,
                cost_basis=lot_cost_basis,
                proceeds=lot_proceeds,
                gain_loss=gain_loss,
                holding_period_days=holding_days,
                is_long_term=is_long_term,
                acquisition_date=lot.acquisition_date,
                disposal_date=trade.disposal_date,
                lot_id=lot.id
            )
            gains.append(gain)
            self.gains.append(gain)
            
            # Update lot
            lot.remaining_quantity -= lot_qty
            remaining -= lot_qty
        
        self.trades.append(trade)
        return gains
    
    def calculate_summary(self, year: int) -> TaxSummary:
        """Calculate tax summary for a year"""
        summary = TaxSummary(
            year=year,
            jurisdiction=self.jurisdiction.value,
            method=self.method.value
        )
        
        for gain in self.gains:
            if gain.disposal_date.year != year:
                continue
            
            summary.num_transactions += 1
            summary.total_proceeds += gain.proceeds
            summary.total_cost_basis += gain.cost_basis
            
            if gain.is_long_term:
                if gain.gain_loss >= 0:
                    summary.long_term_gains += gain.gain_loss
                else:
                    summary.long_term_losses += abs(gain.gain_loss)
            else:
                if gain.gain_loss >= 0:
                    summary.short_term_gains += gain.gain_loss
                else:
                    summary.short_term_losses += abs(gain.gain_loss)
            
            summary.gains.append(gain)
        
        # Calculate net
        summary.net_capital_gain = (
            (summary.short_term_gains - summary.short_term_losses) +
            (summary.long_term_gains - summary.long_term_losses)
        )
        
        return summary
    
    def estimate_tax(self, summary: TaxSummary) -> Dict:
        """Estimate tax liability"""
        st_rate = self.SHORT_TERM_RATES.get(summary.jurisdiction, 0.25)
        lt_rate = self.LONG_TERM_RATES.get(summary.jurisdiction, 0.15)
        
        st_net = summary.short_term_gains - summary.short_term_losses
        lt_net = summary.long_term_gains - summary.long_term_losses
        
        st_tax = max(0, st_net * st_rate)
        lt_tax = max(0, lt_net * lt_rate)
        income_tax = summary.total_income * st_rate
        
        return {
            "short_term_tax": round(st_tax, 2),
            "long_term_tax": round(lt_tax, 2),
            "income_tax": round(income_tax, 2),
            "total_estimated_tax": round(st_tax + lt_tax + income_tax, 2),
            "effective_rate": round((st_tax + lt_tax) / max(st_net + lt_net, 1) * 100, 2),
            "jurisdiction": summary.jurisdiction,
            "notes": self._get_jurisdiction_notes(summary.jurisdiction)
        }
    
    def _get_jurisdiction_notes(self, jurisdiction: str) -> List[str]:
        """Get jurisdiction-specific notes"""
        notes = {
            "us": [
                "Short-term gains taxed as ordinary income",
                "Long-term rate depends on income bracket (0%, 15%, 20%)",
                "Net Investment Income Tax (3.8%) may apply",
                "Wash sale rules apply to stocks (not yet crypto)"
            ],
            "de": [
                "Crypto held >1 year is tax-free (§ 23 EStG)",
                "Short-term crypto taxed at personal income rate",
                "€600 exemption for private sales per year",
                "Staking may extend holding period to 10 years"
            ],
            "uk": [
                "CGT annual exemption: £6,000 (2023/24)",
                "Basic rate: 10%, Higher rate: 20%",
                "Pooling rules apply for same-day/30-day matching"
            ],
            "ch": [
                "No capital gains tax for private investors",
                "May be taxed as income if trading professionally",
                "Wealth tax applies to total assets"
            ],
            "sg": [
                "Generally no capital gains tax",
                "Trading as a business may be taxable",
                "GST may apply to certain transactions"
            ]
        }
        return notes.get(jurisdiction, ["Consult a local tax professional"])
    
    def find_tax_loss_opportunities(self, min_loss: float = 100) -> List[Dict]:
        """Find opportunities for tax-loss harvesting"""
        opportunities = []
        
        for asset, lots in self.lots.items():
            for lot in lots:
                if lot.remaining_quantity <= 0:
                    continue
                
                # Simulate current market price (in real impl, would fetch real price)
                # Using random for demo
                current_price = lot.cost_per_unit * random.uniform(0.5, 1.5)
                current_value = lot.remaining_quantity * current_price
                cost_basis = lot.remaining_quantity * lot.cost_per_unit
                unrealized_gain = current_value - cost_basis
                
                if unrealized_gain < -min_loss:
                    opportunities.append({
                        "asset": asset,
                        "lot_id": lot.id,
                        "quantity": lot.remaining_quantity,
                        "cost_basis": round(cost_basis, 2),
                        "current_value": round(current_value, 2),
                        "unrealized_loss": round(unrealized_gain, 2),
                        "acquisition_date": lot.acquisition_date.isoformat(),
                        "holding_days": (datetime.now() - lot.acquisition_date).days
                    })
        
        return sorted(opportunities, key=lambda x: x["unrealized_loss"])


def demo_tax_calculation():
    """Demo tax calculation"""
    calc = TaxCalculator(
        method=TaxMethod.FIFO,
        jurisdiction=Jurisdiction.US
    )
    
    # Add some tax lots (purchases)
    calc.add_lot(TaxLot(
        id="lot1",
        asset="BTC",
        quantity=1.0,
        cost_basis=30000,
        acquisition_date=datetime(2024, 1, 15)
    ))
    
    calc.add_lot(TaxLot(
        id="lot2",
        asset="BTC",
        quantity=0.5,
        cost_basis=20000,
        acquisition_date=datetime(2024, 6, 1)
    ))
    
    calc.add_lot(TaxLot(
        id="lot3",
        asset="ETH",
        quantity=10,
        cost_basis=15000,
        acquisition_date=datetime(2024, 3, 10)
    ))
    
    # Process some trades
    calc.process_trade(Trade(
        id="trade1",
        asset="BTC",
        quantity=0.5,
        proceeds=32500,  # Sold at $65k
        disposal_date=datetime(2025, 2, 1)
    ))
    
    calc.process_trade(Trade(
        id="trade2",
        asset="ETH",
        quantity=5,
        proceeds=17500,  # Sold at $3,500
        disposal_date=datetime(2025, 2, 5)
    ))
    
    # Get summary
    summary = calc.calculate_summary(2025)
    tax_estimate = calc.estimate_tax(summary)
    
    return {
        "summary": {
            "year": summary.year,
            "jurisdiction": summary.jurisdiction,
            "method": summary.method,
            "short_term_gains": round(summary.short_term_gains, 2),
            "short_term_losses": round(summary.short_term_losses, 2),
            "long_term_gains": round(summary.long_term_gains, 2),
            "long_term_losses": round(summary.long_term_losses, 2),
            "net_capital_gain": round(summary.net_capital_gain, 2),
            "total_proceeds": round(summary.total_proceeds, 2),
            "total_cost_basis": round(summary.total_cost_basis, 2),
            "num_transactions": summary.num_transactions
        },
        "tax_estimate": tax_estimate,
        "gains_detail": [
            {
                "asset": g.asset,
                "quantity": g.quantity,
                "gain_loss": round(g.gain_loss, 2),
                "is_long_term": g.is_long_term,
                "holding_days": g.holding_period_days
            }
            for g in summary.gains
        ]
    }


def main():
    """Main entry point for K.I.T. skill execution"""
    # Parse arguments
    args = {}
    if len(sys.argv) > 1:
        try:
            args = json.loads(sys.argv[1])
        except json.JSONDecodeError:
            pass
    
    action = args.get("action", "demo")
    
    if action == "demo":
        result = demo_tax_calculation()
    elif action == "summary":
        year = args.get("year", 2025)
        jurisdiction = args.get("jurisdiction", "us")
        method = args.get("method", "fifo")
        
        calc = TaxCalculator(
            method=TaxMethod(method),
            jurisdiction=Jurisdiction(jurisdiction)
        )
        
        # In real implementation, would load trades from database
        result = {
            "message": f"Tax summary for {year}",
            "jurisdiction": jurisdiction,
            "method": method,
            "note": "Load trades via trade imports or exchange API"
        }
    elif action == "harvest":
        # Tax loss harvesting opportunities
        calc = TaxCalculator()
        opportunities = calc.find_tax_loss_opportunities()
        result = {
            "action": "tax_loss_harvest",
            "opportunities": opportunities[:10]
        }
    else:
        result = {
            "error": f"Unknown action: {action}",
            "available_actions": ["demo", "summary", "harvest"]
        }
    
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
