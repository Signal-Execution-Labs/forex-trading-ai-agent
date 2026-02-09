/**
 * K.I.T. Skill Router - Automatic Skill Activation
 * 
 * Analyzes user requests and automatically activates the right skills.
 * No configuration needed - just ask and K.I.T. handles the rest.
 * 
 * "I want to track my portfolio" → portfolio-tracker activated
 * "Copy signals from @CryptoWhale" → signal-copier activated
 * "Backtest my RSI strategy" → backtester activated
 */

import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { Logger } from './logger';

const logger = new Logger('skill-router');

export interface Skill {
  name: string;
  description: string;
  triggers: string[];      // Keywords/phrases that trigger this skill
  markets?: string[];      // Which markets: crypto, forex, binary, stocks, defi
  actions?: string[];      // What it can do: track, trade, analyze, alert, etc.
  requires?: string[];     // Dependencies: exchange-api, telegram, mt5, etc.
  autoActivate: boolean;   // Can be activated without explicit request
  priority: number;        // Higher = checked first (for overlapping triggers)
  path: string;            // Path to SKILL.md
}

export interface SkillMatch {
  skill: Skill;
  confidence: number;      // 0-1, how confident we are this skill matches
  matchedTriggers: string[];
  suggestedParams?: Record<string, any>;
}

/**
 * Skill Registry - knows all available skills and their capabilities
 */
