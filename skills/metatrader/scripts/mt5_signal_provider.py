"""
MT5 Signal Provider - Professional Signal Service für K.I.T.

🔥 WELTKLASSE FEATURES:
- Signal generation & broadcasting
- Subscriber management
- Performance tracking
- Webhook integration
- Telegram/Discord alerts
- MQL5 Signals compatibility
"""

import MetaTrader5 as mt5
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import json
import hashlib
import hmac
import requests
import asyncio
import logging
from pathlib import Path
from enum import Enum
import threading
import queue

logger = logging.getLogger("MT5SignalProvider")


class SignalType(Enum):
    MARKET_BUY = "market_buy"
    MARKET_SELL = "market_sell"
    LIMIT_BUY = "limit_buy"
    LIMIT_SELL = "limit_sell"
    STOP_BUY = "stop_buy"
    STOP_SELL = "stop_sell"
    CLOSE = "close"
    MODIFY = "modify"


@dataclass
class Signal:
    """Trading signal"""
    id: str
    timestamp: datetime
    signal_type: SignalType
    symbol: str
    price: Optional[float]
    volume: float
    sl: Optional[float] = None
    tp: Optional[float] = None
    comment: str = ""
    expiration: Optional[datetime] = None
    
    # Tracking
    subscribers_notified: int = 0
    executions: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'timestamp': self.timestamp.isoformat(),
            'type': self.signal_type.value,
            'symbol': self.symbol,
            'price': self.price,
            'volume': self.volume,
            'sl': self.sl,
            'tp': self.tp,
            'comment': self.comment
        }
    
    def to_message(self) -> str:
        """Format signal for messaging"""
        emoji = "🟢" if "buy" in self.signal_type.value else "🔴"
        
        msg = f"""
{emoji} **{self.signal_type.value.upper()}** {self.symbol}

📊 Entry: {self.price or 'Market'}
🎯 TP: {self.tp or 'None'}
🛑 SL: {self.sl or 'None'}
📦 Volume: {self.volume}

⏰ {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}
🔖 ID: {self.id[:8]}
"""
        return msg.strip()


@dataclass
class Subscriber:
    """Signal subscriber"""
    id: str
    name: str
    webhook_url: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    discord_webhook: Optional[str] = None
    email: Optional[str] = None
    
    # Settings
    enabled: bool = True
    allowed_symbols: List[str] = field(default_factory=list)
    max_volume: float = 1.0
    volume_multiplier: float = 1.0
    
    # Stats
    signals_received: int = 0
    signals_executed: int = 0
    total_profit: float = 0.0


