# Milestone Tracker Hook

Tracks and celebrates significant trading milestones to keep you motivated.

## Events

- `trade_closed` - Triggered when a trade is closed

## Features

### Profit Milestones
- $100, $500, $1K, $5K, $10K, $50K, $100K

### Trade Count Milestones  
- 1, 10, 25, 50, 100, 250, 500, 1000 winning trades

### Win Streak Milestones
- 3, 5, 7, 10, 15, 20 consecutive wins

### Special Achievements
- First winning trade celebration

## State File

Milestones are stored in `~/.kit/milestones.json`

## Example Output

```
[milestone-tracker] 🎉 First winning trade! Your K.I.T. journey begins!
[milestone-tracker] 💰 Profit milestone reached: $1K total profit!
[milestone-tracker] 🔥 5-trade winning streak! You're on fire!
```

## Integration

Can be extended to send notifications via:
- Telegram messages
- Discord webhooks  
- Push notifications
- Email alerts
