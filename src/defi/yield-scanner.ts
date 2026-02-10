/**
 * K.I.T. Yield Scanner
 * 
 * Discovers and evaluates yield farming opportunities
 * using DefiLlama's yield aggregator API.
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/21
 */

import { EventEmitter } from 'events';
import { Chain } from './defi-manager';

// ============================================
// Types
// ============================================

export interface YieldScannerConfig {
  /** Minimum TVL filter (USD) */
  minTvl?: number;
  
  /** Maximum TVL filter (USD) */
  maxTvl?: number;
  
  /** Minimum APY filter */
  minApy?: number;
  
  /** Maximum APY filter */
  maxApy?: number;
  
  /** Chains to scan */
  chains?: Chain[];
  
  /** Stablecoin pools only */
  stablecoinsOnly?: boolean;
  
  /** Exclude these protocols */
  excludeProtocols?: string[];
  
  /** Auto-refresh interval in ms */
  refreshInterval?: number;
  
  /** Verbose logging */
  verbose?: boolean;
}

export interface YieldFarm {
  id: string;
  chain: Chain;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  apyPct1D: number;
  apyPct7D: number;
  apyPct30D: number;
  stablecoin: boolean;
  ilRisk: 'none' | 'low' | 'medium' | 'high';
  rewardTokens: string[];
  exposure: 'single' | 'multi';
  poolMeta?: string;
  url?: string;
  riskScore: number;
  riskFactors: string[];
}

export interface ScanResult {
  farms: YieldFarm[];
  totalCount: number;
  filteredCount: number;
  scanTime: Date;
  bestApy: YieldFarm | null;
  safestHigh: YieldFarm | null;  // Best APY with low risk
}

// ============================================
// Yield Scanner
// ============================================

const YIELDS_API = 'https://yields.llama.fi';

const DEFAULT_CONFIG: YieldScannerConfig = {
  minTvl: 1_000_000,      // $1M minimum
  maxApy: 100,            // Filter out ponzis
  minApy: 3,              // At least better than banks
  stablecoinsOnly: false,
  refreshInterval: 300000, // 5 minutes
  verbose: true
};

/**
 * Yield Scanner - Find profitable yield farming opportunities
 */
export class YieldScanner extends EventEmitter {
  private config: YieldScannerConfig;
  private farms: YieldFarm[] = [];
  private lastScan: Date | null = null;
  private refreshTimer?: NodeJS.Timer;
  
