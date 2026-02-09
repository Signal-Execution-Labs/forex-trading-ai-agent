/**
 * K.I.T. Skill Loader
 * 
 * Discovers and loads trading skills from the skills directory.
 * Each skill has a SKILL.md file with metadata and documentation.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import * as yaml from 'yaml';

export interface SkillMetadata {
  name: string;
  description: string;
  homepage?: string;
  metadata?: {
    kit?: {
      emoji?: string;
      category?: string;
      requires?: {
        skills?: string[];
        env?: string[];
        bins?: string[];
        config?: string[];
      };
    };
  };
}

export interface LoadedSkill {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'loaded' | 'error' | 'disabled';
  error?: string;
  metadata: SkillMetadata;
  path: string;
  execute: (method: string, params: any) => Promise<any>;
  on?: (event: string, handler: (...args: any[]) => void) => void;
  removeAllListeners?: (event: string) => void;
}

export class SkillLoader extends EventEmitter {
  private skills: Map<string, LoadedSkill> = new Map();
  private skillPaths: string[] = [];

  async loadSkills(paths: string[]): Promise<void> {
    this.skillPaths = paths;

    for (const skillPath of paths) {
      if (!fs.existsSync(skillPath)) {
        console.warn(`Skill path not found: ${skillPath}`);
        continue;
      }

      const entries = fs.readdirSync(skillPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          await this.loadSkill(path.join(skillPath, entry.name));
        }
      }
    }

    console.log(`📦 Loaded ${this.skills.size} skills`);
  }

  private async loadSkill(skillDir: string): Promise<void> {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    
    if (!fs.existsSync(skillMdPath)) {
      console.warn(`No SKILL.md found in ${skillDir}`);
      return;
    }

    try {
      const content = fs.readFileSync(skillMdPath, 'utf-8');
      const metadata = this.parseSkillMd(content);
      
      if (!metadata.name) {
        console.warn(`Skill in ${skillDir} has no name`);
        return;
      }

      // Check requirements
      const requirementsMet = await this.checkRequirements(metadata);
      
      const skill: LoadedSkill = {
        id: metadata.name,
        name: metadata.name,
        description: metadata.description || '',
        version: '1.0.0',
        status: requirementsMet ? 'loaded' : 'disabled',
        metadata,
        path: skillDir,
        execute: this.createSkillExecutor(metadata.name, skillDir),
      };

      // Add event emitter capabilities for skills that need it
      const emitter = new EventEmitter();
      skill.on = emitter.on.bind(emitter);
      skill.removeAllListeners = emitter.removeAllListeners.bind(emitter);

      this.skills.set(metadata.name, skill);
      
      if (requirementsMet) {
        console.log(`  ✓ ${metadata.metadata?.kit?.emoji || '📦'} ${metadata.name}`);
      } else {
        console.log(`  ○ ${metadata.name} (requirements not met)`);
      }
      
    } catch (error: any) {
      console.error(`Failed to load skill from ${skillDir}:`, error.message);
    }
  }

  private parseSkillMd(content: string): SkillMetadata {
    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    
    if (!frontmatterMatch) {
      throw new Error('No YAML frontmatter found');
    }

    const frontmatter = yaml.parse(frontmatterMatch[1]);
    
    return {
      name: frontmatter.name,
      description: frontmatter.description,
      homepage: frontmatter.homepage,
      metadata: frontmatter.metadata,
    };
  }

  private async checkRequirements(metadata: SkillMetadata): Promise<boolean> {
    const requires = metadata.metadata?.kit?.requires;
    
    if (!requires) {
      return true;
    }

    // Check environment variables
    if (requires.env) {
      for (const envVar of requires.env) {
        if (!process.env[envVar]) {
          console.log(`    Missing env: ${envVar}`);
          return false;
        }
      }
    }

    // Check required skills
    if (requires.skills) {
      for (const skillName of requires.skills) {
        if (!this.skills.has(skillName)) {
          console.log(`    Missing skill: ${skillName}`);
          return false;
        }
      }
    }

    // Check required binaries (simplified - just check if in PATH)
    if (requires.bins) {
      for (const bin of requires.bins) {
        // In a real implementation, we'd check if the binary exists
        // For now, we'll assume it does
      }
    }

    return true;
  }

  private createSkillExecutor(skillName: string, skillDir: string): (method: string, params: any) => Promise<any> {
    // This is a placeholder executor
    // In a real implementation, skills would have actual handler code
    return async (method: string, params: any): Promise<any> => {
      console.log(`[${skillName}] Executing ${method} with params:`, params);
      
      // Skill-specific implementations would go here
      // For now, return mock data based on skill type
      
      switch (skillName) {
        case 'exchange-connector':
          return this.mockExchangeConnector(method, params);
        case 'portfolio-tracker':
          return this.mockPortfolioTracker(method, params);
        case 'market-analysis':
          return this.mockMarketAnalysis(method, params);
        case 'auto-trader':
          return this.mockAutoTrader(method, params);
        case 'backtester':
          return this.mockBacktester(method, params);
        case 'alert-system':
          return this.mockAlertSystem(method, params);
        case 'news-tracker':
          return this.mockNewsTracker(method, params);
        default:
          throw new Error(`Skill ${skillName} has no implementation`);
      }
    };
  }

  // Mock implementations for demonstration
  // These would be replaced with real implementations

  private async mockExchangeConnector(method: string, params: any): Promise<any> {
    switch (method) {
      case 'status':
        return { connected: true, exchanges: ['binance'] };
      case 'connect':
        return { success: true };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async mockPortfolioTracker(method: string, params: any): Promise<any> {
    switch (method) {
      case 'snapshot':
        return {
          totalValueUsd: 10000,
          assets: [
            { symbol: 'BTC', amount: 0.1, valueUsd: 5000 },
            { symbol: 'ETH', amount: 2, valueUsd: 5000 },
          ],
          change24h: 2.5,
        };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async mockMarketAnalysis(method: string, params: any): Promise<any> {
    switch (method) {
      case 'getData':
        return {
          pair: params.pair,
          price: 50000,
          change24h: 1.5,
          rsi: 55,
          trend: 'bullish',
        };
      case 'analyze':
        return {
          signal: 'hold',
          confidence: 0.6,
          indicators: { rsi: 55, macd: 'bullish' },
        };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async mockAutoTrader(method: string, params: any): Promise<any> {
    switch (method) {
      case 'trade':
        return {
          orderId: `order-${Date.now()}`,
          status: 'filled',
          pair: params.pair,
          side: params.action,
          amount: params.amount,
          price: 50000,
        };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async mockBacktester(method: string, params: any): Promise<any> {
    switch (method) {
      case 'run':
        return {
          strategy: params.strategy,
          pair: params.pair,
          metrics: {
            totalReturn: 25,
            maxDrawdown: 15,
            sharpeRatio: 1.5,
            winRate: 60,
          },
          trades: [],
        };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async mockAlertSystem(method: string, params: any): Promise<any> {
    switch (method) {
      case 'create':
        return { alertId: `alert-${Date.now()}`, status: 'active' };
      case 'list':
        return { alerts: [] };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  private async mockNewsTracker(method: string, params: any): Promise<any> {
    switch (method) {
      case 'latest':
        return {
          news: [
            { title: 'Bitcoin reaches new high', source: 'CoinDesk', sentiment: 0.8 },
          ],
        };
      case 'sentiment':
        return { asset: params.asset, sentiment: 0.65, trend: 'bullish' };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  getSkill(name: string): LoadedSkill | undefined {
    return this.skills.get(name);
  }

  getLoadedSkills(): LoadedSkill[] {
    return Array.from(this.skills.values());
  }

  getHealthStatus(): Record<string, any> {
    const status: Record<string, any> = {};
    
    for (const [name, skill] of this.skills) {
      status[name] = {
        status: skill.status,
        error: skill.error,
      };
    }
    
    return status;
  }
}
