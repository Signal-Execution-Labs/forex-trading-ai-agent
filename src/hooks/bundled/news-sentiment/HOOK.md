# 📰 News Sentiment Monitor

Monitors news sentiment for portfolio assets and alerts on significant sentiment shifts.

## Features
- Real-time news sentiment tracking
- AI-powered sentiment analysis
- Alert on negative sentiment spikes
- Watchlist integration

## Events
- `market:open` - Morning sentiment scan
- `signal:received` - Check news before acting on signals

## Configuration
```yaml
kit:
  triggers:
    - market:open
    - signal:received
  priority: 60
  requires:
    - news
```

## Sentiment Scores
- **Bullish**: 0.6 - 1.0
- **Neutral**: 0.4 - 0.6  
- **Bearish**: 0.0 - 0.4

---
```yaml
kit:
  triggers:
    - market:open
    - signal:received
  priority: 60
  emoji: 📰
  requires:
    - news
```
