#!/usr/bin/env python3
"""
K.I.T. Twitter Posting Engine
Post trading signals, analysis, and performance to Twitter/X
"""

import os
import json
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any
from dataclasses import dataclass, field
from enum import Enum

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TweetType(Enum):
    SIGNAL = "signal"
    ANALYSIS = "analysis"
    PERFORMANCE = "performance"
    ALERT = "alert"
    CUSTOM = "custom"


@dataclass
class Tweet:
    """Represents a tweet to be posted"""
    content: str
    tweet_type: TweetType
    image_path: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    hashtags: List[str] = field(default_factory=list)
    posted: bool = False
    tweet_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class SignalData:
    """Data for a trading signal tweet"""
    symbol: str
    action: str  # LONG/SHORT/BUY/SELL
    entry_price: float
    take_profit: List[float]
    stop_loss: float
    confidence: float = 0.7
    rsi: Optional[float] = None
    macd_status: Optional[str] = None
    timeframe: str = "4H"


@dataclass
class AnalysisData:
    """Data for an analysis tweet"""
    symbol: str
    timeframe: str
    trend: str
    bias: str
    support: float
    resistance: float
    rsi: float
    summary: str


@dataclass
class PerformanceData:
    """Data for a performance report tweet"""
    period: str  # daily/weekly/monthly
    total_trades: int
    wins: int
    losses: int
    total_pnl: float
    pnl_pct: float
    best_trade: Dict
    worst_trade: Dict
    top_performers: List[Dict]


class TweetFormatter:
    """Format data into tweet text"""
    
    # Default templates
    SIGNAL_TEMPLATE = """{emoji} {symbol} {action} Signal

📈 Entry: ${entry_price:,.2f}
{tp_lines}
🛑 Stop: ${stop_loss:,.2f} ({sl_pct})

{indicators}

⚡ Powered by K.I.T.
{hashtags}"""

    ANALYSIS_TEMPLATE = """📊 {symbol} {timeframe} Analysis

{summary}

Key Levels:
• Resistance: ${resistance:,.2f}
• Support: ${support:,.2f}

📈 RSI: {rsi:.0f}
📊 Trend: {trend}

Bias: {bias} {bias_emoji}

{hashtags}"""

    PERFORMANCE_TEMPLATE = """📈 K.I.T. {period} Performance

📊 Trades: {total_trades}
✅ Wins: {wins} ({win_rate:.0f}%)
❌ Losses: {losses}

💰 Total P&L: {pnl_sign}${pnl_abs:,.2f} ({pnl_pct_sign}{pnl_pct:.1f}%)

{top_performers}

#TradingResults #Performance"""

    ALERT_TEMPLATE = """⚠️ MARKET ALERT

{symbol} {alert_type}!

{message}

Price: ${price:,.2f}
Change: {change_sign}{change:.1f}%

{hashtags}"""

    @classmethod
    def format_signal(cls, data: SignalData, custom_template: str = None) -> str:
        """Format a signal into tweet text"""
        template = custom_template or cls.SIGNAL_TEMPLATE
        
        # Determine emoji based on action
        emoji = "🟢" if data.action.upper() in ["LONG", "BUY"] else "🔴"
        
        # Format take profit lines
        tp_lines = []
        for i, tp in enumerate(data.take_profit, 1):
            tp_pct = ((tp - data.entry_price) / data.entry_price) * 100
            sign = "+" if tp_pct > 0 else ""
            tp_lines.append(f"🎯 TP{i}: ${tp:,.2f} ({sign}{tp_pct:.1f}%)")
        
        # Calculate SL percentage
        sl_pct = ((data.stop_loss - data.entry_price) / data.entry_price) * 100
        sl_sign = "+" if sl_pct > 0 else ""
        
        # Format indicators
        indicators = []
        if data.rsi:
            rsi_status = "Overbought" if data.rsi > 70 else "Oversold" if data.rsi < 30 else "Neutral"
            indicators.append(f"📊 RSI: {data.rsi:.0f} ({rsi_status})")
        if data.macd_status:
            indicators.append(f"📈 MACD: {data.macd_status}")
        
        # Generate hashtags
        symbol_tag = data.symbol.replace("/", "").replace("-", "")
        hashtags = f"#{symbol_tag} #Crypto #Trading"
        
        return template.format(
            emoji=emoji,
            symbol=data.symbol,
            action=data.action.upper(),
            entry_price=data.entry_price,
            tp_lines="\n".join(tp_lines),
            stop_loss=data.stop_loss,
            sl_pct=f"{sl_sign}{sl_pct:.1f}%",
            indicators="\n".join(indicators) if indicators else "",
            hashtags=hashtags
        )
    
    @classmethod
    def format_analysis(cls, data: AnalysisData, custom_template: str = None) -> str:
        """Format analysis into tweet text"""
        template = custom_template or cls.ANALYSIS_TEMPLATE
        
        # Determine bias emoji
        bias_emoji = "🟢" if "BULL" in data.bias.upper() else "🔴" if "BEAR" in data.bias.upper() else "⚪"
        
        # Generate hashtags
        symbol_tag = data.symbol.replace("/", "").replace("-", "")
        hashtags = f"#{symbol_tag} #TechnicalAnalysis #Crypto"
        
        return template.format(
            symbol=data.symbol,
            timeframe=data.timeframe,
            trend=data.trend,
            bias=data.bias.upper(),
            bias_emoji=bias_emoji,
            support=data.support,
            resistance=data.resistance,
            rsi=data.rsi,
            summary=data.summary,
            hashtags=hashtags
        )
    
    @classmethod
    def format_performance(cls, data: PerformanceData, custom_template: str = None) -> str:
        """Format performance report into tweet text"""
        template = custom_template or cls.PERFORMANCE_TEMPLATE
        
        win_rate = (data.wins / data.total_trades * 100) if data.total_trades > 0 else 0
        
        # Format top performers
        top_lines = []
        medals = ["🥇", "🥈", "🥉"]
        for i, perf in enumerate(data.top_performers[:3]):
            medal = medals[i] if i < len(medals) else "•"
            sign = "+" if perf.get('pnl', 0) >= 0 else ""
            top_lines.append(f"{medal} {perf.get('symbol', 'N/A')} {sign}${abs(perf.get('pnl', 0)):,.0f}")
        
        return template.format(
            period=data.period.capitalize(),
            total_trades=data.total_trades,
            wins=data.wins,
            losses=data.losses,
            win_rate=win_rate,
            pnl_sign="+" if data.total_pnl >= 0 else "-",
            pnl_abs=abs(data.total_pnl),
            pnl_pct_sign="+" if data.pnl_pct >= 0 else "",
            pnl_pct=data.pnl_pct,
            top_performers="\n".join(top_lines) if top_lines else ""
        )


