/**
 * K.I.T. Alert System Tool
 * 
 * Issue #10: Alert-System Tool
 * 
 * Provides alert management capabilities:
 * - Price alerts (above/below thresholds)
 * - Indicator alerts (RSI, MACD crossovers)
 * - Portfolio alerts (P&L thresholds)
 * - Custom condition alerts
 * - Notification delivery
 */

import ccxt, { Exchange } from 'ccxt';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { RSI, MACD } from 'technicalindicators';
import {
  Alert,
  AlertType,
  AlertCondition,
  AlertStatus,
  ExchangeConfig,
} from './types';

const toNum = (val: number | string | undefined, def: number = 0): number => {
  if (val === undefined || val === null) return def;
  return typeof val === 'string' ? parseFloat(val) : val;
};

export interface CreateAlertParams {
  type: AlertType;
  symbol?: string;
  condition: AlertCondition;
  value: number;
  message?: string;
  expiresIn?: number;
  notifyChannels?: string[];
}

export interface AlertSystemConfig {
  exchange?: ExchangeConfig;
  checkInterval?: number;
  persistPath?: string;
  maxAlerts?: number;
  notificationCallback?: (alert: Alert, message: string) => void;
}

export interface AlertSummary {
  total: number;
  active: number;
  triggered: number;
  paused: number;
  byType: Record<AlertType, number>;
}

const DEFAULT_CONFIG: AlertSystemConfig = {
  checkInterval: 30,
  persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'alerts'),
  maxAlerts: 100,
};

export class AlertSystem extends EventEmitter {
  private exchange: Exchange | null = null;
  private config: AlertSystemConfig;
  private alerts: Map<string, Alert> = new Map();
  private checkTimer?: ReturnType<typeof setInterval>;
  private isRunning: boolean = false;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private indicatorCache: Map<string, { data: any; timestamp: number }> = new Map();

  constructor(config?: Partial<AlertSystemConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadAlerts();
  }

  async start(exchangeConfig?: ExchangeConfig): Promise<boolean> {
    try {
      const cfg = exchangeConfig || this.config.exchange || { id: 'binance' };
      const exchangeId = cfg.id.toLowerCase();
      
      if (!(exchangeId in ccxt)) {
        throw new Error(`Exchange ${cfg.id} not supported`);
      }

      const ExchangeClass = (ccxt as any)[exchangeId];
      this.exchange = new ExchangeClass({
        apiKey: cfg.apiKey,
        secret: cfg.secret,
        sandbox: cfg.sandbox,
        enableRateLimit: true,
      }) as Exchange;

      await this.exchange.loadMarkets();
      this.isRunning = true;
      this.startMonitoring();
      this.emit('started');
      return true;
    } catch (error: any) {
      this.emit('error', { type: 'connection', error: error.message });
      return false;
    }
  }

  create(params: CreateAlertParams): Alert {
    if (this.alerts.size >= (this.config.maxAlerts || 100)) {
      throw new Error(`Maximum alerts (${this.config.maxAlerts}) reached`);
    }

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: params.type,
      symbol: params.symbol,
      condition: params.condition,
      value: params.value,
      status: 'active',
      message: params.message,
      createdAt: Date.now(),
      expiresAt: params.expiresIn ? Date.now() + params.expiresIn * 60 * 1000 : undefined,
    };

