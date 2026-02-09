"""
MT5 Expert Advisor Bridge - MQL5 Integration für K.I.T.

🔥 WELTKLASSE FEATURES:
- Bidirectional communication with MQL5 EAs
- Python-MQL5 signal bridge via named pipes/files
- Remote EA control
- Custom indicator integration
- Strategy template generation
"""

import MetaTrader5 as mt5
from typing import Optional, Dict, Any, List, Callable
from dataclasses import dataclass, field
from datetime import datetime
import json
import time
import threading
import logging
from pathlib import Path
from enum import Enum
import struct

logger = logging.getLogger("MT5ExpertAdvisor")


class EACommand(Enum):
    """Commands that can be sent to EA"""
    BUY = "BUY"
    SELL = "SELL"
    CLOSE = "CLOSE"
    CLOSE_ALL = "CLOSE_ALL"
    MODIFY = "MODIFY"
    SET_SL = "SET_SL"
    SET_TP = "SET_TP"
    PAUSE = "PAUSE"
    RESUME = "RESUME"
    GET_STATUS = "GET_STATUS"


@dataclass
class EASignal:
    """Signal to/from Expert Advisor"""
    command: EACommand
    symbol: str
    volume: float = 0.0
    price: float = 0.0
    sl: float = 0.0
    tp: float = 0.0
    ticket: int = 0
    comment: str = ""
    magic: int = 123456
    timestamp: datetime = field(default_factory=datetime.now)
    
    def to_json(self) -> str:
        return json.dumps({
            'command': self.command.value,
            'symbol': self.symbol,
            'volume': self.volume,
            'price': self.price,
            'sl': self.sl,
            'tp': self.tp,
            'ticket': self.ticket,
            'comment': self.comment,
            'magic': self.magic,
            'timestamp': self.timestamp.isoformat()
        })
    
    @classmethod
    def from_json(cls, data: str) -> 'EASignal':
        d = json.loads(data)
        return cls(
            command=EACommand(d['command']),
            symbol=d['symbol'],
            volume=d.get('volume', 0),
            price=d.get('price', 0),
            sl=d.get('sl', 0),
            tp=d.get('tp', 0),
            ticket=d.get('ticket', 0),
            comment=d.get('comment', ''),
            magic=d.get('magic', 123456),
            timestamp=datetime.fromisoformat(d['timestamp']) if 'timestamp' in d else datetime.now()
        )


