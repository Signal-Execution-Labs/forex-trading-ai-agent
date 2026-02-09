"""
Session Timer - Trading Session Monitor für K.I.T.

Zeigt aktive Trading Sessions (London, New York, Tokyo, Sydney)
und optimale Trading-Zeiten mit Session Overlaps.

Usage:
    from skills.session_timer import SessionTimer, get_active_sessions
    
    timer = SessionTimer()
    active = timer.get_active_sessions()
    print(f"Active: {[s['name'] for s in active]}")
"""

from .sessions import (
    SessionTimer,
    Session,
    get_active_sessions,
    get_session_info,
    is_session_open,
    get_next_session_open,
    format_session_status,
    SESSIONS
)

__version__ = "1.0.0"
__all__ = [
    'SessionTimer',
    'Session',
    'get_active_sessions',
    'get_session_info',
    'is_session_open',
    'get_next_session_open',
    'format_session_status',
    'SESSIONS'
]
