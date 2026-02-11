/**
 * K.I.T. Economic Calendar Trading Skill
 * Event-driven trading automation
 */

import { EventEmitter } from 'events';

// Types
interface EconomicEvent {
  id: string;
  name: string;
  country: string;
  currency: string;
  datetime: Date;
  impact: 'high' | 'medium' | 'low';
  forecast?: number;
  previous?: number;
  actual?: number;
  unit?: string;
  source: string;
  category: 'economic' | 'earnings' | 'crypto' | 'custom';
}

interface HistoricalImpact {
  event: string;
  pair: string;
  samples: number;
  avgMove: number;
  maxMove: number;
  minMove: number;
  avgDuration: string;
  positiveDeviation: {
    avgMove: number;
    direction: 'up' | 'down';
  };
  negativeDeviation: {
    avgMove: number;
    direction: 'up' | 'down';
  };
}

interface CalendarConfig {
  sources: ('forexfactory' | 'investing' | 'tradingview' | 'coinmarketcal')[];
  timezone: string;
  minImpact?: 'high' | 'medium' | 'low';
  currencies?: string[];
}

interface EventStrategy {
  name: string;
  event: string;
  trigger: 'pre' | 'post';
  minutesBefore?: number;
  entryDelay?: string;
  condition?: {
    deviationPercent?: number;
    deviationAbsolute?: number;
  };
  action: 'straddle' | 'strangle' | 'breakout' | 'fade' | 'square';
  direction?: 'deviation' | 'counter' | 'long' | 'short';
  size?: number;
  riskPercent?: number;
  takeProfit?: number | string;
  stopLoss?: number | string;
  symbols?: string[];
}

// Calendar Source Adapters
abstract class CalendarSource {
  abstract name: string;
  abstract fetchEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]>;
}

class ForexFactorySource extends CalendarSource {
  name = 'forexfactory';
  
  async fetchEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
    // ForexFactory scraper implementation
    // In production, would scrape https://www.forexfactory.com/calendar
    const events: EconomicEvent[] = [];
    
    // Simulated high-impact events
    const now = new Date();
    const upcomingEvents = [
      { name: 'Non-Farm Payrolls', country: 'US', currency: 'USD', impact: 'high' as const },
      { name: 'CPI m/m', country: 'US', currency: 'USD', impact: 'high' as const },
      { name: 'FOMC Statement', country: 'US', currency: 'USD', impact: 'high' as const },
      { name: 'ECB Rate Decision', country: 'EU', currency: 'EUR', impact: 'high' as const },
      { name: 'GDP q/q', country: 'US', currency: 'USD', impact: 'medium' as const },
      { name: 'Retail Sales m/m', country: 'US', currency: 'USD', impact: 'medium' as const },
      { name: 'PMI Manufacturing', country: 'US', currency: 'USD', impact: 'medium' as const },
      { name: 'Unemployment Claims', country: 'US', currency: 'USD', impact: 'low' as const },
    ];
    
    // Generate mock upcoming events
    upcomingEvents.forEach((e, i) => {
      const eventDate = new Date(now.getTime() + (i + 1) * 24 * 60 * 60 * 1000);
      if (eventDate >= startDate && eventDate <= endDate) {
        events.push({
          id: `ff_${e.name.toLowerCase().replace(/\s/g, '_')}_${eventDate.getTime()}`,
          name: e.name,
          country: e.country,
          currency: e.currency,
          datetime: eventDate,
          impact: e.impact,
          source: this.name,
          category: 'economic'
        });
      }
    });
    
    return events;
  }
}

class InvestingComSource extends CalendarSource {
  name = 'investing';
  
  async fetchEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
    // Investing.com API implementation
    // Would use their economic calendar API
    return [];
  }
}

class TradingViewSource extends CalendarSource {
  name = 'tradingview';
  
  async fetchEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
    // TradingView calendar scraper
    return [];
  }
}

class CoinMarketCalSource extends CalendarSource {
  name = 'coinmarketcal';
  
  async fetchEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
    // CoinMarketCal API for crypto events
    // https://coinmarketcal.com/api
    const events: EconomicEvent[] = [];
    
    const cryptoEvents = [
      { name: 'Bitcoin Halving', currency: 'BTC', impact: 'high' as const },
      { name: 'ETH Dencun Upgrade', currency: 'ETH', impact: 'high' as const },
      { name: 'Token Unlock', currency: 'ARB', impact: 'medium' as const },
      { name: 'Mainnet Launch', currency: 'SUI', impact: 'medium' as const },
    ];
    
    return events;
  }
}

