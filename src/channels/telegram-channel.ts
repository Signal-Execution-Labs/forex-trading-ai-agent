/**
 * K.I.T. Telegram Channel - Simple & Reliable
 * Uses native fetch with explicit polling
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
  private lastUpdateId: number = 0;
  private polling: boolean = false;
  private messageHandler: MessageHandler | null = null;

  constructor(config: TelegramChannelConfig) {
    super();
    this.config = {
      pollingInterval: 2000,
      voiceEnabled: true,
      ...config,
    };
  }

  /**
   * Start polling
   */
  async start(handler: MessageHandler): Promise<void> {
    if (this.polling) {
      console.log('[TG] Already polling');
      return;
    }

    this.messageHandler = handler;
    this.polling = true;
    
    console.log('[TG] Starting...');

    // Delete webhook first
    try {
      await fetch(`https://api.telegram.org/bot${this.config.token}/deleteWebhook`);
    } catch (e) {}

    // Get initial offset
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.config.token}/getUpdates?limit=1&offset=-1`);
      const data = await res.json() as any;
      if (data.ok && data.result?.length > 0) {
        this.lastUpdateId = data.result[data.result.length - 1].update_id;
        console.log(`[TG] Initial offset: ${this.lastUpdateId}`);
      }
    } catch (e) {
      console.error('[TG] Failed to get initial offset:', e);
    }

    // Start polling loop
    console.log('[TG] Starting poll loop...');
    this.runPollLoop();
  }

  /**
   * Poll loop using recursion with setTimeout
   */
  private runPollLoop(): void {
    if (!this.polling) return;

    this.poll().finally(() => {
      if (this.polling) {
        setTimeout(() => this.runPollLoop(), this.config.pollingInterval || 2000);
      }
    });
  }

  /**
   * Single poll iteration
   */
  private async poll(): Promise<void> {
    try {
      const url = `https://api.telegram.org/bot${this.config.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=30`;
      
      const response = await fetch(url);
      const data = await response.json() as any;

      if (!data.ok) {
        if (data.description?.includes('Conflict')) {
          console.log('[TG] Conflict - another instance running?');
        } else {
          console.error('[TG] API error:', data.description);
        }
        return;
      }

      const updates = data.result || [];
      
      for (const update of updates) {
        this.lastUpdateId = update.update_id;
        
        // Handle message
        if (update.message) {
          const msg = update.message;
          const chatId = msg.chat.id;
          
          // Check allowed chats
          if (this.config.allowedChatIds?.length) {
            if (!this.config.allowedChatIds.includes(String(chatId))) {
              continue;
            }
          }
          
          // Voice message
          if (msg.voice && this.config.voiceEnabled) {
            console.log(`[TG ${chatId}] Voice message (${msg.voice.duration}s) from ${msg.from?.username || 'unknown'}`);
            
            // Transcribe voice message
            const transcription = await this.transcribeVoice(msg.voice.file_id);
            
            if (transcription) {
              console.log(`[TG ${chatId}] Transcribed: "${transcription.slice(0, 50)}..."`);
              
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
                this.processInBackground(telegramMsg);
              }
            } else {
              await this.sendMessage(chatId, '🎤 Sorry, I could not transcribe that voice message.', { threadId: msg.message_thread_id });
            }
          }
          // Text message
          else if (msg.text) {
            console.log(`[TG ${chatId}] Message: "${msg.text.slice(0, 50)}..." from ${msg.from?.username || 'unknown'}`);

            const telegramMsg: TelegramMessage = {
              messageId: msg.message_id,
              chatId: chatId,
              userId: msg.from?.id || 0,
              username: msg.from?.username,
              firstName: msg.from?.first_name,
              text: msg.text,
              date: new Date(msg.date * 1000),
              threadId: msg.message_thread_id,
            };

            this.emit('message', telegramMsg);

            // Process in background
            if (this.messageHandler) {
              this.processInBackground(telegramMsg);
            }
          }
        }

        // Handle callback query
        if (update.callback_query) {
          const query = update.callback_query;
          const chatId = query.message?.chat?.id || query.from.id;
          
          console.log(`[TG ${chatId}] Callback: ${query.data}`);

          // Answer callback
          await fetch(`https://api.telegram.org/bot${this.config.token}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: query.id }),
          }).catch(() => {});

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
            this.processInBackground(telegramMsg);
          }
        }
      }
    } catch (error: any) {
      // Don't log timeout errors
      if (!error.message?.includes('timeout')) {
        console.error('[TG] Poll error:', error.message);
      }
    }
  }

  /**
   * Process message in background (non-blocking)
   */
  private async processInBackground(msg: TelegramMessage): Promise<void> {
    const logPrefix = `[TG ${msg.chatId}]`;
    
    try {
      // Send typing
      await this.sendTyping(msg.chatId);

      console.log(`${logPrefix} Processing...`);
      const startTime = Date.now();
      
      const response = await this.messageHandler!(msg);
      
      const elapsed = Date.now() - startTime;
      console.log(`${logPrefix} Got response in ${elapsed}ms (${response?.length || 0} chars)`);

      if (response && response.trim()) {
        console.log(`${logPrefix} Sending...`);
        const sent = await this.sendMessage(msg.chatId, response, { threadId: msg.threadId });
        console.log(`${logPrefix} ${sent ? '✅ Sent!' : '❌ Failed'}`);
      }
    } catch (error: any) {
      console.error(`${logPrefix} Error:`, error.message);
      await this.sendMessage(msg.chatId, `❌ Error: ${error.message}`, { threadId: msg.threadId });
    }
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.polling = false;
    console.log('[TG] Stopped');
  }

  /**
   * Send message
   */
  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyToMessageId?: number;
    threadId?: number;
  }): Promise<boolean> {
    // Chunk if needed
    const chunks = this.chunkText(text);
    let success = true;
    
    for (let i = 0; i < chunks.length; i++) {
      const params: any = {
        chat_id: chatId,
        text: chunks[i],
      };
      if (options?.parseMode) params.parse_mode = options.parseMode;
      if (i === 0 && options?.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;
      if (options?.threadId) params.message_thread_id = options.threadId;

      try {
        const res = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const data = await res.json() as any;
        if (!data.ok) {
          console.error('[TG] Send failed:', data.description);
          success = false;
        }
      } catch (error: any) {
        console.error('[TG] Send error:', error.message);
        success = false;
      }
      
      if (i < chunks.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    return success;
  }

  /**
   * Send typing indicator
   */
  async sendTyping(chatId: number | string): Promise<void> {
    try {
      await fetch(`https://api.telegram.org/bot${this.config.token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      });
    } catch {}
  }

  /**
   * Transcribe voice message using OpenAI Whisper
   */
  private async transcribeVoice(fileId: string): Promise<string | null> {
    try {
      // Get file path from Telegram
      const fileRes = await fetch(`https://api.telegram.org/bot${this.config.token}/getFile?file_id=${fileId}`);
      const fileData = await fileRes.json() as any;
      
      if (!fileData.ok || !fileData.result?.file_path) {
        console.error('[TG] Failed to get voice file path');
        return null;
      }
      
      // Download the voice file
      const fileUrl = `https://api.telegram.org/file/bot${this.config.token}/${fileData.result.file_path}`;
      const audioRes = await fetch(fileUrl);
      const audioBuffer = await audioRes.arrayBuffer();
      
      // Get OpenAI API key
      const openaiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
      if (!openaiKey) {
        console.error('[TG] No OpenAI API key for voice transcription');
        return null;
      }
      
      // Create form data for Whisper API
      const formData = new FormData();
      const blob = new Blob([audioBuffer], { type: 'audio/ogg' });
      formData.append('file', blob, 'voice.ogg');
      formData.append('model', 'whisper-1');
      
      // Call OpenAI Whisper API
      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
        },
        body: formData,
      });
      
      if (!whisperRes.ok) {
        const error = await whisperRes.text();
        console.error('[TG] Whisper API error:', error);
        return null;
      }
      
      const result = await whisperRes.json() as any;
      return result.text || null;
    } catch (error: any) {
      console.error('[TG] Voice transcription error:', error.message);
      return null;
    }
  }

  /**
   * Chunk text
   */
  private chunkText(text: string, maxLen = 4000): string[] {
    if (text.length <= maxLen) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      
      let breakAt = maxLen;
      const para = remaining.lastIndexOf('\n\n', maxLen);
      if (para > maxLen * 0.5) breakAt = para + 2;
      else {
        const space = remaining.lastIndexOf(' ', maxLen);
        if (space > maxLen * 0.5) breakAt = space + 1;
      }
      
      chunks.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    
    return chunks;
  }

  /**
   * Send with buttons
   */
  async sendMessageWithButtons(
    chatId: number | string,
    text: string,
    buttons: Array<Array<{ text: string; callbackData?: string; url?: string }>>,
    options?: { parseMode?: 'HTML' | 'Markdown'; threadId?: number }
  ): Promise<boolean> {
    const keyboard = buttons.map(row =>
      row.map(btn => btn.url ? { text: btn.text, url: btn.url } : { text: btn.text, callback_data: btn.callbackData || btn.text })
    );

    try {
      const res = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: options?.parseMode,
          message_thread_id: options?.threadId,
          reply_markup: { inline_keyboard: keyboard },
        }),
      });
      const data = await res.json() as any;
      return data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Set reaction
   */
  async setReaction(chatId: number | string, messageId: number, emoji: string): Promise<boolean> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.config.token}/setMessageReaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji }],
        }),
      });
      const data = await res.json() as any;
      return data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get bot info
   */
  async getMe(): Promise<{ id: number; username: string; firstName: string } | null> {
    try {
      const res = await fetch(`https://api.telegram.org/bot${this.config.token}/getMe`);
      const data = await res.json() as any;
      if (data.ok) {
        return {
          id: data.result.id,
          username: data.result.username,
          firstName: data.result.first_name,
        };
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Create channel from config
 */
export function createTelegramChannel(): TelegramChannel | null {
  if (!fs.existsSync(CONFIG_PATH)) return null;

  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    const tg = config.channels?.telegram;
    if (!tg?.token) return null;

    return new TelegramChannel({
      token: tg.token,
      chatId: tg.chatId,
      allowedChatIds: tg.chatId ? [String(tg.chatId)] : undefined,
      voiceEnabled: tg.voiceEnabled !== false,
      openaiApiKey: config.ai?.providers?.openai?.apiKey || process.env.OPENAI_API_KEY,
    });
  } catch {
    return null;
  }
}

/**
 * Start with chat handler
 */
export async function startTelegramWithChat(
  chatHandler: (message: string, context: { chatId: number; userId: number; username?: string }) => Promise<string>
): Promise<TelegramChannel | null> {
  const channel = createTelegramChannel();
  if (!channel) return null;

  await channel.start(async (msg) => {
    return await chatHandler(msg.text, {
      chatId: msg.chatId,
      userId: msg.userId,
      username: msg.username,
    });
  });

  return channel;
}
