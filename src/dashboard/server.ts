/**
 * K.I.T. Dashboard Server
 * 
 * Serves the web dashboard with integrated chat interface.
 * Connects to K.I.T. Gateway for real-time communication.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { WebSocket, WebSocketServer } from 'ws';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

interface DashboardConfig {
  port: number;
  gatewayUrl?: string;
  staticDir?: string;
  openBrowser?: boolean;
}

interface ChatMessage {
  type: 'message' | 'command' | 'response' | 'status' | 'trade' | 'signal';
  content: string;
  timestamp?: number;
  metadata?: Record<string, any>;
}

export class DashboardServer {
  private config: DashboardConfig;
  private wss: WebSocketServer | null = null;
  private gatewayWs: WebSocket | null = null;
  private clients: Set<WebSocket> = new Set();
  
  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      port: config.port || 3000,
      gatewayUrl: config.gatewayUrl || 'ws://localhost:18799',
      staticDir: config.staticDir || join(__dirname),
    };
  }
  
  /**
   * Start the dashboard server
   */
  async start(): Promise<void> {
    const server = createServer((req, res) => this.handleRequest(req, res));
    
    // WebSocket server for dashboard clients
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws) => {
      console.log('Dashboard client connected');
      this.clients.add(ws);
      
      // Send welcome message
      this.sendToClient(ws, {
        type: 'status',
        content: 'Connected to K.I.T. Dashboard',
        timestamp: Date.now(),
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString()) as ChatMessage;
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Invalid message from client:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('Dashboard client disconnected');
        this.clients.delete(ws);
      });
    });
    
    // Connect to K.I.T. Gateway
    this.connectToGateway();
    
    server.listen(this.config.port, async () => {
      const url = `http://localhost:${this.config.port}`;
      console.log(`🖥️  K.I.T. Dashboard running at ${url}`);
      console.log(`📡 Gateway URL: ${this.config.gatewayUrl}`);
      
      // Open browser if requested
      if (this.config.openBrowser) {
        try {
          const { exec } = await import('child_process');
          const platform = process.platform;
          
          const command = platform === 'win32' ? `start ${url}`
            : platform === 'darwin' ? `open ${url}`
            : `xdg-open ${url}`;
          
          exec(command, (error) => {
            if (error) {
              console.log(`   Open ${url} in your browser`);
            }
          });
        } catch {
          console.log(`   Open ${url} in your browser`);
        }
      }
    });
  }
  
  /**
   * Handle HTTP requests (serve static files)
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let filePath = req.url === '/' ? '/index.html' : req.url || '/index.html';
    
    // Security: prevent directory traversal
    filePath = filePath.replace(/\.\./g, '');
    
    const fullPath = join(this.config.staticDir!, filePath);
    const ext = extname(fullPath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    
    try {
      const content = await readFile(fullPath);
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    } catch (error) {
      // Try index.html for SPA routing
      try {
        const indexContent = await readFile(join(this.config.staticDir!, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexContent);
      } catch {
        res.writeHead(404);
        res.end('Not Found');
      }
    }
  }
  
  /**
   * Connect to K.I.T. Gateway
   */
  private connectToGateway(): void {
    try {
      this.gatewayWs = new WebSocket(this.config.gatewayUrl!);
      
      this.gatewayWs.on('open', () => {
        console.log('Connected to K.I.T. Gateway');
        this.broadcast({
          type: 'status',
          content: '🔗 Connected to K.I.T. Gateway',
          timestamp: Date.now(),
        });
      });
      
      this.gatewayWs.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleGatewayMessage(message);
        } catch (error) {
          console.error('Invalid message from gateway:', error);
        }
      });
      
      this.gatewayWs.on('close', () => {
        console.log('Disconnected from K.I.T. Gateway');
        this.broadcast({
          type: 'status',
          content: '⚠️ Disconnected from K.I.T. Gateway. Reconnecting...',
          timestamp: Date.now(),
        });
        
        // Reconnect after delay
        setTimeout(() => this.connectToGateway(), 5000);
      });
      
      this.gatewayWs.on('error', (error) => {
        console.error('Gateway connection error:', error);
      });
    } catch (error) {
      console.error('Failed to connect to gateway:', error);
      setTimeout(() => this.connectToGateway(), 5000);
    }
  }
  
  /**
   * Handle messages from dashboard clients
   */
  private handleClientMessage(client: WebSocket, message: ChatMessage): void {
    console.log('Client message:', message);
    
    // Forward to gateway if connected
    if (this.gatewayWs && this.gatewayWs.readyState === WebSocket.OPEN) {
      this.gatewayWs.send(JSON.stringify({
        type: 'user_message',
        content: message.content,
        timestamp: Date.now(),
        source: 'dashboard',
      }));
    } else {
      // Gateway not connected - provide offline response
      this.sendToClient(client, {
        type: 'response',
        content: this.getOfflineResponse(message.content),
        timestamp: Date.now(),
      });
    }
  }
  
  /**
   * Handle messages from K.I.T. Gateway
   */
  private handleGatewayMessage(message: any): void {
    // Broadcast to all dashboard clients
    this.broadcast({
      type: message.type || 'response',
      content: message.content || message.text || JSON.stringify(message),
      timestamp: Date.now(),
      metadata: message.metadata,
    });
  }
  
  /**
   * Send message to a specific client
   */
  private sendToClient(client: WebSocket, message: ChatMessage): void {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }
  
  /**
   * Broadcast message to all connected clients
   */
  private broadcast(message: ChatMessage): void {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }
  
  /**
   * Generate offline response when gateway is not connected
   */
  private getOfflineResponse(input: string): string {
    const lowerInput = input.toLowerCase();
    
    if (lowerInput.includes('portfolio')) {
      return '📊 **Portfolio** (Demo Mode)\n\n' +
        'Connect to K.I.T. Gateway to see your real portfolio.\n\n' +
        'Start the gateway with: `kit start`';
    }
    
    if (lowerInput.includes('signal')) {
      return '📡 **Signals** (Demo Mode)\n\n' +
        'Connect to K.I.T. Gateway to see live signals.\n\n' +
        'Configure signal channels in `signal-copier.yaml`';
    }
    
    if (lowerInput.includes('trade')) {
      return '⚡ **Trades** (Demo Mode)\n\n' +
        'Connect to K.I.T. Gateway to see active trades.\n\n' +
        'Start the gateway with: `kit start`';
    }
    
    if (lowerInput.includes('help')) {
      return '🤖 **K.I.T. Help**\n\n' +
        '**Available Commands:**\n' +
        '• `portfolio` - View your holdings\n' +
        '• `signals` - See active signals\n' +
        '• `trades` - View open trades\n' +
        '• `analyze [symbol]` - Technical analysis\n' +
        '• `backtest [strategy]` - Test a strategy\n\n' +
        '**Quick Start:**\n' +
        '1. Configure your exchanges in `.env`\n' +
        '2. Run `kit start` to start the gateway\n' +
        '3. Chat with K.I.T. here or via Telegram';
    }
    
    return `I received: "${input}"\n\n` +
      '⚠️ K.I.T. Gateway is not connected. Start it with:\n\n' +
      '```\nkit start\n```\n\n' +
      'Then I\'ll be able to help you with trading!';
  }
}

/**
 * Start the dashboard server
 */
export async function startDashboard(config?: Partial<DashboardConfig>): Promise<DashboardServer> {
  const dashboard = new DashboardServer(config);
  await dashboard.start();
  return dashboard;
}

// CLI entry point
if (require.main === module) {
  const port = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
  const gatewayUrl = process.env.GATEWAY_URL || 'ws://localhost:18799';
  
  startDashboard({ port, gatewayUrl }).catch(console.error);
}
