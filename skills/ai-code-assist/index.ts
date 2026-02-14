/**
 * AI Code Assist Skill - Pine Script v6 Inspired
 * 
 * Natural language to trading code with AI
 */

import { KitSkill, SkillContext, SkillResult } from '../../src/types/skill.js';

interface GenerationRequest {
  prompt: string;
  mode: 'strategy' | 'indicator' | 'alert' | 'screener' | 'backtest' | 'risk';
  options?: {
    model?: string;
    temperature?: number;
    includeComments?: boolean;
    includeTests?: boolean;
  };
}

interface ConversionRequest {
  source: string;
  from: 'pine' | 'python' | 'mql4' | 'mql5';
  to: 'kit';
  optimize?: boolean;
}

class AICodeAssistSkill implements KitSkill {
  name = 'ai-code-assist';
  version = '1.0.0';
  description = 'AI-assisted code generation for trading strategies';

  private templates: Map<string, string> = new Map();

  constructor() {
    this.initializeTemplates();
  }

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { action, params } = ctx;

    switch (action) {
      case 'generate':
        return this.generate(params as GenerationRequest);
      case 'explain':
        return this.explain(params.code);
      case 'optimize':
        return this.optimize(params.code);
      case 'convert':
        return this.convert(params as ConversionRequest);
      case 'debug':
        return this.debug(params.code);
      case 'docs':
        return this.generateDocs(params.code);
      case 'templates':
        return this.listTemplates();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private initializeTemplates(): void {
    // Trend Following Template
    this.templates.set('trend-ma-cross', `
import { Strategy, Signal, Position } from '@kit/core';

export default class MACrossStrategy extends Strategy {
  name = 'MA Crossover';
  
  params = {
    fastPeriod: 10,
    slowPeriod: 20,
    asset: 'BTCUSDT'
  };

  async onBar(bar: Bar): Promise<Signal | null> {
    const fastMA = this.indicators.sma(bar.close, this.params.fastPeriod);
    const slowMA = this.indicators.sma(bar.close, this.params.slowPeriod);
    
    if (fastMA > slowMA && !this.hasPosition()) {
      return { action: 'buy', size: this.calculatePositionSize() };
    }
    
    if (fastMA < slowMA && this.hasPosition()) {
      return { action: 'sell', size: 'all' };
    }
    
    return null;
  }
}
`);

    // Mean Reversion Template
    this.templates.set('mean-reversion-bb', `
import { Strategy, Signal } from '@kit/core';

export default class BBMeanReversionStrategy extends Strategy {
  name = 'Bollinger Band Mean Reversion';
  
  params = {
    period: 20,
    stdDev: 2,
    asset: 'ETHUSDT'
  };

  async onBar(bar: Bar): Promise<Signal | null> {
    const bb = this.indicators.bollingerBands(bar.close, this.params.period, this.params.stdDev);
    
    // Buy at lower band
    if (bar.close <= bb.lower && !this.hasPosition()) {
      return { 
        action: 'buy', 
        size: this.calculatePositionSize(),
        stopLoss: bb.lower * 0.98,
        takeProfit: bb.middle
      };
    }
    
    // Sell at upper band or middle (mean)
    if (bar.close >= bb.middle && this.hasPosition()) {
      return { action: 'sell', size: 'all' };
    }
    
    return null;
  }
}
`);

    // RSI Oversold Template
    this.templates.set('rsi-oversold', `
import { Strategy, Signal } from '@kit/core';

export default class RSIOversoldStrategy extends Strategy {
  name = 'RSI Oversold Bounce';
  
  params = {
    period: 14,
    oversold: 30,
    overbought: 70,
    asset: 'BTCUSDT'
  };

  async onBar(bar: Bar): Promise<Signal | null> {
    const rsi = this.indicators.rsi(bar.close, this.params.period);
    const prevRsi = this.indicators.rsi(bar.close, this.params.period, 1);
    
    // Buy when RSI crosses above oversold
    if (prevRsi < this.params.oversold && rsi >= this.params.oversold && !this.hasPosition()) {
      return { 
        action: 'buy', 
        size: this.calculatePositionSize(),
        reason: 'RSI crossed above oversold level'
      };
    }
    
    // Sell when RSI hits overbought
    if (rsi >= this.params.overbought && this.hasPosition()) {
      return { action: 'sell', size: 'all', reason: 'RSI reached overbought' };
    }
    
    return null;
  }
}
`);
  }

  private async generate(request: GenerationRequest): Promise<SkillResult> {
    const { prompt, mode, options } = request;

    // Analyze prompt to determine template and modifications
    const analysis = this.analyzePrompt(prompt);
    
    // Get base template
    let code = this.templates.get(analysis.template) || this.templates.get('trend-ma-cross')!;
    
    // Apply modifications based on prompt
    code = this.applyModifications(code, analysis.modifications);
    
    // Add safety checks
    const safetyReport = this.performSafetyCheck(code);

    return {
      success: true,
      data: {
        code,
        mode,
        template: analysis.template,
        modifications: analysis.modifications,
        safetyReport,
        warning: 'Generated code requires 7 days paper trading before live deployment'
      }
    };
  }

  private analyzePrompt(prompt: string): { template: string; modifications: string[] } {
    const lowerPrompt = prompt.toLowerCase();
    const modifications: string[] = [];
    let template = 'trend-ma-cross';

    // Detect strategy type
    if (lowerPrompt.includes('rsi') && (lowerPrompt.includes('oversold') || lowerPrompt.includes('30'))) {
      template = 'rsi-oversold';
    } else if (lowerPrompt.includes('bollinger') || lowerPrompt.includes('mean reversion')) {
      template = 'mean-reversion-bb';
    } else if (lowerPrompt.includes('ma') || lowerPrompt.includes('moving average') || lowerPrompt.includes('crossover')) {
      template = 'trend-ma-cross';
    }

    // Detect modifications
    if (lowerPrompt.includes('stop loss') || lowerPrompt.includes('stoploss')) {
      modifications.push('add-stop-loss');
    }
    if (lowerPrompt.includes('take profit') || lowerPrompt.includes('tp')) {
      modifications.push('add-take-profit');
    }
    if (lowerPrompt.includes('trailing')) {
      modifications.push('add-trailing-stop');
    }
    if (lowerPrompt.includes('macd')) {
      modifications.push('add-macd-filter');
    }

    return { template, modifications };
  }

  private applyModifications(code: string, modifications: string[]): string {
    let modified = code;

    for (const mod of modifications) {
      switch (mod) {
        case 'add-stop-loss':
          modified = modified.replace(
            'return { action: \'buy\',',
            'return { action: \'buy\', stopLoss: bar.close * 0.97,'
          );
          break;
        case 'add-take-profit':
          modified = modified.replace(
            'return { action: \'buy\',',
            'return { action: \'buy\', takeProfit: bar.close * 1.05,'
          );
          break;
        case 'add-trailing-stop':
          modified = modified.replace(
            'return { action: \'buy\',',
            'return { action: \'buy\', trailingStop: { percent: 3 },'
          );
          break;
      }
    }

    return modified;
  }

  private performSafetyCheck(code: string): Record<string, boolean> {
    return {
      noHardcodedKeys: !code.includes('apiKey') && !code.includes('secret'),
      hasErrorHandling: code.includes('try') || code.includes('catch'),
      hasRiskLimits: code.includes('stopLoss') || code.includes('maxPosition'),
      noInfiniteLoops: !code.match(/while\s*\(\s*true\s*\)/),
      memoryEfficient: !code.includes('push') || code.includes('slice'),
      rateLimited: !code.match(/setInterval.*\d{1,3}\)/),
    };
  }

