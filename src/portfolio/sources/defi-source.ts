/**
 * DeFi Data Source
 * 
 * Aggregates positions from DeFi protocols using DefiLlama API.
 */

import { 
  PortfolioDataSource, 
  AssetPosition,
  Platform 
} from '../unified-portfolio';

const DEFILLAMA_API = 'https://api.llama.fi';

export interface DeFiSourceConfig {
  walletAddresses: { address: string; chain: string; label?: string }[];
}

interface DefiLlamaPosition {
  protocol: string;
  chain: string;
  symbol: string;
  balance: number;
  balanceUSD: number;
  category: string;
}

export class DeFiSource implements PortfolioDataSource {
  name = 'DeFi Protocols';
  platform: Platform = 'defi';
  
  private config: DeFiSourceConfig;
  private connected = false;
  
  constructor(config: DeFiSourceConfig) {
    this.config = config;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async connect(): Promise<boolean> {
    // DeFi source just needs wallet addresses, no auth
    this.connected = this.config.walletAddresses.length > 0;
    return this.connected;
  }
  
  async getPositions(): Promise<AssetPosition[]> {
    const positions: AssetPosition[] = [];
    const now = new Date();
    
    for (const wallet of this.config.walletAddresses) {
      try {
        // Fetch positions from DefiLlama
        const response = await fetch(
          `${DEFILLAMA_API}/v2/protocols-positions/${wallet.address}`
        );
        
        if (!response.ok) {
          console.warn(`DeFi fetch failed for ${wallet.address}: ${response.status}`);
          continue;
        }
        
        const data = await response.json() as any;
        
        // Process protocol positions
        for (const protocol of (data.protocols || [])) {
          for (const position of (protocol.positions || [])) {
            const pos: DefiLlamaPosition = {
              protocol: protocol.name,
              chain: position.chain || wallet.chain,
              symbol: position.symbol || 'UNKNOWN',
              balance: position.balance || 0,
              balanceUSD: position.balanceUSD || 0,
              category: protocol.category || 'defi'
            };
            
            if (pos.balanceUSD < 1) continue; // Skip dust
            
            positions.push({
              id: `defi-${pos.protocol}-${pos.symbol}-${wallet.address.slice(0, 8)}`,
              symbol: pos.symbol,
              name: `${pos.symbol} on ${pos.protocol}`,
              class: 'defi',
              platform: 'defi',
              source: pos.protocol,
              chain: pos.chain,
              quantity: pos.balance,
              priceUsd: pos.balance > 0 ? pos.balanceUSD / pos.balance : 0,
              valueUsd: pos.balanceUSD,
              meta: {
                protocol: pos.protocol,
                category: pos.category,
                walletLabel: wallet.label
              },
              updatedAt: now
            });
          }
        }
        
        // Also get simple token balances
        const tokensResponse = await fetch(
          `${DEFILLAMA_API}/v2/token-balances/${wallet.address}`
        );
        
        if (tokensResponse.ok) {
          const tokensData = await tokensResponse.json() as any;
          
          for (const token of (tokensData.tokens || [])) {
            if (token.balanceUSD < 1) continue;
            
            // Avoid duplicates with protocol positions
            const existingId = `wallet-${token.symbol}-${wallet.address.slice(0, 8)}`;
            if (positions.some(p => p.id === existingId)) continue;
            
            positions.push({
              id: existingId,
              symbol: token.symbol,
              name: token.name || token.symbol,
              class: 'crypto',
              platform: 'wallet',
              source: `Wallet (${wallet.label || wallet.chain})`,
              chain: token.chain || wallet.chain,
              quantity: token.balance || 0,
              priceUsd: token.price || 0,
              valueUsd: token.balanceUSD,
              updatedAt: now
            });
          }
        }
        
      } catch (error: any) {
        console.error(`Error fetching DeFi positions for ${wallet.address}: ${error.message}`);
      }
    }
    
    return positions;
  }
  
  disconnect(): void {
    this.connected = false;
  }
}

export function createDeFiSource(config: DeFiSourceConfig): DeFiSource {
  return new DeFiSource(config);
}
