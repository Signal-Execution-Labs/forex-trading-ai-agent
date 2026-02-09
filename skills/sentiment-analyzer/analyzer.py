"""
📊 K.I.T. Sentiment Analyzer
============================
Social Intelligence that KNOWS what the market feels!

Sources:
- Twitter/X real-time sentiment
- Reddit (WSB, r/cryptocurrency)
- News headlines
- Fear & Greed Index
- Social volume tracking
"""

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from enum import Enum
import json
import re
import aiohttp

# NLP Libraries
try:
    from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
    import torch
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

try:
    from textblob import TextBlob
    TEXTBLOB_AVAILABLE = True
except ImportError:
    TEXTBLOB_AVAILABLE = False

try:
    import tweepy
    TWEEPY_AVAILABLE = True
except ImportError:
    TWEEPY_AVAILABLE = False

try:
    import praw
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False

try:
    import nltk
    from nltk.sentiment import SentimentIntensityAnalyzer
    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False

logger = logging.getLogger("kit.sentiment-analyzer")


class SentimentMood(Enum):
    EXTREME_FEAR = "EXTREME_FEAR"
    FEAR = "FEAR"
    NEUTRAL = "NEUTRAL"
    GREED = "GREED"
    EXTREME_GREED = "EXTREME_GREED"


class SourceType(Enum):
    TWITTER = "twitter"
    REDDIT = "reddit"
    NEWS = "news"
    FEAR_GREED = "fear_greed"


@dataclass
class SentimentData:
    """Individual sentiment data point"""
    source: SourceType
    text: str
    score: float  # -1 to 1
    timestamp: datetime
    author: Optional[str] = None
    engagement: int = 0  # likes, upvotes, etc.
    url: Optional[str] = None
    keywords: List[str] = field(default_factory=list)


@dataclass
class SentimentResult:
    """Aggregated sentiment analysis result"""
    symbol: str
    timestamp: datetime
    score: float  # -1 (bearish) to 1 (bullish)
    mood: SentimentMood
    fear_greed_index: int  # 0-100
    social_volume: int
    volume_change: float  # % change vs average
    top_sources: List[SentimentData]
    breakdown: Dict[str, float]  # by source
    trending_keywords: List[Tuple[str, int]]
    influencer_mentions: List[Dict]
    alerts: List[str]
    
    def to_dict(self) -> dict:
        return {
            "symbol": self.symbol,
            "timestamp": self.timestamp.isoformat(),
            "score": round(self.score, 3),
            "mood": self.mood.value,
            "fear_greed_index": self.fear_greed_index,
            "social_volume": self.social_volume,
            "volume_change": f"{self.volume_change:+.1%}",
            "breakdown": {k: round(v, 3) for k, v in self.breakdown.items()},
            "trending": self.trending_keywords[:5],
            "alerts": self.alerts
        }


class TextSentimentAnalyzer:
    """
    Multi-model text sentiment analysis
    Uses FinBERT for financial text + VADER for general
    """
    
    def __init__(self):
        self.finbert = None
        self.vader = None
        self._initialized = False
        
    async def initialize(self):
        """Load sentiment models"""
        if self._initialized:
            return
            
        # FinBERT for financial sentiment
        if TRANSFORMERS_AVAILABLE:
            try:
                self.finbert = pipeline(
                    "sentiment-analysis",
                    model="ProsusAI/finbert",
                    device=-1  # CPU
                )
                logger.info("✅ FinBERT loaded")
            except Exception as e:
                logger.warning(f"FinBERT not available: {e}")
        
        # VADER for general sentiment
        if NLTK_AVAILABLE:
            try:
                nltk.download('vader_lexicon', quiet=True)
                self.vader = SentimentIntensityAnalyzer()
                logger.info("✅ VADER loaded")
            except Exception as e:
                logger.warning(f"VADER not available: {e}")
        
        self._initialized = True
    
    def analyze_text(self, text: str) -> float:
        """
        Analyze sentiment of text
        Returns score from -1 (bearish) to 1 (bullish)
        """
        scores = []
        
        # FinBERT analysis
        if self.finbert:
            try:
                result = self.finbert(text[:512])[0]  # Max 512 tokens
                label = result['label'].lower()
                confidence = result['score']
                
                if label == 'positive':
                    scores.append(confidence)
                elif label == 'negative':
                    scores.append(-confidence)
                else:
                    scores.append(0)
            except:
                pass
        
        # VADER analysis
        if self.vader:
            try:
                result = self.vader.polarity_scores(text)
                scores.append(result['compound'])
            except:
                pass
        
        # TextBlob fallback
        if TEXTBLOB_AVAILABLE and not scores:
            try:
                blob = TextBlob(text)
                scores.append(blob.sentiment.polarity)
            except:
                pass
        
        return sum(scores) / len(scores) if scores else 0