class RateLimiter:
    """Manage Twitter API rate limits"""
    
    def __init__(self, max_per_hour: int = 4, max_per_day: int = 20, 
                 min_interval_minutes: int = 15):
        self.max_per_hour = max_per_hour
        self.max_per_day = max_per_day
        self.min_interval = timedelta(minutes=min_interval_minutes)
        self.tweets_history: List[datetime] = []
    
    def can_post(self) -> tuple[bool, str]:
        """Check if we can post now"""
        now = datetime.now()
        
        # Clean old history
        self.tweets_history = [t for t in self.tweets_history 
                              if now - t < timedelta(days=1)]
        
        # Check daily limit
        if len(self.tweets_history) >= self.max_per_day:
            return False, f"Daily limit reached ({self.max_per_day})"
        
        # Check hourly limit
        hour_ago = now - timedelta(hours=1)
        recent_hour = [t for t in self.tweets_history if t > hour_ago]
        if len(recent_hour) >= self.max_per_hour:
            return False, f"Hourly limit reached ({self.max_per_hour})"
        
        # Check minimum interval
        if self.tweets_history:
            last_tweet = max(self.tweets_history)
            if now - last_tweet < self.min_interval:
                wait_time = self.min_interval - (now - last_tweet)
                return False, f"Wait {wait_time.seconds // 60} minutes"
        
        return True, "OK"
    
    def record_tweet(self):
        """Record a tweet was posted"""
        self.tweets_history.append(datetime.now())


