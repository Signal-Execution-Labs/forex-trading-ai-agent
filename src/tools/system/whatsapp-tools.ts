/**
 * K.I.T. WhatsApp Tools
 * Setup and manage WhatsApp connection via Baileys
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');
const WHATSAPP_AUTH_DIR = path.join(KIT_HOME, 'credentials', 'whatsapp');

// ============================================================================
// WhatsApp Status Tool
// ============================================================================

export const whatsappStatusToolDefinition: ToolDefinition = {
  name: 'whatsapp_status',
  description: 'Check WhatsApp connection status and whether login is needed.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const whatsappStatusToolHandler: ToolHandler = async () => {
  const credsPath = path.join(WHATSAPP_AUTH_DIR, 'creds.json');
  const hasCredentials = fs.existsSync(credsPath);

  let config: any = {};
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }

  const whatsapp = config.channels?.whatsapp;

  return {
    success: true,
    configured: !!whatsapp?.enabled,
    hasCredentials,
    connectedAt: whatsapp?.connectedAt,
    allowedNumbers: whatsapp?.allowedNumbers || [],
    message: hasCredentials
      ? 'WhatsApp credentials found. K.I.T. will connect automatically on start.'
      : 'WhatsApp not logged in. Use whatsapp_login to scan QR code.',
    nextSteps: hasCredentials
      ? ['WhatsApp is ready! Restart K.I.T. to connect.']
      : [
          '1. Run: kit whatsapp login (in terminal)',
          '2. Scan QR code with WhatsApp on phone',
          '3. Restart K.I.T. gateway',
        ],
  };
};

// ============================================================================
// WhatsApp Setup Tool
// ============================================================================

export const whatsappSetupToolDefinition: ToolDefinition = {
  name: 'whatsapp_setup',
  description: 'Configure WhatsApp settings like allowed numbers. Use whatsapp_login CLI command to scan QR.',
  parameters: {
    type: 'object',
    properties: {
      allowedNumbers: {
        type: 'string',
        description: 'Comma-separated phone numbers to allow (E.164 format: +1234567890)',
      },
      selfChatMode: {
        type: 'string',
        description: 'Set to "true" if using your personal WhatsApp number',
      },
    },
    required: [],
  },
};

export const whatsappSetupToolHandler: ToolHandler = async (args) => {
  const { allowedNumbers, selfChatMode } = args as { 
    allowedNumbers?: string; 
    selfChatMode?: string;
  };

  // Ensure config directory exists
  if (!fs.existsSync(KIT_HOME)) {
    fs.mkdirSync(KIT_HOME, { recursive: true });
  }

  // Load existing config
  let config: any = {};
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }

  // Update WhatsApp config
  if (!config.channels) config.channels = {};
  if (!config.channels.whatsapp) config.channels.whatsapp = {};

  if (allowedNumbers) {
    config.channels.whatsapp.allowedNumbers = allowedNumbers
      .split(',')
      .map((n: string) => n.trim())
      .filter((n: string) => n.length > 0);
  }

  if (selfChatMode !== undefined) {
    config.channels.whatsapp.selfChatMode = selfChatMode === 'true';
  }

  config.channels.whatsapp.enabled = true;
  config.channels.whatsapp.updatedAt = new Date().toISOString();

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  const credsPath = path.join(WHATSAPP_AUTH_DIR, 'creds.json');
  const hasCredentials = fs.existsSync(credsPath);

  return {
    success: true,
    message: 'WhatsApp settings saved!',
    config: {
      allowedNumbers: config.channels.whatsapp.allowedNumbers,
      selfChatMode: config.channels.whatsapp.selfChatMode,
    },
    hasCredentials,
    nextSteps: hasCredentials
      ? ['Restart K.I.T. to apply changes.']
      : [
          'Now login to WhatsApp:',
          '1. Open terminal on the K.I.T. server',
          '2. Run: kit whatsapp login',
          '3. Scan QR code with WhatsApp → Linked Devices',
          '4. Restart K.I.T. gateway',
        ],
  };
};

// ============================================================================
// WhatsApp Send Tool
// ============================================================================

export const whatsappSendToolDefinition: ToolDefinition = {
  name: 'whatsapp_send',
  description: 'Send a WhatsApp message (requires active connection).',
  parameters: {
    type: 'object',
    properties: {
      phone: {
        type: 'string',
        description: 'Phone number in E.164 format (+1234567890) or chat JID',
      },
      message: {
        type: 'string',
        description: 'Message text to send',
      },
    },
    required: ['phone', 'message'],
  },
};

export const whatsappSendToolHandler: ToolHandler = async (args) => {
  const { phone, message } = args as { phone: string; message: string };

  // Note: This tool can only indicate intent - actual sending requires
  // the gateway to be running with an active WhatsApp connection
  return {
    success: false,
    error: 'WhatsApp send requires active gateway connection. Use the CLI or dashboard.',
    note: 'This tool will work when called from within an active K.I.T. session with WhatsApp connected.',
    target: phone,
    message: message,
  };
};

// ============================================================================
// WhatsApp Logout Tool
// ============================================================================

export const whatsappLogoutToolDefinition: ToolDefinition = {
  name: 'whatsapp_logout',
  description: 'Logout from WhatsApp and delete credentials. You will need to scan QR again.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const whatsappLogoutToolHandler: ToolHandler = async () => {
  try {
    if (fs.existsSync(WHATSAPP_AUTH_DIR)) {
      fs.rmSync(WHATSAPP_AUTH_DIR, { recursive: true });
    }

    // Update config
    if (fs.existsSync(CONFIG_PATH)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      if (config.channels?.whatsapp) {
        config.channels.whatsapp.enabled = false;
        config.channels.whatsapp.connectedAt = null;
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
      }
    }

    return {
      success: true,
      message: 'WhatsApp logged out and credentials deleted.',
      nextSteps: ['Run "kit whatsapp login" to reconnect.'],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Logout failed',
    };
  }
};
