# 📊 Sentiment Analyzer

**K.I.T.'s Social Intelligence - Know what the market FEELS before it moves!**

## Features

### 🐦 Twitter/X Sentiment
- Real-time crypto tweets analysis
- Influencer tracking (Elon, CZ, Vitalik, etc.)
- Hashtag volume monitoring
- Viral tweet detection

### 🤖 Reddit Sentiment
- r/wallstreetbets analysis
- r/cryptocurrency monitoring
- r/Bitcoin, r/ethereum tracking
- Meme coin detection
- FOMO/FUD scoring

### 📰 News Sentiment
- Crypto news headlines
- Bloomberg, Reuters, CoinDesk
- Breaking news alerts
- Regulatory news detection

### 😱 Fear & Greed Index
- Alternative.me integration
- Historical correlation analysis
- Extreme fear = BUY signals
- Extreme greed = SELL signals

### 📈 Social Volume
- Mention volume tracking
- Unusual activity detection
- Pump group monitoring
- Whale wallet tracking mentions

## Usage

```python
from sentiment_analyzer import SentimentEngine

engine = SentimentEngine()

# Get overall sentiment
sentiment = await engine.analyze(
    symbol="BTC",
    sources=["twitter", "reddit", "news"]
)

print(f"Overall: {sentiment.score:.2f}")  # -1 to 1
print(f"Mood: {sentiment.mood}")  # BULLISH/BEARISH/NEUTRAL
print(f"Fear & Greed: {sentiment.fear_greed}")
print(f"Social Volume: {sentiment.volume_change:+.1%}")

# Track specific influencer
alerts = await engine.track_influencer("elonmusk")

# Get trending topics
trending = await engine.get_trending(limit=10)
```

## Sentiment Signals

| Score | Interpretation | Action |
|-------|----------------|--------|
| > 0.7 | Extreme Greed | Consider selling |
| 0.3-0.7 | Bullish | Hold/accumulate |
| -0.3-0.3 | Neutral | Wait for signal |
| -0.7--0.3 | Bearish | Reduce exposure |
| < -0.7 | Extreme Fear | Consider buying |

## Configuration

```yaml
sentiment_analyzer:
  twitter:
    api_key: ${TWITTER_API_KEY}
    influencers:
      - elonmusk
      - caborek
      - VitalikButerin
    keywords:
      - bitcoin
      - crypto
      - ethereum
      
  reddit:
    client_id: ${REDDIT_CLIENT_ID}
    client_secret: ${REDDIT_CLIENT_SECRET}
    subreddits:
      - wallstreetbets
      - cryptocurrency
      - Bitcoin
      
  news:
    sources:
      - coindesk
      - cointelegraph
      - bloomberg
      
  alerts:
    extreme_sentiment: true
    influencer_tweets: true
    unusual_volume: true
```

## Dependencies
- tweepy>=4.14.0
- praw>=7.7.0
- transformers>=4.35.0
- nltk>=3.8.0
- textblob>=0.17.0
