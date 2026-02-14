/**
 * Model Failover Service
 * 
 * Handles auth profile rotation and model fallback when primary fails.
 * OpenClaw-compatible failover for K.I.T.
 */

import { createLogger } from './logger';

const logger = createLogger('failover');

export interface AuthProfile {
  id: string;
  provider: string;
  type: 'api_key' | 'oauth';
  key?: string;
  email?: string;
  accessToken?: string;
  refreshToken?: string;
  expires?: number;
  lastUsed?: number;
  cooldownUntil?: number;
  disabled?: boolean;
  usageStats?: {
    requests: number;
    failures: number;
    lastUsed: number;
    lastFailure?: number;
  };
}

export interface ModelConfig {
  primary: string;
  fallbacks?: string[];
  provider?: string;
}

export interface FailoverConfig {
  enabled: boolean;
  maxRetries: number;
  cooldownMs: number; // How long to sideline a failing profile
  rotateOnRateLimit: boolean;
  rotateOnTimeout: boolean;
  sessionSticky: boolean; // Pin profile per session
}

export interface FailoverState {
  currentModel: string;
  currentProfile?: string;
  fallbackIndex: number;
  rotationIndex: number;
  sessionId?: string;
}

const DEFAULT_CONFIG: FailoverConfig = {
  enabled: true,
  maxRetries: 3,
  cooldownMs: 60000, // 1 minute cooldown
  rotateOnRateLimit: true,
  rotateOnTimeout: true,
  sessionSticky: true,
};

export class ModelFailoverService {
  private config: FailoverConfig;
  private profiles: Map<string, AuthProfile[]> = new Map(); // provider -> profiles
  private state: FailoverState;
  private modelConfig: ModelConfig;

  constructor(modelConfig: ModelConfig, config?: Partial<FailoverConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.modelConfig = modelConfig;
    this.state = {
      currentModel: modelConfig.primary,
      fallbackIndex: -1,
      rotationIndex: 0,
    };
  }

  /**
   * Register auth profiles for a provider
   */
  registerProfiles(provider: string, profiles: AuthProfile[]): void {
    this.profiles.set(provider, profiles);
    logger.debug(`Registered ${profiles.length} profiles for ${provider}`);
  }

  /**
   * Get available (non-cooldown) profiles for a provider
   */
  getAvailableProfiles(provider: string): AuthProfile[] {
    const profiles = this.profiles.get(provider) || [];
    const now = Date.now();
    
    return profiles
      .filter(p => !p.disabled && (!p.cooldownUntil || p.cooldownUntil < now))
      .sort((a, b) => {
        // OAuth before API keys
        if (a.type !== b.type) {
          return a.type === 'oauth' ? -1 : 1;
        }
        // Oldest used first
        return (a.lastUsed || 0) - (b.lastUsed || 0);
      });
  }

  /**
   * Get the next profile to try (round-robin within available)
   */
  getNextProfile(provider: string): AuthProfile | undefined {
    const available = this.getAvailableProfiles(provider);
    if (available.length === 0) return undefined;

    const profile = available[this.state.rotationIndex % available.length];
    this.state.rotationIndex++;
    
    return profile;
  }

  /**
   * Pin a profile to the current session
   */
  pinProfile(profileId: string, sessionId: string): void {
    this.state.currentProfile = profileId;
    this.state.sessionId = sessionId;
    logger.info(`Pinned profile ${profileId} to session ${sessionId}`);
  }

