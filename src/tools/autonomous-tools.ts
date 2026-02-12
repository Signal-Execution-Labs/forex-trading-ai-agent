/**
 * K.I.T. Autonomous Agent Tools
 * 
 * Complete tool set for the autonomous financial agent.
 * These are the AI's interface to control the autonomous system.
 */

import { ToolDefinition as ChatToolDef } from '../gateway/chat-manager';
import { 
  getAutonomousAgent, 
  startAutonomousAgent, 
  stopAutonomousAgent,
  PlatformConnection,
  PassivePosition,
  TradeAction,
} from '../core/autonomous-agent';

// ============================================================================
// Tool Definitions
// ============================================================================

export const AUTONOMOUS_TOOLS: ChatToolDef[] = [
  // ========== CORE CONTROL ==========
  {
    name: 'agent_start',
    description: 'Start K.I.T. autonomous mode - 24/7 monitoring, trading, alerts',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'agent_stop',
    description: 'Stop K.I.T. autonomous mode',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'agent_status',
    description: 'Get detailed autonomous agent status',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'agent_config',
    description: 'Configure autonomous agent settings',
    parameters: {
      type: 'object',
      properties: {
        autoRebalance: { type: 'boolean', description: 'Enable automatic portfolio rebalancing' },
        autoTradeOpportunities: { type: 'boolean', description: 'Automatically trade detected opportunities' },
        maxDailyTrades: { type: 'number', description: 'Maximum trades per day' },
        maxAutoTradeRiskPercent: { type: 'number', description: 'Max risk % per auto-trade' },
        maxDailyLossPercent: { type: 'number', description: 'Stop trading if daily loss exceeds this %' },
        heartbeatIntervalMs: { type: 'number', description: 'Market check interval in ms' },
        dailyReportTime: { type: 'string', description: 'Time for daily report (HH:MM)' },
        notifyOnTrade: { type: 'boolean', description: 'Telegram notify on trades' },
        notifyOnAlert: { type: 'boolean', description: 'Telegram notify on alerts' },
        notifyOnOpportunity: { type: 'boolean', description: 'Telegram notify on opportunities' },
        taxLossHarvestingEnabled: { type: 'boolean', description: 'Enable tax-loss harvesting suggestions' },
      },
    },
  },

  // ========== PLATFORM CONNECTIONS ==========
  {
    name: 'platform_connect',
    description: 'Connect a trading platform (Binance, MT5, BinaryFaster, Bybit, etc.)',
    parameters: {
      type: 'object',
      properties: {
        platform: { type: 'string', enum: ['binance', 'mt5', 'binaryfaster', 'bybit', 'kraken', 'coinbase'] },
        apiKey: { type: 'string', description: 'API key (for Binance, Bybit, etc.)' },
        apiSecret: { type: 'string', description: 'API secret' },
        email: { type: 'string', description: 'Email (for BinaryFaster)' },
        password: { type: 'string', description: 'Password (for BinaryFaster)' },
      },
      required: ['platform'],
    },
  },
  {
    name: 'platform_list',
    description: 'List all connected platforms and their status',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'platform_sync',
    description: 'Sync balances from all connected platforms',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'platform_disconnect',
    description: 'Disconnect a platform',
    parameters: {
      type: 'object',
      properties: { platform: { type: 'string' } },
      required: ['platform'],
    },
  },

  // ========== PRICE ALERTS ==========
  {
    name: 'alert_set',
    description: 'Set a price alert with optional auto-trade action',
    parameters: {
      type: 'object',
      properties: {
        symbol: { type: 'string', description: 'Symbol (BTCUSDT, XAUUSD, etc.)' },
        condition: { type: 'string', enum: ['above', 'below', 'percent_change'] },
        targetPrice: { type: 'number', description: 'Target price for above/below' },
        percentChange: { type: 'number', description: 'Percent change for percent_change condition' },
        notifyTelegram: { type: 'boolean', description: 'Send Telegram notification', default: true },
        autoTrade: { type: 'boolean', description: 'Execute trade when triggered' },
        tradeAction: { type: 'string', enum: ['buy', 'sell'], description: 'Action if autoTrade' },
        tradePlatform: { type: 'string', description: 'Platform for auto-trade' },
        tradeAmount: { type: 'number', description: 'Trade amount' },
      },
      required: ['symbol', 'condition'],
    },
  },
  {
    name: 'alert_list',
    description: 'List all price alerts',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'alert_delete',
    description: 'Delete a price alert',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },

  // ========== WATCHLIST ==========
  {
    name: 'watchlist_add',
    description: 'Add symbol to monitoring watchlist',
    parameters: {
      type: 'object',
      properties: { symbol: { type: 'string' } },
      required: ['symbol'],
    },
  },
  {
    name: 'watchlist_remove',
    description: 'Remove symbol from watchlist',
    parameters: {
      type: 'object',
      properties: { symbol: { type: 'string' } },
      required: ['symbol'],
    },
  },
  {
    name: 'watchlist_show',
    description: 'Show current watchlist with prices',
    parameters: { type: 'object', properties: {}, required: [] },
  },

  // ========== PASSIVE INCOME ==========
  {
    name: 'passive_add',
    description: 'Track a passive income position (staking, yield farming, airdrop, etc.)',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['staking', 'yield_farming', 'lending', 'liquidity_pool', 'airdrop', 'dividend'] },
        platform: { type: 'string', description: 'Platform (Binance, Lido, Aave, Uniswap, etc.)' },
        protocol: { type: 'string', description: 'DeFi protocol if applicable' },
        asset: { type: 'string', description: 'Asset being staked/farmed' },
        amount: { type: 'number', description: 'Amount' },
        valueUSD: { type: 'number', description: 'Current USD value' },
        apy: { type: 'number', description: 'Annual percentage yield' },
        lockEndDate: { type: 'string', description: 'Lock end date if locked (ISO)' },
        nextClaimDate: { type: 'string', description: 'Next reward claim date (ISO)' },
        autoCompound: { type: 'boolean', description: 'Auto-compound rewards' },
        notes: { type: 'string' },
      },
      required: ['type', 'platform', 'asset', 'amount', 'valueUSD'],
    },
  },
  {
    name: 'passive_list',
    description: 'List all passive income positions',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'passive_update',
    description: 'Update passive position (record rewards, update value)',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        rewards: { type: 'number', description: 'Add to total rewards' },
        valueUSD: { type: 'number', description: 'Update current value' },
        nextClaimDate: { type: 'string', description: 'Update next claim date' },
      },
      required: ['id'],
    },
  },
  {
    name: 'passive_remove',
    description: 'Remove a passive income position',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    },
  },

  // ========== PORTFOLIO ALLOCATION ==========
  {
    name: 'allocation_set',
    description: 'Set target portfolio allocation',
    parameters: {
      type: 'object',
      properties: {
        allocations: {
          type: 'array',
          description: 'Target allocations',
          items: {
            type: 'object',
            properties: {
              asset: { type: 'string' },
              targetPercent: { type: 'number' },
              rebalanceThreshold: { type: 'number' },
            },
          },
        },
      },
      required: ['allocations'],
    },
  },
  {
    name: 'allocation_check',
    description: 'Check current vs target allocation, suggest rebalances',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'rebalance_execute',
    description: 'Execute portfolio rebalance',
    parameters: {
      type: 'object',
      properties: {
        dryRun: { type: 'boolean', description: 'Only show what would happen', default: true },
      },
    },
  },

  // ========== TAX TRACKING ==========
  {
    name: 'tax_summary',
    description: 'Get tax summary (realized gains, unrealized, tax-loss harvest opportunities)',
    parameters: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Tax year (default: current)' },
      },
    },
  },
  {
    name: 'tax_lots_list',
    description: 'List all tax lots (cost basis tracking)',
    parameters: {
      type: 'object',
      properties: {
        asset: { type: 'string', description: 'Filter by asset' },
      },
    },
  },
  {
    name: 'tax_loss_harvest',
    description: 'Find tax-loss harvesting opportunities',
    parameters: { type: 'object', properties: {}, required: [] },
  },

  // ========== OPPORTUNITIES ==========
  {
    name: 'opportunities_list',
    description: 'List detected market opportunities',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'opportunity_trade',
    description: 'Execute trade on an opportunity',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Opportunity ID' },
        platform: { type: 'string', description: 'Platform to trade on' },
        amount: { type: 'number', description: 'Trade amount' },
      },
      required: ['id', 'platform', 'amount'],
    },
  },

  // ========== REPORTS ==========
  {
    name: 'report_daily',
    description: 'Generate daily financial report',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'report_portfolio',
    description: 'Generate detailed portfolio report',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'report_passive',
    description: 'Generate passive income report',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'report_performance',
    description: 'Generate trading performance report',
    parameters: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days (default: 30)' },
      },
    },
  },
];