// Main Economic Calendar Class
export class EconomicCalendar extends EventEmitter {
  private config: CalendarConfig;
  private sources: CalendarSource[] = [];
  private events: EconomicEvent[] = [];
  private strategies: EventStrategy[] = [];
  private alertTimers: Map<string, NodeJS.Timeout> = new Map();
  private historicalData: Map<string, HistoricalImpact> = new Map();
  
  constructor(config: CalendarConfig) {
    super();
    this.config = config;
    this.initSources();
  }
  
  private initSources(): void {
    for (const source of this.config.sources) {
      switch (source) {
        case 'forexfactory':
          this.sources.push(new ForexFactorySource());
          break;
        case 'investing':
          this.sources.push(new InvestingComSource());
          break;
        case 'tradingview':
          this.sources.push(new TradingViewSource());
          break;
        case 'coinmarketcal':
          this.sources.push(new CoinMarketCalSource());
          break;
      }
    }
  }
  
  // Fetch and aggregate events from all sources
  async refresh(): Promise<void> {
    const now = new Date();
    const endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week ahead
    
    const allEvents: EconomicEvent[] = [];
    
    for (const source of this.sources) {
      try {
        const events = await source.fetchEvents(now, endDate);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Error fetching from ${source.name}:`, error);
      }
    }
    
    // Deduplicate and sort
    this.events = this.deduplicateEvents(allEvents);
    this.events.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    
    // Filter by config
    if (this.config.minImpact) {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      const minLevel = impactOrder[this.config.minImpact];
      this.events = this.events.filter(e => impactOrder[e.impact] >= minLevel);
    }
    
    if (this.config.currencies && this.config.currencies.length > 0) {
      this.events = this.events.filter(e => 
        this.config.currencies!.includes(e.currency)
      );
    }
    
    // Setup alert timers
    this.setupAlertTimers();
    
    this.emit('refreshed', this.events);
  }
  
  private deduplicateEvents(events: EconomicEvent[]): EconomicEvent[] {
    const seen = new Map<string, EconomicEvent>();
    
    for (const event of events) {
      const key = `${event.name}_${event.datetime.toISOString().split('T')[0]}`;
      const existing = seen.get(key);
      
      // Prefer sources with more data
      if (!existing || (event.forecast !== undefined && existing.forecast === undefined)) {
        seen.set(key, event);
      }
    }
    
    return Array.from(seen.values());
  }
  
  // Get upcoming events
  async getUpcoming(options: {
    hours?: number;
    currencies?: string[];
    impact?: ('high' | 'medium' | 'low')[];
    categories?: string[];
  } = {}): Promise<EconomicEvent[]> {
    if (this.events.length === 0) {
      await this.refresh();
    }
    
    const now = new Date();
    const endTime = new Date(now.getTime() + (options.hours || 24) * 60 * 60 * 1000);
    
    return this.events.filter(e => {
      if (e.datetime < now || e.datetime > endTime) return false;
      if (options.currencies && !options.currencies.includes(e.currency)) return false;
      if (options.impact && !options.impact.includes(e.impact)) return false;
      if (options.categories && !options.categories.includes(e.category)) return false;
      return true;
    });
  }
  
  // Get historical impact analysis
  async getHistoricalImpact(eventName: string, options: {
    months?: number;
    pair?: string;
  } = {}): Promise<HistoricalImpact> {
    const cacheKey = `${eventName}_${options.pair || 'default'}`;
    
    if (this.historicalData.has(cacheKey)) {
      return this.historicalData.get(cacheKey)!;
    }
    
    // In production, would query historical database
    // For now, return typical values based on event type
    const impactData: Record<string, Partial<HistoricalImpact>> = {
      'Non-Farm Payrolls': { avgMove: 67, maxMove: 142, minMove: 15, avgDuration: '4h' },
      'CPI m/m': { avgMove: 45, maxMove: 98, minMove: 10, avgDuration: '2h' },
      'FOMC Statement': { avgMove: 85, maxMove: 200, minMove: 20, avgDuration: '6h' },
      'ECB Rate Decision': { avgMove: 55, maxMove: 120, minMove: 12, avgDuration: '3h' },
      'GDP q/q': { avgMove: 25, maxMove: 60, minMove: 5, avgDuration: '1h' },
    };
    
    const baseData = impactData[eventName] || { avgMove: 30, maxMove: 70, minMove: 5, avgDuration: '2h' };
    
    const result: HistoricalImpact = {
      event: eventName,
      pair: options.pair || 'EURUSD',
      samples: options.months || 12,
      avgMove: baseData.avgMove!,
      maxMove: baseData.maxMove!,
      minMove: baseData.minMove!,
      avgDuration: baseData.avgDuration!,
      positiveDeviation: { avgMove: baseData.avgMove! * 1.2, direction: 'up' },
      negativeDeviation: { avgMove: baseData.avgMove! * 1.1, direction: 'down' }
    };
    
    this.historicalData.set(cacheKey, result);
    return result;
  }
  
  // Setup alert timers for upcoming events
  private setupAlertTimers(): void {
    // Clear existing timers
    for (const timer of this.alertTimers.values()) {
      clearTimeout(timer);
    }
    this.alertTimers.clear();
    
    const now = Date.now();
    const alertMinutes = [60, 15, 5, 1]; // Alert 60, 15, 5, 1 minutes before
    
    for (const event of this.events) {
      const eventTime = event.datetime.getTime();
      
      for (const minutes of alertMinutes) {
        const alertTime = eventTime - minutes * 60 * 1000;
        const delay = alertTime - now;
        
        if (delay > 0 && delay < 24 * 60 * 60 * 1000) { // Within 24h
          const timerId = `${event.id}_${minutes}m`;
          const timer = setTimeout(() => {
            this.emit('pre-event', { event, minutesBefore: minutes });
          }, delay);
          this.alertTimers.set(timerId, timer);
        }
      }
      
      // Post-event alert (5 seconds after scheduled time)
      const postDelay = eventTime + 5000 - now;
      if (postDelay > 0 && postDelay < 24 * 60 * 60 * 1000) {
        const timer = setTimeout(() => {
          this.emit('post-event', { event });
        }, postDelay);
        this.alertTimers.set(`${event.id}_post`, timer);
      }
    }
  }
  
  // Register event strategy
  registerStrategy(strategy: EventStrategy): void {
    this.strategies.push(strategy);
    console.log(`📅 Registered strategy: ${strategy.name}`);
  }
  
  // Check if we have exposure to event-sensitive positions
  checkExposure(positions: Array<{ symbol: string; size: number }>): Array<{
    event: EconomicEvent;
    exposedPositions: typeof positions;
    riskLevel: 'high' | 'medium' | 'low';
    recommendation: string;
  }> {
    const results: Array<{
      event: EconomicEvent;
      exposedPositions: typeof positions;
      riskLevel: 'high' | 'medium' | 'low';
      recommendation: string;
    }> = [];
    
    const currencyMap: Record<string, string[]> = {
      USD: ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'USDCAD', 'AUDUSD', 'NZDUSD', 'BTCUSD', 'ETHUSD'],
      EUR: ['EURUSD', 'EURGBP', 'EURJPY', 'EURCHF', 'EURCAD', 'EURAUD'],
      GBP: ['GBPUSD', 'EURGBP', 'GBPJPY', 'GBPCHF', 'GBPAUD'],
      JPY: ['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY'],
    };
    
    const upcomingHighImpact = this.events.filter(e => {
      const hoursUntil = (e.datetime.getTime() - Date.now()) / (1000 * 60 * 60);
      return e.impact === 'high' && hoursUntil > 0 && hoursUntil < 4;
    });
    
    for (const event of upcomingHighImpact) {
      const affectedPairs = currencyMap[event.currency] || [];
      const exposed = positions.filter(p => 
        affectedPairs.some(pair => p.symbol.toUpperCase().includes(pair.replace('/', '')))
      );
      
      if (exposed.length > 0) {
        results.push({
          event,
          exposedPositions: exposed,
          riskLevel: event.impact,
          recommendation: `Consider reducing position size before ${event.name}`
        });
      }
    }
    
    return results;
  }
  
  // Auto-square positions before high-impact events
  enableAutoSquare(options: {
    minutesBefore: number;
    impactLevel: 'high' | 'medium' | 'low';
    symbols?: string[];
    squareCallback: (symbol: string) => Promise<void>;
  }): void {
    this.on('pre-event', async ({ event, minutesBefore }) => {
      const impactOrder = { high: 3, medium: 2, low: 1 };
      
      if (
        minutesBefore === options.minutesBefore &&
        impactOrder[event.impact] >= impactOrder[options.impactLevel]
      ) {
        console.log(`⚠️ Auto-squaring positions ${minutesBefore}m before ${event.name}`);
        
        const symbolsToSquare = options.symbols || ['EURUSD', 'GBPUSD', 'USDJPY'];
        for (const symbol of symbolsToSquare) {
          try {
            await options.squareCallback(symbol);
          } catch (error) {
            console.error(`Failed to square ${symbol}:`, error);
          }
        }
      }
    });
  }
  
  // Calculate expected move from volatility
  calculateExpectedMove(symbol: string, hoursUntilEvent: number): {
    expectedMove: number;
    confidence: number;
    straddleCost?: number;
  } {
    // In production, would use options pricing or historical volatility
    // For now, return estimated values
    const baseVolatility: Record<string, number> = {
      EURUSD: 0.006, // 60 pips daily range
      GBPUSD: 0.008,
      USDJPY: 0.007,
      BTCUSD: 0.03, // 3% daily
      ETHUSD: 0.04,
    };
    
    const vol = baseVolatility[symbol.replace('/', '')] || 0.01;
    const eventMultiplier = 1.5; // Events typically increase vol by 50%
    
    const expectedMove = vol * eventMultiplier * Math.sqrt(hoursUntilEvent / 24);
    
    return {
      expectedMove,
      confidence: 0.68, // 1 standard deviation
      straddleCost: expectedMove * 0.5 // Rough estimate
    };
  }
  
  // Add custom event
  addCustomEvent(event: Omit<EconomicEvent, 'id' | 'source'>): void {
    const customEvent: EconomicEvent = {
      ...event,
      id: `custom_${Date.now()}`,
      source: 'custom'
    };
    
    this.events.push(customEvent);
    this.events.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    this.setupAlertTimers();
  }
  
  // Get dashboard widget data
  getDashboardData(): {
    nextEvents: Array<EconomicEvent & { countdown: string }>;
    todayEvents: EconomicEvent[];
    weekAhead: { high: number; medium: number; low: number };
  } {
    const now = new Date();
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    
    const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const nextEvents = this.events
      .filter(e => e.datetime > now)
      .slice(0, 5)
      .map(e => {
        const diff = e.datetime.getTime() - now.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        return {
          ...e,
          countdown: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`
        };
      });
    
