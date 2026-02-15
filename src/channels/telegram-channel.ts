/**
 * K.I.T. Telegram Channel
 * Bidirectional Telegram bot - listens AND responds to messages
 * 
 * Features:
 * - Long-polling for updates
 * - Retry with exponential backoff (OpenClaw pattern)
 * - Thread/topic support
 * - Inline keyboards with callback queries
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { retry, TELEGRAM_RETRY_POLICY, RetryPolicy } from '../core/retry';

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
  threadId?: number;  // For topic/thread support
  isTopicMessage?: boolean;
  // Callback query fields (for button presses)
  callbackQueryId?: string;
  callbackData?: string;
  // Voice message fields
  isVoiceMessage?: boolean;
  voiceDuration?: number;
}

export interface TelegramChannelConfig {
  token: string;
  chatId?: string;
  pollingInterval?: number; // ms, default 2000
  allowedChatIds?: string[]; // If set, only respond to these chats
  // Voice message support
  voiceEnabled?: boolean; // Default: true
  openaiApiKey?: string; // For Whisper transcription
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
      voiceEnabled: true, // Voice messages enabled by default!
      ...config,
    };
  }

  /**
   * Download a file from Telegram servers
   */
  private async downloadFile(fileId: string): Promise<Buffer | null> {
    try {
      // Get file path
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/getFile?file_id=${fileId}`);
      const data = await response.json() as any;
      
      if (!data.ok || !data.result?.file_path) {
        console.error('[Telegram] Failed to get file path:', data.description);
        return null;
      }
      
      // Download file
      const fileUrl = `https://api.telegram.org/file/bot${this.config.token}/${data.result.file_path}`;
      const fileResponse = await fetch(fileUrl);
      
      if (!fileResponse.ok) {
        console.error('[Telegram] Failed to download file');
        return null;
      }
      
      return Buffer.from(await fileResponse.arrayBuffer());
    } catch (error) {
      console.error('[Telegram] Download file error:', error);
      return null;
    }
  }

  /**
   * Transcribe voice message using OpenAI Whisper
   */
  private async transcribeVoice(fileBuffer: Buffer): Promise<string | null> {
    // Get OpenAI API key from config or environment
    const apiKey = this.config.openaiApiKey || process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('[Telegram] OpenAI API key not configured for voice transcription');
      return null;
    }
    
    try {
      // Create multipart form data manually for Whisper API
      const boundary = '----KITVoiceBoundary' + Date.now();
      
      const formParts: Buffer[] = [];
      
      // Add file field
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="voice.ogg"\r\n` +
        `Content-Type: audio/ogg\r\n\r\n`
      ));
      formParts.push(fileBuffer);
      formParts.push(Buffer.from('\r\n'));
      
      // Add model field
      formParts.push(Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="model"\r\n\r\n` +
        `whisper-1\r\n`
      ));
      
      // End boundary
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
        const error = await response.text();
        console.error('[Telegram] Whisper API error:', error);
        return null;
      }
      
      const result = await response.json() as any;
      return result.text || null;
    } catch (error) {
      console.error('[Telegram] Transcription error:', error);
      return null;
    }
  }

  /**
   * Make a Telegram API call with retry
   */
  private async apiCall<T>(
    method: string,
    body?: Record<string, any>,
    options?: { retryPolicy?: RetryPolicy; label?: string }
  ): Promise<{ ok: boolean; result?: T; error?: string }> {
    const url = `https://api.telegram.org/bot${this.config.token}/${method}`;
    const policy = options?.retryPolicy || TELEGRAM_RETRY_POLICY;
    const label = options?.label || `Telegram ${method}`;

    try {
      const response = await retry(
        async () => {
          const res = await fetch(url, body ? {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          } : undefined);

          // Handle rate limiting
          if (res.status === 429) {
            const retryAfter = res.headers.get('retry-after');
            const error = new Error(`Rate limited`) as any;
            error.status = 429;
            error.retryAfter = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
            throw error;
          }

          return res;
        },
        policy,
        label
      );

      const data = await response.json() as any;

      if (!data.ok) {
        return { ok: false, error: data.description || 'Unknown error' };
      }

      return { ok: true, result: data.result };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'API call failed';
      console.error(`[Telegram] ${label} failed:`, message);
      return { ok: false, error: message };
    }
  }

  /**
   * Clear any existing polling connections
   * This helps resolve conflicts when switching between instances
   */
  private async clearPollingConnection(): Promise<void> {
    try {
      // First, delete any webhook (just in case)
      await fetch(`https://api.telegram.org/bot${this.config.token}/deleteWebhook?drop_pending_updates=false`);
      
      // Then make a quick getUpdates call to "steal" the connection
      // Using timeout=1 to make it quick
      const url = `https://api.telegram.org/bot${this.config.token}/getUpdates?timeout=1&offset=-1`;
      await fetch(url);
      
      // Wait a moment for the connection to be fully released
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (e) {
      // Ignore errors during cleanup
    }
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

    // Clear any existing connections first
    console.log('[Telegram] Clearing existing connections...');
    await this.clearPollingConnection();

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
            console.log(`[Telegram] Processing message from ${msg.username || msg.firstName}: ${msg.text}${msg.threadId ? ` (thread: ${msg.threadId})` : ''}`);
            const response = await this.messageHandler(msg);
            
            if (response && response.trim()) {
              // Reply in the same thread if message was in a thread
              await this.sendMessage(msg.chatId, response, { threadId: msg.threadId });
            }
          } catch (error) {
            console.error('[Telegram] Handler error:', error);
            await this.sendMessage(msg.chatId, '❌ Sorry, I encountered an error processing your message.', { threadId: msg.threadId });
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
   * Get updates from Telegram with conflict retry
   */
  private async getUpdates(skipProcess = false, retryCount = 0): Promise<TelegramMessage[]> {
    const MAX_RETRIES = 5;
    const BASE_DELAY = 5000; // 5 seconds base delay for conflict
    
    const url = `https://api.telegram.org/bot${this.config.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=10`;
    
    const response = await fetch(url);
    const data = await response.json() as any;

    if (!data.ok) {
      // Handle conflict error (another instance is polling)
      if (data.description?.includes('Conflict') || data.description?.includes('terminated by other')) {
        if (retryCount < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, retryCount); // Exponential backoff: 5s, 10s, 20s, 40s, 80s
          console.log(`[Telegram] Conflict detected, waiting ${delay/1000}s before retry ${retryCount + 1}/${MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.getUpdates(skipProcess, retryCount + 1);
        }
        console.error('[Telegram] Max retries reached for conflict resolution. Another instance may be running.');
      }
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
      if (msg) {
        // Handle text messages
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
        
        // Handle voice messages (including voice notes and audio)
        const voice = msg.voice || msg.audio;
        if (voice && this.config.voiceEnabled) {
          console.log(`[Telegram] 🎤 Voice message received (${voice.duration}s) - transcribing...`);
          
          // Download and transcribe
          const fileBuffer = await this.downloadFile(voice.file_id);
          if (fileBuffer) {
            const transcription = await this.transcribeVoice(fileBuffer);
            if (transcription) {
              console.log(`[Telegram] 📝 Transcribed: "${transcription}"`);
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
            } else {
              // Notify user that transcription failed
              console.error('[Telegram] Voice transcription failed');
            }
          }
        }
      }

      // Handle callback queries (button presses)
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
  }

  /**
   * Chunk text for Telegram (max 4096 chars per message)
   * Prefers breaking at paragraph boundaries, then sentences, then words
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
      
      // Find best break point
      let breakAt = maxLength;
      
      // Try paragraph break (double newline)
      const paragraphBreak = remaining.lastIndexOf('\n\n', maxLength);
      if (paragraphBreak > maxLength * 0.5) {
        breakAt = paragraphBreak + 2;
      } else {
        // Try sentence break
        const sentenceBreaks = ['. ', '! ', '? ', '.\n', '!\n', '?\n'];
        let bestSentenceBreak = -1;
        for (const br of sentenceBreaks) {
          const idx = remaining.lastIndexOf(br, maxLength);
          if (idx > bestSentenceBreak) bestSentenceBreak = idx;
        }
        if (bestSentenceBreak > maxLength * 0.5) {
          breakAt = bestSentenceBreak + 2;
        } else {
          // Try word break
          const spaceBreak = remaining.lastIndexOf(' ', maxLength);
          if (spaceBreak > maxLength * 0.5) {
            breakAt = spaceBreak + 1;
          }
          // Otherwise force break at maxLength
        }
      }
      
      chunks.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }
    
    return chunks;
  }

  /**
   * Send a message (auto-chunks long messages)
   */
  async sendMessage(chatId: number | string, text: string, options?: {
    parseMode?: 'HTML' | 'Markdown';
    replyToMessageId?: number;
    threadId?: number;
  }): Promise<boolean> {
    // Chunk long messages
    const chunks = this.chunkText(text);
    let allSuccess = true;
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirst = i === 0;
      
      const params: any = {
        chat_id: chatId,
        text: chunk,
      };

      if (options?.parseMode) params.parse_mode = options.parseMode;
      // Only reply to original message for first chunk
      if (isFirst && options?.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;
      if (options?.threadId) params.message_thread_id = options.threadId;

      try {
        const response = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });

        const data = await response.json() as any;
        
        if (!data.ok) {
          console.error('[Telegram] Send failed:', data.description);
          allSuccess = false;
          // If HTML parsing failed, retry as plain text
          if (options?.parseMode && data.description?.includes('parse')) {
            console.log('[Telegram] Retrying without parse_mode...');
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
        
        // Small delay between chunks to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      } catch (error) {
        console.error('[Telegram] Send error:', error);
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
        body: JSON.stringify({
          chat_id: chatId,
          action: 'typing',
        }),
      });
    } catch (error) {
      // Ignore typing indicator errors
    }
  }

  /**
   * Send a message with inline keyboard buttons
   */
  async sendMessageWithButtons(
    chatId: number | string,
    text: string,
    buttons: Array<Array<{ text: string; callbackData?: string; url?: string }>>,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      replyToMessageId?: number;
      threadId?: number;
    }
  ): Promise<boolean> {
    const inlineKeyboard = buttons.map(row =>
      row.map(btn => {
        if (btn.url) {
          return { text: btn.text, url: btn.url };
        }
        return { text: btn.text, callback_data: btn.callbackData || btn.text };
      })
    );

    const params: any = {
      chat_id: chatId,
      text: text,
      reply_markup: { inline_keyboard: inlineKeyboard },
    };

    if (options?.parseMode) params.parse_mode = options.parseMode;
    if (options?.replyToMessageId) params.reply_to_message_id = options.replyToMessageId;
    if (options?.threadId) params.message_thread_id = options.threadId;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json() as any;
      if (!data.ok) {
        console.error('[Telegram] Send with buttons failed:', data.description);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Telegram] Send with buttons error:', error);
      return false;
    }
  }

  /**
   * Set reaction on a message
   */
  async setReaction(
    chatId: number | string,
    messageId: number,
    emoji: string
  ): Promise<boolean> {
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
      if (!data.ok) {
        // Reactions may not be supported in all chats
        console.log('[Telegram] Reaction not set:', data.description);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Telegram] Reaction error:', error);
      return false;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(
    chatId: number | string,
    messageId: number,
    text: string,
    options?: { parseMode?: 'HTML' | 'Markdown' }
  ): Promise<boolean> {
    const params: any = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
    };
    if (options?.parseMode) params.parse_mode = options.parseMode;

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });

      const data = await response.json() as any;
      if (!data.ok) {
        console.error('[Telegram] Edit failed:', data.description);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Telegram] Edit error:', error);
      return false;
    }
  }

  /**
   * Delete a message
   */
  async deleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: messageId,
        }),
      });

      const data = await response.json() as any;
      if (!data.ok) {
        console.error('[Telegram] Delete failed:', data.description);
        return false;
      }
      return true;
    } catch (error) {
      console.error('[Telegram] Delete error:', error);
      return false;
    }
  }

  /**
   * Answer callback query (for inline button presses)
   */
  async answerCallbackQuery(
    callbackQueryId: string,
    options?: { text?: string; showAlert?: boolean }
  ): Promise<boolean> {
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
    } catch (error) {
      console.error('[Telegram] Answer callback error:', error);
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
    } catch (error) {
      console.error('[Telegram] getMe error:', error);
      return null;
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

  // Get OpenAI API key for voice transcription
  const openaiKey = config.ai?.providers?.openai?.apiKey || process.env.OPENAI_API_KEY;

  return new TelegramChannel({
    token: telegram.token,
    chatId: telegram.chatId,
    allowedChatIds: telegram.chatId ? [String(telegram.chatId)] : undefined,
    // Voice enabled by default if OpenAI key is available
    voiceEnabled: telegram.voiceEnabled !== false,
    openaiApiKey: openaiKey,
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
