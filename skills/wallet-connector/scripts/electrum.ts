/**
 * K.I.T. Electrum (Bitcoin) Wallet Integration
 * 
 * RPC connection to a running Electrum wallet instance
 * 
 * Prerequisites:
 * - Electrum wallet running with RPC enabled
 * - Command: electrum daemon -d && electrum setconfig rpcport 7777
 * 
 * SECURITY: 
 * - RPC should only be accessible locally
 * - No private keys stored or transmitted
 * - User retains full control
 */

import axios, { AxiosInstance } from 'axios';

// ============================================================
// TYPES
// ============================================================

export interface ElectrumConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface ElectrumBalance {
  confirmed: string;
  unconfirmed: string;
  total: string;
  totalBtc: string;
  addresses: number;
}

export interface ElectrumAddress {
  address: string;
  balance: string;
  label?: string;
  isUsed: boolean;
}

export interface ElectrumTransaction {
  txid: string;
  timestamp: number;
  date: string;
  value: string;
  valueBtc: string;
  fee?: string;
  confirmations: number;
  type: 'send' | 'receive';
  label?: string;
  inputs: string[];
  outputs: { address: string; value: string }[];
}

export interface ElectrumUTXO {
  txid: string;
  vout: number;
  value: string;
  valueBtc: string;
  address: string;
  confirmations: number;
}

export interface ElectrumWalletInfo {
  connected: boolean;
  synchronized: boolean;
  walletPath?: string;
  networkType: 'mainnet' | 'testnet';
  serverInfo?: {
    host: string;
    version: string;
  };
}

export interface SendResult {
  success: boolean;
  txid?: string;
  error?: string;
  fee?: string;
}

// ============================================================
// ELECTRUM RPC CLIENT
// ============================================================

export class ElectrumConnector {
  private client: AxiosInstance | null = null;
  private config: ElectrumConfig = {
    host: 'localhost',
    port: 7777,
  };
  private isConnected: boolean = false;

  constructor(config?: Partial<ElectrumConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Connect to Electrum RPC
   */
  async connect(config?: Partial<ElectrumConfig>): Promise<ElectrumWalletInfo> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    const baseURL = `http://${this.config.host}:${this.config.port}`;
    
    const axiosConfig: any = {
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (this.config.username && this.config.password) {
      axiosConfig.auth = { 
        username: this.config.username, 
        password: this.config.password 
      };
    }

    this.client = axios.create(axiosConfig);

    try {
      // Test connection
      const version = await this.rpcCall('version');
      const isTestnet = await this.rpcCall('getconfig', ['testnet']).catch(() => false);
      
      this.isConnected = true;

      return {
        connected: true,
        synchronized: true,
        networkType: isTestnet ? 'testnet' : 'mainnet',
        serverInfo: {
          host: this.config.host,
          version: version || 'unknown',
        },
      };
    } catch (error: any) {
      this.isConnected = false;
      throw new Error(`Failed to connect to Electrum: ${error.message}`);
    }
  }

  /**
   * Make RPC call to Electrum
   */
  private async rpcCall(method: string, params: any[] = []): Promise<any> {
    if (!this.client) {
      throw new Error('Not connected to Electrum. Call connect() first.');
    }

    try {
      const response = await this.client.post('/', {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      });

      if (response.data.error) {
        throw new Error(response.data.error.message || 'RPC Error');
      }

      return response.data.result;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Electrum daemon not running. Start with: electrum daemon -d');
      }
      throw error;
    }
  }

  /**
   * Get wallet balance
   */
  async getBalance(): Promise<ElectrumBalance> {
    this.ensureConnected();

    const balance = await this.rpcCall('getbalance');
    const addresses = await this.rpcCall('listaddresses');

    // Balance is in BTC
    const confirmed = balance.confirmed || '0';
    const unconfirmed = balance.unconfirmed || '0';
    const total = (parseFloat(confirmed) + parseFloat(unconfirmed)).toFixed(8);

    return {
      confirmed: this.satoshiToBtc(this.btcToSatoshi(confirmed)),
      unconfirmed: this.satoshiToBtc(this.btcToSatoshi(unconfirmed)),
      total,
      totalBtc: `${total} BTC`,
      addresses: Array.isArray(addresses) ? addresses.length : 0,
    };
  }

  /**
   * Get list of addresses
   */
  async getAddresses(): Promise<ElectrumAddress[]> {
    this.ensureConnected();

    const addresses = await this.rpcCall('listaddresses');
    const result: ElectrumAddress[] = [];

    for (const addr of addresses) {
      try {
        const balance = await this.rpcCall('getaddressbalance', [addr]);
        const history = await this.rpcCall('getaddresshistory', [addr]);
        
        result.push({
          address: addr,
          balance: this.satoshiToBtc(
            (balance.confirmed || 0) + (balance.unconfirmed || 0)
          ),
          isUsed: history && history.length > 0,
        });
      } catch {
        result.push({
          address: addr,
          balance: '0',
          isUsed: false,
        });
      }
    }

    return result;
  }

  /**
   * Get new receiving address
   */
  async getNewAddress(label?: string): Promise<string> {
    this.ensureConnected();
    return await this.rpcCall('createnewaddress');
  }

