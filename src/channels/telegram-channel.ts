/**
 * K.I.T. Telegram Channel - REBUILT
 * Clean, simple implementation with proper response handling
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
  private pollTimer: NodeJS.Timeout | null = null;
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
   * Download file from Telegram servers
   */
  private async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/getFile?file_id=${fileId}`);
      const data = await response.json() as any;
      
      if (!data.ok || !data.result?.file_path) {
        console.error('[TG] Failed to get file path:', data.description);
        return null;
      }
      
      const fileUrl = `https://api.telegram.org/file/bot${this.config.token}/${data.result.file_path}`;
      const fileResponse = await fetch(fileUrl);
      
      if (!fileResponse.ok) return null;
      return Buffer.from(await fileResponse.arrayBuffer());
    } catch (error) {
      console.error('[TG] Download file error:', error);
      return null;
    }
  }

  /**
   * Transcribe voice message using OpenAI Whisper
   */
  private async transcribeVoice(fileBuffer: Buffer): Promise<string | null> {
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('[TG] No OpenAI API key for voice transcription');
      return null;
    }
    
    try {
      const boundary = '----KITVoiceBoundary' + Date.now();
      const formParts: Buffer[] = [];
      
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="voice.ogg"\r\n` +
        `Content-Type: audio/ogg\r\n\r\n`
      ));
      formParts.push(fileBuffer);
      formParts.push(Buffer.from('\r\n'));
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `whisper-1\r\n`
      ));
      formParts.push(Buffer.from(`--${boundary}--\r\n`));
      
      const formBody = Buffer.concat(formParts);
      
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formBody,
      });
      
      if (!response.ok) {
        console.error('[TG] Whisper API error:', await response.text());
        return null;
      }
      
      const result = await response.json() as any;
      return result.text || null;
    } catch (error) {
      console.error('[TG] Transcription error:', error);
      return null;
    }
  }

  /**
   * Start polling for messages
   */
  async start(handler: MessageHandler): Promise<void> {
    if (this.polling) {
      console.log('[TG] Already polling');
      return;
    }

    this.messageHandler = handler;
    this.polling = true;
    console.log('[TG] Starting Telegram polling...');

    // Clear any existing webhook
    try {
      await fetch(`https://api.telegram.org/bot${this.config.token}/deleteWebhook?drop_pending_updates=false`);
      await new Promise(r => setTimeout(r, 500));
    } catch (e) {
      // Ignore
    }

    // Get initial offset
    await this.getUpdates(true);
    
    // Start poll loop
    this.pollLoop();
  }

  /**
   * Stop polling
   */
  stop(): void {
    this.polling = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[TG] Stopped polling');
  }

  /**
   * Main polling loop - SIMPLE AND RELIABLE
   */
  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const messages = await this.getUpdates(false);
        
        for (const msg of messages) {
          // Check if chat is allowed
          if (this.config.allowedChatIds?.length) {
            if (!this.config.allowedChatIds.includes(String(msg.chatId))) {
              console.log(`[TG] Ignoring unauthorized chat: ${msg.chatId}`);
              continue;
            }
          }

          // Emit event
          this.emit('message', msg);

          // Process with handler
          if (this.messageHandler) {
            await this.processMessage(msg);
          }
        }
      } catch (error) {
        console.error('[TG] Poll loop error:', error);
      }

      // Wait before next poll
      await new Promise(r => setTimeout(r, this.config.pollingInterval));
    }
  }

  /**
   * Process a single message - with EXPLICIT logging at each step
   */
  private async processMessage(msg: TelegramMessage): Promise<void> {
    const logPrefix = `[TG ${msg.chatId}]`;
    
    try {
      console.log(`${logPrefix} ▶ Received: "${msg.text?.slice(0, 50)}..." from ${msg.username || msg.firstName || 'unknown'}`);
      
      // Send typing indicator
      await this.sendTyping(msg.chatId);
      
      // Call handler and wait for response
      console.log(`${logPrefix} ⏳ Calling handler...`);
      const startTime = Date.now();
      
      let response: string;
      try {
        response = await this.messageHandler!(msg);
      } catch (handlerError: any) {
        console.error(`${logPrefix} ❌ Handler threw error:`, handlerError?.message || handlerError);
        response = `❌ Error: ${handlerError?.message || 'Unknown error'}`;
      }
      
      const elapsed = Date.now() - startTime;
      console.log(`${logPrefix} ✓ Handler returned after ${elapsed}ms, response length: ${response?.length || 0}`);
      
      // Check if we have a response to send
      if (!response) {
        console.log(`${logPrefix} ⚠ No response (null/undefined)`);
        return;
      }
      
      const trimmed = response.trim();
      if (!trimmed) {
        console.log(`${logPrefix} ⚠ Empty response after trim`);
        return;
      }
      
      // Send the response
      console.log(`${logPrefix} 📤 Sending response (${trimmed.length} chars)...`);
      const sendResult = await this.sendMessage(msg.chatId, trimmed, { threadId: msg.threadId });
      console.log(`${logPrefix} ${sendResult ? '✅' : '❌'} Send result: ${sendResult}`);
      
    } catch (error: any) {
      console.error(`${logPrefix} ❌ processMessage error:`, error?.message || error);
      
      // Try to send error message
      try {
        await this.sendMessage(msg.chatId, `❌ Sorry, an error occurred: ${error?.message || 'Unknown'}`, { threadId: msg.threadId });
      } catch (sendError) {
        console.error(`${logPrefix} ❌ Failed to send error message:`, sendError);
      }
    }
  }

  /**
   * Get updates from Telegram
   */
  private async getUpdates(skipProcess: boolean = false): Promise<TelegramMessage[]> {
    const url = `https://api.telegram.org/bot${this.config.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`;
    
    try {
      const response = await fetch(url);
      const data = await response.json() as any;

      if (!data.ok) {
        // Handle conflict
        if (data.description?.includes('Conflict') || data.description?.includes('terminated')) {
          console.log('[TG] Conflict detected, waiting 5s...');
          await new Promise(r => setTimeout(r, 5000));
          return [];
        }
        throw new Error(`Telegram API: ${data.description}`);
      }

      const messages: TelegramMessage[] = [];

      for (const update of data.result || []) {
        if (update.update_id > this.lastUpdateId) {
          this.lastUpdateId = update.update_id;
        }

        if (skipProcess) continue;

        const msg = update.message;
        if (msg) {
          // Text messages
          if (msg.text) {
            messages.push({
              messageId: msg.message_id,
              chatId: msg.chat.id,
              userId: msg.from.id,
              username: msg.from.username,
              firstName: msg.from.first_name,
              text: msg.text,
              date: new Date(msg.date * 1000),
              threadId: msg.message_thread_id,
              isTopicMessage: msg.is_topic_message,
            });
          }
          
          // Voice messages
          const voice = msg.voice || msg.audio;
          if (voice && this.config.voiceEnabled) {
            console.log(`[TG] 🎤 Voice message (${voice.duration}s) - transcribing...`);
            const fileBuffer = await this.downloadFile(voice.file_id);
            if (fileBuffer) {
              const transcription = await this.transcribeVoice(fileBuffer);
              if (transcription) {
                console.log(`[TG] 📝 Transcribed: "${transcription}"`);
                messages.push({
                  messageId: msg.message_id,
                  chatId: msg.chat.id,
                  userId: msg.from.id,
                  username: msg.from.username,
                  firstName: msg.from.first_name,
                  text: transcription,
                  date: new Date(msg.date * 1000),
                  threadId: msg.message_thread_id,
                  isTopicMessage: msg.is_topic_message,
                  isVoiceMessage: true,
                  voiceDuration: voice.duration,
                });
              }
            }
          }
        }

        // Callback queries (button presses)
        const callback = update.callback_query;
        if (callback) {
          messages.push({
            messageId: callback.message?.message_id || 0,
            chatId: callback.message?.chat?.id || callback.from.id,
            userId: callback.from.id,
            username: callback.from.username,
            firstName: callback.from.first_name,
            text: `callback_data: ${callback.data}`,
            date: new Date(),
            callbackQueryId: callback.id,
            callbackData: callback.data,
          });
        }
      }

      return messages;
    } catch (error) {
      console.error('[TG] getUpdates error:', error);
      return [];
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
      
      // Try paragraph break
      const paraBreak = remaining.lastIndexOf('\n\n', maxLength);
      if (paraBreak > maxLength * 0.5) {
        breakAt = paraBreak + 2;
      } else {
        // Try sentence break
        const sentenceBreaks = ['. ', '! ', '? '];
        let best = -1;
        for (const br of sentenceBreaks) {
          const idx = remaining.lastIndexOf(br, maxLength);
          if (idx > best) best = idx;
        }
        if (best > maxLength * 0.5) {
          breakAt = best + 2;
        } else {
          // Try word break
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
   * Send a message - SIMPLE AND RELIABLE
   */
  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyToMessageId?: number;
    threadId?: number;
  }): Promise<boolean> {
    const chunks = this.chunkText(text);
    let allSuccess = true;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      const params: any = {
        chat_id: chatId,
        text: chunk,
      };

      if (options?.parseMode) params.parse_mode = options.parseMode;
      if (i === 0 && options?.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;
      if (options?.threadId) params.message_thread_id = options.threadId;

      try {
        const response = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        const data = await response.json() as any;
        
        if (!data.ok) {
          console.error('[TG] sendMessage failed:', data.description);
          allSuccess = false;
          
          // Retry without parse mode if that was the issue
          if (options?.parseMode && data.description?.includes('parse')) {
            delete params.parse_mode;
            const retry = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(params),
            });
            const retryData = await retry.json() as any;
            if (retryData.ok) allSuccess = true;
          }
        }
        
        // Delay between chunks
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (error) {
        console.error('[TG] sendMessage error:', error);
        allSuccess = false;
      }
    }
    
    return allSuccess;
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
    } catch {
      // Ignore
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
    const inlineKeyboard = buttons.map(row =>
      row.map(btn => btn.url 
        ? { text: btn.text, url: btn.url }
        : { text: btn.text, callback_data: btn.callbackData || btn.text }
      )
    );

    const params: any = {
      chat_id: chatId,
      text: text,
      reply_markup: { inline_keyboard: inlineKeyboard },
    };

    if (options?.parseMode) params.parse_mode = options.parseMode;
    if (options?.threadId) params.message_thread_id = options.threadId;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      const data = await response.json() as any;
      return data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Set reaction on message
   */
  async setReaction(chatId: number | string, messageId: number, emoji: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/setMessageReaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
          reaction: [{ type: 'emoji', emoji }],
        }),
      });
      const data = await response.json() as any;
      return data.ok;
    } catch {
      return false;
    }
  }

  /**
   * Answer callback query
   */
  async answerCallbackQuery(callbackQueryId: string, options?: { text?: string; showAlert?: boolean }): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: options?.text,
          show_alert: options?.showAlert,
        }),
      });
      const data = await response.json() as any;
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
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/getMe`);
      const data = await response.json() as any;
      if (data.ok && data.result) {
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

  console.log('[TG] ✅ Telegram channel active');
  return channel;
}
