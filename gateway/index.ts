/**
 * K.I.T. Gateway - Main Export
 * 
 * The complete autonomous trading framework.
 */

// Core Gateway
export { Gateway, GatewayConfig } from './server';

// Skills & Tools
export { SkillLoader, SkillMetadata, LoadedSkill } from './skill-loader';
export { ToolRegistry, ToolDefinition, ToolInfo, createDefaultTools } from './tool-registry';

// Auto-Pilot (Autonomous Trading)
export { 
  AutoPilot, 
  AutoPilotConfig, 
  AutoPilotMode,
  Decision,
  DecisionType,
  DecisionStatus,
  RiskState,
  defaultAutoPilotConfig 
} from './autopilot';

// Scheduler (Automated Tasks)
export {
  Scheduler,
  ScheduledTask,
  TaskFrequency,
  TaskStatus,
  TaskResult,
  TaskTemplates
} from './scheduler';

// Protocol
export * from './protocol';
