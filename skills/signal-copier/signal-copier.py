#!/usr/bin/env python3
"""
K.I.T. Signal Copier - Universal Signal Copy Trading
Supports: Crypto, Forex, Binary Options, Stocks, DeFi
"""

import re
import json
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

# Telegram
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat

logger = logging.getLogger("kit.signal-copier")

# ============================================================
# ENUMS & DATA CLASSES
# ============================================================

class Market(Enum):
    CRYPTO = "crypto"
    FOREX = "forex"
    BINARY = "binary"
    STOCKS = "stocks"
    DEFI = "defi"

class Direction(Enum):
    LONG = "long"      # Buy / Call
    SHORT = "short"    # Sell / Put

@dataclass
class ParsedSignal:
    """Universal signal format for all markets"""
    market: Market
    symbol: str                          # BTC/USDT, EUR/USD, AAPL
    direction: Direction                 # Long/Short, Call/Put
    entry_price: Optional[float] = None  # Entry price (None = market)
    take_profits: List[float] = field(default_factory=list)
    stop_loss: Optional[float] = None
    expiry: Optional[str] = None         # For binary options: "5m", "1h"
    leverage: Optional[int] = None       # For futures/margin
    confidence: Optional[str] = None     # High/Medium/Low
    raw_text: str = ""
    source_channel: str = ""
    timestamp: datetime = field(default_factory=datetime.now)

@dataclass 
class SignalChannel:
    """Configuration for a signal source channel"""
    type: str                    # telegram, discord, webhook
    identifier: str              # @channel or channel_id
    name: str = ""
    markets: List[Market] = field(default_factory=list)
    auto_execute: bool = True
    enabled: bool = True
    stats: Dict[str, int] = field(default_factory=lambda: {
        "signals_received": 0,
        "signals_executed": 0,
        "wins": 0,
        "losses": 0
    })

# ============================================================
# SIGNAL PARSERS
# ============================================================

