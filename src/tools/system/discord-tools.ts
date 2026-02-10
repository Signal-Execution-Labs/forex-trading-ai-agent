/**
 * K.I.T. Discord Tools
 * Connect and manage Discord bot
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler } from './tool-registry';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

// ============================================================================
// Discord Setup Tool
// ============================================================================

export const discordSetupToolDefinition: ToolDefinition = {
  name: 'discord_setup',
  description: 'Configure Discord bot connection. Provide the bot token from Discord Developer Portal.',
  parameters: {
    type: 'object',
    properties: {
      token: {
        type: 'string',
        description: 'Discord Bot Token from Developer Portal (https://discord.com/developers/applications)',
      },
      respondToMentionsOnly: {
        type: 'boolean',
        description: 'If true, only respond when @mentioned in servers (always responds in DMs). Default: false',
      },
      prefix: {
        type: 'string',
        description: 'Command prefix (e.g., "!" or "kit "). If set, only messages starting with prefix get processed.',
      },
    },
    required: ['token'],
  },
};

export const discordSetupToolHandler: ToolHandler = async (args) => {
  const { token, respondToMentionsOnly, prefix } = args as { 
    token: string; 
    respondToMentionsOnly?: boolean;
    prefix?: string;
  };

  if (!token || token.length < 50) {
    return {
      success: false,
      error: 'Invalid token format. Discord bot tokens are typically 70+ characters long.',
      help: 'Get your bot token from: https://discord.com/developers/applications → Your App → Bot → Token',
    };
  }

  // Test the token by making a simple API call
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: `Discord API error: ${error.message || 'Invalid token'}`,
        help: 'Make sure you\'re using a Bot token, not a client token or OAuth2 secret.',
      };
    }

    const botInfo = await response.json() as any;

    // Ensure config directory exists
    if (!fs.existsSync(KIT_HOME)) {
      fs.mkdirSync(KIT_HOME, { recursive: true });
    }

    // Load existing config or create new
    let config: any = {};
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }

    // Save Discord config
    if (!config.channels) config.channels = {};
    config.channels.discord = {
      enabled: true,
      token: token,
      botId: botInfo.id,
      botUsername: botInfo.username,
      botDiscriminator: botInfo.discriminator,
      respondToMentionsOnly: respondToMentionsOnly ?? false,
      prefix: prefix,
      connectedAt: new Date().toISOString(),
    };

    // Save config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    return {
      success: true,
      message: `✅ Discord bot connected successfully!`,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        tag: `${botInfo.username}#${botInfo.discriminator}`,
        avatar: botInfo.avatar,
      },
      settings: {
        respondToMentionsOnly: respondToMentionsOnly ?? false,
        prefix: prefix || '(none - responds to all messages)',
      },
      nextSteps: [
        '1. Invite the bot to your server using the OAuth2 URL from Developer Portal',
        '2. Make sure to select these scopes: bot, applications.commands',
        '3. And these permissions: Send Messages, Read Message History, Add Reactions',
        '4. Once invited, the bot will start listening when you run K.I.T.',
      ],
      inviteUrl: `https://discord.com/api/oauth2/authorize?client_id=${botInfo.id}&permissions=274877958144&scope=bot`,
    };
  } catch (error) {
    return {
      success: false,
      error: `Connection failed: ${error instanceof Error ? error.message : 'Network error'}`,
    };
  }
};

// ============================================================================
// Discord Status Tool
// ============================================================================

export const discordStatusToolDefinition: ToolDefinition = {
  name: 'discord_status',
  description: 'Check Discord bot connection status.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const discordStatusToolHandler: ToolHandler = async () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: true,
      configured: false,
      message: 'Discord not configured. Use discord_setup with your bot token.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const discord = config.channels?.discord;

  if (!discord?.token) {
    return {
      success: true,
      configured: false,
      message: 'Discord not configured. Use discord_setup with your bot token.',
    };
  }

  // Test connection
  try {
    const response = await fetch('https://discord.com/api/v10/users/@me', {
      headers: {
        Authorization: `Bot ${discord.token}`,
      },
    });

    if (!response.ok) {
      return {
        success: true,
        configured: true,
        connected: false,
        error: 'Token invalid or expired',
        bot: {
          username: discord.botUsername,
        },
      };
    }

    const botInfo = await response.json() as any;

    // Get guilds (servers) the bot is in
    const guildsResponse = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${discord.token}`,
      },
    });

    let guilds: any[] = [];
    if (guildsResponse.ok) {
      guilds = await guildsResponse.json() as any[];
    }

    return {
      success: true,
      configured: true,
      connected: true,
      bot: {
        id: botInfo.id,
        username: botInfo.username,
        tag: `${botInfo.username}#${botInfo.discriminator}`,
      },
      settings: {
        respondToMentionsOnly: discord.respondToMentionsOnly ?? false,
        prefix: discord.prefix || '(none)',
      },
      servers: guilds.map((g: any) => ({
        id: g.id,
        name: g.name,
      })),
      serverCount: guilds.length,
      connectedAt: discord.connectedAt,
    };
  } catch (error) {
    return {
      success: true,
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Network error',
      bot: {
        username: discord.botUsername,
      },
    };
  }
};

// ============================================================================
// Discord Send Tool
// ============================================================================

export const discordSendToolDefinition: ToolDefinition = {
  name: 'discord_send',
  description: 'Send a message to a Discord channel or DM.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID to send to (right-click channel → Copy ID)',
      },
      message: {
        type: 'string',
        description: 'Message text to send (supports markdown)',
      },
    },
    required: ['channelId', 'message'],
  },
};

export const discordSendToolHandler: ToolHandler = async (args) => {
  const { channelId, message } = args as { 
    channelId: string; 
    message: string; 
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Discord not configured. Use discord_setup first.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return {
      success: false,
      error: 'Discord not configured. Use discord_setup first.',
    };
  }

  try {
    // Chunk long messages (Discord limit: 2000 chars)
    const chunks: string[] = [];
    let remaining = message;
    const maxLength = 1900;

    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }

      let breakAt = maxLength;
      const lineBreak = remaining.lastIndexOf('\n', maxLength);
      if (lineBreak > maxLength * 0.5) {
        breakAt = lineBreak + 1;
      } else {
        const spaceBreak = remaining.lastIndexOf(' ', maxLength);
        if (spaceBreak > maxLength * 0.5) {
          breakAt = spaceBreak + 1;
        }
      }

      chunks.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }

    // Send each chunk
    const messageIds: string[] = [];
    for (const chunk of chunks) {
      const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: chunk }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as any;
        return {
          success: false,
          error: error.message || `HTTP ${response.status}`,
        };
      }

      const result = await response.json() as any;
      messageIds.push(result.id);

      // Small delay between chunks
      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    return {
      success: true,
      messageId: messageIds[0],
      messageIds: messageIds.length > 1 ? messageIds : undefined,
      channelId,
      chunks: chunks.length > 1 ? chunks.length : undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
};

// ============================================================================
// Discord React Tool
// ============================================================================

export const discordReactToolDefinition: ToolDefinition = {
  name: 'discord_react',
  description: 'Add an emoji reaction to a Discord message.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID',
      },
      messageId: {
        type: 'string',
        description: 'Message ID to react to',
      },
      emoji: {
        type: 'string',
        description: 'Emoji to react with (Unicode emoji like 👍 or custom emoji ID)',
      },
    },
    required: ['channelId', 'messageId', 'emoji'],
  },
};

export const discordReactToolHandler: ToolHandler = async (args) => {
  const { channelId, messageId, emoji } = args as {
    channelId: string;
    messageId: string;
    emoji: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  try {
    // URL encode the emoji
    const encodedEmoji = encodeURIComponent(emoji);
    
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/reactions/${encodedEmoji}/@me`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    return { success: true, emoji, messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reaction failed' };
  }
};

// ============================================================================
// Discord Edit Tool
// ============================================================================

export const discordEditToolDefinition: ToolDefinition = {
  name: 'discord_edit',
  description: 'Edit a Discord message (can only edit bot\'s own messages).',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID',
      },
      messageId: {
        type: 'string',
        description: 'Message ID to edit',
      },
      content: {
        type: 'string',
        description: 'New message content',
      },
    },
    required: ['channelId', 'messageId', 'content'],
  },
};

export const discordEditToolHandler: ToolHandler = async (args) => {
  const { channelId, messageId, content } = args as {
    channelId: string;
    messageId: string;
    content: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bot ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    return { success: true, messageId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Edit failed' };
  }
};

// ============================================================================
// Discord Delete Tool
// ============================================================================

export const discordDeleteToolDefinition: ToolDefinition = {
  name: 'discord_delete',
  description: 'Delete a Discord message.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID',
      },
      messageId: {
        type: 'string',
        description: 'Message ID to delete',
      },
    },
    required: ['channelId', 'messageId'],
  },
};

export const discordDeleteToolHandler: ToolHandler = async (args) => {
  const { channelId, messageId } = args as { channelId: string; messageId: string };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    return { success: true, deleted: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
};

// ============================================================================
// Discord List Guilds Tool
// ============================================================================

export const discordListGuildsToolDefinition: ToolDefinition = {
  name: 'discord_list_guilds',
  description: 'List all Discord servers (guilds) the bot is in.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const discordListGuildsToolHandler: ToolHandler = async () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  try {
    const response = await fetch('https://discord.com/api/v10/users/@me/guilds', {
      headers: {
        Authorization: `Bot ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    const guilds = await response.json() as any[];

    return {
      success: true,
      guilds: guilds.map((g: any) => ({
        id: g.id,
        name: g.name,
        icon: g.icon,
        owner: g.owner,
      })),
      count: guilds.length,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to list guilds' };
  }
};

// ============================================================================
// Discord Poll Tool (OpenClaw-inspired)
// ============================================================================

export const discordPollToolDefinition: ToolDefinition = {
  name: 'discord_poll',
  description: 'Create a poll in a Discord channel. Polls support 2-10 answer options and can run for up to 32 days.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID to post poll in',
      },
      question: {
        type: 'string',
        description: 'Poll question (max 300 characters)',
      },
      answers: {
        type: 'array',
        items: { type: 'string' },
        description: 'Array of 2-10 answer options (max 55 chars each)',
      },
      allowMultiselect: {
        type: 'boolean',
        description: 'Allow users to select multiple answers. Default: false',
      },
      durationHours: {
        type: 'number',
        description: 'Poll duration in hours (1-768, default 24)',
      },
      content: {
        type: 'string',
        description: 'Optional message text to include with the poll',
      },
    },
    required: ['channelId', 'question', 'answers'],
  },
};

export const discordPollToolHandler: ToolHandler = async (args) => {
  const { channelId, question, answers, allowMultiselect, durationHours, content } = args as {
    channelId: string;
    question: string;
    answers: string[];
    allowMultiselect?: boolean;
    durationHours?: number;
    content?: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  // Validate inputs
  if (!Array.isArray(answers) || answers.length < 2 || answers.length > 10) {
    return { success: false, error: 'Poll must have 2-10 answers' };
  }

  if (question.length > 300) {
    return { success: false, error: 'Question must be 300 characters or less' };
  }

  const invalidAnswer = answers.find(a => a.length > 55);
  if (invalidAnswer) {
    return { success: false, error: `Answer "${invalidAnswer.substring(0, 20)}..." exceeds 55 character limit` };
  }

  const duration = Math.min(Math.max(durationHours || 24, 1), 768);

  try {
    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: content || undefined,
        poll: {
          question: { text: question },
          answers: answers.map((text, i) => ({ 
            poll_media: { text },
            answer_id: i + 1,
          })),
          allow_multiselect: allowMultiselect ?? false,
          duration: duration,
          layout_type: 1, // DEFAULT layout
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
        details: error,
      };
    }

    const result = await response.json() as any;

    return {
      success: true,
      messageId: result.id,
      channelId,
      poll: {
        question,
        answers,
        allowMultiselect: allowMultiselect ?? false,
        durationHours: duration,
        expiresAt: new Date(Date.now() + duration * 60 * 60 * 1000).toISOString(),
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Poll creation failed' };
  }
};

// ============================================================================
// Discord Thread Tool (OpenClaw-inspired)
// ============================================================================

export const discordThreadToolDefinition: ToolDefinition = {
  name: 'discord_thread',
  description: 'Create a thread in a Discord channel, optionally from an existing message.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID',
      },
      name: {
        type: 'string',
        description: 'Thread name (1-100 characters)',
      },
      messageId: {
        type: 'string',
        description: 'Optional: Message ID to create thread from. If omitted, creates a standalone thread.',
      },
      autoArchiveMinutes: {
        type: 'number',
        description: 'Auto-archive after inactivity (60, 1440, 4320, 10080 minutes). Default: 1440 (1 day)',
      },
    },
    required: ['channelId', 'name'],
  },
};

export const discordThreadToolHandler: ToolHandler = async (args) => {
  const { channelId, name, messageId, autoArchiveMinutes } = args as {
    channelId: string;
    name: string;
    messageId?: string;
    autoArchiveMinutes?: number;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  if (name.length < 1 || name.length > 100) {
    return { success: false, error: 'Thread name must be 1-100 characters' };
  }

  const validArchiveDurations = [60, 1440, 4320, 10080];
  const archiveDuration = validArchiveDurations.includes(autoArchiveMinutes || 0) 
    ? autoArchiveMinutes 
    : 1440;

  try {
    let url: string;
    let body: any;

    if (messageId) {
      // Create thread from message
      url = `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`;
      body = {
        name,
        auto_archive_duration: archiveDuration,
      };
    } else {
      // Create standalone thread
      url = `https://discord.com/api/v10/channels/${channelId}/threads`;
      body = {
        name,
        auto_archive_duration: archiveDuration,
        type: 11, // GUILD_PUBLIC_THREAD
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    const thread = await response.json() as any;

    return {
      success: true,
      threadId: thread.id,
      name: thread.name,
      channelId,
      fromMessage: messageId || null,
      autoArchiveMinutes: archiveDuration,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Thread creation failed' };
  }
};

// ============================================================================
// Discord Presence Tool (OpenClaw-inspired)
// ============================================================================

export const discordPresenceToolDefinition: ToolDefinition = {
  name: 'discord_presence',
  description: 'Set the bot\'s presence (status and activity). Note: Requires an active Discord.js client connection.',
  parameters: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['online', 'idle', 'dnd', 'invisible'],
        description: 'Bot status. Default: online',
      },
      activityType: {
        type: 'string',
        enum: ['playing', 'streaming', 'listening', 'watching', 'competing', 'custom'],
        description: 'Activity type',
      },
      activityName: {
        type: 'string',
        description: 'Activity name (shown in sidebar for non-custom types)',
      },
      activityState: {
        type: 'string',
        description: 'For custom type: the status text. For others: shown in profile flyout.',
      },
      activityUrl: {
        type: 'string',
        description: 'Streaming URL (Twitch/YouTube) for streaming type',
      },
    },
    required: [],
  },
};

export const discordPresenceToolHandler: ToolHandler = async (args) => {
  const { status, activityType, activityName, activityState, activityUrl } = args as {
    status?: 'online' | 'idle' | 'dnd' | 'invisible';
    activityType?: string;
    activityName?: string;
    activityState?: string;
    activityUrl?: string;
  };

  // Note: This tool requires an active Discord.js client to work
  // Store the desired presence in config for the gateway to apply
  
  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  if (!config.channels?.discord?.token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  // Store presence config for the running gateway to pick up
  config.channels.discord.presence = {
    status: status || 'online',
    activityType,
    activityName,
    activityState,
    activityUrl,
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  return {
    success: true,
    message: 'Presence configuration saved. The running gateway will apply this on next poll.',
    presence: config.channels.discord.presence,
    note: 'Presence changes require an active gateway connection to take effect.',
  };
};

// ============================================================================
// Discord Pin Tool (OpenClaw-inspired)
// ============================================================================

export const discordPinToolDefinition: ToolDefinition = {
  name: 'discord_pin',
  description: 'Pin or unpin a message in a Discord channel.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID',
      },
      messageId: {
        type: 'string',
        description: 'Message ID to pin/unpin',
      },
      unpin: {
        type: 'boolean',
        description: 'If true, unpin the message. Default: false (pin)',
      },
    },
    required: ['channelId', 'messageId'],
  },
};

export const discordPinToolHandler: ToolHandler = async (args) => {
  const { channelId, messageId, unpin } = args as {
    channelId: string;
    messageId: string;
    unpin?: boolean;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/pins/${messageId}`,
      {
        method: unpin ? 'DELETE' : 'PUT',
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    return {
      success: true,
      action: unpin ? 'unpinned' : 'pinned',
      messageId,
      channelId,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Pin operation failed' };
  }
};

// ============================================================================
// Discord List Pins Tool (OpenClaw-inspired)
// ============================================================================

export const discordListPinsToolDefinition: ToolDefinition = {
  name: 'discord_list_pins',
  description: 'List all pinned messages in a Discord channel.',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID',
      },
    },
    required: ['channelId'],
  },
};

export const discordListPinsToolHandler: ToolHandler = async (args) => {
  const { channelId } = args as { channelId: string };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/pins`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    const pins = await response.json() as any[];

    return {
      success: true,
      channelId,
      count: pins.length,
      pins: pins.map((msg: any) => ({
        id: msg.id,
        content: msg.content?.substring(0, 200) || '(no text)',
        author: msg.author?.username,
        timestamp: msg.timestamp,
      })),
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to list pins' };
  }
};

// ============================================================================
// Discord Search Tool (OpenClaw-inspired - searches recent messages)
// ============================================================================

export const discordSearchToolDefinition: ToolDefinition = {
  name: 'discord_search',
  description: 'Search recent messages in a Discord channel. Note: Searches last 100 messages (Discord API limitation for bots).',
  parameters: {
    type: 'object',
    properties: {
      channelId: {
        type: 'string',
        description: 'Discord channel ID to search',
      },
      query: {
        type: 'string',
        description: 'Text to search for (case-insensitive)',
      },
      authorId: {
        type: 'string',
        description: 'Optional: Filter by author user ID',
      },
      limit: {
        type: 'number',
        description: 'Maximum results to return (1-50, default 20)',
      },
    },
    required: ['channelId', 'query'],
  },
};

export const discordSearchToolHandler: ToolHandler = async (args) => {
  const { channelId, query, authorId, limit } = args as {
    channelId: string;
    query: string;
    authorId?: string;
    limit?: number;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.discord?.token;

  if (!token) {
    return { success: false, error: 'Discord not configured. Use discord_setup first.' };
  }

  const maxResults = Math.min(Math.max(limit || 20, 1), 50);

  try {
    // Fetch last 100 messages from channel
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=100`,
      {
        headers: {
          Authorization: `Bot ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as any;
      return {
        success: false,
        error: error.message || `HTTP ${response.status}`,
      };
    }

    const messages = await response.json() as any[];
    const queryLower = query.toLowerCase();

    // Filter messages
    const matches = messages
      .filter((msg: any) => {
        const matchesQuery = msg.content?.toLowerCase().includes(queryLower);
        const matchesAuthor = !authorId || msg.author?.id === authorId;
        return matchesQuery && matchesAuthor;
      })
      .slice(0, maxResults);

    return {
      success: true,
      channelId,
      query,
      count: matches.length,
      messages: matches.map((msg: any) => ({
        id: msg.id,
        content: msg.content?.substring(0, 300),
        author: msg.author?.username,
        authorId: msg.author?.id,
        timestamp: msg.timestamp,
      })),
      note: 'Search is limited to the last 100 messages in the channel.',
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Search failed' };
  }
};