class TwitterSentiment:
    """
    Twitter/X sentiment analysis
    """
    
    def __init__(self, api_key: str = None, api_secret: str = None):
        self.api_key = api_key
        self.api_secret = api_secret
        self.client = None
        
        # Key crypto influencers
        self.influencers = [
            "elonmusk",
            "caborek",
            "VitalikButerin",
            "SBF_FTX",  # Historical
            "APompliano",
            "aantonop",
            "michael_saylor",
            "100trillionUSD",  # PlanB
        ]
        
    async def initialize(self):
        """Initialize Twitter client"""
        if TWEEPY_AVAILABLE and self.api_key:
            try:
                auth = tweepy.OAuthHandler(self.api_key, self.api_secret)
                self.client = tweepy.API(auth, wait_on_rate_limit=True)
                logger.info("✅ Twitter client initialized")
            except Exception as e:
                logger.warning(f"Twitter client failed: {e}")
    
    async def search_tweets(
        self,
        query: str,
        limit: int = 100
    ) -> List[SentimentData]:
        """Search recent tweets"""
        if not self.client:
            return self._mock_tweets(query, limit)
        
        tweets = []
        try:
            results = self.client.search_tweets(
                q=query,
                count=limit,
                result_type='recent',
                lang='en'
            )
            
            for tweet in results:
                tweets.append(SentimentData(
                    source=SourceType.TWITTER,
                    text=tweet.text,
                    score=0,  # Will be analyzed later
                    timestamp=tweet.created_at,
                    author=tweet.user.screen_name,
                    engagement=tweet.favorite_count + tweet.retweet_count,
                    url=f"https://twitter.com/{tweet.user.screen_name}/status/{tweet.id}"
                ))
        except Exception as e:
            logger.error(f"Twitter search failed: {e}")
            return self._mock_tweets(query, limit)
        
        return tweets
    
    def _mock_tweets(self, query: str, limit: int) -> List[SentimentData]:
        """Generate mock tweets for demo"""
        import random
        
        templates = [
            f"#{query} is looking bullish! 🚀 Moon soon! 💎🙌",
            f"Just bought more ${query}. This is the way. #HODL",
            f"${query} breaking out! Next stop $100k!",
            f"Bearish on #{query} short term. Waiting for dip.",
            f"${query} is dead. Selling everything. 📉",
            f"Neutral on ${query} right now. Watching closely.",
            f"${query} accumulation zone! Whales are buying! 🐋",
            f"FUD everywhere but I'm still holding ${query}",
            f"#{query} technical analysis: Golden cross forming! 📊",
            f"Regulation fears pushing ${query} down. BTFD! 💰",
        ]
        
        tweets = []
        for i in range(min(limit, len(templates))):
            tweets.append(SentimentData(
                source=SourceType.TWITTER,
                text=templates[i],
                score=0,
                timestamp=datetime.now() - timedelta(minutes=random.randint(1, 60)),
                author=f"crypto_trader_{i}",
                engagement=random.randint(10, 1000)
            ))
        
        return tweets
    
    async def get_influencer_tweets(
        self,
        username: str,
        limit: int = 10
    ) -> List[SentimentData]:
        """Get recent tweets from an influencer"""
        if not self.client:
            return []
        
        tweets = []
        try:
            results = self.client.user_timeline(
                screen_name=username,
                count=limit,
                tweet_mode='extended'
            )
            
            for tweet in results:
                tweets.append(SentimentData(
                    source=SourceType.TWITTER,
                    text=tweet.full_text,
                    score=0,
                    timestamp=tweet.created_at,
                    author=username,
                    engagement=tweet.favorite_count + tweet.retweet_count
                ))
        except Exception as e:
            logger.error(f"Failed to get {username} tweets: {e}")
        
        return tweets


