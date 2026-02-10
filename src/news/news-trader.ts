/**
 * K.I.T. News Trader
 * 
 * Real-time news trading system:
 * - News aggregation from multiple sources
 * - Sentiment analysis
 * - Impact prediction
 * - Automated trading responses
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/24
 */

import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

// ============================================
// Types
// ============================================

export type NewsImpact = 'low' | 'medium' | 'high' | 'extreme';
export type NewsSentiment = 'very-bearish' | 'bearish' | 'neutral' | 'bullish' | 'very-bullish';
export type NewsCategory = 'earnings' | 'economic' | 'regulatory' | 'partnership' | 'hack' | 'listing' | 'technical' | 'social' | 'other';

export interface NewsItem {
  /** Unique ID */
  id: string;
  
  /** Headline */
  headline: string;
  
  /** Full text/summary */
  body?: string;
  
  /** Source name */
  source: string;
  sourceUrl?: string;
  
  /** Category */
  category: NewsCategory;
  
  /** Affected assets */
  affectedAssets: string[];
  
  /** Sentiment analysis */
  sentiment: NewsSentiment;
  sentimentScore: number; // -100 to +100
  
  /** Impact assessment */
  impact: NewsImpact;
  impactScore: number; // 0-100
  
  /** Confidence in analysis */
  confidence: number; // 0-100
  
  /** Verified by multiple sources */
  verified: boolean;
  verificationCount: number;
  
  /** Timestamp */
  publishedAt: Date;
  receivedAt: Date;
  
  /** Metadata */
  tags?: string[];
  relatedNews?: string[];
}

export interface NewsReaction {
  /** News item ID */
  newsId: string;
  
  /** Reaction type */
  type: 'entry' | 'exit' | 'adjust' | 'hedge' | 'none';
  
  /** Affected positions */
  positions: {
    symbol: string;
    action: 'buy' | 'sell' | 'close' | 'reduce' | 'hold';
    reason: string;
  }[];
  
  /** Urgency */
  urgency: 'immediate' | 'soon' | 'monitor';
  
  /** Timestamp */
  createdAt: Date;
}

export interface EconomicEvent {
  /** Event name */
  name: string;
  
  /** Country/Region */
  country: string;
  
  /** Expected time */
  scheduledAt: Date;
  
  /** Impact level */
  impact: NewsImpact;
  
  /** Previous value */
  previous?: string;
  
  /** Forecast value */
  forecast?: string;
  
  /** Actual value (after release) */
  actual?: string;
  
  /** Affected assets */
  affectedAssets: string[];
}

export interface NewsTraderConfig {
  /** Auto-react to news */
  autoReact: boolean;
  
  /** Minimum impact to react */
  minImpact: NewsImpact;
  
  /** Minimum confidence */
  minConfidence: number;
  
  /** Require verification */
  requireVerification: boolean;
  
  /** Max position change per event (%) */
  maxPositionChange: number;
  
  /** Cooldown between reactions (ms) */
  reactionCooldown: number;
  
  /** News sources to use */
  sources: ('cryptopanic' | 'newsapi' | 'twitter' | 'telegram' | 'rss')[];
  
  /** Verbose logging */
  verbose: boolean;
}

// ============================================
// News Trader
// ============================================

const DEFAULT_CONFIG: NewsTraderConfig = {
  autoReact: false,
  minImpact: 'high',
  minConfidence: 70,
  requireVerification: true,
  maxPositionChange: 10,
  reactionCooldown: 300000, // 5 minutes
  sources: ['cryptopanic'],
  verbose: true
};

const CRYPTOPANIC_API = 'https://cryptopanic.com/api/v1';
const NEWSAPI_BASE = 'https://newsapi.org/v2';

// Sentiment keywords for analysis
const BULLISH_KEYWORDS = [
  'surge', 'soar', 'rally', 'bullish', 'breakout', 'all-time high', 'ath',
  'partnership', 'adoption', 'institutional', 'approval', 'etf', 'upgrade',
  'launch', 'listing', 'moon', 'pump', 'bull run', 'growth', 'milestone'
];

