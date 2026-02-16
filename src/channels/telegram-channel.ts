/**
 * K.I.T. Telegram Channel - Grammy Edition
 * Using Grammy library like OpenClaw for reliable polling
 */

import { Bot, Context } from 'grammy';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');
const OFFSET_PATH = path.join(KIT_HOME, 'telegram_offset.json');

export interface TelegramMessage {
  messageId: number;
  chatId: number;
  userId: number;
  username?: string;
  firstName?: string;
  text: string;
  date: Date;
  threadId?: number;
  isTopicMessage?: boolean;
  callbackQueryId?: string;
  callbackData?: string;
  isVoiceMessage?: boolean;
  voiceDuration?: number;
}

export interface TelegramChannelConfig {
  token: string;
  chatId?: string;
  pollingInterval?: number;
  allowedChatIds?: string[];
  voiceEnabled?: boolean;
  openaiApiKey?: string;
}

type MessageHandler = (msg: TelegramMessage) => Promise<string>;

export class TelegramChannel extends EventEmitter {
  private config: TelegramChannelConfig;
  private bot: Bot | null = null;
  private messageHandler: MessageHandler | null = null;
  private running: boolean = false;

  constructor(config: TelegramChannelConfig) {
    super();
    this.config = {
      pollingInterval: 2000,
      voiceEnabled: true,
      ...config,
    };
  }

