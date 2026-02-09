"""
🐋 K.I.T. Whale Tracker
=======================
Track large wallet movements and smart money flows.

Features:
- Real-time whale alerts
- Exchange flow analysis
- Wallet intelligence
- Accumulation/distribution signals
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import json
import aiohttp

logger = logging.getLogger("kit.whale-tracker")


class MovementType(Enum):
    EXCHANGE_DEPOSIT = "exchange_deposit"
    EXCHANGE_WITHDRAWAL = "exchange_withdrawal"
    WALLET_TRANSFER = "wallet_transfer"
    SMART_CONTRACT = "smart_contract"
    UNKNOWN = "unknown"


class Signal(Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


@dataclass
class WhaleMovement:
    """Single whale transaction"""
    tx_hash: str
    chain: str
    asset: str
    amount: float
    value_usd: float
    from_address: str
    to_address: str
    from_label: Optional[str]
    to_label: Optional[str]
    movement_type: MovementType
    timestamp: datetime
    signal: Signal
    
    def to_dict(self) -> dict:
        return {
            "tx_hash": self.tx_hash,
            "chain": self.chain,
            "asset": self.asset,
            "amount": self.amount,
            "value_usd": self.value_usd,
            "from": self.from_address[:10] + "...",
            "to": self.to_address[:10] + "...",
            "from_label": self.from_label,
            "to_label": self.to_label,
            "type": self.movement_type.value,
            "timestamp": self.timestamp.isoformat(),
            "signal": self.signal.value
        }


@dataclass
class WalletInfo:
    """Wallet intelligence data"""
    address: str
    chain: str
    label: Optional[str]
    total_value_usd: float
    holdings: Dict[str, float]  # asset -> amount
    first_seen: datetime
    last_active: datetime
    total_transactions: int
    pnl_30d: float
    pnl_all_time: float
    is_smart_money: bool
    tags: List[str] = field(default_factory=list)


@dataclass
class ExchangeFlow:
    """Exchange inflow/outflow data"""
    exchange: str
    asset: str
    inflow: float
    outflow: float
    net_flow: float
    inflow_usd: float
    outflow_usd: float
    net_flow_usd: float
    period_hours: int
    signal: Signal


@dataclass 
class SmartMoneySignal:
    """Smart money trading signal"""
    wallet_label: str
    action: str  # "BUY", "SELL", "ACCUMULATE"
    asset: str
    amount: float
    value_usd: float
    confidence: int  # 0-100
    timestamp: datetime
    wallet_roi: float  # Historical ROI of this wallet


class KnownWallets:
    """Database of known whale wallets"""
    
    # Major exchange hot wallets
    EXCHANGES = {
        # Binance
        "0x28c6c06298d514db089934071355e5743bf21d60": "Binance Hot Wallet",
        "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance Hot Wallet 2",
        "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": "Binance Hot Wallet 3",
        # Coinbase
        "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": "Coinbase Hot Wallet",
        "0x503828976d22510aad0201ac7ec88293211d23da": "Coinbase Cold Wallet",
        # Kraken
        "0x2910543af39aba0cd09dbb2d50200b3e800a63d2": "Kraken Hot Wallet",
        # FTX (historical)
        "0x2faf487a4414fe77e2327f0bf4ae2a264a776ad2": "FTX (defunct)",
    }
    
    # Known smart money / VCs
    SMART_MONEY = {
        "0x1db3439a222c519ab44bb1144fc28167b4fa6ee6": "Paradigm",
        "0x0716a17fbaee714f1e6ab0f9d59edbc5f09815c0": "Jump Trading",
        "0x3744da57184575064838bbc87a0fc791f5e39ea2": "Three Arrows Capital",
        "0x84d34f4f83a87596cd3fb6887cff8f17bf5a7b83": "Alameda Research",
    }
    
    @classmethod
    def get_label(cls, address: str) -> Optional[str]:
        """Get label for known address"""
        address = address.lower()
        return cls.EXCHANGES.get(address) or cls.SMART_MONEY.get(address)
    
    @classmethod
    def is_exchange(cls, address: str) -> bool:
        """Check if address is a known exchange"""
        return address.lower() in cls.EXCHANGES
    
    @classmethod
    def is_smart_money(cls, address: str) -> bool:
        """Check if address is known smart money"""
        return address.lower() in cls.SMART_MONEY


class WhaleAlertAPI:
    """
    Whale Alert API integration
    https://whale-alert.io/
    """
    
    BASE_URL = "https://api.whale-alert.io/v1"
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key
        
    async def get_transactions(
        self,
        min_value: int = 500000,
        start: datetime = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent whale transactions"""
        if not self.api_key:
            return self._mock_transactions(limit)
            
        start = start or datetime.now() - timedelta(hours=24)
        start_ts = int(start.timestamp())
        
        params = {
            "api_key": self.api_key,
            "min_value": min_value,
            "start": start_ts,
            "limit": limit
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.BASE_URL}/transactions",
                    params=params
                ) as resp:
                    data = await resp.json()
                    return data.get("transactions", [])
        except Exception as e:
            logger.error(f"Whale Alert API error: {e}")
            return self._mock_transactions(limit)
    
    def _mock_transactions(self, limit: int) -> List[Dict]:
        """Generate mock whale transactions for demo"""
        import random
        
        assets = ["btc", "eth", "usdt", "usdc", "sol"]
        exchanges = ["binance", "coinbase", "kraken", "unknown"]
        
        transactions = []
        for i in range(min(limit, 20)):
            asset = random.choice(assets)
            value = random.randint(500000, 50000000)
            
            # Determine transaction type
            from_exchange = random.choice([True, False])
            to_exchange = random.choice([True, False]) if not from_exchange else False
            
            if from_exchange:
                from_label = random.choice(exchanges[:-1])
                to_label = "unknown"
                tx_type = "withdrawal"
            elif to_exchange:
                from_label = "unknown"
                to_label = random.choice(exchanges[:-1])
                tx_type = "deposit"
            else:
                from_label = "unknown"
                to_label = "unknown"
                tx_type = "transfer"
            
            transactions.append({
                "blockchain": "ethereum" if asset in ["eth", "usdt", "usdc"] else "bitcoin",
                "symbol": asset.upper(),
                "amount": value / self._get_price(asset),
                "amount_usd": value,
                "from": {
                    "address": f"0x{''.join(random.choices('0123456789abcdef', k=40))}",
                    "owner": from_label,
                    "owner_type": "exchange" if from_exchange else "unknown"
                },
                "to": {
                    "address": f"0x{''.join(random.choices('0123456789abcdef', k=40))}",
                    "owner": to_label,
                    "owner_type": "exchange" if to_exchange else "unknown"
                },
                "timestamp": int((datetime.now() - timedelta(minutes=random.randint(1, 1440))).timestamp()),
                "hash": f"0x{''.join(random.choices('0123456789abcdef', k=64))}",
                "transaction_type": tx_type
            })
        
        return transactions
    
    def _get_price(self, asset: str) -> float:
        """Mock price lookup"""
        prices = {
            "btc": 50000,
            "eth": 3000,
            "sol": 100,
            "usdt": 1,
            "usdc": 1
        }
        return prices.get(asset.lower(), 1)


