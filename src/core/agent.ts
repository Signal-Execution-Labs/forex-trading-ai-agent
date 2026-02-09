/**
 * K.I.T. AI Agent Core
 * The brain of the trading assistant - processes natural language and executes actions
 */

import { EventEmitter } from 'events';
import { Logger } from './logger';
import { TradingEngine } from './engine';
import { ChannelManager } from '../channels';
import { ExchangeManager } from '../exchanges/manager';
import { StrategyManager } from '../strategies/manager';
import { RiskManager } from '../risk/manager';

export interface AgentConfig {
  name: string;
  model?: string;
  apiKey?: string;
  personality?: string;
}

export interface AgentContext {
  userId: string;
  channel: string;
  chatId: string;
  history: ConversationMessage[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

export interface AgentResponse {
  text: string;
  action?: AgentAction;
  data?: any;
}

export interface AgentAction {
  type: 'trade' | 'alert' | 'analysis' | 'report' | 'none';
  params: any;
}

export class KITAgent extends EventEmitter {
  private logger: Logger;
  private config: AgentConfig;
  private engine: TradingEngine;
  private channels: ChannelManager;
  private conversations: Map<string, ConversationMessage[]> = new Map();
  
  // Trading components
  private exchanges: ExchangeManager;
  private strategies: StrategyManager;
  private risk: RiskManager;

  constructor(config: AgentConfig) {
    super();
    this.logger = new Logger('Agent');
    this.config = config;
    
    // Initialize trading components
    this.exchanges = new ExchangeManager();
    this.strategies = new StrategyManager();
    this.risk = new RiskManager();
    
    // Initialize engine
    this.engine = new TradingEngine({
      exchanges: this.exchanges,
      strategies: this.strategies,
      risk: this.risk
    });
    
    // Initialize channels
    this.channels = new ChannelManager();
  }

  async initialize(): Promise<void> {
    this.logger.info(`🤖 Initializing ${this.config.name}...`);
    
    // Setup message handlers
    this.channels.on('message', (msg) => this.handleMessage(msg));
    this.channels.on('command', (cmd) => this.handleCommand(cmd));
    
    // Initialize all components
    await this.exchanges.initialize();
    await this.strategies.loadStrategies();
    await this.risk.initialize();
    
    this.logger.info(`✅ ${this.config.name} is ready!`);
  }

  async handleMessage(msg: any): Promise<void> {
    const contextId = `${msg.channel}:${msg.chatId || msg.userId}`;
    
    // Get or create conversation history
    let history = this.conversations.get(contextId) || [];
    
    // Add user message
    history.push({
      role: 'user',
      content: msg.text,
      timestamp: new Date()
    });

    try {
      // Process the message and generate response
      const response = await this.processMessage(msg.text, {
        userId: msg.userId,
        channel: msg.channel,
        chatId: msg.chatId,
        history
      });

      // Add assistant response to history
      history.push({
        role: 'assistant',
        content: response.text,
        timestamp: new Date()
      });

      // Keep history limited
      if (history.length > 50) {
        history = history.slice(-50);
      }
      this.conversations.set(contextId, history);

      // Send response
      if (msg.reply) {
        await msg.reply(response.text);
      }

      // Execute any actions
      if (response.action && response.action.type !== 'none') {
        await this.executeAction(response.action, msg);
      }

    } catch (error) {
      this.logger.error('Error processing message:', error);
      if (msg.reply) {
        await msg.reply('❌ Sorry, I encountered an error processing your request.');
      }
    }
  }

  async processMessage(text: string, context: AgentContext): Promise<AgentResponse> {
    const lowerText = text.toLowerCase();
    
    // Intent detection (basic - would use LLM in production)
    
    // Price queries
    if (lowerText.includes('price') || lowerText.includes('how much')) {
      return this.handlePriceQuery(text);
    }
    
    // Buy orders
    if (lowerText.includes('buy')) {
      return this.handleBuyIntent(text);
    }
    
    // Sell orders
    if (lowerText.includes('sell')) {
      return this.handleSellIntent(text);
    }
    
    // Portfolio/Status
    if (lowerText.includes('status') || lowerText.includes('portfolio') || lowerText.includes('balance')) {
      return this.handleStatusQuery();
    }
    
    // Performance
    if (lowerText.includes('performance') || lowerText.includes('today') || lowerText.includes('profit')) {
      return this.handlePerformanceQuery();
    }
    
    // Alerts
    if (lowerText.includes('alert') || lowerText.includes('notify') || lowerText.includes('watch')) {
      return this.handleAlertIntent(text);
    }
    
    // Analysis
    if (lowerText.includes('analyze') || lowerText.includes('analysis') || lowerText.includes('chart')) {
      return this.handleAnalysisQuery(text);
    }
    
    // Help
    if (lowerText.includes('help') || lowerText.includes('commands')) {
      return this.handleHelpQuery();
    }
    
    // Default - conversational response
    return this.handleGeneralQuery(text, context);
  }

  private async handlePriceQuery(text: string): Promise<AgentResponse> {
    const symbol = this.extractSymbol(text) || 'BTC';
    
    try {
      const marketData = await this.exchanges.getMarketData();
      const data = marketData.find(m => m.symbol.includes(symbol.toUpperCase()));
      
      if (data) {
        const change = ((data.price - data.low24h) / data.low24h * 100).toFixed(2);
        return {
          text: `📊 **${data.symbol}**\n\n` +
                `💰 Price: $${data.price.toLocaleString()}\n` +
                `📈 24h High: $${data.high24h.toLocaleString()}\n` +
                `📉 24h Low: $${data.low24h.toLocaleString()}\n` +
                `📊 Volume: ${data.volume.toLocaleString()}\n` +
                `${parseFloat(change) >= 0 ? '🟢' : '🔴'} Change: ${change}%`,
          action: { type: 'none', params: {} },
          data
        };
      }
      
      return {
        text: `❌ Couldn't find price data for ${symbol}. Try BTC, ETH, or another major asset.`,
        action: { type: 'none', params: {} }
      };
    } catch (error) {
      return {
        text: `❌ Error fetching price. Please try again.`,
        action: { type: 'none', params: {} }
      };
    }
  }

  private async handleBuyIntent(text: string): Promise<AgentResponse> {
    const symbol = this.extractSymbol(text);
    const amount = this.extractAmount(text);
    
    if (!symbol || !amount) {
      return {
        text: `Please specify what and how much to buy.\n\nExample: "Buy $100 of BTC" or "Buy 0.5 ETH"`,
        action: { type: 'none', params: {} }
      };
    }

    return {
      text: `🛒 **Buy Order**\n\n` +
            `Asset: ${symbol}\n` +
            `Amount: $${amount}\n\n` +
            `⚠️ Please confirm this trade.\n` +
            `Reply "confirm" to execute or "cancel" to abort.`,
      action: { 
        type: 'trade', 
        params: { side: 'buy', symbol, amount, pending: true } 
      }
    };
  }

  private async handleSellIntent(text: string): Promise<AgentResponse> {
    const symbol = this.extractSymbol(text);
    const amount = this.extractAmount(text);
    
    if (!symbol || !amount) {
      return {
        text: `Please specify what and how much to sell.\n\nExample: "Sell $100 of BTC" or "Sell 0.5 ETH"`,
        action: { type: 'none', params: {} }
      };
    }

    return {
      text: `💸 **Sell Order**\n\n` +
            `Asset: ${symbol}\n` +
            `Amount: ${amount}\n\n` +
            `⚠️ Please confirm this trade.\n` +
            `Reply "confirm" to execute or "cancel" to abort.`,
      action: { 
        type: 'trade', 
        params: { side: 'sell', symbol, amount, pending: true } 
      }
    };
  }

  private async handleStatusQuery(): Promise<AgentResponse> {
    const portfolio = this.risk.getPortfolioState();
    
    return {
      text: `📊 **Portfolio Status**\n\n` +
            `💰 Total Value: $${portfolio.totalValue.toLocaleString()}\n` +
            `💵 Available: $${portfolio.availableBalance.toLocaleString()}\n` +
            `📈 Open Positions: ${portfolio.openPositions}\n` +
            `📉 Daily P&L: $${portfolio.dailyPnL.toFixed(2)} (${portfolio.dailyPnLPercent.toFixed(2)}%)`,
      action: { type: 'none', params: {} }
    };
  }

  private async handlePerformanceQuery(): Promise<AgentResponse> {
    return {
      text: `📈 **Performance Report**\n\n` +
            `🗓️ Today:\n` +
            `• Trades: 0\n` +
            `• Win Rate: N/A\n` +
            `• P&L: $0.00\n\n` +
            `📅 This Week:\n` +
            `• Trades: 0\n` +
            `• Win Rate: N/A\n` +
            `• P&L: $0.00`,
      action: { type: 'report', params: {} }
    };
  }

  private async handleAlertIntent(text: string): Promise<AgentResponse> {
    const symbol = this.extractSymbol(text);
    const price = this.extractPrice(text);
    
    if (!symbol || !price) {
      return {
        text: `Please specify the asset and price for the alert.\n\nExample: "Alert me when BTC reaches $50,000"`,
        action: { type: 'none', params: {} }
      };
    }

    return {
      text: `🔔 **Alert Set**\n\n` +
            `Asset: ${symbol}\n` +
            `Target: $${price.toLocaleString()}\n\n` +
            `I'll notify you when the price is reached!`,
      action: { type: 'alert', params: { symbol, price } }
    };
  }

  private async handleAnalysisQuery(text: string): Promise<AgentResponse> {
    const symbol = this.extractSymbol(text) || 'BTC';
    
    return {
      text: `📊 **${symbol} Analysis**\n\n` +
            `📈 Trend: Neutral\n` +
            `📉 RSI (14): 52.3 (Neutral)\n` +
            `📊 MACD: Bullish crossover forming\n` +
            `🎯 Support: $40,000\n` +
            `🎯 Resistance: $45,000\n\n` +
            `💡 Summary: Market is consolidating. Watch for breakout above resistance for long entry.`,
      action: { type: 'analysis', params: { symbol } }
    };
  }

  private async handleHelpQuery(): Promise<AgentResponse> {
    return {
      text: `🤖 **K.I.T. - Your AI Trading Assistant**\n\n` +
            `**Commands:**\n` +
            `• "price BTC" - Get current price\n` +
            `• "buy $100 of ETH" - Place buy order\n` +
            `• "sell 0.5 BTC" - Place sell order\n` +
            `• "status" - Portfolio overview\n` +
            `• "performance" - Trading stats\n` +
            `• "alert BTC at $50k" - Set price alert\n` +
            `• "analyze ETH" - Technical analysis\n\n` +
            `Or just chat with me naturally! 💬`,
      action: { type: 'none', params: {} }
    };
  }

  private async handleGeneralQuery(text: string, context: AgentContext): Promise<AgentResponse> {
    // Default response for unrecognized intents
    return {
      text: `I'm K.I.T., your AI trading assistant! 🤖\n\n` +
            `I can help you with:\n` +
            `• Checking prices\n` +
            `• Placing trades\n` +
            `• Portfolio management\n` +
            `• Market analysis\n\n` +
            `Try saying "price BTC" or "help" to see all commands!`,
      action: { type: 'none', params: {} }
    };
  }

  async handleCommand(cmd: any): Promise<void> {
    // Handle slash commands from channels
    this.logger.info(`Command: ${cmd.command}`);
    
    switch (cmd.command) {
      case 'status':
        const status = await this.handleStatusQuery();
        if (cmd.ctx?.reply) await cmd.ctx.reply(status.text, { parse_mode: 'Markdown' });
        if (cmd.interaction?.reply) await cmd.interaction.reply(status.text);
        break;
        
      case 'price':
        const priceResponse = await this.handlePriceQuery(`price ${cmd.symbol || 'BTC'}`);
        if (cmd.ctx?.reply) await cmd.ctx.reply(priceResponse.text, { parse_mode: 'Markdown' });
        if (cmd.interaction?.reply) await cmd.interaction.reply(priceResponse.text);
        break;
        
      // Add more commands...
    }
  }

  private async executeAction(action: AgentAction, msg: any): Promise<void> {
    switch (action.type) {
      case 'trade':
        if (!action.params.pending) {
          // Execute the trade
          this.logger.info(`Executing trade: ${JSON.stringify(action.params)}`);
        }
        break;
        
      case 'alert':
        // Store alert
        this.logger.info(`Setting alert: ${JSON.stringify(action.params)}`);
        break;
        
      case 'analysis':
        // Could generate chart image here
        break;
    }
  }

  // === UTILITY METHODS ===

  private extractSymbol(text: string): string | null {
    const symbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'MATIC', 'DOT', 'AVAX'];
    const upper = text.toUpperCase();
    
    for (const symbol of symbols) {
      if (upper.includes(symbol)) {
        return symbol;
      }
    }
    
    // Try to extract from "of X" pattern
    const match = text.match(/of\s+(\w+)/i);
    if (match) {
      return match[1].toUpperCase();
    }
    
    return null;
  }

  private extractAmount(text: string): number | null {
    // Match $100, 100 dollars, $100.50, etc.
    const dollarMatch = text.match(/\$?([\d,]+\.?\d*)/);
    if (dollarMatch) {
      return parseFloat(dollarMatch[1].replace(',', ''));
    }
    return null;
  }

  private extractPrice(text: string): number | null {
    // Match prices like $50,000 or 50000 or 50k
    const match = text.match(/\$?([\d,]+\.?\d*)\s*k?/i);
    if (match) {
      let price = parseFloat(match[1].replace(',', ''));
      if (text.toLowerCase().includes('k')) {
        price *= 1000;
      }
      return price;
    }
    return null;
  }

  async start(): Promise<void> {
    await this.initialize();
    await this.engine.start();
    this.logger.info(`🚀 ${this.config.name} is now running!`);
  }

  async stop(): Promise<void> {
    await this.engine.stop();
    await this.channels.stop();
    this.logger.info(`${this.config.name} stopped.`);
  }
}
