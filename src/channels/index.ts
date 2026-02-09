/**
 * K.I.T. Channel Manager
 * Manages all communication channels
 */

import { EventEmitter } from 'events';
import { Logger } from '../core/logger';
import { TelegramChannel, TelegramConfig } from './telegram';
import { DiscordChannel, DiscordConfig } from './discord';

export interface ChannelConfig {
  telegram?: TelegramConfig & { enabled: boolean };
  discord?: DiscordConfig & { enabled: boolean };
  signal?: { enabled: boolean };
  whatsapp?: { enabled: boolean };
}

export class ChannelManager extends EventEmitter {
  private logger: Logger;
  private telegram?: TelegramChannel;
  private discord?: DiscordChannel;
  private activeChannels: string[] = [];

  constructor() {
    super();
    this.logger = new Logger('Channels');
  }

  async initialize(config: ChannelConfig): Promise<void> {
    this.logger.info('Initializing communication channels...');

    // Telegram
    if (config.telegram?.enabled && config.telegram.token) {
      this.telegram = new TelegramChannel(config.telegram);
      await this.telegram.initialize();
      this.setupTelegramHandlers();
      this.activeChannels.push('telegram');
    }

    // Discord
    if (config.discord?.enabled && config.discord.token) {
      this.discord = new DiscordChannel(config.discord);
      await this.discord.initialize();
      this.setupDiscordHandlers();
      this.activeChannels.push('discord');
    }

    // Signal (TODO)
    if (config.signal?.enabled) {
      this.logger.info('Signal channel: Coming soon');
    }

    // WhatsApp (TODO)
    if (config.whatsapp?.enabled) {
      this.logger.info('WhatsApp channel: Coming soon');
    }

    this.logger.info(`Active channels: ${this.activeChannels.join(', ') || 'none'}`);
  }

  private setupTelegramHandlers(): void {
    if (!this.telegram) return;

    this.telegram.on('message', (msg, ctx) => {
      this.emit('message', {
        channel: 'telegram',
        ...msg,
        reply: (text: string) => ctx.reply(text, { parse_mode: 'Markdown' })
      });
    });

    this.telegram.on('command', (cmd) => {
      this.emit('command', {
        channel: 'telegram',
        ...cmd
      });
    });
  }

  private setupDiscordHandlers(): void {
    if (!this.discord) return;

    this.discord.on('message', (msg, message) => {
      this.emit('message', {
        channel: 'discord',
        ...msg,
        reply: (text: string) => message.reply(text)
      });
    });

    this.discord.on('command', (cmd) => {
      this.emit('command', {
        channel: 'discord',
        ...cmd
      });
    });
  }

  async broadcast(text: string, options?: { channels?: string[] }): Promise<void> {
    const channels = options?.channels || this.activeChannels;
    
    // This would require knowing active chat IDs - typically stored in DB
    this.logger.info(`Broadcasting to: ${channels.join(', ')}`);
  }

  async sendToTelegram(chatId: number, text: string, options?: any): Promise<void> {
    if (this.telegram) {
      await this.telegram.send(chatId, text, options);
    }
  }

  async sendToDiscord(channelId: string, text: string): Promise<void> {
    if (this.discord) {
      await this.discord.send(channelId, text);
    }
  }

  getActiveChannels(): string[] {
    return this.activeChannels;
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping all channels...');
    
    if (this.telegram) await this.telegram.stop();
    if (this.discord) await this.discord.stop();
  }
}

export { TelegramChannel, DiscordChannel };
