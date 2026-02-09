"""
Session Timer - Trading Session Logic

Tracks major forex trading sessions and overlaps.
"""

from datetime import datetime, time, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from enum import Enum
import pytz


class SessionName(Enum):
    SYDNEY = "Sydney"
    TOKYO = "Tokyo"
    LONDON = "London"
    NEW_YORK = "New York"


@dataclass
class Session:
    """Trading session definition"""
    name: str
    emoji: str
    open_utc: time
    close_utc: time
    timezone: str
    currencies: List[str]
    volatility: str  # low, medium, high
    
    def is_open(self, utc_time: Optional[datetime] = None) -> bool:
        """Check if session is currently open"""
        if utc_time is None:
            utc_time = datetime.now(pytz.UTC)
        
        current_time = utc_time.time()
        
        # Handle overnight sessions (e.g., Sydney 22:00 - 07:00)
        if self.open_utc > self.close_utc:
            return current_time >= self.open_utc or current_time < self.close_utc
        else:
            return self.open_utc <= current_time < self.close_utc
    
    def time_until_open(self, utc_time: Optional[datetime] = None) -> timedelta:
        """Calculate time until session opens"""
        if utc_time is None:
            utc_time = datetime.now(pytz.UTC)
        
        if self.is_open(utc_time):
            return timedelta(0)
        
        # Create datetime for session open today
        today = utc_time.date()
        open_dt = datetime.combine(today, self.open_utc)
        open_dt = pytz.UTC.localize(open_dt)
        
        # If session already passed today, it opens tomorrow
        if utc_time.time() > self.open_utc:
            open_dt += timedelta(days=1)
        
        return open_dt - utc_time
    
    def time_until_close(self, utc_time: Optional[datetime] = None) -> timedelta:
        """Calculate time until session closes"""
        if utc_time is None:
            utc_time = datetime.now(pytz.UTC)
        
        if not self.is_open(utc_time):
            return timedelta(0)
        
        today = utc_time.date()
        close_dt = datetime.combine(today, self.close_utc)
        close_dt = pytz.UTC.localize(close_dt)
        
        # Handle overnight sessions
        if self.open_utc > self.close_utc and utc_time.time() >= self.open_utc:
            close_dt += timedelta(days=1)
        
        return close_dt - utc_time


# Define trading sessions (times in UTC)
SESSIONS = {
    'sydney': Session(
        name="Sydney",
        emoji="🌸",
        open_utc=time(22, 0),   # 22:00 UTC
        close_utc=time(7, 0),   # 07:00 UTC
        timezone="Australia/Sydney",
        currencies=["AUD", "NZD"],
        volatility="low"
    ),
    'tokyo': Session(
        name="Tokyo",
        emoji="🏯",
        open_utc=time(0, 0),    # 00:00 UTC
        close_utc=time(9, 0),   # 09:00 UTC
        timezone="Asia/Tokyo",
        currencies=["JPY", "AUD", "NZD"],
        volatility="medium"
    ),
    'london': Session(
        name="London",
        emoji="🏛️",
        open_utc=time(8, 0),    # 08:00 UTC
        close_utc=time(17, 0),  # 17:00 UTC
        timezone="Europe/London",
        currencies=["EUR", "GBP", "CHF"],
        volatility="high"
    ),
    'new_york': Session(
        name="New York",
        emoji="🗽",
        open_utc=time(13, 0),   # 13:00 UTC
        close_utc=time(22, 0),  # 22:00 UTC
        timezone="America/New_York",
        currencies=["USD", "CAD"],
        volatility="high"
    )
}


