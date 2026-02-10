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
  telegramSendWithButtonsToolDefinition,
  telegramSendWithButtonsToolHandler,
  telegramReactToolDefinition,
  telegramReactToolHandler,
  telegramEditToolDefinition,
  telegramEditToolHandler,
  telegramDeleteToolDefinition,
  telegramDeleteToolHandler,
  telegramGetUpdatesToolDefinition,
  telegramGetUpdatesToolHandler,
  telegramGetChatIdToolDefinition,
  telegramGetChatIdToolHandler,
  telegramSetChatIdToolDefinition,
  telegramSetChatIdToolHandler,
} from './telegram-tools';

// WhatsApp Tools
export {
  whatsappStatusToolDefinition,
  whatsappStatusToolHandler,
  whatsappSetupToolDefinition,
  whatsappSetupToolHandler,
  whatsappSendToolDefinition,
  whatsappSendToolHandler,
  whatsappLogoutToolDefinition,
  whatsappLogoutToolHandler,
} from './whatsapp-tools';

// Discord Tools
export {
  discordSetupToolDefinition,
  discordSetupToolHandler,
  discordStatusToolDefinition,
  discordStatusToolHandler,
  discordSendToolDefinition,
  discordSendToolHandler,
  discordReactToolDefinition,
  discordReactToolHandler,
  discordEditToolDefinition,
  discordEditToolHandler,
  discordDeleteToolDefinition,
  discordDeleteToolHandler,
  discordListGuildsToolDefinition,
  discordListGuildsToolHandler,
} from './discord-tools';

// Slack Tools
export {
  slackSetupToolDefinition,
  slackSetupToolHandler,
  slackStatusToolDefinition,
  slackStatusToolHandler,
  slackSendToolDefinition,
  slackSendToolHandler,
  slackReactToolDefinition,
  slackReactToolHandler,
  slackEditToolDefinition,
  slackEditToolHandler,
  slackDeleteToolDefinition,
  slackDeleteToolHandler,
  slackListChannelsToolDefinition,
  slackListChannelsToolHandler,
} from './slack-tools';

// Memory Tools
export {
  memorySearchToolDefinition,
  memorySearchToolHandler,
  memoryGetToolDefinition,
  memoryGetToolHandler,
  memoryWriteToolDefinition,
  memoryWriteToolHandler,
  memoryUpdateToolDefinition,
  memoryUpdateToolHandler,
  memoryListToolDefinition,
  memoryListToolHandler,
} from './memory-tools';

// Session/Sub-Agent Tools
export {
  sessionSpawnToolDefinition,
  sessionSpawnToolHandler,
  sessionListToolDefinition,
  sessionListToolHandler,
  sessionSendToolDefinition,
  sessionSendToolHandler,
  sessionStatusToolDefinition,
  sessionStatusToolHandler,
  sessionCancelToolDefinition,
  sessionCancelToolHandler,
} from './session-tools';

// TTS (Text-to-Speech) Tools
export {
  ttsSpeakToolDefinition,
  ttsSpeakToolHandler,
  ttsVoicesToolDefinition,
  ttsVoicesToolHandler,
  ttsPlayToolDefinition,
  ttsPlayToolHandler,
} from './tts-tools';

// Cron Tools
export {
  cronListToolDefinition,
  cronListToolHandler,
  cronAddToolDefinition,
  cronAddToolHandler,
  cronRemoveToolDefinition,
  cronRemoveToolHandler,
  cronRunToolDefinition,
  cronRunToolHandler,
  cronEnableToolDefinition,
  cronEnableToolHandler,
  cronDisableToolDefinition,
  cronDisableToolHandler,
  cronStatusToolDefinition,
  cronStatusToolHandler,
  heartbeatTriggerToolDefinition,
  heartbeatTriggerToolHandler,
  cronHistoryToolDefinition,
  cronHistoryToolHandler,
  // Manager setters for gateway integration
  setCronManager,
  setHeartbeatManager,
  getCronManagerRef,
  getHeartbeatManagerRef,
} from './cron-tools';

// Canvas Tools
export {
  canvasPresentToolDefinition,
  canvasPresentToolHandler,
  canvasChartToolDefinition,
  canvasChartToolHandler,
  canvasPortfolioToolDefinition,
  canvasPortfolioToolHandler,
  canvasSignalsToolDefinition,
  canvasSignalsToolHandler,
  canvasTableToolDefinition,
  canvasTableToolHandler,
  canvasSnapshotToolDefinition,
  canvasSnapshotToolHandler,
  canvasHideToolDefinition,
  canvasHideToolHandler,
  canvasBackToolDefinition,
  canvasBackToolHandler,
  CANVAS_TOOLS,
  CANVAS_HANDLERS,
} from './canvas-tools';

// Browser Automation Tools
export {
  browserOpenToolDefinition,
  browserOpenToolHandler,
  browserNavigateToolDefinition,
  browserNavigateToolHandler,
  browserScreenshotToolDefinition,
  browserScreenshotToolHandler,
  browserSnapshotToolDefinition,
  browserSnapshotToolHandler,
  browserClickToolDefinition,
  browserClickToolHandler,
  browserTypeToolDefinition,
  browserTypeToolHandler,
  browserWaitToolDefinition,
  browserWaitToolHandler,
  browserCloseToolDefinition,
  browserCloseToolHandler,
  browserEvaluateToolDefinition,
  browserEvaluateToolHandler,
} from './browser-tools';

// Image Analysis Tools
export {
  imageAnalyzeToolDefinition,
  imageAnalyzeToolHandler,
  chartAnalyzeToolDefinition,
  chartAnalyzeToolHandler,
  screenshotAnalyzeToolDefinition,
  screenshotAnalyzeToolHandler,
} from './image-tools';

// Web Tools
export {
  webSearchToolDefinition,
  webSearchToolHandler,
  webFetchToolDefinition,
  webFetchToolHandler,
} from './web-tools';