  /**
   * Get transaction history
   */
  async getHistory(limit: number = 20): Promise<ElectrumTransaction[]> {
    this.ensureConnected();

    const history = await this.rpcCall('onchain_history');
    const transactions: ElectrumTransaction[] = [];

    if (!history || !history.transactions) {
      return [];
    }

    const txList = history.transactions.slice(0, limit);

    for (const tx of txList) {
      const valueSatoshi = tx.bc_value || tx.value || 0;
      const valueBtc = parseFloat(this.satoshiToBtc(Math.abs(valueSatoshi)));
      
      transactions.push({
        txid: tx.txid,
        timestamp: tx.timestamp || 0,
        date: tx.timestamp 
          ? new Date(tx.timestamp * 1000).toISOString() 
          : 'pending',
        value: Math.abs(valueSatoshi).toString(),
        valueBtc: `${valueBtc > 0 ? '+' : ''}${valueBtc.toFixed(8)} BTC`,
        fee: tx.fee ? this.satoshiToBtc(tx.fee) : undefined,
        confirmations: tx.confirmations || 0,
        type: valueSatoshi >= 0 ? 'receive' : 'send',
        label: tx.label,
        inputs: tx.inputs || [],
        outputs: tx.outputs || [],
      });
    }

    return transactions;
  }

  /**
   * Get unspent transaction outputs (UTXOs)
   */
  async getUtxos(): Promise<ElectrumUTXO[]> {
    this.ensureConnected();

    const utxos = await this.rpcCall('listunspent');
    
    return utxos.map((utxo: any) => ({
      txid: utxo.prevout_hash,
      vout: utxo.prevout_n,
      value: utxo.value.toString(),
      valueBtc: this.satoshiToBtc(utxo.value),
      address: utxo.address,
      confirmations: utxo.height ? 1 : 0, // Simplified
    }));
  }

  /**
   * Create and broadcast a transaction
   * 
   * NOTE: This requires wallet to be unlocked with password
   * The user must confirm in Electrum GUI or provide password
   */
  async sendBitcoin(
    destination: string,
    amountBtc: string,
    feeRate?: number // sat/vB
  ): Promise<SendResult> {
    this.ensureConnected();

    try {
      // Validate address
      const isValid = await this.rpcCall('validateaddress', [destination]);
      if (!isValid) {
        return { success: false, error: 'Invalid Bitcoin address' };
      }

      // Create transaction (unsigned)
      const outputs = [[destination, amountBtc]];
      const options: any = {};
      if (feeRate) {
        options.feerate = feeRate;
      }

      // payto creates the transaction
      const tx = await this.rpcCall('payto', [destination, amountBtc, options]);
      
      if (!tx) {
        return { success: false, error: 'Failed to create transaction' };
      }

      // Note: For security, actual broadcast should be confirmed by user
      // This returns the unsigned transaction for review
      // To broadcast: await this.rpcCall('broadcast', [tx]);
      
      return {
        success: true,
        txid: 'UNSIGNED - Confirm in Electrum to broadcast',
        fee: tx.fee,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Transaction failed',
      };
    }
  }

  /**
   * Estimate fee for a transaction
   */
  async estimateFee(blocks: number = 6): Promise<{ feeRate: string; totalFee: string }> {
    this.ensureConnected();

    try {
      // Get fee estimate (sat/vB)
      const feeRate = await this.rpcCall('getfeerate');
      
      // Estimate for typical transaction (250 vB)
      const typicalSize = 250;
      const totalFeeSat = Math.ceil(feeRate * typicalSize);

      return {
        feeRate: `${feeRate} sat/vB`,
        totalFee: `${this.satoshiToBtc(totalFeeSat)} BTC`,
      };
    } catch {
      return {
        feeRate: 'unknown',
        totalFee: 'unknown',
      };
    }
  }

  /**
   * Get wallet info
   */
  async getWalletInfo(): Promise<ElectrumWalletInfo> {
    if (!this.isConnected) {
      return {
        connected: false,
        synchronized: false,
        networkType: 'mainnet',
      };
    }

    try {
      const isSynced = await this.rpcCall('is_synchronized');
      const version = await this.rpcCall('version');
      const network = await this.rpcCall('getconfig', ['testnet']).catch(() => false);

      return {
        connected: true,
        synchronized: isSynced,
        networkType: network ? 'testnet' : 'mainnet',
        serverInfo: {
          host: this.config.host,
          version,
        },
      };
    } catch {
      return {
        connected: this.isConnected,
        synchronized: false,
        networkType: 'mainnet',
      };
    }
  }

  /**
   * Disconnect from Electrum
   */
  disconnect(): void {
    this.client = null;
    this.isConnected = false;
  }

  // ============================================================
  // HELPERS
  // ============================================================

  private ensureConnected(): void {
    if (!this.isConnected || !this.client) {
      throw new Error('Not connected to Electrum. Call connect() first.');
    }
  }

  private satoshiToBtc(satoshi: number | string): string {
    const sat = typeof satoshi === 'string' ? parseInt(satoshi, 10) : satoshi;
    return (sat / 100000000).toFixed(8);
  }

  private btcToSatoshi(btc: string | number): number {
    const btcNum = typeof btc === 'string' ? parseFloat(btc) : btc;
    return Math.round(btcNum * 100000000);
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

let electrumInstance: ElectrumConnector | null = null;

export function getElectrumConnector(): ElectrumConnector {
  if (!electrumInstance) {
    electrumInstance = new ElectrumConnector();
  }
  return electrumInstance;
}

export function createElectrumConnector(config?: Partial<ElectrumConfig>): ElectrumConnector {
  return new ElectrumConnector(config);
}
