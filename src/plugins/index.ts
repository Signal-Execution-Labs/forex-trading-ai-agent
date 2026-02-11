/**
 * K.I.T. Plugin System
 * 
 * OpenClaw-style plugin architecture for extending K.I.T. functionality.
 * Plugins can register:
 * - Gateway RPC methods
 * - Agent tools
 * - CLI commands
 * - Background services
 * - Skills
 * - Hooks
 * 
 * Discovery order:
 * 1. Workspace plugins: <workspace>/.kit/plugins/
 * 2. User plugins: ~/.kit/plugins/
 * 3. Bundled plugins: <kit>/dist/plugins/bundled/
 */

import * as fs from 'fs';
import * as path from 'path';
import { createLogger } from '../core/logger';
import { ToolDefinition, ToolHandler } from '../tools/system/tool-registry';

const logger = createLogger('plugins');

// ============================================================================
// Types
// ============================================================================

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  
  // Entry points
  main?: string;           // Main entry file (default: index.ts/index.js)
  
  // Capabilities
  tools?: string[];        // Tool definition files to load
  skills?: string[];       // Skill directories
  hooks?: string[];        // Hook definition files
  commands?: string[];     // CLI command files
  
  // Dependencies
  dependencies?: string[]; // Plugin dependencies (other plugin ids)
  peerDependencies?: Record<string, string>; // npm peer deps
  
  // Configuration
  config?: {
    schema?: Record<string, any>; // JSON Schema for plugin config
    defaults?: Record<string, any>;
  };
  
  // Runtime
  enabled?: boolean;
}

export interface PluginContext {
  pluginId: string;
  pluginDir: string;
  config: Record<string, any>;
  kitVersion: string;
  logger: ReturnType<typeof createLogger>;
}

export interface PluginAPI {
  // Tool registration
  registerTool(definition: ToolDefinition, handler: ToolHandler): void;
  
  // Service registration
  registerService(name: string, service: PluginService): void;
  
  // RPC registration
  registerRPC(method: string, handler: RPCHandler): void;
  
  // Hook registration
  registerHook(event: string, handler: HookHandler): void;
  
  // Config access
  getConfig<T = any>(key?: string): T;
  
  // Storage
  getStoragePath(): string;
  
  // Logging
  log: ReturnType<typeof createLogger>;
}

export interface PluginService {
  start(): Promise<void>;
  stop(): Promise<void>;
  isRunning(): boolean;
}

export type RPCHandler = (params: Record<string, any>, ctx: PluginContext) => Promise<any>;
export type HookHandler = (data: Record<string, any>, ctx: PluginContext) => Promise<void>;

export interface LoadedPlugin {
  manifest: PluginManifest;
  path: string;
  api: PluginAPI;
  instance?: any;
  services: Map<string, PluginService>;
  tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>;
  rpcs: Map<string, RPCHandler>;
  hooks: Map<string, HookHandler[]>;
}

export interface PluginLoadResult {
  success: boolean;
  pluginId: string;
  error?: string;
}

// ============================================================================
// Plugin Registry
// ============================================================================

class PluginRegistry {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private searchPaths: string[] = [];
  private configPath: string;
  private pluginConfigs: Map<string, Record<string, any>> = new Map();

  constructor() {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.configPath = path.join(homeDir, '.kit', 'plugins.json');
    
    // Default search paths
    this.searchPaths = [
      path.join(homeDir, '.kit', 'workspace', '.kit', 'plugins'), // Workspace
      path.join(homeDir, '.kit', 'plugins'),                      // User
      path.join(__dirname, '..', '..', 'plugins', 'bundled'),     // Bundled
    ];
    
    this.loadConfig();
  }

  /**
   * Add a search path for plugins
   */
  addSearchPath(searchPath: string, prepend = false): void {
    if (!this.searchPaths.includes(searchPath)) {
      if (prepend) {
        this.searchPaths.unshift(searchPath);
      } else {
        this.searchPaths.push(searchPath);
      }
    }
  }

