/**
 * K.I.T. Slack Channel
 * Bidirectional Slack bot - listens AND responds to messages
 * Uses @slack/bolt for easy setup
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { App, LogLevel, SlackEventMiddlewareArgs, GenericMessageEvent } from '@slack/bolt';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export interface SlackMessage {
  messageId: string;       // ts (timestamp) - unique message ID in Slack
  channelId: string;
  channelName?: string;
  channelType: 'public_channel' | 'private_channel' | 'dm' | 'mpim' | 'unknown';
  userId: string;
  username?: string;
  displayName?: string;
  text: string;
  timestamp: Date;
  threadTs?: string;       // Thread parent timestamp (for threaded replies)
  isThreadReply: boolean;
  isMention: boolean;      // Bot was mentioned
  isDM: boolean;
  isBot: boolean;
  mentions: string[];      // User IDs mentioned in message
}

export interface SlackChannelConfig {
  botToken: string;              // xoxb-...
  appToken: string;              // xapp-... (for socket mode)
  signingSecret?: string;        // For HTTP mode (optional with socket mode)
  allowedChannelIds?: string[];  // If set, only respond in these channels
  allowedUserIds?: string[];     // If set, only respond to these users
  respondToBots?: boolean;       // Default: false
  respondToMentionsOnly?: boolean; // Default: false in DMs, true in channels
  useSocketMode?: boolean;       // Default: true
  port?: number;                 // For HTTP mode
}

export class SlackChannel extends EventEmitter {
  private config: SlackChannelConfig;
  private app: App | null = null;
  private messageHandler: ((msg: SlackMessage) => Promise<string>) | null = null;
  private isConnected: boolean = false;
  private botUserId: string | null = null;
  private botInfo: { id: string; name: string } | null = null;

  constructor(config: SlackChannelConfig) {
    super();
    this.config = {
      respondToBots: false,
      respondToMentionsOnly: false,
      useSocketMode: true,
      ...config,
    };
  }

  /**
   * Start listening for messages
   */
  async start(handler: (msg: SlackMessage) => Promise<string>): Promise<void> {
    if (this.isConnected) {
      console.log('[Slack] Already connected');
      return;
    }

    this.messageHandler = handler;

    // Create Slack app
    const appConfig: any = {
      token: this.config.botToken,
      logLevel: LogLevel.WARN,
    };

    if (this.config.useSocketMode) {
      appConfig.socketMode = true;
      appConfig.appToken = this.config.appToken;
    } else {
      appConfig.signingSecret = this.config.signingSecret;
      appConfig.port = this.config.port || 3000;
    }

    this.app = new App(appConfig);

    // Get bot info
    try {
      const authResult = await this.app.client.auth.test({
        token: this.config.botToken,
      });
      this.botUserId = authResult.user_id as string;
      this.botInfo = {
        id: authResult.user_id as string,
        name: authResult.user as string,
      };
      console.log(`[Slack] Bot identified as @${authResult.user} (${authResult.user_id})`);
    } catch (error) {
      console.error('[Slack] Failed to get bot info:', error);
    }

    // Handle messages
    this.app.message(async ({ message, say, client }) => {
      await this.handleMessage(message as GenericMessageEvent, say, client);
    });

    // Handle app mentions (when bot is @mentioned)
    this.app.event('app_mention', async ({ event, say, client }) => {
      // app_mention events are also received as messages, 
      // but we handle them explicitly for mentions-only mode
      await this.handleAppMention(event, say, client);
    });

    // Handle errors
    this.app.error(async (error) => {
      console.error('[Slack] App error:', error);
      this.emit('error', error);
    });

    // Start the app
    console.log('[Slack] Connecting...');
    await this.app.start();
    this.isConnected = true;
    
    console.log(`[Slack] Connected and listening for messages`);
    this.emit('ready', this.botInfo);
  }

  /**
   * Stop listening and disconnect
   */
  async stop(): Promise<void> {
    if (this.app) {
      await this.app.stop();
      this.app = null;
      this.isConnected = false;
      console.log('[Slack] Disconnected');
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(
    message: GenericMessageEvent, 
    say: any,
    client: any
  ): Promise<void> {
    // Ignore messages from self
    if (message.user === this.botUserId) return;

    // Ignore bot messages unless configured
    if (message.bot_id && !this.config.respondToBots) return;

    // Ignore message subtypes (edits, deletes, etc.) - only handle new messages
    if (message.subtype) return;

    // Check channel restrictions
    if (this.config.allowedChannelIds && this.config.allowedChannelIds.length > 0) {
      if (!this.config.allowedChannelIds.includes(message.channel)) {
        return;
      }
    }

    // Check user restrictions
    if (this.config.allowedUserIds && this.config.allowedUserIds.length > 0) {
      if (!this.config.allowedUserIds.includes(message.user)) {
        return;
      }
    }

    // Determine if DM
    const isDM = message.channel_type === 'im';
    
    // Check if bot is mentioned
    const isMention = message.text?.includes(`<@${this.botUserId}>`) || false;

    // In channels, respond only if mentioned (unless configured otherwise)
    if (!isDM && this.config.respondToMentionsOnly && !isMention) {
      return;
    }

    // Clean text - remove bot mention
    let text = message.text || '';
    if (isMention && this.botUserId) {
      text = text.replace(new RegExp(`<@${this.botUserId}>`, 'g'), '').trim();
    }

    // Skip empty messages
    if (!text) return;

    // Get user info
    let username: string | undefined;
    let displayName: string | undefined;
    try {
      const userInfo = await client.users.info({ user: message.user });
      username = userInfo.user?.name;
      displayName = userInfo.user?.profile?.display_name || userInfo.user?.real_name || username;
    } catch (error) {
      // Ignore user info errors
    }

    // Get channel info
    let channelName: string | undefined;
    let channelType: SlackMessage['channelType'] = 'unknown';
    try {
      const channelInfo = await client.conversations.info({ channel: message.channel });
      channelName = channelInfo.channel?.name;
      if (channelInfo.channel?.is_im) channelType = 'dm';
      else if (channelInfo.channel?.is_mpim) channelType = 'mpim';
      else if (channelInfo.channel?.is_private) channelType = 'private_channel';
      else if (channelInfo.channel?.is_channel) channelType = 'public_channel';
    } catch (error) {
      // Ignore channel info errors
      if (isDM) channelType = 'dm';
    }

    // Extract mentions from text
    const mentionMatches = text.match(/<@[A-Z0-9]+>/g) || [];
    const mentions = mentionMatches.map(m => m.replace(/<@|>/g, ''));

    const slackMsg: SlackMessage = {
      messageId: message.ts,
      channelId: message.channel,
      channelName,
      channelType,
      userId: message.user,
      username,
      displayName,
      text,
      timestamp: new Date(parseFloat(message.ts) * 1000),
      threadTs: message.thread_ts,
      isThreadReply: !!message.thread_ts && message.thread_ts !== message.ts,
      isMention,
      isDM,
      isBot: !!message.bot_id,
      mentions,
    };

    // Emit event
    this.emit('message', slackMsg);

    // Process with handler
    if (this.messageHandler) {
      try {
        console.log(`[Slack] Processing message from ${displayName || username || message.user}: ${text.substring(0, 100)}...`);
        
        const response = await this.messageHandler(slackMsg);
        
        if (response && response.trim()) {
          // Reply in thread if message was in thread, or start new thread in channels
          const chunks = this.chunkText(response);
          
          for (let i = 0; i < chunks.length; i++) {
            await say({
              text: chunks[i],
              thread_ts: slackMsg.threadTs || (isDM ? undefined : slackMsg.messageId),
            });
            
            if (i < chunks.length - 1) {
              await new Promise(r => setTimeout(r, 100));
            }
          }
        }
      } catch (error) {
        console.error('[Slack] Handler error:', error);
        await say({
          text: '❌ Sorry, I encountered an error processing your message.',
          thread_ts: slackMsg.threadTs || (isDM ? undefined : slackMsg.messageId),
        });
      }
    }
  }

  /**
   * Handle app mention event
   */
  private async handleAppMention(event: any, say: any, client: any): Promise<void> {
    // The message handler already handles mentions via the message event
    // This is here for explicit app_mention handling if needed
    // Most logic is in handleMessage
  }

  /**
   * Chunk text for Slack (max 4000 chars for blocks, using 3900 to be safe)
   */
  private chunkText(text: string, maxLength: number = 3900): string[] {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      let breakAt = maxLength;
      
      // Try code block break
      const codeBlockBreak = remaining.lastIndexOf('\n```', maxLength);
      if (codeBlockBreak > maxLength * 0.3) {
        breakAt = codeBlockBreak + 1;
      } else {
        // Try paragraph break
        const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
        if (paragraphBreak > maxLength * 0.5) {
          breakAt = paragraphBreak + 2;
        } else {
          // Try line break
          const lineBreak = remaining.lastIndexOf('\n', maxLength);
          if (lineBreak > maxLength * 0.5) {
            breakAt = lineBreak + 1;
          } else {
            // Try word break
            const spaceBreak = remaining.lastIndexOf(' ', maxLength);
            if (spaceBreak > maxLength * 0.5) {
              breakAt = spaceBreak + 1;
            }
          }
        }
      }
      
      chunks.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    
    return chunks;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, text: string, options?: {
    threadTs?: string;
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
  }): Promise<{ ok: boolean; ts?: string; error?: string }> {
    if (!this.app) {
      return { ok: false, error: 'Not connected' };
    }

    try {
      const chunks = this.chunkText(text);
      let lastTs: string | undefined;
      
      for (let i = 0; i < chunks.length; i++) {
        const result = await this.app.client.chat.postMessage({
          channel: channelId,
          text: chunks[i],
          thread_ts: options?.threadTs || lastTs, // Chain chunks in thread
          unfurl_links: options?.unfurlLinks ?? false,
          unfurl_media: options?.unfurlMedia ?? true,
        });
        
        lastTs = result.ts as string;
        
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }
      
      return { ok: true, ts: lastTs };
    } catch (error: any) {
      console.error('[Slack] Send error:', error);
      return { ok: false, error: error.message || 'Send failed' };
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channelId: string, messageTs: string, emoji: string): Promise<boolean> {
    if (!this.app) return false;

    try {
      // Remove colons from emoji name if present
      const emojiName = emoji.replace(/:/g, '');
      
      await this.app.client.reactions.add({
        channel: channelId,
        timestamp: messageTs,
        name: emojiName,
      });
      return true;
    } catch (error) {
      console.error('[Slack] Reaction error:', error);
      return false;
    }
  }

  /**
   * Update a message
   */
  async updateMessage(channelId: string, messageTs: string, text: string): Promise<boolean> {
    if (!this.app) return false;

    try {
      await this.app.client.chat.update({
        channel: channelId,
        ts: messageTs,
        text,
      });
      return true;
    } catch (error) {
      console.error('[Slack] Update error:', error);
      return false;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(channelId: string, messageTs: string): Promise<boolean> {
    if (!this.app) return false;

    try {
      await this.app.client.chat.delete({
        channel: channelId,
        ts: messageTs,
      });
      return true;
    } catch (error) {
      console.error('[Slack] Delete error:', error);
      return false;
    }
  }

  /**
   * Get bot info
   */
  getBotInfo(): { id: string; name: string } | null {
    return this.botInfo;
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * List channels the bot is in
   */
  async listChannels(): Promise<Array<{ id: string; name: string; isPrivate: boolean }>> {
    if (!this.app) return [];

    try {
      const result = await this.app.client.conversations.list({
        types: 'public_channel,private_channel',
        exclude_archived: true,
      });

      return (result.channels || []).map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        isPrivate: ch.is_private,
      }));
    } catch (error) {
      console.error('[Slack] List channels error:', error);
      return [];
    }
  }
}

/**
 * Create Slack channel from config
 */
export function createSlackChannel(): SlackChannel | null {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const slack = config.channels?.slack;

  if (!slack?.botToken || !slack?.appToken) {
    return null;
  }

  return new SlackChannel({
    botToken: slack.botToken,
    appToken: slack.appToken,
    signingSecret: slack.signingSecret,
    allowedChannelIds: slack.allowedChannelIds,
    allowedUserIds: slack.allowedUserIds,
    respondToBots: slack.respondToBots,
    respondToMentionsOnly: slack.respondToMentionsOnly,
    useSocketMode: slack.useSocketMode ?? true,
    port: slack.port,
  });
}

/**
 * Check if Slack credentials exist
 */
export function hasSlackCredentials(): boolean {
  if (!fs.existsSync(CONFIG_PATH)) return false;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return !!(config.channels?.slack?.botToken && config.channels?.slack?.appToken);
}

/**
 * Start Slack channel with K.I.T. chat integration
 */
export async function startSlackWithChat(
  chatHandler: (message: string, context: { 
    channelId: string; 
    userId: string; 
    username?: string;
    channelName?: string;
    threadTs?: string;
  }) => Promise<string>
): Promise<SlackChannel | null> {
  const channel = createSlackChannel();
  
  if (!channel) {
    console.log('[Slack] Not configured - skipping');
    return null;
  }

  await channel.start(async (msg) => {
    const response = await chatHandler(msg.text, {
      channelId: msg.channelId,
      userId: msg.userId,
      username: msg.username,
      channelName: msg.channelName,
      threadTs: msg.threadTs,
    });

    return response;
  });

  console.log('[Slack] Channel started and listening for messages');
  return channel;
}
