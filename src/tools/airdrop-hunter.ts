/**
 * K.I.T. AIRDROP HUNTER
 * 
 * Automatically tracks, qualifies for, and claims airdrops.
 * 
 * "Free money doesn't exist... unless you're farming airdrops." 
 * — K.I.T.
 */

// ============================================================
// TYPES
// ============================================================

export type AirdropStatus = 'upcoming' | 'active' | 'claimable' | 'claimed' | 'missed' | 'disqualified';
export type AirdropChain = 'ethereum' | 'solana' | 'cosmos' | 'arbitrum' | 'optimism' | 'base' | 'zksync' | 'starknet' | 'linea' | 'scroll';

export interface AirdropProject {
  id: string;
  name: string;
  description: string;
  chain: AirdropChain;
  website: string;
  twitter?: string;
  discord?: string;
  
  // Airdrop info
  tokenSymbol?: string;
  estimatedValue?: { min: number; max: number };
  snapshotDate?: Date;
  claimDate?: Date;
  
  // Qualification criteria
  criteria: AirdropCriteria[];
  
  // Status
  status: AirdropStatus;
  probability: number;  // 0-100% chance of airdrop
  
  // Your progress
  qualificationProgress: number;  // 0-100%
  completedCriteria: string[];
  
  // Metadata
  addedAt: Date;
  lastUpdated: Date;
}

export interface AirdropCriteria {
  id: string;
  type: 'bridge' | 'swap' | 'provide_liquidity' | 'hold_token' | 'stake' | 'mint_nft' | 'governance' | 'social' | 'testnet' | 'referral';
  description: string;
  required: boolean;  // Must complete vs nice-to-have
  weight: number;  // Importance 1-10
  completed: boolean;
  
  // Action details
  action?: {
    platform: string;
    minAmount?: number;
    minTxCount?: number;
    token?: string;
    url?: string;
  };
}

export interface AirdropClaim {
  projectId: string;
  projectName: string;
  tokenSymbol: string;
  amount: number;
  valueUsd: number;
  claimedAt: Date;
  txHash?: string;
}

export interface AirdropHunterConfig {
  enabled: boolean;
  chains: AirdropChain[];
  minProbability: number;  // Min % to track
  maxGasPerAction: number;  // Max gas to spend farming
  autoQualify: boolean;  // Auto-execute farming actions
  autoClaimSafety: boolean;  // Auto-claim but verify contract first
}

// ============================================================
// KNOWN AIRDROPS DATABASE (would be fetched from API in production)
// ============================================================

