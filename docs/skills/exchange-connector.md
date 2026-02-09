---
summary: "Exchange Connector Skill - Börsen-API-Anbindung"
read_when:
  - Exchange-Verbindung verstehen
  - API-Funktionen nutzen
title: "Exchange Connector"
---

# Exchange Connector

Der Exchange Connector ist das Herzstück für alle Börsen-Interaktionen. Er abstrahiert verschiedene Exchange-APIs in ein einheitliches Interface.

## Übersicht

```mermaid
flowchart LR
    K[K.I.T.] --> EC[Exchange Connector]
    EC --> B[Binance]
    EC --> KR[Kraken]
    EC --> CB[Coinbase]
    EC --> MT[MetaTrader]
```

## Unterstützte Exchanges

| Exchange | Spot | Futures | Margin | Status |
|----------|------|---------|--------|--------|
| Binance | ✅ | ✅ | ✅ | Stabil |
| Kraken | ✅ | ✅ | ❌ | Stabil |
| Coinbase | ✅ | ❌ | ❌ | Stabil |
| MetaTrader | N/A | N/A | ✅ | Stabil |
| Bybit | ✅ | ✅ | ✅ | Beta |
| KuCoin | ✅ | ✅ | ✅ | Beta |
| OKX | ✅ | ✅ | ✅ | Beta |

## Befehle

### Balance abfragen

```bash
kit balance
kit balance binance
kit balance --all
```

Telegram:
```
"Zeig mein Guthaben"
"Balance auf Binance"
```

### Order platzieren

```bash
# Market Order
kit buy BTC/USDT 100

# Limit Order
kit buy BTC/USDT 100 --price 65000

# Sell Order
kit sell ETH/USDT 0.5 --price 3500
```

### Order stornieren

```bash
kit cancel <order-id>
kit cancel --all BTC/USDT
```

### Order-Status

```bash
kit orders
kit orders --open
kit orders --history --limit 20
```

## API-Funktionen

### getBalance()

```typescript
const balance = await exchange.getBalance();

// Ergebnis:
{
  total: { BTC: 0.5, ETH: 2.0, USDT: 5000 },
  free: { BTC: 0.3, ETH: 1.5, USDT: 5000 },
  used: { BTC: 0.2, ETH: 0.5, USDT: 0 }
}
```

### createOrder()

```typescript
const order = await exchange.createOrder({
  symbol: 'BTC/USDT',
  type: 'limit',
  side: 'buy',
  amount: 0.01,
  price: 65000
});

// Ergebnis:
{
  id: '12345',
  symbol: 'BTC/USDT',
  type: 'limit',
  side: 'buy',
  amount: 0.01,
  price: 65000,
  status: 'open',
  filled: 0,
  remaining: 0.01,
  timestamp: 1705312800000
}
```

### fetchOHLCV()

```typescript
const candles = await exchange.fetchOHLCV('BTC/USDT', '1h', 100);

// Ergebnis: Array von [timestamp, open, high, low, close, volume]
[
  [1705312800000, 67000, 67500, 66800, 67200, 1250.5],
  [1705316400000, 67200, 67800, 67100, 67600, 980.3],
  ...
]
```

### fetchTicker()

```typescript
const ticker = await exchange.fetchTicker('BTC/USDT');

// Ergebnis:
{
  symbol: 'BTC/USDT',
  bid: 67150,
  ask: 67160,
  last: 67155,
  high: 68000,
  low: 66500,
  volume: 25000,
  change: 1.2,
  percentage: 1.82
}
```

## Konfiguration

```json
{
  "skills": {
    "exchange-connector": {
      "defaultExchange": "binance",
      "timeout": 30000,
      "retries": 3,
      "rateLimit": true,
      "sandbox": false
    }
  }
}
```

## Multi-Exchange Trading

### Primäre und Backup-Exchange

```json
{
  "exchanges": {
    "binance": { "priority": 1 },
    "kraken": { "priority": 2 }
  },
  "routing": {
    "failover": true,
    "latencyBased": false
  }
}
```

### Arbitrage-Unterstützung

```bash
kit arb BTC/USDT --exchanges binance,kraken
```

## WebSocket-Streams

Echtzeit-Updates über WebSocket:

```typescript
// Preis-Updates abonnieren
exchange.subscribe('ticker', 'BTC/USDT', (ticker) => {
  console.log(`BTC: ${ticker.last}`);
});

// Trade-Updates
exchange.subscribe('trades', 'BTC/USDT', (trade) => {
  console.log(`Trade: ${trade.side} ${trade.amount} @ ${trade.price}`);
});

// Order-Updates
exchange.subscribe('orders', (order) => {
  console.log(`Order ${order.id}: ${order.status}`);
});
```

## Fehlerbehandlung

```typescript
try {
  await exchange.createOrder(...);
} catch (error) {
  if (error.code === 'INSUFFICIENT_FUNDS') {
    // Nicht genug Guthaben
  } else if (error.code === 'RATE_LIMIT') {
    // Zu viele Anfragen
  } else if (error.code === 'INVALID_ORDER') {
    // Ungültige Order-Parameter
  }
}
```

## Rate-Limiting

K.I.T. handhabt Rate-Limits automatisch:

```json
{
  "exchanges": {
    "binance": {
      "rateLimit": {
        "orders": 10,      // Orders pro Sekunde
        "requests": 1200,  // Requests pro Minute
        "weight": 1200     // Gewichtetes Limit
      }
    }
  }
}
```

## Testnet/Sandbox

Für Paper-Trading:

```bash
kit exchanges add binance --testnet
```

```json
{
  "exchanges": {
    "binance": {
      "testnet": true,
      "baseUrl": "https://testnet.binance.vision"
    }
  }
}
```

## Fehlerbehebung

<AccordionGroup>
  <Accordion title="Connection Timeout">
    ```bash
    kit config set exchanges.binance.timeout 60000
    kit exchanges test binance
    ```
  </Accordion>
  
  <Accordion title="Invalid Signature">
    - Zeitdifferenz prüfen: `kit exchanges sync-time`
    - API-Key neu generieren
    - Secret korrekt kopiert?
  </Accordion>
  
  <Accordion title="Insufficient Balance">
    ```bash
    kit balance binance
    # Prüfen ob Funds auf Spot/Futures/Margin
    kit balance binance --type spot
    kit balance binance --type futures
    ```
  </Accordion>
</AccordionGroup>

## Nächste Schritte

<Columns>
  <Card title="Exchanges einrichten" href="/start/exchanges" icon="link">
    Neue Exchange verbinden.
  </Card>
  <Card title="Portfolio Tracker" href="/skills/portfolio-tracker" icon="pie-chart">
    Portfolio-Übersicht.
  </Card>
  <Card title="Binance Details" href="/exchanges/binance" icon="building">
    Binance-spezifische Features.
  </Card>
</Columns>
