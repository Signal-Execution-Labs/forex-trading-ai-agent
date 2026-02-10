/**
 * K.I.T. Canvas Manager
 * 
 * Manages canvas presentations for displaying HTML content, charts,
 * portfolio views, and real-time trading visualizations to users.
 * 
 * Supports:
 * - HTML rendering (custom dashboards, tables, reports)
 * - TradingView widget integration
 * - Real-time chart updates via WebSocket
 * - Screenshot/snapshot capabilities
 */

import { EventEmitter } from 'events';

// ============================================================================
// Types
// ============================================================================

export interface CanvasContent {
  id: string;
  type: 'html' | 'chart' | 'widget' | 'portfolio' | 'tradingview';
  html?: string;
  url?: string;
  data?: Record<string, unknown>;
  title?: string;
  width?: number;
  height?: number;
  createdAt: number;
  updatedAt: number;
}

export interface ChartConfig {
  symbol: string;
  interval?: string; // '1m', '5m', '1h', '1D', etc.
  theme?: 'light' | 'dark';
  studies?: string[]; // Technical indicators
  style?: 'candles' | 'line' | 'area' | 'bars';
  width?: number;
  height?: number;
}

export interface PortfolioViewConfig {
  holdings?: boolean;
  performance?: boolean;
  allocation?: boolean;
  pnl?: boolean;
  period?: '24h' | '7d' | '30d' | 'all';
}

export interface CanvasState {
  visible: boolean;
  content: CanvasContent | null;
  history: CanvasContent[];
  maxHistory: number;
}

export interface CanvasEvent {
  type: 'present' | 'update' | 'hide' | 'snapshot';
  content?: CanvasContent;
  snapshot?: string; // Base64 image data
  timestamp: number;
}

// ============================================================================
// Canvas Manager
// ============================================================================

export class CanvasManager extends EventEmitter {
  private state: CanvasState;
  private subscribers: Set<(event: CanvasEvent) => void> = new Set();

  constructor(maxHistory = 10) {
    super();
    this.state = {
      visible: false,
      content: null,
      history: [],
      maxHistory,
    };
  }

  /**
   * Get current canvas state
   */
  getState(): CanvasState {
    return { ...this.state };
  }

  /**
   * Check if canvas is visible
   */
  isVisible(): boolean {
    return this.state.visible;
  }

  /**
   * Get current content
   */
  getCurrentContent(): CanvasContent | null {
    return this.state.content;
  }