const BEARISH_KEYWORDS = [
  'crash', 'plunge', 'drop', 'bearish', 'breakdown', 'sell-off', 'dump',
  'hack', 'exploit', 'ban', 'regulation', 'crackdown', 'lawsuit', 'sec',
  'bankrupt', 'insolvent', 'fraud', 'scam', 'rug', 'fear', 'panic'
];

const IMPACT_KEYWORDS: Record<string, NewsImpact> = {
  // Extreme
  'sec': 'extreme', 'etf': 'extreme', 'hack': 'extreme', 'bankrupt': 'extreme',
  'fed': 'extreme', 'ban': 'extreme', 'regulation': 'extreme',
  // High
  'partnership': 'high', 'acquisition': 'high', 'lawsuit': 'high',
  'listing': 'high', 'delisting': 'high', 'upgrade': 'high',
  // Medium
  'launch': 'medium', 'update': 'medium', 'milestone': 'medium',
  'adoption': 'medium', 'integration': 'medium'
};

/**
 * News Trader - React to market news in real-time
 */
export class NewsTrader extends EventEmitter {
  private config: NewsTraderConfig;
  private newsItems: NewsItem[] = [];
  private reactions: NewsReaction[] = [];
  private economicCalendar: EconomicEvent[] = [];
  private lastReactionTime: Map<string, number> = new Map();
  private pollingTimer?: ReturnType<typeof setInterval>;
  
  // API keys
  private cryptoPanicKey?: string;
  private newsApiKey?: string;
  
  constructor(config: Partial<NewsTraderConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Load API keys from environment
    this.cryptoPanicKey = process.env.CRYPTOPANIC_API_KEY;
    this.newsApiKey = process.env.NEWSAPI_KEY;
  }
  
  // ============================================
  // Lifecycle
  // ============================================
  
  /**
   * Start news monitoring
   */
  start(pollInterval: number = 60000): void {
    if (this.config.verbose) {
      console.log('📰 Starting news monitoring...');
    }
    
    // Initial fetch
    this.fetchNews();
    
    // Start polling
    this.pollingTimer = setInterval(() => {
      this.fetchNews();
    }, pollInterval);
  }
  
  /**
   * Stop news monitoring
   */
  stop(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }
  
  // ============================================
  // News Fetching
  // ============================================
  
  /**
   * Fetch news from all configured sources
   */
  async fetchNews(): Promise<NewsItem[]> {
    const newItems: NewsItem[] = [];
    
    for (const source of this.config.sources) {
      try {
        let items: NewsItem[] = [];
        
        switch (source) {
          case 'cryptopanic':
            items = await this.fetchCryptoPanic();
            break;
          case 'newsapi':
            items = await this.fetchNewsApi();
            break;
          // Other sources can be added
        }
        
        // Deduplicate
        for (const item of items) {
          if (!this.isDuplicate(item)) {
            this.newsItems.push(item);
            newItems.push(item);
            
            // Check for reactions
            if (this.shouldReact(item)) {
              const reaction = this.createReaction(item);
              if (reaction) {
                this.reactions.push(reaction);
                this.emit('reaction', reaction, item);
              }
            }
            
            this.emit('news', item);
          }
        }
      } catch (error: any) {
        console.error(`Error fetching from ${source}: ${error.message}`);
      }
    }
    
    return newItems;
  }
  