class SignalParser:
    """Universal signal parser - detects and parses various formats"""
    
    # Common patterns
    CRYPTO_PAIRS = r'(BTC|ETH|XRP|SOL|BNB|ADA|DOGE|AVAX|DOT|LINK|MATIC)[/\-]?(USDT|USD|BUSD|USDC|BTC|ETH)?'
    FOREX_PAIRS = r'(EUR|USD|GBP|JPY|AUD|NZD|CAD|CHF)[/\-]?(EUR|USD|GBP|JPY|AUD|NZD|CAD|CHF)'
    STOCK_SYMBOLS = r'\b(AAPL|TSLA|GOOGL|AMZN|MSFT|NVDA|META|AMD|NFLX|SPY|QQQ)\b'
    
    # Direction patterns
    LONG_PATTERNS = [
        r'\b(BUY|LONG|CALL|BULLISH|AUFWÄRTS|HOCH)\b',
        r'🟢|🚀|📈|⬆️|💚'
    ]
    SHORT_PATTERNS = [
        r'\b(SELL|SHORT|PUT|BEARISH|ABWÄRTS|RUNTER)\b', 
        r'🔴|📉|⬇️|❤️'
    ]
    
    # Price patterns
    ENTRY_PATTERNS = [
        r'entry[:\s]*\$?([\d.,]+)',
        r'@\s*\$?([\d.,]+)',
        r'price[:\s]*\$?([\d.,]+)',
        r'einstieg[:\s]*\$?([\d.,]+)',
    ]
    TP_PATTERNS = [
        r'tp\d?[:\s]*\$?([\d.,]+)',
        r'take\s*profit[:\s]*\$?([\d.,]+)',
        r'target[:\s]*\$?([\d.,]+)',
        r'ziel[:\s]*\$?([\d.,]+)',
    ]
    SL_PATTERNS = [
        r'sl[:\s]*\$?([\d.,]+)',
        r'stop\s*loss[:\s]*\$?([\d.,]+)',
        r'stop[:\s]*\$?([\d.,]+)',
    ]
    
    # Binary options expiry
    EXPIRY_PATTERNS = [
        r'(\d+)\s*(min|m|minute|minutes|minuten)',
        r'(\d+)\s*(hour|h|stunde|stunden)',
        r'(\d+)\s*(sec|s|second|seconds|sekunden)',
    ]
    
    def parse(self, text: str, source_channel: str = "") -> Optional[ParsedSignal]:
        """Parse any signal format and return structured signal"""
        text_upper = text.upper()
        
        # Detect market type
        market = self._detect_market(text)
        if not market:
            return None
            
        # Extract symbol
        symbol = self._extract_symbol(text, market)
        if not symbol:
            return None
            
        # Detect direction
        direction = self._detect_direction(text)
        if not direction:
            return None
            
        # Extract prices
        entry = self._extract_price(text, self.ENTRY_PATTERNS)
        take_profits = self._extract_all_prices(text, self.TP_PATTERNS)
        stop_loss = self._extract_price(text, self.SL_PATTERNS)
        
        # Binary options specific
        expiry = None
        if market == Market.BINARY:
            expiry = self._extract_expiry(text)
            
        # Confidence level
        confidence = self._detect_confidence(text)
        
        return ParsedSignal(
            market=market,
            symbol=symbol,
            direction=direction,
            entry_price=entry,
            take_profits=take_profits,
            stop_loss=stop_loss,
            expiry=expiry,
            confidence=confidence,
            raw_text=text,
            source_channel=source_channel
        )
    
    def _detect_market(self, text: str) -> Optional[Market]:
        """Detect which market the signal is for"""
        text_upper = text.upper()
        
        # Check for binary options keywords
        if any(kw in text_upper for kw in ['CALL', 'PUT', 'BINARY', 'EXPIRY', 'ABLAUF', 'OPTIONEN']):
            if re.search(self.FOREX_PAIRS, text_upper):
                return Market.BINARY
                
        # Check forex pairs
        if re.search(self.FOREX_PAIRS, text_upper):
            if any(kw in text_upper for kw in ['FOREX', 'FX', 'PIPS']):
                return Market.FOREX
            # Default forex pairs to binary if expiry mentioned
            if re.search(r'\d+\s*(min|m|sec|s)', text_upper):
                return Market.BINARY
            return Market.FOREX
            
        # Check crypto pairs
        if re.search(self.CRYPTO_PAIRS, text_upper):
            if 'SWAP' in text_upper or 'UNISWAP' in text_upper or 'PANCAKE' in text_upper:
                return Market.DEFI
            return Market.CRYPTO
            
        # Check stocks
        if re.search(self.STOCK_SYMBOLS, text_upper):
            return Market.STOCKS
            
        return None
    
    def _extract_symbol(self, text: str, market: Market) -> Optional[str]:
        """Extract trading symbol based on market"""
        text_upper = text.upper()
        
        if market in [Market.CRYPTO, Market.DEFI]:
            match = re.search(self.CRYPTO_PAIRS, text_upper)
            if match:
                base = match.group(1)
                quote = match.group(2) or 'USDT'
                return f"{base}/{quote}"
                
        elif market in [Market.FOREX, Market.BINARY]:
            match = re.search(self.FOREX_PAIRS, text_upper)
            if match:
                return f"{match.group(1)}/{match.group(2)}"
                
        elif market == Market.STOCKS:
            match = re.search(self.STOCK_SYMBOLS, text_upper)
            if match:
                return match.group(1)
                
        return None
    
    def _detect_direction(self, text: str) -> Optional[Direction]:
        """Detect if signal is long/buy or short/sell"""
        text_upper = text.upper()
        
        for pattern in self.LONG_PATTERNS:
            if re.search(pattern, text_upper if pattern.startswith(r'\b') else text):
                return Direction.LONG
                
        for pattern in self.SHORT_PATTERNS:
            if re.search(pattern, text_upper if pattern.startswith(r'\b') else text):
                return Direction.SHORT
                
        return None
    
    def _extract_price(self, text: str, patterns: List[str]) -> Optional[float]:
        """Extract first matching price"""
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    return float(match.group(1).replace(',', '.'))
                except:
                    pass
        return None
    
    def _extract_all_prices(self, text: str, patterns: List[str]) -> List[float]:
        """Extract all matching prices (for multiple TPs)"""
        prices = []
        for pattern in patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE)
            for match in matches:
                try:
                    prices.append(float(match.group(1).replace(',', '.')))
                except:
                    pass
        return sorted(set(prices))
    
    def _extract_expiry(self, text: str) -> Optional[str]:
        """Extract expiry time for binary options"""
        for pattern in self.EXPIRY_PATTERNS:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                num = match.group(1)
                unit = match.group(2)[0].lower()
                return f"{num}{unit}"
        return "5m"  # Default 5 minutes
    
    def _detect_confidence(self, text: str) -> Optional[str]:
        """Detect signal confidence level"""
        text_upper = text.upper()
        if any(kw in text_upper for kw in ['HIGH', 'STRONG', 'HOCH', 'STARK', '🔥', '💎']):
            return "HIGH"
        if any(kw in text_upper for kw in ['LOW', 'WEAK', 'NIEDRIG', 'SCHWACH']):
            return "LOW"
        return "MEDIUM"

