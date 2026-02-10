/**
 * K.I.T. Telegram Tools
 * Connect and manage Telegram bot
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

// ============================================================================
// Telegram Setup Tool
// ============================================================================

export const telegramSetupToolDefinition: ToolDefinition = {
  name: 'telegram_setup',
  description: 'Configure and test Telegram bot connection. Provide the bot token from BotFather.',
  parameters: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Telegram Bot API token from @BotFather',
      },
    },
    required: ['token'],
  },
};

export const telegramSetupToolHandler: ToolHandler = async (args) => {
  const { token } = args as { token: string };

  if (!token || !token.includes(':')) {
    return {
      success: false,
      error: 'Invalid token format. Token should look like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz',
    };
  }

  // Test the token by calling getMe
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: `Telegram API error: ${data.description || 'Invalid token'}`,
      };
    }

    const botInfo = data.result;

    // Ensure config directory exists
    if (!fs.existsSync(KIT_HOME)) {
      fs.mkdirSync(KIT_HOME, { recursive: true });
    }

    // Load existing config or create new
    let config: any = {};
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }

    // Save Telegram config
    if (!config.channels) config.channels = {};
    config.channels.telegram = {
      enabled: true,
      token: token,
      botId: botInfo.id,
      botUsername: botInfo.username,
      botName: botInfo.first_name,
      connectedAt: new Date().toISOString(),
    };

    // Save config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    return {
      success: true,
      message: `✅ Telegram bot connected successfully!`,
      bot: {
        id: botInfo.id,
        username: `@${botInfo.username}`,
        name: botInfo.first_name,
      },
      nextSteps: [
        `1. Open Telegram and search for @${botInfo.username}`,
        `2. Start a chat with the bot`,
        `3. Send /start to begin`,
        `K.I.T. will now listen for your messages!`,
      ],
    };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
    };
  }
};

// ============================================================================
// Telegram Status Tool
// ============================================================================

export const telegramStatusToolDefinition: ToolDefinition = {
  name: 'telegram_status',
  description: 'Check Telegram bot connection status.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const telegramStatusToolHandler: ToolHandler = async () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: true,
      configured: false,
      message: 'Telegram not configured. Use telegram_setup with your bot token.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const telegram = config.channels?.telegram;

  if (!telegram?.token) {
    return {
      success: true,
      configured: false,
      message: 'Telegram not configured. Use telegram_setup with your bot token.',
    };
  }

  // Test connection
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegram.token}/getMe`);
    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: true,
        configured: true,
        connected: false,
        error: data.description,
        bot: {
          username: telegram.botUsername,
        },
      };
    }

    return {
      success: true,
      configured: true,
      connected: true,
      bot: {
        id: data.result.id,
        username: `@${data.result.username}`,
        name: data.result.first_name,
      },
      connectedAt: telegram.connectedAt,
    };
  } catch (error) {
    return {
      success: true,
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Network error',
      bot: {
        username: telegram.botUsername,
      },
    };
  }
};

// ============================================================================
// Telegram Send Tool
// ============================================================================

export const telegramSendToolDefinition: ToolDefinition = {
  name: 'telegram_send',
  description: 'Send a message via Telegram bot.',
  parameters: {
    type: 'object',
    properties: {
      chatId: {
        type: 'string',
        description: 'Telegram chat ID to send to',
      },
      message: {
        type: 'string',
        description: 'Message text to send',
      },
      parseMode: {
        type: 'string',
        description: 'Parse mode: HTML or Markdown',
        enum: ['HTML', 'Markdown'],
      },
    },
    required: ['chatId', 'message'],
  },
};

export const telegramSendToolHandler: ToolHandler = async (args) => {
  const { chatId, message, parseMode } = args as { 
    chatId: string; 
    message: string; 
    parseMode?: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Telegram not configured. Use telegram_setup first.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.telegram?.token;

  if (!token) {
    return {
      success: false,
      error: 'Telegram not configured. Use telegram_setup first.',
    };
  }

  try {
    const params: any = {
      chat_id: chatId,
      text: message,
    };
    if (parseMode) params.parse_mode = parseMode;

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.description,
      };
    }

    return {
      success: true,
      messageId: data.result.message_id,
      chatId: data.result.chat.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
};

// ============================================================================
// Telegram Get Updates Tool (for testing)
// ============================================================================

export const telegramGetUpdatesToolDefinition: ToolDefinition = {
  name: 'telegram_get_updates',
  description: 'Get recent messages/updates from Telegram (for testing).',
  parameters: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of updates to retrieve (1-100)',
      },
    },
    required: [],
  },
};

export const telegramGetUpdatesToolHandler: ToolHandler = async (args) => {
  const { limit = 10 } = args as { limit?: number };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Telegram not configured. Use telegram_setup first.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.telegram?.token;

  if (!token) {
    return {
      success: false,
      error: 'Telegram not configured. Use telegram_setup first.',
    };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=${limit}`);
    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.description,
      };
    }

    const updates = data.result.map((u: any) => ({
      updateId: u.update_id,
      message: u.message ? {
        id: u.message.message_id,
        chatId: u.message.chat.id,
        chatType: u.message.chat.type,
        from: u.message.from?.username || u.message.from?.first_name,
        text: u.message.text,
        date: new Date(u.message.date * 1000).toISOString(),
      } : null,
    }));

    return {
      success: true,
      count: updates.length,
      updates,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get updates',
    };
  }
};
