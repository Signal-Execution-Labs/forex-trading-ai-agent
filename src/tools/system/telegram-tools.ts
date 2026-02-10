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
        `2. Start a chat with the bot and send /start`,
        `3. Then use telegram_get_chat_id to get your chat ID`,
        `4. Finally use telegram_set_chat_id to save it`,
      ],
      important: 'You still need to set the chat_id so K.I.T. knows where to send messages!',
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
// Telegram Get Chat ID Tool
// ============================================================================

export const telegramGetChatIdToolDefinition: ToolDefinition = {
  name: 'telegram_get_chat_id',
  description: 'Get chat IDs from recent messages. User must send a message to the bot first, then call this to find their chat ID.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const telegramGetChatIdToolHandler: ToolHandler = async () => {
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
    const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates?limit=10`);
    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.description,
      };
    }

    if (data.result.length === 0) {
      return {
        success: true,
        chats: [],
        message: 'No messages found. Ask the user to send a message to the bot first, then call this again.',
      };
    }

    // Extract unique chats
    const chatsMap = new Map<number, any>();
    for (const update of data.result) {
      const chat = update.message?.chat;
      if (chat && !chatsMap.has(chat.id)) {
        chatsMap.set(chat.id, {
          chatId: chat.id,
          type: chat.type,
          username: chat.username,
          firstName: chat.first_name,
          lastName: chat.last_name,
          title: chat.title,
        });
      }
    }

    const chats = Array.from(chatsMap.values());

    return {
      success: true,
      chats,
      message: chats.length === 1 
        ? `Found chat! Use telegram_set_chat_id with chatId: ${chats[0].chatId}`
        : `Found ${chats.length} chats. Choose one and use telegram_set_chat_id to save it.`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get updates',
    };
  }
};

// ============================================================================
// Telegram Set Chat ID Tool
// ============================================================================

export const telegramSetChatIdToolDefinition: ToolDefinition = {
  name: 'telegram_set_chat_id',
  description: 'Save the chat ID for K.I.T. to send messages to. Get the ID from telegram_get_chat_id first.',
  parameters: {
    type: 'object',
    properties: {
      chatId: {
        type: 'string',
        description: 'The Telegram chat ID to save as default',
      },
    },
    required: ['chatId'],
  },
};

export const telegramSetChatIdToolHandler: ToolHandler = async (args) => {
  const { chatId } = args as { chatId: string };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Telegram not configured. Use telegram_setup first.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  
  if (!config.channels?.telegram?.token) {
    return {
      success: false,
      error: 'Telegram not configured. Use telegram_setup first.',
    };
  }

  // Save chat ID
  config.channels.telegram.chatId = chatId;
  config.channels.telegram.chatIdSetAt = new Date().toISOString();
  
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  // Send a test message
  try {
    const token = config.channels.telegram.token;
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ K.I.T. connected! I will send you messages here.',
      }),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: `Chat ID saved but test message failed: ${data.description}`,
      };
    }

    return {
      success: true,
      chatId,
      message: '✅ Chat ID saved and test message sent! Telegram setup complete.',
    };
  } catch (error) {
    return {
      success: true,
      chatId,
      warning: 'Chat ID saved but could not send test message.',
    };
  }
};

// ============================================================================
// Telegram Send with Buttons Tool
// ============================================================================

export const telegramSendWithButtonsToolDefinition: ToolDefinition = {
  name: 'telegram_send_with_buttons',
  description: 'Send a message with inline keyboard buttons. Useful for confirmations, menus, or quick actions.',
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
      buttons: {
        type: 'array',
        description: 'Array of button rows. Each row is an array of buttons with text and callbackData or url.',
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'Button text' },
              callbackData: { type: 'string', description: 'Callback data (for action buttons)' },
              url: { type: 'string', description: 'URL to open (for link buttons)' },
            },
            required: ['text'],
          },
        },
      },
      parseMode: {
        type: 'string',
        description: 'Parse mode: HTML or Markdown',
        enum: ['HTML', 'Markdown'],
      },
    },
    required: ['chatId', 'message', 'buttons'],
  },
};

export const telegramSendWithButtonsToolHandler: ToolHandler = async (args) => {
  const { chatId, message, buttons, parseMode } = args as {
    chatId: string;
    message: string;
    buttons: Array<Array<{ text: string; callbackData?: string; url?: string }>>;
    parseMode?: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.telegram?.token;

  if (!token) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  try {
    const inlineKeyboard = buttons.map(row =>
      row.map(btn => {
        if (btn.url) return { text: btn.text, url: btn.url };
        return { text: btn.text, callback_data: btn.callbackData || btn.text };
      })
    );

    const params: any = {
      chat_id: chatId,
      text: message,
      reply_markup: { inline_keyboard: inlineKeyboard },
    };
    if (parseMode) params.parse_mode = parseMode;

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return {
      success: true,
      messageId: data.result.message_id,
      chatId: data.result.chat.id,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Send failed' };
  }
};

// ============================================================================
// Telegram React Tool
// ============================================================================

export const telegramReactToolDefinition: ToolDefinition = {
  name: 'telegram_react',
  description: 'Add an emoji reaction to a message.',
  parameters: {
    type: 'object',
    properties: {
      chatId: {
        type: 'string',
        description: 'Telegram chat ID',
      },
      messageId: {
        type: 'number',
        description: 'Message ID to react to',
      },
      emoji: {
        type: 'string',
        description: 'Emoji to react with (e.g., 👍, ❤️, 🔥, 👀)',
      },
    },
    required: ['chatId', 'messageId', 'emoji'],
  },
};

export const telegramReactToolHandler: ToolHandler = async (args) => {
  const { chatId, messageId, emoji } = args as {
    chatId: string;
    messageId: number;
    emoji: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.telegram?.token;

  if (!token) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/setMessageReaction`, {
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
      return {
        success: false,
        error: data.description,
        note: 'Reactions may not be available in all chats (requires Telegram Premium or certain chat settings)',
      };
    }

    return { success: true, emoji, messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reaction failed' };
  }
};