    const todayEvents = this.events.filter(e => e.datetime >= now && e.datetime <= todayEnd);
    
    const weekEvents = this.events.filter(e => e.datetime >= now && e.datetime <= weekEnd);
    const weekAhead = {
      high: weekEvents.filter(e => e.impact === 'high').length,
      medium: weekEvents.filter(e => e.impact === 'medium').length,
      low: weekEvents.filter(e => e.impact === 'low').length
    };
    
    return { nextEvents, todayEvents, weekAhead };
  }
  
  // Cleanup
  destroy(): void {
    for (const timer of this.alertTimers.values()) {
      clearTimeout(timer);
    }
    this.alertTimers.clear();
    this.removeAllListeners();
  }
}

// Pre-built Event Strategies
export class NFPStraddleStrategy {
  calendar: EconomicCalendar;
  
  constructor(calendar: EconomicCalendar) {
    this.calendar = calendar;
    this.register();
  }
  
  private register(): void {
    this.calendar.registerStrategy({
      name: 'NFP Straddle',
      event: 'Non-Farm Payrolls',
      trigger: 'pre',
      minutesBefore: 30,
      action: 'straddle',
      riskPercent: 1,
      takeProfit: 50,
      stopLoss: 20,
      symbols: ['EURUSD', 'GBPUSD']
    });
  }
}

