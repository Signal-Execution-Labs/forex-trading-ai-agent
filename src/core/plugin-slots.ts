/**
 * K.I.T. Plugin Slots System
 * 
 * OpenClaw-style plugin slots for swappable components.
 * Allows replacing core functionality with alternative implementations.
 * 
 * Example: plugins.slots.memory = "memory-lancedb" to use LanceDB memory
 */

import { createLogger } from './logger';

const logger = createLogger('plugin-slots');

// ============================================================================
// Types
// ============================================================================

export type SlotName = 
  | 'memory'           // Memory/recall system
  | 'portfolio'        // Portfolio tracking
  | 'signals'          // Signal generation
  | 'risk'             // Risk management
  | 'notifications'    // Alert delivery
  | 'data'             // Market data provider
  | 'execution'        // Order execution
  | 'backtest';        // Backtesting engine

export interface PluginSlot<T = any> {
  name: SlotName;
  description: string;
  defaultPlugin: string;
  interface: SlotInterface<T>;
}

export interface SlotInterface<T> {
  required: (keyof T)[];
  optional?: (keyof T)[];
}

export interface SlotImplementation {
  pluginId: string;
  priority: number;  // Higher = preferred
  instance: any;
}

// ============================================================================
// Slot Definitions
// ============================================================================

export const SLOT_DEFINITIONS: Record<SlotName, PluginSlot> = {
  memory: {
    name: 'memory',
    description: 'Long-term memory and recall system',
    defaultPlugin: 'memory-core',
    interface: {
      required: ['search', 'store', 'recall'],
      optional: ['autoCapture', 'prune'],
    },
  },
  portfolio: {
    name: 'portfolio',
    description: 'Portfolio tracking and management',
    defaultPlugin: 'portfolio-core',
    interface: {
      required: ['getPositions', 'getBalance', 'trackTrade'],
      optional: ['sync', 'getHistory', 'getPnL'],
    },
  },
  signals: {
    name: 'signals',
    description: 'Trading signal generation',
    defaultPlugin: 'signals-core',
    interface: {
      required: ['generate', 'validate', 'publish'],
      optional: ['backtest', 'optimize'],
    },
  },
  risk: {
    name: 'risk',
    description: 'Risk assessment and management',
    defaultPlugin: 'risk-core',
    interface: {
      required: ['assess', 'checkLimits', 'calculatePosition'],
      optional: ['simulate', 'stress'],
    },
  },
  notifications: {
    name: 'notifications',
    description: 'Alert and notification delivery',
    defaultPlugin: 'notifications-core',
    interface: {
      required: ['send', 'configure', 'getChannels'],
      optional: ['batch', 'schedule'],
    },
  },
  data: {
    name: 'data',
    description: 'Market data provider',
    defaultPlugin: 'data-core',
    interface: {
      required: ['getPrice', 'getOHLCV', 'subscribe'],
      optional: ['getOrderBook', 'getTrades', 'getNews'],
    },
  },
  execution: {
    name: 'execution',
    description: 'Order execution engine',
    defaultPlugin: 'execution-core',
    interface: {
      required: ['placeOrder', 'cancelOrder', 'getOpenOrders'],
      optional: ['modifyOrder', 'smartRoute', 'getExecutions'],
    },
  },
  backtest: {
    name: 'backtest',
    description: 'Strategy backtesting engine',
    defaultPlugin: 'backtest-core',
    interface: {
      required: ['run', 'getResults', 'compare'],
      optional: ['optimize', 'walkForward', 'monteCarlo'],
    },
  },
};

// ============================================================================
// Plugin Slots Registry
// ============================================================================

class PluginSlotsRegistry {
  private slots: Map<SlotName, SlotImplementation[]> = new Map();
  private activeSlots: Map<SlotName, string> = new Map();
  private config: Record<string, string> = {};

  constructor() {
    // Initialize all slots with empty arrays
    for (const name of Object.keys(SLOT_DEFINITIONS) as SlotName[]) {
      this.slots.set(name, []);
    }
  }

  /**
   * Configure which plugin should be used for each slot
   */
  configure(slotConfig: Partial<Record<SlotName, string>>): void {
    for (const [slot, pluginId] of Object.entries(slotConfig)) {
      if (this.isValidSlot(slot)) {
        this.activeSlots.set(slot as SlotName, pluginId);
        logger.info(`Slot '${slot}' configured to use: ${pluginId}`);
      }
    }
    this.config = { ...this.config, ...slotConfig };
  }

