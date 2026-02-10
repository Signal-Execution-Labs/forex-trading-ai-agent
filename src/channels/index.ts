/**
 * K.I.T. Channels
 * Communication channels for the agent
 */

export { TelegramChannel, createTelegramChannel, startTelegramWithChat, TelegramMessage, TelegramChannelConfig } from './telegram-channel';
export { WhatsAppChannel, createWhatsAppChannel, hasWhatsAppCredentials, WhatsAppMessage, WhatsAppChannelConfig } from './whatsapp-channel';
