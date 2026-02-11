/**
 * K.I.T. Wallet Tools
 * 
 * Tools for wallet integration:
 * - MetaMask / EVM wallets (read-only)
 * - Electrum / Bitcoin (RPC connection)
 * 
 * SECURITY: 
 * - No private keys stored or transmitted
 * - Read-only access via public RPCs
 * - User retains full control
 */

import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';
import {
  MetaMaskConnector,
  getMetaMaskConnector,
  WalletBalance,
  GasInfo,
  Transaction,
  CHAINS,
} from '../../skills/wallet-connector/scripts/metamask';
import {
  ElectrumConnector,
  getElectrumConnector,
  ElectrumBalance,
  ElectrumTransaction,
  ElectrumWalletInfo,
} from '../../skills/wallet-connector/scripts/electrum';

// ============================================================================
// Tool Definitions (for LLM)
// ============================================================================

export const WALLET_TOOLS: ChatToolDef[] = [
  // ===== MetaMask / EVM Tools =====
  {
    name: 'wallet_connect_address',
    description: 'Save/connect an Ethereum wallet address for read-only monitoring. This does NOT require MetaMask browser extension - just provide any ETH address to track.',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Ethereum address (0x...)',
        },
      },
      required: ['address'],
    },
  },
  {
    name: 'wallet_balance',
    description: 'Get ETH and token balances for a wallet address across EVM chains (Ethereum, Polygon, Arbitrum, etc.)',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Ethereum address (optional if already connected)',
        },
        chain: {
          type: 'string',
          description: 'Chain to check (ethereum, polygon, arbitrum, optimism, bsc, avalanche, base)',
          default: 'ethereum',
        },
        allChains: {
          type: 'boolean',
          description: 'Get balances from all supported chains',
          default: false,
        },
      },
    },
  },
  {
    name: 'wallet_tokens',
    description: 'Get all ERC20 token holdings for a wallet address',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Ethereum address (optional if already connected)',
        },
        chain: {
          type: 'string',
          description: 'Chain to check',
          default: 'ethereum',
        },
      },
    },
  },
  {
    name: 'wallet_transactions',
    description: 'Get recent transactions for a wallet address (limited to last ~1000 blocks)',
    parameters: {
      type: 'object',
      properties: {
        address: {
          type: 'string',
          description: 'Ethereum address',
        },
        chain: {
          type: 'string',
          description: 'Chain to check',
          default: 'ethereum',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of transactions to return',
          default: 10,
        },
      },
    },
  },
  {
    name: 'wallet_gas',
    description: 'Get current gas prices and estimated transaction costs for an EVM chain',
    parameters: {
      type: 'object',
      properties: {
        chain: {
          type: 'string',
          description: 'Chain to check (ethereum, polygon, etc.)',
          default: 'ethereum',
        },
      },
    },
  },

  // ===== Electrum / Bitcoin Tools =====
  {
    name: 'electrum_connect',
    description: 'Connect to a running Electrum wallet via RPC. Electrum must be running with daemon mode enabled.',
    parameters: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Electrum RPC host',
          default: 'localhost',
        },
        port: {
          type: 'number',
          description: 'Electrum RPC port',
          default: 7777,
        },
        username: {
          type: 'string',
          description: 'RPC username (if configured)',
        },
        password: {
          type: 'string',
          description: 'RPC password (if configured)',
        },
      },
    },
  },
  {
    name: 'electrum_balance',
    description: 'Get Bitcoin wallet balance from connected Electrum',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'electrum_history',
    description: 'Get Bitcoin transaction history from connected Electrum',
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of transactions',
          default: 20,
        },
      },
    },
  },
  {
    name: 'electrum_addresses',
    description: 'Get list of Bitcoin addresses in the connected Electrum wallet',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'electrum_new_address',
    description: 'Generate a new Bitcoin receiving address',
    parameters: {
      type: 'object',
      properties: {
        label: {
          type: 'string',
          description: 'Optional label for the address',
        },
      },
    },
  },
  {
    name: 'electrum_send',
    description: 'Create a Bitcoin transaction (requires confirmation in Electrum)',
    parameters: {
      type: 'object',
      properties: {
        destination: {
          type: 'string',
          description: 'Destination Bitcoin address',
        },
        amount: {
          type: 'string',
          description: 'Amount in BTC (e.g., "0.001")',
        },
        feeRate: {
          type: 'number',
          description: 'Fee rate in sat/vB (optional)',
        },
      },
      required: ['destination', 'amount'],
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

export interface WalletToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export const WALLET_TOOL_HANDLERS: Record<string, (params: any) => Promise<WalletToolResult>> = {
  // ===== MetaMask / EVM Handlers =====
  
  wallet_connect_address: async (params: { address: string }): Promise<WalletToolResult> => {
    try {
      const connector = getMetaMaskConnector();
      const result = connector.connectAddress(params.address);
      
      if (!result.success) {
        return { success: false, error: result.message };
      }

      return {
        success: true,
        data: {
          address: result.address,
          message: result.message,
          supportedChains: Object.keys(CHAINS),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  wallet_balance: async (params: { 
    address?: string; 
    chain?: string; 
    allChains?: boolean 
  }): Promise<WalletToolResult> => {
    try {
      const connector = getMetaMaskConnector();
      const address = params.address || connector.getConnectedAddress();
      
      if (!address) {
        return { 
          success: false, 
          error: 'No address provided. Use wallet_connect_address first or provide an address.' 
        };
      }

      if (params.allChains) {
        const balances = await connector.getAllChainBalances(address);
        
        // Calculate totals
        let summary = `📊 Wallet: ${address.slice(0, 6)}...${address.slice(-4)}\n\n`;
        
        for (const balance of balances) {
          summary += `🔗 ${CHAINS[balance.chain]?.name || balance.chain}:\n`;
          summary += `   ${balance.nativeBalanceFormatted}\n`;
          if (balance.tokens.length > 0) {
            for (const token of balance.tokens) {
              summary += `   ${parseFloat(token.balanceFormatted).toFixed(4)} ${token.symbol}\n`;
            }
          }
          summary += '\n';
        }

        return {
          success: true,
          data: {
            address,
            balances,
            summary: summary.trim(),
          },
        };
      }

      const chain = params.chain || 'ethereum';
      const balance = await connector.getFullBalance(address, chain, true);

      let summary = `📊 ${CHAINS[chain]?.name || chain} Balance\n`;
      summary += `Address: ${address.slice(0, 6)}...${address.slice(-4)}\n\n`;
      summary += `💰 ${balance.nativeBalanceFormatted}\n`;
      
      if (balance.tokens.length > 0) {
        summary += `\n🪙 Tokens:\n`;
        for (const token of balance.tokens) {
          summary += `   ${parseFloat(token.balanceFormatted).toFixed(4)} ${token.symbol}\n`;
        }
      }

      return {
        success: true,
        data: {
          ...balance,
          summary: summary.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  wallet_tokens: async (params: { address?: string; chain?: string }): Promise<WalletToolResult> => {
    try {
      const connector = getMetaMaskConnector();
      const address = params.address || connector.getConnectedAddress();
      
      if (!address) {
        return { 
          success: false, 
          error: 'No address provided. Use wallet_connect_address first or provide an address.' 
        };
      }

      const chain = params.chain || 'ethereum';
      const balance = await connector.getFullBalance(address, chain, true);

      return {
        success: true,
        data: {
          address,
          chain,
          tokens: balance.tokens,
          count: balance.tokens.length,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  wallet_transactions: async (params: { 
    address?: string; 
    chain?: string; 
    limit?: number 
  }): Promise<WalletToolResult> => {
    try {
      const connector = getMetaMaskConnector();
      const address = params.address || connector.getConnectedAddress();
      
      if (!address) {
        return { 
          success: false, 
          error: 'No address provided.' 
        };
      }

      const chain = params.chain || 'ethereum';
      const limit = params.limit || 10;
      
      const transactions = await connector.getRecentTransactions(address, chain, limit);

      let summary = `📜 Recent Transactions (${chain})\n`;
      summary += `Address: ${address.slice(0, 6)}...${address.slice(-4)}\n\n`;
      
      if (transactions.length === 0) {
        summary += 'No recent transactions found in last ~1000 blocks.\n';
        summary += 'Note: For full history, use a block explorer or indexer API.';
      } else {
        for (const tx of transactions) {
          const icon = tx.type === 'receive' ? '📥' : '📤';
          summary += `${icon} ${tx.valueFormatted}\n`;
          summary += `   Hash: ${tx.hash.slice(0, 10)}...\n`;
          summary += `   Status: ${tx.status}\n\n`;
        }
      }

      return {
        success: true,
        data: {
          address,
          chain,
          transactions,
          summary: summary.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  wallet_gas: async (params: { chain?: string }): Promise<WalletToolResult> => {
    try {
      const connector = getMetaMaskConnector();
      const chain = params.chain || 'ethereum';
      
      const gasInfo = await connector.getGasInfo(chain);

      let summary = `⛽ Gas Prices (${CHAINS[chain]?.name || chain})\n\n`;
      summary += `Current: ${gasInfo.gasPriceGwei}\n`;
      if (gasInfo.baseFee) {
        summary += `Base Fee: ${gasInfo.baseFee} gwei\n`;
      }
      if (gasInfo.maxPriorityFee) {
        summary += `Priority Fee: ${gasInfo.maxPriorityFee} gwei\n`;
      }
      summary += `\n📊 Estimated Costs:\n`;
      summary += `   Transfer: ${gasInfo.estimatedCosts.transfer}\n`;
      summary += `   Swap: ${gasInfo.estimatedCosts.swap}\n`;
      summary += `   NFT Mint: ${gasInfo.estimatedCosts.nftMint}\n`;

      return {
        success: true,
        data: {
          ...gasInfo,
          summary: summary.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  // ===== Electrum / Bitcoin Handlers =====

  electrum_connect: async (params: { 
    host?: string; 
    port?: number;
    username?: string;
    password?: string;
  }): Promise<WalletToolResult> => {
    try {
      const connector = getElectrumConnector();
      const info = await connector.connect({
        host: params.host || 'localhost',
        port: params.port || 7777,
        username: params.username,
        password: params.password,
      });

      return {
        success: true,
        data: {
          ...info,
          message: `Connected to Electrum (${info.networkType})`,
        },
      };
    } catch (error: any) {
      return { 
        success: false, 
        error: error.message + '\n\nMake sure Electrum is running with:\n  electrum daemon -d\n  electrum setconfig rpcport 7777'
      };
    }
  },

  electrum_balance: async (): Promise<WalletToolResult> => {
    try {
      const connector = getElectrumConnector();
      const balance = await connector.getBalance();

      let summary = `₿ Bitcoin Wallet Balance\n\n`;
      summary += `Confirmed: ${balance.confirmed} BTC\n`;
      if (parseFloat(balance.unconfirmed) > 0) {
        summary += `Unconfirmed: ${balance.unconfirmed} BTC\n`;
      }
      summary += `\n💰 Total: ${balance.totalBtc}\n`;
      summary += `📍 Addresses: ${balance.addresses}`;

      return {
        success: true,
        data: {
          ...balance,
          summary: summary.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  electrum_history: async (params: { limit?: number }): Promise<WalletToolResult> => {
    try {
      const connector = getElectrumConnector();
      const history = await connector.getHistory(params.limit || 20);

      let summary = `₿ Bitcoin Transaction History\n\n`;
      
      for (const tx of history) {
        const icon = tx.type === 'receive' ? '📥' : '📤';
        summary += `${icon} ${tx.valueBtc}\n`;
        summary += `   Date: ${tx.date}\n`;
        summary += `   Confirmations: ${tx.confirmations}\n`;
        summary += `   TX: ${tx.txid.slice(0, 12)}...\n\n`;
      }

      return {
        success: true,
        data: {
          transactions: history,
          count: history.length,
          summary: summary.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  electrum_addresses: async (): Promise<WalletToolResult> => {
    try {
      const connector = getElectrumConnector();
      const addresses = await connector.getAddresses();

      const withBalance = addresses.filter(a => parseFloat(a.balance) > 0);
      
      let summary = `₿ Bitcoin Addresses\n\n`;
      summary += `Total: ${addresses.length}\n`;
      summary += `With Balance: ${withBalance.length}\n\n`;

      for (const addr of withBalance) {
        summary += `📍 ${addr.address.slice(0, 12)}...\n`;
        summary += `   Balance: ${addr.balance} BTC\n\n`;
      }

      return {
        success: true,
        data: {
          addresses,
          withBalance,
          summary: summary.trim(),
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  electrum_new_address: async (params: { label?: string }): Promise<WalletToolResult> => {
    try {
      const connector = getElectrumConnector();
      const address = await connector.getNewAddress(params.label);

      return {
        success: true,
        data: {
          address,
          label: params.label,
          message: `New receiving address generated: ${address}`,
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },

  electrum_send: async (params: { 
    destination: string; 
    amount: string; 
    feeRate?: number 
  }): Promise<WalletToolResult> => {
    try {
      const connector = getElectrumConnector();
      const result = await connector.sendBitcoin(
        params.destination,
        params.amount,
        params.feeRate
      );

      if (!result.success) {
        return { success: false, error: result.error };
      }

      return {
        success: true,
        data: {
          ...result,
          message: `Transaction created. Please confirm in Electrum wallet to broadcast.`,
          warning: '⚠️ Transaction requires confirmation in Electrum GUI',
        },
      };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  },
};

// ============================================================================
// Export Helper Functions
// ============================================================================

export function getWalletTools(): ChatToolDef[] {
  return WALLET_TOOLS;
}

export function getWalletHandlers(): Record<string, (params: any) => Promise<WalletToolResult>> {
  return WALLET_TOOL_HANDLERS;
}

// Quick access to connectors
export { getMetaMaskConnector, getElectrumConnector };
