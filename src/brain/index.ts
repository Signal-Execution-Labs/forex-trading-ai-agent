/**
 * K.I.T. AI Brain
 * 
 * The Autonomous Decision Engine - the heart of K.I.T.
 * Implements the vision: "One AI. All your finances. Fully autonomous."
 * 
 * @see VISION.md
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/17
 */

export { GoalParser, type UserGoal, type GoalConfig } from './goal-parser';
export { DecisionEngine, type Decision, type MarketOpportunity } from './decision-engine';
export { AutonomyManager, type AutonomyConfig, type AutonomyLevel } from './autonomy-manager';
export { BrainCore, type BrainConfig, type BrainState } from './brain-core';

// Re-export for convenience
export * from './types';