  /**
   * Transcribe voice message using OpenAI Whisper
   */
  private async transcribeVoice(fileBuffer: Buffer): Promise<string | null> {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    
    try {
      const boundary = '----KITVoice' + Date.now();
      const formParts: Buffer[] = [];
      
      formParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="voice.ogg"\r\nContent-Type: audio/ogg\r\n\r\n`
      ));
      formParts.push(fileBuffer);
      formParts.push(Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n--${boundary}--\r\n`));
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: Buffer.concat(formParts),
      });
      
      if (!response.ok) return null;
      const result = await response.json() as any;
      return result.text || null;
    } catch {
      return null;
    }
  }

  /**
   * Start the bot using Grammy
   */
  async start(handler: MessageHandler): Promise<void> {
    if (this.running) {
      console.log('[TG] Already running');
      return;
    }

    this.messageHandler = handler;
    this.running = true;
    
    console.log('[TG] Creating Grammy bot...');
    this.bot = new Bot(this.config.token);

    // Handle text messages
    this.bot.on('message:text', async (ctx) => {
      await this.handleMessage(ctx);
    });

    // Handle voice messages
    this.bot.on('message:voice', async (ctx) => {
      if (this.config.voiceEnabled) {
        await this.handleVoiceMessage(ctx);
      }
    });

    // Handle callback queries (button presses)
    this.bot.on('callback_query:data', async (ctx) => {
      await this.handleCallback(ctx);
    });

    // Error handler
    this.bot.catch((err) => {
      console.error('[TG] Bot error:', err.message);
    });

    // Start polling
    console.log('[TG] Starting Grammy polling...');
    
    try {
      // Delete webhook first (in case it was set)
      await this.bot.api.deleteWebhook({ drop_pending_updates: false });
      
      // Start the bot
      this.bot.start({
        drop_pending_updates: false,
        onStart: (botInfo) => {
          console.log(`[TG] ✅ Bot @${botInfo.username} is now polling!`);
        },
      });
    } catch (error: any) {
      console.error('[TG] Failed to start:', error.message);
      this.running = false;
    }
  }

  /**
   * Stop the bot
   */
  async stop(): Promise<void> {
    if (this.bot && this.running) {
      await this.bot.stop();
      this.running = false;
      console.log('[TG] Stopped');
    }
  }

  /**
   * Handle incoming text message
   */
  private async handleMessage(ctx: Context): Promise<void> {
    const msg = ctx.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const logPrefix = `[TG ${chatId}]`;
    
    // Check if chat is allowed
    if (this.config.allowedChatIds?.length) {
      if (!this.config.allowedChatIds.includes(String(chatId))) {
        console.log(`${logPrefix} Ignoring unauthorized chat`);
        return;
      }
    }

    console.log(`${logPrefix} ▶ "${msg.text.slice(0, 50)}..." from ${msg.from?.username || msg.from?.first_name || 'unknown'}`);

    // Send typing indicator
    await ctx.api.sendChatAction(chatId, 'typing').catch(() => {});

    // Create message object
    const telegramMsg: TelegramMessage = {
      messageId: msg.message_id,
      chatId: chatId,
      userId: msg.from?.id || 0,
      username: msg.from?.username,
      firstName: msg.from?.first_name,
      text: msg.text,
      date: new Date(msg.date * 1000),
      threadId: msg.message_thread_id,
      isTopicMessage: msg.is_topic_message,
    };

    // Emit event
    this.emit('message', telegramMsg);

    // Process with handler
    if (this.messageHandler) {
      try {
        console.log(`${logPrefix} ⏳ Calling handler...`);
        const startTime = Date.now();
        
        const response = await this.messageHandler(telegramMsg);
        
        const elapsed = Date.now() - startTime;
        console.log(`${logPrefix} ✓ Handler returned in ${elapsed}ms, ${response?.length || 0} chars`);

        if (response && response.trim()) {
          console.log(`${logPrefix} 📤 Sending response...`);
          await this.sendMessage(chatId, response, { threadId: msg.message_thread_id });
          console.log(`${logPrefix} ✅ Response sent!`);
        }
      } catch (error: any) {
        console.error(`${logPrefix} ❌ Handler error:`, error.message);
        await this.sendMessage(chatId, `❌ Error: ${error.message}`, { threadId: msg.message_thread_id });
      }
    }
  }

  /**
   * Handle voice message
   */
  private async handleVoiceMessage(ctx: Context): Promise<void> {
    const msg = ctx.message;
    if (!msg || !msg.voice) return;

    const chatId = msg.chat.id;
    console.log(`[TG ${chatId}] 🎤 Voice message received (${msg.voice.duration}s)`);

    try {
      // Download voice file
      const file = await ctx.api.getFile(msg.voice.file_id);
      if (!file.file_path) return;

      const fileUrl = `https://api.telegram.org/file/bot${this.config.token}/${file.file_path}`;
      const response = await fetch(fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());

      // Transcribe
      const transcription = await this.transcribeVoice(buffer);
      if (transcription) {
        console.log(`[TG ${chatId}] 📝 Transcribed: "${transcription}"`);
        
        // Process as text message
        const telegramMsg: TelegramMessage = {
          messageId: msg.message_id,
          chatId: chatId,
          userId: msg.from?.id || 0,
          username: msg.from?.username,
          firstName: msg.from?.first_name,
          text: transcription,
          date: new Date(msg.date * 1000),
          threadId: msg.message_thread_id,
          isVoiceMessage: true,
          voiceDuration: msg.voice.duration,
        };

        this.emit('message', telegramMsg);

        if (this.messageHandler) {
          const response = await this.messageHandler(telegramMsg);
          if (response && response.trim()) {
            await this.sendMessage(chatId, response, { threadId: msg.message_thread_id });
          }
        }
      }
    } catch (error: any) {
      console.error(`[TG ${chatId}] Voice error:`, error.message);
    }
  }

  /**
   * Handle callback query (button press)
   */
  private async handleCallback(ctx: Context): Promise<void> {
    const query = ctx.callbackQuery;
    if (!query || !query.data) return;

    const chatId = query.message?.chat.id || query.from.id;
    console.log(`[TG ${chatId}] 🔘 Button pressed: ${query.data}`);

    // Answer the callback
    await ctx.answerCallbackQuery().catch(() => {});

    // Create message object
    const telegramMsg: TelegramMessage = {
      messageId: query.message?.message_id || 0,
      chatId: chatId,
      userId: query.from.id,
      username: query.from.username,
      firstName: query.from.first_name,
      text: `callback_data: ${query.data}`,
      date: new Date(),
      callbackQueryId: query.id,
      callbackData: query.data,
    };

    this.emit('message', telegramMsg);

    if (this.messageHandler) {
      try {
        const response = await this.messageHandler(telegramMsg);
        if (response && response.trim()) {
          await this.sendMessage(chatId, response);
        }
      } catch (error: any) {
        console.error(`[TG ${chatId}] Callback error:`, error.message);
      }
    }
  }

  /**
   * Chunk text for Telegram (max 4096 chars)
   */
  private chunkText(text: string, maxLength: number = 4000): string[] {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      let breakAt = maxLength;
      const paraBreak = remaining.lastIndexOf('\n\n', maxLength);
      if (paraBreak > maxLength * 0.5) {
        breakAt = paraBreak + 2;
      } else {
        const sentenceBreaks = ['. ', '! ', '? '];
        let best = -1;
        for (const br of sentenceBreaks) {
          const idx = remaining.lastIndexOf(br, maxLength);
          if (idx > best) best = idx;
        }
        if (best > maxLength * 0.5) {
          breakAt = best + 2;
        } else {
          const space = remaining.lastIndexOf(' ', maxLength);
          if (space > maxLength * 0.5) breakAt = space + 1;
        }
      }
      
      chunks.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    
    return chunks;
  }

  /**
   * Send a message
   */
  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyToMessageId?: number;
    threadId?: number;
  }): Promise<boolean> {
    if (!this.bot) return false;

    const chunks = this.chunkText(text);
    let allSuccess = true;
    
    for (let i = 0; i < chunks.length; i++) {
      try {
        await this.bot.api.sendMessage(chatId, chunks[i], {
          parse_mode: options?.parseMode,
          reply_to_message_id: i === 0 ? options?.replyToMessageId : undefined,
          message_thread_id: options?.threadId,
        });
        
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (error: any) {
        console.error('[TG] sendMessage error:', error.message);
        allSuccess = false;
        
        // Retry without parse mode if that was the issue
        if (options?.parseMode && error.message?.includes('parse')) {
          try {
            await this.bot.api.sendMessage(chatId, chunks[i], {
              message_thread_id: options?.threadId,
            });
            allSuccess = true;
          } catch {
            // Give up
          }
        }
      }
    }
    
    return allSuccess;
  }

  /**
   * Send typing indicator
   */
  async sendTyping(chatId: number | string): Promise<void> {
    if (this.bot) {
      await this.bot.api.sendChatAction(chatId, 'typing').catch(() => {});
    }
  }

  /**
   * Send message with inline buttons
   */
  async sendMessageWithButtons(
    chatId: number | string,
    text: string,
    buttons: Array<Array<{ text: string; callbackData?: string; url?: string }>>,
    options?: { parseMode?: 'HTML' | 'Markdown'; threadId?: number }
  ): Promise<boolean> {
    if (!this.bot) return false;

    const inlineKeyboard = buttons.map(row =>
      row.map(btn => btn.url 
        ? { text: btn.text, url: btn.url }
        : { text: btn.text, callback_data: btn.callbackData || btn.text }
      )
    );

    try {
      await this.bot.api.sendMessage(chatId, text, {
        parse_mode: options?.parseMode,
        message_thread_id: options?.threadId,
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set reaction on message
   */
  async setReaction(chatId: number | string, messageId: number, emoji: string): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.api.setMessageReaction(chatId, messageId, [{ type: 'emoji', emoji }]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get bot info
   */
  async getMe(): Promise<{ id: number; username: string; firstName: string } | null> {
    if (!this.bot) return null;
    try {
      const me = await this.bot.api.getMe();
      return {
        id: me.id,
        username: me.username || '',
        firstName: me.first_name,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Create Telegram channel from config
 */
export function createTelegramChannel(): TelegramChannel | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const telegram = config.channels?.telegram;

    if (!telegram?.token) return null;

    const openaiKey = config.ai?.providers?.openai?.apiKey || process.env.OPENAI_API_KEY;

    return new TelegramChannel({
      token: telegram.token,
      chatId: telegram.chatId,
      allowedChatIds: telegram.chatId ? [String(telegram.chatId)] : undefined,
      voiceEnabled: telegram.voiceEnabled !== false,
      openaiApiKey: openaiKey,
    });
  } catch {
    return null;
  }
}

/**
 * Start Telegram channel with K.I.T. chat integration
 */
export async function startTelegramWithChat(
  chatHandler: (message: string, context: { chatId: number; userId: number; username?: string }) => Promise<string>
): Promise<TelegramChannel | null> {
  const channel = createTelegramChannel();
  
  if (!channel) {
    console.log('[TG] Not configured - skipping');
    return null;
  }

  await channel.start(async (msg) => {
    await channel.sendTyping(msg.chatId);
    return await chatHandler(msg.text, {
      chatId: msg.chatId,
      userId: msg.userId,
      username: msg.username,
    });
  });

  return channel;
}