const POTENTIAL_AIRDROPS: Omit<AirdropProject, 'qualificationProgress' | 'completedCriteria' | 'addedAt' | 'lastUpdated'>[] = [
  {
    id: 'layerzero',
    name: 'LayerZero',
    description: 'Omnichain interoperability protocol. High probability airdrop based on VC funding and no token.',
    chain: 'ethereum',
    website: 'https://layerzero.network',
    twitter: '@LayerZero_Labs',
    tokenSymbol: 'ZRO',
    estimatedValue: { min: 500, max: 5000 },
    probability: 90,
    status: 'active',
    criteria: [
      { id: 'lz1', type: 'bridge', description: 'Bridge assets using Stargate', required: true, weight: 10, completed: false, action: { platform: 'stargate', minTxCount: 5 } },
      { id: 'lz2', type: 'bridge', description: 'Use multiple chains (5+)', required: true, weight: 9, completed: false },
      { id: 'lz3', type: 'swap', description: 'Swap on LayerZero-powered DEXs', required: false, weight: 5, completed: false },
      { id: 'lz4', type: 'mint_nft', description: 'Mint an Omnichain NFT', required: false, weight: 4, completed: false },
    ],
  },
  {
    id: 'zksync',
    name: 'zkSync Era',
    description: 'zkEVM Layer 2 scaling solution. Expected token launch.',
    chain: 'zksync',
    website: 'https://zksync.io',
    twitter: '@zaboris',
    tokenSymbol: 'ZKS',
    estimatedValue: { min: 1000, max: 10000 },
    probability: 95,
    status: 'active',
    criteria: [
      { id: 'zk1', type: 'bridge', description: 'Bridge ETH to zkSync Era', required: true, weight: 10, completed: false, action: { platform: 'zksync-bridge', minAmount: 0.1 } },
      { id: 'zk2', type: 'swap', description: 'Swap on SyncSwap/Mute', required: true, weight: 9, completed: false, action: { platform: 'syncswap', minTxCount: 10 } },
      { id: 'zk3', type: 'provide_liquidity', description: 'Provide liquidity on zkSync DEX', required: false, weight: 8, completed: false },
      { id: 'zk4', type: 'mint_nft', description: 'Mint NFT on zkSync', required: false, weight: 5, completed: false },
      { id: 'zk5', type: 'governance', description: 'Vote on zkSync governance', required: false, weight: 6, completed: false },
    ],
  },
  {
    id: 'scroll',
    name: 'Scroll',
    description: 'zkEVM L2 with strong Ethereum alignment.',
    chain: 'scroll',
    website: 'https://scroll.io',
    twitter: '@Scroll_ZKP',
    tokenSymbol: 'SCROLL',
    estimatedValue: { min: 500, max: 3000 },
    probability: 85,
    status: 'active',
    criteria: [
      { id: 'sc1', type: 'bridge', description: 'Bridge to Scroll mainnet', required: true, weight: 10, completed: false },
      { id: 'sc2', type: 'swap', description: 'Swap on Scroll DEXs', required: true, weight: 8, completed: false },
      { id: 'sc3', type: 'provide_liquidity', description: 'LP on Scroll', required: false, weight: 7, completed: false },
    ],
  },
  {
    id: 'linea',
    name: 'Linea',
    description: 'Consensys zkEVM L2.',
    chain: 'linea',
    website: 'https://linea.build',
    twitter: '@LineaBuild',
    tokenSymbol: 'LINEA',
    estimatedValue: { min: 200, max: 2000 },
    probability: 80,
    status: 'active',
    criteria: [
      { id: 'li1', type: 'bridge', description: 'Bridge to Linea', required: true, weight: 10, completed: false },
      { id: 'li2', type: 'swap', description: 'Use Linea DeFi apps', required: true, weight: 8, completed: false },
    ],
  },
  {
    id: 'eigenlayer',
    name: 'EigenLayer',
    description: 'Restaking protocol. Confirmed airdrop coming.',
    chain: 'ethereum',
    website: 'https://eigenlayer.xyz',
    twitter: '@eigenlayer',
    tokenSymbol: 'EIGEN',
    estimatedValue: { min: 1000, max: 5000 },
    probability: 100,  // Confirmed
    status: 'active',
    criteria: [
      { id: 'el1', type: 'stake', description: 'Restake ETH/LSTs on EigenLayer', required: true, weight: 10, completed: false, action: { platform: 'eigenlayer', minAmount: 0.5 } },
      { id: 'el2', type: 'hold_token', description: 'Hold stETH, rETH, or cbETH', required: false, weight: 7, completed: false },
    ],
  },
];

// ============================================================
// AIRDROP HUNTER CLASS
// ============================================================

export class AirdropHunter {
  private config: AirdropHunterConfig;
  private trackedProjects: Map<string, AirdropProject> = new Map();
  private claims: AirdropClaim[] = [];
  
  constructor(config: Partial<AirdropHunterConfig> = {}) {
    this.config = {
      enabled: true,
      chains: ['ethereum', 'arbitrum', 'optimism', 'zksync', 'base', 'scroll', 'linea'],
      minProbability: 50,
      maxGasPerAction: 0.01,  // ETH
      autoQualify: false,
      autoClaimSafety: true,
      ...config,
    };
    
    this.loadPotentialAirdrops();
  }
  
  private loadPotentialAirdrops(): void {
    const now = new Date();
    
    for (const airdrop of POTENTIAL_AIRDROPS) {
      if (airdrop.probability >= this.config.minProbability) {
        if (this.config.chains.includes(airdrop.chain)) {
          const project: AirdropProject = {
            ...airdrop,
            qualificationProgress: 0,
            completedCriteria: [],
            addedAt: now,
            lastUpdated: now,
          };
          this.trackedProjects.set(project.id, project);
        }
      }
    }
    
    console.log(`🎯 Tracking ${this.trackedProjects.size} potential airdrops`);
  }
  
  // --------------------------------------------------------
  // Core Functions
  // --------------------------------------------------------
  
  getTrackedProjects(): AirdropProject[] {
    return Array.from(this.trackedProjects.values())
      .sort((a, b) => {
        // Sort by: probability * estimated value
        const scoreA = a.probability * (a.estimatedValue?.max || 0);
        const scoreB = b.probability * (b.estimatedValue?.max || 0);
        return scoreB - scoreA;
      });
  }
  
