/**
 * K.I.T. Basic Bot Example
 * 
 * A simple trading bot that:
 * 1. Connects to the Gateway
 * 2. Monitors BTC price
 * 3. Executes trades based on simple conditions
 * 
 * Run: npx ts-node examples/basic-bot.ts
 */

import WebSocket from 'ws';

interface KitConfig {
  gatewayUrl: string;
  token?: string;
}

interface TradeParams {
  action: 'buy' | 'sell';
  pair: string;
  amount: number;
  type: 'market' | 'limit';
  price?: number;
}

class BasicBot {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<string, { resolve: Function; reject: Function }>();
  private isConnected = false;
  
  constructor(private config: KitConfig) {}
  
  /**
   * Connect to K.I.T. Gateway
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log(`🔌 Connecting to ${this.config.gatewayUrl}...`);
      
      this.ws = new WebSocket(this.config.gatewayUrl);
      
      this.ws.onopen = async () => {
        console.log('✅ WebSocket connected');
        try {
          await this.handshake();
          this.isConnected = true;
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data.toString());
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onclose = () => {
        console.log('👋 WebSocket closed');
        this.isConnected = false;
      };
    });
  }
  
  /**
   * Send connect handshake
   */
  private async handshake(): Promise<any> {
    const result = await this.request('connect', {
      client: {
        id: 'basic-bot',
        displayName: 'Basic Trading Bot',
        version: '1.0.0',
        platform: 'node'
      },
      auth: {
        token: this.config.token
      }
    });
    
    console.log('🤝 Handshake complete:', result.clientId);
    console.log(`   Skills: ${result.skills?.length || 0}`);
    console.log(`   Tools: ${result.tools?.length || 0}`);
    
    return result;
  }
  
  /**
   * Send a request and wait for response
   */
  async request(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    const id = `req-${++this.requestId}`;
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      
      const message = JSON.stringify({
        type: 'req',
        id,
        method,
        params
      });
      
      this.ws!.send(message);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }
  
  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const msg = JSON.parse(data);
      
      if (msg.type === 'res') {
        // Handle response
        const handler = this.pending.get(msg.id);
        if (handler) {
          this.pending.delete(msg.id);
          if (msg.ok) {
            handler.resolve(msg.payload);
          } else {
            handler.reject(new Error(msg.error?.message || 'Request failed'));
          }
        }
      } else if (msg.type === 'event') {
        // Handle event
        this.handleEvent(msg.event, msg.payload);
      }
    } catch (err) {
      console.error('Failed to parse message:', err);
    }
  }
  
  /**
   * Handle events from Gateway
   */
  private handleEvent(event: string, payload: any): void {
    console.log(`📢 Event: ${event}`, payload);
    
    switch (event) {
      case 'trade:executed':
        console.log(`✅ Trade executed: ${payload.side} ${payload.amount} ${payload.pair} @ ${payload.price}`);
        break;
      case 'market:price':
        console.log(`📈 ${payload.pair}: $${payload.price} (${payload.change > 0 ? '+' : ''}${payload.change}%)`);
        break;
      case 'alert:triggered':
        console.log(`🔔 Alert: ${payload.message}`);
        break;
    }
  }
  
  /**
   * Get portfolio snapshot
   */
  async getPortfolio(): Promise<any> {
    return this.request('portfolio.snapshot', { action: 'snapshot' });
  }
  
  /**
   * Get market price
   */
  async getPrice(pair: string): Promise<any> {
    return this.request('market.data', {
      action: 'price',
      pair
    });
  }
  
  /**
   * Get technical analysis
   */
  async analyze(pair: string, timeframe = '1h'): Promise<any> {
    return this.request('market.data', {
      action: 'analyze',
      pair,
      timeframe
    });
  }
  
  /**
   * Execute a trade
   */
  async trade(params: TradeParams): Promise<any> {
    console.log(`🔄 Executing trade: ${params.action} ${params.amount} ${params.pair}`);
    return this.request('trade.execute', params);
  }
  
  /**
   * Check gateway health
   */
  async health(): Promise<any> {
    return this.request('health');
  }
  
  /**
   * Close connection
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// =============================================================================
// MAIN - Example Usage
// =============================================================================

async function main() {
  const bot = new BasicBot({
    gatewayUrl: process.env.KIT_GATEWAY_URL || 'ws://127.0.0.1:18800',
    token: process.env.KIT_GATEWAY_TOKEN
  });
  
  try {
    // Connect to Gateway
    await bot.connect();
    
    // Check health
    const health = await bot.health();
    console.log('\n📊 Gateway Health:', health);
    
    // Get portfolio
    const portfolio = await bot.getPortfolio();
    console.log('\n💼 Portfolio:');
    console.log(`   Total Value: $${portfolio.totalValueUsd?.toLocaleString() || 'N/A'}`);
    console.log(`   Assets: ${portfolio.assets?.length || 0}`);
    console.log(`   Positions: ${portfolio.positions?.length || 0}`);
    
    // Get BTC price
    const btcPrice = await bot.getPrice('BTC/USDT');
    console.log('\n📈 BTC/USDT:', btcPrice);
    
    // Get technical analysis
    const analysis = await bot.analyze('BTC/USDT', '4h');
    console.log('\n🔍 Analysis:', analysis);
    
    // Example: Simple trading logic
    // WARNING: This is for demonstration only!
    if (analysis.signal === 'BUY' && analysis.confidence > 70) {
      console.log('\n🚀 Strong buy signal detected!');
      
      // Uncomment to execute real trade:
      // const order = await bot.trade({
      //   action: 'buy',
      //   pair: 'BTC/USDT',
      //   amount: 50,  // $50
      //   type: 'market'
      // });
      // console.log('Order:', order);
    }
    
    // Keep running for events
    console.log('\n⏳ Listening for events... (Ctrl+C to exit)');
    
    // Periodic health check
    setInterval(async () => {
      try {
        const h = await bot.health();
        console.log(`💓 Health OK - Uptime: ${Math.floor(h.uptime / 60)}min`);
      } catch (err) {
        console.error('💔 Health check failed');
      }
    }, 60000);
    
  } catch (error) {
    console.error('❌ Error:', error);
    bot.disconnect();
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  process.exit(0);
});

// Run
main();
