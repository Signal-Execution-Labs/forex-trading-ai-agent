/**
 * Floating Chart Inspector - Skill #120
 * Interactive tooltip system for detailed bar analysis.
 * Shows OHLCV values, indicator readings, and key metrics.
 * 
 * Inspired by TradingView's floating tooltip feature.
 */

import { EventEmitter } from 'events';

export interface BarData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChangeData {
  absolute: number;
  percent: number;
  direction: 'up' | 'down' | 'unchanged';
}

export interface IndicatorData {
  rsi?: number;
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  ema9?: number;
  ema21?: number;
  ema50?: number;
  ema200?: number;
  bbands?: {
    upper: number;
    middle: number;
    lower: number;
  };
  atr?: number;
}

export interface VolumeData {
  value: number;
  average: number;
  ratio: number;
  aboveAverage: boolean;
  buyVolume?: number;
  sellVolume?: number;
  delta?: number;
}

export interface ContextData {
  session: 'asian' | 'london' | 'new_york' | 'off_hours';
  marketHours: boolean;
  distanceFromDailyHigh: number;
  distanceFromDailyLow: number;
  barNumber: number;
  barsSinceOpen: number;
}

export interface InspectorData {
  symbol: string;
  timeframe: string;
  bar: BarData;
  change: ChangeData;
  indicators: IndicatorData;
  volume: VolumeData;
  context: ContextData;
}

export interface InspectorConfig {
  chartId?: string;
  position?: 'follow' | 'fixed_top' | 'fixed_bottom';
  delayMs?: number;
  persistMs?: number;
  mode?: 'basic' | 'extended' | 'pro';
  showIndicators?: boolean | string[];
  showVolume?: boolean;
  showChange?: boolean;
  showContext?: boolean;
  quickActions?: {
    alert?: boolean;
    drawLine?: boolean;
    markLevel?: boolean;
    copyData?: boolean;
  };
}

class ChartInspectorService extends EventEmitter {
  private configs: Map<string, InspectorConfig> = new Map();
  private activeInspector: string | null = null;

  /**
   * Enable inspector on a chart
   */
  enable(config: InspectorConfig): void {
    const chartId = config.chartId || 'chart_main';
    
    const fullConfig: InspectorConfig = {
      position: 'follow',
      delayMs: 100,
      persistMs: 500,
      mode: 'extended',
      showIndicators: true,
      showVolume: true,
      showChange: true,
      showContext: true,
      quickActions: {
        alert: true,
        drawLine: true,
        markLevel: true,
        copyData: true
      },
      ...config
    };

    this.configs.set(chartId, fullConfig);
    this.emit('enabled', { chartId, config: fullConfig });
  }

  /**
   * Disable inspector on a chart
   */
  disable(chartId: string = 'chart_main'): void {
    this.configs.delete(chartId);
    this.emit('disabled', { chartId });
  }

  /**
   * Get bar data at specific timestamp
   */
  async getBarAt(params: {
    symbol: string;
    timestamp: string;
    timeframe?: string;
  }): Promise<InspectorData> {
    const { symbol, timestamp, timeframe = '1h' } = params;

    // Fetch bar data from exchange
    const bar = await this.fetchBar(symbol, timestamp, timeframe);
    const previousBar = await this.fetchPreviousBar(symbol, timestamp, timeframe);
    
    // Calculate change
    const change = this.calculateChange(bar, previousBar);
    
    // Get indicator values at this bar
    const indicators = await this.getIndicatorsAt(symbol, timestamp, timeframe);
    
    // Get volume analysis
    const volume = await this.getVolumeAnalysis(symbol, timestamp, timeframe);
    
    // Get context
    const context = this.getContext(symbol, timestamp, bar);

    return {
      symbol,
      timeframe,
      bar,
      change,
      indicators,
      volume,
      context
    };
  }

  /**
   * Fetch single bar data
   */
  private async fetchBar(symbol: string, timestamp: string, timeframe: string): Promise<BarData> {
    // Integration with exchange APIs
    return {
      timestamp,
      open: 0,
      high: 0,
      low: 0,
      close: 0,
      volume: 0
    };
  }

  /**
   * Fetch previous bar for change calculation
   */
  private async fetchPreviousBar(symbol: string, timestamp: string, timeframe: string): Promise<BarData | null> {
    // Get previous bar
    return null;
  }