  /**
   * Present HTML content on canvas
   */
  presentHtml(html: string, options: { title?: string; width?: number; height?: number } = {}): CanvasContent {
    const content: CanvasContent = {
      id: this.generateId(),
      type: 'html',
      html,
      title: options.title || 'K.I.T. Canvas',
      width: options.width || 800,
      height: options.height || 600,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return this.present(content);
  }

  /**
   * Present a TradingView chart
   */
  presentChart(config: ChartConfig): CanvasContent {
    const { symbol, interval = '1D', theme = 'dark', studies = [], style = 'candles', width = 800, height = 500 } = config;

    const html = this.generateTradingViewWidget(symbol, interval, theme, studies, style);

    const content: CanvasContent = {
      id: this.generateId(),
      type: 'tradingview',
      html,
      data: config as unknown as Record<string, unknown>,
      title: `${symbol} Chart`,
      width,
      height,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return this.present(content);
  }

  /**
   * Present portfolio view
   */
  presentPortfolio(data: {
    totalValue: number;
    holdings: Array<{
      symbol: string;
      amount: number;
      value: number;
      pnl: number;
      pnlPercent: number;
      allocation: number;
    }>;
    performance?: {
      day: number;
      week: number;
      month: number;
      total: number;
    };
  }, options: PortfolioViewConfig = {}): CanvasContent {
    const html = this.generatePortfolioHtml(data, options);

    const content: CanvasContent = {
      id: this.generateId(),
      type: 'portfolio',
      html,
      data,
      title: 'Portfolio Overview',
      width: 900,
      height: 700,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    return this.present(content);
  }

  /**
   * Present content on canvas
   */
  present(content: CanvasContent): CanvasContent {
    // Add to history
    if (this.state.content) {
      this.state.history.unshift(this.state.content);
      if (this.state.history.length > this.state.maxHistory) {
        this.state.history.pop();
      }
    }

    this.state.content = content;
    this.state.visible = true;

    const event: CanvasEvent = {
      type: 'present',
      content,
      timestamp: Date.now(),
    };

    this.emit('canvas', event);
    this.notifySubscribers(event);

    return content;
  }

  /**
   * Update current canvas content
   */
  update(updates: Partial<CanvasContent>): CanvasContent | null {
    if (!this.state.content) return null;

    this.state.content = {
      ...this.state.content,
      ...updates,
      updatedAt: Date.now(),
    };

    const event: CanvasEvent = {
      type: 'update',
      content: this.state.content,
      timestamp: Date.now(),
    };

    this.emit('canvas', event);
    this.notifySubscribers(event);

    return this.state.content;
  }

  /**
   * Hide the canvas
   */
  hide(): boolean {
    if (!this.state.visible) return false;

    this.state.visible = false;

    const event: CanvasEvent = {
      type: 'hide',
      timestamp: Date.now(),
    };

    this.emit('canvas', event);
    this.notifySubscribers(event);

    return true;
  }

  /**
   * Navigate to previous content in history
   */
  goBack(): CanvasContent | null {
    if (this.state.history.length === 0) return null;

    const previous = this.state.history.shift();
    if (!previous) return null;

    this.state.content = previous;
    this.state.visible = true;

    const event: CanvasEvent = {
      type: 'present',
      content: previous,
      timestamp: Date.now(),
    };

    this.emit('canvas', event);
    this.notifySubscribers(event);

    return previous;
  }

  /**
   * Get canvas history
   */
  getHistory(): CanvasContent[] {
    return [...this.state.history];
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.state.history = [];
  }

  /**
   * Subscribe to canvas events
   */
  subscribe(callback: (event: CanvasEvent) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(event: CanvasEvent): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error('Canvas subscriber error:', error);
      }
    }
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `canvas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate TradingView widget HTML
   */
  private generateTradingViewWidget(
    symbol: string,
    interval: string,
    theme: 'light' | 'dark',
    studies: string[],
    style: string
  ): string {
    const studiesConfig = studies.length > 0 
      ? `"studies": [${studies.map(s => `"${s}"`).join(',')}],` 
      : '';
    
    const chartStyle = style === 'candles' ? '1' : style === 'line' ? '2' : style === 'area' ? '3' : '0';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${symbol} Chart</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${theme === 'dark' ? '#131722' : '#ffffff'}; }
    .tradingview-widget-container { width: 100%; height: 100vh; }
  </style>
</head>
<body>
  <div class="tradingview-widget-container">
    <div id="tradingview_chart"></div>
  </div>
  <script type="text/javascript" src="https://s3.tradingview.com/tv.js"></script>
  <script type="text/javascript">
    new TradingView.widget({
      "width": "100%",
      "height": "100%",
      "symbol": "${symbol}",
      "interval": "${interval}",
      "timezone": "Europe/Berlin",
      "theme": "${theme}",
      "style": "${chartStyle}",
      "locale": "en",
      "toolbar_bg": "${theme === 'dark' ? '#1e222d' : '#f1f3f6'}",
      "enable_publishing": false,
      "hide_side_toolbar": false,
      "allow_symbol_change": true,
      ${studiesConfig}
      "container_id": "tradingview_chart"
    });
  </script>
</body>
</html>`;
  }

  /**
   * Generate portfolio HTML view
   */
  private generatePortfolioHtml(
    data: {
      totalValue: number;
      holdings: Array<{
        symbol: string;
        amount: number;
        value: number;
        pnl: number;
        pnlPercent: number;
        allocation: number;
      }>;
      performance?: {
        day: number;
        week: number;
        month: number;
        total: number;
      };
    },
    options: PortfolioViewConfig
  ): string {
    const formatCurrency = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
    const formatPercent = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    const getColor = (n: number) => n >= 0 ? '#00ff88' : '#ff4444';

    const holdingsHtml = data.holdings.map(h => `
      <tr>
        <td><strong>${h.symbol}</strong></td>
        <td>${h.amount.toFixed(4)}</td>
        <td>${formatCurrency(h.value)}</td>
        <td style="color: ${getColor(h.pnl)}">${formatCurrency(h.pnl)}</td>
        <td style="color: ${getColor(h.pnlPercent)}">${formatPercent(h.pnlPercent)}</td>
        <td>
          <div class="allocation-bar">
            <div class="allocation-fill" style="width: ${h.allocation}%"></div>
            <span>${h.allocation.toFixed(1)}%</span>
          </div>
        </td>
      </tr>
    `).join('');

    const perfHtml = data.performance ? `
      <div class="performance-grid">
        <div class="perf-card">
          <div class="perf-label">24H</div>
          <div class="perf-value" style="color: ${getColor(data.performance.day)}">${formatPercent(data.performance.day)}</div>
        </div>
        <div class="perf-card">
          <div class="perf-label">7D</div>
          <div class="perf-value" style="color: ${getColor(data.performance.week)}">${formatPercent(data.performance.week)}</div>
        </div>
        <div class="perf-card">
          <div class="perf-label">30D</div>
          <div class="perf-value" style="color: ${getColor(data.performance.month)}">${formatPercent(data.performance.month)}</div>
        </div>
        <div class="perf-card">
          <div class="perf-label">Total</div>
          <div class="perf-value" style="color: ${getColor(data.performance.total)}">${formatPercent(data.performance.total)}</div>
        </div>
      </div>
    ` : '';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Portfolio Overview</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f23 100%);
      color: #fff;
      padding: 2rem;
      min-height: 100vh;
    }
    .header {
      margin-bottom: 2rem;
      text-align: center;
    }
    .logo {
      font-size: 1.5rem;
      background: linear-gradient(90deg, #00d4ff, #7b2fff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.5rem;
    }
    .total-value {
      font-size: 3rem;
      font-weight: bold;
      color: #00ff88;
      margin: 1rem 0;
    }
    .performance-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .perf-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem;
      padding: 1rem;
      text-align: center;
    }
    .perf-label { color: #888; font-size: 0.8rem; text-transform: uppercase; }
    .perf-value { font-size: 1.5rem; font-weight: bold; margin-top: 0.25rem; }
    
    .holdings-section {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 1rem;
      overflow: hidden;
    }
    .holdings-header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-size: 1rem;
      font-weight: 600;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 1rem 1.5rem;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    th {
      color: #888;
      font-weight: 500;
      font-size: 0.75rem;
      text-transform: uppercase;
    }
    tr:hover { background: rgba(255,255,255,0.02); }
    
    .allocation-bar {
      position: relative;
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
      height: 20px;
      overflow: hidden;
      min-width: 100px;
    }
    .allocation-fill {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background: linear-gradient(90deg, #00d4ff, #7b2fff);
      border-radius: 4px;
    }
    .allocation-bar span {
      position: relative;
      z-index: 1;
      font-size: 0.75rem;
      padding-left: 8px;
      line-height: 20px;
    }
    
    .timestamp {
      text-align: center;
      color: #666;
      font-size: 0.75rem;
      margin-top: 1rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🤖 K.I.T. Portfolio</div>
    <div class="total-value">${formatCurrency(data.totalValue)}</div>
  </div>
  
  ${perfHtml}
  
  <div class="holdings-section">
    <div class="holdings-header">📊 Holdings (${data.holdings.length})</div>
    <table>
      <thead>
        <tr>
          <th>Asset</th>
          <th>Amount</th>
          <th>Value</th>
          <th>P&L</th>
          <th>%</th>
          <th>Allocation</th>
        </tr>
      </thead>
      <tbody>
        ${holdingsHtml}
      </tbody>
    </table>
  </div>
  
  <div class="timestamp">Last updated: ${new Date().toLocaleString()}</div>
</body>
</html>`;
  }

  /**
   * Generate a simple data table HTML
   */
  generateTableHtml(
    title: string,
    headers: string[],
    rows: (string | number)[][],
    options: { theme?: 'dark' | 'light' } = {}
  ): string {
    const theme = options.theme || 'dark';
    const bg = theme === 'dark' ? '#0a0a0a' : '#ffffff';
    const text = theme === 'dark' ? '#ffffff' : '#000000';
    const border = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    const headerHtml = headers.map(h => `<th>${h}</th>`).join('');
    const rowsHtml = rows.map(row => 
      `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
    ).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; background: ${bg}; color: ${text}; padding: 1rem; }
    h1 { margin-bottom: 1rem; font-size: 1.5rem; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.75rem 1rem; text-align: left; border-bottom: 1px solid ${border}; }
    th { font-weight: 600; font-size: 0.8rem; text-transform: uppercase; opacity: 0.7; }
    tr:hover { background: ${theme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'}; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <table>
    <thead><tr>${headerHtml}</tr></thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;
  }

  /**
   * Generate alert/signal HTML
   */
  generateSignalHtml(signals: Array<{
    symbol: string;
    type: 'buy' | 'sell' | 'hold';
    strength: number;
    price: number;
    target?: number;
    stopLoss?: number;
    reason: string;
  }>): string {
    const getSignalColor = (type: string) => 
      type === 'buy' ? '#00ff88' : type === 'sell' ? '#ff4444' : '#ffaa00';

    const getSignalIcon = (type: string) =>
      type === 'buy' ? '📈' : type === 'sell' ? '📉' : '⏸️';

    const signalsHtml = signals.map(s => `
      <div class="signal-card" style="border-left: 3px solid ${getSignalColor(s.type)}">
        <div class="signal-header">
          <span class="signal-icon">${getSignalIcon(s.type)}</span>
          <span class="signal-symbol">${s.symbol}</span>
          <span class="signal-type" style="background: ${getSignalColor(s.type)}20; color: ${getSignalColor(s.type)}">${s.type.toUpperCase()}</span>
        </div>
        <div class="signal-price">$${s.price.toLocaleString()}</div>
        <div class="signal-strength">
          <div class="strength-bar">
            <div class="strength-fill" style="width: ${s.strength}%; background: ${getSignalColor(s.type)}"></div>
          </div>
          <span>${s.strength}% confidence</span>
        </div>
        ${s.target ? `<div class="signal-targets">🎯 Target: $${s.target.toLocaleString()}${s.stopLoss ? ` | 🛑 Stop: $${s.stopLoss.toLocaleString()}` : ''}</div>` : ''}
        <div class="signal-reason">${s.reason}</div>
      </div>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Trading Signals</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
      color: #fff;
      padding: 1.5rem;
      min-height: 100vh;
    }
    h1 {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
      color: #00d4ff;
    }
    .signals-grid { display: flex; flex-direction: column; gap: 1rem; }
    .signal-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.75rem;
      padding: 1.25rem;
    }
    .signal-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .signal-icon { font-size: 1.25rem; }
    .signal-symbol { font-weight: 600; font-size: 1.1rem; }
    .signal-type {
      padding: 0.2rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.7rem;
      font-weight: 600;
      margin-left: auto;
    }
    .signal-price { font-size: 1.5rem; font-weight: bold; margin-bottom: 0.5rem; }
    .signal-strength {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
      font-size: 0.8rem;
      color: #888;
    }
    .strength-bar {
      width: 100px;
      height: 6px;
      background: rgba(255,255,255,0.1);
      border-radius: 3px;
      overflow: hidden;
    }
    .strength-fill { height: 100%; border-radius: 3px; }
    .signal-targets {
      font-size: 0.85rem;
      color: #aaa;
      margin-bottom: 0.5rem;
    }
    .signal-reason {
      font-size: 0.85rem;
      color: #666;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>📡 Trading Signals</h1>
  <div class="signals-grid">
    ${signalsHtml}
  </div>
</body>
</html>`;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let canvasManager: CanvasManager | null = null;

export function getCanvasManager(): CanvasManager {
  if (!canvasManager) {
    canvasManager = new CanvasManager();
  }
  return canvasManager;
}

export function createCanvasManager(maxHistory?: number): CanvasManager {
  return new CanvasManager(maxHistory);
}