class EtherscanAPI:
    """
    Etherscan API for Ethereum wallet tracking
    """
    
    BASE_URL = "https://api.etherscan.io/api"
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or "demo"
        
    async def get_balance(self, address: str) -> float:
        """Get ETH balance for address"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    "module": "account",
                    "action": "balance",
                    "address": address,
                    "apikey": self.api_key
                }
                async with session.get(self.BASE_URL, params=params) as resp:
                    data = await resp.json()
                    if data["status"] == "1":
                        return int(data["result"]) / 1e18
        except:
            pass
        return 0
    
    async def get_transactions(
        self,
        address: str,
        limit: int = 100
    ) -> List[Dict]:
        """Get recent transactions for address"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    "module": "account",
                    "action": "txlist",
                    "address": address,
                    "sort": "desc",
                    "page": 1,
                    "offset": limit,
                    "apikey": self.api_key
                }
                async with session.get(self.BASE_URL, params=params) as resp:
                    data = await resp.json()
                    if data["status"] == "1":
                        return data["result"]
        except:
            pass
        return []
    
    async def get_token_transfers(
        self,
        address: str,
        limit: int = 100
    ) -> List[Dict]:
        """Get ERC20 token transfers for address"""
        try:
            async with aiohttp.ClientSession() as session:
                params = {
                    "module": "account",
                    "action": "tokentx",
                    "address": address,
                    "sort": "desc",
                    "page": 1,
                    "offset": limit,
                    "apikey": self.api_key
                }
                async with session.get(self.BASE_URL, params=params) as resp:
                    data = await resp.json()
                    if data["status"] == "1":
                        return data["result"]
        except:
            pass
        return []