class MT5SignalProvider:
    """
    Signal Provider for K.I.T.
    
    Features:
    - Generate and broadcast trading signals
    - Manage subscribers
    - Track signal performance
    - Webhook/Telegram/Discord integration
    
    Usage:
        provider = MT5SignalProvider("KIT_Signals")
        provider.add_subscriber(Subscriber(
            id="sub1",
            name="John",
            telegram_chat_id="123456789"
        ))
        
        signal = provider.create_signal(
            SignalType.MARKET_BUY,
            "EURUSD",
            volume=0.1,
            sl=1.0850,
            tp=1.1000
        )
        provider.broadcast(signal)
    """
    
    def __init__(
        self,
        provider_name: str,
        telegram_bot_token: Optional[str] = None,
        api_key: Optional[str] = None
    ):
        self.provider_name = provider_name
        self.telegram_bot_token = telegram_bot_token
        self.api_key = api_key or self._generate_api_key()
        
        self.subscribers: Dict[str, Subscriber] = {}
        self.signals: List[Signal] = []
        self.signal_history: List[Dict[str, Any]] = []
        
        self._broadcast_queue = queue.Queue()
        self._running = False
        self._broadcast_thread: Optional[threading.Thread] = None
    
    # =========================================================
    # SIGNAL GENERATION
    # =========================================================
    
    def create_signal(
        self,
        signal_type: SignalType,
        symbol: str,
        volume: float,
        price: Optional[float] = None,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        comment: str = ""
    ) -> Signal:
        """
        Create a new trading signal
        
        Args:
            signal_type: Type of signal
            symbol: Trading symbol
            volume: Trade volume
            price: Entry price (None for market orders)
            sl: Stop Loss
            tp: Take Profit
            comment: Signal comment
            
        Returns:
            Signal object
        """
        signal_id = self._generate_signal_id()
        
        signal = Signal(
            id=signal_id,
            timestamp=datetime.now(),
            signal_type=signal_type,
            symbol=symbol,
            price=price,
            volume=volume,
            sl=sl,
            tp=tp,
            comment=comment or f"{self.provider_name}"
        )
        
        self.signals.append(signal)
        logger.info(f"Created signal {signal_id}: {signal_type.value} {symbol}")
        
        return signal
    
    def create_from_position(self, position_ticket: int) -> Optional[Signal]:
        """Create signal from an existing MT5 position"""
        if not mt5.initialize():
            return None
        
        positions = mt5.positions_get(ticket=position_ticket)
        if not positions:
            return None
        
        pos = positions[0]
        
        signal_type = SignalType.MARKET_BUY if pos.type == mt5.POSITION_TYPE_BUY else SignalType.MARKET_SELL
        
        signal = self.create_signal(
            signal_type=signal_type,
            symbol=pos.symbol,
            volume=pos.volume,
            price=pos.price_open,
            sl=pos.sl if pos.sl != 0 else None,
            tp=pos.tp if pos.tp != 0 else None,
            comment=pos.comment
        )
        
        return signal
    
    def create_close_signal(self, symbol: str, position_id: Optional[int] = None) -> Signal:
        """Create a close signal"""
        return self.create_signal(
            signal_type=SignalType.CLOSE,
            symbol=symbol,
            volume=0,
            comment=f"Close {position_id}" if position_id else "Close all"
        )
    
    # =========================================================
    # BROADCASTING
    # =========================================================
    
    def broadcast(self, signal: Signal, async_mode: bool = True) -> Dict[str, Any]:
        """
        Broadcast signal to all subscribers
        
        Args:
            signal: Signal to broadcast
            async_mode: Send asynchronously
            
        Returns:
            Broadcast results
        """
        results = {
            'signal_id': signal.id,
            'subscribers_notified': 0,
            'failures': []
        }
        
        for sub_id, subscriber in self.subscribers.items():
            if not subscriber.enabled:
                continue
            
            # Check symbol filter
            if subscriber.allowed_symbols and signal.symbol not in subscriber.allowed_symbols:
                continue
            
            # Adjust volume
            adjusted_volume = min(
                signal.volume * subscriber.volume_multiplier,
                subscriber.max_volume
            )
            
            # Create subscriber-specific signal
            sub_signal = Signal(
                id=signal.id,
                timestamp=signal.timestamp,
                signal_type=signal.signal_type,
                symbol=signal.symbol,
                price=signal.price,
                volume=adjusted_volume,
                sl=signal.sl,
                tp=signal.tp,
                comment=signal.comment
            )
            
            try:
                self._notify_subscriber(subscriber, sub_signal)
                subscriber.signals_received += 1
                results['subscribers_notified'] += 1
            except Exception as e:
                results['failures'].append({
                    'subscriber': sub_id,
                    'error': str(e)
                })
        
        signal.subscribers_notified = results['subscribers_notified']
        
        # Track history
        self.signal_history.append({
            'signal': signal.to_dict(),
            'broadcast_time': datetime.now().isoformat(),
            'results': results
        })
        
        return results
    
    def _notify_subscriber(self, subscriber: Subscriber, signal: Signal) -> None:
        """Send signal to a subscriber via their configured channels"""
        
        # Telegram
        if subscriber.telegram_chat_id and self.telegram_bot_token:
            self._send_telegram(subscriber.telegram_chat_id, signal.to_message())
        
        # Discord
        if subscriber.discord_webhook:
            self._send_discord(subscriber.discord_webhook, signal)
        
        # Webhook
        if subscriber.webhook_url:
            self._send_webhook(subscriber.webhook_url, signal)
    
    def _send_telegram(self, chat_id: str, message: str) -> bool:
        """Send message via Telegram"""
        if not self.telegram_bot_token:
            return False
        
        url = f"https://api.telegram.org/bot{self.telegram_bot_token}/sendMessage"
        
        try:
            response = requests.post(url, json={
                'chat_id': chat_id,
                'text': message,
                'parse_mode': 'Markdown'
            }, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Telegram send failed: {e}")
            return False
    
    def _send_discord(self, webhook_url: str, signal: Signal) -> bool:
        """Send signal via Discord webhook"""
        embed = {
            "title": f"📊 {signal.signal_type.value.upper()} {signal.symbol}",
            "color": 0x00ff00 if "buy" in signal.signal_type.value else 0xff0000,
            "fields": [
                {"name": "Entry", "value": str(signal.price or "Market"), "inline": True},
                {"name": "SL", "value": str(signal.sl or "None"), "inline": True},
                {"name": "TP", "value": str(signal.tp or "None"), "inline": True},
                {"name": "Volume", "value": str(signal.volume), "inline": True},
            ],
            "footer": {"text": f"Signal ID: {signal.id[:8]}"},
            "timestamp": signal.timestamp.isoformat()
        }
        
        try:
            response = requests.post(webhook_url, json={
                "embeds": [embed],
                "username": self.provider_name
            }, timeout=10)
            return response.status_code in [200, 204]
        except Exception as e:
            logger.error(f"Discord send failed: {e}")
            return False
    
    def _send_webhook(self, url: str, signal: Signal) -> bool:
        """Send signal to custom webhook"""
        payload = signal.to_dict()
        payload['provider'] = self.provider_name
        
        # Sign payload
        signature = self._sign_payload(payload)
        
        headers = {
            'Content-Type': 'application/json',
            'X-Signature': signature,
            'X-Provider': self.provider_name
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Webhook send failed: {e}")
            return False
    
    # =========================================================
    # SUBSCRIBER MANAGEMENT
    # =========================================================
    
    def add_subscriber(self, subscriber: Subscriber) -> None:
        """Add a new subscriber"""
        self.subscribers[subscriber.id] = subscriber
        logger.info(f"Added subscriber: {subscriber.name} ({subscriber.id})")
    
    def remove_subscriber(self, subscriber_id: str) -> None:
        """Remove a subscriber"""
        if subscriber_id in self.subscribers:
            del self.subscribers[subscriber_id]
            logger.info(f"Removed subscriber: {subscriber_id}")
    
    def get_subscriber(self, subscriber_id: str) -> Optional[Subscriber]:
        """Get subscriber by ID"""
        return self.subscribers.get(subscriber_id)
    
    def list_subscribers(self) -> List[Dict[str, Any]]:
        """List all subscribers"""
        return [
            {
                'id': sub.id,
                'name': sub.name,
                'enabled': sub.enabled,
                'signals_received': sub.signals_received,
                'signals_executed': sub.signals_executed,
                'total_profit': sub.total_profit
            }
            for sub in self.subscribers.values()
        ]
    
    # =========================================================
    # PERFORMANCE TRACKING
    # =========================================================
    
    def track_execution(self, signal_id: str, subscriber_id: str, profit: float) -> None:
        """Track signal execution result"""
        for signal in self.signals:
            if signal.id == signal_id:
                signal.executions += 1
                break
        
        if subscriber_id in self.subscribers:
            self.subscribers[subscriber_id].signals_executed += 1
            self.subscribers[subscriber_id].total_profit += profit
    
    def get_performance_stats(self, days: int = 30) -> Dict[str, Any]:
        """Get signal performance statistics"""
        from datetime import timedelta
        cutoff = datetime.now() - timedelta(days=days)
        
        recent_signals = [s for s in self.signals if s.timestamp >= cutoff]
        
        if not recent_signals:
            return {'error': 'No signals in period'}
        
        total = len(recent_signals)
        executed = sum(1 for s in recent_signals if s.executions > 0)
        
        # Calculate from history
        profits = []
        for hist in self.signal_history:
            signal_data = hist.get('signal', {})
            if 'profit' in signal_data:
                profits.append(signal_data['profit'])
        
        return {
            'period_days': days,
            'total_signals': total,
            'executed_signals': executed,
            'execution_rate': executed / total * 100 if total > 0 else 0,
            'total_subscribers': len(self.subscribers),
            'active_subscribers': len([s for s in self.subscribers.values() if s.enabled]),
            'avg_subscribers_per_signal': sum(s.subscribers_notified for s in recent_signals) / total if total > 0 else 0,
            'total_profit': sum(profits),
            'avg_profit_per_signal': sum(profits) / len(profits) if profits else 0
        }
    
    def get_signal_history(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent signal history"""
        return self.signal_history[-limit:]
    
    # =========================================================
    # WEBHOOK RECEIVER (for external signals)
    # =========================================================
    
    def verify_webhook(self, payload: Dict, signature: str) -> bool:
        """Verify incoming webhook signature"""
        expected = self._sign_payload(payload)
        return hmac.compare_digest(expected, signature)
    
    def process_incoming_signal(self, payload: Dict) -> Optional[Signal]:
        """Process incoming signal from webhook"""
        try:
            signal_type = SignalType(payload['type'])
            
            signal = self.create_signal(
                signal_type=signal_type,
                symbol=payload['symbol'],
                volume=payload.get('volume', 0.1),
                price=payload.get('price'),
                sl=payload.get('sl'),
                tp=payload.get('tp'),
                comment=payload.get('comment', 'External')
            )
            
            return signal
        except Exception as e:
            logger.error(f"Failed to process incoming signal: {e}")
            return None
    
    # =========================================================
    # UTILITIES
    # =========================================================
    
    def _generate_signal_id(self) -> str:
        """Generate unique signal ID"""
        import uuid
        return str(uuid.uuid4())
    
    def _generate_api_key(self) -> str:
        """Generate API key for this provider"""
        import secrets
        return secrets.token_hex(32)
    
    def _sign_payload(self, payload: Dict) -> str:
        """Sign payload for webhook verification"""
        payload_str = json.dumps(payload, sort_keys=True)
        signature = hmac.new(
            self.api_key.encode(),
            payload_str.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature
    
    def save_state(self, path: str) -> None:
        """Save provider state to file"""
        state = {
            'provider_name': self.provider_name,
            'api_key': self.api_key,
            'subscribers': [
                {
                    'id': s.id,
                    'name': s.name,
                    'webhook_url': s.webhook_url,
                    'telegram_chat_id': s.telegram_chat_id,
                    'discord_webhook': s.discord_webhook,
                    'email': s.email,
                    'enabled': s.enabled,
                    'allowed_symbols': s.allowed_symbols,
                    'max_volume': s.max_volume,
                    'volume_multiplier': s.volume_multiplier,
                    'signals_received': s.signals_received,
                    'signals_executed': s.signals_executed,
                    'total_profit': s.total_profit
                }
                for s in self.subscribers.values()
            ],
            'signal_history': self.signal_history[-1000:]  # Keep last 1000
        }
        
        with open(path, 'w') as f:
            json.dump(state, f, indent=2)
        
        logger.info(f"Saved state to {path}")
    
    def load_state(self, path: str) -> None:
        """Load provider state from file"""
        if not Path(path).exists():
            return
        
        with open(path, 'r') as f:
            state = json.load(f)
        
        self.provider_name = state.get('provider_name', self.provider_name)
        self.api_key = state.get('api_key', self.api_key)
        self.signal_history = state.get('signal_history', [])
        
        for sub_data in state.get('subscribers', []):
            subscriber = Subscriber(
                id=sub_data['id'],
                name=sub_data['name'],
                webhook_url=sub_data.get('webhook_url'),
                telegram_chat_id=sub_data.get('telegram_chat_id'),
                discord_webhook=sub_data.get('discord_webhook'),
                email=sub_data.get('email'),
                enabled=sub_data.get('enabled', True),
                allowed_symbols=sub_data.get('allowed_symbols', []),
                max_volume=sub_data.get('max_volume', 1.0),
                volume_multiplier=sub_data.get('volume_multiplier', 1.0),
                signals_received=sub_data.get('signals_received', 0),
                signals_executed=sub_data.get('signals_executed', 0),
                total_profit=sub_data.get('total_profit', 0.0)
            )
            self.add_subscriber(subscriber)
        
        logger.info(f"Loaded state from {path}")


# =========================================================
# WEBHOOK SERVER (optional)
# =========================================================

class SignalWebhookServer:
    """Simple webhook server for receiving signals"""
    
    def __init__(self, provider: MT5SignalProvider, port: int = 8080):
        self.provider = provider
        self.port = port
    
    def start(self):
        """Start webhook server (requires Flask or similar)"""
        try:
            from flask import Flask, request, jsonify
            
            app = Flask(__name__)
            
            @app.route('/webhook', methods=['POST'])
            def receive_signal():
                signature = request.headers.get('X-Signature', '')
                payload = request.json
                
                if not self.provider.verify_webhook(payload, signature):
                    return jsonify({'error': 'Invalid signature'}), 401
                
                signal = self.provider.process_incoming_signal(payload)
                if signal:
                    self.provider.broadcast(signal)
                    return jsonify({'success': True, 'signal_id': signal.id})
                
                return jsonify({'error': 'Failed to process signal'}), 400
            
            @app.route('/signals', methods=['GET'])
            def get_signals():
                return jsonify(self.provider.get_signal_history())
            
            @app.route('/stats', methods=['GET'])
            def get_stats():
                return jsonify(self.provider.get_performance_stats())
            
            app.run(host='0.0.0.0', port=self.port)
            
        except ImportError:
            logger.error("Flask not installed. Run: pip install flask")


if __name__ == "__main__":
    print("🤖 K.I.T. Signal Provider")
    print("=" * 50)
    
    provider = MT5SignalProvider("KIT_Elite_Signals")
    
    # Add test subscriber
    provider.add_subscriber(Subscriber(
        id="test_sub",
        name="Test Subscriber",
        enabled=True
    ))
    
    # Create test signal
    signal = provider.create_signal(
        signal_type=SignalType.MARKET_BUY,
        symbol="EURUSD",
        volume=0.1,
        sl=1.0850,
        tp=1.1000,
        comment="Test signal"
    )
    
    print(f"\n📊 Created Signal:")
    print(signal.to_message())
    
    # Broadcast
    results = provider.broadcast(signal)
    print(f"\n📢 Broadcast Results:")
    print(f"  Notified: {results['subscribers_notified']} subscribers")
    
    print("\n✅ Signal Provider ready!")
