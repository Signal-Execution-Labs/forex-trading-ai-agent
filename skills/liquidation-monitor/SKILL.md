# Liquidation Monitor

Real-time monitoring of DeFi lending positions and liquidation risks.

## Features

- **Multi-Protocol Support** - Aave, Compound, MakerDAO, Morpho, Spark
- **Health Factor Tracking** - Real-time health factor across all positions
- **Liquidation Alerts** - Warn before liquidation threshold
- **Auto-Repay** - Automatically repay debt to prevent liquidation
- **Auto-Add Collateral** - Add collateral automatically
- **Historical Liquidations** - Track past liquidations on-chain
- **Market Impact** - Estimate liquidation cascade risks

## Commands

```
kit liquidation status             # All positions health status
kit liquidation alert <threshold>  # Set health factor alert
kit liquidation watch <address>    # Monitor any address
kit liquidation history            # Past liquidations
kit liquidation cascade <asset>    # Analyze cascade risk
kit liquidation protect            # Enable auto-protection
```

## API Endpoints

- `GET /api/liquidation/status` - Position health
- `GET /api/liquidation/watch/:address` - Monitor address
- `GET /api/liquidation/history` - Historical liquidations
- `GET /api/liquidation/cascade/:asset` - Cascade analysis
- `POST /api/liquidation/protect` - Enable protection

## Protocols Supported

- **Ethereum**: Aave V3, Compound V3, MakerDAO, Spark
- **Arbitrum**: Aave, Radiant, Silo
- **Optimism**: Aave, Sonne
- **Base**: Aave, Moonwell
- **Polygon**: Aave V3

## Configuration

```yaml
liquidation:
  health_factor_warning: 1.5
  health_factor_critical: 1.2
  auto_repay: true
  auto_repay_threshold: 1.15
  auto_collateral: true
  collateral_source: wallet       # wallet/swap/flashloan
  monitoring_interval: 30s
```

## Protection Strategies

1. **Auto-Repay** - Repay debt when HF drops
2. **Add Collateral** - Add more collateral automatically
3. **Flashloan Deleverage** - Use flashloan to unwind position
4. **Emergency Withdrawal** - Full position exit
