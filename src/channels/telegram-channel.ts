/**
 * K.I.T. Telegram Channel
 * Bidirectional Telegram bot - listens AND responds to messages
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export interface TelegramMessage {
  messageId: number;
  chatId: number;
  userId: number;
  username?: string;
  firstName?: string;
  text: string;
  date: Date;
}

export interface TelegramChannelConfig {
  token: string;
  chatId?: string;
  pollingInterval?: number; // ms, default 2000
  allowedChatIds?: string[]; // If set, only respond to these chats
}

export class TelegramChannel extends EventEmitter {
  private config: TelegramChannelConfig;
  private lastUpdateId: number = 0;
  private polling: boolean = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private messageHandler: ((msg: TelegramMessage) => Promise<string>) | null = null;

  constructor(config: TelegramChannelConfig) {
    super();
    this.config = {
      pollingInterval: 2000,
      ...config,
    };
  }

  /**
   * Start listening for messages
   */
  async start(handler: (msg: TelegramMessage) => Promise<string>): Promise<void> {
    if (this.polling) {
      console.log('[Telegram] Already polling');
      return;
    }

    this.messageHandler = handler;
    this.polling = true;
    console.log('[Telegram] Starting message polling...');

    // Initial fetch to get latest update ID
    await this.getUpdates(true);

    // Start polling loop
    this.poll();
  }

  /**
   * Stop listening
   */
  stop(): void {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[Telegram] Stopped polling');
  }

  /**
   * Poll for new messages
   */
  private async poll(): Promise<void> {
    if (!this.polling) return;

    try {
      const messages = await this.getUpdates();
      
      for (const msg of messages) {
        // Check if chat is allowed
        if (this.config.allowedChatIds && this.config.allowedChatIds.length > 0) {
          if (!this.config.allowedChatIds.includes(String(msg.chatId))) {
            console.log(`[Telegram] Ignoring message from unauthorized chat: ${msg.chatId}`);
            continue;
          }
        }

        // Emit event
        this.emit('message', msg);

        // Process with handler
        if (this.messageHandler) {
          try {
            console.log(`[Telegram] Processing message from ${msg.username || msg.firstName}: ${msg.text}`);
            const response = await this.messageHandler(msg);
            
            if (response && response.trim()) {
              await this.sendMessage(msg.chatId, response);
            }
          } catch (error) {
            console.error('[Telegram] Handler error:', error);
            await this.sendMessage(msg.chatId, '❌ Sorry, I encountered an error processing your message.');
          }
        }
      }
    } catch (error) {
      console.error('[Telegram] Polling error:', error);
    }

    // Schedule next poll
    if (this.polling) {
      this.pollTimer = setTimeout(() => this.poll(), this.config.pollingInterval);
    }
  }

  /**
   * Get updates from Telegram
   */
  private async getUpdates(skipProcess = false): Promise<TelegramMessage[]> {
    const url = `https://api.telegram.org/bot${this.config.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`;
    
    const response = await fetch(url);
    const data = await response.json() as any;

    if (!data.ok) {
      throw new Error(`Telegram API error: ${data.description}`);
    }

    const messages: TelegramMessage[] = [];

    for (const update of data.result || []) {
      // Update the offset
      if (update.update_id > this.lastUpdateId) {
        this.lastUpdateId = update.update_id;
      }

      // Skip if just initializing
      if (skipProcess) continue;

      // Extract message
      const msg = update.message;
      if (msg && msg.text) {
        messages.push({
          messageId: msg.message_id,
          chatId: msg.chat.id,
          userId: msg.from.id,
          username: msg.from.username,
          firstName: msg.from.first_name,
          text: msg.text,
          date: new Date(msg.date * 1000),
        });
      }
    }

    return messages;
  }

  /**
   * Send a message
   */
  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyToMessageId?: number;
  }): Promise<boolean> {
    const params: any = {
      chat_id: chatId,
      text: text,
    };

    if (options?.parseMode) params.parse_mode = options.parseMode;
    if (options?.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json() as any;
      
      if (!data.ok) {
        console.error('[Telegram] Send failed:', data.description);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[Telegram] Send error:', error);
      return false;
    }
  }

  /**
   * Send typing indicator
   */
  async sendTyping(chatId: number | string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${this.config.token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          action: 'typing',
        }),
      });
    } catch (error) {
      // Ignore typing indicator errors
    }
  }
}

/**
 * Create Telegram channel from config
 */
export function createTelegramChannel(): TelegramChannel | null {
  if (!fs.existsSync(CONFIG_PATH)) {
    return null;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const telegram = config.channels?.telegram;

  if (!telegram?.token) {
    return null;
  }

  return new TelegramChannel({
    token: telegram.token,
    chatId: telegram.chatId,
    allowedChatIds: telegram.chatId ? [String(telegram.chatId)] : undefined,
  });
}

/**
 * Start Telegram channel with K.I.T. chat integration
 */
export async function startTelegramWithChat(
  chatHandler: (message: string, context: { chatId: number; userId: number; username?: string }) => Promise<string>
): Promise<TelegramChannel | null> {
  const channel = createTelegramChannel();
  
  if (!channel) {
    console.log('[Telegram] Not configured - skipping');
    return null;
  }

  await channel.start(async (msg) => {
    // Send typing indicator
    await channel.sendTyping(msg.chatId);
    
    // Get response from chat handler
    const response = await chatHandler(msg.text, {
      chatId: msg.chatId,
      userId: msg.userId,
      username: msg.username,
    });

    return response;
  });

  console.log('[Telegram] Channel started and listening for messages');
  return channel;
}
