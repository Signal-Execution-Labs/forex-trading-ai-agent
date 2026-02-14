# Whale Tracker

Track large wallet movements and smart money flows.

## Features

### Wallet Tracking
- **Known Whales** - Labeled addresses (VCs, funds, exchanges)
- **Custom Watchlist** - Add any wallet to track
- **Wallet Labels** - Auto-identify wallet types
- **Activity Feed** - Real-time transaction stream

### Alert Types
- **Large Transfers** - X amount moved
- **Exchange Deposits** - Potential sell pressure
- **Exchange Withdrawals** - Accumulation signal
- **DEX Swaps** - Large token swaps
- **NFT Activity** - Big NFT purchases/sales
- **New Token Buys** - Smart money entering positions

### Analytics
- **Accumulation Score** - Are whales buying or selling?
- **Flow Analysis** - Net flow in/out of exchanges
- **Holder Distribution** - Concentration metrics
- **Wallet Profiling** - Trading style identification

## Commands

```
kit whale track <address>
kit whale alerts --min-value 1000000
kit whale flow <token> --timeframe 24h
kit whale top-holders <token>
kit whale activity --label "vc"
kit whale smart-money <token>
```

## Data Sources

- On-chain data (direct RPC)
- Arkham Intelligence labels
- Nansen labels
- Community-sourced labels
