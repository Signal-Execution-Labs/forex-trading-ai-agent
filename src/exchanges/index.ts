/**
 * K.I.T. Exchange Module
 * 
 * Unified interface for all crypto exchanges via CCXT.
 * 
 * Supported exchanges:
 * - Binance (Spot + Futures)
 * - Coinbase
 * - Kraken
 * - KuCoin
 * - Bybit
 * - OKX
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/19
 */

export { 
  ExchangeManager, 
  createExchangeManager,
  type ExchangeConfig,
  type ExchangeCredentials,
  type Balance,
  type Order,
  type OrderBook,
  type Ticker,
  type Position
} from './exchange-manager';

export { BinaryFasterExchange } from './binaryfaster';