    this.alerts.set(alert.id, alert);
    this.persistAlerts();
    this.emit('created', alert);
    return alert;
  }

  createPriceAlert(symbol: string, condition: 'above' | 'below', price: number, message?: string): Alert {
    return this.create({
      type: 'price', symbol, condition, value: price,
      message: message || `${symbol} price ${condition} $${price}`,
    });
  }

  createRsiAlert(symbol: string, condition: 'above' | 'below', threshold: number, message?: string): Alert {
    return this.create({
      type: 'rsi', symbol, condition, value: threshold,
      message: message || `${symbol} RSI ${condition} ${threshold}`,
    });
  }

  createMacdAlert(symbol: string, condition: 'cross_above' | 'cross_below', message?: string): Alert {
    return this.create({
      type: 'macd', symbol, condition, value: 0,
      message: message || `${symbol} MACD ${condition === 'cross_above' ? 'bullish' : 'bearish'} crossover`,
    });
  }

  createPortfolioAlert(condition: 'above' | 'below' | 'change_pct', value: number, message?: string): Alert {
    return this.create({
      type: 'portfolio', condition, value,
      message: message || `Portfolio ${condition === 'change_pct' ? `changed ${value}%` : `P&L ${condition} $${value}`}`,
    });
  }

  list(status?: AlertStatus): Alert[] {
    const alerts = Array.from(this.alerts.values());
    return status ? alerts.filter(a => a.status === status) : alerts;
  }

  get(alertId: string): Alert | undefined { return this.alerts.get(alertId); }

  delete(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;
    alert.status = 'deleted';
    this.alerts.delete(alertId);
    this.persistAlerts();
    this.emit('deleted', alert);
    return true;
  }

  pause(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') return false;
    alert.status = 'paused';
    this.persistAlerts();
    this.emit('paused', alert);
    return true;
  }

  resume(alertId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'paused') return false;
    alert.status = 'active';
    this.persistAlerts();
    this.emit('resumed', alert);
    return true;
  }

  getSummary(): AlertSummary {
    const alerts = Array.from(this.alerts.values());
    const summary: AlertSummary = {
      total: alerts.length,
      active: alerts.filter(a => a.status === 'active').length,
      triggered: alerts.filter(a => a.status === 'triggered').length,
      paused: alerts.filter(a => a.status === 'paused').length,
      byType: { price: 0, rsi: 0, macd: 0, volume: 0, portfolio: 0, custom: 0 },
    };
    for (const alert of alerts) summary.byType[alert.type]++;
    return summary;
  }

  stop(): void {
    this.isRunning = false;
    if (this.checkTimer) clearInterval(this.checkTimer);
    this.persistAlerts();
    this.emit('stopped');
  }

  private startMonitoring(): void {
    const intervalMs = (this.config.checkInterval || 30) * 1000;
    this.checkTimer = setInterval(async () => {
      if (!this.isRunning) return;
      try { await this.checkAlerts(); }
      catch (error: any) { this.emit('error', { type: 'check', error: error.message }); }
    }, intervalMs);
    this.checkAlerts().catch(console.error);
  }

  private async checkAlerts(): Promise<void> {
    const activeAlerts = this.list('active');
    for (const alert of activeAlerts) {
      try {
        if (alert.expiresAt && Date.now() > alert.expiresAt) {
          alert.status = 'expired';
          this.emit('expired', alert);
          continue;
        }
        if (await this.evaluateAlert(alert)) {
          await this.triggerAlert(alert);
        }
      } catch (error: any) {
        console.error(`Error checking alert ${alert.id}:`, error.message);
      }
    }
    this.persistAlerts();
  }

  private async evaluateAlert(alert: Alert): Promise<boolean> {
    switch (alert.type) {
      case 'price': return this.evaluatePriceAlert(alert);
      case 'rsi': return this.evaluateRsiAlert(alert);
      case 'macd': return this.evaluateMacdAlert(alert);
      case 'volume': return this.evaluateVolumeAlert(alert);
      case 'portfolio': return this.evaluatePortfolioAlert(alert);
      default: return false;
    }
  }

  private async evaluatePriceAlert(alert: Alert): Promise<boolean> {
    if (!alert.symbol) return false;
    const price = await this.getPrice(alert.symbol);
    alert.currentValue = price;
    if (alert.condition === 'above') return price >= alert.value;
    if (alert.condition === 'below') return price <= alert.value;
    return false;
  }

  private async evaluateRsiAlert(alert: Alert): Promise<boolean> {
    if (!alert.symbol) return false;
    const rsi = await this.getRsi(alert.symbol);
    if (rsi === null) return false;
    alert.currentValue = rsi;
    if (alert.condition === 'above') return rsi >= alert.value;
    if (alert.condition === 'below') return rsi <= alert.value;
    return false;
  }

  private async evaluateMacdAlert(alert: Alert): Promise<boolean> {
    if (!alert.symbol) return false;
    const macd = await this.getMacd(alert.symbol);
    if (!macd) return false;
    const prevValue = alert.currentValue;
    alert.currentValue = macd.histogram;
    if (alert.condition === 'cross_above') return prevValue !== undefined && prevValue < 0 && macd.histogram >= 0;
    if (alert.condition === 'cross_below') return prevValue !== undefined && prevValue >= 0 && macd.histogram < 0;
    return false;
  }

  private async evaluateVolumeAlert(alert: Alert): Promise<boolean> {
    if (!alert.symbol) return false;
    const volume = await this.getVolume(alert.symbol);
    if (volume === null) return false;
    alert.currentValue = volume;
    if (alert.condition === 'above') return volume >= alert.value;
    if (alert.condition === 'below') return volume <= alert.value;
    return false;
  }

  private async evaluatePortfolioAlert(alert: Alert): Promise<boolean> {
    this.emit('portfolioCheck', alert);
    return false;
  }

  private async triggerAlert(alert: Alert): Promise<void> {
    alert.status = 'triggered';
    alert.triggeredAt = Date.now();
    const message = this.formatAlertMessage(alert);
    this.emit('triggered', { alert, message });
    if (this.config.notificationCallback) {
      try { this.config.notificationCallback(alert, message); }
      catch (e: any) { console.error('Notification callback error:', e.message); }
    }
    console.log(`🔔 ALERT TRIGGERED: ${message}`);
  }

  private formatAlertMessage(alert: Alert): string {
    if (alert.message) return `${alert.message} (Current: ${alert.currentValue?.toFixed(2)})`;
    const symbol = alert.symbol || 'Portfolio';
    switch (alert.type) {
      case 'price': return `${symbol} price is now $${alert.currentValue?.toFixed(2)} (${alert.condition} $${alert.value})`;
      case 'rsi': return `${symbol} RSI is now ${alert.currentValue?.toFixed(1)} (${alert.condition} ${alert.value})`;
      case 'macd': return `${symbol} MACD ${alert.condition === 'cross_above' ? 'bullish' : 'bearish'} crossover`;
      case 'volume': return `${symbol} volume alert: ${alert.currentValue?.toFixed(0)}`;
      case 'portfolio': return `Portfolio alert: ${alert.condition} ${alert.value}`;
      default: return `Alert: ${alert.type}`;
    }
  }

  private async getPrice(symbol: string): Promise<number> {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < 5000) return cached.price;
    if (!this.exchange) throw new Error('Exchange not connected');
    const ticker = await this.exchange.fetchTicker(symbol);
    const price = toNum(ticker.last);
    this.priceCache.set(symbol, { price, timestamp: Date.now() });
    return price;
  }

  private async getRsi(symbol: string, period: number = 14): Promise<number | null> {
    const cacheKey = `rsi_${symbol}`;
    const cached = this.indicatorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) return cached.data;
    if (!this.exchange) return null;

    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, '1h', undefined, period + 10);
      const closes = ohlcv.map((c: any) => toNum(c[4]));
      const rsiValues = RSI.calculate({ period, values: closes });
      const rsi = rsiValues[rsiValues.length - 1];
      this.indicatorCache.set(cacheKey, { data: rsi, timestamp: Date.now() });
      return rsi;
    } catch { return null; }
  }

  private async getMacd(symbol: string): Promise<{ macd: number; signal: number; histogram: number } | null> {
    const cacheKey = `macd_${symbol}`;
    const cached = this.indicatorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) return cached.data;
    if (!this.exchange) return null;

    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, '1h', undefined, 50);
      const closes = ohlcv.map((c: any) => toNum(c[4]));
      const macdValues = MACD.calculate({
        fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        values: closes, SimpleMAOscillator: false, SimpleMASignal: false,
      });
      const lastMacd = macdValues[macdValues.length - 1];
      if (!lastMacd) return null;
      const result = { macd: lastMacd.MACD || 0, signal: lastMacd.signal || 0, histogram: lastMacd.histogram || 0 };
      this.indicatorCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch { return null; }
  }

  private async getVolume(symbol: string): Promise<number | null> {
    const cacheKey = `volume_${symbol}`;
    const cached = this.indicatorCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) return cached.data;
    if (!this.exchange) return null;

    try {
      const ticker = await this.exchange.fetchTicker(symbol);
      const volume = toNum(ticker.baseVolume);
      this.indicatorCache.set(cacheKey, { data: volume, timestamp: Date.now() });
      return volume;
    } catch { return null; }
  }

  private loadAlerts(): void {
    if (!this.config.persistPath) return;
    try {
      const filePath = path.join(this.config.persistPath, 'alerts.json');
      if (fs.existsSync(filePath)) {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        for (const alert of data) {
          if ((alert.status === 'active' || alert.status === 'paused') && (!alert.expiresAt || alert.expiresAt > Date.now())) {
            this.alerts.set(alert.id, alert);
          }
        }
        console.log(`Loaded ${this.alerts.size} alerts`);
      }
    } catch (e: any) { console.warn('Could not load alerts:', e.message); }
  }

  private persistAlerts(): void {
    if (!this.config.persistPath) return;
    try {
      if (!fs.existsSync(this.config.persistPath)) fs.mkdirSync(this.config.persistPath, { recursive: true });
      fs.writeFileSync(
        path.join(this.config.persistPath, 'alerts.json'),
        JSON.stringify(Array.from(this.alerts.values()), null, 2)
      );
    } catch (e: any) { console.error('Could not persist alerts:', e.message); }
  }
}

export function createAlertSystem(config?: Partial<AlertSystemConfig>): AlertSystem {
  return new AlertSystem(config);
}

export default AlertSystem;