# ============================================================
# MARKET EXECUTORS
# ============================================================

class BaseExecutor:
    """Base class for trade execution"""
    
    async def execute(self, signal: ParsedSignal, config: Dict) -> Dict:
        raise NotImplementedError

class CryptoExecutor(BaseExecutor):
    """Execute crypto trades via CCXT"""
    
    async def execute(self, signal: ParsedSignal, config: Dict) -> Dict:
        import ccxt
        
        exchange_id = config.get('routing', {}).get('crypto', 'binance')
        exchange_class = getattr(ccxt, exchange_id)
        exchange = exchange_class({
            'apiKey': config.get('api_key'),
            'secret': config.get('api_secret'),
            'enableRateLimit': True,
        })
        
        # Calculate position size
        balance = await exchange.fetch_balance()
        usdt_balance = balance.get('USDT', {}).get('free', 0)
        risk_pct = config.get('settings', {}).get('max_risk_per_trade', 0.02)
        position_size = usdt_balance * risk_pct
        
        # Determine order type
        side = 'buy' if signal.direction == Direction.LONG else 'sell'
        
        # Execute market order
        order = await exchange.create_market_order(
            signal.symbol,
            side,
            position_size / (signal.entry_price or 1)
        )
        
        return {
            'success': True,
            'exchange': exchange_id,
            'order': order,
            'symbol': signal.symbol,
            'side': side,
            'size': position_size
        }

class ForexExecutor(BaseExecutor):
    """Execute forex trades via MT5"""
    
    async def execute(self, signal: ParsedSignal, config: Dict) -> Dict:
        try:
            import MetaTrader5 as mt5
        except ImportError:
            return {'success': False, 'error': 'MetaTrader5 not installed'}
            
        if not mt5.initialize():
            return {'success': False, 'error': 'MT5 initialization failed'}
            
        symbol = signal.symbol.replace('/', '')
        
        # Get symbol info
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            return {'success': False, 'error': f'Symbol {symbol} not found'}
            
        # Calculate lot size based on risk
        account = mt5.account_info()
        risk_pct = config.get('settings', {}).get('max_risk_per_trade', 0.02)
        lot_size = 0.01  # Minimum lot, calculate properly based on SL distance
        
        # Determine order type
        order_type = mt5.ORDER_TYPE_BUY if signal.direction == Direction.LONG else mt5.ORDER_TYPE_SELL
        price = mt5.symbol_info_tick(symbol).ask if signal.direction == Direction.LONG else mt5.symbol_info_tick(symbol).bid
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": lot_size,
            "type": order_type,
            "price": price,
            "sl": signal.stop_loss if signal.stop_loss else 0,
            "tp": signal.take_profits[0] if signal.take_profits else 0,
            "magic": 123456,
            "comment": f"KIT Signal {signal.source_channel}",
            "type_time": mt5.ORDER_TIME_GTC,
        }
        
        result = mt5.order_send(request)
        
        return {
            'success': result.retcode == mt5.TRADE_RETCODE_DONE,
            'platform': 'mt5',
            'order': result._asdict() if result else None,
            'symbol': symbol,
            'side': 'buy' if signal.direction == Direction.LONG else 'sell'
        }

class BinaryExecutor(BaseExecutor):
    """Execute binary options trades"""
    
    async def execute(self, signal: ParsedSignal, config: Dict) -> Dict:
        import websockets
        
        platform = config.get('routing', {}).get('binary', 'binaryfaster')
        
        if platform == 'binaryfaster':
            return await self._execute_binaryfaster(signal, config)
        else:
            return {'success': False, 'error': f'Platform {platform} not supported yet'}
    
    async def _execute_binaryfaster(self, signal: ParsedSignal, config: Dict) -> Dict:
        """Execute on BinaryFaster via WebSocket"""
        ws_url = "wss://wsauto.binaryfaster.com"
        
        # Parse expiry to seconds
        expiry = signal.expiry or "5m"
        if expiry.endswith('m'):
            expiry_seconds = int(expiry[:-1]) * 60
        elif expiry.endswith('h'):
            expiry_seconds = int(expiry[:-1]) * 3600
        else:
            expiry_seconds = 300  # Default 5 min
            
        trade_msg = {
            "action": "trade",
            "asset": signal.symbol.replace('/', ''),
            "direction": "call" if signal.direction == Direction.LONG else "put",
            "amount": config.get('settings', {}).get('trade_amount', 10),
            "expiry": expiry_seconds
        }
        
        try:
            async with websockets.connect(ws_url) as ws:
                # Auth
                await ws.send(json.dumps({
                    "action": "auth",
                    "email": config.get('email'),
                    "password": config.get('password')
                }))
                auth_response = await ws.recv()
                
                # Trade
                await ws.send(json.dumps(trade_msg))
                trade_response = await ws.recv()
                
                return {
                    'success': True,
                    'platform': 'binaryfaster',
                    'response': json.loads(trade_response),
                    'symbol': signal.symbol,
                    'direction': trade_msg['direction'],
                    'expiry': expiry
                }
        except Exception as e:
            return {'success': False, 'error': str(e)}

