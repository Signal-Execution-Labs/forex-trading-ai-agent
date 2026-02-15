# Trade Journaling AI

AI-powered trade journaling with psychological analysis and pattern detection.

## Features

- **Automatic Trade Import** - Sync trades from all connected exchanges
- **AI Trade Review** - GPT analyzes each trade for lessons
- **Emotional Tracking** - Log emotions and detect patterns
- **Mistake Detection** - AI identifies recurring mistakes
- **Setup Tagging** - Auto-tag setups based on entry patterns
- **Performance Analytics** - Deep stats by setup, time, asset
- **Improvement Suggestions** - Personalized coaching from AI
- **Voice Notes** - Record verbal analysis of trades

## Commands

```
kit journal add                    # Add trade manually
kit journal import                 # Import from exchanges
kit journal review <trade>         # AI review of trade
kit journal emotions               # Emotion pattern analysis
kit journal mistakes               # Common mistake report
kit journal stats                  # Performance statistics
kit journal improve                # Get improvement suggestions
```

## API Endpoints

- `POST /api/journal/add` - Add trade entry
- `POST /api/journal/import` - Import trades
- `GET /api/journal/trades` - List trades
- `GET /api/journal/review/:id` - AI trade review
- `GET /api/journal/emotions` - Emotion patterns
- `GET /api/journal/mistakes` - Mistake analysis
- `GET /api/journal/stats` - Statistics
- `GET /api/journal/coaching` - AI coaching

## Emotional States Tracked

- Confident, Fearful, Neutral
- Greedy, FOMO, Revenge
- Panic, Relieved, Bored
- Overconfident, Frustrated

## Configuration

```yaml
journal:
  auto_import: true
  import_interval: 1h
  ai_review: true
  emotion_prompts: true           # Ask for emotions after trades
  voice_notes: true
  photo_attachments: true         # Screenshot charts
  ai_model: gpt-4
```

## AI Coaching Features

- Weekly performance reviews
- Pattern recognition across trades
- "What would you do differently?"
- Risk management scoring
- Consistency metrics
- Comparison to best traders
