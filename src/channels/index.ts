/**
 * K.I.T. Channels
 * Communication channels for the agent
 */

export { TelegramChannel, createTelegramChannel, startTelegramWithChat, TelegramMessage, TelegramChannelConfig } from './telegram-channel';
export { WhatsAppChannel, createWhatsAppChannel, hasWhatsAppCredentials, WhatsAppMessage, WhatsAppChannelConfig } from './whatsapp-channel';
export { DiscordChannel, createDiscordChannel, startDiscordWithChat, hasDiscordCredentials, DiscordMessage, DiscordChannelConfig } from './discord-channel';
export { SlackChannel, createSlackChannel, startSlackWithChat, hasSlackCredentials, SlackMessage, SlackChannelConfig } from './slack-channel';