  /**
   * Fetch from CryptoPanic
   */
  private async fetchCryptoPanic(): Promise<NewsItem[]> {
    if (!this.cryptoPanicKey) {
      return [];
    }
    
    const url = `${CRYPTOPANIC_API}/posts/?auth_token=${this.cryptoPanicKey}&filter=hot&public=true`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json() as any;
      const items: NewsItem[] = [];
      
      for (const post of (data.results || [])) {
        const analyzed = this.analyzeNews(post.title, post.body || '');
        
        items.push({
          id: uuid(),
          headline: post.title,
          body: post.body,
          source: 'CryptoPanic',
          sourceUrl: post.url,
          category: this.categorize(post.title),
          affectedAssets: this.extractAssets(post.title + ' ' + (post.body || '')),
          sentiment: analyzed.sentiment,
          sentimentScore: analyzed.sentimentScore,
          impact: analyzed.impact,
          impactScore: analyzed.impactScore,
          confidence: analyzed.confidence,
          verified: post.votes?.positive > 3,
          verificationCount: post.votes?.positive || 0,
          publishedAt: new Date(post.published_at),
          receivedAt: new Date(),
          tags: post.currencies?.map((c: any) => c.code) || []
        });
      }
      
      return items;
    } catch {
      return [];
    }
  }
  
  /**
   * Fetch from NewsAPI
   */
  private async fetchNewsApi(): Promise<NewsItem[]> {
    if (!this.newsApiKey) {
      return [];
    }
    
    const url = `${NEWSAPI_BASE}/everything?q=bitcoin OR ethereum OR crypto&apiKey=${this.newsApiKey}&language=en&sortBy=publishedAt&pageSize=20`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      
      const data = await response.json() as any;
      const items: NewsItem[] = [];
      
      for (const article of (data.articles || [])) {
        const text = `${article.title} ${article.description || ''}`;
        const analyzed = this.analyzeNews(article.title, article.description || '');
        
        items.push({
          id: uuid(),
          headline: article.title,
          body: article.description,
          source: article.source?.name || 'NewsAPI',
          sourceUrl: article.url,
          category: this.categorize(text),
          affectedAssets: this.extractAssets(text),
          sentiment: analyzed.sentiment,
          sentimentScore: analyzed.sentimentScore,
          impact: analyzed.impact,
          impactScore: analyzed.impactScore,
          confidence: analyzed.confidence,
          verified: false,
          verificationCount: 0,
          publishedAt: new Date(article.publishedAt),
          receivedAt: new Date()
        });
      }
      
      return items;
    } catch {
      return [];
    }
  }
  
  // ============================================
  // News Analysis
  // ============================================
  
  /**
   * Analyze news for sentiment and impact
   */
  private analyzeNews(headline: string, body: string): {
    sentiment: NewsSentiment;
    sentimentScore: number;
    impact: NewsImpact;
    impactScore: number;
    confidence: number;
  } {
    const text = `${headline} ${body}`.toLowerCase();
    
    // Sentiment analysis
    let sentimentScore = 0;
    let keywordHits = 0;
    
    for (const keyword of BULLISH_KEYWORDS) {
      if (text.includes(keyword)) {
        sentimentScore += 15;
        keywordHits++;
      }
    }
    
    for (const keyword of BEARISH_KEYWORDS) {
      if (text.includes(keyword)) {
        sentimentScore -= 15;
        keywordHits++;
      }
    }
    
    // Clamp sentiment score
    sentimentScore = Math.max(-100, Math.min(100, sentimentScore));
    
    // Determine sentiment level
    let sentiment: NewsSentiment;
    if (sentimentScore >= 50) sentiment = 'very-bullish';
    else if (sentimentScore >= 20) sentiment = 'bullish';
    else if (sentimentScore <= -50) sentiment = 'very-bearish';
    else if (sentimentScore <= -20) sentiment = 'bearish';
    else sentiment = 'neutral';
    
    // Impact analysis
    let impact: NewsImpact = 'low';
    let impactScore = 20;
    
    for (const [keyword, level] of Object.entries(IMPACT_KEYWORDS)) {
      if (text.includes(keyword)) {
        if (level === 'extreme' && impactScore < 90) {
          impact = 'extreme';
          impactScore = 90;
        } else if (level === 'high' && impactScore < 70) {
          impact = 'high';
          impactScore = 70;
        } else if (level === 'medium' && impactScore < 50) {
          impact = 'medium';
          impactScore = 50;
        }
      }
    }
    
    // Confidence based on keyword hits and text length
    const confidence = Math.min(90, 40 + keywordHits * 10 + Math.min(text.length / 50, 20));
    
    return { sentiment, sentimentScore, impact, impactScore, confidence };
  }
  
  /**
   * Categorize news
   */
  private categorize(text: string): NewsCategory {
    const lower = text.toLowerCase();
    
    if (lower.includes('hack') || lower.includes('exploit') || lower.includes('breach')) {
      return 'hack';
    }
    if (lower.includes('sec') || lower.includes('regulation') || lower.includes('ban')) {
      return 'regulatory';
    }
    if (lower.includes('partnership') || lower.includes('collaboration')) {
      return 'partnership';
    }
    if (lower.includes('listing') || lower.includes('binance') || lower.includes('coinbase')) {
      return 'listing';
    }
    if (lower.includes('earnings') || lower.includes('revenue') || lower.includes('profit')) {
      return 'earnings';
    }
    if (lower.includes('cpi') || lower.includes('inflation') || lower.includes('fed') || lower.includes('rate')) {
      return 'economic';
    }
    if (lower.includes('elon') || lower.includes('tweet') || lower.includes('trump')) {
      return 'social';
    }
    
    return 'other';
  }
  
  /**
   * Extract affected assets from text
   */
  private extractAssets(text: string): string[] {
    const assets: Set<string> = new Set();
    
    // Common crypto symbols
    const cryptoPattern = /\b(BTC|ETH|XRP|SOL|ADA|DOGE|DOT|LINK|AVAX|MATIC|UNI|AAVE|BNB)\b/gi;
    const matches = text.match(cryptoPattern) || [];
    
    for (const match of matches) {
      assets.add(match.toUpperCase());
    }
    
    // Full names
    const nameMap: Record<string, string> = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'ripple': 'XRP',
      'solana': 'SOL',
      'cardano': 'ADA',
      'dogecoin': 'DOGE'
    };
    
    for (const [name, symbol] of Object.entries(nameMap)) {
      if (text.toLowerCase().includes(name)) {
        assets.add(symbol);
      }
    }
    
    return Array.from(assets);
  }
  
  // ============================================
  // Reactions
  // ============================================
  
  /**
   * Check if we should react to this news
   */
  private shouldReact(news: NewsItem): boolean {
    if (!this.config.autoReact) return false;
    
    // Check impact threshold
    const impactOrder: NewsImpact[] = ['low', 'medium', 'high', 'extreme'];
    if (impactOrder.indexOf(news.impact) < impactOrder.indexOf(this.config.minImpact)) {
      return false;
    }
    
    // Check confidence
    if (news.confidence < this.config.minConfidence) {
      return false;
    }
    
    // Check verification
    if (this.config.requireVerification && !news.verified) {
      return false;
    }
    
    // Check cooldown per asset
    for (const asset of news.affectedAssets) {
      const lastReaction = this.lastReactionTime.get(asset) || 0;
      if (Date.now() - lastReaction < this.config.reactionCooldown) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Create a reaction to news
   */
  private createReaction(news: NewsItem): NewsReaction | null {
    if (news.affectedAssets.length === 0) return null;
    
    const positions: NewsReaction['positions'] = [];
    
    for (const asset of news.affectedAssets) {
      let action: 'buy' | 'sell' | 'close' | 'reduce' | 'hold';
      let reason: string;
      
      switch (news.sentiment) {
        case 'very-bullish':
          action = 'buy';
          reason = `Strong bullish news: ${news.headline.slice(0, 50)}`;
          break;
        case 'bullish':
          action = 'buy';
          reason = `Bullish news: ${news.headline.slice(0, 50)}`;
          break;
        case 'very-bearish':
          action = news.category === 'hack' ? 'close' : 'sell';
          reason = `Strong bearish news: ${news.headline.slice(0, 50)}`;
          break;
        case 'bearish':
          action = 'reduce';
          reason = `Bearish news: ${news.headline.slice(0, 50)}`;
          break;
        default:
          action = 'hold';
          reason = 'Neutral news, monitoring';
      }
      
      positions.push({ symbol: asset, action, reason });
      
      // Update cooldown
      this.lastReactionTime.set(asset, Date.now());
    }
    
    const urgency: NewsReaction['urgency'] = 
      news.impact === 'extreme' ? 'immediate' :
      news.impact === 'high' ? 'soon' : 'monitor';
    
    return {
      newsId: news.id,
      type: positions.some(p => p.action === 'buy') ? 'entry' :
            positions.some(p => p.action === 'close') ? 'exit' :
            positions.some(p => p.action === 'reduce') ? 'adjust' : 'none',
      positions,
      urgency,
      createdAt: new Date()
    };
  }
  
  /**
   * Check for duplicate news
   */
  private isDuplicate(news: NewsItem): boolean {
    const oneHourAgo = Date.now() - 3600000;
    
    return this.newsItems.some(n => 
      n.publishedAt.getTime() > oneHourAgo &&
      n.headline.toLowerCase() === news.headline.toLowerCase()
    );
  }
  
  // ============================================
  // Economic Calendar
  // ============================================
  
  /**
   * Add economic event to calendar
   */
  addEconomicEvent(event: EconomicEvent): void {
    this.economicCalendar.push(event);
    this.economicCalendar.sort((a, b) => 
      a.scheduledAt.getTime() - b.scheduledAt.getTime()
    );
  }
  
  /**
   * Get upcoming economic events
   */
  getUpcomingEvents(hours: number = 24): EconomicEvent[] {
    const cutoff = Date.now() + hours * 60 * 60 * 1000;
    return this.economicCalendar.filter(e => 
      e.scheduledAt.getTime() > Date.now() &&
      e.scheduledAt.getTime() <= cutoff
    );
  }
  
  // ============================================
  // Getters
  // ============================================
  
  /**
   * Get recent news
   */
  getRecentNews(hours: number = 24): NewsItem[] {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return this.newsItems
      .filter(n => n.receivedAt.getTime() >= cutoff)
      .sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
  }
  
  /**
   * Get high-impact news
   */
  getHighImpactNews(): NewsItem[] {
    return this.newsItems.filter(n => 
      n.impact === 'high' || n.impact === 'extreme'
    );
  }
  
  /**
   * Get news for specific asset
   */
  getNewsForAsset(symbol: string): NewsItem[] {
    return this.newsItems.filter(n => 
      n.affectedAssets.includes(symbol.toUpperCase())
    );
  }
  
  // ============================================
  // Formatted Output
  // ============================================
  
  /**
   * Get formatted news feed
   */
  getFormattedFeed(limit: number = 10): string {
    const news = this.getRecentNews(24).slice(0, limit);
    
    const lines = [
      '',
      '╔═══════════════════════════════════════════════════════════╗',
      '║              K.I.T. NEWS FEED                             ║',
      '╚═══════════════════════════════════════════════════════════╝',
      ''
    ];
    
    for (const item of news) {
      const sentimentEmoji = 
        item.sentiment === 'very-bullish' ? '🚀' :
        item.sentiment === 'bullish' ? '📈' :
        item.sentiment === 'very-bearish' ? '💀' :
        item.sentiment === 'bearish' ? '📉' : '➡️';
      
      const impactEmoji =
        item.impact === 'extreme' ? '🔴' :
        item.impact === 'high' ? '🟠' :
        item.impact === 'medium' ? '🟡' : '⚪';
      
      const verifiedBadge = item.verified ? '✓' : '';
      const assets = item.affectedAssets.join(', ') || 'General';
      
      lines.push(`${sentimentEmoji} ${impactEmoji} ${item.headline.slice(0, 60)}${verifiedBadge}`);
      lines.push(`   📌 ${assets} | ${item.source} | ${this.timeAgo(item.publishedAt)}`);
      lines.push('');
    }
    
    return lines.join('\n');
  }
  
  private timeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
}

/**
 * Factory function
 */
export function createNewsTrader(config?: Partial<NewsTraderConfig>): NewsTrader {
  return new NewsTrader(config);
}