export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private skillsPath: string;
  
  constructor(skillsPath: string = 'skills') {
    this.skillsPath = skillsPath;
  }
  
  /**
   * Load all skills from the skills directory
   */
  async loadSkills(): Promise<void> {
    try {
      const dirs = await readdir(this.skillsPath, { withFileTypes: true });
      
      for (const dir of dirs) {
        if (dir.isDirectory()) {
          await this.loadSkill(dir.name);
        }
      }
      
      logger.info(`Loaded ${this.skills.size} skills`);
    } catch (error) {
      logger.error('Failed to load skills', error);
    }
  }
  
  /**
   * Load a single skill from its directory
   */
  private async loadSkill(name: string): Promise<void> {
    const skillPath = join(this.skillsPath, name, 'SKILL.md');
    
    try {
      const content = await readFile(skillPath, 'utf-8');
      const skill = this.parseSkillMd(name, content, skillPath);
      this.skills.set(name, skill);
      logger.debug(`Loaded skill: ${name}`);
    } catch (error) {
      // Skill might not have SKILL.md yet
      logger.debug(`Skipping ${name}: no SKILL.md`);
    }
  }
  
  /**
   * Parse SKILL.md to extract skill metadata
   */
  private parseSkillMd(name: string, content: string, path: string): Skill {
    // Extract description from first paragraph
    const descMatch = content.match(/^#[^\n]+\n+([^\n#]+)/);
    const description = descMatch?.[1]?.trim() || '';
    
    // Extract triggers from common patterns in the content
    const triggers = this.extractTriggers(name, content);
    
    // Extract markets from content
    const markets = this.extractMarkets(content);
    
    // Extract actions
    const actions = this.extractActions(content);
    
    return {
      name,
      description,
      triggers,
      markets,
      actions,
      autoActivate: true,
      priority: this.calculatePriority(name),
      path
    };
  }
  
  /**
   * Extract trigger keywords/phrases for a skill
   */
  private extractTriggers(name: string, content: string): string[] {
    const triggers: string[] = [];
    const lowerContent = content.toLowerCase();
    
    // Add skill name variations
    triggers.push(name);
    triggers.push(name.replace(/-/g, ' '));
    
    // Skill-specific triggers based on common finance terms
    const triggerMap: Record<string, string[]> = {
      'portfolio-tracker': ['portfolio', 'holdings', 'balance', 'track my', 'show my assets', 'what do i own', 'my positions'],
      'exchange-connector': ['connect', 'exchange', 'binance', 'kraken', 'coinbase', 'api key'],
      'alert-system': ['alert', 'notify', 'tell me when', 'price alert', 'watch', 'monitor price'],
      'market-analysis': ['analyze', 'analysis', 'technical', 'chart', 'indicators', 'rsi', 'macd', 'trend'],
      'auto-trader': ['auto trade', 'automated', 'bot trade', 'execute trades', 'trading bot'],
      'backtester': ['backtest', 'test strategy', 'historical', 'simulate', 'would have'],
      'news-tracker': ['news', 'headlines', 'sentiment', 'what happened', 'market news'],
      'tax-tracker': ['tax', 'taxes', 'capital gains', 'tax report', 'steuer'],
      'dividend-manager': ['dividend', 'dividends', 'yield', 'income', 'passive income'],
      'rebalancer': ['rebalance', 'allocation', 'diversify', 'adjust portfolio'],
      'defi-connector': ['defi', 'uniswap', 'pancakeswap', 'liquidity', 'yield farm', 'staking', 'airdrop'],
      'multi-asset': ['multi asset', 'all markets', 'diversified', 'cross market'],
      'signal-copier': ['signal', 'copy', 'copy trading', 'follow trades', 'signal channel', 'telegram signal'],
      'metatrader': ['mt4', 'mt5', 'metatrader', 'forex', 'roboforex', 'oanda']
    };
    
    if (triggerMap[name]) {
      triggers.push(...triggerMap[name]);
    }
    
    // Extract from Commands section if present
    const commandsMatch = content.match(/## Commands?\n([\s\S]*?)(?=\n##|$)/i);
    if (commandsMatch) {
      const commands = commandsMatch[1].match(/`\/(\w+)`/g);
      if (commands) {
        triggers.push(...commands.map(c => c.replace(/`/g, '').replace('/', '')));
      }
    }
    
    return [...new Set(triggers)];
  }
  
  /**
   * Extract supported markets from skill content
   */
  private extractMarkets(content: string): string[] {
    const markets: string[] = [];
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('crypto') || lowerContent.includes('bitcoin') || lowerContent.includes('binance')) {
      markets.push('crypto');
    }
    if (lowerContent.includes('forex') || lowerContent.includes('mt4') || lowerContent.includes('mt5')) {
      markets.push('forex');
    }
    if (lowerContent.includes('binary') || lowerContent.includes('options')) {
      markets.push('binary');
    }
    if (lowerContent.includes('stock') || lowerContent.includes('equity') || lowerContent.includes('alpaca')) {
      markets.push('stocks');
    }
    if (lowerContent.includes('defi') || lowerContent.includes('uniswap') || lowerContent.includes('web3')) {
      markets.push('defi');
    }
    
    return markets.length > 0 ? markets : ['crypto', 'forex', 'stocks']; // Default to major markets
  }
  
  /**
   * Extract actions/capabilities from skill content
   */
  private extractActions(content: string): string[] {
    const actions: string[] = [];
    const lowerContent = content.toLowerCase();
    
    const actionKeywords = ['track', 'trade', 'analyze', 'alert', 'backtest', 'report', 'monitor', 'copy', 'execute', 'connect'];
    
    for (const action of actionKeywords) {
      if (lowerContent.includes(action)) {
        actions.push(action);
      }
    }
    
    return actions;
  }
  
  /**
   * Calculate priority for a skill (higher = checked first)
   */
  private calculatePriority(name: string): number {
    // More specific skills get higher priority
    const priorities: Record<string, number> = {
      'signal-copier': 90,     // Very specific use case
      'backtester': 85,
      'auto-trader': 80,
      'metatrader': 75,
      'defi-connector': 70,
      'alert-system': 65,
      'tax-tracker': 60,
      'dividend-manager': 55,
      'rebalancer': 50,
      'news-tracker': 45,
      'market-analysis': 40,
      'portfolio-tracker': 35,
      'exchange-connector': 30,  // Generic, low priority
      'multi-asset': 20
    };
    
    return priorities[name] || 50;
  }
  
  /**
   * Get all registered skills
   */
  getSkills(): Skill[] {
    return Array.from(this.skills.values());
  }
  
  /**
   * Get a specific skill by name
   */
  getSkill(name: string): Skill | undefined {
    return this.skills.get(name);
  }
}

/**
 * Skill Router - routes user requests to appropriate skills
 */
export class SkillRouter {
  private registry: SkillRegistry;
  private activeSkills: Set<string> = new Set();
  
  constructor(registry: SkillRegistry) {
    this.registry = registry;
  }
  
  /**
   * Find the best matching skill(s) for a user request
   */
  findSkills(userMessage: string): SkillMatch[] {
    const matches: SkillMatch[] = [];
    const lowerMessage = userMessage.toLowerCase();
    const words = lowerMessage.split(/\s+/);
    
    for (const skill of this.registry.getSkills()) {
      const matchedTriggers: string[] = [];
      let score = 0;
      
      for (const trigger of skill.triggers) {
        const lowerTrigger = trigger.toLowerCase();
        
        // Exact phrase match (highest score)
        if (lowerMessage.includes(lowerTrigger)) {
          matchedTriggers.push(trigger);
          score += lowerTrigger.split(' ').length * 20; // Multi-word matches score higher
        }
        // Word match
        else if (words.includes(lowerTrigger)) {
          matchedTriggers.push(trigger);
          score += 10;
        }
      }
      
      if (matchedTriggers.length > 0) {
        // Normalize score to 0-1 confidence
        const confidence = Math.min(score / 100, 1);
        
        matches.push({
          skill,
          confidence,
          matchedTriggers,
          suggestedParams: this.extractParams(userMessage, skill)
        });
      }
    }
    
    // Sort by confidence * priority
    return matches.sort((a, b) => 
      (b.confidence * b.skill.priority) - (a.confidence * a.skill.priority)
    );
  }
  
  /**
   * Extract parameters from user message for a skill
   */
  private extractParams(message: string, skill: Skill): Record<string, any> {
    const params: Record<string, any> = {};
    
    // Extract Telegram channel mentions
    const channelMatch = message.match(/@[\w]+/g);
    if (channelMatch) {
      params.channels = channelMatch;
    }
    
    // Extract trading pairs
    const pairMatch = message.match(/\b([A-Z]{3,4})[\/\-]?([A-Z]{3,4})\b/gi);
    if (pairMatch) {
      params.pairs = pairMatch.map(p => p.toUpperCase());
    }
    
    // Extract amounts
    const amountMatch = message.match(/\$?([\d,]+(?:\.\d+)?)\s*(?:usd|eur|dollar|euro)?/gi);
    if (amountMatch) {
      params.amount = parseFloat(amountMatch[0].replace(/[$,]/g, ''));
    }
    
    // Extract percentages
    const percentMatch = message.match(/([\d.]+)\s*%/);
    if (percentMatch) {
      params.percentage = parseFloat(percentMatch[1]);
    }
    
    // Extract time periods
    const timeMatch = message.match(/(\d+)\s*(minute|hour|day|week|month|year)s?/i);
    if (timeMatch) {
      params.period = { value: parseInt(timeMatch[1]), unit: timeMatch[2].toLowerCase() };
    }
    
    return params;
  }
  
  /**
   * Activate a skill for the current session
   */
  activateSkill(skillName: string): boolean {
    const skill = this.registry.getSkill(skillName);
    if (skill) {
      this.activeSkills.add(skillName);
      logger.info(`Activated skill: ${skillName}`);
      return true;
    }
    return false;
  }
  
  /**
   * Deactivate a skill
   */
  deactivateSkill(skillName: string): void {
    this.activeSkills.delete(skillName);
    logger.info(`Deactivated skill: ${skillName}`);
  }
  
  /**
   * Get list of active skills
   */
  getActiveSkills(): string[] {
    return Array.from(this.activeSkills);
  }
  
  /**
   * Generate a natural language response about which skill to use
   */
  suggestSkill(userMessage: string): string {
    const matches = this.findSkills(userMessage);
    
    if (matches.length === 0) {
      return "I'm not sure which feature you need. Could you be more specific? I can help with:\n" +
        "• Portfolio tracking\n" +
        "• Signal copying from Telegram\n" +
        "• Auto-trading\n" +
        "• Market analysis\n" +
        "• Backtesting strategies";
    }
    
    const best = matches[0];
    
    if (best.confidence > 0.7) {
      return `I'll use the **${best.skill.name}** skill for this. ${best.skill.description}`;
    } else if (best.confidence > 0.4) {
      return `I think you might want the **${best.skill.name}** skill. Is that right?`;
    } else {
      const top3 = matches.slice(0, 3).map(m => `• **${m.skill.name}**: ${m.skill.description}`).join('\n');
      return `I found a few options:\n${top3}\n\nWhich one would you like?`;
    }
  }
}

/**
 * Auto-Skill Activator - monitors conversation and activates skills automatically
 */
export class AutoSkillActivator {
  private router: SkillRouter;
  private conversationContext: string[] = [];
  private maxContextLength = 10;
  
  constructor(router: SkillRouter) {
    this.router = router;
  }
  
  /**
   * Process a message and auto-activate relevant skills
   */
  async processMessage(message: string): Promise<{
    activatedSkills: string[];
    suggestions: SkillMatch[];
    response?: string;
  }> {
    // Add to context
    this.conversationContext.push(message);
    if (this.conversationContext.length > this.maxContextLength) {
      this.conversationContext.shift();
    }
    
    // Find matching skills
    const matches = this.router.findSkills(message);
    const activatedSkills: string[] = [];
    
    // Auto-activate high-confidence matches
    for (const match of matches) {
      if (match.confidence > 0.6 && match.skill.autoActivate) {
        this.router.activateSkill(match.skill.name);
        activatedSkills.push(match.skill.name);
      }
    }
    
    return {
      activatedSkills,
      suggestions: matches,
      response: activatedSkills.length > 0 
        ? `✅ Activated: ${activatedSkills.join(', ')}`
        : undefined
    };
  }
  
  /**
   * Get context-aware skill suggestions
   */
  getContextualSuggestions(): string[] {
    const fullContext = this.conversationContext.join(' ');
    const matches = this.router.findSkills(fullContext);
    return matches.slice(0, 5).map(m => m.skill.name);
  }
}

// Export singleton for easy use
let globalRegistry: SkillRegistry | null = null;
let globalRouter: SkillRouter | null = null;

export async function initSkillSystem(skillsPath: string = 'skills'): Promise<SkillRouter> {
  globalRegistry = new SkillRegistry(skillsPath);
  await globalRegistry.loadSkills();
  globalRouter = new SkillRouter(globalRegistry);
  return globalRouter;
}

export function getSkillRouter(): SkillRouter | null {
  return globalRouter;
}
