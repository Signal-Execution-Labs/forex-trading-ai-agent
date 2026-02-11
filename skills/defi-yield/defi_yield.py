"""
🌾 K.I.T. DeFi Yield Hunter
===========================
Find, track, and optimize DeFi yield opportunities.

Features:
- Multi-chain yield aggregation
- APY comparison across protocols
- Auto-compound simulation
- Impermanent loss calculation
- Gas optimization
"""

import json
import sys
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import random


class Chain(Enum):
    ETHEREUM = "ethereum"
    POLYGON = "polygon"
    ARBITRUM = "arbitrum"
    OPTIMISM = "optimism"
    BSC = "bsc"
    AVALANCHE = "avalanche"
    SOLANA = "solana"


class ProtocolType(Enum):
    LENDING = "lending"
    DEX = "dex"
    YIELD_AGG = "yield_aggregator"
    STAKING = "staking"
    LIQUID_STAKING = "liquid_staking"


@dataclass
class YieldOpportunity:
    """A yield farming opportunity"""
    protocol: str
    chain: str
    pool: str
    token0: str
    token1: Optional[str]
    apy: float
    tvl: float  # Total Value Locked in USD
    apr_base: float
    apr_reward: float
    reward_tokens: List[str]
    risk_level: str  # low, medium, high
    protocol_type: str
    url: str
    
    # Additional metrics
    il_risk: float = 0  # Impermanent loss risk (0-1)
    audit_score: float = 0  # Protocol audit score (0-100)
    volume_24h: float = 0
    
    def to_dict(self) -> dict:
        return {
            "protocol": self.protocol,
            "chain": self.chain,
            "pool": self.pool,
            "tokens": f"{self.token0}" + (f"/{self.token1}" if self.token1 else ""),
            "apy": f"{self.apy:.2f}%",
            "tvl": f"${self.tvl:,.0f}",
            "risk": self.risk_level,
            "type": self.protocol_type,
            "rewards": self.reward_tokens,
            "url": self.url
        }


@dataclass
class Position:
    """An active yield position"""
    id: str
    protocol: str
    chain: str
    pool: str
    deposited_value: float
    current_value: float
    earned_rewards: float
    entry_date: datetime
    apy_at_entry: float
    current_apy: float
    
    @property
    def pnl(self) -> float:
        return self.current_value + self.earned_rewards - self.deposited_value
    
    @property
    def pnl_percent(self) -> float:
        return (self.pnl / self.deposited_value * 100) if self.deposited_value > 0 else 0
    
    @property
    def days_active(self) -> int:
        return (datetime.now() - self.entry_date).days