class SessionTimer:
    """
    Trading Session Monitor
    
    Usage:
        timer = SessionTimer()
        active = timer.get_active_sessions()
        status = timer.get_full_status()
    """
    
    def __init__(self, local_timezone: str = "UTC"):
        self.local_tz = pytz.timezone(local_timezone)
        self.sessions = SESSIONS
    
    def get_active_sessions(
        self, 
        utc_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get list of currently active sessions
        
        Returns:
            List of active session dictionaries
        """
        if utc_time is None:
            utc_time = datetime.now(pytz.UTC)
        
        active = []
        for key, session in self.sessions.items():
            if session.is_open(utc_time):
                until_close = session.time_until_close(utc_time)
                active.append({
                    'key': key,
                    'name': session.name,
                    'emoji': session.emoji,
                    'currencies': session.currencies,
                    'volatility': session.volatility,
                    'closes_in': str(until_close).split('.')[0],
                    'closes_in_hours': until_close.total_seconds() / 3600
                })
        
        return active
    
    def get_all_sessions_status(
        self, 
        utc_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get status of all sessions
        
        Returns:
            List of all sessions with their status
        """
        if utc_time is None:
            utc_time = datetime.now(pytz.UTC)
        
        result = []
        for key, session in self.sessions.items():
            is_open = session.is_open(utc_time)
            
            if is_open:
                time_info = session.time_until_close(utc_time)
                time_str = f"closes in {str(time_info).split('.')[0]}"
            else:
                time_info = session.time_until_open(utc_time)
                time_str = f"opens in {str(time_info).split('.')[0]}"
            
            result.append({
                'key': key,
                'name': session.name,
                'emoji': session.emoji,
                'is_open': is_open,
                'status': "OPEN" if is_open else "CLOSED",
                'time_info': time_str,
                'currencies': session.currencies,
                'volatility': session.volatility
            })
        
        return result
    
    def get_active_overlaps(
        self, 
        utc_time: Optional[datetime] = None
    ) -> List[Dict[str, Any]]:
        """
        Get currently active session overlaps
        
        Returns:
            List of active overlaps with trading recommendations
        """
        if utc_time is None:
            utc_time = datetime.now(pytz.UTC)
        
        active = self.get_active_sessions(utc_time)
        active_names = [s['name'] for s in active]
        
        overlaps = []
        
        # London + New York (most important overlap)
        if "London" in active_names and "New York" in active_names:
            overlaps.append({
                'sessions': ["London", "New York"],
                'emoji': "🔥",
                'volatility': "VERY HIGH",
                'best_pairs': ["EUR/USD", "GBP/USD", "USD/CHF", "EUR/GBP"],
                'description': "Best time for major pairs!"
            })
        
        # Tokyo + London
        if "Tokyo" in active_names and "London" in active_names:
            overlaps.append({
                'sessions': ["Tokyo", "London"],
                'emoji': "🌅",
                'volatility': "HIGH",
                'best_pairs': ["EUR/JPY", "GBP/JPY", "EUR/GBP"],
                'description': "Good for JPY and EUR crosses"
            })
        
        # Sydney + Tokyo
        if "Sydney" in active_names and "Tokyo" in active_names:
            overlaps.append({
                'sessions': ["Sydney", "Tokyo"],
                'emoji': "🌙",
                'volatility': "MODERATE",
                'best_pairs': ["AUD/JPY", "AUD/USD", "NZD/USD"],
                'description': "Quieter period, good for AUD/NZD"
            })
        
        return overlaps
    
    def get_best_time_for_pair(self, symbol: str) -> Dict[str, Any]:
        """
        Get best trading time recommendation for a pair
        
        Args:
            symbol: Currency pair (e.g., "EURUSD")
            
        Returns:
            Recommendation dictionary
        """
        symbol = symbol.upper().replace("/", "").replace("_", "")
        
        # Extract currencies
        base = symbol[:3]
        quote = symbol[3:] if len(symbol) >= 6 else "USD"
        
        recommendations = {
            'symbol': symbol,
            'base_currency': base,
            'quote_currency': quote,
            'best_sessions': [],
            'best_overlap': None,
            'recommended_times_utc': []
        }
        
        # Find relevant sessions
        for key, session in self.sessions.items():
            if base in session.currencies or quote in session.currencies:
                recommendations['best_sessions'].append({
                    'name': session.name,
                    'emoji': session.emoji,
                    'open': str(session.open_utc),
                    'close': str(session.close_utc)
                })
        
        # Recommend overlaps for majors
        if base in ["EUR", "GBP", "CHF"] and quote == "USD":
            recommendations['best_overlap'] = "London + New York (13:00-17:00 UTC)"
            recommendations['recommended_times_utc'] = ["13:00 - 17:00"]
        elif "JPY" in [base, quote] and any(c in [base, quote] for c in ["EUR", "GBP"]):
            recommendations['best_overlap'] = "Tokyo + London (08:00-09:00 UTC)"
            recommendations['recommended_times_utc'] = ["08:00 - 09:00", "13:00 - 16:00"]
        elif "AUD" in [base, quote] or "NZD" in [base, quote]:
            recommendations['best_overlap'] = "Sydney + Tokyo (00:00-07:00 UTC)"
            recommendations['recommended_times_utc'] = ["00:00 - 07:00"]
        
        return recommendations
    
    def get_volatility_level(
        self, 
        utc_time: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """
        Get current overall volatility level
        
        Returns:
            Volatility assessment
        """
        active = self.get_active_sessions(utc_time)
        overlaps = self.get_active_overlaps(utc_time)
        
        if overlaps and any(o['volatility'] == "VERY HIGH" for o in overlaps):
            level = "VERY HIGH"
            emoji = "🔥🔥🔥"
            description = "Multiple major sessions active with overlap"
        elif len(active) >= 2:
            level = "HIGH"
            emoji = "🔥🔥"
            description = "Multiple sessions active"
        elif len(active) == 1:
            level = "MODERATE"
            emoji = "🔥"
            description = f"Only {active[0]['name']} session active"
        else:
            level = "LOW"
            emoji = "💤"
            description = "Between sessions - low liquidity"
        
        return {
            'level': level,
            'emoji': emoji,
            'description': description,
            'active_sessions': len(active),
            'has_overlap': len(overlaps) > 0
        }


# Convenience functions
def get_active_sessions(timezone: str = "UTC") -> List[Dict[str, Any]]:
    """Quick function to get active sessions"""
    timer = SessionTimer(timezone)
    return timer.get_active_sessions()


def get_session_info(session_name: str) -> Optional[Session]:
    """Get info for a specific session"""
    return SESSIONS.get(session_name.lower())


def is_session_open(session_name: str) -> bool:
    """Check if a specific session is open"""
    session = SESSIONS.get(session_name.lower())
    return session.is_open() if session else False


def get_next_session_open() -> Dict[str, Any]:
    """Get the next session to open"""
    timer = SessionTimer()
    utc_now = datetime.now(pytz.UTC)
    
    next_session = None
    min_time = timedelta(days=2)
    
    for key, session in SESSIONS.items():
        if not session.is_open(utc_now):
            until_open = session.time_until_open(utc_now)
            if until_open < min_time:
                min_time = until_open
                next_session = {
                    'name': session.name,
                    'emoji': session.emoji,
                    'opens_in': str(until_open).split('.')[0],
                    'opens_in_hours': until_open.total_seconds() / 3600
                }
    
    return next_session


def format_session_status(timezone: str = "UTC") -> str:
    """Format a nice session status display"""
    timer = SessionTimer(timezone)
    utc_now = datetime.now(pytz.UTC)
    
    lines = []
    lines.append(f"🌍 TRADING SESSIONS - {utc_now.strftime('%d.%m.%Y %H:%M')} UTC\n")
    
    for status in timer.get_all_sessions_status():
        icon = "✅" if status['is_open'] else "⬜"
        lines.append(
            f"  {status['emoji']} {status['name']:<10} {icon} {status['status']:<7} "
            f"({status['time_info']})"
        )
    
    # Overlaps
    overlaps = timer.get_active_overlaps()
    if overlaps:
        lines.append("")
        for overlap in overlaps:
            lines.append(
                f"  {overlap['emoji']} OVERLAP: {' + '.join(overlap['sessions'])}"
            )
            lines.append(f"     Best for: {', '.join(overlap['best_pairs'])}")
    
    # Volatility
    vol = timer.get_volatility_level()
    lines.append(f"\n  📊 Volatility: {vol['emoji']} {vol['level']}")
    
    return "\n".join(lines)


# CLI for testing
if __name__ == "__main__":
    print(format_session_status())
    
    print("\n" + "=" * 50)
    print("Best time for EUR/USD:")
    timer = SessionTimer()
    rec = timer.get_best_time_for_pair("EURUSD")
    print(f"  Best overlap: {rec['best_overlap']}")
    print(f"  Recommended times: {rec['recommended_times_utc']}")