class TwitterPoster:
    """Main Twitter posting engine"""
    
    def __init__(self, config: Dict = None):
        self.config = config or {}
        self.rate_limiter = RateLimiter(
            max_per_hour=self.config.get('rate_limits', {}).get('max_per_hour', 4),
            max_per_day=self.config.get('rate_limits', {}).get('max_per_day', 20),
            min_interval_minutes=self.config.get('rate_limits', {}).get('min_interval_minutes', 15)
        )
        self.queue: List[Tweet] = []
        self.history: List[Tweet] = []
        self.client = None  # Would be tweepy client in production
        
        # Auto-post settings
        self.auto_post_signals = self.config.get('auto_post', {}).get('signals', True)
        self.auto_post_analysis = self.config.get('auto_post', {}).get('analysis', True)
        self.auto_post_performance = self.config.get('auto_post', {}).get('performance', True)
    
    def initialize_client(self, credentials: Dict) -> bool:
        """Initialize Twitter API client"""
        try:
            # In production, would initialize tweepy here:
            # import tweepy
            # self.client = tweepy.Client(
            #     consumer_key=credentials['api_key'],
            #     consumer_secret=credentials['api_secret'],
            #     access_token=credentials['access_token'],
            #     access_token_secret=credentials['access_secret']
            # )
            logger.info("Twitter client initialized (simulation mode)")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Twitter client: {e}")
            return False
    
    def post_signal(self, signal_data: SignalData, immediate: bool = False) -> Dict:
        """Post a trading signal"""
        content = TweetFormatter.format_signal(signal_data)
        
        tweet = Tweet(
            content=content,
            tweet_type=TweetType.SIGNAL,
            hashtags=["#Crypto", "#Trading", f"#{signal_data.symbol.replace('/', '')}"]
        )
        
        if immediate:
            return self._post_tweet(tweet)
        else:
            self.queue.append(tweet)
            return {"status": "queued", "position": len(self.queue)}
    
    def post_analysis(self, analysis_data: AnalysisData, 
                      chart_path: str = None, immediate: bool = False) -> Dict:
        """Post market analysis"""
        content = TweetFormatter.format_analysis(analysis_data)
        
        tweet = Tweet(
            content=content,
            tweet_type=TweetType.ANALYSIS,
            image_path=chart_path
        )
        
        if immediate:
            return self._post_tweet(tweet)
        else:
            self.queue.append(tweet)
            return {"status": "queued", "position": len(self.queue)}
    
    def post_performance(self, perf_data: PerformanceData, 
                         chart_path: str = None, immediate: bool = False) -> Dict:
        """Post performance report"""
        content = TweetFormatter.format_performance(perf_data)
        
        tweet = Tweet(
            content=content,
            tweet_type=TweetType.PERFORMANCE,
            image_path=chart_path
        )
        
        if immediate:
            return self._post_tweet(tweet)
        else:
            self.queue.append(tweet)
            return {"status": "queued", "position": len(self.queue)}
    
    def post_custom(self, content: str, image_path: str = None, 
                    immediate: bool = True) -> Dict:
        """Post a custom tweet"""
        tweet = Tweet(
            content=content,
            tweet_type=TweetType.CUSTOM,
            image_path=image_path
        )
        
        if immediate:
            return self._post_tweet(tweet)
        else:
            self.queue.append(tweet)
            return {"status": "queued", "position": len(self.queue)}
    
    def _post_tweet(self, tweet: Tweet) -> Dict:
        """Actually post a tweet"""
        # Check rate limits
        can_post, reason = self.rate_limiter.can_post()
        if not can_post:
            return {"status": "rate_limited", "reason": reason}
        
        # Validate content length
        if len(tweet.content) > 280:
            return {"status": "error", "reason": "Tweet exceeds 280 characters"}
        
        try:
            # In production, would post via tweepy:
            # if tweet.image_path:
            #     media = self.client.media_upload(tweet.image_path)
            #     response = self.client.create_tweet(text=tweet.content, media_ids=[media.media_id])
            # else:
            #     response = self.client.create_tweet(text=tweet.content)
            
            # Simulation
            tweet.posted = True
            tweet.tweet_id = f"sim_{datetime.now().strftime('%Y%m%d%H%M%S')}"
            
            self.rate_limiter.record_tweet()
            self.history.append(tweet)
            
            logger.info(f"Tweet posted: {tweet.tweet_id}")
            
            return {
                "status": "posted",
                "tweet_id": tweet.tweet_id,
                "content": tweet.content[:100] + "..." if len(tweet.content) > 100 else tweet.content,
                "url": f"https://twitter.com/KITBot/status/{tweet.tweet_id}"
            }
            
        except Exception as e:
            logger.error(f"Failed to post tweet: {e}")
            return {"status": "error", "reason": str(e)}
    
    def process_queue(self) -> List[Dict]:
        """Process queued tweets"""
        results = []
        while self.queue:
            can_post, _ = self.rate_limiter.can_post()
            if not can_post:
                break
            
            tweet = self.queue.pop(0)
            result = self._post_tweet(tweet)
            results.append(result)
        
        return results
    
    def get_history(self, limit: int = 10, tweet_type: TweetType = None) -> List[Dict]:
        """Get tweet history"""
        tweets = self.history
        if tweet_type:
            tweets = [t for t in tweets if t.tweet_type == tweet_type]
        
        return [
            {
                "id": t.tweet_id,
                "type": t.tweet_type.value,
                "content": t.content[:100] + "..." if len(t.content) > 100 else t.content,
                "created_at": t.created_at.isoformat(),
                "has_image": t.image_path is not None
            }
            for t in tweets[-limit:]
        ]
    
    def get_stats(self) -> Dict:
        """Get posting statistics"""
        now = datetime.now()
        today = [t for t in self.history 
                if t.created_at.date() == now.date()]
        this_week = [t for t in self.history 
                    if now - t.created_at < timedelta(days=7)]
        
        by_type = {}
        for t in self.history:
            type_name = t.tweet_type.value
            by_type[type_name] = by_type.get(type_name, 0) + 1
        
        return {
            "total_tweets": len(self.history),
            "today": len(today),
            "this_week": len(this_week),
            "queue_size": len(self.queue),
            "by_type": by_type
        }


