/**
 * K.I.T. Skill Loader
 * 
 * Issue #13: Bug Fix - Placeholder Skill Executor
 * 
 * Discovers and loads trading skills from the skills directory.
 * Each skill has a SKILL.md file with metadata and documentation.
 * 
 * This version uses real tool implementations instead of mocks.
 */

import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import * as yaml from 'yaml';

// Import real tool implementations
import { AutoTrader, createAutoTrader } from '../src/tools/auto-trader';
import { MarketAnalyzer, createMarketAnalyzer } from '../src/tools/market-analysis';
import { PortfolioTracker, createPortfolioTracker } from '../src/tools/portfolio-tracker';
import { AlertSystem, createAlertSystem } from '../src/tools/alert-system';
import { Backtester, createBacktester } from '../src/tools/backtester';
import { Scheduler, createScheduler } from '../src/tools/scheduler';
import { TaxTracker, createTaxTracker } from '../src/tools/tax-tracker';
import { DeFiConnector, createDeFiConnector } from '../src/tools/defi-connector';
import type { ExchangeConfig } from '../src/tools/types';

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

export interface SkillLoaderConfig {
  exchange?: ExchangeConfig;
  autoConnect?: boolean;
}

export class SkillLoader extends EventEmitter {
  private skills: Map<string, LoadedSkill> = new Map();
  private skillPaths: string[] = [];
  private config: SkillLoaderConfig;
  
  // Tool instances (initialized lazily)
  private autoTrader?: AutoTrader;
  private marketAnalyzer?: MarketAnalyzer;
  private portfolioTracker?: PortfolioTracker;
  private alertSystem?: AlertSystem;
  private backtester?: Backtester;
  private scheduler?: Scheduler;
  private taxTracker?: TaxTracker;
  private defiConnector?: DeFiConnector;
  private toolsInitialized: boolean = false;

  constructor(config?: SkillLoaderConfig) {
    super();
    this.config = config || {};
  }

  /**
   * Initialize tool instances
   */
  private async initializeTools(): Promise<void> {
    if (this.toolsInitialized) return;

    try {
      // Create tool instances
      this.autoTrader = createAutoTrader({
        exchange: this.config.exchange,
        dryRun: true, // Start in dry run mode for safety
      });

      this.marketAnalyzer = createMarketAnalyzer(this.config.exchange);
      
      this.portfolioTracker = createPortfolioTracker({
        exchanges: this.config.exchange ? [this.config.exchange] : undefined,
      });

      this.alertSystem = createAlertSystem({
        exchange: this.config.exchange,
      });

      this.backtester = createBacktester({
        exchange: this.config.exchange,
      });

      this.scheduler = createScheduler();

      this.taxTracker = createTaxTracker();

      this.defiConnector = createDeFiConnector();

      // Auto-connect if configured
      if (this.config.autoConnect) {
        await Promise.all([
          this.autoTrader.connect(),
          this.marketAnalyzer.connect(),
          this.portfolioTracker.connect(),
          this.alertSystem.start(),
          this.backtester.connect(),
        ]);
        this.scheduler.start();
      }

      this.toolsInitialized = true;
      console.log('✓ Tools initialized');
    } catch (error: any) {
      console.error('Failed to initialize tools:', error.message);
      throw error;
    }
  }

  /**
   * Get or create tool instance
   */
  private async getAutoTrader(): Promise<AutoTrader> {
    if (!this.autoTrader) {
      await this.initializeTools();
    }
    return this.autoTrader!;
  }

  private async getMarketAnalyzer(): Promise<MarketAnalyzer> {
    if (!this.marketAnalyzer) {
      await this.initializeTools();
    }
    return this.marketAnalyzer!;
  }

  private async getPortfolioTracker(): Promise<PortfolioTracker> {
    if (!this.portfolioTracker) {
      await this.initializeTools();
    }
    return this.portfolioTracker!;
  }

  private async getAlertSystem(): Promise<AlertSystem> {
    if (!this.alertSystem) {
      await this.initializeTools();
    }
    return this.alertSystem!;
  }

  private async getBacktester(): Promise<Backtester> {
    if (!this.backtester) {
      await this.initializeTools();
    }
    return this.backtester!;
  }

  private async getScheduler(): Promise<Scheduler> {
    if (!this.scheduler) {
      await this.initializeTools();
    }
    return this.scheduler!;
  }

  private async getTaxTracker(): Promise<TaxTracker> {
    if (!this.taxTracker) {
      await this.initializeTools();
    }
    return this.taxTracker!;
  }

  private async getDeFiConnector(): Promise<DeFiConnector> {
    if (!this.defiConnector) {
      await this.initializeTools();
    }
    return this.defiConnector!;
  }

  async loadSkills(paths: string[]): Promise<void> {
    this.skillPaths = paths;

    // Initialize tools first
    await this.initializeTools();

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

    // Check required binaries (simplified)
    if (requires.bins) {
      // In a real implementation, check if binaries exist in PATH
    }

    return true;
  }