class DeFiYieldHunter:
    """
    DeFi Yield Hunter - Find and optimize yield opportunities
    """
    
    # Simulated protocol data (in production, would fetch from APIs)
    PROTOCOLS = {
        "aave": {
            "name": "Aave",
            "type": ProtocolType.LENDING,
            "chains": [Chain.ETHEREUM, Chain.POLYGON, Chain.ARBITRUM],
            "audit_score": 95,
            "tvl": 12_000_000_000
        },
        "compound": {
            "name": "Compound",
            "type": ProtocolType.LENDING,
            "chains": [Chain.ETHEREUM],
            "audit_score": 90,
            "tvl": 3_500_000_000
        },
        "uniswap": {
            "name": "Uniswap V3",
            "type": ProtocolType.DEX,
            "chains": [Chain.ETHEREUM, Chain.POLYGON, Chain.ARBITRUM, Chain.OPTIMISM],
            "audit_score": 88,
            "tvl": 5_000_000_000
        },
        "curve": {
            "name": "Curve Finance",
            "type": ProtocolType.DEX,
            "chains": [Chain.ETHEREUM, Chain.POLYGON, Chain.ARBITRUM],
            "audit_score": 85,
            "tvl": 2_500_000_000
        },
        "yearn": {
            "name": "Yearn Finance",
            "type": ProtocolType.YIELD_AGG,
            "chains": [Chain.ETHEREUM],
            "audit_score": 80,
            "tvl": 500_000_000
        },
        "convex": {
            "name": "Convex Finance",
            "type": ProtocolType.YIELD_AGG,
            "chains": [Chain.ETHEREUM],
            "audit_score": 82,
            "tvl": 2_000_000_000
        },
        "lido": {
            "name": "Lido",
            "type": ProtocolType.LIQUID_STAKING,
            "chains": [Chain.ETHEREUM, Chain.POLYGON, Chain.SOLANA],
            "audit_score": 90,
            "tvl": 35_000_000_000
        },
        "rocketpool": {
            "name": "Rocket Pool",
            "type": ProtocolType.LIQUID_STAKING,
            "chains": [Chain.ETHEREUM],
            "audit_score": 88,
            "tvl": 4_000_000_000
        }
    }
    
    def __init__(self):
        self.positions: List[Position] = []
        self.opportunities: List[YieldOpportunity] = []
    
    def scan_opportunities(
        self,
        chains: List[str] = None,
        min_apy: float = 0,
        max_risk: str = "high",
        min_tvl: float = 0,
        token: str = None
    ) -> List[YieldOpportunity]:
        """Scan for yield opportunities across protocols"""
        
        # Generate simulated opportunities (in production, would fetch from DeFi Llama, etc.)
        opportunities = []
        
        # Lending opportunities
        lending_pools = [
            ("USDC", None, 4.5, 8.2, "low"),
            ("USDT", None, 3.8, 7.5, "low"),
            ("DAI", None, 4.2, 6.8, "low"),
            ("ETH", None, 2.1, 3.5, "low"),
            ("WBTC", None, 1.5, 2.8, "low"),
        ]
        
        for protocol in ["aave", "compound"]:
            proto_data = self.PROTOCOLS[protocol]
            for (t0, t1, apr_base, apr_max, risk) in lending_pools:
                if token and token.upper() not in [t0, t1]:
                    continue
                    
                apr = random.uniform(apr_base, apr_max)
                opportunities.append(YieldOpportunity(
                    protocol=proto_data["name"],
                    chain="ethereum",
                    pool=f"{t0} Supply",
                    token0=t0,
                    token1=t1,
                    apy=apr,
                    tvl=random.uniform(100_000_000, 500_000_000),
                    apr_base=apr,
                    apr_reward=0,
                    reward_tokens=[],
                    risk_level=risk,
                    protocol_type="lending",
                    url=f"https://{protocol}.com",
                    audit_score=proto_data["audit_score"]
                ))
        
        # LP opportunities
        lp_pools = [
            ("ETH", "USDC", 12.5, 35.0, "medium", 0.3),
            ("ETH", "USDT", 10.2, 28.0, "medium", 0.3),
            ("WBTC", "ETH", 8.5, 22.0, "medium", 0.25),
            ("USDC", "USDT", 5.2, 12.0, "low", 0.05),
            ("DAI", "USDC", 4.8, 10.0, "low", 0.02),
        ]
        
        for protocol in ["uniswap", "curve"]:
            proto_data = self.PROTOCOLS[protocol]
            for (t0, t1, apr_base, apr_max, risk, il) in lp_pools:
                if token and token.upper() not in [t0, t1]:
                    continue
                    
                base_apr = random.uniform(apr_base, apr_base * 1.5)
                reward_apr = random.uniform(0, apr_max - apr_base)
                
                opportunities.append(YieldOpportunity(
                    protocol=proto_data["name"],
                    chain="ethereum",
                    pool=f"{t0}/{t1}",
                    token0=t0,
                    token1=t1,
                    apy=base_apr + reward_apr,
                    tvl=random.uniform(10_000_000, 200_000_000),
                    apr_base=base_apr,
                    apr_reward=reward_apr,
                    reward_tokens=["CRV", "CVX"] if protocol == "curve" else ["UNI"],
                    risk_level=risk,
                    protocol_type="dex",
                    url=f"https://{protocol}.org",
                    il_risk=il,
                    audit_score=proto_data["audit_score"]
                ))
        
        # Staking opportunities
        staking_pools = [
            ("stETH", None, 3.8, 4.5, "low", "lido"),
            ("rETH", None, 3.5, 4.2, "low", "rocketpool"),
        ]
        
        for (t0, t1, apr_base, apr_max, risk, protocol) in staking_pools:
            if token and token.upper() not in [t0, "ETH"]:
                continue
                
            proto_data = self.PROTOCOLS[protocol]
            apr = random.uniform(apr_base, apr_max)
            
            opportunities.append(YieldOpportunity(
                protocol=proto_data["name"],
                chain="ethereum",
                pool=f"ETH Staking → {t0}",
                token0=t0,
                token1=None,
                apy=apr,
                tvl=proto_data["tvl"],
                apr_base=apr,
                apr_reward=0,
                reward_tokens=[],
                risk_level=risk,
                protocol_type="liquid_staking",
                url=f"https://{protocol}.fi",
                audit_score=proto_data["audit_score"]
            ))
        
        # Filter opportunities
        risk_levels = {"low": 1, "medium": 2, "high": 3}
        max_risk_level = risk_levels.get(max_risk, 3)
        
        filtered = [
            opp for opp in opportunities
            if opp.apy >= min_apy
            and opp.tvl >= min_tvl
            and risk_levels.get(opp.risk_level, 1) <= max_risk_level
            and (chains is None or opp.chain in chains)
        ]
        
        # Sort by APY
        filtered.sort(key=lambda x: x.apy, reverse=True)
        
        self.opportunities = filtered
        return filtered
    
    def calculate_impermanent_loss(
        self,
        price_change_pct: float
    ) -> Dict:
        """Calculate impermanent loss for a given price change"""
        # IL formula: IL = 2 * sqrt(price_ratio) / (1 + price_ratio) - 1
        price_ratio = 1 + (price_change_pct / 100)
        
        import math
        il = 2 * math.sqrt(price_ratio) / (1 + price_ratio) - 1
        il_pct = il * 100
        
        # Calculate breakeven APY needed
        # Assuming 1 year holding, what APY compensates for IL?
        breakeven_apy = -il_pct
        
        return {
            "price_change": f"{price_change_pct:+.1f}%",
            "impermanent_loss": f"{il_pct:.2f}%",
            "breakeven_apy_needed": f"{breakeven_apy:.2f}%",
            "note": "IL is the difference between holding LP vs just holding tokens"
        }
    
    def simulate_compound(
        self,
        principal: float,
        apy: float,
        days: int,
        compound_frequency: str = "daily"
    ) -> Dict:
        """Simulate compounding returns"""
        
        frequencies = {
            "daily": 365,
            "weekly": 52,
            "monthly": 12,
            "yearly": 1
        }
        
        n = frequencies.get(compound_frequency, 365)
        r = apy / 100
        t = days / 365
        
        # Compound interest formula: A = P * (1 + r/n)^(nt)
        final_value = principal * ((1 + r/n) ** (n * t))
        earnings = final_value - principal
        
        # Simple interest comparison
        simple_value = principal * (1 + r * t)
        simple_earnings = simple_value - principal
        
        compound_advantage = earnings - simple_earnings
        
        return {
            "principal": f"${principal:,.2f}",
            "apy": f"{apy:.2f}%",
            "days": days,
            "compound_frequency": compound_frequency,
            "final_value": f"${final_value:,.2f}",
            "earnings": f"${earnings:,.2f}",
            "compound_advantage": f"${compound_advantage:,.2f}",
            "effective_apy": f"{((final_value/principal - 1) / t * 100):.2f}%"
        }
    
    def get_best_opportunities(
        self,
        investment_amount: float,
        risk_tolerance: str = "medium"
    ) -> List[Dict]:
        """Get recommended opportunities based on investment amount and risk"""
        
        if not self.opportunities:
            self.scan_opportunities()
        
        # Filter by risk
        risk_levels = {"low": 1, "medium": 2, "high": 3}
        max_risk = risk_levels.get(risk_tolerance, 2)
        
        suitable = [
            opp for opp in self.opportunities
            if risk_levels.get(opp.risk_level, 1) <= max_risk
            and opp.tvl >= investment_amount * 10  # TVL should be 10x investment
        ]
        
        # Get top 5 by APY
        top = sorted(suitable, key=lambda x: x.apy, reverse=True)[:5]
        
        recommendations = []
        for opp in top:
            # Calculate expected returns
            yearly_return = investment_amount * (opp.apy / 100)
            monthly_return = yearly_return / 12
            
            recommendations.append({
                **opp.to_dict(),
                "investment": f"${investment_amount:,.2f}",
                "expected_yearly": f"${yearly_return:,.2f}",
                "expected_monthly": f"${monthly_return:,.2f}",
                "safety_score": opp.audit_score
            })
        
        return recommendations


