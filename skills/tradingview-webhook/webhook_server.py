#!/usr/bin/env python3
"""
K.I.T. TradingView Webhook Receiver

Receives alerts from TradingView and executes trades automatically.
Supports both JSON and text alert formats.

Usage:
    python webhook_server.py [--port 8080] [--config config.yaml]
"""

import asyncio
import json
import logging
import re
import os
import sys
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, asdict
from pathlib import Path

# Add parent for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    from aiohttp import web
    import yaml
except ImportError:
    print("Installing required packages...")
    os.system("pip install aiohttp pyyaml")
    from aiohttp import web
    import yaml


# ============================================
# Configuration
# ============================================

@dataclass
class WebhookConfig:
    port: int = 8080
    host: str = "0.0.0.0"
    secret: Optional[str] = None
    log_file: str = "webhook_alerts.log"
    log_level: str = "INFO"
    max_history: int = 100


@dataclass
class StrategyConfig:
    name: str
    exchange: str = "binance"
    default_quantity: float = 0.01
    use_market_orders: bool = True
    enabled: bool = True


# ============================================
# Alert Types
# ============================================

@dataclass
class TradingAlert:
    """Parsed trading alert from TradingView"""
    id: str
    timestamp: datetime
    action: str  # buy, sell, close
    symbol: str
    price: Optional[float] = None
    quantity: Optional[float] = None
    take_profit: Optional[float] = None
    stop_loss: Optional[float] = None
    strategy: Optional[str] = None
    comment: Optional[str] = None
    raw_message: str = ""
    source_ip: str = ""
    executed: bool = False
    execution_result: Optional[Dict] = None


# ============================================
# Alert Parser
# ============================================

class AlertParser:
    """Parse TradingView alert messages in various formats"""
    
    # Text format patterns
    TEXT_PATTERNS = [
        # BUY BTCUSDT @ 45000 qty=0.1 tp=47000 sl=44000
        r'(?P<action>BUY|SELL|CLOSE)\s+(?P<symbol>\w+)\s*@?\s*(?P<price>[\d.]+)?\s*(?:qty=(?P<quantity>[\d.]+))?\s*(?:tp=(?P<take_profit>[\d.]+))?\s*(?:sl=(?P<stop_loss>[\d.]+))?',
        # LONG BTCUSDT 45000
        r'(?P<action>LONG|SHORT|EXIT)\s+(?P<symbol>\w+)\s*(?P<price>[\d.]+)?',
    ]
    
    @classmethod
    def parse(cls, message: str, source_ip: str = "") -> TradingAlert:
        """Parse alert message (JSON or text format)"""
        message = message.strip()
        
        # Try JSON first
        try:
            data = json.loads(message)
            return cls._parse_json(data, message, source_ip)
        except json.JSONDecodeError:
            pass
        
        # Try text patterns
        return cls._parse_text(message, source_ip)
    
    @classmethod
    def _parse_json(cls, data: Dict, raw: str, source_ip: str) -> TradingAlert:
        """Parse JSON format alert"""
        # Normalize action
        action = str(data.get('action', '')).lower()
        if action in ['long', 'entry_long']:
            action = 'buy'
        elif action in ['short', 'entry_short']:
            action = 'sell'
        elif action in ['exit', 'exit_long', 'exit_short', 'close_long', 'close_short']:
            action = 'close'
        
        return TradingAlert(
            id=f"tv_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}",
            timestamp=datetime.now(),
            action=action,
            symbol=str(data.get('symbol', data.get('ticker', ''))).upper(),
            price=cls._to_float(data.get('price', data.get('close'))),
            quantity=cls._to_float(data.get('quantity', data.get('qty', data.get('contracts')))),
            take_profit=cls._to_float(data.get('take_profit', data.get('tp'))),
            stop_loss=cls._to_float(data.get('stop_loss', data.get('sl'))),
            strategy=data.get('strategy', data.get('name')),
            comment=data.get('comment', data.get('message')),
            raw_message=raw,
            source_ip=source_ip
        )
    
    @classmethod
    def _parse_text(cls, message: str, source_ip: str) -> TradingAlert:
        """Parse text format alert"""
        for pattern in cls.TEXT_PATTERNS:
            match = re.match(pattern, message, re.IGNORECASE)
            if match:
                groups = match.groupdict()
                
                # Normalize action
                action = groups.get('action', '').lower()
                if action in ['long']:
                    action = 'buy'
                elif action in ['short']:
                    action = 'sell'
                elif action in ['exit']:
                    action = 'close'
                
                return TradingAlert(
                    id=f"tv_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}",
                    timestamp=datetime.now(),
                    action=action,
                    symbol=groups.get('symbol', '').upper(),
                    price=cls._to_float(groups.get('price')),
                    quantity=cls._to_float(groups.get('quantity')),
                    take_profit=cls._to_float(groups.get('take_profit')),
                    stop_loss=cls._to_float(groups.get('stop_loss')),
                    raw_message=message,
                    source_ip=source_ip
                )
        
        # Fallback - unknown format
        return TradingAlert(
            id=f"tv_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}",
            timestamp=datetime.now(),
            action='unknown',
            symbol='',
            raw_message=message,
            source_ip=source_ip
        )
    
    @staticmethod
    def _to_float(value: Any) -> Optional[float]:
        """Convert value to float or None"""
        if value is None:
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None