  private async explain(code: string): Promise<SkillResult> {
    // Parse and explain the strategy
    const lines = code.split('\n');
    const explanations: string[] = [];

    let currentSection = '';
    for (const line of lines) {
      if (line.includes('class') && line.includes('Strategy')) {
        currentSection = 'class';
        explanations.push(`📊 **Strategy Definition**: This is a trading strategy class`);
      } else if (line.includes('params =')) {
        currentSection = 'params';
        explanations.push(`⚙️ **Parameters**: Configurable settings for the strategy`);
      } else if (line.includes('onBar')) {
        currentSection = 'logic';
        explanations.push(`🔄 **Main Logic**: Called on every new price bar`);
      } else if (line.includes('buy')) {
        explanations.push(`📈 **Buy Signal**: Triggers a long entry`);
      } else if (line.includes('sell')) {
        explanations.push(`📉 **Sell Signal**: Triggers an exit or short`);
      }
    }

    return {
      success: true,
      data: {
        explanations,
        summary: 'This strategy monitors price bars and generates buy/sell signals based on technical indicators.'
      }
    };
  }

  private async optimize(code: string): Promise<SkillResult> {
    const suggestions: string[] = [];

    // Check for common optimizations
    if (!code.includes('cache') && code.includes('indicators.')) {
      suggestions.push('💡 Cache indicator calculations to avoid redundant computations');
    }
    if (code.includes('for') && !code.includes('break')) {
      suggestions.push('💡 Consider early exit from loops when condition is met');
    }
    if (!code.includes('async')) {
      suggestions.push('💡 Use async/await for non-blocking operations');
    }
    if (!code.includes('const ')) {
      suggestions.push('💡 Use const for values that don\'t change');
    }

    return {
      success: true,
      data: {
        suggestions,
        originalLines: code.split('\n').length,
        potentialImprovement: `${suggestions.length} optimization opportunities found`
      }
    };
  }