def main():
    """CLI interface for Twitter posting"""
    import argparse
    
    parser = argparse.ArgumentParser(description='K.I.T. Twitter Poster')
    subparsers = parser.add_subparsers(dest='command')
    
    # Post signal command
    signal_parser = subparsers.add_parser('signal', help='Post a signal')
    signal_parser.add_argument('symbol', help='Trading pair (e.g., BTC/USDT)')
    signal_parser.add_argument('action', choices=['LONG', 'SHORT', 'BUY', 'SELL'])
    signal_parser.add_argument('entry', type=float, help='Entry price')
    signal_parser.add_argument('--tp', type=float, nargs='+', help='Take profit levels')
    signal_parser.add_argument('--sl', type=float, help='Stop loss')
    
    # Post analysis command
    analysis_parser = subparsers.add_parser('analysis', help='Post analysis')
    analysis_parser.add_argument('symbol', help='Trading pair')
    analysis_parser.add_argument('--timeframe', '-t', default='4H')
    analysis_parser.add_argument('--bias', default='NEUTRAL')
    
    # Post custom command
    custom_parser = subparsers.add_parser('post', help='Post custom tweet')
    custom_parser.add_argument('content', help='Tweet content')
    custom_parser.add_argument('--image', '-i', help='Image path')
    
    # Stats command
    stats_parser = subparsers.add_parser('stats', help='Show statistics')
    
    # History command
    history_parser = subparsers.add_parser('history', help='Show tweet history')
    history_parser.add_argument('--limit', '-l', type=int, default=10)
    
    args = parser.parse_args()
    
    poster = TwitterPoster()
    
    if args.command == 'signal':
        signal = SignalData(
            symbol=args.symbol,
            action=args.action,
            entry_price=args.entry,
            take_profit=args.tp or [args.entry * 1.03],
            stop_loss=args.sl or args.entry * 0.98
        )
        result = poster.post_signal(signal, immediate=True)
        print(json.dumps(result, indent=2))
    
    elif args.command == 'analysis':
        analysis = AnalysisData(
            symbol=args.symbol,
            timeframe=args.timeframe,
            trend="Uptrend",
            bias=args.bias,
            support=0,
            resistance=0,
            rsi=50,
            summary=f"Analysis for {args.symbol}"
        )
        result = poster.post_analysis(analysis, immediate=True)
        print(json.dumps(result, indent=2))
    
    elif args.command == 'post':
        result = poster.post_custom(args.content, args.image)
        print(json.dumps(result, indent=2))
    
    elif args.command == 'stats':
        stats = poster.get_stats()
        print(json.dumps(stats, indent=2))
    
    elif args.command == 'history':
        history = poster.get_history(limit=args.limit)
        for tweet in history:
            print(f"\n{tweet['created_at']} [{tweet['type']}]")
            print(f"  {tweet['content']}")
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