export class CPIBreakoutStrategy {
  calendar: EconomicCalendar;
  
  constructor(calendar: EconomicCalendar) {
    this.calendar = calendar;
    this.register();
  }
  
  private register(): void {
    this.calendar.registerStrategy({
      name: 'CPI Breakout',
      event: 'CPI',
      trigger: 'post',
      entryDelay: '30s',
      condition: { deviationPercent: 0.2 },
      action: 'breakout',
      direction: 'deviation',
      riskPercent: 0.5,
      takeProfit: 30,
      stopLoss: 15,
      symbols: ['EURUSD', 'USDJPY', 'BTCUSD']
    });
  }
}

export class FOMCFadeStrategy {
  calendar: EconomicCalendar;
  
  constructor(calendar: EconomicCalendar) {
    this.calendar = calendar;
    this.register();
  }
  
  private register(): void {
    this.calendar.registerStrategy({
      name: 'FOMC Fade',
      event: 'FOMC Statement',
      trigger: 'post',
      entryDelay: '15m',
      action: 'fade',
      direction: 'counter',
      riskPercent: 0.5,
      takeProfit: '50%', // 50% retracement
      stopLoss: 'new_extreme',
      symbols: ['EURUSD', 'GBPUSD', 'USDJPY']
    });
  }
}

// Export default instance creator
export function createEconomicCalendar(config?: Partial<CalendarConfig>): EconomicCalendar {
  return new EconomicCalendar({
    sources: ['forexfactory'],
    timezone: 'UTC',
    ...config
  });
}