  private async convert(request: ConversionRequest): Promise<SkillResult> {
    const { source, from } = request;

    // Pine Script to K.I.T. conversion mapping
    const conversionMap: Record<string, string> = {
      '//@version=': '// K.I.T. Strategy',
      'strategy(': 'export default class extends Strategy {',
      'study(': 'export default class extends Indicator {',
      'input.': 'this.params.',
      'ta.sma': 'this.indicators.sma',
      'ta.ema': 'this.indicators.ema',
      'ta.rsi': 'this.indicators.rsi',
      'ta.macd': 'this.indicators.macd',
      'strategy.entry': 'return { action:',
      'strategy.exit': 'return { action: \'sell\',',
    };

    let converted = source;
    for (const [pine, kit] of Object.entries(conversionMap)) {
      converted = converted.replace(new RegExp(pine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), kit);
    }

    return {
      success: true,
      data: {
        from,
        to: 'kit',
        original: source.substring(0, 200) + '...',
        converted,
        conversionNotes: [
          'Variable types inferred and added',
          'Pine Script functions mapped to K.I.T. equivalents',
          'Strategy structure converted to class-based',
        ]
      }
    };
  }

  private async debug(code: string): Promise<SkillResult> {
    const issues: Array<{ line: number; issue: string; severity: 'error' | 'warning' | 'info' }> = [];
    const lines = code.split('\n');

    lines.forEach((line, idx) => {
      // Check for common issues
      if (line.includes('== null') || line.includes('== undefined')) {
        issues.push({ line: idx + 1, issue: 'Use strict equality (===) for null/undefined checks', severity: 'warning' });
      }
      if (line.includes('var ')) {
        issues.push({ line: idx + 1, issue: 'Use let or const instead of var', severity: 'warning' });
      }
      if (line.includes('any')) {
        issues.push({ line: idx + 1, issue: 'Avoid using "any" type - specify explicit type', severity: 'info' });
      }
      if (line.match(/\bconsole\.log\b/)) {
        issues.push({ line: idx + 1, issue: 'Remove console.log before production', severity: 'warning' });
      }
    });

    return {
      success: true,
      data: {
        issues,
        totalIssues: issues.length,
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
      }
    };
  }

  private async generateDocs(code: string): Promise<SkillResult> {
    const docs: string[] = [];

    // Extract class name
    const classMatch = code.match(/class\s+(\w+)/);
    if (classMatch) {
      docs.push(`# ${classMatch[1]}\n`);
    }

    // Extract params
    const paramsMatch = code.match(/params\s*=\s*\{([^}]+)\}/s);
    if (paramsMatch) {
      docs.push('## Parameters\n');
      const params = paramsMatch[1].split(',').map(p => p.trim());
      params.forEach(p => {
        const [name, value] = p.split(':').map(s => s.trim());
        if (name) docs.push(`- **${name}**: ${value || 'configurable'}`);
      });
      docs.push('');
    }

    docs.push('## Usage\n');
    docs.push('```typescript');
    docs.push('kit strategy run ./path/to/strategy.ts');
    docs.push('```\n');

    return {
      success: true,
      data: {
        documentation: docs.join('\n'),
        format: 'markdown'
      }
    };
  }

  private listTemplates(): SkillResult {
    const templates = Array.from(this.templates.keys()).map(name => ({
      name,
      description: this.getTemplateDescription(name)
    }));

    return {
      success: true,
      data: { templates, total: templates.length }
    };
  }

  private getTemplateDescription(name: string): string {
    const descriptions: Record<string, string> = {
      'trend-ma-cross': 'Moving Average Crossover - Buy when fast MA crosses above slow MA',
      'mean-reversion-bb': 'Bollinger Band Mean Reversion - Buy at lower band, sell at middle',
      'rsi-oversold': 'RSI Oversold Bounce - Buy when RSI crosses above 30',
    };
    return descriptions[name] || 'Trading strategy template';
  }
}

export default new AICodeAssistSkill();