  /**
   * Create skill executor with REAL implementations
   */
  private createSkillExecutor(skillName: string, skillDir: string): (method: string, params: any) => Promise<any> {
    return async (method: string, params: any): Promise<any> => {
      console.log(`[${skillName}] Executing ${method}`);
      
      // Route to real tool implementations
      switch (skillName) {
        case 'exchange-connector':
          return this.executeExchangeConnector(method, params);
        case 'portfolio-tracker':
          return this.executePortfolioTracker(method, params);
        case 'market-analysis':
          return this.executeMarketAnalysis(method, params);
        case 'auto-trader':
          return this.executeAutoTrader(method, params);
        case 'backtester':
          return this.executeBacktester(method, params);
        case 'alert-system':
          return this.executeAlertSystem(method, params);
        case 'news-tracker':
          return this.executeNewsTracker(method, params);
        case 'tax-tracker':
          return this.executeTaxTracker(method, params);
        case 'defi-connector':
          return this.executeDeFiConnector(method, params);
        case 'rebalancer':
        case 'dividend-manager':
        case 'multi-asset':
          // Placeholder for future skills
          return { status: 'not_implemented', skill: skillName, method };
        default:
          throw new Error(`Skill ${skillName} has no implementation`);
      }
    };
  }

  /**
   * Execute exchange-connector skill methods
   */
  private async executeExchangeConnector(method: string, params: any): Promise<any> {
    const trader = await this.getAutoTrader();
    
    switch (method) {
      case 'status':
        return { 
          connected: trader !== null,
          exchanges: this.config.exchange ? [this.config.exchange.id] : ['binance'],
        };
      case 'connect':
        const connected = await trader.connect(params.exchange);
        return { success: connected };
      case 'disconnect':
        trader.disconnect();
        return { success: true };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute portfolio-tracker skill methods
   */
  private async executePortfolioTracker(method: string, params: any): Promise<any> {
    const tracker = await this.getPortfolioTracker();
    
    switch (method) {
      case 'snapshot':
        return tracker.snapshot();
      case 'balance':
        return tracker.getBalance(params?.exchange);
      case 'pnl':
        return tracker.getPnL();
      case 'allocation':
        return tracker.getAllocation();
      case 'performance':
        return tracker.getPerformance();
      case 'history':
        return tracker.getHistory(params?.days || 30);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute market-analysis skill methods
   */
  private async executeMarketAnalysis(method: string, params: any): Promise<any> {
    const analyzer = await this.getMarketAnalyzer();
    
    switch (method) {
      case 'getData':
        return analyzer.getData({
          symbol: params.pair || params.symbol,
          timeframe: params.timeframe,
          limit: params.limit,
        });
      case 'analyze':
        return analyzer.analyze({
          symbol: params.pair || params.symbol,
          timeframe: params.timeframe,
          indicators: params.indicators,
        });
      case 'indicators':
        const data = await analyzer.getData({
          symbol: params.pair || params.symbol,
          timeframe: params.timeframe,
        });
        return analyzer.calculateIndicators(data, params.indicators);
      case 'price':
        return { price: await analyzer.getPrice(params.pair || params.symbol) };
      case 'orderbook':
        return analyzer.getOrderbook(params.pair || params.symbol, params.limit);
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute auto-trader skill methods
   */
  private async executeAutoTrader(method: string, params: any): Promise<any> {
    const trader = await this.getAutoTrader();
    
    switch (method) {
      case 'trade':
        return trader.trade({
          symbol: params.pair || params.symbol,
          side: params.action || params.side,
          amount: params.amount,
          amountUsd: params.amountUsd,
          type: params.type || 'market',
          price: params.price,
          stopLoss: params.stopLoss,
          takeProfit: params.takeProfit,
          riskPercent: params.riskPercent,
        });
      case 'close':
        return trader.closePosition(params.symbol, params.percentage);
      case 'positions':
        return trader.getOpenPositions();
      case 'position':
        return trader.getPosition(params.symbol);
      case 'balance':
        return trader.getBalance();
      case 'trades':
        return trader.getTrades();
      case 'pnl':
        return { dailyPnl: trader.getDailyPnl() };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute backtester skill methods
   */
  private async executeBacktester(method: string, params: any): Promise<any> {
    const backtester = await this.getBacktester();
    
    switch (method) {
      case 'run':
        return backtester.run({
          symbol: params.pair || params.symbol,
          strategy: params.strategy,
          startDate: params.start || params.startDate,
          endDate: params.end || params.endDate,
          timeframe: params.timeframe,
          initialCapital: params.capital || params.initialCapital,
        });
      case 'strategies':
        return { strategies: backtester.getAvailableStrategies() };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute scheduler skill methods
   */
  private async executeScheduler(method: string, params: any): Promise<any> {
    const scheduler = await this.getScheduler();
    
    switch (method) {
      case 'create':
        return scheduler.createTask({
          name: params.name,
          type: params.type || 'custom',
          schedule: params.schedule,
          taskParams: params.params,
        });
      case 'list':
        return { tasks: scheduler.listTasks(params?.enabled) };
      case 'get':
        return scheduler.getTask(params.taskId);
      case 'enable':
        return { success: scheduler.enableTask(params.taskId) };
      case 'disable':
        return { success: scheduler.disableTask(params.taskId) };
      case 'delete':
        return { success: scheduler.deleteTask(params.taskId) };
      case 'run':
        return scheduler.runTask(params.taskId);
      case 'status':
        return scheduler.getStatus();
      case 'history':
        return { history: scheduler.getHistory(params?.taskId) };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute tax-tracker skill methods
   */
  private async executeTaxTracker(method: string, params: any): Promise<any> {
    const taxTracker = await this.getTaxTracker();
    
    switch (method) {
      case 'recordBuy':
        return taxTracker.recordBuy(params);
      case 'recordSell':
        return taxTracker.recordSell(params);
      case 'summary':
        return taxTracker.getSummary(params.year || new Date().getFullYear());
      case 'report':
        return taxTracker.generateReport(params.year || new Date().getFullYear());
      case 'export':
        return { csv: taxTracker.exportCSV(params.year || new Date().getFullYear()) };
      case 'lots':
        return { lots: taxTracker.getLots(params?.symbol) };
      case 'disposals':
        return { disposals: taxTracker.getDisposals(params?.year) };
      case 'setMethod':
        taxTracker.setCostBasisMethod(params.method);
        return { success: true, method: params.method };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute defi-connector skill methods
   */
  private async executeDeFiConnector(method: string, params: any): Promise<any> {
    const defi = await this.getDeFiConnector();
    
    switch (method) {
      case 'protocols':
        return { protocols: defi.getProtocols(params?.network) };
      case 'quote':
        return { quotes: await defi.getQuote(params) };
      case 'yields':
        return { opportunities: await defi.getYieldOpportunities(params) };
      case 'pools':
        return { pools: await defi.getLiquidityPools(params) };
      case 'positions':
        return { positions: await defi.getLendingPositions(params?.walletAddress) };
      case 'watchlist':
        return { watchlist: defi.getWatchlist() };
      case 'addWatchlist':
        defi.addToWatchlist(params.opportunity);
        return { success: true };
      case 'removeWatchlist':
        return { success: defi.removeFromWatchlist(params.opportunityId) };
      case 'impermanentLoss':
        return { il: defi.calculateImpermanentLoss(params.priceChange) };
      case 'summary':
        return defi.getSummary();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute alert-system skill methods
   */
  private async executeAlertSystem(method: string, params: any): Promise<any> {
    const alerts = await this.getAlertSystem();
    
    switch (method) {
      case 'create':
        return alerts.create({
          type: params.type || 'price',
          symbol: params.pair || params.symbol,
          condition: params.condition,
          value: params.value,
          message: params.message,
          expiresIn: params.expiresIn,
        });
      case 'list':
        return { alerts: alerts.list(params?.status) };
      case 'get':
        return alerts.get(params.alertId);
      case 'delete':
        return { success: alerts.delete(params.alertId) };
      case 'pause':
        return { success: alerts.pause(params.alertId) };
      case 'resume':
        return { success: alerts.resume(params.alertId) };
      case 'summary':
        return alerts.getSummary();
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Execute news-tracker skill methods (placeholder)
   */
  private async executeNewsTracker(method: string, params: any): Promise<any> {
    // News tracker would require external API integration
    switch (method) {
      case 'latest':
        return {
          news: [],
          status: 'news_tracker_not_implemented',
          message: 'News tracker requires external API setup',
        };
      case 'sentiment':
        return { 
          asset: params.asset, 
          sentiment: 0.5,
          trend: 'neutral',
          status: 'placeholder',
        };
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
    const status: Record<string, any> = {
      toolsInitialized: this.toolsInitialized,
      skills: {},
    };
    
    for (const [name, skill] of this.skills) {
      status.skills[name] = {
        status: skill.status,
        error: skill.error,
      };
    }
    
    return status;
  }

  /**
   * Cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.autoTrader) {
      this.autoTrader.disconnect();
    }
    if (this.portfolioTracker) {
      this.portfolioTracker.disconnect();
    }
    if (this.alertSystem) {
      this.alertSystem.stop();
    }
    if (this.scheduler) {
      this.scheduler.stop();
    }
    
    this.toolsInitialized = false;
    console.log('Skills shutdown complete');
  }

  /**
   * Execute scheduler skill methods (for tool-registry integration)
   */
  async executeSchedulerSkill(method: string, params: any): Promise<any> {
    return this.executeScheduler(method, params);
  }
}

// Export for use in other modules
export default SkillLoader;
