/**
 * K.I.T. Config Tools
 * Manage configuration like OpenClaw
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

// ============================================================================
// Config Get Tool
// ============================================================================

export const configGetToolDefinition: ToolDefinition = {
  name: 'config_get',
  description: 'Get configuration value(s). Use path notation like "trading.mode" or leave empty for full config.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Dot-notation path to config value (e.g., "trading.mode", "user.name")',
      },
    },
    required: [],
  },
};

export const configGetToolHandler: ToolHandler = async (args) => {
  const { path: configPath } = args as { path?: string };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Config not found. Run "kit onboard" first.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  if (!configPath) {
    return {
      success: true,
      config,
    };
  }

  // Navigate to the requested path
  const parts = configPath.split('.');
  let value: any = config;

  for (const part of parts) {
    if (value === undefined || value === null) {
      return {
        success: false,
        error: `Path not found: ${configPath}`,
      };
    }
    value = value[part];
  }

  return {
    success: true,
    path: configPath,
    value,
  };
};

// ============================================================================
// Config Set Tool
// ============================================================================

export const configSetToolDefinition: ToolDefinition = {
  name: 'config_set',
  description: 'Set a configuration value. Use path notation like "trading.mode".',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Dot-notation path to set (e.g., "trading.autoTrade")',
      },
      value: {
        type: 'string',
        description: 'Value to set (string, number, boolean, or JSON)',
      },
    },
    required: ['path', 'value'],
  },
};

export const configSetToolHandler: ToolHandler = async (args) => {
  const { path: configPath, value } = args as { path: string; value: any };

  // Ensure directory exists
  if (!fs.existsSync(KIT_HOME)) {
    fs.mkdirSync(KIT_HOME, { recursive: true });
  }

  // Load existing config or create new
  let config: any = {};
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }

  // Navigate and set the value
  const parts = configPath.split('.');
  let current = config;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      current[part] = {};
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  const oldValue = current[lastPart];
  current[lastPart] = value;

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  return {
    success: true,
    path: configPath,
    oldValue,
    newValue: value,
  };
};

// ============================================================================
// Config Delete Tool
// ============================================================================

export const configDeleteToolDefinition: ToolDefinition = {
  name: 'config_delete',
  description: 'Delete a configuration value or section.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Dot-notation path to delete',
      },
    },
    required: ['path'],
  },
};

export const configDeleteToolHandler: ToolHandler = async (args) => {
  const { path: configPath } = args as { path: string };

  if (!fs.existsSync(CONFIG_PATH)) {
    return {
      success: false,
      error: 'Config not found.',
    };
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // Navigate to parent and delete
  const parts = configPath.split('.');
  let current = config;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current)) {
      return {
        success: false,
        error: `Path not found: ${configPath}`,
      };
    }
    current = current[part];
  }

  const lastPart = parts[parts.length - 1];
  if (!(lastPart in current)) {
    return {
      success: false,
      error: `Key not found: ${lastPart}`,
    };
  }

  const oldValue = current[lastPart];
  delete current[lastPart];

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

  return {
    success: true,
    path: configPath,
    deletedValue: oldValue,
  };
};

// ============================================================================
// Env Set Tool
// ============================================================================

export const envSetToolDefinition: ToolDefinition = {
  name: 'env_set',
  description: 'Set an environment variable for the current session.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Environment variable name',
      },
      value: {
        type: 'string',
        description: 'Value to set',
      },
    },
    required: ['name', 'value'],
  },
};

export const envSetToolHandler: ToolHandler = async (args) => {
  const { name, value } = args as { name: string; value: string };

  process.env[name] = value;

  return {
    success: true,
    name,
    value: value.length > 8 ? value.slice(0, 4) + '****' : '****',
  };
};

// ============================================================================
// Status Tool
// ============================================================================

export const statusToolDefinition: ToolDefinition = {
  name: 'status',
  description: 'Get K.I.T. system status including config, connections, and active skills.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const statusToolHandler: ToolHandler = async (args, context: ToolContext) => {
  const configExists = fs.existsSync(CONFIG_PATH);
  const workspaceExists = fs.existsSync(context.workspaceDir);
  
  let config: any = null;
  let userProfile: any = null;
  let enabledSkills: string[] = [];
  let enabledExchanges: string[] = [];
  let enabledChannels: string[] = [];

  if (configExists) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    userProfile = config.user;
    
    if (config.skills) {
      enabledSkills = Object.entries(config.skills)
        .filter(([_, v]: [string, any]) => v?.enabled)
        .map(([k, _]) => k);
    }
    
    if (config.exchanges) {
      enabledExchanges = Object.entries(config.exchanges)
        .filter(([_, v]: [string, any]) => v?.enabled)
        .map(([k, _]) => k);
    }
    
    if (config.channels) {
      enabledChannels = Object.entries(config.channels)
        .filter(([_, v]: [string, any]) => v?.enabled)
        .map(([k, _]) => k);
    }
  }

  return {
    version: config?.version || '1.0.0',
    onboarded: config?.onboarded ?? false,
    configPath: CONFIG_PATH,
    workspacePath: context.workspaceDir,
    
    config: {
      exists: configExists,
    },
    
    workspace: {
      exists: workspaceExists,
      files: workspaceExists ? fs.readdirSync(context.workspaceDir) : [],
    },
    
    user: userProfile ? {
      name: userProfile.callName || userProfile.name,
      timezone: userProfile.timezone,
      experience: userProfile.tradingExperience,
      riskTolerance: userProfile.riskTolerance,
      markets: userProfile.preferredMarkets,
    } : null,
    
    ai: config?.ai ? {
      provider: config.ai.defaultProvider || config.ai.provider,
      hasApiKey: !!(config.ai.apiKey || config.ai.providers?.[config.ai.defaultProvider]?.apiKey),
    } : null,
    
    trading: config?.trading ? {
      mode: config.trading.mode,
      autoTrade: config.trading.autoTrade,
      maxRiskPercent: config.trading.maxRiskPercent,
    } : null,
    
    skills: {
      enabled: enabledSkills,
      count: enabledSkills.length,
    },
    
    exchanges: {
      enabled: enabledExchanges,
      count: enabledExchanges.length,
    },
    
    channels: {
      enabled: enabledChannels,
      count: enabledChannels.length,
    },
  };
};

// ============================================================================
// Get User Profile Tool
// ============================================================================

export const userProfileToolDefinition: ToolDefinition = {
  name: 'user_profile',
  description: 'Get the user profile from USER.md and config.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const userProfileToolHandler: ToolHandler = async (args, context: ToolContext) => {
  const userMdPath = path.join(context.workspaceDir, 'USER.md');

  const result: any = {
    success: true,
    profile: null,
    userMd: null,
  };

  // Try config first
  if (fs.existsSync(CONFIG_PATH)) {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    result.profile = config.user;
  }

  // Also read USER.md
  if (fs.existsSync(userMdPath)) {
    result.userMd = fs.readFileSync(userMdPath, 'utf8');
  }

  if (!result.profile && !result.userMd) {
    result.success = false;
    result.error = 'User profile not found. Run "kit onboard" to create it.';
  }

  return result;
};
