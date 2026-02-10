/**
 * K.I.T. Slack Tools
 * Connect and manage Slack bot
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler } from './tool-registry';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

// ============================================================================
// Slack Setup Tool
// ============================================================================

export const slackSetupToolDefinition: ToolDefinition = {
  name: 'slack_setup',
  description: 'Configure Slack bot connection. Requires Bot Token and App Token from Slack App settings.',
  parameters: {
    type: 'object',
    properties: {
      botToken: {
        type: 'string',
        description: 'Slack Bot User OAuth Token (starts with xoxb-). From OAuth & Permissions page.',
      },
      appToken: {
        type: 'string',
        description: 'Slack App-Level Token (starts with xapp-). From Basic Information → App-Level Tokens. Must have connections:write scope.',
      },
      respondToMentionsOnly: {
        type: 'boolean',
        description: 'If true, only respond when @mentioned in channels (always responds in DMs). Default: false',
      },
    },
    required: ['botToken', 'appToken'],
  },
};

export const slackSetupToolHandler: ToolHandler = async (args) => {
  const { botToken, appToken, respondToMentionsOnly } = args as { 
    botToken: string; 
    appToken: string;
    respondToMentionsOnly?: boolean;
  };

  // Validate token formats
  if (!botToken || !botToken.startsWith('xoxb-')) {
    return {
      success: false,
      error: 'Invalid Bot Token format. Must start with "xoxb-"',
      help: 'Get your Bot Token from: Slack App → OAuth & Permissions → Bot User OAuth Token',
    };
  }

  if (!appToken || !appToken.startsWith('xapp-')) {
    return {
      success: false,
      error: 'Invalid App Token format. Must start with "xapp-"',
      help: 'Get your App Token from: Slack App → Basic Information → App-Level Tokens (needs connections:write scope)',
    };
  }

  // Test the bot token
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: `Slack API error: ${data.error}`,
        help: 'Make sure your Bot Token has the required scopes: chat:write, channels:read, im:read, users:read',
      };
    }

    // Ensure config directory exists
    if (!fs.existsSync(KIT_HOME)) {
      fs.mkdirSync(KIT_HOME, { recursive: true });
    }

    // Load existing config or create new
    let config: any = {};
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }

    // Save Slack config
    if (!config.channels) config.channels = {};
    config.channels.slack = {
      enabled: true,
      botToken: botToken,
      appToken: appToken,
      botId: data.user_id,
      botName: data.user,
      teamId: data.team_id,
      teamName: data.team,
      respondToMentionsOnly: respondToMentionsOnly ?? false,
      useSocketMode: true,
      connectedAt: new Date().toISOString(),
    };

    // Save config
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    return {
      success: true,
      message: `✅ Slack bot connected successfully!`,
      bot: {
        id: data.user_id,
        name: data.user,
        team: data.team,
        teamId: data.team_id,
      },
      settings: {
        respondToMentionsOnly: respondToMentionsOnly ?? false,
        socketMode: true,
      },
      nextSteps: [
        '1. Make sure Socket Mode is enabled in your Slack App settings',
        '2. Add the bot to channels: /invite @' + data.user,
        '3. The bot will start listening when you run K.I.T.',
      ],
      requiredScopes: [
        'app_mentions:read - To receive @mentions',
        'channels:history - To read channel messages',
        'channels:read - To list channels',
        'chat:write - To send messages',
        'im:history - To read DMs',
        'im:read - To list DMs',
        'users:read - To get user info',
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
// Slack Status Tool
// ============================================================================

export const slackStatusToolDefinition: ToolDefinition = {
  name: 'slack_status',
  description: 'Check Slack bot connection status.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const slackStatusToolHandler: ToolHandler = async () => {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: true,
      configured: false,
      message: 'Slack not configured. Use slack_setup with your bot token and app token.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const slack = config.channels?.slack;

  if (!slack?.botToken || !slack?.appToken) {
    return {
      success: true,
      configured: false,
      message: 'Slack not configured. Use slack_setup with your bot token and app token.',
    };
  }

  // Test connection
  try {
    const response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slack.botToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: true,
        configured: true,
        connected: false,
        error: data.error,
        bot: {
          name: slack.botName,
        },
      };
    }

    // Get list of channels the bot is in
    const channelsResponse = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${slack.botToken}`,
      },
    });

    let channels: any[] = [];
    if (channelsResponse.ok) {
      const channelsData = await channelsResponse.json() as any;
      if (channelsData.ok) {
        channels = channelsData.channels?.filter((c: any) => c.is_member) || [];
      }
    }

    return {
      success: true,
      configured: true,
      connected: true,
      bot: {
        id: data.user_id,
        name: data.user,
        team: data.team,
        teamId: data.team_id,
      },
      settings: {
        respondToMentionsOnly: slack.respondToMentionsOnly ?? false,
        socketMode: slack.useSocketMode ?? true,
      },
      channels: channels.map((c: any) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
      })),
      channelCount: channels.length,
      connectedAt: slack.connectedAt,
    };
  } catch (error) {
    return {
      success: true,
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : 'Network error',
      bot: {
        name: slack.botName,
      },
    };
  }
};

// ============================================================================
// Slack Send Tool
// ============================================================================

export const slackSendToolDefinition: ToolDefinition = {
  name: 'slack_send',
  description: 'Send a message to a Slack channel or DM.',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID (C...) or User ID (U...) for DM. Can also use #channel-name.',
      },
      message: {
        type: 'string',
        description: 'Message text to send (supports Slack mrkdwn formatting)',
      },
      threadTs: {
        type: 'string',
        description: 'Thread timestamp to reply in thread (optional)',
      },
    },
    required: ['channel', 'message'],
  },
};

export const slackSendToolHandler: ToolHandler = async (args) => {
  const { channel, message, threadTs } = args as { 
    channel: string; 
    message: string; 
    threadTs?: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Slack not configured. Use slack_setup first.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.slack?.botToken;

  if (!token) {
    return {
      success: false,
      error: 'Slack not configured. Use slack_setup first.',
    };
  }

  try {
    const params: any = {
      channel,
      text: message,
    };
    if (threadTs) params.thread_ts = threadTs;

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.error,
        help: data.error === 'channel_not_found' 
          ? 'Make sure to use the channel ID (starts with C) or invite the bot to the channel first'
          : undefined,
      };
    }

    return {
      success: true,
      messageTs: data.ts,
      channel: data.channel,
      threadTs: data.message?.thread_ts,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Send failed',
    };
  }
};

// ============================================================================
// Slack React Tool
// ============================================================================

export const slackReactToolDefinition: ToolDefinition = {
  name: 'slack_react',
  description: 'Add an emoji reaction to a Slack message.',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the message is',
      },
      messageTs: {
        type: 'string',
        description: 'Message timestamp (ts) to react to',
      },
      emoji: {
        type: 'string',
        description: 'Emoji name without colons (e.g., "thumbsup" not ":thumbsup:")',
      },
    },
    required: ['channel', 'messageTs', 'emoji'],
  },
};

export const slackReactToolHandler: ToolHandler = async (args) => {
  const { channel, messageTs, emoji } = args as {
    channel: string;
    messageTs: string;
    emoji: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.slack?.botToken;

  if (!token) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  try {
    // Remove colons if present
    const emojiName = emoji.replace(/:/g, '');

    const response = await fetch('https://slack.com/api/reactions.add', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        timestamp: messageTs,
        name: emojiName,
      }),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.error,
      };
    }

    return { success: true, emoji: emojiName, messageTs };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Reaction failed' };
  }
};

// ============================================================================
// Slack Edit Tool
// ============================================================================

export const slackEditToolDefinition: ToolDefinition = {
  name: 'slack_edit',
  description: 'Edit a Slack message (can only edit bot\'s own messages).',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the message is',
      },
      messageTs: {
        type: 'string',
        description: 'Message timestamp (ts) to edit',
      },
      text: {
        type: 'string',
        description: 'New message text',
      },
    },
    required: ['channel', 'messageTs', 'text'],
  },
};

export const slackEditToolHandler: ToolHandler = async (args) => {
  const { channel, messageTs, text } = args as {
    channel: string;
    messageTs: string;
    text: string;
  };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.slack?.botToken;

  if (!token) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  try {
    const response = await fetch('https://slack.com/api/chat.update', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        ts: messageTs,
        text,
      }),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.error,
      };
    }

    return { success: true, messageTs: data.ts };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Edit failed' };
  }
};

// ============================================================================
// Slack Delete Tool
// ============================================================================

export const slackDeleteToolDefinition: ToolDefinition = {
  name: 'slack_delete',
  description: 'Delete a Slack message.',
  parameters: {
    type: 'object',
    properties: {
      channel: {
        type: 'string',
        description: 'Channel ID where the message is',
      },
      messageTs: {
        type: 'string',
        description: 'Message timestamp (ts) to delete',
      },
    },
    required: ['channel', 'messageTs'],
  },
};

export const slackDeleteToolHandler: ToolHandler = async (args) => {
  const { channel, messageTs } = args as { channel: string; messageTs: string };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.slack?.botToken;

  if (!token) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  try {
    const response = await fetch('https://slack.com/api/chat.delete', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel,
        ts: messageTs,
      }),
    });

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.error,
      };
    }

    return { success: true, deleted: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
  }
};

// ============================================================================
// Slack List Channels Tool
// ============================================================================

export const slackListChannelsToolDefinition: ToolDefinition = {
  name: 'slack_list_channels',
  description: 'List Slack channels the bot has access to.',
  parameters: {
    type: 'object',
    properties: {
      includeMember: {
        type: 'boolean',
        description: 'If true, only show channels the bot is a member of. Default: false',
      },
    },
    required: [],
  },
};

export const slackListChannelsToolHandler: ToolHandler = async (args) => {
  const { includeMember = false } = args as { includeMember?: boolean };

  if (!fs.existsSync(CONFIG_PATH)) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const token = config.channels?.slack?.botToken;

  if (!token) {
    return { success: false, error: 'Slack not configured. Use slack_setup first.' };
  }

  try {
    const response = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json() as any;

    if (!data.ok) {
      return {
        success: false,
        error: data.error,
      };
    }

    let channels = data.channels || [];
    if (includeMember) {
      channels = channels.filter((c: any) => c.is_member);
    }

    return {
      success: true,
      channels: channels.map((c: any) => ({
        id: c.id,
        name: c.name,
        isPrivate: c.is_private,
        isMember: c.is_member,
        numMembers: c.num_members,
      })),
      count: channels.length,
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to list channels' };
  }
};
