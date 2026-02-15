# K.I.T. Examples

## autonomous-trader.py

A complete autonomous trading bot that:
- Fetches real-time prices from CoinGecko (crypto) and forex APIs
- Analyzes markets with trend detection and momentum indicators
- Makes autonomous buy/sell decisions based on confidence scores
- Manages positions with stop-loss and take-profit
- Tracks P&L, win rate, and other statistics
- Generates daily reports

### Usage

```bash
# Run trading cycle
python autonomous-trader.py

# Generate report only
python autonomous-trader.py --report
```

### Configuration

Edit `config.json` to customize:
- Starting capital
- Risk management (max position size, stop-loss %, take-profit %)
- Enabled markets (crypto, forex, indices)
- Minimum confidence score for trades
- Reporting settings

### Files

- `config.json` - Trading configuration
- `state.json` - Current portfolio state and trade history
- `logs/` - Detailed trading logs

### Scheduled Trading

For 24/7 autonomous trading, set up a cron job or Windows Task Scheduler:

**Linux/Mac:**
```bash
# Every 4 hours
0 */4 * * * cd /path/to/kit && python autonomous-trader.py
```

**Windows:**
```powershell
# Create scheduled task
$action = New-ScheduledTaskAction -Execute "python" -Argument "C:\kit\autonomous-trader.py"
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 4)
Register-ScheduledTask -TaskName "KIT-Trading" -Action $action -Trigger $trigger
```

### Risk Warning

⚠️ This is for paper trading/testing only. Real money trading carries significant risk.
Always test strategies thoroughly before using real funds.