class RedditSentiment:
    """
    Reddit sentiment analysis
    r/wallstreetbets, r/cryptocurrency, etc.
    """
    
    def __init__(
        self,
        client_id: str = None,
        client_secret: str = None,
        user_agent: str = "KIT-Bot/1.0"
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.user_agent = user_agent
        self.reddit = None
        
        # Subreddits to monitor
        self.subreddits = [
            "wallstreetbets",
            "cryptocurrency",
            "Bitcoin",
            "ethereum",
            "CryptoMarkets",
            "altcoin",
            "SatoshiStreetBets",
        ]
    
    async def initialize(self):
        """Initialize Reddit client"""
        if PRAW_AVAILABLE and self.client_id:
            try:
                self.reddit = praw.Reddit(
                    client_id=self.client_id,
                    client_secret=self.client_secret,
                    user_agent=self.user_agent
                )
                logger.info("✅ Reddit client initialized")
            except Exception as e:
                logger.warning(f"Reddit client failed: {e}")
    
    async def search_posts(
        self,
        query: str,
        subreddits: List[str] = None,
        limit: int = 50
    ) -> List[SentimentData]:
        """Search Reddit posts"""
        if not self.reddit:
            return self._mock_posts(query, limit)
        
        subreddits = subreddits or self.subreddits
        posts = []
        
        for sub_name in subreddits[:3]:  # Limit to avoid rate limits
            try:
                subreddit = self.reddit.subreddit(sub_name)
                results = subreddit.search(query, limit=limit // len(subreddits))
                
                for post in results:
                    posts.append(SentimentData(
                        source=SourceType.REDDIT,
                        text=f"{post.title}\n{post.selftext[:500]}",
                        score=0,
                        timestamp=datetime.fromtimestamp(post.created_utc),
                        author=str(post.author),
                        engagement=post.score + post.num_comments,
                        url=f"https://reddit.com{post.permalink}"
                    ))
            except Exception as e:
                logger.error(f"Reddit search in r/{sub_name} failed: {e}")
        
        return posts
    
    def _mock_posts(self, query: str, limit: int) -> List[SentimentData]:
        """Generate mock Reddit posts for demo"""
        import random
        
        templates = [
            (f"🚀 {query} TO THE MOON 🚀", "Diamond hands only! This is not financial advice but BUY BUY BUY! 💎🙌"),
            (f"DD: Why {query} will 10x", "I've done extensive research and the fundamentals are solid. Here's why..."),
            (f"Lost everything on {query}", "Bought at ATH, now I'm -80%. Should I sell or hold? 😭"),
            (f"{query} is a scam", "Rug pull incoming. Get out while you can. NFA"),
            (f"Just converted my 401k to {query}", "Wife's boyfriend approved. Let's gooo! 🦍"),
            (f"Technical Analysis: {query} forming bull flag", "Clear breakout incoming. Target: $100k"),
            (f"{query} whale alert! 🐋", "Someone just moved 10,000 coins. Bullish?"),
            (f"Unpopular opinion: {query} is overvalued", "Prove me wrong. The tokenomics don't make sense."),
        ]
        
        posts = []
        for i in range(min(limit, len(templates))):
            title, body = templates[i]
            posts.append(SentimentData(
                source=SourceType.REDDIT,
                text=f"{title}\n{body}",
                score=0,
                timestamp=datetime.now() - timedelta(hours=random.randint(1, 24)),
                author=f"WSB_ape_{i}",
                engagement=random.randint(100, 10000)
            ))
        
        return posts
    
    async def get_hot_posts(
        self,
        subreddit: str,
        limit: int = 25
    ) -> List[SentimentData]:
        """Get hot posts from a subreddit"""
        if not self.reddit:
            return []
        
        posts = []
        try:
            sub = self.reddit.subreddit(subreddit)
            for post in sub.hot(limit=limit):
                posts.append(SentimentData(
                    source=SourceType.REDDIT,
                    text=f"{post.title}\n{post.selftext[:500]}",
                    score=0,
                    timestamp=datetime.fromtimestamp(post.created_utc),
                    author=str(post.author),
                    engagement=post.score
                ))
        except Exception as e:
            logger.error(f"Failed to get hot posts from r/{subreddit}: {e}")
        
        return posts


class NewsSentiment:
    """
    Crypto news sentiment analysis
    """
    
    def __init__(self):
        self.sources = {
            "coindesk": "https://www.coindesk.com",
            "cointelegraph": "https://cointelegraph.com",
            "decrypt": "https://decrypt.co",
            "theblock": "https://www.theblock.co",
        }
    
    async def fetch_headlines(
        self,
        query: str = None,
        limit: int = 20
    ) -> List[SentimentData]:
        """Fetch recent crypto news headlines"""
        # In production, would use news APIs
        # For now, return mock headlines
        return self._mock_headlines(query, limit)
    
    def _mock_headlines(self, query: str, limit: int) -> List[SentimentData]:
        """Generate mock news headlines"""
        import random
        
        headlines = [
            "Bitcoin surges past $50,000 as institutional buying continues",
            "SEC approves spot Bitcoin ETF applications",
            "Ethereum completes major upgrade, gas fees plummet",
            "Crypto exchange reports record trading volume",
            "Major bank announces crypto custody services",
            "Regulatory crackdown fears send crypto markets tumbling",
            "Whale sells 10,000 BTC causing brief panic",
            "DeFi protocol hacked for $100 million",
            "Country announces Bitcoin as legal tender",
            "Fed interest rate decision impacts crypto markets",
            "Crypto lending firm files for bankruptcy",
            "NFT sales hit new all-time high",
        ]
        
        news = []
        for i in range(min(limit, len(headlines))):
            news.append(SentimentData(
                source=SourceType.NEWS,
                text=headlines[i],
                score=0,
                timestamp=datetime.now() - timedelta(hours=random.randint(1, 48)),
                author=random.choice(list(self.sources.keys())),
                engagement=0
            ))
        
        return news


class FearGreedIndex:
    """
    Crypto Fear & Greed Index integration
    """
    
    API_URL = "https://api.alternative.me/fng/"
    
    async def get_current(self) -> Tuple[int, str]:
        """Get current Fear & Greed Index"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(self.API_URL) as response:
                    data = await response.json()
                    
                    if data.get('data'):
                        current = data['data'][0]
                        return int(current['value']), current['value_classification']
        except Exception as e:
            logger.error(f"Fear & Greed API failed: {e}")
        
        # Fallback mock value
        return 50, "Neutral"
    
    async def get_historical(self, days: int = 30) -> List[Dict]:
        """Get historical Fear & Greed data"""
        try:
            async with aiohttp.ClientSession() as session:
                url = f"{self.API_URL}?limit={days}"
                async with session.get(url) as response:
                    data = await response.json()
                    return data.get('data', [])
        except:
            return []
    
    def interpret(self, value: int) -> SentimentMood:
        """Interpret Fear & Greed value"""
        if value <= 20:
            return SentimentMood.EXTREME_FEAR
        elif value <= 40:
            return SentimentMood.FEAR
        elif value <= 60:
            return SentimentMood.NEUTRAL
        elif value <= 80:
            return SentimentMood.GREED
        else:
            return SentimentMood.EXTREME_GREED


class SentimentEngine:
    """
    Main Sentiment Analysis Engine for K.I.T.
    Aggregates all sources for comprehensive market sentiment
    """
    
    def __init__(self, config: Optional[dict] = None):
        self.config = config or {}
        
        # Initialize components
        self.text_analyzer = TextSentimentAnalyzer()
        self.twitter = TwitterSentiment(
            api_key=self.config.get('twitter_api_key'),
            api_secret=self.config.get('twitter_api_secret')
        )
        self.reddit = RedditSentiment(
            client_id=self.config.get('reddit_client_id'),
            client_secret=self.config.get('reddit_client_secret')
        )
        self.news = NewsSentiment()
        self.fear_greed = FearGreedIndex()
        
        self._initialized = False
    
    async def initialize(self):
        """Initialize all sentiment sources"""
        if self._initialized:
            return
        
        await asyncio.gather(
            self.text_analyzer.initialize(),
            self.twitter.initialize(),
            self.reddit.initialize()
        )
        
        self._initialized = True
        logger.info("✅ Sentiment Engine initialized")
    
    async def analyze(
        self,
        symbol: str,
        sources: List[str] = None,
        time_window: int = 24  # hours
    ) -> SentimentResult:
        """
        Comprehensive sentiment analysis for a symbol
        
        Args:
            symbol: Asset symbol (e.g., "BTC", "ETH")
            sources: List of sources to use ["twitter", "reddit", "news"]
            time_window: Hours of data to analyze
            
        Returns:
            SentimentResult with aggregated sentiment
        """
        await self.initialize()
        
        sources = sources or ["twitter", "reddit", "news", "fear_greed"]
        
        logger.info(f"📊 Analyzing sentiment for {symbol}...")
        
        all_data: List[SentimentData] = []
        breakdown = {}
        
        # Gather data from all sources in parallel
        tasks = []
        
        if "twitter" in sources:
            tasks.append(("twitter", self.twitter.search_tweets(symbol, limit=100)))
        
        if "reddit" in sources:
            tasks.append(("reddit", self.reddit.search_posts(symbol, limit=50)))
        
        if "news" in sources:
            tasks.append(("news", self.news.fetch_headlines(symbol, limit=20)))
        
        # Execute all tasks
        results = await asyncio.gather(*[t[1] for t in tasks])
        
        for (source_name, _), data in zip(tasks, results):
            all_data.extend(data)
            
            # Analyze sentiment for each item
            source_scores = []
            for item in data:
                item.score = self.text_analyzer.analyze_text(item.text)
                source_scores.append(item.score)
            
            if source_scores:
                breakdown[source_name] = sum(source_scores) / len(source_scores)
        
        # Get Fear & Greed Index
        fg_value, fg_classification = await self.fear_greed.get_current()
        if "fear_greed" in sources:
            breakdown["fear_greed"] = (fg_value - 50) / 50  # Normalize to -1 to 1
        
        # Calculate overall sentiment
        if breakdown:
            # Weighted average (Twitter and Reddit weighted higher for crypto)
            weights = {"twitter": 0.35, "reddit": 0.35, "news": 0.2, "fear_greed": 0.1}
            total_score = 0
            total_weight = 0
            
            for source, score in breakdown.items():
                weight = weights.get(source, 0.1)
                total_score += score * weight
                total_weight += weight
            
            overall_score = total_score / total_weight if total_weight else 0
        else:
            overall_score = 0
        
        # Determine mood
        mood = self._score_to_mood(overall_score)
        
        # Calculate social volume
        social_volume = len(all_data)
        avg_volume = 100  # Would be calculated from historical data
        volume_change = (social_volume - avg_volume) / avg_volume
        
        # Extract trending keywords
        keywords = self._extract_keywords(all_data)
        
        # Get top sources by engagement
        top_sources = sorted(all_data, key=lambda x: x.engagement, reverse=True)[:10]
        
        # Generate alerts
        alerts = self._generate_alerts(overall_score, fg_value, volume_change, keywords)
        
        result = SentimentResult(
            symbol=symbol,
            timestamp=datetime.now(),
            score=overall_score,
            mood=mood,
            fear_greed_index=fg_value,
            social_volume=social_volume,
            volume_change=volume_change,
            top_sources=top_sources,
            breakdown=breakdown,
            trending_keywords=keywords[:10],
            influencer_mentions=[],
            alerts=alerts
        )
        
        logger.info(f"✅ Sentiment: {mood.value} (score: {overall_score:.2f})")
        
        return result
    
    def _score_to_mood(self, score: float) -> SentimentMood:
        """Convert sentiment score to mood"""
        if score <= -0.5:
            return SentimentMood.EXTREME_FEAR
        elif score <= -0.2:
            return SentimentMood.FEAR
        elif score <= 0.2:
            return SentimentMood.NEUTRAL
        elif score <= 0.5:
            return SentimentMood.GREED
        else:
            return SentimentMood.EXTREME_GREED
    
    def _extract_keywords(self, data: List[SentimentData]) -> List[Tuple[str, int]]:
        """Extract trending keywords from sentiment data"""
        keyword_counts = {}
        
        # Common crypto keywords to track
        keywords_to_find = [
            'moon', 'dump', 'pump', 'bull', 'bear', 'hodl', 'buy', 'sell',
            'dip', 'ath', 'fomo', 'fud', 'whale', 'breakout', 'support',
            'resistance', 'bullish', 'bearish', 'long', 'short', 'leverage',
            'liquidation', 'etf', 'halving', 'defi', 'nft', 'airdrop'
        ]
        
        for item in data:
            text_lower = item.text.lower()
            for keyword in keywords_to_find:
                if keyword in text_lower:
                    keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1
        
        # Sort by count
        return sorted(keyword_counts.items(), key=lambda x: x[1], reverse=True)
    
    def _generate_alerts(
        self,
        score: float,
        fear_greed: int,
        volume_change: float,
        keywords: List[Tuple[str, int]]
    ) -> List[str]:
        """Generate sentiment alerts"""
        alerts = []
        
        # Extreme sentiment alerts
        if score <= -0.6:
            alerts.append("🔴 EXTREME FEAR detected - Potential buying opportunity")
        elif score >= 0.6:
            alerts.append("🟢 EXTREME GREED detected - Consider taking profits")
        
        # Fear & Greed alerts
        if fear_greed <= 20:
            alerts.append(f"😱 Fear & Greed Index at {fear_greed} - Market in extreme fear")
        elif fear_greed >= 80:
            alerts.append(f"🤑 Fear & Greed Index at {fear_greed} - Market in extreme greed")
        
        # Volume alerts
        if volume_change > 1.0:
            alerts.append(f"📈 Social volume +{volume_change:.0%} above average")
        elif volume_change < -0.5:
            alerts.append(f"📉 Social volume {volume_change:.0%} below average")
        
        # Keyword alerts
        top_keywords = [kw for kw, count in keywords[:5] if count > 10]
        if 'dump' in top_keywords or 'crash' in top_keywords:
            alerts.append("⚠️ High mentions of 'dump/crash' - Be cautious")
        if 'moon' in top_keywords or 'pump' in top_keywords:
            alerts.append("🚀 High mentions of 'moon/pump' - FOMO alert")
        
        return alerts
    
    async def track_influencer(
        self,
        username: str,
        keywords: List[str] = None
    ) -> List[Dict]:
        """Track tweets from a specific influencer"""
        await self.initialize()
        
        tweets = await self.twitter.get_influencer_tweets(username, limit=20)
        
        results = []
        for tweet in tweets:
            tweet.score = self.text_analyzer.analyze_text(tweet.text)
            
            # Check for keyword mentions
            matches = []
            if keywords:
                for kw in keywords:
                    if kw.lower() in tweet.text.lower():
                        matches.append(kw)
            
            results.append({
                "text": tweet.text,
                "score": tweet.score,
                "timestamp": tweet.timestamp.isoformat(),
                "engagement": tweet.engagement,
                "keyword_matches": matches
            })
        
        return results
    
    async def get_trending(self, limit: int = 10) -> List[Dict]:
        """Get trending crypto topics across all sources"""
        await self.initialize()
        
        # Gather data from all sources
        twitter_data = await self.twitter.search_tweets("crypto OR bitcoin OR ethereum", limit=100)
        reddit_data = await self.reddit.search_posts("crypto", limit=50)
        
        all_data = twitter_data + reddit_data
        keywords = self._extract_keywords(all_data)
        
        return [
            {"keyword": kw, "mentions": count, "trending_score": count / len(all_data)}
            for kw, count in keywords[:limit]
        ]


# CLI Demo
if __name__ == "__main__":
    async def demo():
        print("📊 K.I.T. Sentiment Analyzer Demo")
        print("=" * 50)
        
        engine = SentimentEngine()
        
        # Analyze BTC sentiment
        result = await engine.analyze(
            symbol="BTC",
            sources=["twitter", "reddit", "news", "fear_greed"]
        )
        
        print("\n🔍 BTC Sentiment Analysis:")
        print(json.dumps(result.to_dict(), indent=2))
        
        # Top sources
        print("\n📰 Top Sentiment Sources:")
        for source in result.top_sources[:5]:
            emoji = "🟢" if source.score > 0.2 else "🔴" if source.score < -0.2 else "⚪"
            print(f"  {emoji} [{source.source.value}] {source.text[:60]}...")
        
        # Alerts
        if result.alerts:
            print("\n⚠️ Alerts:")
            for alert in result.alerts:
                print(f"  {alert}")
        
        # Trending
        print("\n📈 Trending Keywords:")
        trending = await engine.get_trending(limit=5)
        for t in trending:
            print(f"  #{t['keyword']}: {t['mentions']} mentions")
    
    asyncio.run(demo())
