---
name: news-tracker
description: "Track crypto news, analyze sentiment, monitor events calendar, and social media for trading insights."
metadata:
  {
    "openclaw":
      {
        "emoji": "📰",
        "requires": { "bins": ["python3", "curl"], "pip": ["requests", "feedparser", "beautifulsoup4"] }
      }
  }
---

# News Tracker

Stay informed on crypto news and market sentiment.

## Overview

- **News Aggregation** - Top crypto news sources
- **Sentiment Analysis** - Bullish/bearish signals from headlines
- **Event Calendar** - Upcoming launches, forks, etc.
- **Social Monitoring** - Twitter, Reddit trends

## News Sources

| Source | URL | Focus |
|--------|-----|-------|
| CoinDesk | coindesk.com | General crypto |
| CoinTelegraph | cointelegraph.com | News & analysis |
| The Block | theblock.co | Institutional |
| Decrypt | decrypt.co | DeFi, NFTs |
| CryptoSlate | cryptoslate.com | Market data |

## Commands

### Fetch Latest Crypto News

```bash
python3 -c "
import feedparser

feeds = [
    ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
    ('CoinTelegraph', 'https://cointelegraph.com/rss'),
]

print('📰 LATEST CRYPTO NEWS')
print('=' * 60)

for source, url in feeds:
    try:
        feed = feedparser.parse(url)
        print(f'\\n📌 {source}')
        for entry in feed.entries[:3]:
            print(f'  • {entry.title[:60]}...')
            print(f'    {entry.link}')
    except Exception as e:
        print(f'  ⚠️ Error: {e}')
"
```

### Search News for Specific Coin

```bash
python3 -c "
import requests
from bs4 import BeautifulSoup

coin = 'bitcoin'
url = f'https://cryptonews.com/news/{coin}-news/'

print(f'📰 NEWS SEARCH: {coin.upper()}')
print('=' * 60)

try:
    response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Find news items (structure may vary)
    articles = soup.find_all('article', limit=5)
    
    for article in articles:
        title = article.find(['h2', 'h3', 'a'])
        if title:
            print(f'• {title.get_text().strip()[:70]}')
except Exception as e:
    print(f'⚠️ Error fetching news: {e}')
"
```

### Simple Sentiment Analysis

```bash
python3 -c "
import feedparser
import re

# Simple keyword-based sentiment
bullish_words = ['surge', 'rally', 'breakout', 'bullish', 'soar', 'jump', 'gain', 'rise', 'ATH', 'moon', 'pump']
bearish_words = ['crash', 'dump', 'bearish', 'plunge', 'fall', 'drop', 'fear', 'sell-off', 'decline', 'tank']

feed = feedparser.parse('https://cointelegraph.com/rss')

bullish_count = 0
bearish_count = 0
headlines = []

for entry in feed.entries[:20]:
    title = entry.title.lower()
    headlines.append(entry.title)
    
    for word in bullish_words:
        if word.lower() in title:
            bullish_count += 1
            break
    
    for word in bearish_words:
        if word.lower() in title:
            bearish_count += 1
            break

total = bullish_count + bearish_count
if total > 0:
    bullish_pct = (bullish_count / total) * 100
    bearish_pct = (bearish_count / total) * 100
else:
    bullish_pct = bearish_pct = 50

print('📊 NEWS SENTIMENT ANALYSIS')
print('=' * 60)
print(f'Headlines analyzed: {len(headlines)}')
print(f'Bullish signals: {bullish_count}')
print(f'Bearish signals: {bearish_count}')
print()

# Visual bar
bar_len = 40
bull_bar = int(bullish_pct / 100 * bar_len)
print(f'🟢 Bullish [{\"█\" * bull_bar}{\"░\" * (bar_len - bull_bar)}] {bullish_pct:.0f}%')
print(f'🔴 Bearish [{\"█\" * (bar_len - bull_bar)}{\"░\" * bull_bar}] {bearish_pct:.0f}%')
print()

if bullish_pct > 60:
    print('📈 Overall Sentiment: BULLISH')
elif bearish_pct > 60:
    print('📉 Overall Sentiment: BEARISH')
else:
    print('⚪ Overall Sentiment: NEUTRAL')
"
```

### Crypto Events Calendar

```bash
python3 -c "
import requests
from datetime import datetime

# Using CoinMarketCal API (free tier)
url = 'https://api.coinmarketcal.com/v1/events'

# Mock data for demo (API requires key)
events = [
    {'title': 'Bitcoin Halving', 'date': '2028-04-XX', 'coin': 'BTC', 'impact': 'High'},
    {'title': 'Ethereum Dencun Upgrade', 'date': '2024-03-13', 'coin': 'ETH', 'impact': 'High'},
    {'title': 'SEC ETF Decision', 'date': '2024-05-XX', 'coin': 'BTC', 'impact': 'High'},
]

print('📅 CRYPTO EVENTS CALENDAR')
print('=' * 60)

# You can also check: https://coinmarketcal.com/en/
print('Sources: coinmarketcal.com, coingecko.com/en/events')
print()

for event in events:
    impact_emoji = '🔥' if event['impact'] == 'High' else '📌'
    print(f'{impact_emoji} [{event[\"coin\"]}] {event[\"title\"]}')
    print(f'   Date: {event[\"date\"]}')
    print()
"
```

