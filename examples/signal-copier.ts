/**
 * K.I.T. Signal Copier Example
 * 
 * Copies trading signals from a Telegram channel or webhook
 * and executes them via K.I.T. Gateway.
 * 
 * Features:
 * - Parse signals from multiple formats
 * - Risk management (position sizing, max daily loss)
 * - Logging and notifications
 * 
 * Run: npx ts-node examples/signal-copier.ts
 */

import WebSocket from 'ws';
import express from 'express';

// =============================================================================
// TYPES
// =============================================================================

interface Signal {
  id: string;
  pair: string;
  action: 'buy' | 'sell' | 'long' | 'short';
  entry?: number;
  entryRange?: { min: number; max: number };
  stopLoss?: number;
  takeProfit?: number[];
  leverage?: number;
  source: string;
  timestamp: Date;
  raw: string;
}

interface CopierConfig {
  gatewayUrl: string;
  token?: string;
  webhookPort: number;
  riskPerTrade: number;      // % of portfolio per trade
  maxDailyLoss: number;      // Max daily loss %
  maxPositions: number;      // Max concurrent positions
  enabledPairs: string[];    // Whitelist (empty = all)
  blockedPairs: string[];    // Blacklist
}

// =============================================================================
// SIGNAL PARSER
// =============================================================================

class SignalParser {
  /**
   * Parse trading signal from text
   * Supports multiple common formats
   */
  static parse(text: string, source: string): Signal | null {
    // Clean text
    const clean = text.trim().toUpperCase();
    
    // Try different formats
    return (
      this.parseFormat1(clean, source) ||
      this.parseFormat2(clean, source) ||
      this.parseFormat3(clean, source)
    );
  }
  
  /**
   * Format 1: "BTC/USDT LONG @ 67000 SL: 65000 TP: 70000, 72000"
   */
  private static parseFormat1(text: string, source: string): Signal | null {
    const match = text.match(
      /([A-Z]+\/[A-Z]+)\s+(LONG|SHORT|BUY|SELL)\s*@?\s*([\d.]+)?\s*(?:SL:?\s*([\d.]+))?\s*(?:TP:?\s*([\d.,\s]+))?/i
    );
    
    if (!match) return null;
    
    const [, pair, action, entry, sl, tps] = match;
    
    return {
      id: `sig-${Date.now()}`,
      pair: pair.replace('/', ''),
      action: action.toLowerCase() as Signal['action'],
      entry: entry ? parseFloat(entry) : undefined,
      stopLoss: sl ? parseFloat(sl) : undefined,
      takeProfit: tps ? tps.split(/[,\s]+/).map(Number).filter(n => !isNaN(n)) : undefined,
      source,
      timestamp: new Date(),
      raw: text
    };
  }
  
  /**
   * Format 2: "🟢 BUY BTCUSDT\nEntry: 67000-67500\nSL: 65000\nTP1: 68000\nTP2: 70000"
   */
  private static parseFormat2(text: string, source: string): Signal | null {
    const actionMatch = text.match(/[🟢🔴🟡]?\s*(BUY|SELL|LONG|SHORT)\s+([A-Z]+)/i);
    if (!actionMatch) return null;
    
    const entryMatch = text.match(/ENTRY:?\s*([\d.]+)(?:\s*-\s*([\d.]+))?/i);
    const slMatch = text.match(/(?:SL|STOP.?LOSS):?\s*([\d.]+)/i);
    const tpMatches = text.match(/TP\d?:?\s*([\d.]+)/gi);
    
    let pair = actionMatch[2];
    if (!pair.includes('/') && pair.length > 4) {
      // Convert BTCUSDT to BTC/USDT
      const base = pair.slice(0, -4);
      const quote = pair.slice(-4);
      pair = `${base}/${quote}`;
    }
    
    return {
      id: `sig-${Date.now()}`,
      pair,
      action: actionMatch[1].toLowerCase() as Signal['action'],
      entry: entryMatch ? parseFloat(entryMatch[1]) : undefined,
      entryRange: entryMatch && entryMatch[2] 
        ? { min: parseFloat(entryMatch[1]), max: parseFloat(entryMatch[2]) }
        : undefined,
      stopLoss: slMatch ? parseFloat(slMatch[1]) : undefined,
      takeProfit: tpMatches 
        ? tpMatches.map(tp => parseFloat(tp.replace(/TP\d?:?\s*/i, '')))
        : undefined,
      source,
      timestamp: new Date(),
      raw: text
    };
  }
  
