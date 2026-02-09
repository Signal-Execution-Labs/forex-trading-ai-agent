# Trade Journal 📔

Automatisches Trading-Tagebuch. Dokumentiert jeden Trade mit Screenshots, Notizen und Performance-Statistiken.

## Trigger Keywords

- journal, tagebuch, trade journal
- log trade, trade eintragen
- meine trades, trade history
- performance, statistiken
- review trades, analyse

## Features

- **Automatisches Logging**: Jeder Trade wird automatisch erfasst
- **Screenshots**: Chart-Screenshots beim Entry/Exit
- **Notizen**: Begründung für jeden Trade
- **Statistiken**: Win Rate, Profit Factor, Drawdown
- **Export**: CSV, Excel, PDF Reports
- **Tags**: Kategorisiere Trades (Breakout, Reversal, News, etc.)

## Beispiele

```
"K.I.T., zeige meine Trades von heute"
"Trade Journal für letzte Woche"
"Was war mein bester Trade diesen Monat?"
"Analysiere meine Performance bei EURUSD"
"Füge Notiz hinzu: Trade #123 - Zu früh eingestiegen"
```

## Trade Entry Format

```json
{
  "id": "T2026020901",
  "symbol": "EURUSD",
  "direction": "buy",
  "entry_time": "2026-02-09T14:30:00Z",
  "entry_price": 1.0850,
  "exit_time": "2026-02-09T16:45:00Z",
  "exit_price": 1.0892,
  "lot_size": 0.1,
  "pips": 42,
  "profit": 42.00,
  "setup": "London Breakout",
  "tags": ["breakout", "trend-following"],
  "notes": "Clean break above resistance",
  "screenshot": "screenshots/T2026020901.png"
}
```

## API

```python
from skills.trade_journal import TradeJournal, Trade

# Journal initialisieren
journal = TradeJournal("./journal_data")

# Trade hinzufügen
trade = Trade(
    symbol="EURUSD",
    direction="buy",
    entry_price=1.0850,
    exit_price=1.0892,
    lot_size=0.1,
    setup="London Breakout",
    notes="Clean break above resistance"
)
journal.add_trade(trade)

# Statistiken abrufen
stats = journal.get_statistics(period="month")
print(f"Win Rate: {stats['win_rate']}%")
print(f"Profit Factor: {stats['profit_factor']}")
print(f"Total P&L: ${stats['total_profit']}")

# Trades filtern
eurusd_trades = journal.get_trades(symbol="EURUSD", period="week")
```

## Statistiken

| Metrik | Beschreibung |
|--------|--------------|
| Win Rate | % gewinnende Trades |
| Profit Factor | Gross Profit / Gross Loss |
| Average Win | Durchschnittlicher Gewinn |
| Average Loss | Durchschnittlicher Verlust |
| Largest Win | Größter Gewinn |
| Largest Loss | Größter Verlust |
| Max Drawdown | Maximaler Rückgang |
| Expectancy | Erwartungswert pro Trade |
| R-Multiple | Vielfaches des Risikos |

## Report Beispiel

```
📔 K.I.T. TRADE JOURNAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Periode: 01.02.2026 - 09.02.2026

📊 OVERVIEW
   Total Trades:     42
   Winning Trades:   28 (66.7%)
   Losing Trades:    14 (33.3%)

💰 PERFORMANCE
   Total Profit:     $1,234.50
   Profit Factor:    2.35
   Average Win:      $67.50
   Average Loss:     -$32.10

📈 BEST PERFORMERS
   1. EURUSD     +$456.00 (12 trades)
   2. GBPJPY     +$321.00 (8 trades)
   3. XAUUSD     +$234.00 (6 trades)

🏷️ TOP SETUPS
   • London Breakout: 78% win rate
   • Trend Pullback:  71% win rate
   • News Reversal:   45% win rate

💡 INSIGHTS
   • Best day: Tuesday (75% win rate)
   • Best time: 14:00-16:00 UTC
   • Avoid: Friday afternoon trades
```

## Konfiguration

```yaml
trade_journal:
  data_path: "./journal"
  auto_screenshot: true
  screenshot_quality: 80
  backup_enabled: true
  export_format: "csv"
```

## Integration mit MT5

```python
# Automatisches Logging aktivieren
from skills.trade_journal import TradeJournal
from skills.metatrader import MT5Orders

journal = TradeJournal()
orders = MT5Orders()

# Hook für automatisches Logging
orders.on_trade_close(journal.add_trade_from_position)
```

---

*K.I.T. - "The best traders are students of their own trades."* 📔