class StockExecutor(BaseExecutor):
    """Execute stock trades via Alpaca"""
    
    async def execute(self, signal: ParsedSignal, config: Dict) -> Dict:
        from alpaca.trading.client import TradingClient
        from alpaca.trading.requests import MarketOrderRequest
        from alpaca.trading.enums import OrderSide, TimeInForce
        
        client = TradingClient(
            config.get('alpaca_api_key'),
            config.get('alpaca_secret'),
            paper=config.get('paper_trading', True)
        )
        
        side = OrderSide.BUY if signal.direction == Direction.LONG else OrderSide.SELL
        
        order_data = MarketOrderRequest(
            symbol=signal.symbol,
            qty=1,  # Calculate based on risk
            side=side,
            time_in_force=TimeInForce.DAY
        )
        
        order = client.submit_order(order_data)
        
        return {
            'success': True,
            'platform': 'alpaca',
            'order': order.__dict__,
            'symbol': signal.symbol,
            'side': side.value
        }

# ============================================================
# MAIN SIGNAL COPIER ENGINE
# ============================================================

class SignalCopier:
    """Main signal copier engine"""
    
    def __init__(self, config_path: str = "signal-copier.yaml"):
        self.config = self._load_config(config_path)
        self.parser = SignalParser()
        self.channels: List[SignalChannel] = []
        self.executors = {
            Market.CRYPTO: CryptoExecutor(),
            Market.FOREX: ForexExecutor(),
            Market.BINARY: BinaryExecutor(),
            Market.STOCKS: StockExecutor(),
        }
        self.signal_history: List[ParsedSignal] = []
        self.running = False
        
    def _load_config(self, path: str) -> Dict:
        """Load configuration from YAML file"""
        import yaml
        try:
            with open(path, 'r') as f:
                return yaml.safe_load(f)
        except FileNotFoundError:
            return self._default_config()
    
    def _default_config(self) -> Dict:
        return {
            'channels': [],
            'settings': {
                'max_risk_per_trade': 0.02,
                'max_trades_per_day': 20,
                'execution_delay_max': 30,
                'require_confirmation': False,
            },
            'routing': {
                'crypto': 'binance',
                'forex': 'mt5',
                'binary': 'binaryfaster',
                'stocks': 'alpaca'
            },
            'notifications': {
                'on_signal': True,
                'on_execution': True,
                'on_result': True
            }
        }
    
    async def add_channel(self, channel_type: str, identifier: str, 
                         markets: List[str] = None, auto_execute: bool = True) -> SignalChannel:
        """Add a new signal channel to monitor"""
        channel = SignalChannel(
            type=channel_type,
            identifier=identifier,
            markets=[Market(m) for m in (markets or ['crypto', 'forex', 'binary'])],
            auto_execute=auto_execute
        )
        self.channels.append(channel)
        logger.info(f"Added channel: {identifier}")
        return channel
    
    async def process_message(self, text: str, channel_id: str) -> Optional[Dict]:
        """Process incoming message from any channel"""
        # Try to parse the signal
        signal = self.parser.parse(text, channel_id)
        
        if not signal:
            return None  # Not a valid signal
            
        logger.info(f"📥 Signal detected: {signal.symbol} {signal.direction.value} ({signal.market.value})")
        
        # Find channel config
        channel = next((c for c in self.channels if c.identifier == channel_id), None)
        
        # Check if market is enabled for this channel
        if channel and signal.market not in channel.markets:
            logger.info(f"Market {signal.market.value} not enabled for channel {channel_id}")
            return None
        
        # Update stats
        if channel:
            channel.stats['signals_received'] += 1
        
        # Store in history
        self.signal_history.append(signal)
        
        # Check if auto-execute is enabled
        if channel and not channel.auto_execute:
            return {
                'action': 'pending',
                'signal': signal,
                'message': f"Signal requires confirmation: {signal.symbol} {signal.direction.value}"
            }
        
        # Check daily trade limit
        today = datetime.now().date()
        today_trades = len([s for s in self.signal_history 
                          if s.timestamp.date() == today])
        max_trades = self.config.get('settings', {}).get('max_trades_per_day', 20)
        
        if today_trades >= max_trades:
            return {
                'action': 'skipped',
                'reason': 'Daily trade limit reached',
                'signal': signal
            }
        
        # Execute the trade
        result = await self.execute_signal(signal)
        
        if channel and result.get('success'):
            channel.stats['signals_executed'] += 1
            
        return result
    
    async def execute_signal(self, signal: ParsedSignal) -> Dict:
        """Execute a parsed signal on the appropriate platform"""
        executor = self.executors.get(signal.market)
        
        if not executor:
            return {
                'success': False,
                'error': f'No executor for market: {signal.market.value}'
            }
        
        try:
            result = await executor.execute(signal, self.config)
            result['signal'] = signal
            return result
        except Exception as e:
            logger.error(f"Execution error: {e}")
            return {
                'success': False,
                'error': str(e),
                'signal': signal
            }
    
    async def start_telegram_monitor(self, api_id: int, api_hash: str, phone: str):
        """Start monitoring Telegram channels"""
        client = TelegramClient('kit_signal_copier', api_id, api_hash)
        
        @client.on(events.NewMessage)
        async def handler(event):
            # Get channel info
            chat = await event.get_chat()
            channel_id = f"@{chat.username}" if hasattr(chat, 'username') and chat.username else str(chat.id)
            
            # Check if this channel is in our list
            if any(c.identifier == channel_id and c.enabled for c in self.channels):
                result = await self.process_message(event.text, channel_id)
                if result:
                    logger.info(f"Signal result: {result}")
        
        await client.start(phone)
        self.running = True
        logger.info("🚀 Signal Copier started - monitoring Telegram channels")
        await client.run_until_disconnected()
    
    def get_stats(self) -> Dict:
        """Get statistics for all channels"""
        return {
            'channels': [
                {
                    'identifier': c.identifier,
                    'type': c.type,
                    'enabled': c.enabled,
                    'stats': c.stats
                }
                for c in self.channels
            ],
            'total_signals': len(self.signal_history),
            'signals_today': len([s for s in self.signal_history 
                                 if s.timestamp.date() == datetime.now().date()])
        }