  /**
   * Format 3: JSON webhook format
   */
  private static parseFormat3(text: string, source: string): Signal | null {
    try {
      const data = JSON.parse(text);
      if (!data.pair || !data.action) return null;
      
      return {
        id: data.id || `sig-${Date.now()}`,
        pair: data.pair,
        action: data.action.toLowerCase() as Signal['action'],
        entry: data.entry || data.price,
        stopLoss: data.stopLoss || data.sl,
        takeProfit: Array.isArray(data.takeProfit) 
          ? data.takeProfit 
          : data.tp ? [data.tp] : undefined,
        leverage: data.leverage,
        source,
        timestamp: new Date(),
        raw: text
      };
    } catch {
      return null;
    }
  }
}

// =============================================================================
// SIGNAL COPIER
// =============================================================================

class SignalCopier {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<string, { resolve: Function; reject: Function }>();
  private dailyPnL = 0;
  private openPositions: Set<string> = new Set();
  private processedSignals: Set<string> = new Set();
  
  constructor(private config: CopierConfig) {}
  
  /**
   * Start the signal copier
   */
  async start(): Promise<void> {
    // Connect to Gateway
    await this.connectGateway();
    
    // Start webhook server
    this.startWebhook();
    
    console.log('🚀 Signal Copier started!');
    console.log(`   Gateway: ${this.config.gatewayUrl}`);
    console.log(`   Webhook: http://localhost:${this.config.webhookPort}/signal`);
    console.log(`   Risk per trade: ${this.config.riskPerTrade}%`);
    console.log(`   Max daily loss: ${this.config.maxDailyLoss}%`);
  }
  
