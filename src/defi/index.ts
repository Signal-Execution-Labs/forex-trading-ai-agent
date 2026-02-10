/**
 * K.I.T. DeFi Module
 * 
 * Real Web3 integration for DeFi protocols:
 * - Lending/Borrowing (Aave, Compound)
 * - Liquid Staking (Lido, Rocket Pool)
 * - DEX/Liquidity (Uniswap, Curve)
 * - Yield Farming
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/20
 */

export {
  DeFiManager,
  createDeFiManager,
  type DeFiConfig,
  type WalletConfig,
  type DeFiPosition,
  type StakingPosition,
  type LendingPosition,
  type LiquidityPosition,
  type YieldOpportunity,
  type HealthStatus,
  type Chain
} from './defi-manager';

export {
  YieldScanner,
  createYieldScanner,
  type YieldScannerConfig,
  type YieldFarm
} from './yield-scanner';
