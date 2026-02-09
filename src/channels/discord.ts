/**
 * K.I.T. Discord Channel
 * Discord bot integration for trading commands
 */

import { EventEmitter } from 'events';
import { Logger } from '../core/logger';

export interface DiscordConfig {
  token: string;
  allowedGuilds?: string[];
  allowedRoles?: string[];
}

export interface DiscordMessage {
  guildId: string;
  channelId: string;
  userId: string;
  username: string;
  text: string;
  messageId: string;
  timestamp: Date;
}

export class DiscordChannel extends EventEmitter {
  private logger: Logger;
  private config: DiscordConfig;
  private client: any; // Discord.js Client

  constructor(config: DiscordConfig) {
    super();
    this.logger = new Logger('Discord');
    this.config = config;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Discord channel...');
    
    try {
      const { Client, GatewayIntentBits, Events } = await import('discord.js');
      
      this.client = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.MessageContent,
          GatewayIntentBits.DirectMessages
        ]
      });

      this.setupHandlers();
      
      await this.client.login(this.config.token);
      
      this.logger.info('✅ Discord channel ready');
    } catch (error) {
      this.logger.error('Failed to initialize Discord:', error);
      throw error;
    }
  }

  private setupHandlers(): void {
    const { Events } = require('discord.js');

    this.client.once(Events.ClientReady, (c: any) => {
      this.logger.info(`Logged in as ${c.user.tag}`);
      
      // Set activity
      c.user.setActivity('the markets 📈', { type: 3 }); // Watching
    });

    this.client.on(Events.MessageCreate, async (message: any) => {
      // Ignore bot messages
      if (message.author.bot) return;
      
      // Check if mentioned or DM
      const isMentioned = message.mentions.has(this.client.user);
      const isDM = !message.guild;
      
      if (!isMentioned && !isDM) return;

      const discordMessage: DiscordMessage = {
        guildId: message.guild?.id || 'DM',
        channelId: message.channel.id,
        userId: message.author.id,
        username: message.author.username,
        text: message.content.replace(/<@!?\d+>/g, '').trim(),
        messageId: message.id,
        timestamp: message.createdAt
      };

      this.emit('message', discordMessage, message);
    });

    // Slash commands
    this.client.on(Events.InteractionCreate, async (interaction: any) => {
      if (!interaction.isChatInputCommand()) return;

      const { commandName, options } = interaction;
      
      this.emit('command', {
        command: commandName,
        options: options,
        interaction
      });
    });
  }

  async send(channelId: string, text: string): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      await channel.send(text);
    } catch (error) {
      this.logger.error('Failed to send message:', error);
    }
  }

  async sendEmbed(channelId: string, embed: any): Promise<void> {
    try {
      const channel = await this.client.channels.fetch(channelId);
      await channel.send({ embeds: [embed] });
    } catch (error) {
      this.logger.error('Failed to send embed:', error);
    }
  }

  async sendWithButtons(channelId: string, text: string, buttons: any[]): Promise<void> {
    try {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
      
      const row = new ActionRowBuilder().addComponents(
        ...buttons.map((btn: any) => 
          new ButtonBuilder()
            .setCustomId(btn.id)
            .setLabel(btn.label)
            .setStyle(ButtonStyle[btn.style || 'Primary'])
        )
      );

      const channel = await this.client.channels.fetch(channelId);
      await channel.send({ content: text, components: [row] });
    } catch (error) {
      this.logger.error('Failed to send message with buttons:', error);
    }
  }

  async registerSlashCommands(guildId?: string): Promise<void> {
    const { SlashCommandBuilder, REST, Routes } = await import('discord.js');
    
    const commands = [
      new SlashCommandBuilder()
        .setName('status')
        .setDescription('Get portfolio status'),
      new SlashCommandBuilder()
        .setName('price')
        .setDescription('Get asset price')
        .addStringOption((option: any) =>
          option.setName('symbol')
            .setDescription('Asset symbol (e.g., BTC, ETH)')
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an asset')
        .addNumberOption((option: any) =>
          option.setName('amount')
            .setDescription('Amount in USD')
            .setRequired(true)
        )
        .addStringOption((option: any) =>
          option.setName('symbol')
            .setDescription('Asset symbol')
            .setRequired(true)
        ),
      new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell an asset')
        .addNumberOption((option: any) =>
          option.setName('amount')
            .setDescription('Amount to sell')
            .setRequired(true)
        )
        .addStringOption((option: any) =>
          option.setName('symbol')
            .setDescription('Asset symbol')
            .setRequired(true)
        ),
    ].map(command => command.toJSON());

    const rest = new REST().setToken(this.config.token);
    
    try {
      this.logger.info('Registering slash commands...');
      
      if (guildId) {
        await rest.put(
          Routes.applicationGuildCommands(this.client.user.id, guildId),
          { body: commands }
        );
      } else {
        await rest.put(
          Routes.applicationCommands(this.client.user.id),
          { body: commands }
        );
      }
      
      this.logger.info('✅ Slash commands registered');
    } catch (error) {
      this.logger.error('Failed to register commands:', error);
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Discord channel...');
    await this.client.destroy();
  }
}