# ============================================
# Trade Executor
# ============================================

class TradeExecutor:
    """Execute trades based on alerts"""
    
    def __init__(self, strategies: Dict[str, StrategyConfig]):
        self.strategies = strategies
        self.logger = logging.getLogger('TradeExecutor')
    
    async def execute(self, alert: TradingAlert) -> Dict[str, Any]:
        """Execute a trade based on the alert"""
        
        # Get strategy config
        strategy_name = alert.strategy or 'default'
        strategy = self.strategies.get(strategy_name)
        
        if not strategy:
            # Use default config
            strategy = StrategyConfig(name='default')
        
        if not strategy.enabled:
            return {
                'success': False,
                'error': f'Strategy {strategy_name} is disabled'
            }
        
        # Determine quantity
        quantity = alert.quantity or strategy.default_quantity
        
        self.logger.info(
            f"Executing {alert.action.upper()} {alert.symbol} "
            f"qty={quantity} @ {alert.price or 'MARKET'}"
        )
        
        # In production, this would call the exchange API
        # For now, simulate execution
        try:
            result = await self._simulate_execution(alert, strategy, quantity)
            alert.executed = True
            alert.execution_result = result
            return result
        except Exception as e:
            self.logger.error(f"Execution failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _simulate_execution(
        self, 
        alert: TradingAlert, 
        strategy: StrategyConfig,
        quantity: float
    ) -> Dict[str, Any]:
        """Simulate trade execution (replace with real exchange calls)"""
        
        # Simulate network delay
        await asyncio.sleep(0.1)
        
        return {
            'success': True,
            'order_id': f"SIM_{alert.id}",
            'exchange': strategy.exchange,
            'action': alert.action,
            'symbol': alert.symbol,
            'quantity': quantity,
            'price': alert.price or 0,
            'order_type': 'MARKET' if strategy.use_market_orders else 'LIMIT',
            'timestamp': datetime.now().isoformat(),
            'simulated': True
        }


# ============================================
# Webhook Server
# ============================================

