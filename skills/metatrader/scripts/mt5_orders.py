"""
MT5 Orders - Order Execution & Position Management für K.I.T.

Handles:
- Market orders (instant execution)
- Pending orders (limit, stop)
- Position management (modify, close)
- Order history
"""

import MetaTrader5 as mt5
from typing import Optional, Dict, Any, List
from datetime import datetime
import logging

logger = logging.getLogger("MT5Orders")


class MT5OrderError(Exception):
    """Custom exception for order errors"""
    def __init__(self, retcode: int, message: str, comment: str = ""):
        self.retcode = retcode
        self.message = message
        self.comment = comment
        super().__init__(f"Order Error {retcode}: {message} - {comment}")


class MT5Orders:
    """
    MetaTrader 5 Order Management
    
    Usage:
        orders = MT5Orders()
        result = orders.market_order("EURUSD", "buy", 0.1)
        positions = orders.get_positions()
        orders.close_position(ticket=123456789)
    """
    
    # Order type mapping
    ORDER_TYPES = {
        'buy': mt5.ORDER_TYPE_BUY,
        'sell': mt5.ORDER_TYPE_SELL,
        'buy_limit': mt5.ORDER_TYPE_BUY_LIMIT,
        'sell_limit': mt5.ORDER_TYPE_SELL_LIMIT,
        'buy_stop': mt5.ORDER_TYPE_BUY_STOP,
        'sell_stop': mt5.ORDER_TYPE_SELL_STOP,
        'buy_stop_limit': mt5.ORDER_TYPE_BUY_STOP_LIMIT,
        'sell_stop_limit': mt5.ORDER_TYPE_SELL_STOP_LIMIT
    }
    
    # Trade actions
    TRADE_ACTIONS = {
        'deal': mt5.TRADE_ACTION_DEAL,
        'pending': mt5.TRADE_ACTION_PENDING,
        'sltp': mt5.TRADE_ACTION_SLTP,
        'modify': mt5.TRADE_ACTION_MODIFY,
        'remove': mt5.TRADE_ACTION_REMOVE,
        'close_by': mt5.TRADE_ACTION_CLOSE_BY
    }
    
    def __init__(self):
        self._magic = 123456  # Magic number for K.I.T. trades
        
    def set_magic(self, magic: int) -> None:
        """Set magic number for trade identification"""
        self._magic = magic
    
    def market_order(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        deviation: int = 20,
        comment: str = "KIT"
    ) -> Dict[str, Any]:
        """
        Execute a market order (instant execution)
        
        Args:
            symbol: Trading symbol (e.g., "EURUSD")
            order_type: "buy" or "sell"
            volume: Lot size (e.g., 0.1)
            sl: Stop Loss price (optional)
            tp: Take Profit price (optional)
            deviation: Max price deviation in points
            comment: Order comment
            
        Returns:
            Order result dictionary
        """
        # Validate order type
        if order_type.lower() not in ['buy', 'sell']:
            raise ValueError(f"Invalid order type: {order_type}. Use 'buy' or 'sell'.")
        
        # Get symbol info
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            raise MT5OrderError(0, f"Symbol {symbol} not found", "")
            
        if not symbol_info.visible:
            if not mt5.symbol_select(symbol, True):
                raise MT5OrderError(0, f"Failed to select symbol {symbol}", "")
        
        # Get current price
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            raise MT5OrderError(0, f"Failed to get tick for {symbol}", "")
        
        # Determine price based on order type
        if order_type.lower() == 'buy':
            price = tick.ask
            mt5_type = mt5.ORDER_TYPE_BUY
        else:
            price = tick.bid
            mt5_type = mt5.ORDER_TYPE_SELL
        
        # Build request
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(volume),
            "type": mt5_type,
            "price": price,
            "deviation": deviation,
            "magic": self._magic,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        # Add SL/TP if provided
        if sl is not None:
            request["sl"] = float(sl)
        if tp is not None:
            request["tp"] = float(tp)
        
        # Send order
        result = mt5.order_send(request)
        
        if result is None:
            error = mt5.last_error()
            raise MT5OrderError(error[0], error[1], "order_send returned None")
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise MT5OrderError(result.retcode, result.comment, f"Order failed")
        
        logger.info(f"Market order executed: {order_type} {volume} {symbol} @ {result.price}")
        
        return {
            'ticket': result.order,
            'deal': result.deal,
            'volume': result.volume,
            'price': result.price,
            'bid': result.bid,
            'ask': result.ask,
            'comment': result.comment,
            'retcode': result.retcode,
            'request_id': result.request_id
        }
    
    def limit_order(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        price: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        expiration: Optional[datetime] = None,
        comment: str = "KIT"
    ) -> Dict[str, Any]:
        """
        Place a limit order (pending)
        
        Args:
            symbol: Trading symbol
            order_type: "buy_limit" or "sell_limit"
            volume: Lot size
            price: Entry price
            sl: Stop Loss price (optional)
            tp: Take Profit price (optional)
            expiration: Order expiration time (optional)
            comment: Order comment
            
        Returns:
            Order result dictionary
        """
        return self._pending_order(
            symbol=symbol,
            order_type=order_type,
            volume=volume,
            price=price,
            sl=sl,
            tp=tp,
            expiration=expiration,
            comment=comment
        )
    
    def stop_order(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        price: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        expiration: Optional[datetime] = None,
        comment: str = "KIT"
    ) -> Dict[str, Any]:
        """
        Place a stop order (pending)
        
        Args:
            symbol: Trading symbol
            order_type: "buy_stop" or "sell_stop"
            volume: Lot size
            price: Trigger price
            sl: Stop Loss price (optional)
            tp: Take Profit price (optional)
            expiration: Order expiration time (optional)
            comment: Order comment
            
        Returns:
            Order result dictionary
        """
        return self._pending_order(
            symbol=symbol,
            order_type=order_type,
            volume=volume,
            price=price,
            sl=sl,
            tp=tp,
            expiration=expiration,
            comment=comment
        )
    
    def _pending_order(
        self,
        symbol: str,
        order_type: str,
        volume: float,
        price: float,
        sl: Optional[float] = None,
        tp: Optional[float] = None,
        expiration: Optional[datetime] = None,
        comment: str = "KIT"
    ) -> Dict[str, Any]:
        """Internal method for pending orders"""
        
        # Validate order type
        order_type_lower = order_type.lower()
        if order_type_lower not in self.ORDER_TYPES:
            raise ValueError(f"Invalid order type: {order_type}")
        
        # Get symbol info
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            raise MT5OrderError(0, f"Symbol {symbol} not found", "")
        
        if not symbol_info.visible:
            mt5.symbol_select(symbol, True)
        
        # Build request
        request = {
            "action": mt5.TRADE_ACTION_PENDING,
            "symbol": symbol,
            "volume": float(volume),
            "type": self.ORDER_TYPES[order_type_lower],
            "price": float(price),
            "magic": self._magic,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_RETURN,
        }
        
        # Add SL/TP
        if sl is not None:
            request["sl"] = float(sl)
        if tp is not None:
            request["tp"] = float(tp)
            
        # Add expiration
        if expiration is not None:
            request["type_time"] = mt5.ORDER_TIME_SPECIFIED
            request["expiration"] = expiration
        
        # Send order
        result = mt5.order_send(request)
        
        if result is None:
            error = mt5.last_error()
            raise MT5OrderError(error[0], error[1], "")
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise MT5OrderError(result.retcode, result.comment, "")
        
        logger.info(f"Pending order placed: {order_type} {volume} {symbol} @ {price}")
        
        return {
            'ticket': result.order,
            'volume': result.volume,
            'price': price,
            'comment': result.comment,
            'retcode': result.retcode
        }
    
    def get_positions(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get open positions
        
        Args:
            symbol: Filter by symbol (optional)
            
        Returns:
            List of position dictionaries
        """
        if symbol:
            positions = mt5.positions_get(symbol=symbol)
        else:
            positions = mt5.positions_get()
        
        if positions is None:
            return []
        
        result = []
        for pos in positions:
            result.append({
                'ticket': pos.ticket,
                'symbol': pos.symbol,
                'type': 'buy' if pos.type == mt5.POSITION_TYPE_BUY else 'sell',
                'volume': pos.volume,
                'price_open': pos.price_open,
                'price_current': pos.price_current,
                'sl': pos.sl,
                'tp': pos.tp,
                'profit': pos.profit,
                'swap': pos.swap,
                'commission': pos.commission,
                'magic': pos.magic,
                'comment': pos.comment,
                'time': datetime.fromtimestamp(pos.time),
                'identifier': pos.identifier
            })
        
        return result
    
    def get_pending_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Get pending orders
        
        Args:
            symbol: Filter by symbol (optional)
            
        Returns:
            List of order dictionaries
        """
        if symbol:
            orders = mt5.orders_get(symbol=symbol)
        else:
            orders = mt5.orders_get()
        
        if orders is None:
            return []
        
        result = []
        for order in orders:
            # Map order type
            type_map = {
                mt5.ORDER_TYPE_BUY_LIMIT: 'buy_limit',
                mt5.ORDER_TYPE_SELL_LIMIT: 'sell_limit',
                mt5.ORDER_TYPE_BUY_STOP: 'buy_stop',
                mt5.ORDER_TYPE_SELL_STOP: 'sell_stop',
            }
            
            result.append({
                'ticket': order.ticket,
                'symbol': order.symbol,
                'type': type_map.get(order.type, 'unknown'),
                'volume_initial': order.volume_initial,
                'volume_current': order.volume_current,
                'price_open': order.price_open,
                'price_current': order.price_current,
                'sl': order.sl,
                'tp': order.tp,
                'magic': order.magic,
                'comment': order.comment,
                'time_setup': datetime.fromtimestamp(order.time_setup)
            })
        
        return result
    
    def close_position(
        self,
        ticket: int,
        volume: Optional[float] = None,
        deviation: int = 20,
        comment: str = "KIT Close"
    ) -> Dict[str, Any]:
        """
        Close a position
        
        Args:
            ticket: Position ticket number
            volume: Partial close volume (optional, closes all if None)
            deviation: Max price deviation
            comment: Close comment
            
        Returns:
            Close result dictionary
        """
        # Get position
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            raise MT5OrderError(0, f"Position {ticket} not found", "")
        
        position = positions[0]
        
        # Determine close volume
        close_volume = volume if volume else position.volume
        
        # Get current price
        tick = mt5.symbol_info_tick(position.symbol)
        if tick is None:
            raise MT5OrderError(0, f"Failed to get tick for {position.symbol}", "")
        
        # Determine close price (opposite of position direction)
        if position.type == mt5.POSITION_TYPE_BUY:
            price = tick.bid
            close_type = mt5.ORDER_TYPE_SELL
        else:
            price = tick.ask
            close_type = mt5.ORDER_TYPE_BUY
        
        # Build close request
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": position.symbol,
            "volume": float(close_volume),
            "type": close_type,
            "position": ticket,
            "price": price,
            "deviation": deviation,
            "magic": self._magic,
            "comment": comment,
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        
        # Send close order
        result = mt5.order_send(request)
        
        if result is None:
            error = mt5.last_error()
            raise MT5OrderError(error[0], error[1], "")
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise MT5OrderError(result.retcode, result.comment, "")
        
        logger.info(f"Position {ticket} closed: {close_volume} @ {result.price}")
        
        return {
            'ticket': result.order,
            'deal': result.deal,
            'volume': result.volume,
            'price': result.price,
            'profit': position.profit,
            'comment': result.comment
        }
    
    def close_all_positions(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Close all positions
        
        Args:
            symbol: Close only positions for this symbol (optional)
            
        Returns:
            List of close results
        """
        positions = self.get_positions(symbol=symbol)
        results = []
        
        for pos in positions:
            try:
                result = self.close_position(ticket=pos['ticket'])
                results.append(result)
            except MT5OrderError as e:
                logger.error(f"Failed to close position {pos['ticket']}: {e}")
                results.append({'ticket': pos['ticket'], 'error': str(e)})
        
        return results
    
    def modify_position(
        self,
        ticket: int,
        sl: Optional[float] = None,
        tp: Optional[float] = None
    ) -> Dict[str, Any]:
        """
        Modify position SL/TP
        
        Args:
            ticket: Position ticket
            sl: New Stop Loss (None to keep current)
            tp: New Take Profit (None to keep current)
            
        Returns:
            Modification result
        """
        # Get current position
        positions = mt5.positions_get(ticket=ticket)
        if not positions:
            raise MT5OrderError(0, f"Position {ticket} not found", "")
        
        position = positions[0]
        
        # Build modify request
        request = {
            "action": mt5.TRADE_ACTION_SLTP,
            "symbol": position.symbol,
            "position": ticket,
            "sl": float(sl) if sl is not None else position.sl,
            "tp": float(tp) if tp is not None else position.tp,
        }
        
        # Send modification
        result = mt5.order_send(request)
        
        if result is None:
            error = mt5.last_error()
            raise MT5OrderError(error[0], error[1], "")
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise MT5OrderError(result.retcode, result.comment, "")
        
        logger.info(f"Position {ticket} modified: SL={sl}, TP={tp}")
        
        return {
            'ticket': ticket,
            'sl': request['sl'],
            'tp': request['tp'],
            'retcode': result.retcode
        }
    
    def cancel_order(self, ticket: int) -> Dict[str, Any]:
        """
        Cancel a pending order
        
        Args:
            ticket: Order ticket
            
        Returns:
            Cancellation result
        """
        request = {
            "action": mt5.TRADE_ACTION_REMOVE,
            "order": ticket,
        }
        
        result = mt5.order_send(request)
        
        if result is None:
            error = mt5.last_error()
            raise MT5OrderError(error[0], error[1], "")
        
        if result.retcode != mt5.TRADE_RETCODE_DONE:
            raise MT5OrderError(result.retcode, result.comment, "")
        
        logger.info(f"Order {ticket} cancelled")
        
        return {
            'ticket': ticket,
            'retcode': result.retcode,
            'comment': result.comment
        }
    
    def cancel_all_orders(self, symbol: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Cancel all pending orders
        
        Args:
            symbol: Cancel only orders for this symbol (optional)
            
        Returns:
            List of cancellation results
        """
        orders = self.get_pending_orders(symbol=symbol)
        results = []
        
        for order in orders:
            try:
                result = self.cancel_order(ticket=order['ticket'])
                results.append(result)
            except MT5OrderError as e:
                logger.error(f"Failed to cancel order {order['ticket']}: {e}")
                results.append({'ticket': order['ticket'], 'error': str(e)})
        
        return results


if __name__ == "__main__":
    # Test orders (requires connected MT5)
    print("Testing MT5 Orders...")
    
    # Initialize MT5
    if not mt5.initialize():
        print("❌ MT5 initialization failed")
        exit()
    
    orders = MT5Orders()
    
    # Show current positions
    positions = orders.get_positions()
    print(f"\n📊 Open Positions: {len(positions)}")
    for pos in positions:
        print(f"  {pos['symbol']}: {pos['type']} {pos['volume']} @ {pos['price_open']} | P/L: {pos['profit']}")
    
    # Show pending orders
    pending = orders.get_pending_orders()
    print(f"\n⏳ Pending Orders: {len(pending)}")
    for order in pending:
        print(f"  {order['symbol']}: {order['type']} {order['volume_initial']} @ {order['price_open']}")
    
    mt5.shutdown()
    print("\n✅ Test complete")
