/**
 * K.I.T. Backtest Data Loader
 * Loads historical market data from exchanges for backtesting
 */

import { Logger } from '../core/logger';
import { OHLCV } from '../exchanges/manager';

export interface DataLoaderConfig {
  exchange: string;
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
}

export interface HistoricalData {
  symbol: string;
  exchange: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  candles: OHLCV[];
}

export interface DataSource {
  name: string;
  fetchOHLCV(symbol: string, timeframe: string, since?: number, limit?: number): Promise<number[][]>;
  loadMarkets(): Promise<void>;
  has: Record<string, boolean>;
}

export class BacktestDataLoader {
  private logger: Logger;
  private cache: Map<string, HistoricalData> = new Map();

  constructor() {
    this.logger = new Logger('DataLoader');
  }

  /**
   * Load historical data from exchange
   */
  async loadFromExchange(config: DataLoaderConfig): Promise<HistoricalData> {
    const cacheKey = this.getCacheKey(config);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.info(`Using cached data for ${config.symbol}`);
      return cached;
    }

    this.logger.info(`Loading historical data for ${config.symbol} from ${config.exchange}...`);
    this.logger.info(`Period: ${config.startDate.toISOString()} to ${config.endDate.toISOString()}`);
    this.logger.info(`Timeframe: ${config.timeframe}`);

