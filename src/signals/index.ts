/**
 * K.I.T. Signals Module
 * 
 * Trading signal aggregation, tracking, and copy trading:
 * - Signal Manager: Core signal handling and performance tracking
 * - Signal Parser: Parse signals from text (Telegram, Discord, etc.)
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/23
 */

export {
  SignalManager,
  createSignalManager,
  type SignalManagerConfig,
  type TradingSignal,
  type SignalResult,
  type SignalSource,
  type SourcePerformance,
  type SignalType,
  type SignalDirection,
  type SignalConfidence
} from './signal-manager';

export {
  SignalParser,
  createSignalParser,
  type ParsedSignal,
  type ParseResult
} from './signal-parser';