// ============================================================================
// Telegram Edit Message Tool
// ============================================================================

export const telegramEditToolDefinition: ToolDefinition = {
  name: 'telegram_edit',
  description: 'Edit an existing message.',
  parameters: {
    type: 'object',
    properties: {
      chatId: {
        type: 'string',
        description: 'Telegram chat ID',
      },
      messageId: {
        type: 'number',
        description: 'Message ID to edit',
      },
      text: {
        type: 'string',
        description: 'New message text',
      },
      parseMode: {
        type: 'string',
        description: 'Parse mode: HTML or Markdown',
        enum: ['HTML', 'Markdown'],
      },
    },
    required: ['chatId', 'messageId', 'text'],
  },
};

export const telegramEditToolHandler: ToolHandler = async (args) => {
  const { chatId, messageId, text, parseMode } = args as {
    chatId: string;
    messageId: number;
    text: string;
    parseMode?: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.telegram?.token;

  if (!token) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  try {
    const params: any = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };
    if (parseMode) params.parse_mode = parseMode;

    const response = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Edit failed' };
  }
};

// ============================================================================
// Telegram Delete Message Tool
// ============================================================================

export const telegramDeleteToolDefinition: ToolDefinition = {
  name: 'telegram_delete',
  description: 'Delete a message.',
  parameters: {
    type: 'object',
    properties: {
      chatId: {
        type: 'string',
        description: 'Telegram chat ID',
      },
      messageId: {
        type: 'number',
        description: 'Message ID to delete',
      },
    },
    required: ['chatId', 'messageId'],
  },
};

export const telegramDeleteToolHandler: ToolHandler = async (args) => {
  const { chatId, messageId } = args as { chatId: string; messageId: number };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.telegram?.token;

  if (!token) {
    return { success: false, error: 'Telegram not configured. Use telegram_setup first.' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return { success: false, error: data.description };
    }

    return { success: true, deleted: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
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