class MT5EABridge:
    """
    Expert Advisor Bridge for K.I.T.
    
    Enables bidirectional communication between Python and MQL5 Expert Advisors
    using file-based messaging (works reliably on Windows).
    
    Usage:
        bridge = MT5EABridge()
        
        # Send signal to EA
        bridge.send_signal(EASignal(
            command=EACommand.BUY,
            symbol="EURUSD",
            volume=0.1,
            sl=1.0850,
            tp=1.1000
        ))
        
        # Receive signals from EA
        signals = bridge.receive_signals()
    """
    
    def __init__(
        self,
        signals_dir: Optional[str] = None,
        magic_number: int = 123456
    ):
        # Determine MT5 data directory
        if signals_dir:
            self.signals_dir = Path(signals_dir)
        else:
            self.signals_dir = self._get_mt5_files_dir() / "KIT_Signals"
        
        self.signals_dir.mkdir(parents=True, exist_ok=True)
        
        self.magic = magic_number
        self._running = False
        self._listener_thread: Optional[threading.Thread] = None
        self._signal_handlers: List[Callable[[EASignal], None]] = []
        
        # File paths
        self.outgoing_file = self.signals_dir / "python_to_ea.json"
        self.incoming_file = self.signals_dir / "ea_to_python.json"
        self.status_file = self.signals_dir / "ea_status.json"
        
        logger.info(f"EA Bridge initialized at {self.signals_dir}")
    
    def _get_mt5_files_dir(self) -> Path:
        """Get MT5 MQL5/Files directory"""
        if mt5.initialize():
            terminal = mt5.terminal_info()
            if terminal:
                return Path(terminal.data_path) / "MQL5" / "Files"
            mt5.shutdown()
        
        # Fallback to common path
        return Path.home() / "AppData" / "Roaming" / "MetaQuotes" / "Terminal" / "Common" / "Files"
    
    # =========================================================
    # SIGNAL SENDING (Python -> EA)
    # =========================================================
    
    def send_signal(self, signal: EASignal) -> bool:
        """
        Send signal to Expert Advisor
        
        Args:
            signal: EASignal to send
            
        Returns:
            True if signal written successfully
        """
        try:
            # Read existing signals
            signals = []
            if self.outgoing_file.exists():
                try:
                    with open(self.outgoing_file, 'r') as f:
                        signals = json.load(f)
                except:
                    signals = []
            
            # Add new signal
            signals.append(json.loads(signal.to_json()))
            
            # Write back
            with open(self.outgoing_file, 'w') as f:
                json.dump(signals, f, indent=2)
            
            logger.info(f"Signal sent: {signal.command.value} {signal.symbol}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send signal: {e}")
            return False
    
    def send_buy(
        self,
        symbol: str,
        volume: float,
        sl: float = 0,
        tp: float = 0,
        comment: str = "KIT"
    ) -> bool:
        """Send BUY signal"""
        return self.send_signal(EASignal(
            command=EACommand.BUY,
            symbol=symbol,
            volume=volume,
            sl=sl,
            tp=tp,
            comment=comment,
            magic=self.magic
        ))
    
    def send_sell(
        self,
        symbol: str,
        volume: float,
        sl: float = 0,
        tp: float = 0,
        comment: str = "KIT"
    ) -> bool:
        """Send SELL signal"""
        return self.send_signal(EASignal(
            command=EACommand.SELL,
            symbol=symbol,
            volume=volume,
            sl=sl,
            tp=tp,
            comment=comment,
            magic=self.magic
        ))
    
    def send_close(self, symbol: str, ticket: int = 0) -> bool:
        """Send CLOSE signal"""
        return self.send_signal(EASignal(
            command=EACommand.CLOSE,
            symbol=symbol,
            ticket=ticket,
            magic=self.magic
        ))
    
    def send_close_all(self, symbol: str = "") -> bool:
        """Send CLOSE_ALL signal"""
        return self.send_signal(EASignal(
            command=EACommand.CLOSE_ALL,
            symbol=symbol,
            magic=self.magic
        ))
    
    def send_modify(
        self,
        ticket: int,
        sl: float = 0,
        tp: float = 0
    ) -> bool:
        """Send MODIFY signal"""
        return self.send_signal(EASignal(
            command=EACommand.MODIFY,
            symbol="",
            ticket=ticket,
            sl=sl,
            tp=tp,
            magic=self.magic
        ))
    
    def clear_outgoing(self) -> None:
        """Clear outgoing signals (after EA processes them)"""
        if self.outgoing_file.exists():
            self.outgoing_file.unlink()
    
    # =========================================================
    # SIGNAL RECEIVING (EA -> Python)
    # =========================================================
    
    def receive_signals(self) -> List[EASignal]:
        """
        Receive signals from Expert Advisor
        
        Returns:
            List of EASignal objects
        """
        signals = []
        
        if not self.incoming_file.exists():
            return signals
        
        try:
            with open(self.incoming_file, 'r') as f:
                data = json.load(f)
            
            for item in data:
                try:
                    signal = EASignal.from_json(json.dumps(item))
                    signals.append(signal)
                except Exception as e:
                    logger.warning(f"Failed to parse signal: {e}")
            
            # Clear file after reading
            self.incoming_file.unlink()
            
        except Exception as e:
            logger.error(f"Failed to receive signals: {e}")
        
        return signals
    
    def get_ea_status(self) -> Optional[Dict[str, Any]]:
        """Get EA status from status file"""
        if not self.status_file.exists():
            return None
        
        try:
            with open(self.status_file, 'r') as f:
                return json.load(f)
        except:
            return None
    
    # =========================================================
    # LISTENER MODE
    # =========================================================
    
    def add_handler(self, handler: Callable[[EASignal], None]) -> None:
        """Add signal handler callback"""
        self._signal_handlers.append(handler)
    
    def start_listener(self, poll_interval: float = 0.5) -> None:
        """Start listening for EA signals"""
        self._running = True
        self._listener_thread = threading.Thread(
            target=self._listener_loop,
            args=(poll_interval,),
            daemon=True
        )
        self._listener_thread.start()
        logger.info("EA signal listener started")
    
    def stop_listener(self) -> None:
        """Stop listening"""
        self._running = False
        if self._listener_thread:
            self._listener_thread.join(timeout=2)
        logger.info("EA signal listener stopped")
    
    def _listener_loop(self, interval: float) -> None:
        """Listener loop"""
        while self._running:
            try:
                signals = self.receive_signals()
                for signal in signals:
                    for handler in self._signal_handlers:
                        try:
                            handler(signal)
                        except Exception as e:
                            logger.error(f"Handler error: {e}")
            except Exception as e:
                logger.error(f"Listener error: {e}")
            
            time.sleep(interval)