  /**
   * Register a plugin implementation for a slot
   */
  register(slot: SlotName, pluginId: string, instance: any, priority = 0): void {
    if (!this.isValidSlot(slot)) {
      throw new Error(`Invalid slot: ${slot}`);
    }

    const definition = SLOT_DEFINITIONS[slot];
    
    // Validate interface implementation
    const missing = this.validateInterface(instance, definition.interface);
    if (missing.length > 0) {
      throw new Error(
        `Plugin '${pluginId}' missing required methods for slot '${slot}': ${missing.join(', ')}`
      );
    }

    const implementations = this.slots.get(slot) || [];
    implementations.push({ pluginId, priority, instance });
    
    // Sort by priority (highest first)
    implementations.sort((a, b) => b.priority - a.priority);
    this.slots.set(slot, implementations);

    logger.info(`Plugin '${pluginId}' registered for slot '${slot}' (priority: ${priority})`);
  }

  /**
   * Get the active implementation for a slot
   */
  get<T = any>(slot: SlotName): T | null {
    const implementations = this.slots.get(slot);
    if (!implementations || implementations.length === 0) {
      return null;
    }

    // Check if a specific plugin is configured
    const configuredPlugin = this.activeSlots.get(slot);
    if (configuredPlugin) {
      const impl = implementations.find(i => i.pluginId === configuredPlugin);
      if (impl) {
        return impl.instance as T;
      }
      logger.warn(`Configured plugin '${configuredPlugin}' not found for slot '${slot}'`);
    }

    // Return highest priority implementation
    return implementations[0].instance as T;
  }

  /**
   * Get all registered implementations for a slot
   */
  getAll(slot: SlotName): SlotImplementation[] {
    return this.slots.get(slot) || [];
  }

  /**
   * Check if a slot has any implementations
   */
  has(slot: SlotName): boolean {
    const implementations = this.slots.get(slot);
    return !!implementations && implementations.length > 0;
  }

  /**
   * Unregister a plugin from a slot
   */
  unregister(slot: SlotName, pluginId: string): boolean {
    const implementations = this.slots.get(slot);
    if (!implementations) return false;

    const index = implementations.findIndex(i => i.pluginId === pluginId);
    if (index >= 0) {
      implementations.splice(index, 1);
      logger.info(`Plugin '${pluginId}' unregistered from slot '${slot}'`);
      return true;
    }
    return false;
  }

  /**
   * Get slot status for all slots
   */
  getStatus(): Record<SlotName, { active: string | null; implementations: string[] }> {
    const status: Record<string, { active: string | null; implementations: string[] }> = {};

    for (const [slot, implementations] of this.slots.entries()) {
      const active = this.activeSlots.get(slot) || 
        (implementations.length > 0 ? implementations[0].pluginId : null);
      
      status[slot] = {
        active,
        implementations: implementations.map(i => i.pluginId),
      };
    }

    return status as Record<SlotName, { active: string | null; implementations: string[] }>;
  }

  /**
   * List all available slots
   */
  listSlots(): { name: SlotName; description: string; default: string }[] {
    return Object.values(SLOT_DEFINITIONS).map(def => ({
      name: def.name,
      description: def.description,
      default: def.defaultPlugin,
    }));
  }

  // Private helpers

  private isValidSlot(name: string): name is SlotName {
    return name in SLOT_DEFINITIONS;
  }

  private validateInterface(instance: any, iface: SlotInterface<any>): string[] {
    const missing: string[] = [];
    
    for (const method of iface.required) {
      if (typeof instance[method] !== 'function') {
        missing.push(method as string);
      }
    }
    
    return missing;
  }
}

// ============================================================================
// Singleton
// ============================================================================

let registry: PluginSlotsRegistry | null = null;

export function getPluginSlots(): PluginSlotsRegistry {
  if (!registry) {
    registry = new PluginSlotsRegistry();
  }
  return registry;
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Get the active memory implementation
 */
export function getMemorySlot<T = any>(): T | null {
  return getPluginSlots().get<T>('memory');
}

/**
 * Get the active portfolio implementation
 */
export function getPortfolioSlot<T = any>(): T | null {
  return getPluginSlots().get<T>('portfolio');
}

/**
 * Get the active signals implementation
 */
export function getSignalsSlot<T = any>(): T | null {
  return getPluginSlots().get<T>('signals');
}

/**
 * Get the active risk implementation
 */
export function getRiskSlot<T = any>(): T | null {
  return getPluginSlots().get<T>('risk');
}

/**
 * Get the active data implementation
 */
export function getDataSlot<T = any>(): T | null {
  return getPluginSlots().get<T>('data');
}

/**
 * Get the active execution implementation
 */
export function getExecutionSlot<T = any>(): T | null {
  return getPluginSlots().get<T>('execution');
}

// ============================================================================
// Export
// ============================================================================

export { PluginSlotsRegistry };