  /**
   * Discover all available plugins
   */
  async discover(): Promise<PluginManifest[]> {
    const manifests: PluginManifest[] = [];
    const seenIds = new Set<string>();

    for (const searchPath of this.searchPaths) {
      if (!fs.existsSync(searchPath)) continue;

      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const pluginDir = path.join(searchPath, entry.name);
        const manifestPath = path.join(pluginDir, 'kit.plugin.json');
        
        if (!fs.existsSync(manifestPath)) continue;
        
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as PluginManifest;
          
          // Skip duplicates (first match wins)
          if (seenIds.has(manifest.id)) continue;
          seenIds.add(manifest.id);
          
          manifests.push(manifest);
        } catch (error) {
          logger.warn(`Failed to read plugin manifest: ${manifestPath}`, error);
        }
      }
    }

    return manifests;
  }

  /**
   * Load a plugin by ID
   */
  async load(pluginId: string): Promise<PluginLoadResult> {
    // Check if already loaded
    if (this.plugins.has(pluginId)) {
      return { success: true, pluginId };
    }

    // Find plugin directory
    const pluginDir = this.findPluginDir(pluginId);
    if (!pluginDir) {
      return { success: false, pluginId, error: `Plugin not found: ${pluginId}` };
    }

    // Load manifest
    const manifestPath = path.join(pluginDir, 'kit.plugin.json');
    let manifest: PluginManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    } catch (error) {
      return { success: false, pluginId, error: `Failed to read manifest: ${error}` };
    }

    // Check dependencies
    for (const depId of manifest.dependencies || []) {
      if (!this.plugins.has(depId)) {
        const depResult = await this.load(depId);
        if (!depResult.success) {
          return { success: false, pluginId, error: `Dependency failed: ${depId} - ${depResult.error}` };
        }
      }
    }

    // Create plugin API
    const plugin: LoadedPlugin = {
      manifest,
      path: pluginDir,
      api: this.createPluginAPI(pluginId, pluginDir, manifest),
      services: new Map(),
      tools: new Map(),
      rpcs: new Map(),
      hooks: new Map(),
    };

    // Load main entry point if exists
    const mainFile = manifest.main || 'index.ts';
    const mainPath = path.join(pluginDir, mainFile);
    
    if (fs.existsSync(mainPath) || fs.existsSync(mainPath.replace('.ts', '.js'))) {
      try {
        // Use dynamic import (works with both TS and JS)
        const actualPath = fs.existsSync(mainPath) ? mainPath : mainPath.replace('.ts', '.js');
        const pluginModule = await import(actualPath);
        
        if (typeof pluginModule.activate === 'function') {
          const ctx: PluginContext = {
            pluginId,
            pluginDir,
            config: this.pluginConfigs.get(pluginId) || manifest.config?.defaults || {},
            kitVersion: '2.0.0',
            logger: createLogger(`plugin:${pluginId}`),
          };
          
          plugin.instance = await pluginModule.activate(plugin.api, ctx);
        }
      } catch (error) {
        logger.error(`Failed to load plugin ${pluginId}:`, error);
        return { success: false, pluginId, error: `Activation failed: ${error}` };
      }
    }

    this.plugins.set(pluginId, plugin);
    logger.info(`✅ Loaded plugin: ${manifest.name} v${manifest.version}`);
    
    return { success: true, pluginId };
  }

  /**
   * Unload a plugin
   */
  async unload(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    // Stop all services
    for (const [name, service] of plugin.services) {
      try {
        await service.stop();
        logger.info(`Stopped service: ${name}`);
      } catch (error) {
        logger.warn(`Failed to stop service ${name}:`, error);
      }
    }

    // Call deactivate if exists
    if (plugin.instance && typeof plugin.instance.deactivate === 'function') {
      try {
        await plugin.instance.deactivate();
      } catch (error) {
        logger.warn(`Deactivation error for ${pluginId}:`, error);
      }
    }

    this.plugins.delete(pluginId);
    logger.info(`Unloaded plugin: ${pluginId}`);
    return true;
  }

  /**
   * Enable a plugin
   */
  async enable(pluginId: string): Promise<PluginLoadResult> {
    this.setPluginEnabled(pluginId, true);
    return this.load(pluginId);
  }

  /**
   * Disable a plugin
   */
  async disable(pluginId: string): Promise<boolean> {
    this.setPluginEnabled(pluginId, false);
    return this.unload(pluginId);
  }

  /**
   * Get all loaded plugins
   */
  getLoaded(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get a specific plugin
   */
  get(pluginId: string): LoadedPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all tools from all plugins
   */
  getAllTools(): Map<string, { definition: ToolDefinition; handler: ToolHandler; pluginId: string }> {
    const tools = new Map<string, { definition: ToolDefinition; handler: ToolHandler; pluginId: string }>();
    
    for (const [pluginId, plugin] of this.plugins) {
      for (const [toolName, tool] of plugin.tools) {
        tools.set(toolName, { ...tool, pluginId });
      }
    }
    
    return tools;
  }

  /**
   * Call an RPC method
   */
  async callRPC(method: string, params: Record<string, any>): Promise<any> {
    for (const [pluginId, plugin] of this.plugins) {
      const handler = plugin.rpcs.get(method);
      if (handler) {
        const ctx: PluginContext = {
          pluginId,
          pluginDir: plugin.path,
          config: this.pluginConfigs.get(pluginId) || {},
          kitVersion: '2.0.0',
          logger: createLogger(`plugin:${pluginId}`),
        };
        return handler(params, ctx);
      }
    }
    throw new Error(`RPC method not found: ${method}`);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private findPluginDir(pluginId: string): string | null {
    for (const searchPath of this.searchPaths) {
      if (!fs.existsSync(searchPath)) continue;
      
      const entries = fs.readdirSync(searchPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        
        const pluginDir = path.join(searchPath, entry.name);
        const manifestPath = path.join(pluginDir, 'kit.plugin.json');
        
        if (!fs.existsSync(manifestPath)) continue;
        
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          if (manifest.id === pluginId) {
            return pluginDir;
          }
        } catch {
          continue;
        }
      }
    }
    
    return null;
  }

  private createPluginAPI(pluginId: string, pluginDir: string, manifest: PluginManifest): PluginAPI {
    const plugin = () => this.plugins.get(pluginId);
    const configs = this.pluginConfigs;
    
    return {
      registerTool(definition: ToolDefinition, handler: ToolHandler): void {
        const p = plugin();
        if (p) {
          p.tools.set(definition.name, { definition, handler });
          logger.info(`Plugin ${pluginId} registered tool: ${definition.name}`);
        }
      },
      
      registerService(name: string, service: PluginService): void {
        const p = plugin();
        if (p) {
          p.services.set(name, service);
          logger.info(`Plugin ${pluginId} registered service: ${name}`);
        }
      },
      
      registerRPC(method: string, handler: RPCHandler): void {
        const p = plugin();
        if (p) {
          p.rpcs.set(method, handler);
          logger.info(`Plugin ${pluginId} registered RPC: ${method}`);
        }
      },
      
      registerHook(event: string, handler: HookHandler): void {
        const p = plugin();
        if (p) {
          if (!p.hooks.has(event)) {
            p.hooks.set(event, []);
          }
          p.hooks.get(event)!.push(handler);
          logger.info(`Plugin ${pluginId} registered hook for: ${event}`);
        }
      },
      
      getConfig<T = any>(key?: string): T {
        const config = configs.get(pluginId) || manifest.config?.defaults || {};
        if (key) {
          return key.split('.').reduce((obj, k) => obj?.[k], config) as T;
        }
        return config as T;
      },
      
      getStoragePath(): string {
        const storagePath = path.join(
          process.env.HOME || process.env.USERPROFILE || '',
          '.kit',
          'plugin-data',
          pluginId
        );
        if (!fs.existsSync(storagePath)) {
          fs.mkdirSync(storagePath, { recursive: true });
        }
        return storagePath;
      },
      
      log: createLogger(`plugin:${pluginId}`),
    };
  }

  private loadConfig(): void {
    try {
      if (fs.existsSync(this.configPath)) {
        const config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        
        for (const [pluginId, pluginConfig] of Object.entries(config.plugins || {})) {
          this.pluginConfigs.set(pluginId, pluginConfig as Record<string, any>);
        }
      }
    } catch (error) {
      logger.warn('Failed to load plugins config:', error);
    }
  }

  private saveConfig(): void {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      const config = {
        plugins: Object.fromEntries(this.pluginConfigs),
        enabled: Object.fromEntries(
          Array.from(this.plugins.entries()).map(([id, p]) => [id, p.manifest.enabled ?? true])
        ),
      };
      
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
    } catch (error) {
      logger.warn('Failed to save plugins config:', error);
    }
  }

  private setPluginEnabled(pluginId: string, enabled: boolean): void {
    const plugin = this.plugins.get(pluginId);
    if (plugin) {
      plugin.manifest.enabled = enabled;
    }
    this.saveConfig();
  }
}

// ============================================================================
// Singleton
// ============================================================================

let registry: PluginRegistry | null = null;

export function getPluginRegistry(): PluginRegistry {
  if (!registry) {
    registry = new PluginRegistry();
  }
  return registry;
}

// ============================================================================
// CLI Integration
// ============================================================================

export async function listPlugins(): Promise<{ available: PluginManifest[]; loaded: string[] }> {
  const reg = getPluginRegistry();
  const available = await reg.discover();
  const loaded = reg.getLoaded().map(p => p.manifest.id);
  
  return { available, loaded };
}

export async function installPlugin(source: string): Promise<PluginLoadResult> {
  // For now, just support loading from path
  // TODO: Add npm install support, git clone, etc.
  logger.info(`Installing plugin from: ${source}`);
  
  const reg = getPluginRegistry();
  
  if (fs.existsSync(source)) {
    // Local path
    reg.addSearchPath(path.dirname(source), true);
    
    // Try to find plugin ID from manifest
    const manifestPath = path.join(source, 'kit.plugin.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      return reg.load(manifest.id);
    }
  }
  
  // Assume it's a plugin ID
  return reg.load(source);
}

// ============================================================================
// Exports
// ============================================================================

export { PluginRegistry };
