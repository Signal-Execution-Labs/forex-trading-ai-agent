#!/usr/bin/env python3
"""
K.I.T. News Digest - Aggregate crypto news
Usage:
    python news_digest.py
    python news_digest.py --sentiment
"""

import argparse
import feedparser
from datetime import datetime

FEEDS = [
    ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
    ('CoinTelegraph', 'https://cointelegraph.com/rss'),
]

BULLISH_WORDS = ['surge', 'rally', 'breakout', 'bullish', 'soar', 'jump', 
                 'gain', 'rise', 'ATH', 'moon', 'pump', 'adoption', 'approval']
BEARISH_WORDS = ['crash', 'dump', 'bearish', 'plunge', 'fall', 'drop', 
                 'fear', 'sell-off', 'decline', 'tank', 'ban', 'hack']

def fetch_news():
    all_news = []
    for source, url in FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                all_news.append({
                    'source': source,
                    'title': entry.title,
                    'link': entry.link,
                    'published': entry.get('published', '')
                })
        except Exception as e:
            print(f"⚠️ Error with {source}: {e}")
    return all_news

def analyze_sentiment(headlines):
    bullish = 0
    bearish = 0
    
    for title in headlines:
        title_lower = title.lower()
        for word in BULLISH_WORDS:
            if word in title_lower:
                bullish += 1
                break
        for word in BEARISH_WORDS:
            if word in title_lower:
                bearish += 1
                break
    
    return bullish, bearish

def main():
    parser = argparse.ArgumentParser(description='K.I.T. News Digest')
    parser.add_argument('--sentiment', action='store_true', help='Analyze sentiment')
    args = parser.parse_args()
    
    news = fetch_news()
    
    print(f"📰 CRYPTO NEWS DIGEST - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    
    for i, item in enumerate(news[:10], 1):
        print(f"{i}. [{item['source']}] {item['title'][:55]}...")
    
    if args.sentiment:
        headlines = [item['title'] for item in news]
        bullish, bearish = analyze_sentiment(headlines)
        total = bullish + bearish
        
        print()
        print("📊 SENTIMENT ANALYSIS")
        print("-" * 60)
        print(f"Bullish signals: {bullish}")
        print(f"Bearish signals: {bearish}")
        
        if total > 0:
            bull_pct = (bullish / total) * 100
            if bull_pct > 60:
                print("📈 Overall: BULLISH")
            elif bull_pct < 40:
                print("📉 Overall: BEARISH")
            else:
                print("⚪ Overall: NEUTRAL")

if __name__ == '__main__':
    main()