  /**
   * Calculate price change
   */
  private calculateChange(current: BarData, previous: BarData | null): ChangeData {
    if (!previous) {
      return { absolute: 0, percent: 0, direction: 'unchanged' };
    }

    const absolute = current.close - previous.close;
    const percent = (absolute / previous.close) * 100;
    let direction: 'up' | 'down' | 'unchanged' = 'unchanged';
    
    if (absolute > 0) direction = 'up';
    else if (absolute < 0) direction = 'down';

    return {
      absolute: Math.round(absolute * 100) / 100,
      percent: Math.round(percent * 100) / 100,
      direction
    };
  }

  /**
   * Get indicator values at specific bar
   */
  private async getIndicatorsAt(symbol: string, timestamp: string, timeframe: string): Promise<IndicatorData> {
    // Calculate or fetch cached indicator values
    return {
      rsi: 50,
      macd: { value: 0, signal: 0, histogram: 0 },
      ema9: 0,
      ema21: 0,
      ema50: 0,
      ema200: 0,
      bbands: { upper: 0, middle: 0, lower: 0 },
      atr: 0
    };
  }

  /**
   * Get volume analysis for bar
   */
  private async getVolumeAnalysis(symbol: string, timestamp: string, timeframe: string): Promise<VolumeData> {
    // Volume analysis with averages
    return {
      value: 0,
      average: 0,
      ratio: 1,
      aboveAverage: false,
      buyVolume: 0,
      sellVolume: 0,
      delta: 0
    };
  }

  /**
   * Get trading context
   */
  private getContext(symbol: string, timestamp: string, bar: BarData): ContextData {
    const barTime = new Date(timestamp);
    const hour = barTime.getUTCHours();
    
    // Determine session
    let session: 'asian' | 'london' | 'new_york' | 'off_hours' = 'off_hours';
    if (hour >= 0 && hour < 8) session = 'asian';
    else if (hour >= 7 && hour < 16) session = 'london';
    else if (hour >= 13 && hour < 22) session = 'new_york';

    // Check market hours (varies by asset)
    const dayOfWeek = barTime.getUTCDay();
    const marketHours = dayOfWeek !== 0 && dayOfWeek !== 6;

    return {
      session,
      marketHours,
      distanceFromDailyHigh: 0,
      distanceFromDailyLow: 0,
      barNumber: 0,
      barsSinceOpen: 0
    };
  }

  /**
   * Quick action: Set alert at price
   */
  async setAlertAtPrice(symbol: string, price: number): Promise<string> {
    // Create price alert
    const alertId = `alert_${Date.now()}`;
    this.emit('alert_created', { alertId, symbol, price });
    return alertId;
  }

  /**
   * Quick action: Draw horizontal line
   */
  async drawLine(chartId: string, price: number, options?: {
    color?: string;
    style?: 'solid' | 'dashed' | 'dotted';
    label?: string;
  }): Promise<string> {
    const lineId = `line_${Date.now()}`;
    this.emit('line_drawn', { chartId, lineId, price, options });
    return lineId;
  }

  /**
   * Quick action: Mark as key level
   */
  async markKeyLevel(symbol: string, price: number, levelType: 'support' | 'resistance'): Promise<string> {
    const levelId = `level_${Date.now()}`;
    this.emit('level_marked', { levelId, symbol, price, levelType });
    return levelId;
  }

  /**
   * Quick action: Copy bar data to clipboard
   */
  formatForClipboard(data: InspectorData): string {
    const { bar, change, indicators, volume } = data;
    
    return [
      `${data.symbol} ${data.timeframe}`,
      `Time: ${bar.timestamp}`,
      `O: ${bar.open} | H: ${bar.high} | L: ${bar.low} | C: ${bar.close}`,
      `Change: ${change.direction === 'up' ? '+' : ''}${change.absolute} (${change.percent}%)`,
      `Volume: ${bar.volume}${volume.aboveAverage ? ' (above avg)' : ''}`,
      `RSI: ${indicators.rsi} | MACD: ${indicators.macd?.value}`
    ].join('\n');
  }

  /**
   * Format data for trading journal export
   */
  formatForJournal(data: InspectorData, notes?: string): object {
    return {
      timestamp: data.bar.timestamp,
      symbol: data.symbol,
      timeframe: data.timeframe,
      price: data.bar.close,
      ohlcv: data.bar,
      indicators: data.indicators,
      notes,
      exportedAt: new Date().toISOString()
    };
  }
}

export const ChartInspector = new ChartInspectorService();
export default ChartInspector;