    try {
      const ccxt = await import('ccxt');
      const ExchangeClass = (ccxt as any)[config.exchange];
      
      if (!ExchangeClass) {
        throw new Error(`Exchange ${config.exchange} not supported by CCXT`);
      }

      const exchange: DataSource = new ExchangeClass({
        enableRateLimit: true,
      });

      await exchange.loadMarkets();

      // Fetch all candles in chunks
      const allCandles: OHLCV[] = [];
      let since = config.startDate.getTime();
      const endTime = config.endDate.getTime();
      const limit = 1000; // CCXT typical limit

      while (since < endTime) {
        this.logger.debug(`Fetching candles from ${new Date(since).toISOString()}...`);
        
        const rawData = await exchange.fetchOHLCV(
          config.symbol,
          config.timeframe,
          since,
          limit
        );

        if (!rawData || rawData.length === 0) {
          break;
        }

        const candles = this.parseCandles(rawData).filter(
          c => c.timestamp.getTime() <= endTime
        );
        
        allCandles.push(...candles);

        // Move to next batch
        const lastCandle = rawData[rawData.length - 1];
        const newSince = lastCandle[0] + this.getTimeframeMs(config.timeframe);
        
        if (newSince <= since) {
          break; // Prevent infinite loop
        }
        since = newSince;

        // Rate limiting
        await this.sleep(exchange.has['rateLimit'] ? 100 : 500);
      }

      const data: HistoricalData = {
        symbol: config.symbol,
        exchange: config.exchange,
        timeframe: config.timeframe,
        startDate: config.startDate,
        endDate: config.endDate,
        candles: allCandles
      };

      // Cache the data
      this.cache.set(cacheKey, data);

      this.logger.info(`✅ Loaded ${allCandles.length} candles for ${config.symbol}`);
      return data;

    } catch (error) {
      this.logger.error(`Failed to load data from ${config.exchange}:`, error);
      throw error;
    }
  }

  /**
   * Load historical data from CSV file
   */
  async loadFromCSV(filePath: string, config: Partial<DataLoaderConfig> = {}): Promise<HistoricalData> {
    this.logger.info(`Loading data from CSV: ${filePath}`);
    
    const fs = await import('fs');
    const path = await import('path');
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.trim().split('\n');
    const header = lines[0].toLowerCase().split(',');
    
    // Detect column indices
    const timestampIdx = header.findIndex(h => 
      ['timestamp', 'time', 'date', 'datetime'].includes(h.trim())
    );
    const openIdx = header.findIndex(h => h.trim() === 'open');
    const highIdx = header.findIndex(h => h.trim() === 'high');
    const lowIdx = header.findIndex(h => h.trim() === 'low');
    const closeIdx = header.findIndex(h => h.trim() === 'close');
    const volumeIdx = header.findIndex(h => h.trim() === 'volume');

    if ([timestampIdx, openIdx, highIdx, lowIdx, closeIdx].includes(-1)) {
      throw new Error('CSV must contain timestamp, open, high, low, close columns');
    }

    const candles: OHLCV[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      
      const timestamp = this.parseTimestamp(cols[timestampIdx]);
      
      // Apply date filters
      if (config.startDate && timestamp < config.startDate) continue;
      if (config.endDate && timestamp > config.endDate) continue;
      
      candles.push({
        timestamp,
        open: parseFloat(cols[openIdx]),
        high: parseFloat(cols[highIdx]),
        low: parseFloat(cols[lowIdx]),
        close: parseFloat(cols[closeIdx]),
        volume: volumeIdx >= 0 ? parseFloat(cols[volumeIdx]) : 0
      });
    }

    // Sort by timestamp
    candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const data: HistoricalData = {
      symbol: config.symbol || path.basename(filePath, '.csv'),
      exchange: config.exchange || 'csv',
      timeframe: config.timeframe || this.detectTimeframe(candles),
      startDate: candles[0]?.timestamp || new Date(),
      endDate: candles[candles.length - 1]?.timestamp || new Date(),
      candles
    };

    this.logger.info(`✅ Loaded ${candles.length} candles from CSV`);
    return data;
  }

  /**
   * Load historical data from JSON file
   */
  async loadFromJSON(filePath: string): Promise<HistoricalData> {
    this.logger.info(`Loading data from JSON: ${filePath}`);
    
    const fs = await import('fs');
    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);

    // Support different JSON formats
    let candles: OHLCV[];
    
    if (Array.isArray(json)) {
      // Array of candles
      candles = json.map(c => this.normalizeCandle(c));
    } else if (json.candles) {
      // Object with candles array
      candles = json.candles.map((c: any) => this.normalizeCandle(c));
    } else if (json.data) {
      // Object with data array
      candles = json.data.map((c: any) => this.normalizeCandle(c));
    } else {
      throw new Error('Unrecognized JSON format');
    }

    // Sort by timestamp
    candles.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const data: HistoricalData = {
      symbol: json.symbol || 'unknown',
      exchange: json.exchange || 'json',
      timeframe: json.timeframe || this.detectTimeframe(candles),
      startDate: candles[0]?.timestamp || new Date(),
      endDate: candles[candles.length - 1]?.timestamp || new Date(),
      candles
    };

    this.logger.info(`✅ Loaded ${candles.length} candles from JSON`);
    return data;
  }

  /**
   * Generate synthetic data for testing
   */
  generateSyntheticData(config: {
    symbol: string;
    startDate: Date;
    endDate: Date;
    timeframe: string;
    startPrice: number;
    volatility: number;
    trend: number;
  }): HistoricalData {
    this.logger.info(`Generating synthetic data for ${config.symbol}...`);

    const candles: OHLCV[] = [];
    const intervalMs = this.getTimeframeMs(config.timeframe);
    let currentTime = config.startDate.getTime();
    let currentPrice = config.startPrice;

    while (currentTime <= config.endDate.getTime()) {
      // Random walk with trend
      const change = (Math.random() - 0.5) * 2 * config.volatility + config.trend;
      const open = currentPrice;
      const close = currentPrice * (1 + change / 100);
      
      // Generate high/low within the range
      const range = Math.abs(close - open) + (Math.random() * config.volatility / 100 * currentPrice);
      const high = Math.max(open, close) + range * Math.random();
      const low = Math.min(open, close) - range * Math.random();
      
      candles.push({
        timestamp: new Date(currentTime),
        open,
        high,
        low: Math.max(low, 0.01), // Prevent negative prices
        close,
        volume: Math.random() * 1000000 + 100000
      });

      currentPrice = close;
      currentTime += intervalMs;
    }

    this.logger.info(`✅ Generated ${candles.length} synthetic candles`);

    return {
      symbol: config.symbol,
      exchange: 'synthetic',
      timeframe: config.timeframe,
      startDate: config.startDate,
      endDate: config.endDate,
      candles
    };
  }

  /**
   * Save data to file for caching
   */
  async saveToFile(data: HistoricalData, filePath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.json') {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } else if (ext === '.csv') {
      const header = 'timestamp,open,high,low,close,volume\n';
      const rows = data.candles.map(c => 
        `${c.timestamp.toISOString()},${c.open},${c.high},${c.low},${c.close},${c.volume}`
      ).join('\n');
      fs.writeFileSync(filePath, header + rows);
    }

    this.logger.info(`✅ Saved data to ${filePath}`);
  }

  /**
   * Clear cached data
   */
  clearCache(): void {
    this.cache.clear();
    this.logger.info('Cache cleared');
  }

  // ===== HELPER METHODS =====

  private parseCandles(rawData: number[][]): OHLCV[] {
    return rawData.map(candle => ({
      timestamp: new Date(candle[0]),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: candle[5]
    }));
  }

  private parseTimestamp(value: string): Date {
    const trimmed = value.trim();
    
    // Unix timestamp (seconds or milliseconds)
    if (/^\d+$/.test(trimmed)) {
      const num = parseInt(trimmed);
      return new Date(num > 1e12 ? num : num * 1000);
    }
    
    // ISO or other date format
    return new Date(trimmed);
  }

  private normalizeCandle(candle: any): OHLCV {
    return {
      timestamp: new Date(candle.timestamp || candle.time || candle.date || candle[0]),
      open: parseFloat(candle.open || candle.o || candle[1]),
      high: parseFloat(candle.high || candle.h || candle[2]),
      low: parseFloat(candle.low || candle.l || candle[3]),
      close: parseFloat(candle.close || candle.c || candle[4]),
      volume: parseFloat(candle.volume || candle.v || candle[5] || 0)
    };
  }

  private detectTimeframe(candles: OHLCV[]): string {
    if (candles.length < 2) return '1h';
    
    const diff = candles[1].timestamp.getTime() - candles[0].timestamp.getTime();
    const minutes = diff / 60000;
    
    if (minutes <= 1) return '1m';
    if (minutes <= 5) return '5m';
    if (minutes <= 15) return '15m';
    if (minutes <= 30) return '30m';
    if (minutes <= 60) return '1h';
    if (minutes <= 240) return '4h';
    if (minutes <= 1440) return '1d';
    if (minutes <= 10080) return '1w';
    return '1M';
  }

  private getTimeframeMs(timeframe: string): number {
    const units: Record<string, number> = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
      'd': 24 * 60 * 60 * 1000,
      'w': 7 * 24 * 60 * 60 * 1000,
      'M': 30 * 24 * 60 * 60 * 1000
    };
    
    const match = timeframe.match(/^(\d+)([mhdwM])$/);
    if (match) {
      return parseInt(match[1]) * (units[match[2]] || units['h']);
    }
    
    return 60 * 60 * 1000; // Default 1h
  }

  private getCacheKey(config: DataLoaderConfig): string {
    return `${config.exchange}:${config.symbol}:${config.timeframe}:${config.startDate.getTime()}:${config.endDate.getTime()}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