# =========================================================
# MQL5 EA TEMPLATE GENERATOR
# =========================================================

class EATemplateGenerator:
    """Generate MQL5 Expert Advisor templates for K.I.T."""
    
    @staticmethod
    def generate_signal_receiver_ea(magic: int = 123456) -> str:
        """Generate MQL5 EA that receives signals from Python"""
        return f'''//+------------------------------------------------------------------+
//|                                      KIT_Signal_Receiver.mq5      |
//|                                    K.I.T. Trading System          |
//|                                    https://binaryfaster.com       |
//+------------------------------------------------------------------+
#property copyright "K.I.T. Trading System"
#property link      "https://binaryfaster.com"
#property version   "1.00"

#include <Trade\\Trade.mqh>

//--- Input parameters
input int      MagicNumber = {magic};        // Magic Number
input string   SignalFile = "KIT_Signals\\\\python_to_ea.json";
input string   StatusFile = "KIT_Signals\\\\ea_status.json";
input int      PollInterval = 500;           // Poll interval (ms)

//--- Global variables
CTrade trade;
datetime lastCheck = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                      |
//+------------------------------------------------------------------+
int OnInit()
{{
    trade.SetExpertMagicNumber(MagicNumber);
    trade.SetDeviationInPoints(20);
    trade.SetTypeFilling(ORDER_FILLING_IOC);
    
    WriteStatus("initialized");
    Print("K.I.T. Signal Receiver initialized");
    
    EventSetMillisecondTimer(PollInterval);
    return(INIT_SUCCEEDED);
}}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                   |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{{
    EventKillTimer();
    WriteStatus("stopped");
}}

//+------------------------------------------------------------------+
//| Timer function - polls for signals                                 |
//+------------------------------------------------------------------+
void OnTimer()
{{
    ProcessSignals();
    WriteStatus("running");
}}

//+------------------------------------------------------------------+
//| Process incoming signals from Python                               |
//+------------------------------------------------------------------+
void ProcessSignals()
{{
    if(!FileIsExist(SignalFile)) return;
    
    int handle = FileOpen(SignalFile, FILE_READ|FILE_TXT|FILE_ANSI);
    if(handle == INVALID_HANDLE) return;
    
    string content = "";
    while(!FileIsEnding(handle))
        content += FileReadString(handle);
    FileClose(handle);
    
    // Delete file after reading
    FileDelete(SignalFile);
    
    if(StringLen(content) < 10) return;
    
    // Parse JSON array
    // Note: MQL5 doesn't have native JSON, this is simplified
    // For production, use a proper JSON library
    
    if(StringFind(content, "BUY") >= 0)
    {{
        ExecuteBuy(content);
    }}
    else if(StringFind(content, "SELL") >= 0)
    {{
        ExecuteSell(content);
    }}
    else if(StringFind(content, "CLOSE_ALL") >= 0)
    {{
        CloseAllPositions();
    }}
    else if(StringFind(content, "CLOSE") >= 0)
    {{
        ClosePosition(content);
    }}
}}

//+------------------------------------------------------------------+
//| Execute BUY order                                                  |
//+------------------------------------------------------------------+
void ExecuteBuy(string &content)
{{
    double volume = ExtractDouble(content, "volume");
    double sl = ExtractDouble(content, "sl");
    double tp = ExtractDouble(content, "tp");
    string symbol = ExtractString(content, "symbol");
    
    if(symbol == "") symbol = _Symbol;
    if(volume <= 0) volume = 0.1;
    
    double price = SymbolInfoDouble(symbol, SYMBOL_ASK);
    
    if(trade.Buy(volume, symbol, price, sl, tp, "KIT"))
        Print("BUY executed: ", symbol, " ", volume, " lots");
    else
        Print("BUY failed: ", trade.ResultRetcode());
}}

//+------------------------------------------------------------------+
//| Execute SELL order                                                 |
//+------------------------------------------------------------------+
void ExecuteSell(string &content)
{{
    double volume = ExtractDouble(content, "volume");
    double sl = ExtractDouble(content, "sl");
    double tp = ExtractDouble(content, "tp");
    string symbol = ExtractString(content, "symbol");
    
    if(symbol == "") symbol = _Symbol;
    if(volume <= 0) volume = 0.1;
    
    double price = SymbolInfoDouble(symbol, SYMBOL_BID);
    
    if(trade.Sell(volume, symbol, price, sl, tp, "KIT"))
        Print("SELL executed: ", symbol, " ", volume, " lots");
    else
        Print("SELL failed: ", trade.ResultRetcode());
}}

//+------------------------------------------------------------------+
//| Close all positions                                                |
//+------------------------------------------------------------------+
void CloseAllPositions()
{{
    for(int i = PositionsTotal() - 1; i >= 0; i--)
    {{
        ulong ticket = PositionGetTicket(i);
        if(PositionSelectByTicket(ticket))
        {{
            if(PositionGetInteger(POSITION_MAGIC) == MagicNumber)
                trade.PositionClose(ticket);
        }}
    }}
    Print("All positions closed");
}}

//+------------------------------------------------------------------+
//| Close specific position                                            |
//+------------------------------------------------------------------+
void ClosePosition(string &content)
{{
    long ticket = (long)ExtractDouble(content, "ticket");
    if(ticket > 0)
    {{
        trade.PositionClose(ticket);
        Print("Position closed: ", ticket);
    }}
}}

//+------------------------------------------------------------------+
//| Write EA status to file                                            |
//+------------------------------------------------------------------+
void WriteStatus(string status)
{{
    int handle = FileOpen(StatusFile, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(handle != INVALID_HANDLE)
    {{
        string json = "{{";
        json += "\\"status\\": \\"" + status + "\\",";
        json += "\\"magic\\": " + IntegerToString(MagicNumber) + ",";
        json += "\\"positions\\": " + IntegerToString(PositionsTotal()) + ",";
        json += "\\"account\\": " + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN)) + ",";
        json += "\\"balance\\": " + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
        json += "\\"equity\\": " + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
        json += "\\"timestamp\\": \\"" + TimeToString(TimeCurrent()) + "\\"";
        json += "}}";
        
        FileWriteString(handle, json);
        FileClose(handle);
    }}
}}

//+------------------------------------------------------------------+
//| Helper: Extract double from JSON-like string                       |
//+------------------------------------------------------------------+
double ExtractDouble(string &content, string key)
{{
    string search = "\\"" + key + "\\":";
    int pos = StringFind(content, search);
    if(pos < 0) return 0;
    
    pos += StringLen(search);
    string value = "";
    
    while(pos < StringLen(content))
    {{
        ushort c = StringGetCharacter(content, pos);
        if((c >= '0' && c <= '9') || c == '.' || c == '-')
            value += CharToString((uchar)c);
        else if(StringLen(value) > 0)
            break;
        pos++;
    }}
    
    return StringToDouble(value);
}}

//+------------------------------------------------------------------+
//| Helper: Extract string from JSON-like string                       |
//+------------------------------------------------------------------+
string ExtractString(string &content, string key)
{{
    string search = "\\"" + key + "\\":\\"";
    int pos = StringFind(content, search);
    if(pos < 0) return "";
    
    pos += StringLen(search);
    int end = StringFind(content, "\\"", pos);
    if(end < 0) return "";
    
    return StringSubstr(content, pos, end - pos);
}}
//+------------------------------------------------------------------+
'''
    
    @staticmethod
    def generate_signal_sender_ea(magic: int = 123456) -> str:
        """Generate MQL5 EA that sends signals to Python"""
        return f'''//+------------------------------------------------------------------+
//|                                        KIT_Signal_Sender.mq5      |
//|                                    K.I.T. Trading System          |
//|                                    https://binaryfaster.com       |
//+------------------------------------------------------------------+
#property copyright "K.I.T. Trading System"
#property link      "https://binaryfaster.com"
#property version   "1.00"

//--- Input parameters
input int      MagicNumber = {magic};
input string   SignalFile = "KIT_Signals\\\\ea_to_python.json";
input bool     SendOnTrade = true;           // Send signal on trade
input bool     SendOnTick = false;           // Send signal every tick

//+------------------------------------------------------------------+
//| Expert initialization function                                      |
//+------------------------------------------------------------------+
int OnInit()
{{
    Print("K.I.T. Signal Sender initialized");
    return(INIT_SUCCEEDED);
}}

//+------------------------------------------------------------------+
//| Expert tick function                                               |
//+------------------------------------------------------------------+
void OnTick()
{{
    if(SendOnTick)
    {{
        SendTickSignal();
    }}
}}

//+------------------------------------------------------------------+
//| Trade event handler                                                |
//+------------------------------------------------------------------+
void OnTrade()
{{
    if(SendOnTrade)
    {{
        SendTradeSignal();
    }}
}}

//+------------------------------------------------------------------+
//| Send tick data to Python                                           |
//+------------------------------------------------------------------+
void SendTickSignal()
{{
    MqlTick tick;
    if(!SymbolInfoTick(_Symbol, tick)) return;
    
    string json = "[{{";
    json += "\\"command\\": \\"TICK\\",";
    json += "\\"symbol\\": \\"" + _Symbol + "\\",";
    json += "\\"bid\\": " + DoubleToString(tick.bid, _Digits) + ",";
    json += "\\"ask\\": " + DoubleToString(tick.ask, _Digits) + ",";
    json += "\\"timestamp\\": \\"" + TimeToString(tick.time) + "\\"";
    json += "}}]";
    
    WriteSignal(json);
}}

//+------------------------------------------------------------------+
//| Send trade event to Python                                         |
//+------------------------------------------------------------------+
void SendTradeSignal()
{{
    // Get latest deal
    HistorySelect(TimeCurrent() - 60, TimeCurrent());
    int deals = HistoryDealsTotal();
    
    if(deals == 0) return;
    
    ulong ticket = HistoryDealGetTicket(deals - 1);
    
    string json = "[{{";
    json += "\\"command\\": \\"TRADE\\",";
    json += "\\"symbol\\": \\"" + HistoryDealGetString(ticket, DEAL_SYMBOL) + "\\",";
    json += "\\"ticket\\": " + IntegerToString(ticket) + ",";
    json += "\\"volume\\": " + DoubleToString(HistoryDealGetDouble(ticket, DEAL_VOLUME), 2) + ",";
    json += "\\"price\\": " + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PRICE), _Digits) + ",";
    json += "\\"profit\\": " + DoubleToString(HistoryDealGetDouble(ticket, DEAL_PROFIT), 2) + ",";
    json += "\\"type\\": \\"" + EnumToString((ENUM_DEAL_TYPE)HistoryDealGetInteger(ticket, DEAL_TYPE)) + "\\",";
    json += "\\"timestamp\\": \\"" + TimeToString(TimeCurrent()) + "\\"";
    json += "}}]";
    
    WriteSignal(json);
}}

//+------------------------------------------------------------------+
//| Write signal to file                                               |
//+------------------------------------------------------------------+
void WriteSignal(string json)
{{
    int handle = FileOpen(SignalFile, FILE_WRITE|FILE_TXT|FILE_ANSI);
    if(handle != INVALID_HANDLE)
    {{
        FileWriteString(handle, json);
        FileClose(handle);
    }}
}}
//+------------------------------------------------------------------+
'''
    
    @staticmethod
    def save_ea_templates(output_dir: str, magic: int = 123456) -> None:
        """Save EA templates to directory"""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Signal Receiver
        receiver_path = output_path / "KIT_Signal_Receiver.mq5"
        receiver_path.write_text(EATemplateGenerator.generate_signal_receiver_ea(magic))
        
        # Signal Sender
        sender_path = output_path / "KIT_Signal_Sender.mq5"
        sender_path.write_text(EATemplateGenerator.generate_signal_sender_ea(magic))
        
        print(f"EA templates saved to {output_dir}")
        print(f"  - KIT_Signal_Receiver.mq5")
        print(f"  - KIT_Signal_Sender.mq5")


if __name__ == "__main__":
    print("🤖 K.I.T. Expert Advisor Bridge")
    print("=" * 50)
    
    bridge = MT5EABridge()
    
    print(f"\n📁 Signals Directory: {bridge.signals_dir}")
    print(f"📤 Outgoing File: {bridge.outgoing_file}")
    print(f"📥 Incoming File: {bridge.incoming_file}")
    
    # Generate EA templates
    print("\n📝 Generating EA Templates...")
    EATemplateGenerator.save_ea_templates("ea_templates")
    
    print("\n✅ EA Bridge ready!")
    print("\nUsage:")
    print("  bridge.send_buy('EURUSD', 0.1, sl=1.0850, tp=1.1000)")
    print("  bridge.send_sell('EURUSD', 0.1)")
    print("  bridge.send_close_all()")