  /**
   * Put a profile in cooldown after failure
   */
  cooldownProfile(profileId: string): void {
    for (const [, profiles] of this.profiles) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        profile.cooldownUntil = Date.now() + this.config.cooldownMs;
        profile.usageStats = profile.usageStats || { requests: 0, failures: 0, lastUsed: 0 };
        profile.usageStats.failures++;
        profile.usageStats.lastFailure = Date.now();
        logger.warn(`Profile ${profileId} in cooldown until ${new Date(profile.cooldownUntil).toISOString()}`);
        break;
      }
    }
  }

  /**
   * Mark a profile as successfully used
   */
  markProfileUsed(profileId: string): void {
    for (const [, profiles] of this.profiles) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        profile.lastUsed = Date.now();
        profile.usageStats = profile.usageStats || { requests: 0, failures: 0, lastUsed: 0 };
        profile.usageStats.requests++;
        profile.usageStats.lastUsed = Date.now();
        break;
      }
    }
  }

  /**
   * Get the current model (primary or fallback)
   */
  getCurrentModel(): string {
    return this.state.currentModel;
  }

  /**
   * Try to fall back to next model
   */
  fallbackToNextModel(): string | undefined {
    if (!this.modelConfig.fallbacks || this.modelConfig.fallbacks.length === 0) {
      logger.warn('No fallback models configured');
      return undefined;
    }

    this.state.fallbackIndex++;
    if (this.state.fallbackIndex >= this.modelConfig.fallbacks.length) {
      logger.error('All fallback models exhausted');
      return undefined;
    }

    this.state.currentModel = this.modelConfig.fallbacks[this.state.fallbackIndex];
    this.state.rotationIndex = 0; // Reset rotation for new model
    
    logger.info(`Falling back to model: ${this.state.currentModel}`);
    return this.state.currentModel;
  }

  /**
   * Reset to primary model (e.g., on new session)
   */
  reset(): void {
    this.state = {
      currentModel: this.modelConfig.primary,
      fallbackIndex: -1,
      rotationIndex: 0,
    };
    logger.info('Failover state reset');
  }

  /**
   * Handle an error and decide next action
   */
  handleError(error: Error | { code?: string; status?: number; message?: string }): {
    action: 'retry' | 'rotate' | 'fallback' | 'abort';
    model?: string;
    profile?: AuthProfile;
  } {
    const code = 'code' in error ? error.code : undefined;
    const status = 'status' in error ? error.status : undefined;
    const message = error.message || '';

    // Rate limit
    if (status === 429 || code === 'rate_limit' || message.includes('rate limit')) {
      if (this.config.rotateOnRateLimit) {
        // Try to rotate to another profile
        const provider = this.getProviderFromModel(this.state.currentModel);
        if (this.state.currentProfile) {
          this.cooldownProfile(this.state.currentProfile);
        }
        const nextProfile = this.getNextProfile(provider);
        if (nextProfile) {
          logger.info('Rotating to next profile due to rate limit');
          return { action: 'rotate', profile: nextProfile };
        }
      }
      // No more profiles, try fallback model
      const fallback = this.fallbackToNextModel();
      if (fallback) {
        return { action: 'fallback', model: fallback };
      }
      return { action: 'abort' };
    }

    // Timeout
    if (code === 'ETIMEDOUT' || code === 'timeout' || message.includes('timeout')) {
      if (this.config.rotateOnTimeout) {
        return { action: 'retry' };
      }
    }

    // Auth error - disable profile
    if (status === 401 || status === 403 || code === 'invalid_api_key') {
      if (this.state.currentProfile) {
        this.disableProfile(this.state.currentProfile);
      }
      const provider = this.getProviderFromModel(this.state.currentModel);
      const nextProfile = this.getNextProfile(provider);
      if (nextProfile) {
        return { action: 'rotate', profile: nextProfile };
      }
      return { action: 'abort' };
    }

    // Server error - retry then fallback
    if (status && status >= 500) {
      return { action: 'retry' };
    }

    return { action: 'abort' };
  }

  /**
   * Disable a profile permanently (until manual re-enable)
   */
  private disableProfile(profileId: string): void {
    for (const [, profiles] of this.profiles) {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        profile.disabled = true;
        logger.error(`Profile ${profileId} disabled due to auth error`);
        break;
      }
    }
  }

  /**
   * Extract provider from model string
   */
  private getProviderFromModel(model: string): string {
    if (model.includes('/')) {
      return model.split('/')[0];
    }
    // Infer from model name
    if (model.includes('gpt') || model.includes('o1') || model.includes('o3')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('gemini')) return 'google';
    if (model.includes('llama') || model.includes('mistral')) return 'groq';
    return 'openai'; // default
  }

  /**
   * Get failover stats
   */
  getStats(): {
    currentModel: string;
    currentProfile?: string;
    fallbackIndex: number;
    profilesByProvider: Record<string, { total: number; available: number; inCooldown: number }>;
  } {
    const profilesByProvider: Record<string, { total: number; available: number; inCooldown: number }> = {};
    const now = Date.now();

    for (const [provider, profiles] of this.profiles) {
      const available = profiles.filter(p => !p.disabled && (!p.cooldownUntil || p.cooldownUntil < now));
      const inCooldown = profiles.filter(p => p.cooldownUntil && p.cooldownUntil >= now);
      profilesByProvider[provider] = {
        total: profiles.length,
        available: available.length,
        inCooldown: inCooldown.length,
      };
    }

    return {
      currentModel: this.state.currentModel,
      currentProfile: this.state.currentProfile,
      fallbackIndex: this.state.fallbackIndex,
      profilesByProvider,
    };
  }
}

export function createModelFailover(modelConfig: ModelConfig, config?: Partial<FailoverConfig>): ModelFailoverService {
  return new ModelFailoverService(modelConfig, config);
}