  constructor(config: YieldScannerConfig = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  // ============================================
  // Lifecycle
  // ============================================
  
  /**
   * Start auto-scanning
   */
  start(): void {
    if (this.config.refreshInterval && this.config.refreshInterval > 0) {
      this.refreshTimer = setInterval(() => {
        this.scan();
      }, this.config.refreshInterval);
    }
    
    // Initial scan
    this.scan();
  }
  
  /**
   * Stop auto-scanning
   */
  stop(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }
  
  // ============================================
  // Scanning
  // ============================================
  
  /**
   * Scan for yield opportunities
   */
  async scan(): Promise<ScanResult> {
    try {
      if (this.config.verbose) {
        console.log('🔍 Scanning for yield opportunities...');
      }
      
      const response = await fetch(`${YIELDS_API}/pools`, {
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const pools = data.data || [];
      
      // Process and filter
      const processed = pools
        .map((p: any) => this.processPool(p))
        .filter((p: YieldFarm | null) => p !== null) as YieldFarm[];
      
      const filtered = this.applyFilters(processed);
      
      // Sort by APY
      filtered.sort((a, b) => b.apy - a.apy);
      
      this.farms = filtered;
      this.lastScan = new Date();
      
      const result: ScanResult = {
        farms: filtered,
        totalCount: pools.length,
        filteredCount: filtered.length,
        scanTime: this.lastScan,
        bestApy: filtered[0] || null,
        safestHigh: this.findSafestHigh(filtered)
      };
      
      if (this.config.verbose) {
        console.log(`✅ Found ${result.filteredCount} opportunities (from ${result.totalCount} pools)`);
        if (result.bestApy) {
          console.log(`   Best APY: ${result.bestApy.apy.toFixed(1)}% on ${result.bestApy.project}`);
        }
        if (result.safestHigh) {
          console.log(`   Safest High: ${result.safestHigh.apy.toFixed(1)}% on ${result.safestHigh.project} (risk: ${result.safestHigh.riskScore})`);
        }
      }
      
      this.emit('scan_complete', result);
      return result;
      
    } catch (error: any) {
      console.error('Yield scan error:', error.message);
      return {
        farms: [],
        totalCount: 0,
        filteredCount: 0,
        scanTime: new Date(),
        bestApy: null,
        safestHigh: null
      };
    }
  }
  
  /**
   * Process a raw pool from DefiLlama
   */
  private processPool(pool: any): YieldFarm | null {
    try {
      const chain = this.normalizeChain(pool.chain);
      if (!chain) return null;
      
      const { riskScore, riskFactors } = this.calculateRisk(pool);
      
      return {
        id: pool.pool,
        chain,
        project: pool.project,
        symbol: pool.symbol,
        tvlUsd: pool.tvlUsd || 0,
        apy: pool.apy || 0,
        apyBase: pool.apyBase || 0,
        apyReward: pool.apyReward || 0,
        apyPct1D: pool.apyPct1D || 0,
        apyPct7D: pool.apyPct7D || 0,
        apyPct30D: pool.apyPct30D || 0,
        stablecoin: pool.stablecoin || false,
        ilRisk: this.assessILRisk(pool),
        rewardTokens: pool.rewardTokens || [],
        exposure: pool.exposure || 'multi',
        poolMeta: pool.poolMeta,
        url: pool.url,
        riskScore,
        riskFactors
      };
    } catch {
      return null;
    }
  }
  
  /**
   * Normalize chain name
   */
  private normalizeChain(chain: string): Chain | null {
    const mapping: Record<string, Chain> = {
      'ethereum': 'ethereum',
      'eth': 'ethereum',
      'mainnet': 'ethereum',
      'polygon': 'polygon',
      'matic': 'polygon',
      'arbitrum': 'arbitrum',
      'arbitrum one': 'arbitrum',
      'optimism': 'optimism',
      'op': 'optimism',
      'bsc': 'bsc',
      'binance': 'bsc',
      'avalanche': 'avalanche',
      'avax': 'avalanche',
      'base': 'base'
    };
    
    const normalized = mapping[chain.toLowerCase()];
    
    // Check if chain is in configured list
    if (this.config.chains && !this.config.chains.includes(normalized)) {
      return null;
    }
    
    return normalized || null;
  }
  
  /**
   * Calculate risk score (0-100, lower is safer)
   */
  private calculateRisk(pool: any): { riskScore: number; riskFactors: string[] } {
    let score = 20;  // Base risk
    const factors: string[] = [];
    
    // High APY = higher risk
    const apy = pool.apy || 0;
    if (apy > 100) {
      score += 40;
      factors.push('Very high APY (possible ponzi)');
    } else if (apy > 50) {
      score += 25;
      factors.push('High APY');
    } else if (apy > 20) {
      score += 10;
      factors.push('Above average APY');
    }
    
    // Low TVL = higher risk
    const tvl = pool.tvlUsd || 0;
    if (tvl < 100_000) {
      score += 30;
      factors.push('Very low TVL');
    } else if (tvl < 1_000_000) {
      score += 20;
      factors.push('Low TVL');
    } else if (tvl < 10_000_000) {
      score += 10;
      factors.push('Medium TVL');
    } else if (tvl > 100_000_000) {
      score -= 10;  // High TVL is safer
    }
    
    // New protocol = higher risk
    // (Would need to check protocol age, using project name heuristics)
    const knownSafe = ['aave', 'compound', 'lido', 'curve', 'convex', 'uniswap', 'maker'];
    if (!knownSafe.some(p => pool.project?.toLowerCase().includes(p))) {
      score += 15;
      factors.push('Lesser-known protocol');
    } else {
      score -= 10;
    }
    
    // Volatile APY = higher risk
    const apyChange = Math.abs(pool.apyPct7D || 0);
    if (apyChange > 50) {
      score += 15;
      factors.push('Volatile APY');
    }
    
    // Stablecoins are safer
    if (pool.stablecoin) {
      score -= 15;
    }
    
    // IL risk
    if (pool.exposure === 'multi' && !pool.stablecoin) {
      score += 10;
      factors.push('Impermanent loss risk');
    }
    
    return {
      riskScore: Math.max(0, Math.min(100, score)),
      riskFactors: factors
    };
  }
  
  /**
   * Assess impermanent loss risk
   */
  private assessILRisk(pool: any): 'none' | 'low' | 'medium' | 'high' {
    if (pool.exposure === 'single') return 'none';
    if (pool.stablecoin) return 'low';
    
    // Multi-asset volatile pools
    return pool.symbol?.includes('ETH') || pool.symbol?.includes('BTC') 
      ? 'medium' 
      : 'high';
  }
  
  /**
   * Apply configured filters
   */
  private applyFilters(farms: YieldFarm[]): YieldFarm[] {
    return farms.filter(f => {
      if (this.config.minTvl && f.tvlUsd < this.config.minTvl) return false;
      if (this.config.maxTvl && f.tvlUsd > this.config.maxTvl) return false;
      if (this.config.minApy && f.apy < this.config.minApy) return false;
      if (this.config.maxApy && f.apy > this.config.maxApy) return false;
      if (this.config.stablecoinsOnly && !f.stablecoin) return false;
      if (this.config.excludeProtocols?.includes(f.project.toLowerCase())) return false;
      
      return true;
    });
  }
  
  /**
   * Find the best yield with lowest risk
   */
  private findSafestHigh(farms: YieldFarm[]): YieldFarm | null {
    // Filter to low-risk farms
    const safe = farms.filter(f => f.riskScore < 40);
    if (safe.length === 0) return null;
    
    // Sort by APY
    safe.sort((a, b) => b.apy - a.apy);
    return safe[0];
  }
  
  // ============================================
  // Getters
  // ============================================
  
  /**
   * Get all discovered farms
   */
  getFarms(): YieldFarm[] {
    return [...this.farms];
  }
  
  /**
   * Get farms by chain
   */
  getFarmsByChain(chain: Chain): YieldFarm[] {
    return this.farms.filter(f => f.chain === chain);
  }
  
  /**
   * Get stablecoin farms
   */
  getStableFarms(): YieldFarm[] {
    return this.farms.filter(f => f.stablecoin);
  }
  
  /**
   * Get low-risk farms
   */
  getLowRiskFarms(maxRisk: number = 40): YieldFarm[] {
    return this.farms.filter(f => f.riskScore <= maxRisk);
  }
  
  /**
   * Get top farms by APY
   */
  getTopByApy(limit: number = 10): YieldFarm[] {
    return [...this.farms]
      .sort((a, b) => b.apy - a.apy)
      .slice(0, limit);
  }
  
  /**
   * Get best risk-adjusted farms
   */
  getBestRiskAdjusted(limit: number = 10): YieldFarm[] {
    // Score = APY / (risk + 1)
    return [...this.farms]
      .sort((a, b) => {
        const scoreA = a.apy / (a.riskScore + 1);
        const scoreB = b.apy / (b.riskScore + 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }
  
  /**
   * Get last scan time
   */
  getLastScanTime(): Date | null {
    return this.lastScan;
  }
  
  // ============================================
  // Formatted Output
  // ============================================
  
  /**
   * Get formatted yield table
   */
  getYieldTable(limit: number = 15): string {
    const farms = this.getTopByApy(limit);
    
    const lines = [
      '',
      '╔══════════════════════════════════════════════════════════════════════╗',
      '║                    K.I.T. YIELD OPPORTUNITIES                        ║',
      '╚══════════════════════════════════════════════════════════════════════╝',
      '',
      'Protocol        Pool                      Chain      TVL         APY    Risk',
      '─────────────────────────────────────────────────────────────────────────────'
    ];
    
    for (const f of farms) {
      const risk = f.riskScore < 30 ? '🟢' : f.riskScore < 50 ? '🟡' : '🔴';
      lines.push(
        `${f.project.slice(0, 14).padEnd(15)} ` +
        `${f.symbol.slice(0, 24).padEnd(25)} ` +
        `${f.chain.slice(0, 9).padEnd(10)} ` +
        `$${(f.tvlUsd / 1e6).toFixed(1).padStart(6)}M ` +
        `${f.apy.toFixed(1).padStart(6)}% ` +
        `${risk}`
      );
    }
    
    lines.push('─────────────────────────────────────────────────────────────────────────────');
    lines.push(`Total: ${this.farms.length} opportunities | Last scan: ${this.lastScan?.toISOString() || 'never'}`);
    lines.push('');
    
    return lines.join('\\n');
  }
}

/**
 * Factory function
 */
export function createYieldScanner(config?: YieldScannerConfig): YieldScanner {
  return new YieldScanner(config);
}
