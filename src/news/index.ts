/**
 * K.I.T. News Module
 * 
 * Real-time news trading system:
 * - News aggregation from multiple sources
 * - Sentiment and impact analysis
 * - Automated trading responses
 * - Economic calendar
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/24
 */

export {
  NewsTrader,
  createNewsTrader,
  type NewsTraderConfig,
  type NewsItem,
  type NewsReaction,
  type EconomicEvent,
  type NewsImpact,
  type NewsSentiment,
  type NewsCategory
} from './news-trader';
