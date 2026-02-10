/**
 * K.I.T. Discord Channel
 * Bidirectional Discord bot - listens AND responds to messages
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import {
  Client,
  GatewayIntentBits,
  Message,
  Partials,
  TextChannel,
  DMChannel,
  ChannelType,
  PermissionsBitField,
} from 'discord.js';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export interface DiscordMessage {
  messageId: string;
  channelId: string;
  guildId?: string;
  guildName?: string;
  channelName?: string;
  userId: string;
  username: string;
  displayName: string;
  text: string;
  timestamp: Date;
  isDM: boolean;
  isBot: boolean;
  replyToMessageId?: string;
  mentions: {
    users: string[];
    roles: string[];
    everyone: boolean;
  };
}

export interface DiscordChannelConfig {
  token: string;
  allowedGuildIds?: string[];    // If set, only respond in these guilds
  allowedChannelIds?: string[];  // If set, only respond in these channels
  allowedUserIds?: string[];     // If set, only respond to these users
  respondToBots?: boolean;       // Default: false
  respondToMentionsOnly?: boolean; // Default: false (respond to all messages)
  prefix?: string;               // Command prefix (e.g., "!" or "kit ")
}

export class DiscordChannel extends EventEmitter {
  private config: DiscordChannelConfig;
  private client: Client | null = null;
  private messageHandler: ((msg: DiscordMessage) => Promise<string>) | null = null;
  private isConnected: boolean = false;
  private botUserId: string | null = null;

  constructor(config: DiscordChannelConfig) {
    super();
    this.config = {
      respondToBots: false,
      respondToMentionsOnly: false,
      ...config,
    };
  }

  /**
   * Start listening for messages
   */
  async start(handler: (msg: DiscordMessage) => Promise<string>): Promise<void> {
    if (this.isConnected) {
      console.log('[Discord] Already connected');
      return;
    }

    this.messageHandler = handler;

    // Create Discord client with necessary intents
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
      ],
    });

    // Handle ready event
    this.client.once('ready', () => {
      console.log(`[Discord] Logged in as ${this.client?.user?.tag}`);
      this.isConnected = true;
      this.botUserId = this.client?.user?.id || null;
      this.emit('ready', {
        username: this.client?.user?.username,
        id: this.client?.user?.id,
        tag: this.client?.user?.tag,
      });
    });

    // Handle messages
    this.client.on('messageCreate', async (message: Message) => {
      await this.handleMessage(message);
    });

    // Handle errors
    this.client.on('error', (error) => {
      console.error('[Discord] Client error:', error);
      this.emit('error', error);
    });

    // Handle disconnection
    this.client.on('disconnect', () => {
      console.log('[Discord] Disconnected');
      this.isConnected = false;
      this.emit('disconnect');
    });

    // Login
    console.log('[Discord] Connecting...');
    await this.client.login(this.config.token);
  }

  /**
   * Stop listening and disconnect
   */
  async stop(): Promise<void> {
    if (this.client) {
      this.client.destroy();
      this.client = null;
      this.isConnected = false;
      console.log('[Discord] Disconnected');
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(message: Message): Promise<void> {
    // Ignore messages from self
    if (message.author.id === this.botUserId) return;

    // Ignore bot messages unless configured
    if (message.author.bot && !this.config.respondToBots) return;

    // Check guild restrictions
    if (this.config.allowedGuildIds && this.config.allowedGuildIds.length > 0) {
      if (message.guild && !this.config.allowedGuildIds.includes(message.guild.id)) {
        return;
      }
    }

    // Check channel restrictions
    if (this.config.allowedChannelIds && this.config.allowedChannelIds.length > 0) {
      if (!this.config.allowedChannelIds.includes(message.channel.id)) {
        return;
      }
    }

    // Check user restrictions
    if (this.config.allowedUserIds && this.config.allowedUserIds.length > 0) {
      if (!this.config.allowedUserIds.includes(message.author.id)) {
        return;
      }
    }

    // Check if bot is mentioned (for mentions-only mode)
    const isMentioned = message.mentions.users.has(this.botUserId || '');
    if (this.config.respondToMentionsOnly && !isMentioned && !message.channel.isDMBased()) {
      return;
    }

    // Check prefix
    let text = message.content;
    if (this.config.prefix) {
      if (!text.startsWith(this.config.prefix)) {
        // If prefix required but missing, only respond if mentioned
        if (!isMentioned) return;
      } else {
        // Remove prefix
        text = text.slice(this.config.prefix.length).trim();
      }
    }

    // Remove bot mention from text if present
    if (isMentioned && this.botUserId) {
      text = text.replace(new RegExp(`<@!?${this.botUserId}>`, 'g'), '').trim();
    }

    // Skip empty messages
    if (!text) return;

    const discordMsg: DiscordMessage = {
      messageId: message.id,
      channelId: message.channel.id,
      guildId: message.guild?.id,
      guildName: message.guild?.name,
      channelName: message.channel.type === ChannelType.DM 
        ? 'DM' 
        : (message.channel as TextChannel).name,
      userId: message.author.id,
      username: message.author.username,
      displayName: message.member?.displayName || message.author.displayName || message.author.username,
      text,
      timestamp: message.createdAt,
      isDM: message.channel.isDMBased(),
      isBot: message.author.bot,
      replyToMessageId: message.reference?.messageId,
      mentions: {
        users: Array.from(message.mentions.users.keys()),
        roles: Array.from(message.mentions.roles.keys()),
        everyone: message.mentions.everyone,
      },
    };

    // Emit event
    this.emit('message', discordMsg);

    // Process with handler
    if (this.messageHandler) {
      try {
        console.log(`[Discord] Processing message from ${discordMsg.displayName}: ${text.substring(0, 100)}...`);
        
        // Show typing indicator
        await this.sendTyping(message.channel as TextChannel | DMChannel);
        
        const response = await this.messageHandler(discordMsg);
        
        if (response && response.trim()) {
          await this.sendReply(message, response);
        }
      } catch (error) {
        console.error('[Discord] Handler error:', error);
        await this.sendReply(message, '❌ Sorry, I encountered an error processing your message.');
      }
    }
  }

  /**
   * Chunk text for Discord (max 2000 chars per message)
   */
  private chunkText(text: string, maxLength: number = 1900): string[] {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      let breakAt = maxLength;
      
      // Try code block break (```)
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
   * Send a reply to a message (auto-chunks long messages)
   */
  private async sendReply(originalMessage: Message, text: string): Promise<boolean> {
    const chunks = this.chunkText(text);
    let allSuccess = true;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        if (i === 0) {
          // First chunk: reply to original
          await originalMessage.reply({
            content: chunk,
            allowedMentions: { repliedUser: false },
          });
        } else {
          // Subsequent chunks: send as follow-up
          const channel = originalMessage.channel;
          if ('send' in channel && typeof channel.send === 'function') {
            await channel.send(chunk);
          }
        }
        
        // Small delay between chunks
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (error) {
        console.error('[Discord] Send error:', error);
        allSuccess = false;
      }
    }
    
    return allSuccess;
  }

  /**
   * Send a message to a channel
   */
  async sendMessage(channelId: string, text: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) {
        console.error('[Discord] Invalid channel or not text-based');
        return false;
      }
      
      const textChannel = channel as TextChannel | DMChannel;
      const chunks = this.chunkText(text);
      
      for (const chunk of chunks) {
        await textChannel.send(chunk);
        await new Promise(r => setTimeout(r, 100));
      }
      
      return true;
    } catch (error) {
      console.error('[Discord] Send error:', error);
      return false;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(channel: TextChannel | DMChannel): Promise<void> {
    try {
      await channel.sendTyping();
    } catch (error) {
      // Ignore typing errors
    }
  }

  /**
   * Add a reaction to a message
   */
  async addReaction(channelId: string, messageId: string, emoji: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return false;
      
      const message = await (channel as TextChannel | DMChannel).messages.fetch(messageId);
      await message.react(emoji);
      return true;
    } catch (error) {
      console.error('[Discord] Reaction error:', error);
      return false;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(channelId: string, messageId: string, text: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return false;
      
      const message = await (channel as TextChannel | DMChannel).messages.fetch(messageId);
      
      // Can only edit own messages
      if (message.author.id !== this.botUserId) {
        console.error('[Discord] Cannot edit messages from other users');
        return false;
      }
      
      await message.edit(text);
      return true;
    } catch (error) {
      console.error('[Discord] Edit error:', error);
      return false;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(channelId: string, messageId: string): Promise<boolean> {
    if (!this.client) return false;
    
    try {
      const channel = await this.client.channels.fetch(channelId);
      if (!channel || !channel.isTextBased()) return false;
      
      const message = await (channel as TextChannel | DMChannel).messages.fetch(messageId);
      await message.delete();
      return true;
    } catch (error) {
      console.error('[Discord] Delete error:', error);
      return false;
    }
  }

  /**
   * Get bot info
   */
  getBotInfo(): { id: string; username: string; tag: string } | null {
    if (!this.client?.user) return null;
    return {
      id: this.client.user.id,
      username: this.client.user.username,
      tag: this.client.user.tag,
    };
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

/**
 * Create Discord channel from config
 */
export function createDiscordChannel(): DiscordChannel | null {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const discord = config.channels?.discord;

  if (!discord?.token) {
    return null;
  }

  return new DiscordChannel({
    token: discord.token,
    allowedGuildIds: discord.allowedGuildIds,
    allowedChannelIds: discord.allowedChannelIds,
    allowedUserIds: discord.allowedUserIds,
    respondToBots: discord.respondToBots,
    respondToMentionsOnly: discord.respondToMentionsOnly,
    prefix: discord.prefix,
  });
}

/**
 * Check if Discord credentials exist
 */
export function hasDiscordCredentials(): boolean {
  if (!fs.existsSync(CONFIG_PATH)) return false;
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  return !!config.channels?.discord?.token;
}

/**
 * Start Discord channel with K.I.T. chat integration
 */
export async function startDiscordWithChat(
  chatHandler: (message: string, context: { 
    channelId: string; 
    userId: string; 
    username: string;
    guildId?: string;
    guildName?: string;
  }) => Promise<string>
): Promise<DiscordChannel | null> {
  const channel = createDiscordChannel();
  
  if (!channel) {
    console.log('[Discord] Not configured - skipping');
    return null;
  }

  await channel.start(async (msg) => {
    const response = await chatHandler(msg.text, {
      channelId: msg.channelId,
      userId: msg.userId,
      username: msg.username,
      guildId: msg.guildId,
      guildName: msg.guildName,
    });

    return response;
  });

  console.log('[Discord] Channel started and listening for messages');
  return channel;
}