class TradingViewWebhook:
    """TradingView Webhook Server"""
    
    def __init__(self, config: WebhookConfig, strategies: Dict[str, StrategyConfig]):
        self.config = config
        self.strategies = strategies
        self.executor = TradeExecutor(strategies)
        self.alert_history: List[TradingAlert] = []
        self.logger = self._setup_logging()
        self.app = self._create_app()
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging"""
        logger = logging.getLogger('TradingViewWebhook')
        logger.setLevel(getattr(logging, self.config.log_level.upper()))
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setFormatter(logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        ))
        logger.addHandler(ch)
        
        # File handler
        if self.config.log_file:
            fh = logging.FileHandler(self.config.log_file)
            fh.setFormatter(logging.Formatter(
                '%(asctime)s - %(levelname)s - %(message)s'
            ))
            logger.addHandler(fh)
        
        return logger
    
    def _create_app(self) -> web.Application:
        """Create aiohttp web application"""
        app = web.Application()
        app.router.add_post('/webhook', self.handle_webhook)
        app.router.add_post('/alert', self.handle_webhook)  # Alias
        app.router.add_get('/status', self.handle_status)
        app.router.add_get('/health', self.handle_status)  # Alias
        app.router.add_get('/history', self.handle_history)
        app.router.add_get('/strategies', self.handle_strategies)
        app.router.add_get('/', self.handle_root)
        return app
    
    async def handle_root(self, request: web.Request) -> web.Response:
        """Root endpoint - basic info"""
        return web.json_response({
            'service': 'K.I.T. TradingView Webhook',
            'version': '1.0.0',
            'endpoints': {
                '/webhook': 'POST - Receive TradingView alerts',
                '/status': 'GET - Server status',
                '/history': 'GET - Recent alerts',
                '/strategies': 'GET - Configured strategies'
            }
        })
    
    async def handle_webhook(self, request: web.Request) -> web.Response:
        """Handle incoming TradingView webhook"""
        
        # Get source IP
        source_ip = request.remote or 'unknown'
        
        # Read body
        try:
            body = await request.text()
        except Exception as e:
            self.logger.error(f"Failed to read request body: {e}")
            return web.json_response(
                {'success': False, 'error': 'Invalid request body'},
                status=400
            )
        
        self.logger.info(f"Received webhook from {source_ip}: {body[:200]}")
        
        # Parse alert
        alert = AlertParser.parse(body, source_ip)
        
        # Validate secret if configured
        if self.config.secret:
            try:
                data = json.loads(body)
                if data.get('secret') != self.config.secret:
                    self.logger.warning(f"Invalid secret from {source_ip}")
                    return web.json_response(
                        {'success': False, 'error': 'Invalid secret'},
                        status=401
                    )
            except json.JSONDecodeError:
                pass  # Text format, no secret validation
        
        # Validate alert
        if alert.action == 'unknown' or not alert.symbol:
            self.logger.warning(f"Invalid alert format: {body[:100]}")
            return web.json_response(
                {'success': False, 'error': 'Invalid alert format', 'parsed': asdict(alert)},
                status=400
            )
        
        # Execute trade
        result = await self.executor.execute(alert)
        
        # Store in history
        self.alert_history.append(alert)
        if len(self.alert_history) > self.config.max_history:
            self.alert_history = self.alert_history[-self.config.max_history:]
        
        # Log result
        if result.get('success'):
            self.logger.info(f"Trade executed: {alert.action} {alert.symbol}")
        else:
            self.logger.error(f"Trade failed: {result.get('error')}")
        
        return web.json_response({
            'success': result.get('success', False),
            'alert_id': alert.id,
            'action': alert.action,
            'symbol': alert.symbol,
            'execution': result
        })
    
    async def handle_status(self, request: web.Request) -> web.Response:
        """Return server status"""
        return web.json_response({
            'status': 'running',
            'uptime': 'ok',
            'alerts_received': len(self.alert_history),
            'strategies_configured': len(self.strategies),
            'timestamp': datetime.now().isoformat()
        })
    
    async def handle_history(self, request: web.Request) -> web.Response:
        """Return recent alert history"""
        limit = int(request.query.get('limit', 20))
        alerts = self.alert_history[-limit:]
        
        return web.json_response({
            'count': len(alerts),
            'alerts': [
                {
                    'id': a.id,
                    'timestamp': a.timestamp.isoformat(),
                    'action': a.action,
                    'symbol': a.symbol,
                    'price': a.price,
                    'quantity': a.quantity,
                    'strategy': a.strategy,
                    'executed': a.executed,
                    'result': a.execution_result
                }
                for a in reversed(alerts)
            ]
        })
    
    async def handle_strategies(self, request: web.Request) -> web.Response:
        """Return configured strategies"""
        return web.json_response({
            'strategies': {
                name: {
                    'exchange': s.exchange,
                    'default_quantity': s.default_quantity,
                    'use_market_orders': s.use_market_orders,
                    'enabled': s.enabled
                }
                for name, s in self.strategies.items()
            }
        })
    
    def run(self):
        """Start the webhook server"""
        self.logger.info(f"Starting TradingView Webhook Server on {self.config.host}:{self.config.port}")
        self.logger.info(f"Webhook URL: http://{self.config.host}:{self.config.port}/webhook")
        web.run_app(self.app, host=self.config.host, port=self.config.port)


# ============================================
# Configuration Loading
# ============================================

def load_config(config_path: Optional[str] = None) -> tuple[WebhookConfig, Dict[str, StrategyConfig]]:
    """Load configuration from YAML file"""
    
    webhook_config = WebhookConfig()
    strategies: Dict[str, StrategyConfig] = {}
    
    # Default config path
    if config_path is None:
        config_path = str(Path(__file__).parent / 'config.yaml')
    
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            data = yaml.safe_load(f) or {}
        
        # Webhook config
        wh = data.get('webhook', {})
        webhook_config = WebhookConfig(
            port=wh.get('port', 8080),
            host=wh.get('host', '0.0.0.0'),
            secret=wh.get('secret'),
            log_file=wh.get('log_file', 'webhook_alerts.log'),
            log_level=wh.get('log_level', 'INFO'),
            max_history=wh.get('max_history', 100)
        )
        
        # Strategies
        for name, cfg in data.get('strategies', {}).items():
            strategies[name] = StrategyConfig(
                name=name,
                exchange=cfg.get('exchange', 'binance'),
                default_quantity=cfg.get('default_quantity', 0.01),
                use_market_orders=cfg.get('use_market_orders', True),
                enabled=cfg.get('enabled', True)
            )
    
    # Add default strategy if none configured
    if not strategies:
        strategies['default'] = StrategyConfig(name='default')
    
    return webhook_config, strategies


# ============================================
# Main
# ============================================

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='K.I.T. TradingView Webhook Server')
    parser.add_argument('--port', type=int, default=None, help='Server port')
    parser.add_argument('--host', default=None, help='Server host')
    parser.add_argument('--config', default=None, help='Config file path')
    parser.add_argument('--secret', default=None, help='Webhook secret')
    args = parser.parse_args()
    
    # Load config
    webhook_config, strategies = load_config(args.config)
    
    # Override with CLI args
    if args.port:
        webhook_config.port = args.port
    if args.host:
        webhook_config.host = args.host
    if args.secret:
        webhook_config.secret = args.secret
    
    # Start server
    server = TradingViewWebhook(webhook_config, strategies)
    
    print("""
╔═══════════════════════════════════════════════════════════╗
║           K.I.T. TradingView Webhook Server               ║
╚═══════════════════════════════════════════════════════════╝

📡 Webhook URL: http://{host}:{port}/webhook

Configure this URL in TradingView alerts to receive signals.

Example alert message (JSON):
{{
  "action": "{{{{strategy.order.action}}}}",
  "symbol": "{{{{ticker}}}}",
  "price": {{{{close}}}},
  "quantity": 0.01,
  "strategy": "my-strategy"
}}

Press Ctrl+C to stop.
""".format(host=webhook_config.host, port=webhook_config.port))
    
    server.run()


if __name__ == '__main__':
    main()
