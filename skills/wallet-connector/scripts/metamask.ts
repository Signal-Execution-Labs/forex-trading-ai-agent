/**
 * K.I.T. MetaMask / EVM Wallet Integration
 * 
 * Read-Only Mode using public RPCs
 * - Balance checking (ETH + ERC20 tokens)
 * - Token detection
 * - Transaction history
 * - Gas price monitoring
 * 
 * SECURITY: No private keys - read-only via public RPCs
 */

import { ethers, JsonRpcProvider, formatEther, formatUnits, Contract } from 'ethers';

// ============================================================
// TYPES
// ============================================================

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  decimals: number;
  rpcUrl: string;
  blockExplorer: string;
  coingeckoId?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  valueUsd?: number;
}

export interface WalletBalance {
  address: string;
  chain: string;
  nativeBalance: string;
  nativeBalanceFormatted: string;
  nativeValueUsd?: number;
  tokens: TokenInfo[];
  totalValueUsd?: number;
  lastUpdated: Date;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  valueFormatted: string;
  timestamp?: number;
  blockNumber: number;
  gasUsed?: string;
  gasPrice?: string;
  status: 'success' | 'failed' | 'pending';
  type: 'send' | 'receive' | 'contract';
  tokenTransfer?: {
    token: string;
    symbol: string;
    amount: string;
    amountFormatted: string;
  };
}

export interface GasInfo {
  chain: string;
  baseFee?: string;
  maxPriorityFee?: string;
  gasPrice: string;
  gasPriceGwei: string;
  estimatedCosts: {
    transfer: string;
    swap: string;
    nftMint: string;
  };
  lastUpdated: Date;
}

// ============================================================
// CHAIN CONFIGURATIONS
// ============================================================

export const CHAINS: Record<string, ChainConfig> = {
  ethereum: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    coingeckoId: 'ethereum',
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrl: 'https://polygon-rpc.com',
    blockExplorer: 'https://polygonscan.com',
    coingeckoId: 'matic-network',
  },
  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    coingeckoId: 'ethereum',
  },
  optimism: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    coingeckoId: 'ethereum',
  },
  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    decimals: 18,
    rpcUrl: 'https://bsc-dataseed.binance.org',
    blockExplorer: 'https://bscscan.com',
    coingeckoId: 'binancecoin',
  },
  avalanche: {
    chainId: 43114,
    name: 'Avalanche',
    symbol: 'AVAX',
    decimals: 18,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://snowtrace.io',
    coingeckoId: 'avalanche-2',
  },
  base: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    decimals: 18,
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    coingeckoId: 'ethereum',
  },
};