# ============================================================
# CLI INTERFACE
# ============================================================

async def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='K.I.T. Signal Copier')
    parser.add_argument('--config', default='signal-copier.yaml', help='Config file path')
    parser.add_argument('--add-channel', help='Add a Telegram channel to monitor')
    parser.add_argument('--markets', nargs='+', default=['crypto', 'forex', 'binary'],
                       help='Markets to copy for this channel')
    parser.add_argument('--test', help='Test parsing a signal text')
    parser.add_argument('--status', action='store_true', help='Show copier status')
    
    args = parser.parse_args()
    
    copier = SignalCopier(args.config)
    
    if args.test:
        # Test signal parsing
        signal = copier.parser.parse(args.test)
        if signal:
            print(f"✅ Parsed Signal:")
            print(f"   Market: {signal.market.value}")
            print(f"   Symbol: {signal.symbol}")
            print(f"   Direction: {signal.direction.value}")
            print(f"   Entry: {signal.entry_price}")
            print(f"   TPs: {signal.take_profits}")
            print(f"   SL: {signal.stop_loss}")
            print(f"   Expiry: {signal.expiry}")
            print(f"   Confidence: {signal.confidence}")
        else:
            print("❌ Could not parse signal")
        return
    
    if args.add_channel:
        await copier.add_channel('telegram', args.add_channel, args.markets)
        print(f"✅ Added channel: {args.add_channel}")
        print(f"   Markets: {args.markets}")
        return
    
    if args.status:
        stats = copier.get_stats()
        print("📊 Signal Copier Status")
        print(f"   Channels: {len(stats['channels'])}")
        print(f"   Total signals: {stats['total_signals']}")
        print(f"   Today: {stats['signals_today']}")
        for ch in stats['channels']:
            print(f"\n   {ch['identifier']}:")
            print(f"      Signals: {ch['stats']['signals_received']}")
            print(f"      Executed: {ch['stats']['signals_executed']}")
        return
    
    # Start monitoring (requires Telegram API credentials)
    print("To start monitoring, set TELEGRAM_API_ID and TELEGRAM_API_HASH environment variables")

if __name__ == "__main__":
    asyncio.run(main())
