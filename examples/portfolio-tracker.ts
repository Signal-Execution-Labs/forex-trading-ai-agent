/**
 * K.I.T. Portfolio Tracker Example
 * 
 * A dashboard that:
 * - Monitors portfolio across multiple exchanges
 * - Calculates P&L and performance metrics
 * - Sends daily reports
 * - Tracks asset allocation
 * 
 * Run: npx ts-node examples/portfolio-tracker.ts
 */

import WebSocket from 'ws';

// =============================================================================
// TYPES
// =============================================================================

interface Asset {
  symbol: string;
  exchange: string;
  amount: number;
  valueUsd: number;
  allocation: number;
  price: number;
  change24h: number;
}

interface Position {
  id: string;
  pair: string;
  side: 'long' | 'short';
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  exchange: string;
}

interface PortfolioSnapshot {
  timestamp: Date;
  totalValueUsd: number;
  totalValueBtc: number;
  change24h: number;
  change7d: number;
  change30d: number;
  assets: Asset[];
  positions: Position[];
  topPerformer: { symbol: string; change: number } | null;
  worstPerformer: { symbol: string; change: number } | null;
}

interface TrackerConfig {
  gatewayUrl: string;
  token?: string;
  updateIntervalMs: number;
  reportTime: string;  // HH:MM
  telegramChatId?: string;
}

// =============================================================================
// PORTFOLIO TRACKER
// =============================================================================

class PortfolioTracker {
  private ws: WebSocket | null = null;
  private requestId = 0;
  private pending = new Map<string, { resolve: Function; reject: Function }>();
  private history: PortfolioSnapshot[] = [];
  private updateInterval: NodeJS.Timer | null = null;
  
  constructor(private config: TrackerConfig) {}
  
  /**
   * Start tracking
   */
  async start(): Promise<void> {
    // Connect to Gateway
    await this.connectGateway();
    
    console.log('📊 Portfolio Tracker started!');
    console.log(`   Update interval: ${this.config.updateIntervalMs / 1000}s`);
    console.log(`   Daily report: ${this.config.reportTime}`);
    
    // Initial snapshot
    await this.takeSnapshot();
    
    // Start update loop
    this.updateInterval = setInterval(
      () => this.takeSnapshot(),
      this.config.updateIntervalMs
    );
    
    // Schedule daily report
    this.scheduleDailyReport();
  }
  
