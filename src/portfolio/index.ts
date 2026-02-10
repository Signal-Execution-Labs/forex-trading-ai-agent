/**
 * K.I.T. Portfolio Module
 * 
 * Unified portfolio management across all platforms:
 * - Centralized Exchanges (CEX)
 * - DeFi Protocols
 * - MetaTrader 5 (Forex)
 * - Wallets
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/22
 */

export {
  UnifiedPortfolio,
  createUnifiedPortfolio,
  type UnifiedPortfolioConfig,
  type PortfolioDataSource,
  type AssetPosition,
  type PortfolioSummary,
  type PnLReport,
  type AssetClass,
  type Platform
} from './unified-portfolio';

export {
  CEXSource,
  createCEXSource,
  type CEXConfig
} from './sources/cex-source';

export {
  DeFiSource,
  createDeFiSource,
  type DeFiSourceConfig
} from './sources/defi-source';

export {
  MT5Source,
  createMT5Source,
  type MT5SourceConfig
} from './sources/mt5-source';
