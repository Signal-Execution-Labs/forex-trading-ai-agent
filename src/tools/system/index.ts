/**
 * K.I.T. System Tools
 * OpenClaw-style tool system for autonomous agent operations
 * 
 * Tools:
 * - read: Read file contents
 * - write: Write/create files
 * - edit: Edit files with search/replace
 * - exec: Execute shell commands
 * - config: Manage K.I.T. configuration
 * - skills: Manage skills/channels
 * - onboarding: Interactive setup wizard
 */

// Tool Registry
export {
  ToolRegistry,
  ToolDefinition,
  ToolHandler,
  ToolContext,
  RegisteredTool,
  createDefaultToolRegistry,
  getToolRegistry,
} from './tool-registry';

// File Tools
export {
  readToolDefinition,
  readToolHandler,
  writeToolDefinition,
  writeToolHandler,
  editToolDefinition,
  editToolHandler,
  listToolDefinition,
  listToolHandler,
} from './file-tools';

// Exec Tools
export {
  execToolDefinition,
  execToolHandler,
  processToolDefinition,
  processToolHandler,
} from './exec-tools';

// Config Tools
export {
  configGetToolDefinition,
  configGetToolHandler,
  configSetToolDefinition,
  configSetToolHandler,
  configDeleteToolDefinition,
  configDeleteToolHandler,
  envSetToolDefinition,
  envSetToolHandler,
  statusToolDefinition,
  statusToolHandler,
  userProfileToolDefinition,
  userProfileToolHandler,
} from './config-tools';

// Skills Tools
export {
  skillsListToolDefinition,
  skillsListToolHandler,
  skillsEnableToolDefinition,
  skillsEnableToolHandler,
  skillsDisableToolDefinition,
  skillsDisableToolHandler,
  skillsSetupToolDefinition,
  skillsSetupToolHandler,
} from './skills-tools';

// Onboarding Tools
export {
  onboardingStartToolDefinition,
  onboardingStartToolHandler,
  onboardingContinueToolDefinition,
  onboardingContinueToolHandler,
  onboardingStatusToolDefinition,
  onboardingStatusToolHandler,
} from './onboarding';

// Telegram Tools
export {
  telegramSetupToolDefinition,
  telegramSetupToolHandler,
  telegramStatusToolDefinition,
  telegramStatusToolHandler,
  telegramSendToolDefinition,
  telegramSendToolHandler,
  telegramGetUpdatesToolDefinition,
  telegramGetUpdatesToolHandler,
} from './telegram-tools';
