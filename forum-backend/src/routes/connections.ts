/**
 * Platform Connections Routes
 * /api/connections/* endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/user.service.ts';
import { validateBinanceCredentials, fetchBinanceTrades } from '../services/binance.service.ts';
import { validateBinaryFasterCredentials, fetchBinaryFasterTrades } from '../services/binaryfaster.service.ts';
import { validateBybitCredentials, fetchBybitTrades } from '../services/bybit.service.ts';
import { validateCTraderCredentials, fetchCTraderTrades } from '../services/ctrader.service.ts';
import { validateIBKRConnection, fetchIBKRTrades } from '../services/ibkr.service.ts';
import { validateTradeLockerCredentials, fetchTradeLockerTrades } from '../services/tradelocker.service.ts';
import { JournalService } from '../services/journal.service.ts';

export async function connectionsRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/connections
   * Get all connections for authenticated user
   */
  fastify.get('/', {
    schema: {
      description: 'Get all platform connections for the authenticated user',
      tags: ['Connections'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            connections: { type: 'array' },
          },
        },
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { userId?: string; githubId?: number };
      
      if (!user.userId) {
        return reply.status(401).send({ error: 'User ID not found in token' });
      }

      const connections = await UserService.getConnections(user.userId);
      return { connections };
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  /**
   * POST /api/connections
   * Add a new platform connection
   */
  fastify.post('/', {
    schema: {
      description: 'Add a new platform connection',
      tags: ['Connections'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['platform', 'name', 'credentials'],
        properties: {
          platform: { type: 'string', description: 'Platform ID (mt4, mt5, binance, bybit, etc.)' },
          name: { type: 'string', description: 'User-friendly name for this connection' },
          credentials: { type: 'object', description: 'Platform-specific credentials' },
          broker: { type: 'string' },
          account_type: { type: 'string', enum: ['live', 'demo', 'prop_firm'] },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            connection: { type: 'object' },
          },
        },
      },
    },
  }, async (request: FastifyRequest<{
    Body: {
      platform: string;
      name: string;
      credentials: Record<string, any>;
      broker?: string;
      account_type?: string;
    }
  }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { userId?: string };
      
      if (!user.userId) {
        return reply.status(401).send({ error: 'User ID not found in token' });
      }

      const { platform, name, credentials, broker, account_type } = request.body;

      // Validate platform
      const validPlatforms = ['mt4', 'mt5', 'binance', 'binaryfaster', 'bybit', 'ctrader', 'tradingview', 'ibkr', 'tradelocker'];
      if (!validPlatforms.includes(platform)) {
        return reply.status(400).send({ error: `Invalid platform. Must be one of: ${validPlatforms.join(', ')}` });
      }

      const connection = await UserService.addConnection(user.userId, {
        platform,
        name,
        credentials,
        broker,
        account_type,
      });

      if (!connection) {
        return reply.status(500).send({ error: 'Failed to create connection' });
      }

      return reply.status(201).send({
        success: true,
        connection: {
          ...connection,
          credentials: { configured: true }, // Don't return actual credentials
        },
      });
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  /**
   * DELETE /api/connections/:id
   * Delete a platform connection
   */
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a platform connection',
      tags: ['Connections'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { userId?: string };
      
      if (!user.userId) {
        return reply.status(401).send({ error: 'User ID not found in token' });
      }

      const success = await UserService.deleteConnection(request.params.id, user.userId);
      
      if (!success) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      return { success: true };
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  /**
   * GET /api/connections/:id/test
   * Test a platform connection
   */
  fastify.get('/:id/test', {
    schema: {
      description: 'Test a platform connection',
      tags: ['Connections'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { userId?: string };
      
      if (!user.userId) {
        return reply.status(401).send({ error: 'User ID not found in token' });
      }

      const connection = await UserService.getConnectionWithCredentials(request.params.id, user.userId);
      
      if (!connection) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      // Test based on platform
      switch (connection.platform) {
        case 'binance': {
          const creds = connection.credentials as { apiKey: string; apiSecret: string };
          const testnet = connection.account_type === 'demo';
          const result = await validateBinanceCredentials(creds.apiKey, creds.apiSecret, testnet);
          // Update status in DB
          await UserService.updateConnectionStatus(connection.id, result.valid ? 'connected' : 'disconnected');
          return {
            success: result.valid,
            platform: connection.platform,
            status: result.valid ? 'connected' : 'failed',
            message: result.valid ? 'API credentials valid!' : result.error,
            canTrade: result.canTrade,
          };
        }

        case 'binaryfaster': {
          const credsBF = connection.credentials as { email: string; password: string };
          const resultBF = await validateBinaryFasterCredentials(credsBF.email, credsBF.password);
          // Update status in DB
          await UserService.updateConnectionStatus(connection.id, resultBF.valid ? 'connected' : 'disconnected');
          return {
            success: resultBF.valid,
            platform: connection.platform,
            status: resultBF.valid ? 'connected' : 'failed',
            message: resultBF.valid ? `Connected! Balance: $${resultBF.balance?.toFixed(2)}` : resultBF.error,
            balance: resultBF.balance,
          };
        }

        case 'bybit': {
          const creds = connection.credentials as { apiKey: string; apiSecret: string };
          const testnet = connection.account_type === 'demo';
          const result = await validateBybitCredentials(creds.apiKey, creds.apiSecret, testnet);
          return {
            success: result.valid,
            platform: connection.platform,
            status: result.valid ? 'connected' : 'failed',
            message: result.valid ? 'API credentials valid!' : result.error,
          };
        }

        case 'ctrader': {
          const creds = connection.credentials as { accessToken: string };
          const demo = connection.account_type === 'demo';
          const result = await validateCTraderCredentials(creds.accessToken, demo);
          return {
            success: result.valid,
            platform: connection.platform,
            status: result.valid ? 'connected' : 'failed',
            message: result.valid ? 'cTrader connection valid!' : result.error,
            accounts: result.accounts,
          };
        }

        case 'ibkr': {
          const creds = connection.credentials as { host?: string; account?: string };
          const result = await validateIBKRConnection(creds.host, creds.account);
          return {
            success: result.valid,
            platform: connection.platform,
            status: result.valid ? 'connected' : 'failed',
            message: result.valid ? 'Connected to IB Gateway!' : result.error,
            accounts: result.accounts,
          };
        }

        case 'tradelocker': {
          const creds = connection.credentials as { email: string; password: string };
          const demo = connection.account_type === 'demo';
          const result = await validateTradeLockerCredentials(creds.email, creds.password, demo);
          return {
            success: result.valid,
            platform: connection.platform,
            status: result.valid ? 'connected' : 'failed',
            message: result.valid ? 'TradeLocker connection valid!' : result.error,
            accounts: result.accounts,
          };
        }
        
        case 'mt4':
        case 'mt5':
          // MT4/MT5 requires local K.I.T. bot to test
          return {
            success: true,
            platform: connection.platform,
            status: 'pending',
            message: 'MT4/MT5 connection requires K.I.T. bot running locally. Credentials saved.',
          };

        case 'tradingview':
          return {
            success: true,
            platform: connection.platform,
            status: 'ready',
            message: 'TradingView webhook ready. Use the webhook URL in your alerts.',
          };

        default:
          return {
            success: true,
            platform: connection.platform,
            status: 'saved',
            message: `${connection.platform} credentials saved. Integration coming soon.`,
          };
      }
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  /**
   * POST /api/connections/:id/sync
   * Sync trades from a platform connection
   */
  fastify.post('/:id/sync', {
    schema: {
      description: 'Sync trades from a platform connection',
      tags: ['Connections'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { userId?: string };
      
      if (!user.userId) {
        return reply.status(401).send({ error: 'User ID not found in token' });
      }

      const connection = await UserService.getConnectionWithCredentials(request.params.id, user.userId);
      
      if (!connection) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      // Sync based on platform
      switch (connection.platform) {
        case 'binance': {
          const credsBinance = connection.credentials as { apiKey: string; apiSecret: string };
          const testnetBinance = connection.account_type === 'demo';
          const resultBinance = await fetchBinanceTrades(credsBinance.apiKey, credsBinance.apiSecret, testnetBinance);
          
          if (!resultBinance.success) {
            return reply.status(400).send({ error: resultBinance.error });
          }

          await UserService.updateLastSync(connection.id);

          return {
            success: true,
            platform: 'binance',
            tradesFound: resultBinance.trades?.length || 0,
            trades: resultBinance.trades,
            message: `Found ${resultBinance.trades?.length || 0} trades from Binance`,
          };
        }

        case 'binaryfaster': {
          const credsBF = connection.credentials as { email: string; password: string };
          const resultBF = await fetchBinaryFasterTrades(credsBF.email, credsBF.password);
          
          if (!resultBF.success) {
            return reply.status(400).send({ error: resultBF.error });
          }

          // Find or create linked journal account
          const accounts = await JournalService.getAccounts(user.userId!);
          let linkedAccount = accounts.find(a => 
            a.connection_id === connection.id || 
            a.broker?.toLowerCase().includes('binaryfaster') ||
            a.name?.toLowerCase().includes('binaryfaster')
          );
          
          // Always update balance if we have an account - even without trades
          if (linkedAccount && resultBF.balance) {
            await JournalService.updateAccountBalance(linkedAccount.id, resultBF.balance.real);
            // Link connection_id if not already set
            if (!linkedAccount.connection_id) {
              await JournalService.linkAccountToConnection(linkedAccount.id, connection.id);
            }
          }

          // Import trades if we have them and have a linked account
          let importedCount = 0;
          let importErrors: string[] = [];
          console.log('[BinaryFaster Sync] Starting import for account:', linkedAccount?.id);
          console.log('[BinaryFaster Sync] Trades to import:', resultBF.trades?.length || 0);
          
          if (linkedAccount && resultBF.trades && resultBF.trades.length > 0) {
            for (const trade of resultBF.trades) {
              try {
                // Normalize direction to UPPERCASE (DB expects 'LONG' | 'SHORT')
                const normalizedDirection = (trade.direction || 'long').toUpperCase() as 'LONG' | 'SHORT';
                
                console.log('[BinaryFaster Sync] Importing trade:', trade.symbol, normalizedDirection, trade.entry_price);
                
                const entryResult = await JournalService.createEntry(user.userId!, {
                  account_id: linkedAccount.id,
                  symbol: trade.symbol,
                  direction: normalizedDirection,
                  entry_time: trade.entry_date,
                  entry_price: trade.entry_price,
                  exit_time: trade.entry_date, // Binary options close immediately
                  exit_price: trade.exit_price || trade.entry_price,
                  quantity: trade.quantity,
                  pnl: trade.pnl,
                  status: 'closed',
                  source: 'binaryfaster',
                  notes: trade.notes,
                  setup: trade.setup,
                });
                if (entryResult) {
                  importedCount++;
                  console.log('[BinaryFaster Sync] Trade imported successfully:', entryResult.id);
                } else {
                  console.error('[BinaryFaster Sync] createEntry returned null for trade:', trade.symbol);
                  importErrors.push(`Failed to import ${trade.symbol}: createEntry returned null`);
                }
              } catch (e: any) {
                // Skip duplicates or errors
                console.error('[BinaryFaster Sync] Error importing trade:', e.message || e);
                importErrors.push(`${trade.symbol}: ${e.message || String(e)}`);
              }
            }
          }

          await UserService.updateLastSync(connection.id);

          return {
            success: true,
            platform: 'binaryfaster',
            tradesFound: resultBF.trades?.length || 0,
            tradesImported: importedCount,
            importErrors: importErrors.slice(0, 10), // Return first 10 errors
            trades: resultBF.trades,
            balance: resultBF.balance,
            message: `Found ${resultBF.trades?.length || 0} trades, imported ${importedCount} from BinaryFaster`,
          };
        }

        case 'bybit': {
          const credsBybit = connection.credentials as { apiKey: string; apiSecret: string };
          const testnetBybit = connection.account_type === 'demo';
          const resultBybit = await fetchBybitTrades(credsBybit.apiKey, credsBybit.apiSecret, testnetBybit);
          
          if (!resultBybit.success) {
            return reply.status(400).send({ error: resultBybit.error });
          }

          await UserService.updateLastSync(connection.id);

          return {
            success: true,
            platform: 'bybit',
            tradesFound: resultBybit.trades?.length || 0,
            trades: resultBybit.trades,
            message: `Found ${resultBybit.trades?.length || 0} trades from Bybit`,
          };
        }

        case 'ctrader': {
          const credsCtrader = connection.credentials as { accessToken: string; accountId?: string };
          const demoCtrader = connection.account_type === 'demo';
          
          if (!credsCtrader.accountId) {
            return reply.status(400).send({ error: 'cTrader account ID required. Please test connection first to get accounts.' });
          }
          
          const resultCtrader = await fetchCTraderTrades(credsCtrader.accessToken, credsCtrader.accountId, demoCtrader);
          
          if (!resultCtrader.success) {
            return reply.status(400).send({ error: resultCtrader.error });
          }

          await UserService.updateLastSync(connection.id);

          return {
            success: true,
            platform: 'ctrader',
            tradesFound: resultCtrader.trades?.length || 0,
            trades: resultCtrader.trades,
            message: `Found ${resultCtrader.trades?.length || 0} trades from cTrader`,
          };
        }

        case 'ibkr': {
          const credsIbkr = connection.credentials as { host?: string; account?: string };
          const resultIbkr = await fetchIBKRTrades(credsIbkr.host, credsIbkr.account);
          
          if (!resultIbkr.success) {
            return reply.status(400).send({ error: resultIbkr.error });
          }

          await UserService.updateLastSync(connection.id);

          return {
            success: true,
            platform: 'ibkr',
            tradesFound: resultIbkr.trades?.length || 0,
            trades: resultIbkr.trades,
            message: `Found ${resultIbkr.trades?.length || 0} trades from IBKR`,
          };
        }

        case 'tradelocker': {
          const credsTL = connection.credentials as { email: string; password: string; accountId?: string };
          const demoTL = connection.account_type === 'demo';
          
          if (!credsTL.accountId) {
            return reply.status(400).send({ error: 'TradeLocker account ID required. Please test connection first to get accounts.' });
          }
          
          const resultTL = await fetchTradeLockerTrades(credsTL.email, credsTL.password, credsTL.accountId, demoTL);
          
          if (!resultTL.success) {
            return reply.status(400).send({ error: resultTL.error });
          }

          await UserService.updateLastSync(connection.id);

          return {
            success: true,
            platform: 'tradelocker',
            tradesFound: resultTL.trades?.length || 0,
            trades: resultTL.trades,
            message: `Found ${resultTL.trades?.length || 0} trades from TradeLocker`,
          };
        }

        case 'mt4':
        case 'mt5':
          return {
            success: false,
            platform: connection.platform,
            message: 'MT4/MT5 sync requires K.I.T. bot running locally with mt5_history tool',
          };

        case 'tradingview':
          return {
            success: true,
            platform: connection.platform,
            message: 'TradingView syncs automatically via webhooks. No manual sync needed.',
            tradesFound: 0,
            trades: [],
          };

        default:
          return {
            success: false,
            platform: connection.platform,
            message: `${connection.platform} sync not yet implemented`,
          };
      }
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Sync failed' });
    }
  });

  /**
   * PATCH /api/connections/:id
   * Update connection settings (auto-sync, etc.)
   */
  fastify.patch('/:id', {
    schema: {
      description: 'Update connection settings',
      tags: ['Connections'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          auto_sync: { type: 'boolean' },
          sync_interval_minutes: { type: 'number' },
        },
      },
    },
  }, async (request: FastifyRequest<{ 
    Params: { id: string },
    Body: { auto_sync?: boolean; sync_interval_minutes?: number }
  }>, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      const user = request.user as { userId?: string };
      
      if (!user.userId) {
        return reply.status(401).send({ error: 'User ID not found in token' });
      }

      const { auto_sync, sync_interval_minutes } = request.body;

      const success = await UserService.updateAutoSyncSettings(
        request.params.id,
        user.userId,
        auto_sync ?? true,
        sync_interval_minutes
      );

      if (!success) {
        return reply.status(404).send({ error: 'Connection not found' });
      }

      return { success: true, message: 'Settings updated' };
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });

  /**
   * POST /api/connections/sync-all
   * Sync all connections with auto-sync enabled (for cron/scheduled sync)
   */
  fastify.post('/sync-all', {
    schema: {
      description: 'Sync all connections with auto-sync enabled',
      tags: ['Connections'],
      querystring: {
        type: 'object',
        properties: {
          force: { type: 'boolean', description: 'Force sync regardless of time window' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Querystring: { force?: boolean } }>, reply: FastifyReply) => {
    try {
      const force = request.query.force === true || (request.query.force as any) === 'true';
      const connections = await UserService.getConnectionsForAutoSync(force);
      const results: any[] = [];

      for (const connection of connections) {
        try {
          let syncResult: any = { id: connection.id, platform: connection.platform };

          switch (connection.platform) {
            case 'binaryfaster': {
              const creds = connection.credentials as { email: string; password: string };
              const result = await fetchBinaryFasterTrades(creds.email, creds.password);
              await UserService.updateLastSync(connection.id);
              await UserService.updateConnectionStatus(connection.id, result.success ? 'connected' : 'error');
              syncResult.success = result.success;
              syncResult.tradesFound = result.trades?.length || 0;

              // Also update journal account balance and import trades (like :id/sync does)
              if (result.success && connection.user_id) {
                const accounts = await JournalService.getAccounts(connection.user_id);
                let linkedAccount = accounts.find(a => 
                  a.connection_id === connection.id || 
                  a.broker?.toLowerCase().includes('binaryfaster') ||
                  a.name?.toLowerCase().includes('binaryfaster')
                );

                // Update balance if we have an account
                if (linkedAccount && result.balance) {
                  await JournalService.updateAccountBalance(linkedAccount.id, result.balance.real);
                  syncResult.balanceUpdated = result.balance.real;
                  // Link connection_id if not already set
                  if (!linkedAccount.connection_id) {
                    await JournalService.linkAccountToConnection(linkedAccount.id, connection.id);
                  }
                }

                // Import trades if we have them and have a linked account
                let importedCount = 0;
                if (linkedAccount && result.trades && result.trades.length > 0) {
                  for (const trade of result.trades) {
                    try {
                      await JournalService.createEntry(connection.user_id, {
                        account_id: linkedAccount.id,
                        symbol: trade.symbol,
                        direction: trade.direction?.toUpperCase() === 'LONG' ? 'LONG' : 'SHORT',
                        entry_time: trade.entry_date,
                        entry_price: trade.entry_price,
                        exit_time: trade.entry_date,
                        exit_price: trade.exit_price || trade.entry_price,
                        quantity: trade.quantity,
                        pnl: trade.pnl,
                        status: 'closed',
                        source: 'binaryfaster',
                        notes: trade.notes,
                        setup: trade.setup,
                      });
                      importedCount++;
                    } catch (e) {
                      // Skip duplicates or errors
                    }
                  }
                  syncResult.tradesImported = importedCount;
                }
              }
              break;
            }
            case 'binance': {
              const creds = connection.credentials as { apiKey: string; apiSecret: string };
              const testnet = connection.account_type === 'demo';
              const result = await fetchBinanceTrades(creds.apiKey, creds.apiSecret, testnet);
              await UserService.updateLastSync(connection.id);
              await UserService.updateConnectionStatus(connection.id, result.success ? 'connected' : 'error');
              syncResult.success = result.success;
              syncResult.tradesFound = result.trades?.length || 0;
              break;
            }
            case 'bybit': {
              const creds = connection.credentials as { apiKey: string; apiSecret: string };
              const testnet = connection.account_type === 'demo';
              const result = await fetchBybitTrades(creds.apiKey, creds.apiSecret, testnet);
              await UserService.updateLastSync(connection.id);
              await UserService.updateConnectionStatus(connection.id, result.success ? 'connected' : 'error');
              syncResult.success = result.success;
              syncResult.tradesFound = result.trades?.length || 0;
              break;
            }
            default:
              syncResult.success = false;
              syncResult.message = 'Auto-sync not supported for this platform';
          }

          results.push(syncResult);
        } catch (err: any) {
          await UserService.updateConnectionStatus(connection.id, 'error');
          results.push({ id: connection.id, platform: connection.platform, success: false, error: err.message });
        }
      }

      return {
        success: true,
        synced: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        results,
      };
    } catch (err: any) {
      return reply.status(500).send({ error: err.message || 'Sync-all failed' });
    }
  });
}
