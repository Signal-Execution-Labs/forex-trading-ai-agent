#!/usr/bin/env python3
"""
K.I.T. Social Trading Engine
Copy trades from signal providers, bots, and top traders
"""

import re
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class SignalAction(Enum):
    BUY = "buy"
    SELL = "sell"
    LONG = "long"
    SHORT = "short"
    CLOSE = "close"


class TrustLevel(Enum):
    UNTRUSTED = "untrusted"  # Manual confirm all
    VERIFIED = "verified"   # Auto small trades
    TRUSTED = "trusted"     # Full auto
    PREMIUM = "premium"     # No limits


@dataclass
class Signal:
    """Represents a trading signal"""
    action: SignalAction
    symbol: str
    entry_price: Optional[float] = None
    take_profit: List[float] = field(default_factory=list)
    stop_loss: Optional[float] = None
    confidence: float = 0.5
    size_pct: float = 5.0
    source: str = "unknown"
    timestamp: datetime = field(default_factory=datetime.now)
    raw_message: str = ""
    
    def to_dict(self) -> Dict:
        return {
            "action": self.action.value,
            "symbol": self.symbol,
            "entry_price": self.entry_price,
            "take_profit": self.take_profit,
            "stop_loss": self.stop_loss,
            "confidence": self.confidence,
            "size_pct": self.size_pct,
            "source": self.source,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class SignalSource:
    """Configuration for a signal source"""
    name: str
    source_type: str  # telegram, discord, webhook, binance_copy
    enabled: bool = True
    trust_level: TrustLevel = TrustLevel.UNTRUSTED
    scale_factor: float = 0.5
    max_position_pct: float = 5.0
    filters: Dict = field(default_factory=dict)
    stats: Dict = field(default_factory=lambda: {"wins": 0, "losses": 0, "total_pnl": 0})


class SignalParser:
    """Parse various signal formats into standardized Signal objects"""
    
    # Common patterns
    PATTERNS = {
        "action": r'(BUY|SELL|LONG|SHORT|CALL|PUT)',
        "symbol": r'([A-Z]{2,10}[/\-_]?[A-Z]{2,6})',
        "price": r'(?:@|Entry|Price)[\s:]*\$?([\d,]+\.?\d*)',
        "tp": r'(?:TP|Target|Take ?Profit)[\d\s:]*\$?([\d,]+\.?\d*)',
        "sl": r'(?:SL|Stop ?Loss|Stop)[\s:]*\$?([\d,]+\.?\d*)',
    }
    
    @classmethod
    def parse(cls, message: str, source: str = "unknown") -> Optional[Signal]:
        """Parse a message into a Signal object"""
        message_upper = message.upper()
        
        # Try to extract action
        action = cls._extract_action(message_upper)
        if not action:
            return None
        
        # Try to extract symbol
        symbol = cls._extract_symbol(message_upper)
        if not symbol:
            return None
        
        # Extract prices
        entry = cls._extract_price(message, "price")
        tps = cls._extract_all_prices(message, "tp")
        sl = cls._extract_price(message, "sl")
        
        # Determine confidence from emojis/keywords
        confidence = cls._calculate_confidence(message)
        
        return Signal(
            action=action,
            symbol=symbol,
            entry_price=entry,
            take_profit=tps,
            stop_loss=sl,
            confidence=confidence,
            source=source,
            raw_message=message
        )
    
    @classmethod
    def _extract_action(cls, message: str) -> Optional[SignalAction]:
        """Extract trading action from message"""
        if any(word in message for word in ['BUY', 'LONG', 'CALL', '🟢', '🚀']):
            return SignalAction.BUY
        if any(word in message for word in ['SELL', 'SHORT', 'PUT', '🔴', '📉']):
            return SignalAction.SELL
        if 'CLOSE' in message:
            return SignalAction.CLOSE
        return None
    
    @classmethod
    def _extract_symbol(cls, message: str) -> Optional[str]:
        """Extract trading symbol from message"""
        # Common patterns
        patterns = [
            r'([A-Z]{2,6})/([A-Z]{2,6})',  # BTC/USDT
            r'([A-Z]{2,6})-([A-Z]{2,6})',   # BTC-USDT
            r'#([A-Z]{2,6})',               # #BTC
            r'\$([A-Z]{2,6})',              # $BTC
        ]
        
        for pattern in patterns:
            match = re.search(pattern, message)
            if match:
                if len(match.groups()) == 2:
                    return f"{match.group(1)}/{match.group(2)}"
                return match.group(1)
        
        return None
    
    @classmethod
    def _extract_price(cls, message: str, price_type: str) -> Optional[float]:
        """Extract a specific price from message"""
        pattern = cls.PATTERNS.get(price_type)
        if not pattern:
            return None
        
        match = re.search(pattern, message, re.IGNORECASE)
        if match:
            price_str = match.group(1).replace(',', '')
            try:
                return float(price_str)
            except ValueError:
                return None
        return None
    
    @classmethod
    def _extract_all_prices(cls, message: str, price_type: str) -> List[float]:
        """Extract all prices of a type (e.g., multiple TPs)"""
        pattern = cls.PATTERNS.get(price_type)
        if not pattern:
            return []
        
        matches = re.findall(pattern, message, re.IGNORECASE)
        prices = []
        for match in matches:
            try:
                prices.append(float(match.replace(',', '')))
            except ValueError:
                continue
        return prices
    
    @classmethod
    def _calculate_confidence(cls, message: str) -> float:
        """Calculate signal confidence based on keywords/emojis"""
        confidence = 0.5
        
        # Positive indicators
        if any(word in message.upper() for word in ['HIGH', 'STRONG', 'CONFIRMED']):
            confidence += 0.2
        if any(emoji in message for emoji in ['🔥', '💎', '🚀', '✅']):
            confidence += 0.1
        
        # Negative indicators
        if any(word in message.upper() for word in ['LOW', 'WEAK', 'RISKY']):
            confidence -= 0.2
        if any(emoji in message for emoji in ['⚠️', '❗']):
            confidence -= 0.1
        
        return max(0.1, min(1.0, confidence))


class RiskManager:
    """Manage risk for social trading"""
    
    def __init__(self, config: Dict):
        self.max_daily_trades = config.get('max_daily_trades', 50)
        self.max_daily_loss_pct = config.get('max_daily_loss_pct', 5.0)
        self.max_concurrent_positions = config.get('max_concurrent_positions', 10)
        self.daily_trades = 0
        self.daily_pnl = 0.0
        self.open_positions = 0
        self.last_reset = datetime.now().date()
    
    def check_limits(self) -> tuple[bool, str]:
        """Check if trading limits allow new trades"""
        # Reset daily counters if new day
        if datetime.now().date() > self.last_reset:
            self.daily_trades = 0
            self.daily_pnl = 0.0
            self.last_reset = datetime.now().date()
        
        if self.daily_trades >= self.max_daily_trades:
            return False, f"Daily trade limit reached ({self.max_daily_trades})"
        
        if self.daily_pnl <= -self.max_daily_loss_pct:
            return False, f"Daily loss limit reached ({self.max_daily_loss_pct}%)"
        
        if self.open_positions >= self.max_concurrent_positions:
            return False, f"Max concurrent positions reached ({self.max_concurrent_positions})"
        
        return True, "OK"
    
    def calculate_position_size(self, signal: Signal, source: SignalSource, 
                                portfolio_value: float) -> float:
        """Calculate position size based on risk parameters"""
        base_size = portfolio_value * (signal.size_pct / 100)
        scaled_size = base_size * source.scale_factor
        max_allowed = portfolio_value * (source.max_position_pct / 100)
        
        return min(scaled_size, max_allowed)
    
    def record_trade(self, pnl: float = 0):
        """Record a completed trade"""
        self.daily_trades += 1
        self.daily_pnl += pnl


class SocialTrader:
    """Main social trading engine"""
    
    def __init__(self, config_path: str = None):
        self.sources: Dict[str, SignalSource] = {}
        self.risk_manager = RiskManager({})
        self.signal_history: List[Signal] = []
        self.running = False
        
        if config_path:
            self.load_config(config_path)
    
    def load_config(self, config_path: str):
        """Load configuration from YAML file"""
        try:
            import yaml
            with open(config_path, 'r') as f:
                config = yaml.safe_load(f)
            
            for source_cfg in config.get('sources', []):
                source = SignalSource(
                    name=source_cfg['name'],
                    source_type=source_cfg['type'],
                    enabled=source_cfg.get('enabled', True),
                    scale_factor=source_cfg.get('risk', {}).get('scale_factor', 0.5),
                    max_position_pct=source_cfg.get('risk', {}).get('max_position_pct', 5.0),
                    filters=source_cfg.get('filters', {})
                )
                self.sources[source.name] = source
            
            self.risk_manager = RiskManager(config.get('settings', {}).get('risk', {}))
            
            logger.info(f"Loaded {len(self.sources)} signal sources")
        except Exception as e:
            logger.error(f"Failed to load config: {e}")
    
    def add_source(self, name: str, source_type: str, **kwargs) -> SignalSource:
        """Add a new signal source"""
        source = SignalSource(
            name=name,
            source_type=source_type,
            **kwargs
        )
        self.sources[name] = source
        logger.info(f"Added signal source: {name} ({source_type})")
        return source
    
    def remove_source(self, name: str) -> bool:
        """Remove a signal source"""
        if name in self.sources:
            del self.sources[name]
            logger.info(f"Removed signal source: {name}")
            return True
        return False
    
    def process_signal(self, message: str, source_name: str) -> Optional[Dict]:
        """Process an incoming signal message"""
        source = self.sources.get(source_name)
        if not source or not source.enabled:
            return {"status": "skipped", "reason": "Source not found or disabled"}
        
        # Parse the signal
        signal = SignalParser.parse(message, source_name)
        if not signal:
            return {"status": "skipped", "reason": "Could not parse signal"}
        
        # Check filters
        filters = source.filters
        if filters.get('pairs') and signal.symbol not in filters['pairs']:
            return {"status": "skipped", "reason": f"Symbol {signal.symbol} not in allowed pairs"}
        
        if filters.get('min_confidence') and signal.confidence < filters['min_confidence']:
            return {"status": "skipped", "reason": f"Confidence {signal.confidence} below minimum"}
        
        # Check risk limits
        can_trade, reason = self.risk_manager.check_limits()
        if not can_trade:
            return {"status": "blocked", "reason": reason}
        
        # Store signal
        self.signal_history.append(signal)
        
        # Determine if we need confirmation
        needs_confirm = source.trust_level == TrustLevel.UNTRUSTED
        
        return {
            "status": "ready",
            "signal": signal.to_dict(),
            "source": source.name,
            "needs_confirmation": needs_confirm,
            "scale_factor": source.scale_factor,
        }
    
    def execute_signal(self, signal: Signal, source: SignalSource, 
                       portfolio_value: float = 10000) -> Dict:
        """Execute a trading signal (simulation)"""
        position_size = self.risk_manager.calculate_position_size(
            signal, source, portfolio_value
        )
        
        # In production, this would connect to the exchange
        result = {
            "status": "executed",
            "action": signal.action.value,
            "symbol": signal.symbol,
            "size_usd": position_size,
            "entry_price": signal.entry_price,
            "take_profit": signal.take_profit,
            "stop_loss": signal.stop_loss,
            "source": source.name,
            "timestamp": datetime.now().isoformat()
        }
        
        self.risk_manager.record_trade()
        
        return result
    
    def get_stats(self, source_name: str = None) -> Dict:
        """Get performance statistics"""
        if source_name:
            source = self.sources.get(source_name)
            if not source:
                return {"error": "Source not found"}
            
            return {
                "source": source.name,
                "trust_level": source.trust_level.value,
                "stats": source.stats
            }
        
        # Overall stats
        total_signals = len(self.signal_history)
        sources_stats = {
            name: source.stats for name, source in self.sources.items()
        }
        
        return {
            "total_signals": total_signals,
            "active_sources": len([s for s in self.sources.values() if s.enabled]),
            "sources": sources_stats
        }
    
    def list_sources(self) -> List[Dict]:
        """List all configured sources"""
        return [
            {
                "name": s.name,
                "type": s.source_type,
                "enabled": s.enabled,
                "trust_level": s.trust_level.value,
                "scale_factor": s.scale_factor
            }
            for s in self.sources.values()
        ]


def main():
    """CLI interface for social trading"""
    import argparse
    
    parser = argparse.ArgumentParser(description='K.I.T. Social Trading')
    subparsers = parser.add_subparsers(dest='command')
    
    # Sources command
    sources_parser = subparsers.add_parser('sources', help='List signal sources')
    
    # Add source command
    add_parser = subparsers.add_parser('add', help='Add a signal source')
    add_parser.add_argument('type', choices=['telegram', 'discord', 'webhook'])
    add_parser.add_argument('identifier', help='Channel ID or webhook URL')
    add_parser.add_argument('--name', '-n', help='Source name')
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show statistics')
    stats_parser.add_argument('--source', '-s', help='Specific source')
    
    # Test parse command
    test_parser = subparsers.add_parser('test', help='Test signal parsing')
    test_parser.add_argument('message', help='Signal message to parse')
    
    args = parser.parse_args()
    
    trader = SocialTrader()
    
    if args.command == 'sources':
        sources = trader.list_sources()
        if not sources:
            print("No sources configured. Add one with: social add telegram @channel")
        else:
            print("\n📊 Signal Sources:\n")
            for s in sources:
                status = "✅" if s['enabled'] else "❌"
                print(f"  {status} {s['name']} ({s['type']})")
                print(f"     Trust: {s['trust_level']} | Scale: {s['scale_factor']}x")
    
    elif args.command == 'add':
        name = args.name or args.identifier
        source = trader.add_source(name, args.type)
        print(f"✅ Added source: {source.name} ({args.type})")
    
    elif args.command == 'stats':
        stats = trader.get_stats(args.source)
        print(json.dumps(stats, indent=2))
    
    elif args.command == 'test':
        signal = SignalParser.parse(args.message)
        if signal:
            print("\n✅ Signal parsed successfully:\n")
            print(json.dumps(signal.to_dict(), indent=2))
        else:
            print("\n❌ Could not parse signal")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