class WhaleTracker:
    """
    Main Whale Tracking Engine for K.I.T.
    
    Monitors large wallet movements and provides
    actionable intelligence for trading decisions.
    """
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        
        # API clients
        self.whale_alert = WhaleAlertAPI(
            api_key=self.config.get("whale_alert_api_key")
        )
        self.etherscan = EtherscanAPI(
            api_key=self.config.get("etherscan_api_key")
        )
        
        # Watchlist
        self.watchlist: Dict[str, str] = {}  # address -> label
        
        # Movement cache
        self._movement_cache: List[WhaleMovement] = []
        self._last_update: Optional[datetime] = None
        
        # Thresholds
        self.min_value_usd = self.config.get("min_value_usd", 100000)
        self.alert_threshold = self.config.get("alert_threshold", 500000)
        
        logger.info("🐋 Whale Tracker initialized")
    
    async def get_recent_movements(
        self,
        min_value: int = None,
        hours: int = 24,
        asset: str = None,
        limit: int = 50
    ) -> List[WhaleMovement]:
        """
        Get recent whale movements
        
        Args:
            min_value: Minimum USD value to track
            hours: Hours of history to fetch
            asset: Filter by asset (e.g., "BTC", "ETH")
            limit: Maximum results
            
        Returns:
            List of WhaleMovement objects
        """
        min_value = min_value or self.min_value_usd
        start = datetime.now() - timedelta(hours=hours)
        
        logger.info(f"🐋 Fetching whale movements (min ${min_value:,}, last {hours}h)")
        
        # Fetch from Whale Alert
        raw_txs = await self.whale_alert.get_transactions(
            min_value=min_value,
            start=start,
            limit=limit * 2  # Fetch extra for filtering
        )
        
        movements = []
        for tx in raw_txs:
            # Filter by asset if specified
            if asset and tx.get("symbol", "").upper() != asset.upper():
                continue
            
            # Determine movement type and signal
            movement_type = self._classify_movement(tx)
            signal = self._determine_signal(tx, movement_type)
            
            movement = WhaleMovement(
                tx_hash=tx.get("hash", "unknown"),
                chain=tx.get("blockchain", "unknown"),
                asset=tx.get("symbol", "UNKNOWN").upper(),
                amount=tx.get("amount", 0),
                value_usd=tx.get("amount_usd", 0),
                from_address=tx.get("from", {}).get("address", "unknown"),
                to_address=tx.get("to", {}).get("address", "unknown"),
                from_label=tx.get("from", {}).get("owner"),
                to_label=tx.get("to", {}).get("owner"),
                movement_type=movement_type,
                timestamp=datetime.fromtimestamp(tx.get("timestamp", 0)),
                signal=signal
            )
            
            movements.append(movement)
            
            if len(movements) >= limit:
                break
        
        # Sort by value
        movements.sort(key=lambda x: x.value_usd, reverse=True)
        
        self._movement_cache = movements
        self._last_update = datetime.now()
        
        logger.info(f"✅ Found {len(movements)} whale movements")
        
        return movements
    
    def _classify_movement(self, tx: Dict) -> MovementType:
        """Classify the type of movement"""
        from_type = tx.get("from", {}).get("owner_type", "unknown")
        to_type = tx.get("to", {}).get("owner_type", "unknown")
        
        if to_type == "exchange":
            return MovementType.EXCHANGE_DEPOSIT
        elif from_type == "exchange":
            return MovementType.EXCHANGE_WITHDRAWAL
        elif "contract" in str(tx.get("to", {}).get("address", "")).lower():
            return MovementType.SMART_CONTRACT
        else:
            return MovementType.WALLET_TRANSFER
    
    def _determine_signal(self, tx: Dict, movement_type: MovementType) -> Signal:
        """Determine trading signal based on movement"""
        # Exchange deposit = potential sell = bearish
        if movement_type == MovementType.EXCHANGE_DEPOSIT:
            return Signal.BEARISH
        
        # Exchange withdrawal = accumulation = bullish
        elif movement_type == MovementType.EXCHANGE_WITHDRAWAL:
            return Signal.BULLISH
        
        # Check if from smart money wallet
        from_addr = tx.get("from", {}).get("address", "")
        if KnownWallets.is_smart_money(from_addr):
            # Smart money selling
            return Signal.BEARISH
        
        to_addr = tx.get("to", {}).get("address", "")
        if KnownWallets.is_smart_money(to_addr):
            # Smart money buying
            return Signal.BULLISH
        
        return Signal.NEUTRAL
    
    async def track_wallet(
        self,
        address: str,
        label: str = None
    ) -> WalletInfo:
        """
        Get detailed information about a wallet
        
        Args:
            address: Wallet address to track
            label: Optional label for the wallet
            
        Returns:
            WalletInfo with detailed wallet data
        """
        logger.info(f"🔍 Tracking wallet: {address[:10]}...")
        
        # Get ETH balance
        eth_balance = await self.etherscan.get_balance(address)
        
        # Get recent transactions
        txs = await self.etherscan.get_transactions(address, limit=50)
        token_txs = await self.etherscan.get_token_transfers(address, limit=50)
        
        # Calculate metrics
        total_txs = len(txs) + len(token_txs)
        
        first_seen = datetime.now()
        last_active = datetime.now()
        
        if txs:
            first_seen = datetime.fromtimestamp(int(txs[-1].get("timeStamp", 0)))
            last_active = datetime.fromtimestamp(int(txs[0].get("timeStamp", 0)))
        
        # Estimate holdings (simplified)
        holdings = {"ETH": eth_balance}
        
        # Check if known wallet
        known_label = KnownWallets.get_label(address)
        is_smart_money = KnownWallets.is_smart_money(address)
        
        # Tags
        tags = []
        if KnownWallets.is_exchange(address):
            tags.append("exchange")
        if is_smart_money:
            tags.append("smart_money")
        if eth_balance > 1000:
            tags.append("whale")
        
        # Estimate value (simplified - would need price API)
        eth_price = 3000  # Mock
        total_value = eth_balance * eth_price
        
        return WalletInfo(
            address=address,
            chain="ethereum",
            label=known_label or label or "Unknown",
            total_value_usd=total_value,
            holdings=holdings,
            first_seen=first_seen,
            last_active=last_active,
            total_transactions=total_txs,
            pnl_30d=0.15,  # Mock - would need historical tracking
            pnl_all_time=2.5,  # Mock
            is_smart_money=is_smart_money,
            tags=tags
        )
    
    async def get_exchange_flows(
        self,
        exchange: str = None,
        asset: str = "BTC",
        hours: int = 24
    ) -> List[ExchangeFlow]:
        """
        Get exchange inflow/outflow data
        
        Args:
            exchange: Specific exchange (or all)
            asset: Asset to track
            hours: Time period
            
        Returns:
            List of ExchangeFlow objects
        """
        movements = await self.get_recent_movements(
            hours=hours,
            asset=asset,
            limit=200
        )
        
        # Aggregate flows by exchange
        exchange_flows: Dict[str, Dict] = {}
        
        for m in movements:
            # Inflow (deposit to exchange)
            if m.movement_type == MovementType.EXCHANGE_DEPOSIT:
                ex = m.to_label or "unknown"
                if exchange and ex.lower() != exchange.lower():
                    continue
                    
                if ex not in exchange_flows:
                    exchange_flows[ex] = {"inflow": 0, "outflow": 0, "inflow_usd": 0, "outflow_usd": 0}
                exchange_flows[ex]["inflow"] += m.amount
                exchange_flows[ex]["inflow_usd"] += m.value_usd
            
            # Outflow (withdrawal from exchange)
            elif m.movement_type == MovementType.EXCHANGE_WITHDRAWAL:
                ex = m.from_label or "unknown"
                if exchange and ex.lower() != exchange.lower():
                    continue
                    
                if ex not in exchange_flows:
                    exchange_flows[ex] = {"inflow": 0, "outflow": 0, "inflow_usd": 0, "outflow_usd": 0}
                exchange_flows[ex]["outflow"] += m.amount
                exchange_flows[ex]["outflow_usd"] += m.value_usd
        
        # Create ExchangeFlow objects
        results = []
        for ex_name, data in exchange_flows.items():
            net_flow = data["inflow"] - data["outflow"]
            net_flow_usd = data["inflow_usd"] - data["outflow_usd"]
            
            # Determine signal
            # Positive net flow (more deposits) = bearish
            # Negative net flow (more withdrawals) = bullish
            if net_flow_usd > 10000000:  # >$10M net inflow
                signal = Signal.BEARISH
            elif net_flow_usd < -10000000:  # >$10M net outflow
                signal = Signal.BULLISH
            else:
                signal = Signal.NEUTRAL
            
            results.append(ExchangeFlow(
                exchange=ex_name,
                asset=asset,
                inflow=data["inflow"],
                outflow=data["outflow"],
                net_flow=net_flow,
                inflow_usd=data["inflow_usd"],
                outflow_usd=data["outflow_usd"],
                net_flow_usd=net_flow_usd,
                period_hours=hours,
                signal=signal
            ))
        
        # Sort by absolute net flow
        results.sort(key=lambda x: abs(x.net_flow_usd), reverse=True)
        
        return results
    
    async def get_smart_money_signals(
        self,
        hours: int = 24,
        min_confidence: int = 50
    ) -> List[SmartMoneySignal]:
        """
        Get actionable signals from smart money activity
        
        Args:
            hours: Time period to analyze
            min_confidence: Minimum confidence threshold (0-100)
            
        Returns:
            List of SmartMoneySignal objects
        """
        movements = await self.get_recent_movements(hours=hours, limit=100)
        
        signals = []
        
        for m in movements:
            # Check if from/to smart money wallet
            is_smart_from = KnownWallets.is_smart_money(m.from_address)
            is_smart_to = KnownWallets.is_smart_money(m.to_address)
            
            if not (is_smart_from or is_smart_to):
                continue
            
            # Determine action
            if is_smart_to and m.movement_type == MovementType.EXCHANGE_WITHDRAWAL:
                action = "ACCUMULATE"
                confidence = 80
            elif is_smart_from and m.movement_type == MovementType.EXCHANGE_DEPOSIT:
                action = "DISTRIBUTE"
                confidence = 75
            elif is_smart_to:
                action = "BUY"
                confidence = 70
            elif is_smart_from:
                action = "SELL"
                confidence = 70
            else:
                continue
            
            # Adjust confidence based on value
            if m.value_usd > 10000000:
                confidence += 10
            elif m.value_usd < 1000000:
                confidence -= 10
            
            confidence = max(0, min(100, confidence))
            
            if confidence < min_confidence:
                continue
            
            label = m.to_label if is_smart_to else m.from_label
            
            signals.append(SmartMoneySignal(
                wallet_label=label or "Smart Money",
                action=action,
                asset=m.asset,
                amount=m.amount,
                value_usd=m.value_usd,
                confidence=confidence,
                timestamp=m.timestamp,
                wallet_roi=1.5  # Mock - would need historical tracking
            ))
        
        # Sort by confidence
        signals.sort(key=lambda x: x.confidence, reverse=True)
        
        return signals
    
    def add_to_watchlist(self, address: str, label: str):
        """Add wallet to watchlist"""
        self.watchlist[address.lower()] = label
        logger.info(f"✅ Added {label} ({address[:10]}...) to watchlist")
    
    def remove_from_watchlist(self, address: str):
        """Remove wallet from watchlist"""
        address = address.lower()
        if address in self.watchlist:
            del self.watchlist[address]
            logger.info(f"✅ Removed {address[:10]}... from watchlist")
    
    async def generate_report(self, hours: int = 24) -> str:
        """Generate whale activity report"""
        movements = await self.get_recent_movements(hours=hours, limit=50)
        flows = await self.get_exchange_flows(hours=hours)
        signals = await self.get_smart_money_signals(hours=hours)
        
        report = []
        report.append("🐋 K.I.T. Whale Tracker Report")
        report.append("=" * 50)
        report.append(f"Period: Last {hours} hours")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        report.append("")
        
        # Summary stats
        total_volume = sum(m.value_usd for m in movements)
        bullish = len([m for m in movements if m.signal == Signal.BULLISH])
        bearish = len([m for m in movements if m.signal == Signal.BEARISH])
        
        report.append("📊 SUMMARY")
        report.append("-" * 30)
        report.append(f"Total Movements: {len(movements)}")
        report.append(f"Total Volume: ${total_volume:,.0f}")
        report.append(f"Bullish Signals: {bullish}")
        report.append(f"Bearish Signals: {bearish}")
        report.append("")
        
        # Top movements
        report.append("🔥 TOP MOVEMENTS")
        report.append("-" * 30)
        for m in movements[:5]:
            emoji = "🟢" if m.signal == Signal.BULLISH else "🔴" if m.signal == Signal.BEARISH else "⚪"
            report.append(f"{emoji} {m.asset}: {m.amount:,.2f} (${m.value_usd:,.0f})")
            report.append(f"   {m.from_label or 'Unknown'} → {m.to_label or 'Unknown'}")
        report.append("")
        
        # Exchange flows
        report.append("📈 EXCHANGE FLOWS")
        report.append("-" * 30)
        for flow in flows[:5]:
            net_emoji = "📥" if flow.net_flow_usd > 0 else "📤"
            report.append(f"{flow.exchange}: {net_emoji} ${abs(flow.net_flow_usd):,.0f} net")
        report.append("")
        
        # Smart money signals
        if signals:
            report.append("🎯 SMART MONEY SIGNALS")
            report.append("-" * 30)
            for s in signals[:5]:
                report.append(f"• {s.wallet_label}: {s.action} {s.asset}")
                report.append(f"  Value: ${s.value_usd:,.0f} | Confidence: {s.confidence}%")
        
        return "\n".join(report)


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("🐋 K.I.T. Whale Tracker Demo")
        print("=" * 50)
        
        tracker = WhaleTracker()
        
        # Get recent movements
        movements = await tracker.get_recent_movements(
            min_value=500000,
            hours=24,
            limit=10
        )
        
        print("\n📊 Recent Whale Movements:")
        for m in movements[:5]:
            emoji = "🟢" if m.signal == Signal.BULLISH else "🔴" if m.signal == Signal.BEARISH else "⚪"
            print(f"{emoji} {m.asset}: {m.amount:,.2f} (${m.value_usd:,.0f})")
            print(f"   Type: {m.movement_type.value}")
            print(f"   From: {m.from_label or m.from_address[:15]}...")
            print(f"   To: {m.to_label or m.to_address[:15]}...")
            print()
        
        # Exchange flows
        print("\n📈 Exchange Flows (24h):")
        flows = await tracker.get_exchange_flows(hours=24)
        for f in flows[:3]:
            direction = "↓ bearish" if f.signal == Signal.BEARISH else "↑ bullish" if f.signal == Signal.BULLISH else "→ neutral"
            print(f"  {f.exchange}: ${f.net_flow_usd:+,.0f} ({direction})")
        
        # Smart money
        print("\n🎯 Smart Money Signals:")
        signals = await tracker.get_smart_money_signals()
        for s in signals[:3]:
            print(f"  {s.wallet_label}: {s.action} {s.asset} (${s.value_usd:,.0f})")
            print(f"  Confidence: {s.confidence}%")
        
        # Full report
        print("\n" + "=" * 50)
        report = await tracker.generate_report()
        print(report)
    
    asyncio.run(demo())
