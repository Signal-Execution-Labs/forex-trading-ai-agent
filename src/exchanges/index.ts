/**
 * K.I.T. Exchange Module
 * Central export for all exchange adapters and manager
 */

// Base classes and types
export {
  BaseExchange,
  ExchangeCredentials,
  MarketData,
  OHLCV,
  OrderBook,
  Trade,
  Order,
  Balance,
  Position,
  WebSocketCallback,
  WebSocketSubscription,
} from './base';

// Exchange adapters
export { BinanceExchange } from './binance';
export { KrakenExchange } from './kraken';
export { CoinbaseExchange } from './coinbase';
export { BybitExchange } from './bybit';
export { OKXExchange } from './okx';
export { OANDAExchange } from './oanda';

// Manager
export { ExchangeManager, ExchangeConfig, exchangeManager } from './manager';

// Convenience type for exchange names
export type ExchangeName = 'binance' | 'kraken' | 'coinbase' | 'bybit' | 'okx' | 'oanda';

// Exchange factory function
import { BaseExchange, ExchangeCredentials } from './base';
import { BinanceExchange } from './binance';
import { KrakenExchange } from './kraken';
import { CoinbaseExchange } from './coinbase';
import { BybitExchange } from './bybit';
import { OKXExchange } from './okx';
import { OANDAExchange } from './oanda';

export interface ExchangeFactoryOptions {
  name: ExchangeName;
  credentials: ExchangeCredentials & {
    accountId?: string;  // For OANDA
  };
  futuresMode?: boolean;
  category?: 'spot' | 'linear' | 'inverse';  // For Bybit
  instType?: 'SPOT' | 'MARGIN' | 'SWAP' | 'FUTURES' | 'OPTION';  // For OKX
}

export function createExchange(options: ExchangeFactoryOptions): BaseExchange {
  switch (options.name) {
    case 'binance':
      return new BinanceExchange(options.credentials, options.futuresMode);
    case 'kraken':
      return new KrakenExchange(options.credentials, options.futuresMode);
    case 'coinbase':
      return new CoinbaseExchange(options.credentials);
    case 'bybit':
      return new BybitExchange(options.credentials, options.category || 'linear');
    case 'okx':
      return new OKXExchange(options.credentials, options.instType || 'SWAP');
    case 'oanda':
      return new OANDAExchange({
        ...options.credentials,
        accountId: options.credentials.accountId || '',
      });
    default:
      throw new Error(`Unsupported exchange: ${options.name}`);
  }
}
