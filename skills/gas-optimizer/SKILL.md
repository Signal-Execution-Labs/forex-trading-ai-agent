# Gas Optimizer

Intelligent gas fee optimization across all EVM chains.

## Features

- **Real-Time Gas Tracking** - Monitor gas prices across chains
- **Optimal Timing** - AI predicts lowest gas windows
- **Transaction Batching** - Combine multiple txs to save gas
- **MEV Protection** - Route through Flashbots to avoid MEV
- **Gas Alerts** - Notify when gas drops below threshold
- **Historical Analysis** - Track your gas spending over time
- **Chain Comparison** - Compare fees across L1s and L2s

## Commands

```
kit gas status                     # Current gas prices all chains
kit gas predict                    # Predict optimal send time
kit gas history                    # Your gas spending history
kit gas alert <gwei>               # Alert when below threshold
kit gas batch                      # Queue transactions for batching
kit gas estimate <tx>              # Estimate transaction cost
```

## API Endpoints

- `GET /api/gas/prices` - Current prices all chains
- `GET /api/gas/predict` - Optimal timing prediction
- `GET /api/gas/history` - Spending history
- `POST /api/gas/alerts` - Set price alerts
- `POST /api/gas/batch` - Submit batch transaction
- `GET /api/gas/estimate` - Estimate tx cost

## Supported Chains

- Ethereum Mainnet
- Arbitrum, Optimism, Base, zkSync
- Polygon, BNB Chain
- Avalanche, Fantom
- All major L1s and L2s

## Configuration

```yaml
gas:
  default_chain: ethereum
  mev_protection: true
  flashbots_rpc: true
  max_priority_fee: 2gwei
  alert_threshold: 20gwei
  batch_enabled: true
```

## Savings Strategies

- Wait for weekend/night for lower gas
- Use L2s for small transactions
- Batch similar transactions
- Use Flashbots for MEV protection
- Monitor gas spikes from NFT mints
