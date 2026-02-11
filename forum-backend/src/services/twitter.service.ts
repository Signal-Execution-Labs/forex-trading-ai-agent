import { TwitterApi, TwitterApiReadWrite, TweetV2PostTweetResult } from 'twitter-api-v2';
import { db, dbHelpers } from '../db/database.ts';
import { Agent, Signal } from '../models/types.ts';

export interface TwitterCredentials {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

export interface TweetOptions {
  text: string;
  replyToTweetId?: string;
  mediaIds?: string[];
}

export interface TweetResult {
  success: boolean;
  tweetId?: string;
  tweetUrl?: string;
  error?: string;
}

/**
 * Twitter Service for K.I.T. agents
 * Allows bots to tweet their signals and posts
 */
export class TwitterService {
  private static clients: Map<string, TwitterApiReadWrite> = new Map();

  /**
   * Get or create a Twitter client for an agent
   */
  static getClient(agentId: string): TwitterApiReadWrite | null {
    // Check cache first
    if (this.clients.has(agentId)) {
      return this.clients.get(agentId)!;
    }

    // Get agent credentials from database
    const twitterConfig = dbHelpers.getTwitterConfig(agentId);
    if (!twitterConfig || !twitterConfig.credentials) {
      return null;
    }

    try {
      const client = new TwitterApi({
        appKey: twitterConfig.credentials.apiKey,
        appSecret: twitterConfig.credentials.apiSecret,
        accessToken: twitterConfig.credentials.accessToken,
        accessSecret: twitterConfig.credentials.accessTokenSecret,
      });

      const rwClient = client.readWrite;
      this.clients.set(agentId, rwClient);
      return rwClient;
    } catch (error) {
      console.error(`Failed to create Twitter client for agent ${agentId}:`, error);
      return null;
    }
  }

  /**
   * Clear cached client (e.g., when credentials are updated)
   */
  static clearClientCache(agentId: string): void {
    this.clients.delete(agentId);
  }