  getProject(id: string): AirdropProject | null {
    return this.trackedProjects.get(id) || null;
  }
  
  getProjectsByChain(chain: AirdropChain): AirdropProject[] {
    return this.getTrackedProjects().filter(p => p.chain === chain);
  }
  
  getClaimableAirdrops(): AirdropProject[] {
    return this.getTrackedProjects().filter(p => p.status === 'claimable');
  }
  
  // --------------------------------------------------------
  // Qualification Tracking
  // --------------------------------------------------------
  
  markCriteriaCompleted(projectId: string, criteriaId: string): void {
    const project = this.trackedProjects.get(projectId);
    if (!project) return;
    
    const criteria = project.criteria.find(c => c.id === criteriaId);
    if (!criteria) return;
    
    criteria.completed = true;
    project.completedCriteria.push(criteriaId);
    
    // Recalculate progress
    this.updateQualificationProgress(project);
    project.lastUpdated = new Date();
    
    console.log(`✅ Completed: ${project.name} - ${criteria.description}`);
  }
  
  private updateQualificationProgress(project: AirdropProject): void {
    const totalWeight = project.criteria.reduce((sum, c) => sum + c.weight, 0);
    const completedWeight = project.criteria
      .filter(c => c.completed)
      .reduce((sum, c) => sum + c.weight, 0);
    
    project.qualificationProgress = Math.round((completedWeight / totalWeight) * 100);
  }
  
  // --------------------------------------------------------
  // Farming Actions
  // --------------------------------------------------------
  
  async getRecommendedActions(): Promise<{
    project: AirdropProject;
    criteria: AirdropCriteria;
    priority: number;
    estimatedGas: number;
    instructions: string;
  }[]> {
    const actions: {
      project: AirdropProject;
      criteria: AirdropCriteria;
      priority: number;
      estimatedGas: number;
      instructions: string;
    }[] = [];
    
    for (const project of this.getTrackedProjects()) {
      if (project.status !== 'active') continue;
      
      for (const criteria of project.criteria) {
        if (criteria.completed) continue;
        
        // Calculate priority: probability * weight * (required ? 2 : 1)
        const priority = project.probability * criteria.weight * (criteria.required ? 2 : 1);
        
        actions.push({
          project,
          criteria,
          priority,
          estimatedGas: 0.005,  // Mock gas estimate
          instructions: this.getActionInstructions(project, criteria),
        });
      }
    }
    
    // Sort by priority
    actions.sort((a, b) => b.priority - a.priority);
    
    return actions.slice(0, 10);  // Top 10 actions
  }
  
  private getActionInstructions(project: AirdropProject, criteria: AirdropCriteria): string {
    const base = `[${project.name}] ${criteria.description}`;
    
    if (criteria.action) {
      const { platform, minAmount, minTxCount, url } = criteria.action;
      let extra = '';
      
      if (minAmount) extra += ` Min amount: ${minAmount}`;
      if (minTxCount) extra += ` Min transactions: ${minTxCount}`;
      if (url) extra += ` URL: ${url}`;
      
      return `${base}\n   Platform: ${platform}${extra}`;
    }
    
    return base;
  }
  
  async executeAction(projectId: string, criteriaId: string): Promise<{
    success: boolean;
    txHash?: string;
    message: string;
  }> {
    const project = this.trackedProjects.get(projectId);
    if (!project) {
      return { success: false, message: 'Project not found' };
    }
    
    const criteria = project.criteria.find(c => c.id === criteriaId);
    if (!criteria) {
      return { success: false, message: 'Criteria not found' };
    }
    
    // In production, this would execute the actual on-chain action
    console.log(`⚡ Executing: ${project.name} - ${criteria.description}`);
    
    // Simulate execution
    await new Promise(r => setTimeout(r, 1000));
    
    // Mark as completed
    this.markCriteriaCompleted(projectId, criteriaId);
    
    return {
      success: true,
      txHash: `0x${Math.random().toString(16).slice(2)}`,
      message: `Successfully completed: ${criteria.description}`,
    };
  }
  
  // --------------------------------------------------------
  // Claiming
  // --------------------------------------------------------
  
  async checkClaimable(): Promise<AirdropProject[]> {
    // In production, this would check on-chain for claimable tokens
    // For now, return projects marked as claimable
    return this.getClaimableAirdrops();
  }
  
