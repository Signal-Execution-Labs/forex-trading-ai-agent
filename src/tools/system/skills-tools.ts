/**
 * K.I.T. Skills Tools
 * Manage skills/channels like OpenClaw
 * 
 * Now with REAL skill discovery from /skills/ directory!
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ToolDefinition, ToolHandler } from './tool-registry';
import { discoverSkills, listSkillsWithStatus, getSkill, executeSkill, SkillInfo } from '../skill-bridge';

const CONFIG_DIR = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');
const SKILLS_DIR = path.join(CONFIG_DIR, 'skills');
const PROJECT_SKILLS_DIR = path.join(process.cwd(), 'skills');

// ============================================================================
// Available Skills
// ============================================================================

interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  category: 'channel' | 'trading' | 'analysis' | 'automation' | 'utility';
  configRequired: string[];
  envRequired?: string[];
}

const AVAILABLE_SKILLS: SkillDefinition[] = [
  // Channels
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Send and receive messages via Telegram bot',
    category: 'channel',
    configRequired: ['channels.telegram.credentials.token'],
    envRequired: [],
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Interact through Discord bot',
    category: 'channel',
    configRequired: ['channels.discord.credentials.token'],
    envRequired: [],
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp Business integration',
    category: 'channel',
    configRequired: ['channels.whatsapp.credentials.token'],
    envRequired: [],
  },
  
  // Trading
  {
    id: 'binance',
    name: 'Binance Trading',
    description: 'Trade on Binance exchange',
    category: 'trading',
    configRequired: ['exchanges.binance.credentials.apiKey', 'exchanges.binance.credentials.secret'],
    envRequired: [],
  },
  {
    id: 'mt5',
    name: 'MetaTrader 5',
    description: 'Trade forex/stocks via MT5',
    category: 'trading',
    configRequired: ['exchanges.mt5.credentials.login', 'exchanges.mt5.credentials.password', 'exchanges.mt5.credentials.server'],
    envRequired: [],
  },
  {
    id: 'coinbase',
    name: 'Coinbase Trading',
    description: 'Trade on Coinbase',
    category: 'trading',
    configRequired: ['exchanges.coinbase.credentials.apiKey', 'exchanges.coinbase.credentials.secret'],
    envRequired: [],
  },
  
  // Analysis
  {
    id: 'market-analysis',
    name: 'Market Analysis',
    description: 'Technical and fundamental market analysis',
    category: 'analysis',
    configRequired: [],
  },
  {
    id: 'portfolio-tracker',
    name: 'Portfolio Tracker',
    description: 'Track portfolio across all exchanges',
    category: 'analysis',
    configRequired: [],
  },
  {
    id: 'tax-tracker',
    name: 'Tax Tracker',
    description: 'Track trades for tax purposes',
    category: 'analysis',
    configRequired: [],
  },
  
  // Automation
  {
    id: 'auto-trader',
    name: 'Auto Trader',
    description: 'Automated trading based on strategies',
    category: 'automation',
    configRequired: ['trading.enabled'],
  },
  {
    id: 'alerts',
    name: 'Price Alerts',
    description: 'Set price alerts and notifications',
    category: 'automation',
    configRequired: [],
  },
  {
    id: 'scheduler',
    name: 'Task Scheduler',
    description: 'Schedule DCA, rebalancing, reports',
    category: 'automation',
    configRequired: [],
  },
  
  // Utility
  {
    id: 'defi',
    name: 'DeFi Connector',
    description: 'Connect to DeFi protocols (staking, lending)',
    category: 'utility',
    configRequired: [],
  },
  {
    id: 'backtester',
    name: 'Strategy Backtester',
    description: 'Backtest trading strategies',
    category: 'utility',
    configRequired: [],
  },
];

// ============================================================================
// Skills List Tool
// ============================================================================

export const skillsListToolDefinition: ToolDefinition = {
  name: 'skills_list',
  description: 'List all available skills (60+ Python skills + integrations) and their status. Shows implemented vs planned skills.',
  parameters: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['channel', 'trading', 'analysis', 'automation', 'utility', 'intelligence', 'all'],
        description: 'Filter by category',
      },
      source: {
        type: 'string',
        enum: ['all', 'python', 'integrations'],
        description: 'Filter by source: python (skills/), integrations (channels/exchanges), or all',
      },
    },
    required: [],
  },
};

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config: any): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
}

function getByPath(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current === undefined || current === null) return undefined;
    current = current[part];
  }
  return current;
}

function isSkillConfigured(skill: SkillDefinition, config: any): boolean {
  for (const req of skill.configRequired) {
    const value = getByPath(config, req);
    if (value === undefined || value === null || value === '') {
      return false;
    }
  }
  
  for (const envVar of skill.envRequired || []) {
    if (!process.env[envVar]) {
      return false;
    }
  }
  
  return true;
}

function isSkillEnabled(skill: SkillDefinition, config: any): boolean {
  // Check specific enable flags
  if (skill.category === 'channel') {
    return config.channels?.[skill.id]?.enabled ?? false;
  }
  if (skill.category === 'trading') {
    return config.exchanges?.[skill.id]?.enabled ?? false;
  }
  // Other skills are enabled by default if configured
  return isSkillConfigured(skill, config);
}

export const skillsListToolHandler: ToolHandler = async (args, context) => {
  const { category = 'all', source = 'all' } = args as { category?: string; source?: string };
  
  const config = loadConfig();
  
  // Integration skills (channels, exchanges, etc.)
  const integrationSkills = AVAILABLE_SKILLS
    .filter(s => category === 'all' || s.category === category)
    .map(skill => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      type: 'integration' as const,
      configured: isSkillConfigured(skill, config),
      enabled: isSkillEnabled(skill, config),
      configRequired: skill.configRequired,
      implementation: 'typescript',
    }));
  
  // Python skills from /skills/ directory
  const pythonSkillsData = listSkillsWithStatus(PROJECT_SKILLS_DIR);
  const pythonSkills = pythonSkillsData.skills
    .filter(s => category === 'all' || s.category === category)
    .map(skill => ({
      id: skill.slug,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      type: 'python_skill' as const,
      configured: true, // Python skills don't need config
      enabled: skill.hasImplementation,
      configRequired: [],
      implementation: skill.implementationType,
      emoji: skill.emoji,
      tier: skill.tier,
      toolName: skill.toolName,
      mainScript: skill.mainScript,
    }));
  
  // Combine based on source filter
  let allSkills: any[] = [];
  if (source === 'all' || source === 'integrations') {
    allSkills = [...allSkills, ...integrationSkills];
  }
  if (source === 'all' || source === 'python') {
    allSkills = [...allSkills, ...pythonSkills];
  }
  
  // Summary by category
  const byCategory: Record<string, any[]> = {};
  for (const skill of allSkills) {
    if (!byCategory[skill.category]) {
      byCategory[skill.category] = [];
    }
    byCategory[skill.category].push(skill);
  }
  
  return {
    total: allSkills.length,
    configured: allSkills.filter(s => s.configured).length,
    enabled: allSkills.filter(s => s.enabled).length,
    integrations: integrationSkills.length,
    pythonSkills: pythonSkills.length,
    implemented: pythonSkills.filter(s => s.implementation !== 'planned').length,
    planned: pythonSkills.filter(s => s.implementation === 'planned').length,
    byCategory,
    skills: allSkills,
  };
};

// ============================================================================
// Skills Enable Tool
// ============================================================================

export const skillsEnableToolDefinition: ToolDefinition = {
  name: 'skills_enable',
  description: 'Enable a skill. Will check if required configuration is present.',
  parameters: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'Skill ID to enable (e.g., "telegram", "binance")',
      },
    },
    required: ['skill'],
  },
};

export const skillsEnableToolHandler: ToolHandler = async (args, context) => {
  const { skill: skillId } = args as { skill: string };
  
  const skill = AVAILABLE_SKILLS.find(s => s.id === skillId);
  if (!skill) {
    return {
      success: false,
      error: `Unknown skill: ${skillId}`,
      availableSkills: AVAILABLE_SKILLS.map(s => s.id),
    };
  }
  
  const config = loadConfig();
  
  // Check if configured
  if (!isSkillConfigured(skill, config)) {
    const missing = skill.configRequired.filter(req => {
      const value = getByPath(config, req);
      return value === undefined || value === null || value === '';
    });
    
    return {
      success: false,
      error: 'Skill not fully configured',
      skill: skill.name,
      missingConfig: missing,
      hint: `Use config_set to add the missing configuration values.`,
    };
  }
  
  // Enable the skill
  if (skill.category === 'channel') {
    if (!config.channels) config.channels = {};
    if (!config.channels[skillId]) config.channels[skillId] = { type: skillId };
    config.channels[skillId].enabled = true;
  } else if (skill.category === 'trading') {
    if (!config.exchanges) config.exchanges = {};
    if (!config.exchanges[skillId]) config.exchanges[skillId] = { type: skillId };
    config.exchanges[skillId].enabled = true;
  }
  
  saveConfig(config);
  
  return {
    success: true,
    skill: skill.name,
    enabled: true,
    message: `${skill.name} is now enabled!`,
  };
};

// ============================================================================
// Skills Disable Tool
// ============================================================================

export const skillsDisableToolDefinition: ToolDefinition = {
  name: 'skills_disable',
  description: 'Disable a skill',
  parameters: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'Skill ID to disable',
      },
    },
    required: ['skill'],
  },
};

export const skillsDisableToolHandler: ToolHandler = async (args, context) => {
  const { skill: skillId } = args as { skill: string };
  
  const skill = AVAILABLE_SKILLS.find(s => s.id === skillId);
  if (!skill) {
    return { success: false, error: `Unknown skill: ${skillId}` };
  }
  
  const config = loadConfig();
  
  if (skill.category === 'channel' && config.channels?.[skillId]) {
    config.channels[skillId].enabled = false;
  } else if (skill.category === 'trading' && config.exchanges?.[skillId]) {
    config.exchanges[skillId].enabled = false;
  }
  
  saveConfig(config);
  
  return {
    success: true,
    skill: skill.name,
    enabled: false,
    message: `${skill.name} is now disabled.`,
  };
};

// ============================================================================
// Skills Setup Tool - Interactive setup guide
// ============================================================================

export const skillsSetupToolDefinition: ToolDefinition = {
  name: 'skills_setup',
  description: 'Get setup instructions for a skill',
  parameters: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'Skill ID to get setup instructions for',
      },
    },
    required: ['skill'],
  },
};

const SETUP_INSTRUCTIONS: Record<string, { steps: string[]; example: any }> = {
  telegram: {
    steps: [
      '1. Open Telegram and search for @BotFather',
      '2. Send /newbot to create a new bot',
      '3. Follow the prompts to name your bot',
      '4. Copy the bot token provided',
      '5. Provide the token to me and I will configure it',
    ],
    example: {
      configPath: 'channels.telegram',
      configValue: {
        type: 'telegram',
        enabled: true,
        credentials: { token: 'YOUR_BOT_TOKEN' },
      },
    },
  },
  discord: {
    steps: [
      '1. Go to https://discord.com/developers/applications',
      '2. Click "New Application" and give it a name',
      '3. Go to the "Bot" section',
      '4. Click "Add Bot" and confirm',
      '5. Copy the bot token',
      '6. Enable "Message Content Intent" in Bot settings',
      '7. Use the OAuth2 URL Generator to invite the bot to your server',
    ],
    example: {
      configPath: 'channels.discord',
      configValue: {
        type: 'discord',
        enabled: true,
        credentials: { token: 'YOUR_BOT_TOKEN' },
      },
    },
  },
  binance: {
    steps: [
      '1. Log into Binance',
      '2. Go to API Management (Account > API Management)',
      '3. Create a new API key',
      '4. Enable "Spot & Margin Trading" permission',
      '5. For safety, restrict IP access if possible',
      '6. Save both the API Key and Secret Key',
    ],
    example: {
      configPath: 'exchanges.binance',
      configValue: {
        type: 'crypto',
        enabled: true,
        sandbox: true, // Start with testnet!
        credentials: {
          apiKey: 'YOUR_API_KEY',
          secret: 'YOUR_SECRET_KEY',
        },
      },
    },
  },
  mt5: {
    steps: [
      '1. Open MetaTrader 5',
      '2. Go to Tools > Options > Expert Advisors',
      '3. Enable "Allow algorithmic trading"',
      '4. Note your MT5 login number and server',
      '5. Provide login, password, and server to me',
    ],
    example: {
      configPath: 'exchanges.mt5',
      configValue: {
        type: 'mt5',
        enabled: true,
        credentials: {
          login: 'YOUR_LOGIN',
          password: 'YOUR_PASSWORD',
          server: 'YOUR_BROKER_SERVER',
        },
      },
    },
  },
};

export const skillsSetupToolHandler: ToolHandler = async (args, context) => {
  const { skill: skillId } = args as { skill: string };
  
  const skill = AVAILABLE_SKILLS.find(s => s.id === skillId);
  if (!skill) {
    return { success: false, error: `Unknown skill: ${skillId}` };
  }
  
  const instructions = SETUP_INSTRUCTIONS[skillId];
  
  return {
    skill: skill.name,
    description: skill.description,
    category: skill.category,
    configRequired: skill.configRequired,
    instructions: instructions?.steps || [
      `No specific setup instructions for ${skill.name}.`,
      `Required config: ${skill.configRequired.join(', ') || 'None'}`,
    ],
    example: instructions?.example || null,
  };
};

// ============================================================================
// Skill Run Tool - Execute Python skills directly
// ============================================================================

export const skillRunToolDefinition: ToolDefinition = {
  name: 'skill_run',
  description: 'Execute a Python skill from /skills/ directory. Use skills_list to see available skills.',
  parameters: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'Skill name or slug (e.g., "smart-router", "arbitrage-finder", "whale-tracker")',
      },
      action: {
        type: 'string',
        description: 'Action to perform (depends on skill)',
      },
      symbol: {
        type: 'string',
        description: 'Trading symbol (e.g., "BTC/USDT")',
      },
      amount: {
        type: 'number',
        description: 'Amount for operation',
      },
      params: {
        type: 'object',
        description: 'Additional parameters as JSON object',
      },
    },
    required: ['skill'],
  },
};

export const skillRunToolHandler: ToolHandler = async (args, context) => {
  const { skill: skillName, ...skillArgs } = args as { skill: string; [key: string]: any };
  
  // Find the skill
  const skill = getSkill(skillName, PROJECT_SKILLS_DIR);
  
  if (!skill) {
    // List available skills
    const allSkills = discoverSkills(PROJECT_SKILLS_DIR);
    const implementedSkills = allSkills
      .filter(s => s.hasImplementation)
      .map(s => `${s.emoji} ${s.slug}`);
    
    return {
      success: false,
      error: `Unknown skill: ${skillName}`,
      hint: 'Use skills_list to see all available skills',
      implementedSkills: implementedSkills.slice(0, 20),
      totalAvailable: implementedSkills.length,
    };
  }
  
  if (!skill.hasImplementation) {
    return {
      success: false,
      error: `Skill "${skill.name}" is planned but not yet implemented`,
      skill: skill.name,
      status: 'planned',
    };
  }
  
  // Execute the skill
  const result = await executeSkill(skill, skillArgs);
  
  return {
    skill: skill.name,
    toolName: skill.toolName,
    emoji: skill.emoji,
    ...result,
  };
};

// ============================================================================
// Skill Info Tool - Get detailed info about a specific skill
// ============================================================================

export const skillInfoToolDefinition: ToolDefinition = {
  name: 'skill_info',
  description: 'Get detailed information about a specific Python skill',
  parameters: {
    type: 'object',
    properties: {
      skill: {
        type: 'string',
        description: 'Skill name or slug',
      },
    },
    required: ['skill'],
  },
};

export const skillInfoToolHandler: ToolHandler = async (args, context) => {
  const { skill: skillName } = args as { skill: string };
  
  const skill = getSkill(skillName, PROJECT_SKILLS_DIR);
  
  if (!skill) {
    return {
      success: false,
      error: `Unknown skill: ${skillName}`,
    };
  }
  
  // Read SKILL.md for full documentation
  let documentation = '';
  if (fs.existsSync(skill.skillMdPath)) {
    documentation = fs.readFileSync(skill.skillMdPath, 'utf8');
    // Truncate if too long
    if (documentation.length > 4000) {
      documentation = documentation.substring(0, 4000) + '\n\n... (truncated)';
    }
  }
  
  return {
    name: skill.name,
    slug: skill.slug,
    toolName: skill.toolName,
    emoji: skill.emoji,
    description: skill.description,
    category: skill.category,
    tier: skill.tier,
    implementation: skill.implementationType,
    mainScript: skill.mainScript,
    scriptPath: skill.scriptPath,
    hasImplementation: skill.hasImplementation,
    documentation,
  };
};
