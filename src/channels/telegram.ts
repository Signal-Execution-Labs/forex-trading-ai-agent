/**
 * K.I.T. Telegram Channel
 * Telegram bot integration for trading commands
 */

import { EventEmitter } from 'events';
import { Logger } from '../core/logger';

export interface TelegramConfig {
  token: string;
  allowedUsers?: number[];
  webhookUrl?: string;
}

export interface TelegramMessage {
  chatId: number;
  userId: number;
  username?: string;
  text: string;
  messageId: number;
  timestamp: Date;
}

export class TelegramChannel extends EventEmitter {
  private logger: Logger;
  private config: TelegramConfig;
  private bot: any; // Telegraf or node-telegram-bot-api

  constructor(config: TelegramConfig) {
    super();
    this.logger = new Logger('Telegram');
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Telegram channel...');
    
    try {
      // Dynamic import for Telegraf
      const { Telegraf } = await import('telegraf');
      this.bot = new Telegraf(this.config.token);
      
      // Setup message handlers
      this.setupHandlers();
      
      // Start polling
      await this.bot.launch();
      
      this.logger.info('✅ Telegram channel ready');
    } catch (error) {
      this.logger.error('Failed to initialize Telegram:', error);
      throw error;
    }
  }

  private setupHandlers(): void {
    // Handle text messages
    this.bot.on('text', async (ctx: any) => {
      const message: TelegramMessage = {
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        username: ctx.from.username,
        text: ctx.message.text,
        messageId: ctx.message.message_id,
        timestamp: new Date(ctx.message.date * 1000)
      };

      // Check authorization
      if (!this.isAuthorized(message.userId)) {
        await ctx.reply('⛔ Unauthorized. Contact admin.');
        return;
      }

      this.emit('message', message, ctx);
    });

    // Handle commands
    this.bot.command('start', async (ctx: any) => {
      await ctx.reply(
        '🤖 *K.I.T. - AI Trading Agent*\n\n' +
        'I\'m your personal trading assistant.\n\n' +
        '*Commands:*\n' +
        '/status - Portfolio status\n' +
        '/price <symbol> - Get price\n' +
        '/buy <amount> <symbol> - Buy asset\n' +
        '/sell <amount> <symbol> - Sell asset\n' +
        '/alerts - Manage alerts\n' +
        '/strategies - View strategies\n' +
        '/help - Full command list\n\n' +
        'Or just chat with me naturally!',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('status', async (ctx: any) => {
      this.emit('command', { command: 'status', ctx });
    });

    this.bot.command('price', async (ctx: any) => {
      const symbol = ctx.message.text.split(' ')[1];
      this.emit('command', { command: 'price', symbol, ctx });
    });

    this.bot.command('buy', async (ctx: any) => {
      const parts = ctx.message.text.split(' ');
      this.emit('command', { 
        command: 'buy', 
        amount: parts[1], 
        symbol: parts[2], 
        ctx 
      });
    });

    this.bot.command('sell', async (ctx: any) => {
      const parts = ctx.message.text.split(' ');
      this.emit('command', { 
        command: 'sell', 
        amount: parts[1], 
        symbol: parts[2], 
        ctx 
      });
    });

    // Callback queries (inline buttons)
    this.bot.on('callback_query', async (ctx: any) => {
      this.emit('callback', ctx.callbackQuery.data, ctx);
    });
  }

  private isAuthorized(userId: number): boolean {
    if (!this.config.allowedUsers || this.config.allowedUsers.length === 0) {
      return true; // No restrictions
    }
    return this.config.allowedUsers.includes(userId);
  }

  async send(chatId: number, text: string, options?: any): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        ...options
      });
    } catch (error) {
      this.logger.error('Failed to send message:', error);
    }
  }

  async sendWithButtons(chatId: number, text: string, buttons: any[][]): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(chatId, text, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: buttons
        }
      });
    } catch (error) {
      this.logger.error('Failed to send message with buttons:', error);
    }
  }

  async sendChart(chatId: number, imageBuffer: Buffer, caption?: string): Promise<void> {
    try {
      await this.bot.telegram.sendPhoto(chatId, { source: imageBuffer }, {
        caption,
        parse_mode: 'Markdown'
      });
    } catch (error) {
      this.logger.error('Failed to send chart:', error);
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Telegram channel...');
    this.bot.stop('SIGINT');
  }
}