  /**
   * Stop tracking
   */
  stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    if (this.ws) {
      this.ws.close();
    }
  }
  
  /**
   * Connect to Gateway
   */
  private async connectGateway(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.config.gatewayUrl);
      
      this.ws.onopen = async () => {
        try {
          await this.request('connect', {
            client: { id: 'portfolio-tracker', version: '1.0.0' },
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
        console.log('⚠️ Disconnected, reconnecting...');
        setTimeout(() => this.connectGateway(), 5000);
      };
    });
  }
  
  /**
   * Take a portfolio snapshot
   */
  async takeSnapshot(): Promise<PortfolioSnapshot> {
    const data = await this.request('portfolio.snapshot', { action: 'snapshot' });
    
    // Calculate performance
    const now = new Date();
    const snapshot: PortfolioSnapshot = {
      timestamp: now,
      totalValueUsd: data.totalValueUsd,
      totalValueBtc: data.totalValueBtc,
      change24h: this.calculateChange(24),
      change7d: this.calculateChange(24 * 7),
      change30d: this.calculateChange(24 * 30),
      assets: data.assets?.map((a: any) => ({
        symbol: a.symbol,
        exchange: a.exchange,
        amount: a.total,
        valueUsd: a.valueUsd,
        allocation: a.allocation,
        price: a.valueUsd / a.total,
        change24h: a.change24h || 0
      })) || [],
      positions: data.positions?.map((p: any) => ({
        id: p.id,
        pair: p.pair,
        side: p.side,
        amount: p.amount,
        entryPrice: p.entryPrice,
        currentPrice: p.currentPrice,
        pnl: p.unrealizedPnl,
        pnlPercent: p.unrealizedPnlPercent,
        exchange: p.exchange
      })) || [],
      topPerformer: null,
      worstPerformer: null
    };
    
    // Find top/worst performers
    if (snapshot.assets.length > 0) {
      const sorted = [...snapshot.assets].sort((a, b) => b.change24h - a.change24h);
      snapshot.topPerformer = { symbol: sorted[0].symbol, change: sorted[0].change24h };
      snapshot.worstPerformer = { symbol: sorted[sorted.length - 1].symbol, change: sorted[sorted.length - 1].change24h };
    }
    
    // Store in history
    this.history.push(snapshot);
    
    // Keep only last 30 days
    const maxHistory = (30 * 24 * 60 * 60 * 1000) / this.config.updateIntervalMs;
    if (this.history.length > maxHistory) {
      this.history = this.history.slice(-maxHistory);
    }
    
    this.printSnapshot(snapshot);
    return snapshot;
  }
  
  /**
   * Calculate change from X hours ago
   */
  private calculateChange(hoursAgo: number): number {
    if (this.history.length < 2) return 0;
    
    const now = Date.now();
    const targetTime = now - (hoursAgo * 60 * 60 * 1000);
    
    // Find closest snapshot to target time
    const pastSnapshot = this.history.find(s => 
      Math.abs(s.timestamp.getTime() - targetTime) < this.config.updateIntervalMs * 2
    );
    
    if (!pastSnapshot) return 0;
    
    const current = this.history[this.history.length - 1];
    return ((current.totalValueUsd - pastSnapshot.totalValueUsd) / pastSnapshot.totalValueUsd) * 100;
  }
  
  /**
   * Print snapshot to console
   */
  private printSnapshot(snapshot: PortfolioSnapshot): void {
    console.log('\n' + '═'.repeat(50));
    console.log('📊 PORTFOLIO SNAPSHOT');
    console.log('═'.repeat(50));
    console.log(`⏰ ${snapshot.timestamp.toLocaleString()}`);
    console.log(`💰 Total: $${snapshot.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}`);
    console.log(`₿  BTC Value: ${snapshot.totalValueBtc.toFixed(4)} BTC`);
    console.log('─'.repeat(50));
    
    // Performance
    const formatChange = (n: number) => {
      const sign = n >= 0 ? '+' : '';
      const color = n >= 0 ? '🟢' : '🔴';
      return `${color} ${sign}${n.toFixed(2)}%`;
    };
    
    console.log('📈 Performance:');
    console.log(`   24h: ${formatChange(snapshot.change24h)}`);
    console.log(`   7d:  ${formatChange(snapshot.change7d)}`);
    console.log(`   30d: ${formatChange(snapshot.change30d)}`);
    
    // Top assets
    if (snapshot.assets.length > 0) {
      console.log('─'.repeat(50));
      console.log('💎 Assets:');
      snapshot.assets
        .sort((a, b) => b.allocation - a.allocation)
        .slice(0, 5)
        .forEach(a => {
          const changeStr = formatChange(a.change24h);
          console.log(`   ${a.symbol.padEnd(6)} ${a.allocation.toFixed(1).padStart(5)}%  $${a.valueUsd.toLocaleString().padStart(10)}  ${changeStr}`);
        });
    }
    
    // Open positions
    if (snapshot.positions.length > 0) {
      console.log('─'.repeat(50));
      console.log('📈 Open Positions:');
      snapshot.positions.forEach(p => {
        const pnlStr = formatChange(p.pnlPercent);
        console.log(`   ${p.pair} ${p.side.toUpperCase()} ${pnlStr} ($${p.pnl.toFixed(2)})`);
      });
    }
    
    // Performers
    if (snapshot.topPerformer && snapshot.worstPerformer) {
      console.log('─'.repeat(50));
      console.log(`🏆 Best:  ${snapshot.topPerformer.symbol} ${formatChange(snapshot.topPerformer.change)}`);
      console.log(`💀 Worst: ${snapshot.worstPerformer.symbol} ${formatChange(snapshot.worstPerformer.change)}`);
    }
    
    console.log('═'.repeat(50));
  }
  
  /**
   * Generate daily report
   */
  async generateDailyReport(): Promise<string> {
    const snapshot = await this.takeSnapshot();
    
    const report = `
🤖 K.I.T. Daily Report - ${new Date().toLocaleDateString()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Portfolio Value: $${snapshot.totalValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2 })}
   ${snapshot.change24h >= 0 ? '🟢' : '🔴'} ${snapshot.change24h >= 0 ? '+' : ''}${snapshot.change24h.toFixed(2)}% (24h)

📊 Performance:
   • 7 days:  ${snapshot.change7d >= 0 ? '+' : ''}${snapshot.change7d.toFixed(2)}%
   • 30 days: ${snapshot.change30d >= 0 ? '+' : ''}${snapshot.change30d.toFixed(2)}%

💎 Top Holdings:
${snapshot.assets.slice(0, 5).map(a => 
  `   • ${a.symbol}: $${a.valueUsd.toLocaleString()} (${a.allocation.toFixed(1)}%)`
).join('\n')}

${snapshot.positions.length > 0 ? `
📈 Open Positions: ${snapshot.positions.length}
   Unrealized P&L: $${snapshot.positions.reduce((sum, p) => sum + p.pnl, 0).toFixed(2)}
` : ''}

${snapshot.topPerformer ? `🏆 Top Performer: ${snapshot.topPerformer.symbol} (+${snapshot.topPerformer.change.toFixed(2)}%)` : ''}
${snapshot.worstPerformer ? `💀 Worst Performer: ${snapshot.worstPerformer.symbol} (${snapshot.worstPerformer.change.toFixed(2)}%)` : ''}

"Your wealth is my mission. Sleep well."
   - K.I.T.
`.trim();
    
    return report;
  }
  
  /**
   * Schedule daily report
   */
  private scheduleDailyReport(): void {
    const [hours, minutes] = this.config.reportTime.split(':').map(Number);
    
    const scheduleNext = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(hours, minutes, 0, 0);
      
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      
      const delay = next.getTime() - now.getTime();
      
      setTimeout(async () => {
        const report = await this.generateDailyReport();
        console.log('\n📧 DAILY REPORT:\n' + report);
        
        // TODO: Send via Telegram if configured
        // if (this.config.telegramChatId) {
        //   await this.sendTelegram(report);
        // }
        
        scheduleNext();
      }, delay);
      
      console.log(`📅 Next daily report: ${next.toLocaleString()}`);
    };
    
    scheduleNext();
  }
  
  /**
   * Get historical data for charting
   */
  getHistory(hours: number = 24): { time: Date; value: number }[] {
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    return this.history
      .filter(s => s.timestamp.getTime() >= cutoff)
      .map(s => ({ time: s.timestamp, value: s.totalValueUsd }));
  }
  
  /**
   * Calculate metrics
   */
  getMetrics(): { sharpe: number; maxDrawdown: number; volatility: number } {
    if (this.history.length < 2) {
      return { sharpe: 0, maxDrawdown: 0, volatility: 0 };
    }
    
    // Calculate daily returns
    const returns: number[] = [];
    for (let i = 1; i < this.history.length; i++) {
      const ret = (this.history[i].totalValueUsd - this.history[i-1].totalValueUsd) 
        / this.history[i-1].totalValueUsd;
      returns.push(ret);
    }
    
    // Volatility (annualized)
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365);
    
    // Sharpe Ratio (assuming 0% risk-free rate)
    const annualizedReturn = mean * 365;
    const sharpe = volatility > 0 ? annualizedReturn / volatility : 0;
    
    // Max Drawdown
    let maxDrawdown = 0;
    let peak = this.history[0].totalValueUsd;
    for (const snapshot of this.history) {
      if (snapshot.totalValueUsd > peak) {
        peak = snapshot.totalValueUsd;
      }
      const drawdown = (peak - snapshot.totalValueUsd) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return {
      sharpe: Math.round(sharpe * 100) / 100,
      maxDrawdown: Math.round(maxDrawdown * 10000) / 100,
      volatility: Math.round(volatility * 10000) / 100
    };
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
    }
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const tracker = new PortfolioTracker({
    gatewayUrl: process.env.KIT_GATEWAY_URL || 'ws://127.0.0.1:18800',
    token: process.env.KIT_GATEWAY_TOKEN,
    updateIntervalMs: 60000,  // Update every minute
    reportTime: '08:00',      // Daily report at 8 AM
    telegramChatId: process.env.TELEGRAM_CHAT_ID
  });
  
  await tracker.start();
  
  // Keep running
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping tracker...');
    tracker.stop();
    process.exit(0);
  });
}

main().catch(console.error);
