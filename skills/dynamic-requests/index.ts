/**
 * Dynamic Requests Skill - Pine Script v6 Inspired
 * 
 * Fetch data from multiple symbols/timeframes at runtime
 */

import { KitSkill, SkillContext, SkillResult } from '../../src/types/skill.js';

interface DynamicRequest {
  id: string;
  name: string;
  symbols: string[];
  timeframe: string;
  lookback: number;
  indicator?: string;
  gaps: 'off' | 'on';
  lookahead: 'off' | 'on';
  calcOnEveryTick: boolean;
  currency?: string;
  adjustment: 'splits' | 'dividends' | 'none';
  status: 'active' | 'paused' | 'error';
  lastUpdate?: Date;
  data?: Map<string, any[]>;
}

interface RequestResult {
  symbol: string;
  timeframe: string;
  bars: number;
  latestClose: number;
  latestTime: Date;
  indicatorValue?: number;
}

class DynamicRequestsSkill implements KitSkill {
  name = 'dynamic-requests';
  version = '1.0.0';
  description = 'Pine Script v6 inspired dynamic security/timeframe requests';
  
  private requests: Map<string, DynamicRequest> = new Map();
  private cache: Map<string, { data: any; expires: Date }> = new Map();

  async execute(ctx: SkillContext): Promise<SkillResult> {
    const { action, params } = ctx;

    switch (action) {
      case 'add':
        return this.addRequest(params);
      case 'list':
        return this.listRequests();
      case 'pause':
        return this.pauseRequest(params.id);
      case 'resume':
        return this.resumeRequest(params.id);
      case 'remove':
        return this.removeRequest(params.id);
      case 'fetch':
        return this.fetchData(params.id);
      case 'status':
        return this.getStatus();
      default:
        return { success: false, error: `Unknown action: ${action}` };
    }
  }

  private async addRequest(params: Partial<DynamicRequest>): Promise<SkillResult> {
    const id = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const request: DynamicRequest = {
      id,
      name: params.name || `Request ${id}`,
      symbols: params.symbols || [],
      timeframe: params.timeframe || '1H',
      lookback: params.lookback || 100,
      indicator: params.indicator,
      gaps: params.gaps || 'off',
      lookahead: params.lookahead || 'off',
      calcOnEveryTick: params.calcOnEveryTick || false,
      currency: params.currency,
      adjustment: params.adjustment || 'none',
      status: 'active',
      data: new Map()
    };

    this.requests.set(id, request);

    return {
      success: true,
      data: { id, message: `Dynamic request '${request.name}' created with ${request.symbols.length} symbols` }
    };
  }

  private listRequests(): SkillResult {
    const list = Array.from(this.requests.values()).map(r => ({
      id: r.id,
      name: r.name,
      symbols: r.symbols.length,
      timeframe: r.timeframe,
      status: r.status,
      lastUpdate: r.lastUpdate
    }));

    return { success: true, data: { requests: list, total: list.length } };
  }

  private pauseRequest(id: string): SkillResult {
    const request = this.requests.get(id);
    if (!request) return { success: false, error: 'Request not found' };
    
    request.status = 'paused';
    return { success: true, data: { message: `Request '${request.name}' paused` } };
  }

  private resumeRequest(id: string): SkillResult {
    const request = this.requests.get(id);
    if (!request) return { success: false, error: 'Request not found' };
    
    request.status = 'active';
    return { success: true, data: { message: `Request '${request.name}' resumed` } };
  }

  private removeRequest(id: string): SkillResult {
    const request = this.requests.get(id);
    if (!request) return { success: false, error: 'Request not found' };
    
    this.requests.delete(id);
    return { success: true, data: { message: `Request '${request.name}' removed` } };
  }

  private async fetchData(id: string): Promise<SkillResult> {
    const request = this.requests.get(id);
    if (!request) return { success: false, error: 'Request not found' };
    if (request.status !== 'active') return { success: false, error: 'Request is not active' };

    const results: RequestResult[] = [];

    for (const symbol of request.symbols) {
      const cacheKey = `${symbol}_${request.timeframe}_${request.lookback}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && cached.expires > new Date()) {
        results.push(cached.data);
        continue;
      }

      // Simulated fetch - in production, this calls real data providers
      const mockData: RequestResult = {
        symbol,
        timeframe: request.timeframe,
        bars: request.lookback,
        latestClose: 100 + Math.random() * 50,
        latestTime: new Date(),
        indicatorValue: request.indicator ? Math.random() * 100 : undefined
      };

      results.push(mockData);
      
      // Cache with TTL based on timeframe
      const ttlMinutes = this.getTTL(request.timeframe);
      this.cache.set(cacheKey, {
        data: mockData,
        expires: new Date(Date.now() + ttlMinutes * 60 * 1000)
      });
    }

    request.lastUpdate = new Date();

    return { success: true, data: { results, fetchedAt: new Date() } };
  }

  private getTTL(timeframe: string): number {
    const ttls: Record<string, number> = {
      '1': 1, '5': 5, '15': 15, '30': 30,
      '1H': 60, '4H': 240, '1D': 1440, '1W': 10080
    };
    return ttls[timeframe] || 60;
  }

  private getStatus(): SkillResult {
    const active = Array.from(this.requests.values()).filter(r => r.status === 'active').length;
    const paused = Array.from(this.requests.values()).filter(r => r.status === 'paused').length;
    const totalSymbols = Array.from(this.requests.values()).reduce((sum, r) => sum + r.symbols.length, 0);
    const cacheSize = this.cache.size;

    return {
      success: true,
      data: {
        totalRequests: this.requests.size,
        active,
        paused,
        totalSymbols,
        cacheEntries: cacheSize,
        memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
      }
    };
  }
}

export default new DynamicRequestsSkill();
