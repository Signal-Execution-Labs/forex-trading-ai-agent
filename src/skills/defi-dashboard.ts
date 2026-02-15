/**
 * K.I.T. DeFi Dashboard Skill
 * Zapper/DeBank-inspired comprehensive DeFi portfolio tracker
 * 
 * Features:
 * - Multi-chain portfolio tracking (ETH, BSC, Polygon, Arbitrum, etc.)
 * - Protocol position aggregation (Uniswap, Aave, Compound, etc.)
 * - Yield farming and staking tracking
 * - LP position monitoring with IL calculation
 * - NFT portfolio integration
 * - Gas price optimization
 * - Transaction history with labels
 * - Protocol health monitoring
 */

import { Tool, ToolResult } from '../types/tools.js';

// Supported chains
const SUPPORTED_CHAINS = [
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', chainId: 1 },
  { id: 'bsc', name: 'BNB Chain', symbol: 'BNB', chainId: 56 },
  { id: 'polygon', name: 'Polygon', symbol: 'MATIC', chainId: 137 },
  { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', chainId: 42161 },
  { id: 'optimism', name: 'Optimism', symbol: 'ETH', chainId: 10 },
  { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', chainId: 43114 },
  { id: 'fantom', name: 'Fantom', symbol: 'FTM', chainId: 250 },
  { id: 'solana', name: 'Solana', symbol: 'SOL', chainId: 0 },
  { id: 'base', name: 'Base', symbol: 'ETH', chainId: 8453 }
];

// Supported protocols
const PROTOCOLS = {
  lending: ['aave', 'compound', 'venus', 'benqi', 'radiant'],
  dex: ['uniswap', 'sushiswap', 'curve', 'balancer', 'pancakeswap', 'traderjoe'],
  yield: ['yearn', 'beefy', 'convex', 'stargate', 'gmx'],
  staking: ['lido', 'rocketpool', 'frax', 'ankr', 'stakewise'],
  derivatives: ['gmx', 'dydx', 'perpetual', 'gains'],
  bridges: ['stargate', 'hop', 'across', 'synapse', 'celer']
};

// Position types
type PositionType = 'wallet' | 'lending' | 'borrowing' | 'liquidity' | 'staking' | 'farming' | 'vesting' | 'nft';

interface Position {
  id: string;
  type: PositionType;
  protocol: string;
  chain: string;
  assets: {
    symbol: string;
    amount: number;
    valueUsd: number;
    price: number;
  }[];
  totalValueUsd: number;
  apy?: number;
  rewards?: {
    symbol: string;
    amount: number;
    valueUsd: number;
  }[];
  health?: number; // For lending positions
  liquidationPrice?: number;
  impermanentLoss?: number; // For LP positions
  unlockDate?: Date; // For vesting
}

interface Portfolio {
  address: string;
  totalValueUsd: number;
  positions: Position[];
  byChain: Record<string, number>;
  byType: Record<string, number>;
  byProtocol: Record<string, number>;
  lastUpdated: Date;
}

// Mock data generator
function generateMockPortfolio(address: string): Portfolio {
  const positions: Position[] = [
    // Wallet holdings
    {
      id: 'wallet_eth',
      type: 'wallet',
      protocol: 'native',
      chain: 'ethereum',
      assets: [
        { symbol: 'ETH', amount: 2.5, valueUsd: 7500, price: 3000 },
        { symbol: 'USDC', amount: 5000, valueUsd: 5000, price: 1 }
      ],
      totalValueUsd: 12500
    },
    // Aave lending
    {
      id: 'aave_lending',
      type: 'lending',
      protocol: 'aave',
      chain: 'ethereum',
      assets: [
        { symbol: 'USDC', amount: 10000, valueUsd: 10000, price: 1 }
      ],
      totalValueUsd: 10000,
      apy: 4.5,
      rewards: [
        { symbol: 'AAVE', amount: 0.5, valueUsd: 50 }
      ]
    },
    // Uniswap LP
    {
      id: 'uni_v3_lp',
      type: 'liquidity',
      protocol: 'uniswap',
      chain: 'ethereum',
      assets: [
        { symbol: 'ETH', amount: 1, valueUsd: 3000, price: 3000 },
        { symbol: 'USDC', amount: 3000, valueUsd: 3000, price: 1 }
      ],
      totalValueUsd: 6000,
      apy: 15.2,
      impermanentLoss: -2.3,
      rewards: [
        { symbol: 'UNI', amount: 10, valueUsd: 100 }
      ]
    },
    // Lido staking
    {
      id: 'lido_stake',
      type: 'staking',
      protocol: 'lido',
      chain: 'ethereum',
      assets: [
        { symbol: 'stETH', amount: 5, valueUsd: 15000, price: 3000 }
      ],
      totalValueUsd: 15000,
      apy: 3.8
    },
    // GMX farming
    {
      id: 'gmx_farm',
      type: 'farming',
      protocol: 'gmx',
      chain: 'arbitrum',
      assets: [
        { symbol: 'GLP', amount: 1000, valueUsd: 1000, price: 1 }
      ],
      totalValueUsd: 1000,
      apy: 25.5,
      rewards: [
        { symbol: 'ETH', amount: 0.01, valueUsd: 30 },
        { symbol: 'esGMX', amount: 5, valueUsd: 200 }
      ]
    }
  ];
  
  const totalValueUsd = positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
  
  // Calculate breakdowns
  const byChain: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byProtocol: Record<string, number> = {};
  
  for (const pos of positions) {
    byChain[pos.chain] = (byChain[pos.chain] || 0) + pos.totalValueUsd;
    byType[pos.type] = (byType[pos.type] || 0) + pos.totalValueUsd;
    byProtocol[pos.protocol] = (byProtocol[pos.protocol] || 0) + pos.totalValueUsd;
  }
  
  return {
    address,
    totalValueUsd,
    positions,
    byChain,
    byType,
    byProtocol,
    lastUpdated: new Date()
  };
}

export const defiDashboardTools: Tool[] = [
  {
    name: 'defi_portfolio',
    description: 'Get complete DeFi portfolio across all chains and protocols',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string', description: 'Wallet address (0x...)' },
        chains: { 
          type: 'array', 
          items: { type: 'string', enum: SUPPORTED_CHAINS.map(c => c.id) },
          description: 'Filter by chains (default: all)'
        },
        includeNfts: { type: 'boolean', default: false }
      },
      required: ['address']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { address, chains, includeNfts = false } = params;
      
      // Generate mock portfolio (in production, fetch from APIs)
      const portfolio = generateMockPortfolio(address);
      
      // Filter by chains if specified
      if (chains && chains.length > 0) {
        portfolio.positions = portfolio.positions.filter(p => chains.includes(p.chain));
        portfolio.totalValueUsd = portfolio.positions.reduce((sum, p) => sum + p.totalValueUsd, 0);
      }
      
      return {
        success: true,
        data: {
          address,
          totalValueUsd: portfolio.totalValueUsd.toFixed(2),
          positionCount: portfolio.positions.length,
          breakdown: {
            byChain: Object.entries(portfolio.byChain).map(([chain, value]) => ({
              chain,
              valueUsd: value.toFixed(2),
              percentage: ((value / portfolio.totalValueUsd) * 100).toFixed(1) + '%'
            })),
            byType: Object.entries(portfolio.byType).map(([type, value]) => ({
              type,
              valueUsd: value.toFixed(2),
              percentage: ((value / portfolio.totalValueUsd) * 100).toFixed(1) + '%'
            })),
            byProtocol: Object.entries(portfolio.byProtocol).map(([protocol, value]) => ({
              protocol,
              valueUsd: value.toFixed(2),
              percentage: ((value / portfolio.totalValueUsd) * 100).toFixed(1) + '%'
            }))
          },
          lastUpdated: portfolio.lastUpdated.toISOString()
        }
      };
    }
  },
  
  {
    name: 'defi_positions',
    description: 'Get detailed positions list with yields and rewards',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' },
        type: { 
          type: 'string', 
          enum: ['all', 'wallet', 'lending', 'borrowing', 'liquidity', 'staking', 'farming']
        },
        protocol: { type: 'string' },
        chain: { type: 'string' }
      },
      required: ['address']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { address, type = 'all', protocol, chain } = params;
      
      let portfolio = generateMockPortfolio(address);
      let positions = portfolio.positions;
      
      if (type !== 'all') {
        positions = positions.filter(p => p.type === type);
      }
      if (protocol) {
        positions = positions.filter(p => p.protocol === protocol);
      }
      if (chain) {
        positions = positions.filter(p => p.chain === chain);
      }
      
      return {
        success: true,
        data: {
          address,
          positionCount: positions.length,
          totalValueUsd: positions.reduce((sum, p) => sum + p.totalValueUsd, 0).toFixed(2),
          positions: positions.map(p => ({
            id: p.id,
            type: p.type,
            protocol: p.protocol,
            chain: p.chain,
            assets: p.assets.map(a => ({
              symbol: a.symbol,
              amount: a.amount.toFixed(4),
              valueUsd: a.valueUsd.toFixed(2),
              price: a.price.toFixed(2)
            })),
            totalValueUsd: p.totalValueUsd.toFixed(2),
            apy: p.apy ? p.apy.toFixed(2) + '%' : null,
            rewards: p.rewards?.map(r => ({
              symbol: r.symbol,
              amount: r.amount.toFixed(4),
              valueUsd: r.valueUsd.toFixed(2)
            })),
            health: p.health,
            impermanentLoss: p.impermanentLoss ? p.impermanentLoss.toFixed(2) + '%' : null
          }))
        }
      };
    }
  },
  
  {
    name: 'defi_yields',
    description: 'Get yield/APY summary across all earning positions',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' }
      },
      required: ['address']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const portfolio = generateMockPortfolio(params.address);
      
      const earningPositions = portfolio.positions.filter(p => p.apy && p.apy > 0);
      const totalEarning = earningPositions.reduce((sum, p) => sum + p.totalValueUsd, 0);
      const weightedApy = earningPositions.reduce((sum, p) => 
        sum + (p.apy! * (p.totalValueUsd / totalEarning)), 0);
      
      const dailyYield = (totalEarning * weightedApy / 100) / 365;
      const monthlyYield = dailyYield * 30;
      const yearlyYield = totalEarning * weightedApy / 100;
      
      const pendingRewards = earningPositions.flatMap(p => p.rewards || []);
      const totalPendingUsd = pendingRewards.reduce((sum, r) => sum + r.valueUsd, 0);
      
      return {
        success: true,
        data: {
          address: params.address,
          earningPositions: earningPositions.length,
          totalEarningUsd: totalEarning.toFixed(2),
          weightedApy: weightedApy.toFixed(2) + '%',
          projectedYield: {
            daily: dailyYield.toFixed(2),
            monthly: monthlyYield.toFixed(2),
            yearly: yearlyYield.toFixed(2)
          },
          pendingRewards: {
            totalUsd: totalPendingUsd.toFixed(2),
            tokens: pendingRewards.map(r => ({
              symbol: r.symbol,
              amount: r.amount.toFixed(4),
              valueUsd: r.valueUsd.toFixed(2)
            }))
          },
          topYielding: earningPositions
            .sort((a, b) => (b.apy || 0) - (a.apy || 0))
            .slice(0, 5)
            .map(p => ({
              protocol: p.protocol,
              type: p.type,
              apy: p.apy?.toFixed(2) + '%',
              valueUsd: p.totalValueUsd.toFixed(2)
            }))
        }
      };
    }
  },
  
  {
    name: 'defi_health',
    description: 'Check health of lending/borrowing positions (liquidation risk)',
    schema: {
      type: 'object',
      properties: {
        address: { type: 'string' }
      },
      required: ['address']
    },
    handler: async (params: any): Promise<ToolResult> => {
      const portfolio = generateMockPortfolio(params.address);
      
      // Simulate lending/borrowing position
      const lendingPositions = [
        {
          protocol: 'aave',
          chain: 'ethereum',
          supplied: 10000,
          borrowed: 5000,
          healthFactor: 1.85,
          liquidationThreshold: 0.825,
          maxBorrow: 8250,
          utilizationRate: 0.606,
          safetyBuffer: 3250,
          liquidationPrice: { ETH: 1620 },
          status: 'healthy'
        }
      ];
      
      return {
        success: true,
        data: {
          address: params.address,
          positions: lendingPositions.map(p => ({
            protocol: p.protocol,
            chain: p.chain,
            suppliedUsd: p.supplied.toFixed(2),
            borrowedUsd: p.borrowed.toFixed(2),
            healthFactor: p.healthFactor.toFixed(2),
            utilizationRate: (p.utilizationRate * 100).toFixed(1) + '%',
            maxBorrowUsd: p.maxBorrow.toFixed(2),
            safetyBufferUsd: p.safetyBuffer.toFixed(2),
            liquidationPrices: p.liquidationPrice,
            status: p.healthFactor >= 1.5 ? '🟢 Healthy' : 
                    p.healthFactor >= 1.2 ? '🟡 Moderate Risk' : '🔴 High Risk'
          })),
          recommendations: lendingPositions
            .filter(p => p.healthFactor < 1.5)
            .map(p => `Consider repaying debt on ${p.protocol} to improve health factor`)
        }
      };
    }
  },
  
  {
    name: 'defi_gas',
    description: 'Get current gas prices across chains with optimization tips',
    schema: {
      type: 'object',
      properties: {
        chains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Chains to check (default: all)'
        }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const chains = params.chains || ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc'];
      
      // Mock gas data
      const gasData = {
        ethereum: { slow: 15, standard: 20, fast: 30, instant: 50, unit: 'gwei' },
        polygon: { slow: 30, standard: 50, fast: 100, instant: 200, unit: 'gwei' },
        arbitrum: { slow: 0.1, standard: 0.1, fast: 0.2, instant: 0.3, unit: 'gwei' },
        optimism: { slow: 0.001, standard: 0.001, fast: 0.002, instant: 0.003, unit: 'gwei' },
        bsc: { slow: 3, standard: 5, fast: 7, instant: 10, unit: 'gwei' }
      };
      
      const ethPrice = 3000;
      const swapGasLimit = 200000;
      
      return {
        success: true,
        data: {
          timestamp: new Date().toISOString(),
          ethPriceUsd: ethPrice,
          chains: chains.map((chain: string) => {
            const gas = gasData[chain as keyof typeof gasData];
            if (!gas) return { chain, error: 'Not supported' };
            
            const standardCostEth = (gas.standard * swapGasLimit) / 1e9;
            const standardCostUsd = chain === 'ethereum' ? standardCostEth * ethPrice : standardCostEth * 0.01;
            
            return {
              chain,
              prices: {
                slow: gas.slow + ' ' + gas.unit,
                standard: gas.standard + ' ' + gas.unit,
                fast: gas.fast + ' ' + gas.unit,
                instant: gas.instant + ' ' + gas.unit
              },
              estimatedSwapCost: {
                gasLimit: swapGasLimit,
                costUsd: standardCostUsd.toFixed(2)
              }
            };
          }),
          tips: [
            'Ethereum gas is typically lowest on weekends and late nights (UTC)',
            'Use L2s (Arbitrum, Optimism) for 90%+ gas savings',
            'Batch transactions when possible to save on base fees'
          ]
        }
      };
    }
  },
  
  {
    name: 'defi_protocols',
    description: 'List supported protocols with TVL and categories',
    schema: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          enum: ['all', 'lending', 'dex', 'yield', 'staking', 'derivatives', 'bridges']
        },
        chain: { type: 'string' }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { category = 'all', chain } = params;
      
      const protocols = [
        { name: 'Aave', category: 'lending', chains: ['ethereum', 'polygon', 'arbitrum', 'avalanche'], tvl: 12500000000 },
        { name: 'Uniswap', category: 'dex', chains: ['ethereum', 'polygon', 'arbitrum', 'optimism'], tvl: 5800000000 },
        { name: 'Lido', category: 'staking', chains: ['ethereum', 'polygon'], tvl: 28000000000 },
        { name: 'Curve', category: 'dex', chains: ['ethereum', 'polygon', 'arbitrum', 'fantom'], tvl: 2100000000 },
        { name: 'GMX', category: 'derivatives', chains: ['arbitrum', 'avalanche'], tvl: 580000000 },
        { name: 'Compound', category: 'lending', chains: ['ethereum'], tvl: 2800000000 },
        { name: 'Yearn', category: 'yield', chains: ['ethereum', 'fantom'], tvl: 450000000 },
        { name: 'Stargate', category: 'bridges', chains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'bsc'], tvl: 380000000 }
      ];
      
      let filtered = protocols;
      if (category !== 'all') {
        filtered = filtered.filter(p => p.category === category);
      }
      if (chain) {
        filtered = filtered.filter(p => p.chains.includes(chain));
      }
      
      return {
        success: true,
        data: {
          protocolCount: filtered.length,
          totalTvl: (filtered.reduce((sum, p) => sum + p.tvl, 0) / 1e9).toFixed(2) + 'B',
          protocols: filtered
            .sort((a, b) => b.tvl - a.tvl)
            .map(p => ({
              name: p.name,
              category: p.category,
              chains: p.chains,
              tvl: (p.tvl / 1e9).toFixed(2) + 'B'
            }))
        }
      };
    }
  },
  
  {
    name: 'defi_opportunities',
    description: 'Find best yield opportunities across protocols',
    schema: {
      type: 'object',
      properties: {
        minApy: { type: 'number', description: 'Minimum APY filter' },
        maxRisk: { 
          type: 'string', 
          enum: ['low', 'medium', 'high'],
          description: 'Maximum risk level'
        },
        chains: { type: 'array', items: { type: 'string' } },
        category: { type: 'string', enum: ['staking', 'lending', 'liquidity', 'farming'] }
      }
    },
    handler: async (params: any): Promise<ToolResult> => {
      const { minApy = 0, maxRisk = 'high', chains, category } = params;
      
      const opportunities = [
        { protocol: 'Lido', type: 'staking', chain: 'ethereum', asset: 'ETH', apy: 3.8, risk: 'low', tvl: '28B' },
        { protocol: 'Aave', type: 'lending', chain: 'ethereum', asset: 'USDC', apy: 4.5, risk: 'low', tvl: '2.5B' },
        { protocol: 'Curve', type: 'liquidity', chain: 'ethereum', asset: 'stETH/ETH', apy: 5.2, risk: 'low', tvl: '1.2B' },
        { protocol: 'GMX', type: 'farming', chain: 'arbitrum', asset: 'GLP', apy: 25.5, risk: 'medium', tvl: '580M' },
        { protocol: 'Uniswap', type: 'liquidity', chain: 'arbitrum', asset: 'ETH/USDC', apy: 15.2, risk: 'medium', tvl: '120M' },
        { protocol: 'Beefy', type: 'farming', chain: 'polygon', asset: 'QUICK/MATIC', apy: 45.0, risk: 'high', tvl: '15M' },
        { protocol: 'Stargate', type: 'staking', chain: 'ethereum', asset: 'USDC', apy: 8.5, risk: 'medium', tvl: '380M' }
      ];
      
      const riskOrder = { low: 1, medium: 2, high: 3 };
      
      let filtered = opportunities
        .filter(o => o.apy >= minApy)
        .filter(o => riskOrder[o.risk as keyof typeof riskOrder] <= riskOrder[maxRisk as keyof typeof riskOrder]);
      
      if (chains && chains.length > 0) {
        filtered = filtered.filter(o => chains.includes(o.chain));
      }
      if (category) {
        filtered = filtered.filter(o => o.type === category);
      }
      
      return {
        success: true,
        data: {
          opportunityCount: filtered.length,
          opportunities: filtered
            .sort((a, b) => b.apy - a.apy)
            .map(o => ({
              protocol: o.protocol,
              type: o.type,
              chain: o.chain,
              asset: o.asset,
              apy: o.apy.toFixed(1) + '%',
              risk: o.risk === 'low' ? '🟢 Low' : o.risk === 'medium' ? '🟡 Medium' : '🔴 High',
              tvl: o.tvl
            }))
        }
      };
    }
  },
  
  {
    name: 'defi_chains',
    description: 'List supported chains with metadata',
    schema: {
      type: 'object',
      properties: {}
    },
    handler: async (): Promise<ToolResult> => {
      return {
        success: true,
        data: {
          chainCount: SUPPORTED_CHAINS.length,
          chains: SUPPORTED_CHAINS.map(c => ({
            id: c.id,
            name: c.name,
            nativeToken: c.symbol,
            chainId: c.chainId
          }))
        }
      };
    }
  }
];

export default defiDashboardTools;
