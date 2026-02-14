# 📊 Correlation Monitor

Tracks correlation changes between portfolio assets and alerts when correlations shift significantly.

## Features
- Real-time correlation matrix monitoring
- Alert when correlation breaks down or spikes
- Diversification warnings
- Rolling correlation analysis (30d, 90d windows)

## Events
- `portfolio:changed` - Recalculates correlations when positions change
- `market:close` - Daily correlation update

## Configuration
```yaml
kit:
  triggers:
    - portfolio:changed
    - market:close
  priority: 50
  requires:
    - portfolio
```

## Output
- Daily correlation report to workspace/reports/
- Alerts when correlation exceeds 0.8 threshold

---
```yaml
kit:
  triggers:
    - portfolio:changed
    - market:close
  priority: 50
  emoji: 📊
  requires:
    - portfolio
```
