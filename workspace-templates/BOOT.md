# BOOT.md - Startup Checklist

K.I.T. executes this on gateway restart. Keep it short.

## Startup Tasks

1. Load configuration from config.json
2. Initialize connected platforms
3. Sync portfolio balances
4. Load active alerts and watchlist
5. Check for any pending notifications
6. Send startup confirmation (if Telegram configured)

## Startup Message

If Telegram is configured, send:
"🚗 K.I.T. online and ready. Portfolio: $X | Platforms: N connected | Alerts: N active"

## Recovery Tasks

If shutdown was unexpected:
- Check for any trades that need attention
- Verify no alerts were missed
- Resume autonomous monitoring