  async claimAirdrop(projectId: string): Promise<AirdropClaim | null> {
    const project = this.trackedProjects.get(projectId);
    if (!project || project.status !== 'claimable') {
      console.log(`Cannot claim ${projectId}: not claimable`);
      return null;
    }
    
    console.log(`🎁 Claiming ${project.name} airdrop...`);
    
    // In production, this would execute the claim transaction
    // For now, simulate
    
    const claim: AirdropClaim = {
      projectId: project.id,
      projectName: project.name,
      tokenSymbol: project.tokenSymbol || 'TOKEN',
      amount: Math.random() * 1000 + 100,
      valueUsd: Math.random() * (project.estimatedValue?.max || 1000),
      claimedAt: new Date(),
      txHash: `0x${Math.random().toString(16).slice(2)}`,
    };
    
    this.claims.push(claim);
    project.status = 'claimed';
    project.lastUpdated = new Date();
    
    console.log(`✅ Claimed ${claim.amount.toFixed(2)} ${claim.tokenSymbol} (~$${claim.valueUsd.toFixed(2)})`);
    
    return claim;
  }
  
  // --------------------------------------------------------
  // Analytics
  // --------------------------------------------------------
  
  getTotalClaimedValue(): number {
    return this.claims.reduce((sum, c) => sum + c.valueUsd, 0);
  }
  
  getClaimHistory(): AirdropClaim[] {
    return [...this.claims];
  }
  
  getEstimatedPendingValue(): number {
    return this.getTrackedProjects()
      .filter(p => p.status === 'active' && p.qualificationProgress >= 50)
      .reduce((sum, p) => {
        const avgValue = ((p.estimatedValue?.min || 0) + (p.estimatedValue?.max || 0)) / 2;
        return sum + (avgValue * p.probability / 100 * p.qualificationProgress / 100);
      }, 0);
  }
  
  // --------------------------------------------------------
  // Reports
  // --------------------------------------------------------
  
  generateReport(): string {
    const projects = this.getTrackedProjects();
    const totalEstimated = this.getEstimatedPendingValue();
    const totalClaimed = this.getTotalClaimedValue();
    
    let report = `
🎯 K.I.T. AIRDROP HUNTER REPORT
${'='.repeat(60)}

SUMMARY
${'-'.repeat(60)}
Tracked Projects:     ${projects.length}
Active:               ${projects.filter(p => p.status === 'active').length}
Claimable:            ${projects.filter(p => p.status === 'claimable').length}
Claimed:              ${this.claims.length}

VALUE
${'-'.repeat(60)}
Total Claimed:        $${totalClaimed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
Estimated Pending:    $${totalEstimated.toLocaleString('en-US', { minimumFractionDigits: 2 })}

TOP OPPORTUNITIES
${'-'.repeat(60)}
`;

    const topProjects = projects.slice(0, 5);
    for (const p of topProjects) {
      const valueRange = p.estimatedValue 
        ? `$${p.estimatedValue.min}-${p.estimatedValue.max}`
        : 'Unknown';
      const progressBar = '█'.repeat(Math.round(p.qualificationProgress / 10)) + 
                         '░'.repeat(10 - Math.round(p.qualificationProgress / 10));
      
      report += `\n${p.name} (${p.chain})\n`;
      report += `  Probability: ${p.probability}% | Value: ${valueRange}\n`;
      report += `  Progress: [${progressBar}] ${p.qualificationProgress}%\n`;
    }

    report += `
RECENT CLAIMS
${'-'.repeat(60)}
`;

    for (const claim of this.claims.slice(-5)) {
      report += `${claim.claimedAt.toLocaleDateString()} - ${claim.projectName}: ${claim.amount.toFixed(0)} ${claim.tokenSymbol} ($${claim.valueUsd.toFixed(2)})\n`;
    }

    return report;
  }
}

// ============================================================
// FACTORY & EXPORTS
// ============================================================

let airdropHunterInstance: AirdropHunter | null = null;

export function createAirdropHunter(config?: Partial<AirdropHunterConfig>): AirdropHunter {
  if (!airdropHunterInstance) {
    airdropHunterInstance = new AirdropHunter(config);
  }
  return airdropHunterInstance;
}

export function getAirdropHunter(): AirdropHunter {
  if (!airdropHunterInstance) {
    airdropHunterInstance = new AirdropHunter();
  }
  return airdropHunterInstance;
}

export default AirdropHunter;
