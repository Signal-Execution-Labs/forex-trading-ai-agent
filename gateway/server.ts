/**
 * K.I.T. Gateway Server
 * 
 * WebSocket server that connects all K.I.T. components:
 * - Skills (exchange-connector, portfolio-tracker, etc.)
 * - Tools (trade, market, portfolio, backtest)
 * - Channels (Telegram, Discord via OpenClaw)
 * 
 * Inspired by OpenClaw's Gateway architecture.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { SkillLoader } from './skill-loader';
import { ToolRegistry } from './tool-registry';
import { Protocol, Request, Response, Event } from './protocol';

export interface GatewayConfig {
  port: number;
  host: string;
  auth?: {
    token?: string;
    password?: string;
  };
  skills?: {
    paths: string[];
  };
}

export class Gateway extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private skillLoader: SkillLoader;
  private toolRegistry: ToolRegistry;
  private config: GatewayConfig;

  constructor(config: GatewayConfig) {
    super();
    this.config = config;
    this.skillLoader = new SkillLoader();
    this.toolRegistry = new ToolRegistry();
  }

  async start(): Promise<void> {
    // Load skills
    await this.skillLoader.loadSkills(this.config.skills?.paths || ['./skills']);
    
    // Register tools
    this.registerBuiltinTools();
    
    // Start WebSocket server
    this.wss = new WebSocketServer({
      port: this.config.port,
      host: this.config.host,
    });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.emit('error', error);
    });

    console.log(`🚀 K.I.T. Gateway started on ${this.config.host}:${this.config.port}`);
    this.emit('started');
  }

  async stop(): Promise<void> {
    if (this.wss) {
      // Notify all clients
      this.broadcast({
        type: 'event',
        event: 'shutdown',
        payload: { reason: 'Gateway stopping' }
      });

      // Close all connections
      for (const [id, ws] of this.clients) {
        ws.close(1000, 'Gateway shutdown');
      }
      this.clients.clear();

      // Close server
      this.wss.close();
      this.wss = null;
    }
    
    console.log('👋 K.I.T. Gateway stopped');
    this.emit('stopped');
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleMessage(clientId, ws, message);
      } catch (error) {
        this.sendError(ws, 'INVALID_REQUEST', 'Invalid JSON');
      }
    });

    ws.on('close', () => {
      this.clients.delete(clientId);
      this.emit('client:disconnected', clientId);
    });

    ws.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
    });

    // Wait for connect message
    this.clients.set(clientId, ws);
  }

  private async handleMessage(clientId: string, ws: WebSocket, message: any): Promise<void> {
    const { type, id, method, params } = message as Request;

    if (type !== 'req') {
      this.sendError(ws, 'INVALID_REQUEST', 'Expected type: req');
      return;
    }

    try {
      let result: any;

      switch (method) {
        case 'connect':
          result = await this.handleConnect(clientId, params);
          break;
        case 'health':
          result = await this.handleHealth();
          break;
        case 'status':
          result = await this.handleStatus();
          break;
        case 'tool.invoke':
          result = await this.handleToolInvoke(params);
          break;
        case 'skill.list':
          result = await this.handleSkillList();
          break;
        case 'trade.execute':
          result = await this.handleTradeExecute(params);
          break;
        case 'market.data':
          result = await this.handleMarketData(params);
          break;
        case 'portfolio.snapshot':
          result = await this.handlePortfolioSnapshot(params);
          break;
        case 'backtest.run':
          result = await this.handleBacktestRun(clientId, ws, params);
          break;
        default:
          throw new Error(`Unknown method: ${method}`);
      }

      this.sendResponse(ws, id, true, result);
    } catch (error: any) {
      this.sendResponse(ws, id, false, undefined, {
        code: 'ERROR',
        message: error.message,
      });
    }
  }

  private async handleConnect(clientId: string, params: any): Promise<any> {
    // Authenticate if required
    if (this.config.auth?.token) {
      if (params.auth?.token !== this.config.auth.token) {
        throw new Error('Invalid token');
      }
    }

    return {
      type: 'hello-ok',
      clientId,
      version: '1.0.0',
      skills: this.skillLoader.getLoadedSkills(),
      tools: this.toolRegistry.listTools(),
    };
  }

  private async handleHealth(): Promise<any> {
    return {
      ok: true,
      uptime: process.uptime(),
      skills: this.skillLoader.getHealthStatus(),
      exchanges: await this.getExchangeStatus(),
    };
  }

  private async handleStatus(): Promise<any> {
    return {
      gateway: 'running',
      clients: this.clients.size,
      skills: this.skillLoader.getLoadedSkills().length,
      tools: this.toolRegistry.listTools().length,
    };
  }

  private async handleToolInvoke(params: any): Promise<any> {
    const { tool, args } = params;
    return await this.toolRegistry.invoke(tool, args);
  }

  private async handleSkillList(): Promise<any> {
    return {
      skills: this.skillLoader.getLoadedSkills(),
    };
  }

  private async handleTradeExecute(params: any): Promise<any> {
    // Delegate to auto-trader skill
    const trader = this.skillLoader.getSkill('auto-trader');
    if (!trader) {
      throw new Error('Auto-trader skill not loaded');
    }
    return await trader.execute('trade', params);
  }

  private async handleMarketData(params: any): Promise<any> {
    // Delegate to market-analysis skill
    const analysis = this.skillLoader.getSkill('market-analysis');
    if (!analysis) {
      throw new Error('Market-analysis skill not loaded');
    }
    return await analysis.execute('getData', params);
  }

  private async handlePortfolioSnapshot(params: any): Promise<any> {
    // Delegate to portfolio-tracker skill
    const tracker = this.skillLoader.getSkill('portfolio-tracker');
    if (!tracker) {
      throw new Error('Portfolio-tracker skill not loaded');
    }
    return await tracker.execute('snapshot', params);
  }

  private async handleBacktestRun(clientId: string, ws: WebSocket, params: any): Promise<any> {
    // Backtests can be long-running, so we stream progress
    const backtester = this.skillLoader.getSkill('backtester');
    if (!backtester) {
      throw new Error('Backtester skill not loaded');
    }

    // Stream progress events
    if (backtester.on) {
      backtester.on('progress', (progress: any) => {
        this.sendEvent(ws, 'backtest:progress', progress);
      });
    }

    const result = await backtester.execute('run', params);
    
    if (backtester.removeAllListeners) {
      backtester.removeAllListeners('progress');
    }
    
    return result;
  }

  private async getExchangeStatus(): Promise<any> {
    const connector = this.skillLoader.getSkill('exchange-connector');
    if (!connector) {
      return { connected: false };
    }
    return await connector.execute('status', {});
  }

  private registerBuiltinTools(): void {
    // Trade tool
    this.toolRegistry.register({
      name: 'trade',
      description: 'Execute trades on connected exchanges',
      parameters: {
        action: { type: 'string', enum: ['buy', 'sell'] },
        pair: { type: 'string' },
        amount: { type: 'number' },
        type: { type: 'string', enum: ['market', 'limit'] },
        price: { type: 'number', optional: true },
      },
      handler: async (args) => {
        return await this.handleTradeExecute(args);
      },
    });

    // Market tool
    this.toolRegistry.register({
      name: 'market',
      description: 'Get market data and analysis',
      parameters: {
        action: { type: 'string', enum: ['price', 'ohlcv', 'orderbook', 'analyze'] },
        pair: { type: 'string' },
        timeframe: { type: 'string', optional: true },
      },
      handler: async (args) => {
        return await this.handleMarketData(args);
      },
    });

    // Portfolio tool
    this.toolRegistry.register({
      name: 'portfolio',
      description: 'Get portfolio information',
      parameters: {
        action: { type: 'string', enum: ['snapshot', 'balance', 'positions', 'pnl'] },
        exchange: { type: 'string', optional: true },
      },
      handler: async (args) => {
        return await this.handlePortfolioSnapshot(args);
      },
    });

    // Backtest tool
    this.toolRegistry.register({
      name: 'backtest',
      description: 'Run strategy backtests',
      parameters: {
        strategy: { type: 'string' },
        pair: { type: 'string' },
        start: { type: 'string' },
        end: { type: 'string' },
        capital: { type: 'number', optional: true },
      },
      handler: async (args) => {
        // Note: This would need proper client context for streaming
        const backtester = this.skillLoader.getSkill('backtester');
        if (!backtester) {
          throw new Error('Backtester skill not loaded');
        }
        return await backtester.execute('run', args);
      },
    });
  }

  private sendResponse(ws: WebSocket, id: string, ok: boolean, payload?: any, error?: any): void {
    const response: Response = { type: 'res', id, ok };
    if (ok) {
      response.payload = payload;
    } else {
      response.error = error;
    }
    ws.send(JSON.stringify(response));
  }

  private sendEvent(ws: WebSocket, event: string, payload: any): void {
    const evt: Event = { type: 'event', event, payload };
    ws.send(JSON.stringify(evt));
  }

  private sendError(ws: WebSocket, code: string, message: string): void {
    ws.send(JSON.stringify({
      type: 'res',
      id: 'error',
      ok: false,
      error: { code, message },
    }));
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    for (const ws of this.clients.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private generateClientId(): string {
    return `kit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// CLI entry point
if (require.main === module) {
  const gateway = new Gateway({
    port: parseInt(process.env.KIT_GATEWAY_PORT || '18800'),
    host: process.env.KIT_GATEWAY_HOST || '127.0.0.1',
    auth: {
      token: process.env.KIT_GATEWAY_TOKEN,
    },
  });

  gateway.start().catch(console.error);

  process.on('SIGINT', async () => {
    await gateway.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await gateway.stop();
    process.exit(0);
  });
}
