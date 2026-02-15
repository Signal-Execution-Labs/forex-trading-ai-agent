# Social Investor Feed

eToro-style social investing feed with AI-powered insights.

## Features

- **Investor Activity Stream** - Real-time trades, posts, and portfolio changes from followed investors
- **AI Trade Insights** - GPT-powered analysis of why top investors made specific trades
- **Popular Investor Discovery** - Find and filter top performers by strategy, risk, and returns
- **Trade Intent Signals** - See when investors are researching or about to enter positions
- **Community Sentiment** - Aggregate bullish/bearish sentiment from investor discussions
- **CopyTrader Integration** - One-click copy any investor's strategy or individual trade
- **Performance Verification** - Audited track records with verified broker connections

## Commands

```
kit social feed                    # View activity from followed investors
kit social discover                # Find new investors to follow
kit social trending                # See trending trades and ideas
kit social follow <investor>       # Follow an investor
kit social copy <investor>         # Start copying an investor
kit social insights <trade>        # AI analysis of a specific trade
```

## API Endpoints

- `GET /api/social/feed` - Personalized activity feed
- `GET /api/social/investors` - Discover popular investors
- `GET /api/social/trending` - Trending trades and discussions
- `POST /api/social/follow/:id` - Follow investor
- `POST /api/social/copy/:id` - Start copy trading
- `GET /api/social/insights/:tradeId` - AI trade analysis

## Configuration

```yaml
social:
  feed_refresh: 30s
  max_followed: 50
  copy_allocation: 10%        # Default allocation per copied investor
  ai_insights: true
  sentiment_analysis: true
```

## Data Sources

- eToro API (when available)
- On-chain wallet tracking
- Social media monitoring
- Internal user network
