/**
 * K.I.T. DeFi Connector - DeFi Protocol Integration
 * Issue #9: Staking, lending, yield farming, auto-compound
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// TYPES
// ============================================================

export type DeFiProtocol = 
  | 'aave'
  | 'compound'
  | 'lido'
  | 'rocketpool'
  | 'uniswap'
  | 'curve'
  | 'convex'
  | 'osmosis'
  | 'yearn';

export type Chain = 
  | 'ethereum'
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'bsc'
  | 'solana'
  | 'cosmos';

export type PositionType = 'staking' | 'lending' | 'borrowing' | 'liquidity' | 'farming';

export interface DeFiPosition {
  id: string;
  protocol: DeFiProtocol;
  chain: Chain;
  type: PositionType;
  
  // Asset info
  asset: string;
  amount: number;
  valueUsd: number;
  
  // Yield info
  apy: number;
  rewardsToken?: string;
  pendingRewards: number;
  pendingRewardsUsd: number;
  
  // For lending/borrowing
  healthFactor?: number;
  liquidationThreshold?: number;
  borrowedAmount?: number;
  borrowedValueUsd?: number;
  borrowApy?: number;
  
  // Metadata
  entryDate: Date;
  lastUpdate: Date;
}

export interface StakingInfo {
  protocol: DeFiProtocol;
  asset: string;
  apy: number;
  tvlUsd: number;
  minStake?: number;
  lockPeriod?: number;  // Days
  rewards: string[];    // Reward tokens
}

export interface LendingInfo {
  protocol: DeFiProtocol;
  asset: string;
  supplyApy: number;
  borrowApy: number;
  ltv: number;           // Loan-to-value ratio
  liquidationThreshold: number;
  tvlUsd: number;
  utilization: number;   // % of pool borrowed
}

export interface YieldFarm {
  protocol: DeFiProtocol;
  pool: string;
  chain: Chain;
  apy: number;
  tvlUsd: number;
  tokens: string[];
  rewards: string[];
  risk: 'low' | 'medium' | 'high';
}

export interface AutoCompoundConfig {
  enabled: boolean;
  minRewardUsd: number;      // Minimum rewards to trigger compound
  intervalHours: number;     // Check interval
  maxGasGwei: number;        // Max gas to pay for compound
  reinvestTo: string;        // Asset to reinvest into
}

export interface DeFiConfig {
  wallets: Partial<Record<Chain, string>>;
  autoCompound: AutoCompoundConfig;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  maxProtocolExposurePct: number;
  minTvlUsd: number;         // Minimum TVL to consider
  persistPath: string;
}

// ============================================================
// MOCK DATA (In production, fetch from APIs/contracts)
// ============================================================

const MOCK_STAKING: StakingInfo[] = [
  { protocol: 'lido', asset: 'ETH', apy: 3.8, tvlUsd: 15_000_000_000, rewards: ['stETH'] },
  { protocol: 'rocketpool', asset: 'ETH', apy: 3.5, tvlUsd: 2_000_000_000, rewards: ['rETH', 'RPL'] },
  { protocol: 'osmosis', asset: 'ATOM', apy: 18.5, tvlUsd: 500_000_000, lockPeriod: 21, rewards: ['OSMO'] },
];

const MOCK_LENDING: LendingInfo[] = [
  { protocol: 'aave', asset: 'USDC', supplyApy: 4.2, borrowApy: 5.8, ltv: 0.8, liquidationThreshold: 0.85, tvlUsd: 5_000_000_000, utilization: 0.72 },
  { protocol: 'aave', asset: 'ETH', supplyApy: 1.8, borrowApy: 3.2, ltv: 0.8, liquidationThreshold: 0.825, tvlUsd: 8_000_000_000, utilization: 0.45 },
  { protocol: 'compound', asset: 'USDC', supplyApy: 3.8, borrowApy: 5.2, ltv: 0.75, liquidationThreshold: 0.8, tvlUsd: 3_000_000_000, utilization: 0.68 },
];

const MOCK_FARMS: YieldFarm[] = [
  { protocol: 'curve', pool: '3pool', chain: 'ethereum', apy: 5.2, tvlUsd: 2_000_000_000, tokens: ['USDC', 'USDT', 'DAI'], rewards: ['CRV'], risk: 'low' },
  { protocol: 'convex', pool: 'cvx3pool', chain: 'ethereum', apy: 8.5, tvlUsd: 1_500_000_000, tokens: ['USDC', 'USDT', 'DAI'], rewards: ['CVX', 'CRV'], risk: 'low' },
  { protocol: 'uniswap', pool: 'ETH/USDC', chain: 'ethereum', apy: 12.3, tvlUsd: 500_000_000, tokens: ['ETH', 'USDC'], rewards: ['UNI'], risk: 'medium' },
];

// ============================================================
// DEFI CONNECTOR CLASS
// ============================================================

export class DeFiConnector {
  private config: DeFiConfig;
  private positions: Map<string, DeFiPosition> = new Map();
  
  constructor(config: Partial<DeFiConfig> = {}) {
    this.config = {
      wallets: {},
      autoCompound: {
        enabled: true,
        minRewardUsd: 10,
        intervalHours: 24,
        maxGasGwei: 50,
        reinvestTo: 'staking'
      },
      riskTolerance: 'moderate',
      maxProtocolExposurePct: 30,
      minTvlUsd: 100_000_000,
      persistPath: path.join(process.env.HOME || process.env.USERPROFILE || '', '.kit', 'defi'),
      ...config
    };
    
    this.ensureDirectory();
    this.loadPositions();
  }
  
  // --------------------------------------------------------
  // Protocol Data
  // --------------------------------------------------------
  
  getStakingOptions(): StakingInfo[] {
    // Filter by TVL
    return MOCK_STAKING.filter(s => s.tvlUsd >= this.config.minTvlUsd);
  }
  
  getLendingOptions(): LendingInfo[] {
    return MOCK_LENDING.filter(l => l.tvlUsd >= this.config.minTvlUsd);
  }
  
  getYieldFarms(): YieldFarm[] {
    // Filter by TVL and risk tolerance
    return MOCK_FARMS.filter(f => {
      if (f.tvlUsd < this.config.minTvlUsd) return false;
      
      if (this.config.riskTolerance === 'conservative' && f.risk !== 'low') return false;
      if (this.config.riskTolerance === 'moderate' && f.risk === 'high') return false;
      
      return true;
    });
  }
  
  getBestYield(type: 'staking' | 'lending' | 'farming'): StakingInfo | LendingInfo | YieldFarm | null {
    switch (type) {
      case 'staking':
        const staking = this.getStakingOptions();
        return staking.sort((a, b) => b.apy - a.apy)[0] || null;
        
      case 'lending':
        const lending = this.getLendingOptions();
        return lending.sort((a, b) => b.supplyApy - a.supplyApy)[0] || null;
        
      case 'farming':
        const farms = this.getYieldFarms();
        return farms.sort((a, b) => b.apy - a.apy)[0] || null;
        
      default:
        return null;
    }
  }
  
  // --------------------------------------------------------
  // Position Management
  // --------------------------------------------------------
  
  addPosition(position: Omit<DeFiPosition, 'id' | 'lastUpdate'>): DeFiPosition {
    const id = this.generateId();
    const fullPosition: DeFiPosition = {
      ...position,
      id,
      lastUpdate: new Date()
    };
    
    this.positions.set(id, fullPosition);
    this.savePositions();
    
    return fullPosition;
  }
  
  updatePosition(id: string, updates: Partial<DeFiPosition>): DeFiPosition | null {
    const position = this.positions.get(id);
    if (!position) return null;
    
    const updated = {
      ...position,
      ...updates,
      lastUpdate: new Date()
    };
    
    this.positions.set(id, updated);
    this.savePositions();
    
    return updated;
  }
  
  removePosition(id: string): boolean {
    const deleted = this.positions.delete(id);
    if (deleted) this.savePositions();
    return deleted;
  }
  
  getPosition(id: string): DeFiPosition | null {
    return this.positions.get(id) || null;
  }
  
  getAllPositions(): DeFiPosition[] {
    return Array.from(this.positions.values());
  }
  
  getPositionsByType(type: PositionType): DeFiPosition[] {
    return this.getAllPositions().filter(p => p.type === type);
  }
  
  getPositionsByProtocol(protocol: DeFiProtocol): DeFiPosition[] {
    return this.getAllPositions().filter(p => p.protocol === protocol);
  }
  
  // --------------------------------------------------------
  // Portfolio Overview
  // --------------------------------------------------------
  
  getPortfolioSummary(): {
    totalValueUsd: number;
    totalPendingRewardsUsd: number;
    byProtocol: Record<string, number>;
    byType: Record<PositionType, number>;
    byChain: Record<string, number>;
    weightedApy: number;
    healthStatus: 'safe' | 'warning' | 'danger';
    positions: DeFiPosition[];
  } {
    const positions = this.getAllPositions();
    
    let totalValueUsd = 0;
    let totalPendingRewardsUsd = 0;
    let weightedApySum = 0;
    let lowestHealthFactor = Infinity;
    
    const byProtocol: Record<string, number> = {};
    const byType: Record<PositionType, number> = {
      staking: 0,
      lending: 0,
      borrowing: 0,
      liquidity: 0,
      farming: 0
    };
    const byChain: Record<string, number> = {};
    
    for (const pos of positions) {
      totalValueUsd += pos.valueUsd;
      totalPendingRewardsUsd += pos.pendingRewardsUsd;
      weightedApySum += pos.apy * pos.valueUsd;
      
      byProtocol[pos.protocol] = (byProtocol[pos.protocol] || 0) + pos.valueUsd;
      byType[pos.type] = (byType[pos.type] || 0) + pos.valueUsd;
      byChain[pos.chain] = (byChain[pos.chain] || 0) + pos.valueUsd;
      
      if (pos.healthFactor !== undefined) {
        lowestHealthFactor = Math.min(lowestHealthFactor, pos.healthFactor);
      }
    }
    
    const weightedApy = totalValueUsd > 0 ? weightedApySum / totalValueUsd : 0;
    
    let healthStatus: 'safe' | 'warning' | 'danger' = 'safe';
    if (lowestHealthFactor < 1.2) healthStatus = 'danger';
    else if (lowestHealthFactor < 1.5) healthStatus = 'warning';
    
    return {
      totalValueUsd,
      totalPendingRewardsUsd,
      byProtocol,
      byType,
      byChain,
      weightedApy,
      healthStatus,
      positions
    };
  }
  
  // --------------------------------------------------------
  // Health Monitoring
  // --------------------------------------------------------
  
  checkHealthFactors(): { position: DeFiPosition; status: string; action: string }[] {
    const alerts: { position: DeFiPosition; status: string; action: string }[] = [];
    
    for (const pos of this.getAllPositions()) {
      if (pos.healthFactor === undefined) continue;
      
      if (pos.healthFactor < 1.1) {
        alerts.push({
          position: pos,
          status: '🔴 CRITICAL',
          action: 'IMMEDIATE REPAY OR ADD COLLATERAL'
        });
      } else if (pos.healthFactor < 1.3) {
        alerts.push({
          position: pos,
          status: '🟡 WARNING',
          action: 'Consider repaying debt or adding collateral'
        });
      }
    }
    
    return alerts;
  }
  
  // --------------------------------------------------------
  // Auto-Compound
  // --------------------------------------------------------
  
  async checkAutoCompound(): Promise<{
    shouldCompound: boolean;
    totalPendingUsd: number;
    positions: { position: DeFiPosition; rewardsUsd: number }[];
  }> {
    const positions = this.getAllPositions().filter(p => p.pendingRewardsUsd > 0);
    const positionsWithRewards = positions.map(p => ({
      position: p,
      rewardsUsd: p.pendingRewardsUsd
    }));
    
    const totalPendingUsd = positions.reduce((sum, p) => sum + p.pendingRewardsUsd, 0);
    const shouldCompound = totalPendingUsd >= this.config.autoCompound.minRewardUsd;
    
    return { shouldCompound, totalPendingUsd, positions: positionsWithRewards };
  }
  
  async executeAutoCompound(): Promise<{
    success: boolean;
    compoundedUsd: number;
    message: string;
  }> {
    if (!this.config.autoCompound.enabled) {
      return { success: false, compoundedUsd: 0, message: 'Auto-compound disabled' };
    }
    
    const { shouldCompound, totalPendingUsd, positions } = await this.checkAutoCompound();
    
    if (!shouldCompound) {
      return {
        success: false,
        compoundedUsd: 0,
        message: `Pending rewards ($${totalPendingUsd.toFixed(2)}) below threshold ($${this.config.autoCompound.minRewardUsd})`
      };
    }
    
    // In production, this would:
    // 1. Claim rewards from each protocol
    // 2. Swap to target asset
    // 3. Re-deposit
    
    console.log(`🔄 Auto-compounding $${totalPendingUsd.toFixed(2)} in rewards...`);
    
    // Simulate compounding
    for (const { position } of positions) {
      position.pendingRewards = 0;
      position.pendingRewardsUsd = 0;
      position.lastUpdate = new Date();
    }
    
    this.savePositions();
    
    return {
      success: true,
      compoundedUsd: totalPendingUsd,
      message: `Compounded $${totalPendingUsd.toFixed(2)} from ${positions.length} positions`
    };
  }
  
  // --------------------------------------------------------
  // Yield Optimization
  // --------------------------------------------------------
  
  findBetterYield(asset: string): {
    currentApy: number;
    bestApy: number;
    improvement: number;
    recommendation: string;
  } | null {
    // Find current position for this asset
    const currentPosition = this.getAllPositions().find(p => p.asset === asset);
    if (!currentPosition) return null;
    
    // Find best yield for this asset
    const stakingOptions = this.getStakingOptions().filter(s => s.asset === asset);
    const lendingOptions = this.getLendingOptions().filter(l => l.asset === asset);
    
    const allOptions = [
      ...stakingOptions.map(s => ({ type: 'staking', apy: s.apy, protocol: s.protocol })),
      ...lendingOptions.map(l => ({ type: 'lending', apy: l.supplyApy, protocol: l.protocol }))
    ];
    
    const best = allOptions.sort((a, b) => b.apy - a.apy)[0];
    if (!best) return null;
    
    const improvement = best.apy - currentPosition.apy;
    
    return {
      currentApy: currentPosition.apy,
      bestApy: best.apy,
      improvement,
      recommendation: improvement > 0.5
        ? `Consider moving to ${best.protocol} (${best.type}) for +${improvement.toFixed(2)}% APY`
        : 'Current position has competitive yield'
    };
  }
  
  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------
  
  generateReport(): string {
    const summary = this.getPortfolioSummary();
    
    let report = `
🌾 DEFI PORTFOLIO REPORT
${'='.repeat(60)}

OVERVIEW
${'-'.repeat(60)}
Total Value:        $${summary.totalValueUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Pending Rewards:    $${summary.totalPendingRewardsUsd.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Weighted APY:       ${summary.weightedApy.toFixed(2)}%
Health Status:      ${summary.healthStatus === 'safe' ? '🟢 SAFE' : summary.healthStatus === 'warning' ? '🟡 WARNING' : '🔴 DANGER'}

BY PROTOCOL
${'-'.repeat(60)}
`;

    for (const [protocol, value] of Object.entries(summary.byProtocol)) {
      const pct = (value / summary.totalValueUsd * 100).toFixed(1);
      report += `${protocol.toUpperCase().padEnd(15)} $${value.toLocaleString().padStart(12)} (${pct}%)\n`;
    }

    report += `
BY TYPE
${'-'.repeat(60)}
`;

    for (const [type, value] of Object.entries(summary.byType)) {
      if (value > 0) {
        const pct = (value / summary.totalValueUsd * 100).toFixed(1);
        const emoji = type === 'staking' ? '🥩' : type === 'lending' ? '💰' : type === 'farming' ? '🌾' : '📊';
        report += `${emoji} ${type.padEnd(12)} $${value.toLocaleString().padStart(12)} (${pct}%)\n`;
      }
    }

    report += `
POSITIONS
${'-'.repeat(60)}
`;

    for (const pos of summary.positions) {
      const hf = pos.healthFactor ? ` HF:${pos.healthFactor.toFixed(2)}` : '';
      report += `${pos.protocol.padEnd(10)} ${pos.asset.padEnd(6)} $${pos.valueUsd.toLocaleString().padStart(10)} APY:${pos.apy.toFixed(1)}%${hf}\n`;
    }

    // Health alerts
    const alerts = this.checkHealthFactors();
    if (alerts.length > 0) {
      report += `
⚠️ HEALTH ALERTS
${'-'.repeat(60)}
`;
      for (const alert of alerts) {
        report += `${alert.status} ${alert.position.protocol} ${alert.position.asset}: ${alert.action}\n`;
      }
    }

    return report;
  }
  
  // --------------------------------------------------------
  // Staking Operations (Simulated)
  // --------------------------------------------------------
  
  async stake(protocol: DeFiProtocol, asset: string, amount: number, chain: Chain = 'ethereum'): Promise<DeFiPosition> {
    const stakingInfo = this.getStakingOptions().find(s => s.protocol === protocol && s.asset === asset);
    if (!stakingInfo) {
      throw new Error(`Staking not available for ${asset} on ${protocol}`);
    }
    
    // In production, this would interact with the actual protocol
    console.log(`🥩 Staking ${amount} ${asset} on ${protocol}...`);
    
    const position = this.addPosition({
      protocol,
      chain,
      type: 'staking',
      asset,
      amount,
      valueUsd: amount * 2500,  // Mock price
      apy: stakingInfo.apy,
      rewardsToken: stakingInfo.rewards[0],
      pendingRewards: 0,
      pendingRewardsUsd: 0,
      entryDate: new Date()
    });
    
    return position;
  }
  
  async unstake(positionId: string): Promise<boolean> {
    const position = this.getPosition(positionId);
    if (!position || position.type !== 'staking') {
      return false;
    }
    
    console.log(`📤 Unstaking ${position.amount} ${position.asset} from ${position.protocol}...`);
    
    return this.removePosition(positionId);
  }
  
  // --------------------------------------------------------
  // Lending Operations (Simulated)
  // --------------------------------------------------------
  
  async supply(protocol: DeFiProtocol, asset: string, amount: number, chain: Chain = 'ethereum'): Promise<DeFiPosition> {
    const lendingInfo = this.getLendingOptions().find(l => l.protocol === protocol && l.asset === asset);
    if (!lendingInfo) {
      throw new Error(`Lending not available for ${asset} on ${protocol}`);
    }
    
    console.log(`💰 Supplying ${amount} ${asset} to ${protocol}...`);
    
    const position = this.addPosition({
      protocol,
      chain,
      type: 'lending',
      asset,
      amount,
      valueUsd: amount * (asset === 'ETH' ? 2500 : 1),  // Mock price
      apy: lendingInfo.supplyApy,
      pendingRewards: 0,
      pendingRewardsUsd: 0,
      healthFactor: 999,  // No borrows yet
      liquidationThreshold: lendingInfo.liquidationThreshold,
      entryDate: new Date()
    });
    
    return position;
  }
  
  async withdraw(positionId: string, amount?: number): Promise<boolean> {
    const position = this.getPosition(positionId);
    if (!position || position.type !== 'lending') {
      return false;
    }
    
    const withdrawAmount = amount || position.amount;
    console.log(`📤 Withdrawing ${withdrawAmount} ${position.asset} from ${position.protocol}...`);
    
    if (!amount || amount >= position.amount) {
      return this.removePosition(positionId);
    } else {
      this.updatePosition(positionId, {
        amount: position.amount - amount,
        valueUsd: position.valueUsd * ((position.amount - amount) / position.amount)
      });
      return true;
    }
  }
  
  // --------------------------------------------------------
  // Persistence
  // --------------------------------------------------------
  
  private ensureDirectory(): void {
    if (!fs.existsSync(this.config.persistPath)) {
      fs.mkdirSync(this.config.persistPath, { recursive: true });
    }
  }
  
  private getPositionsFilePath(): string {
    return path.join(this.config.persistPath, 'positions.json');
  }
  
  private savePositions(): void {
    const data = Array.from(this.positions.entries());
    fs.writeFileSync(
      this.getPositionsFilePath(),
      JSON.stringify(data, null, 2)
    );
  }
  
  private loadPositions(): void {
    const filePath = this.getPositionsFilePath();
    if (!fs.existsSync(filePath)) return;
    
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.positions = new Map(
        data.map(([id, pos]: [string, DeFiPosition]) => [
          id,
          {
            ...pos,
            entryDate: new Date(pos.entryDate),
            lastUpdate: new Date(pos.lastUpdate)
          }
        ])
      );
    } catch (error) {
      console.error('Failed to load DeFi positions:', error);
    }
  }
  
  // --------------------------------------------------------
  // Utilities
  // --------------------------------------------------------
  
  private generateId(): string {
    return `defi_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
  
  setConfig(updates: Partial<DeFiConfig>): void {
    this.config = { ...this.config, ...updates };
  }
  
  getConfig(): DeFiConfig {
    return { ...this.config };
  }
}

// ============================================================
// FACTORY & EXPORT
// ============================================================

let defiConnectorInstance: DeFiConnector | null = null;

export function createDeFiConnector(config?: Partial<DeFiConfig>): DeFiConnector {
  if (!defiConnectorInstance) {
    defiConnectorInstance = new DeFiConnector(config);
  }
  return defiConnectorInstance;
}

export function getDeFiConnector(): DeFiConnector {
  if (!defiConnectorInstance) {
    defiConnectorInstance = new DeFiConnector();
  }
  return defiConnectorInstance;
}

export default DeFiConnector;