def main():
    """Main entry point for K.I.T. skill execution"""
    args = {}
    if len(sys.argv) > 1:
        try:
            args = json.loads(sys.argv[1])
        except json.JSONDecodeError:
            pass
    
    action = args.get("action", "scan")
    hunter = DeFiYieldHunter()
    
    if action == "scan":
        # Scan for opportunities
        min_apy = args.get("min_apy", 0)
        max_risk = args.get("max_risk", "high")
        token = args.get("token")
        
        opportunities = hunter.scan_opportunities(
            min_apy=min_apy,
            max_risk=max_risk,
            token=token
        )
        
        result = {
            "action": "scan",
            "found": len(opportunities),
            "filters": {
                "min_apy": min_apy,
                "max_risk": max_risk,
                "token": token
            },
            "opportunities": [opp.to_dict() for opp in opportunities[:15]]
        }
    
    elif action == "recommend":
        # Get recommendations
        amount = args.get("amount", 10000)
        risk = args.get("risk_tolerance", "medium")
        
        recommendations = hunter.get_best_opportunities(amount, risk)
        
        result = {
            "action": "recommend",
            "investment_amount": f"${amount:,}",
            "risk_tolerance": risk,
            "recommendations": recommendations
        }
    
    elif action == "compound":
        # Simulate compounding
        principal = args.get("amount", 10000)
        apy = args.get("apy", 10)
        days = args.get("days", 365)
        frequency = args.get("frequency", "daily")
        
        result = hunter.simulate_compound(principal, apy, days, frequency)
    
    elif action == "il":
        # Calculate impermanent loss
        price_change = args.get("price_change", 50)
        result = hunter.calculate_impermanent_loss(price_change)
    
    elif action == "protocols":
        # List supported protocols
        protocols = []
        for key, data in DeFiYieldHunter.PROTOCOLS.items():
            protocols.append({
                "id": key,
                "name": data["name"],
                "type": data["type"].value,
                "chains": [c.value for c in data["chains"]],
                "tvl": f"${data['tvl']:,}",
                "audit_score": data["audit_score"]
            })
        
        result = {
            "action": "protocols",
            "count": len(protocols),
            "protocols": sorted(protocols, key=lambda x: x["audit_score"], reverse=True)
        }
    
    else:
        result = {
            "error": f"Unknown action: {action}",
            "available_actions": ["scan", "recommend", "compound", "il", "protocols"]
        }
    
    print(json.dumps(result, indent=2, default=str))


if __name__ == "__main__":
    main()