### Twitter/X Crypto Trends

```bash
python3 -c "
import requests

# Note: Twitter API requires authentication
# This uses web scraping alternatives

print('🐦 CRYPTO TWITTER TRENDS')
print('=' * 60)
print('⚠️ Twitter API requires authentication')
print()
print('Manual check URLs:')
print('• https://twitter.com/search?q=%23bitcoin')
print('• https://twitter.com/search?q=%23ethereum')
print('• https://twitter.com/search?q=%24BTC')
print()
print('Top Crypto Influencers to Follow:')
print('• @WuBlockchain - News')
print('• @whale_alert - Large transactions')
print('• @santaboreal - Market analysis')
"
```

### Reddit Crypto Sentiment

```bash
python3 -c "
import requests

# Reddit API (no auth for public data)
subreddits = ['cryptocurrency', 'bitcoin', 'ethereum']

print('🔴 REDDIT CRYPTO SENTIMENT')
print('=' * 60)

for sub in subreddits:
    try:
        url = f'https://www.reddit.com/r/{sub}/hot.json?limit=5'
        headers = {'User-Agent': 'KIT-Bot/1.0'}
        response = requests.get(url, headers=headers, timeout=10)
        data = response.json()
        
        print(f'\\n📌 r/{sub}')
        for post in data['data']['children'][:3]:
            title = post['data']['title'][:60]
            score = post['data']['score']
            print(f'  [{score:>5}⬆] {title}...')
    except Exception as e:
        print(f'  ⚠️ Error: {e}')
"
```

### Whale Alert Monitor

```bash
curl -s "https://api.whale-alert.io/v1/status" | python3 -c "
import sys
import json

# Note: Whale Alert API requires API key for full access
# Free tier: limited to status endpoint

print('🐋 WHALE ALERT')
print('=' * 60)
print('Large crypto transactions tracker')
print()
print('Website: https://whale-alert.io')
print('Twitter: @whale_alert')
print()
print('Types of alerts:')
print('• Large BTC/ETH transfers')
print('• Exchange inflows/outflows')
print('• Whale wallet movements')
print()
print('⚠️ Full API requires subscription')
"
```

### Daily News Digest

```bash
python3 -c "
import feedparser
from datetime import datetime

sources = [
    ('CoinDesk', 'https://www.coindesk.com/arc/outboundfeeds/rss/'),
    ('CoinTelegraph', 'https://cointelegraph.com/rss'),
]

print(f'📰 DAILY CRYPTO DIGEST - {datetime.now().strftime(\"%Y-%m-%d\")}')
print('=' * 60)

all_news = []

for source, url in sources:
    try:
        feed = feedparser.parse(url)
        for entry in feed.entries[:5]:
            all_news.append({
                'source': source,
                'title': entry.title,
                'link': entry.link,
                'published': entry.get('published', '')
            })
    except:
        pass

# Sort by recency (if dates available)
print()
for i, news in enumerate(all_news[:10], 1):
    print(f'{i}. [{news[\"source\"]}] {news[\"title\"][:55]}...')

print()
print('📊 Market Overview Links:')
print('• https://www.coingecko.com/')
print('• https://coinmarketcap.com/')
print('• https://alternative.me/crypto/fear-and-greed-index/')
"
```

## Workflow

### Daily News Routine

1. **Morning** - Check Fear & Greed Index
2. **Review** - Top headlines from aggregators
3. **Twitter** - Whale alerts, influencer posts
4. **Events** - Upcoming catalyst calendar
5. **Reddit** - Community sentiment

### News Impact Assessment

| Event Type | Potential Impact | Action |
|------------|-----------------|--------|
| ETF approval | Very High | Prepare positions |
| Exchange hack | High (negative) | Risk-off |
| Protocol upgrade | Medium | Research |
| Partnership | Low-Medium | Monitor |
| Regulatory news | Variable | Analyze |

### Sentiment Signals

| Signal | Meaning | Trading Implication |
|--------|---------|---------------------|
| Extreme Fear (< 20) | Market oversold | Potential buy zone |
| Fear (20-40) | Uncertainty | Cautious |
| Neutral (40-60) | Balanced | Normal trading |
| Greed (60-80) | Optimism | Take some profits |
| Extreme Greed (> 80) | Euphoria | High risk, reduce exposure |

### Alert Keywords

Monitor headlines for:
- **Bullish**: approval, adoption, institutional, breakthrough
- **Bearish**: hack, regulation, ban, lawsuit, dump
- **Neutral**: update, announce, launch, report
