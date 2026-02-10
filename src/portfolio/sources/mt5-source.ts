/**
 * MT5 Data Source
 * 
 * Aggregates positions from MetaTrader 5 accounts.
 * Uses the MT5 Python bridge via child process.
 */

import { spawn } from 'child_process';
import * as path from 'path';
import { 
  PortfolioDataSource, 
  AssetPosition,
  Platform 
} from '../unified-portfolio';

export interface MT5SourceConfig {
  server: string;
  login: number;
  password: string;
  pythonPath?: string;
}

interface MT5Position {
  ticket: number;
  symbol: string;
  type: number; // 0 = buy, 1 = sell
  volume: number;
  price_open: number;
  price_current: number;
  profit: number;
  swap: number;
  commission: number;
}

interface MT5AccountInfo {
  balance: number;
  equity: number;
  margin: number;
  margin_free: number;
  profit: number;
  currency: string;
}

export class MT5Source implements PortfolioDataSource {
  name = 'MetaTrader 5';
  platform: Platform = 'mt5';
  
  private config: MT5SourceConfig;
  private connected = false;
  
  constructor(config: MT5SourceConfig) {
    this.config = config;
    this.name = `MT5 (${config.server})`;
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  async connect(): Promise<boolean> {
    // Test MT5 connection via Python
    try {
      const result = await this.runPythonScript('test_connection');
      this.connected = result.success;
      return this.connected;
    } catch {
      this.connected = false;
      return false;
    }
  }
  
  async getPositions(): Promise<AssetPosition[]> {
    const positions: AssetPosition[] = [];
    const now = new Date();
    
    try {
      // Get account info
      const accountResult = await this.runPythonScript('get_account');
      const account = accountResult.data as MT5AccountInfo;
      
      if (account) {
        // Add account balance as cash position
        positions.push({
          id: `mt5-balance-${this.config.login}`,
          symbol: account.currency,
          name: `MT5 Balance (${this.config.server})`,
          class: 'cash',
          platform: 'mt5',
          source: this.name,
          quantity: account.balance,
          priceUsd: 1, // Assuming USD-based account
          valueUsd: account.balance,
          meta: {
            equity: account.equity,
            margin: account.margin,
            marginFree: account.margin_free,
            floatingPnL: account.profit
          },
          updatedAt: now
        });
      }
      
      // Get open positions
      const positionsResult = await this.runPythonScript('get_positions');
      const mt5Positions = positionsResult.data as MT5Position[];
      
      for (const pos of mt5Positions || []) {
        const isLong = pos.type === 0;
        const pnl = pos.profit + pos.swap + pos.commission;
        const costBasis = pos.price_open * pos.volume;
        const currentValue = pos.price_current * pos.volume;
        
        positions.push({
          id: `mt5-pos-${pos.ticket}`,
          symbol: pos.symbol,
          name: `${pos.symbol} (${isLong ? 'Long' : 'Short'})`,
          class: 'forex',
          platform: 'mt5',
          source: this.name,
          quantity: pos.volume * (isLong ? 1 : -1),
          priceUsd: pos.price_current,
          valueUsd: currentValue,
          costBasis,
          pnl,
          pnlPercent: costBasis > 0 ? (pnl / costBasis) * 100 : 0,
          meta: {
            ticket: pos.ticket,
            side: isLong ? 'long' : 'short',
            entryPrice: pos.price_open,
            swap: pos.swap,
            commission: pos.commission
          },
          updatedAt: now
        });
      }
      
    } catch (error: any) {
      console.error(`MT5 fetch error: ${error.message}`);
    }
    
    return positions;
  }
  
  disconnect(): void {
    this.connected = false;
  }
  
  private async runPythonScript(action: string): Promise<{ success: boolean; data?: any }> {
    return new Promise((resolve, reject) => {
      const pythonPath = this.config.pythonPath || 'python';
      const scriptPath = path.join(__dirname, '..', '..', 'python', 'mt5_bridge.py');
      
      const args = [
        scriptPath,
        '--action', action,
        '--server', this.config.server,
        '--login', this.config.login.toString(),
        '--password', this.config.password
      ];
      
      const proc = spawn(pythonPath, args);
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });
      
      proc.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(stdout));
          } catch {
            resolve({ success: true, data: stdout });
          }
        } else {
          reject(new Error(stderr || `Python script exited with code ${code}`));
        }
      });
      
      proc.on('error', reject);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        proc.kill();
        reject(new Error('MT5 script timeout'));
      }, 30000);
    });
  }
}

export function createMT5Source(config: MT5SourceConfig): MT5Source {
  return new MT5Source(config);
}