  /**
   * Post a tweet for an agent
   */
  static async tweet(agentId: string, options: TweetOptions): Promise<TweetResult> {
    const client = this.getClient(agentId);
    if (!client) {
      return {
        success: false,
        error: 'Twitter not configured for this agent. Set up credentials first.',
      };
    }

    try {
      const tweetParams: any = {
        text: options.text,
      };

      if (options.replyToTweetId) {
        tweetParams.reply = { in_reply_to_tweet_id: options.replyToTweetId };
      }

      if (options.mediaIds && options.mediaIds.length > 0) {
        tweetParams.media = { media_ids: options.mediaIds };
      }

      const result: TweetV2PostTweetResult = await client.v2.tweet(tweetParams);

      // Get agent's Twitter handle for URL
      const twitterConfig = dbHelpers.getTwitterConfig(agentId);
      const handle = twitterConfig?.handle || 'user';
      const tweetUrl = `https://x.com/${handle}/status/${result.data.id}`;

      // Log the tweet
      await this.logTweet(agentId, {
        tweetId: result.data.id,
        text: options.text,
        url: tweetUrl,
        timestamp: new Date().toISOString(),
      });

      return {
        success: true,
        tweetId: result.data.id,
        tweetUrl,
      };
    } catch (error: any) {
      console.error(`Twitter error for agent ${agentId}:`, error);
      
      // Handle specific Twitter API errors
      let errorMessage = 'Failed to post tweet';
      if (error.code === 403) {
        errorMessage = 'Tweet rejected: May be duplicate or violate Twitter rules';
      } else if (error.code === 429) {
        errorMessage = 'Rate limit exceeded. Please wait before tweeting again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Format a signal as a tweet
   */
  static formatSignalTweet(signal: Signal, agentName?: string): string {
    const emoji = signal.direction === 'LONG' ? '🟢' : signal.direction === 'SHORT' ? '🔴' : '⚪';
    const directionText = signal.direction === 'LONG' ? 'LONG' : signal.direction === 'SHORT' ? 'SHORT' : 'NEUTRAL';
    
    let tweet = `${emoji} #${signal.asset} ${directionText} Signal`;
    
    if (agentName) {
      tweet += `\n\n🤖 by ${agentName}`;
    }
    
    if (signal.entry_price) {
      tweet += `\n📍 Entry: $${signal.entry_price.toLocaleString()}`;
    }
    
    if (signal.target_price) {
      tweet += `\n🎯 Target: $${signal.target_price.toLocaleString()}`;
    }
    
    if (signal.stop_loss) {
      tweet += `\n🛑 Stop: $${signal.stop_loss.toLocaleString()}`;
    }
    
    if (signal.confidence) {
      tweet += `\n📊 Confidence: ${signal.confidence}%`;
    }
    
    if (signal.timeframe) {
      tweet += `\n⏰ ${signal.timeframe}`;
    }
    
    if (signal.reasoning) {
      // Truncate reasoning to fit in tweet
      const maxReasoningLength = 280 - tweet.length - 20; // Leave room for hashtags
      if (signal.reasoning.length > maxReasoningLength && maxReasoningLength > 30) {
        tweet += `\n\n💡 ${signal.reasoning.substring(0, maxReasoningLength - 3)}...`;
      } else if (maxReasoningLength > 30) {
        tweet += `\n\n💡 ${signal.reasoning}`;
      }
    }
    
    // Add hashtags if space allows
    const hashtags = `\n\n#Trading #Crypto #AI #KitBot`;
    if (tweet.length + hashtags.length <= 280) {
      tweet += hashtags;
    }
    
    return tweet;
  }

  /**
   * Auto-tweet a signal if enabled for the agent
   */
  static async autoTweetSignal(signal: Signal): Promise<TweetResult | null> {
    const agent = dbHelpers.findAgent(signal.agent_id);
    if (!agent) return null;

    const twitterConfig = dbHelpers.getTwitterConfig(signal.agent_id);
    if (!twitterConfig?.enabled || !twitterConfig?.autoPost) {
      return null; // Auto-post disabled
    }

    const tweetText = this.formatSignalTweet(signal, agent.name);
    return this.tweet(signal.agent_id, { text: tweetText });
  }

  /**
   * Store Twitter credentials for an agent
   */
  static async setCredentials(
    agentId: string,
    credentials: TwitterCredentials,
    handle: string,
    autoPost: boolean = false
  ): Promise<boolean> {
    try {
      // Verify credentials work
      const client = new TwitterApi({
        appKey: credentials.apiKey,
        appSecret: credentials.apiSecret,
        accessToken: credentials.accessToken,
        accessSecret: credentials.accessTokenSecret,
      });

      // Try to verify credentials
      const me = await client.v2.me();
      if (!me.data) {
        throw new Error('Could not verify Twitter credentials');
      }

      // Store in database
      const config = {
        agentId,
        handle: handle || me.data.username,
        enabled: true,
        autoPost,
        credentials,
        verifiedAt: new Date().toISOString(),
        userId: me.data.id,
      };

      // Update or create twitter config
      const existingIndex = db.data!.twitterConfigs?.findIndex(c => c.agentId === agentId) ?? -1;
      
      if (!db.data!.twitterConfigs) {
        db.data!.twitterConfigs = [];
      }
      
      if (existingIndex >= 0) {
        db.data!.twitterConfigs[existingIndex] = config;
      } else {
        db.data!.twitterConfigs.push(config);
      }

      await db.write();

      // Clear cached client to force refresh
      this.clearClientCache(agentId);

      return true;
    } catch (error: any) {
      console.error(`Failed to set Twitter credentials for ${agentId}:`, error);
      throw new Error(`Invalid Twitter credentials: ${error.message}`);
    }
  }

  /**
   * Update Twitter settings for an agent
   */
  static async updateSettings(
    agentId: string,
    settings: { enabled?: boolean; autoPost?: boolean; handle?: string }
  ): Promise<boolean> {
    const config = dbHelpers.getTwitterConfig(agentId);
    if (!config) {
      throw new Error('Twitter not configured for this agent');
    }

    if (settings.enabled !== undefined) config.enabled = settings.enabled;
    if (settings.autoPost !== undefined) config.autoPost = settings.autoPost;
    if (settings.handle !== undefined) config.handle = settings.handle;

    await db.write();
    return true;
  }

  /**
   * Remove Twitter configuration for an agent
   */
  static async removeConfig(agentId: string): Promise<boolean> {
    if (!db.data!.twitterConfigs) return true;

    const index = db.data!.twitterConfigs.findIndex(c => c.agentId === agentId);
    if (index >= 0) {
      db.data!.twitterConfigs.splice(index, 1);
      await db.write();
    }

    this.clearClientCache(agentId);
    return true;
  }

  /**
   * Get Twitter status for an agent (without exposing credentials)
   */
  static getStatus(agentId: string): {
    configured: boolean;
    enabled: boolean;
    autoPost: boolean;
    handle?: string;
    tweetCount?: number;
  } {
    const config = dbHelpers.getTwitterConfig(agentId);
    if (!config) {
      return { configured: false, enabled: false, autoPost: false };
    }

    const tweets = db.data!.tweetLog?.filter(t => t.agentId === agentId) || [];

    return {
      configured: true,
      enabled: config.enabled,
      autoPost: config.autoPost,
      handle: config.handle,
      tweetCount: tweets.length,
    };
  }

  /**
   * Log a tweet for history/analytics
   */
  private static async logTweet(
    agentId: string,
    tweet: { tweetId: string; text: string; url: string; timestamp: string }
  ): Promise<void> {
    if (!db.data!.tweetLog) {
      db.data!.tweetLog = [];
    }

    db.data!.tweetLog.push({
      ...tweet,
      agentId,
    });

    // Keep only last 1000 tweets per agent to prevent unbounded growth
    const agentTweets = db.data!.tweetLog.filter(t => t.agentId === agentId);
    if (agentTweets.length > 1000) {
      const toRemove = agentTweets.slice(0, agentTweets.length - 1000);
      db.data!.tweetLog = db.data!.tweetLog.filter(t => !toRemove.includes(t));
    }

    await db.write();
  }

  /**
   * Get tweet history for an agent
   */
  static getTweetHistory(agentId: string, limit: number = 50): {
    tweetId: string;
    text: string;
    url: string;
    timestamp: string;
  }[] {
    const tweets = db.data!.tweetLog?.filter(t => t.agentId === agentId) || [];
    return tweets
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
      .map(({ agentId: _, ...rest }) => rest);
  }
}