  /**
   * Connect to K.I.T. Gateway
   */
  private async connectGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.gatewayUrl);
      
      this.ws.onopen = async () => {
        try {
          await this.request('connect', {
            client: { id: 'signal-copier', version: '1.0.0' },
            auth: { token: this.config.token }
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      };
      
      this.ws.onmessage = (event) => {
        this.handleMessage(event.data.toString());
      };
      
      this.ws.onerror = (error) => reject(error);
      
      this.ws.onclose = () => {
        console.log('⚠️ Gateway disconnected, reconnecting...');
        setTimeout(() => this.connectGateway(), 5000);
      };
    });
  }
  
  /**
   * Start webhook server for receiving signals
   */
  private startWebhook(): void {
    const app = express();
    app.use(express.json());
    app.use(express.text());
    
    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', openPositions: this.openPositions.size });
    });
    
    // Signal endpoint
    app.post('/signal', async (req, res) => {
      try {
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const source = req.headers['x-signal-source']?.toString() || 'webhook';
        
        const signal = SignalParser.parse(body, source);
        
        if (!signal) {
          res.status(400).json({ error: 'Could not parse signal' });
          return;
        }
        
        const result = await this.processSignal(signal);
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.listen(this.config.webhookPort);
  }
  
  /**
   * Process a trading signal
   */
  async processSignal(signal: Signal): Promise<any> {
    console.log(`\n📨 Signal received: ${signal.action.toUpperCase()} ${signal.pair}`);
    
    // Check if already processed
    if (this.processedSignals.has(signal.id)) {
      return { skipped: true, reason: 'Already processed' };
    }
    this.processedSignals.add(signal.id);
    
    // Check daily loss limit
    if (this.dailyPnL <= -this.config.maxDailyLoss) {
      console.log('❌ Daily loss limit reached');
      return { skipped: true, reason: 'Daily loss limit' };
    }
    
    // Check max positions
    if (this.openPositions.size >= this.config.maxPositions) {
      console.log('❌ Max positions reached');
      return { skipped: true, reason: 'Max positions' };
    }
    
    // Check pair whitelist/blacklist
    if (!this.isPairAllowed(signal.pair)) {
      console.log(`❌ Pair ${signal.pair} not allowed`);
      return { skipped: true, reason: 'Pair not allowed' };
    }
    
    // Calculate position size
    const portfolio = await this.request('portfolio.snapshot', {});
    const riskAmount = portfolio.totalValueUsd * (this.config.riskPerTrade / 100);
    
    // Map action
    const action: 'buy' | 'sell' = 
      signal.action === 'long' || signal.action === 'buy' ? 'buy' : 'sell';
    
    // Execute trade
    try {
      const order = await this.request('trade.execute', {
        action,
        pair: signal.pair.includes('/') ? signal.pair : `${signal.pair.slice(0, -4)}/${signal.pair.slice(-4)}`,
        amount: riskAmount,
        type: signal.entry ? 'limit' : 'market',
        price: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit: signal.takeProfit?.[0]
      });
      
      console.log(`✅ Order executed: ${order.orderId}`);
      this.openPositions.add(order.orderId);
      
      return {
        success: true,
        signal,
        order,
        riskAmount
      };
    } catch (error: any) {
      console.error(`❌ Trade failed: ${error.message}`);
      return {
        success: false,
        signal,
        error: error.message
      };
    }
  }
  
  /**
   * Check if pair is allowed
   */
  private isPairAllowed(pair: string): boolean {
    const normalizedPair = pair.replace('/', '').toUpperCase();
    
    // Check blacklist
    if (this.config.blockedPairs.some(p => 
      p.replace('/', '').toUpperCase() === normalizedPair
    )) {
      return false;
    }
    
    // Check whitelist (if not empty)
    if (this.config.enabledPairs.length > 0) {
      return this.config.enabledPairs.some(p => 
        p.replace('/', '').toUpperCase() === normalizedPair
      );
    }
    
    return true;
  }
  
  /**
   * Send request to Gateway
   */
  private async request(method: string, params: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }
    
    const id = `req-${++this.requestId}`;
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws!.send(JSON.stringify({ type: 'req', id, method, params }));
      
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Timeout'));
        }
      }, 30000);
    });
  }
  
  /**
   * Handle WebSocket messages
   */
  private handleMessage(data: string): void {
    const msg = JSON.parse(data);
    
    if (msg.type === 'res') {
      const handler = this.pending.get(msg.id);
      if (handler) {
        this.pending.delete(msg.id);
        msg.ok ? handler.resolve(msg.payload) : handler.reject(new Error(msg.error?.message));
      }
    } else if (msg.type === 'event') {
      if (msg.event === 'position:closed') {
        this.openPositions.delete(msg.payload.id);
        this.dailyPnL += msg.payload.realizedPnlPercent || 0;
        console.log(`📊 Position closed, Daily P&L: ${this.dailyPnL.toFixed(2)}%`);
      }
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const copier = new SignalCopier({
    gatewayUrl: process.env.KIT_GATEWAY_URL || 'ws://127.0.0.1:18800',
    token: process.env.KIT_GATEWAY_TOKEN,
    webhookPort: parseInt(process.env.WEBHOOK_PORT || '3000'),
    riskPerTrade: 2,        // 2% per trade
    maxDailyLoss: 6,        // 6% max daily loss
    maxPositions: 5,
    enabledPairs: [],       // Empty = all pairs
    blockedPairs: ['LUNA/USDT', 'UST/USDT']  // RIP
  });
  
  await copier.start();
  
  // Example: Send test signal
  // curl -X POST http://localhost:3000/signal \
  //   -H "Content-Type: text/plain" \
  //   -d "BTC/USDT LONG @ 67000 SL: 65000 TP: 70000, 72000"
}

main().catch(console.error);