// Popular ERC20 Tokens (for auto-detection)
export const POPULAR_TOKENS: Record<string, { address: string; symbol: string; name: string; decimals: number }[]> = {
  ethereum: [
    { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: '0x6B175474E89094C44Da98b954EescdeCB5BE33D818', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', name: 'Wrapped BTC', decimals: 8 },
    { address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', symbol: 'LINK', name: 'Chainlink', decimals: 18 },
    { address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', symbol: 'UNI', name: 'Uniswap', decimals: 18 },
    { address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', symbol: 'AAVE', name: 'Aave', decimals: 18 },
    { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  ],
  polygon: [
    { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', name: 'Tether USD', decimals: 6 },
    { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
    { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
    { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  ],
  bsc: [
    { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', name: 'Tether USD', decimals: 18 },
    { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', name: 'USD Coin', decimals: 18 },
    { address: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', symbol: 'ETH', name: 'Ethereum', decimals: 18 },
    { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', name: 'Wrapped BNB', decimals: 18 },
  ],
};

// ERC20 ABI (minimal for balance checking)
const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];

// ============================================================
// METAMASK CONNECTOR CLASS
// ============================================================

export class MetaMaskConnector {
  private providers: Map<string, JsonRpcProvider> = new Map();
  private savedAddress: string | null = null;
  private cachedBalances: Map<string, WalletBalance> = new Map();
  private cacheTimeout = 30000; // 30 seconds

  constructor() {
    // Initialize providers for all chains
    for (const [chainName, config] of Object.entries(CHAINS)) {
      try {
        this.providers.set(chainName, new JsonRpcProvider(config.rpcUrl));
      } catch (e) {
        console.warn(`Failed to initialize provider for ${chainName}:`, e);
      }
    }
  }

  /**
   * Save/connect a wallet address (read-only)
   */
  connectAddress(address: string): { success: boolean; address: string; message: string } {
    // Validate address format
    if (!ethers.isAddress(address)) {
      return {
        success: false,
        address: '',
        message: 'Invalid Ethereum address format',
      };
    }

    this.savedAddress = ethers.getAddress(address); // Checksum
    return {
      success: true,
      address: this.savedAddress,
      message: `Connected to wallet ${this.savedAddress.slice(0, 6)}...${this.savedAddress.slice(-4)} (read-only mode)`,
    };
  }

  /**
   * Get saved address
   */
  getConnectedAddress(): string | null {
    return this.savedAddress;
  }

  /**
   * Get native balance (ETH, MATIC, BNB, etc.)
   */
  async getNativeBalance(address: string, chain: string = 'ethereum'): Promise<string> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not supported`);
    }

    const balance = await provider.getBalance(address);
    const config = CHAINS[chain];
    return formatUnits(balance, config.decimals);
  }

  /**
   * Get ERC20 token balance
   */
  async getTokenBalance(
    address: string,
    tokenAddress: string,
    chain: string = 'ethereum'
  ): Promise<TokenInfo> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not supported`);
    }

    const contract = new Contract(tokenAddress, ERC20_ABI, provider);
    
    const [name, symbol, decimals, balance] = await Promise.all([
      contract.name().catch(() => 'Unknown'),
      contract.symbol().catch(() => '???'),
      contract.decimals().catch(() => 18),
      contract.balanceOf(address),
    ]);

    return {
      address: tokenAddress,
      symbol,
      name,
      decimals: Number(decimals),
      balance: balance.toString(),
      balanceFormatted: formatUnits(balance, decimals),
    };
  }

  /**
   * Get all balances for an address on a specific chain
   */
  async getFullBalance(
    address: string,
    chain: string = 'ethereum',
    includeAllTokens: boolean = true
  ): Promise<WalletBalance> {
    const addr = address || this.savedAddress;
    if (!addr) {
      throw new Error('No address provided or connected');
    }

    const cacheKey = `${addr}-${chain}`;
    const cached = this.cachedBalances.get(cacheKey);
    if (cached && Date.now() - cached.lastUpdated.getTime() < this.cacheTimeout) {
      return cached;
    }

    const config = CHAINS[chain];
    if (!config) {
      throw new Error(`Chain ${chain} not supported`);
    }

    // Get native balance
    const nativeBalance = await this.getNativeBalance(addr, chain);

    // Get token balances
    const tokens: TokenInfo[] = [];
    if (includeAllTokens && POPULAR_TOKENS[chain]) {
      const tokenPromises = POPULAR_TOKENS[chain].map(async (token) => {
        try {
          const info = await this.getTokenBalance(addr, token.address, chain);
          if (parseFloat(info.balanceFormatted) > 0) {
            return info;
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(tokenPromises);
      tokens.push(...results.filter((t): t is TokenInfo => t !== null));
    }

    const result: WalletBalance = {
      address: addr,
      chain,
      nativeBalance: nativeBalance,
      nativeBalanceFormatted: `${parseFloat(nativeBalance).toFixed(6)} ${config.symbol}`,
      tokens,
      lastUpdated: new Date(),
    };

    this.cachedBalances.set(cacheKey, result);
    return result;
  }

  /**
   * Get balances across all chains
   */
  async getAllChainBalances(address?: string): Promise<WalletBalance[]> {
    const addr = address || this.savedAddress;
    if (!addr) {
      throw new Error('No address provided or connected');
    }

    const balances: WalletBalance[] = [];
    const chains = Object.keys(CHAINS);

    for (const chain of chains) {
      try {
        const balance = await this.getFullBalance(addr, chain, true);
        // Only include chains with non-zero balance
        if (
          parseFloat(balance.nativeBalance) > 0 ||
          balance.tokens.length > 0
        ) {
          balances.push(balance);
        }
      } catch (e) {
        console.warn(`Failed to get balance for ${chain}:`, e);
      }
    }

    return balances;
  }

  /**
   * Get recent transactions (limited to what public RPCs provide)
   */
  async getRecentTransactions(
    address: string,
    chain: string = 'ethereum',
    limit: number = 10
  ): Promise<Transaction[]> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not supported`);
    }

    const config = CHAINS[chain];
    const transactions: Transaction[] = [];

    try {
      // Get current block
      const currentBlock = await provider.getBlockNumber();
      
      // Scan last 1000 blocks (limited approach without indexer)
      const startBlock = Math.max(0, currentBlock - 1000);
      
      // Note: This is a simplified approach. For production, use an indexer API
      // like Etherscan, Alchemy, or The Graph
      
      for (let blockNum = currentBlock; blockNum > startBlock && transactions.length < limit; blockNum--) {
        try {
          const block = await provider.getBlock(blockNum, true);
          if (!block || !block.prefetchedTransactions) continue;

          for (const tx of block.prefetchedTransactions) {
            const isRelevant =
              tx.from?.toLowerCase() === address.toLowerCase() ||
              tx.to?.toLowerCase() === address.toLowerCase();

            if (isRelevant) {
              const receipt = await provider.getTransactionReceipt(tx.hash);
              
              transactions.push({
                hash: tx.hash,
                from: tx.from,
                to: tx.to || '',
                value: tx.value.toString(),
                valueFormatted: `${formatEther(tx.value)} ${config.symbol}`,
                timestamp: block.timestamp,
                blockNumber: blockNum,
                gasUsed: receipt?.gasUsed?.toString(),
                gasPrice: tx.gasPrice?.toString(),
                status: receipt?.status === 1 ? 'success' : 'failed',
                type: tx.from.toLowerCase() === address.toLowerCase() ? 'send' : 'receive',
              });

              if (transactions.length >= limit) break;
            }
          }
        } catch {
          // Skip blocks with errors
        }
      }
    } catch (e) {
      console.error('Error fetching transactions:', e);
    }

    return transactions;
  }

  /**
   * Get current gas prices
   */
  async getGasInfo(chain: string = 'ethereum'): Promise<GasInfo> {
    const provider = this.providers.get(chain);
    if (!provider) {
      throw new Error(`Chain ${chain} not supported`);
    }

    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || BigInt(0);
    const gasPriceGwei = formatUnits(gasPrice, 'gwei');

    // Estimated costs (21000 gas for simple transfer)
    const transferCost = formatEther(gasPrice * BigInt(21000));
    const swapCost = formatEther(gasPrice * BigInt(150000)); // Typical swap
    const nftMintCost = formatEther(gasPrice * BigInt(100000)); // Typical mint

    return {
      chain,
      baseFee: feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 'gwei') : undefined,
      maxPriorityFee: feeData.maxPriorityFeePerGas 
        ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') 
        : undefined,
      gasPrice: gasPrice.toString(),
      gasPriceGwei: `${parseFloat(gasPriceGwei).toFixed(2)} gwei`,
      estimatedCosts: {
        transfer: `${parseFloat(transferCost).toFixed(6)} ${CHAINS[chain].symbol}`,
        swap: `${parseFloat(swapCost).toFixed(6)} ${CHAINS[chain].symbol}`,
        nftMint: `${parseFloat(nftMintCost).toFixed(6)} ${CHAINS[chain].symbol}`,
      },
      lastUpdated: new Date(),
    };
  }

  /**
   * Check if address is a contract
   */
  async isContract(address: string, chain: string = 'ethereum'): Promise<boolean> {
    const provider = this.providers.get(chain);
    if (!provider) return false;

    const code = await provider.getCode(address);
    return code !== '0x';
  }

  /**
   * Get supported chains list
   */
  getSupportedChains(): ChainConfig[] {
    return Object.values(CHAINS);
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

let metamaskInstance: MetaMaskConnector | null = null;

export function getMetaMaskConnector(): MetaMaskConnector {
  if (!metamaskInstance) {
    metamaskInstance = new MetaMaskConnector();
  }
  return metamaskInstance;
}

export function createMetaMaskConnector(): MetaMaskConnector {
  return new MetaMaskConnector();
}