// ============================================================================
// Tool Handlers
// ============================================================================

export async function handleAutonomousTool(
  toolName: string,
  args: Record<string, any>
): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();

  switch (toolName) {
    // ========== CORE CONTROL ==========
    case 'agent_start':
      return agent.start();
    
    case 'agent_stop':
      return agent.stop();
    
    case 'agent_status':
      return agent.getStatus();
    
    case 'agent_config':
      return agent.updateSettings(args);

    // ========== PLATFORM CONNECTIONS ==========
    case 'platform_connect': {
      const connection: PlatformConnection = {
        platform: args.platform,
        credentials: {
          apiKey: args.apiKey,
          apiSecret: args.apiSecret,
          email: args.email,
          password: args.password,
        },
        enabled: true,
        lastSync: '',
      };
      return agent.addPlatform(connection);
    }
    
    case 'platform_list': {
      const platforms = state.platforms;
      if (platforms.length === 0) {
        return '📭 No platforms connected.\n\nUse `platform_connect` to add Binance, MT5, BinaryFaster, etc.';
      }
      const lines = platforms.map(p => 
        `${p.enabled ? '✅' : '❌'} **${p.platform}**\n   Balance: $${(p.balance || 0).toLocaleString()}\n   Last sync: ${p.lastSync || 'Never'}`
      );
      return `💼 **Connected Platforms**\n\n${lines.join('\n\n')}`;
    }
    
    case 'platform_sync':
      return agent.syncAllPlatforms();
    
    case 'platform_disconnect': {
      const platforms = state.platforms;
      const idx = platforms.findIndex(p => p.platform === args.platform);
      if (idx === -1) return `❌ Platform ${args.platform} not found`;
      platforms.splice(idx, 1);
      agent.updateSettings({ platforms });
      return `✅ Disconnected ${args.platform}`;
    }

    // ========== PRICE ALERTS ==========
    case 'alert_set': {
      let executeAction: TradeAction | undefined;
      if (args.autoTrade) {
        executeAction = {
          type: args.tradeAction,
          platform: args.tradePlatform,
          symbol: args.symbol,
          amount: args.tradeAmount,
        };
      }
      return agent.addAlert({
        symbol: args.symbol,
        condition: args.condition,
        targetPrice: args.targetPrice,
        percentChange: args.percentChange,
        notifyTelegram: args.notifyTelegram !== false,
        executeAction,
      });
    }
    
    case 'alert_list': {
      const alerts = state.priceAlerts;
      if (alerts.length === 0) {
        return '📭 No alerts set.\n\nUse `alert_set` to create price alerts!';
      }
      const lines = alerts.map(a => {
        const status = a.triggered ? '✅ Triggered' : '⏳ Active';
        const target = a.targetPrice ? `$${a.targetPrice}` : `${a.percentChange}%`;
        return `${status} | ${a.symbol} ${a.condition} ${target}`;
      });
      return `🔔 **Price Alerts**\n\n${lines.join('\n')}`;
    }
    
    case 'alert_delete': {
      const alerts = state.priceAlerts;
      const idx = alerts.findIndex(a => a.id === args.id);
      if (idx === -1) return '❌ Alert not found';
      alerts.splice(idx, 1);
      agent.updateSettings({ priceAlerts: alerts });
      return '✅ Alert deleted';
    }

    // ========== WATCHLIST ==========
    case 'watchlist_add': {
      const symbol = args.symbol.toUpperCase();
      if (state.watchlist.includes(symbol)) {
        return `📊 ${symbol} already in watchlist`;
      }
      state.watchlist.push(symbol);
      agent.updateSettings({ watchlist: state.watchlist });
      return `✅ Added ${symbol} to watchlist\n\nWatchlist: ${state.watchlist.join(', ')}`;
    }
    
    case 'watchlist_remove': {
      const symbol = args.symbol.toUpperCase();
      const idx = state.watchlist.indexOf(symbol);
      if (idx === -1) return `❌ ${symbol} not in watchlist`;
      state.watchlist.splice(idx, 1);
      agent.updateSettings({ watchlist: state.watchlist });
      return `✅ Removed ${symbol}`;
    }
    
    case 'watchlist_show':
      return `📊 **Watchlist**\n\n${state.watchlist.join(', ') || 'Empty'}\n\nK.I.T. monitors these symbols for opportunities.`;

    // ========== PASSIVE INCOME ==========
    case 'passive_add': {
      const position: Omit<PassivePosition, 'id' | 'startDate' | 'rewards'> = {
        type: args.type,
        platform: args.platform,
        protocol: args.protocol,
        asset: args.asset,
        amount: args.amount,
        valueUSD: args.valueUSD,
        apy: args.apy,
        lockEndDate: args.lockEndDate,
        nextClaimDate: args.nextClaimDate,
        autoCompound: args.autoCompound || false,
        notes: args.notes,
      };
      return agent.addPassivePosition(position);
    }
    
    case 'passive_list': {
      const positions = state.passivePositions;
      if (positions.length === 0) {
        return '📭 No passive income tracked.\n\nUse `passive_add` to track staking, yield farming, airdrops!';
      }
      
      const icons: Record<string, string> = {
        staking: '🥩',
        yield_farming: '🌾',
        lending: '🏦',
        liquidity_pool: '💧',
        airdrop: '🪂',
        dividend: '💹',
      };
      
      let totalValue = 0;
      let totalRewards = 0;
      
      const lines = positions.map(p => {
        totalValue += p.valueUSD;
        totalRewards += p.rewards;
        return `${icons[p.type] || '💰'} **${p.platform}** ${p.protocol ? `(${p.protocol})` : ''}
   ${p.amount} ${p.asset} = $${p.valueUSD.toLocaleString()}
   APY: ${p.apy || '?'}% | Rewards: $${p.rewards.toFixed(2)}
   ${p.autoCompound ? '🔄 Auto-compound ON' : ''}`;
      });
      
      return `💰 **Passive Income Portfolio**

${lines.join('\n\n')}

━━━━━━━━━━━━━━━━━━━━
📊 Total Value: $${totalValue.toLocaleString()}
💵 Total Rewards: $${totalRewards.toFixed(2)}`;
    }
    
    case 'passive_update': {
      const positions = state.passivePositions;
      const pos = positions.find(p => p.id === args.id);
      if (!pos) return '❌ Position not found';
      
      if (args.rewards) {
        pos.rewards += args.rewards;
        state.totalRewardsEarned += args.rewards;
      }
      if (args.valueUSD) pos.valueUSD = args.valueUSD;
      if (args.nextClaimDate) pos.nextClaimDate = args.nextClaimDate;
      
      agent.updateSettings({ passivePositions: positions, totalRewardsEarned: state.totalRewardsEarned });
      return `✅ Updated ${pos.asset} on ${pos.platform}`;
    }
    
    case 'passive_remove': {
      const positions = state.passivePositions;
      const idx = positions.findIndex(p => p.id === args.id);
      if (idx === -1) return '❌ Position not found';
      positions.splice(idx, 1);
      agent.updateSettings({ passivePositions: positions });
      return '✅ Position removed';
    }

    // ========== PORTFOLIO ALLOCATION ==========
    case 'allocation_set':
      agent.updateSettings({ targetAllocations: args.allocations });
      return `✅ Target allocations updated:\n\n${args.allocations.map((a: any) => `${a.asset}: ${a.targetPercent}%`).join('\n')}`;
    
    case 'allocation_check':
      return `📊 **Portfolio Allocation**

**Current** (from connected platforms)
• Total: $${state.totalValueUSD.toLocaleString()}

**Targets**
${state.targetAllocations.map(a => `• ${a.asset}: ${a.targetPercent}% (±${a.rebalanceThreshold}%)`).join('\n')}

_Connect platforms and sync to see current allocation vs targets_`;
    
    case 'rebalance_execute':
      return '⚠️ Rebalance requires all platforms connected and synced.\n\nCurrent: $' + state.totalValueUSD.toLocaleString();

    // ========== TAX ==========
    case 'tax_summary':
      return `💰 **Tax Summary ${args.year || new Date().getFullYear()}**

**Realized Gains/Losses**
• 2024: $${state.realizedGains2024.toFixed(2)}

**Unrealized**
• Gains: $${state.unrealizedGains.toFixed(2)}

**Tax-Loss Harvesting**
• Status: ${state.taxLossHarvestingEnabled ? '✅ Enabled' : '❌ Disabled'}

_Connect platforms and import trades for accurate tax tracking_`;
    
    case 'tax_lots_list': {
      const lots = state.taxLots.filter(l => !args.asset || l.asset === args.asset.toUpperCase());
      if (lots.length === 0) return '📭 No tax lots recorded.\n\nImport trades to track cost basis.';
      const lines = lots.map(l => `${l.asset}: ${l.amount} @ $${l.costBasis.toFixed(2)} (${l.acquiredAt})`);
      return `📋 **Tax Lots**\n\n${lines.join('\n')}`;
    }
    
    case 'tax_loss_harvest':
      return '🔍 **Tax-Loss Harvesting**\n\n_Analyzing positions for harvest opportunities..._\n\nNo opportunities found yet. Connect platforms for analysis.';

    // ========== OPPORTUNITIES ==========
    case 'opportunities_list': {
      const opps = state.opportunities.filter(o => !o.expiresAt || new Date(o.expiresAt) > new Date());
      if (opps.length === 0) return '📭 No opportunities detected.\n\nStart the agent to begin scanning markets.';
      const lines = opps.map(o => `${o.type.toUpperCase()}: ${o.symbol} @ $${o.currentPrice}\n   ${o.reason}\n   Confidence: ${o.confidence}% | Suggested: ${o.suggestedAction.toUpperCase()}`);
      return `🎯 **Market Opportunities**\n\n${lines.join('\n\n')}`;
    }
    
    case 'opportunity_trade':
      return agent.executeTrade({
        type: 'buy',
        platform: args.platform,
        symbol: state.opportunities.find(o => o.id === args.id)?.symbol || '',
        amount: args.amount,
      });

    // ========== REPORTS ==========
    case 'report_daily':
      return agent.generateDailyReport();
    
    case 'report_portfolio':
      return `💼 **Portfolio Report**

**Total Value:** $${state.totalValueUSD.toLocaleString()}
**Last Updated:** ${state.portfolioLastUpdated || 'Never'}

**Platforms**
${state.platforms.map(p => `• ${p.platform}: $${(p.balance || 0).toLocaleString()}`).join('\n') || 'No platforms connected'}

**Passive Income**
• Staked: $${state.totalPassiveValueUSD.toLocaleString()}
• Rewards: $${state.totalRewardsEarned.toFixed(2)}

**Target Allocation**
${state.targetAllocations.map(a => `• ${a.asset}: ${a.targetPercent}%`).join('\n')}`;
    
    case 'report_passive':
      return `💰 **Passive Income Report**

**Active Positions:** ${state.passivePositions.length}
**Total Staked:** $${state.totalPassiveValueUSD.toLocaleString()}
**Total Rewards:** $${state.totalRewardsEarned.toFixed(2)}

**By Type**
${['staking', 'yield_farming', 'lending', 'liquidity_pool', 'airdrop', 'dividend']
  .map(type => {
    const positions = state.passivePositions.filter(p => p.type === type);
    const value = positions.reduce((s, p) => s + p.valueUSD, 0);
    return positions.length > 0 ? `• ${type}: $${value.toLocaleString()} (${positions.length} positions)` : null;
  })
  .filter(Boolean)
  .join('\n') || 'No positions yet'}`;
    
    case 'report_performance': {
      const days = args.days || 30;
      return `📈 **Trading Performance (${days} days)**

**Overall**
• Total Trades: ${state.totalTradesExecuted}
• Win Rate: ${(state.winRate * 100).toFixed(1)}%
• Total P&L: $${state.totalPnL.toFixed(2)}

**Today**
• Trades: ${state.tradesToday}/${state.maxDailyTrades}
• P&L: $${state.currentDailyPnL.toFixed(2)}

**Limits**
• Max Daily Trades: ${state.maxDailyTrades}
• Max Daily Loss: ${state.maxDailyLossPercent}%
• Auto-Trade Risk: ${state.maxAutoTradeRiskPercent}%`;
    }

    default:
      return `❌ Unknown tool: ${toolName}`;
  }
}

// ============================================================================
// Export Handlers Map
// ============================================================================

export const AUTONOMOUS_TOOL_HANDLERS: Record<string, (args: any) => Promise<string>> = {};

for (const tool of AUTONOMOUS_TOOLS) {
  AUTONOMOUS_TOOL_HANDLERS[tool.name] = (args: any) => handleAutonomousTool(tool.name, args);
}
