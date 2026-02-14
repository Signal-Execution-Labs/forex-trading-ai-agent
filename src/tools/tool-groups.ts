/**
 * K.I.T. Tool Groups (Shorthands)
 * 
 * OpenClaw-compatible tool groups for easier policy configuration.
 * Use `group:*` entries in tool policies that expand to multiple concrete tools.
 * 
 * Example:
 *   tools.deny: ["group:runtime"]  // Denies exec, bash, process
 *   tools.allow: ["group:trading"] // Allows all trading tools
 */

/**
 * Tool group definitions
 * Each group maps to an array of concrete tool names
 */
export const TOOL_GROUPS: Record<string, string[]> = {
  // Runtime/execution tools
  'runtime': ['exec', 'bash', 'process', 'shell'],
  
  // File system tools
  'fs': ['read', 'write', 'edit', 'apply_patch', 'file_read', 'file_write'],
  
  // Session management tools
  'sessions': [
    'sessions_list', 
    'sessions_history', 
    'sessions_send', 
    'sessions_spawn', 
    'session_status'
  ],
  
  // Memory tools
  'memory': ['memory_search', 'memory_get', 'memory_write'],
  
  // UI/Browser tools
  'ui': ['browser', 'canvas', 'screenshot', 'tui'],
  
  // Automation tools
  'automation': ['cron', 'gateway', 'scheduler', 'task_schedule'],
  
  // Messaging/notification tools
  'messaging': [
    'message', 
    'telegram_send', 
    'discord_send', 
    'whatsapp_send',
    'email_send',
    'notify'
  ],
  
  // Node/device tools
  'nodes': ['nodes', 'device_list', 'device_control'],
  
  // All K.I.T. built-in tools (excludes provider plugins)
  'kit': [
    'read', 'write', 'edit', 'exec', 'process',
    'sessions_list', 'sessions_history', 'sessions_send', 'sessions_spawn', 'session_status',
    'memory_search', 'memory_get',
    'browser', 'canvas',
    'cron', 'gateway',
    'message'
  ],
  
  // ═══════════════════════════════════════════════════════════════
  // K.I.T. TRADING-SPECIFIC GROUPS
  // ═══════════════════════════════════════════════════════════════
  
  // Core trading tools
  'trading': [
    'trading_create',
    'trading_start',
    'trading_stop',
    'trading_list',
    'trading_status',
    'trading_delete',
    'trading_execute',
    'trading_close',
    'trading_modify',
    'place_order',
    'cancel_order',
    'close_position',
    'modify_order'
  ],
  
  // Market analysis tools
  'analysis': [
    'market_analyze',
    'get_market_data',
    'get_price',
    'get_ohlcv',
    'technical_analysis',
    'sentiment_analysis',
    'trend_analysis',
    'support_resistance',
    'volatility_check',
    'correlation_check'
  ],
  
  // Portfolio management tools
  'portfolio': [
    'portfolio_status',
    'portfolio_balance',
    'portfolio_history',
    'portfolio_rebalance',
    'get_positions',
    'get_orders',
    'portfolio_risk'
  ],
  
  // Alert and notification tools
  'alerts': [
    'alert_create',
    'alert_list',
    'alert_delete',
    'alert_modify',
    'price_alert',
    'portfolio_alert'
  ],
  
  // Risk management tools
  'risk': [
    'risk_check',
    'risk_limits',
    'position_sizing',
    'stop_loss_calculate',
    'take_profit_calculate',
    'risk_reward_ratio',
    'max_drawdown'
  ],
  
  // Backtesting tools
  'backtest': [
    'backtest_run',
    'backtest_strategy',
    'backtest_optimize',
    'backtest_results',
    'backtest_compare'
  ],
  
  // DeFi tools
  'defi': [
    'defi_stake',
    'defi_unstake',
    'defi_lend',
    'defi_borrow',
    'defi_yield',
    'defi_swap',
    'defi_bridge',
    'liquidity_provide',
    'liquidity_remove'
  ],
  
  // Wallet/exchange tools
  'wallet': [
    'wallet_balance',
    'wallet_connect',
    'wallet_disconnect',
    'wallet_transfer',
    'exchange_connect',
    'exchange_disconnect'
  ],
  
  // Tax and reporting tools
  'tax': [
    'tax_calculate',
    'tax_report',
    'tax_lots',
    'capital_gains',
    'cost_basis'
  ],
  
  // Signal tools
  'signals': [
    'signal_create',
    'signal_list',
    'signal_copy',
    'signal_follow',
    'signal_unfollow'
  ],
  
  // News and research tools
  'research': [
    'news_fetch',
    'news_analyze',
    'sentiment_score',
    'market_news',
    'fundamental_data'
  ],
  
  // Scheduling tools
  'schedule': [
    'dca_schedule',
    'rebalance_schedule',
    'task_create',
    'task_list',
    'task_cancel'
  ],
  
  // Read-only trading tools (safe for restricted agents)
  'trading_readonly': [
    'trading_list',
    'trading_status',
    'portfolio_status',
    'portfolio_balance',
    'get_positions',
    'get_orders',
    'market_analyze',
    'get_price',
    'get_market_data'
  ],
  
  // Full trading suite (everything)
  'trading_full': [
    // Includes all trading groups
    ...new Set([
      // trading
      'trading_create', 'trading_start', 'trading_stop', 'trading_list',
      'trading_status', 'trading_delete', 'trading_execute', 'trading_close',
      'trading_modify', 'place_order', 'cancel_order', 'close_position', 'modify_order',
      // analysis
      'market_analyze', 'get_market_data', 'get_price', 'get_ohlcv',
      'technical_analysis', 'sentiment_analysis', 'trend_analysis',
      'support_resistance', 'volatility_check', 'correlation_check',
      // portfolio
      'portfolio_status', 'portfolio_balance', 'portfolio_history',
      'portfolio_rebalance', 'get_positions', 'get_orders', 'portfolio_risk',
      // alerts
      'alert_create', 'alert_list', 'alert_delete', 'alert_modify',
      'price_alert', 'portfolio_alert',
      // risk
      'risk_check', 'risk_limits', 'position_sizing',
      'stop_loss_calculate', 'take_profit_calculate',
      'risk_reward_ratio', 'max_drawdown',
      // backtest
      'backtest_run', 'backtest_strategy', 'backtest_optimize',
      'backtest_results', 'backtest_compare',
      // defi
      'defi_stake', 'defi_unstake', 'defi_lend', 'defi_borrow',
      'defi_yield', 'defi_swap', 'defi_bridge',
      'liquidity_provide', 'liquidity_remove',
      // wallet
      'wallet_balance', 'wallet_connect', 'wallet_disconnect',
      'wallet_transfer', 'exchange_connect', 'exchange_disconnect',
      // tax
      'tax_calculate', 'tax_report', 'tax_lots',
      'capital_gains', 'cost_basis',
      // signals
      'signal_create', 'signal_list', 'signal_copy',
      'signal_follow', 'signal_unfollow',
      // research
      'news_fetch', 'news_analyze', 'sentiment_score',
      'market_news', 'fundamental_data',
      // schedule
      'dca_schedule', 'rebalance_schedule',
      'task_create', 'task_list', 'task_cancel'
    ])
  ]
};

/**
 * Expand tool groups in a list of tool names
 * 
 * @param tools - Array of tool names, may include `group:*` entries
 * @returns Array with groups expanded to concrete tools
 * 
 * @example
 * expandToolGroups(['read', 'group:trading'])
 * // Returns: ['read', 'trading_create', 'trading_start', ...]
 */
export function expandToolGroups(tools: string[]): string[] {
  const expanded: Set<string> = new Set();
  
  for (const tool of tools) {
    if (tool.startsWith('group:')) {
      const groupName = tool.slice(6); // Remove 'group:' prefix
      const groupTools = TOOL_GROUPS[groupName];
      
      if (groupTools) {
        groupTools.forEach(t => expanded.add(t));
      } else {
        // Unknown group, keep as-is (may be user-defined)
        expanded.add(tool);
      }
    } else {
      expanded.add(tool);
    }
  }
  
  return Array.from(expanded);
}

/**
 * Check if a tool is in a group
 * 
 * @param tool - Tool name to check
 * @param groupName - Group name (without 'group:' prefix)
 * @returns true if tool is in the group
 */
export function isToolInGroup(tool: string, groupName: string): boolean {
  const groupTools = TOOL_GROUPS[groupName];
  return groupTools ? groupTools.includes(tool) : false;
}

/**
 * Get all groups a tool belongs to
 * 
 * @param tool - Tool name
 * @returns Array of group names
 */
export function getToolGroups(tool: string): string[] {
  return Object.entries(TOOL_GROUPS)
    .filter(([_, tools]) => tools.includes(tool))
    .map(([name]) => name);
}

/**
 * List all available tool groups
 */
export function listToolGroups(): Array<{ name: string; count: number; tools: string[] }> {
  return Object.entries(TOOL_GROUPS)
    .map(([name, tools]) => ({
      name,
      count: tools.length,
      tools: tools.slice(0, 5) // Show first 5 as preview
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Filter tools based on allow/deny policies with group expansion
 * 
 * @param availableTools - All available tools
 * @param allow - Allowed tools/groups (if empty, all allowed)
 * @param deny - Denied tools/groups
 * @returns Filtered tool list
 */
export function filterToolsByPolicy(
  availableTools: string[],
  allow: string[] = [],
  deny: string[] = []
): string[] {
  const expandedAllow = expandToolGroups(allow);
  const expandedDeny = expandToolGroups(deny);
  
  let filtered = availableTools;
  
  // If allow list is non-empty, only include those tools
  if (expandedAllow.length > 0) {
    filtered = filtered.filter(t => expandedAllow.includes(t));
  }
  
  // Remove denied tools
  if (expandedDeny.length > 0) {
    filtered = filtered.filter(t => !expandedDeny.includes(t));
  }
  
  return filtered;
}

export default {
  TOOL_GROUPS,
  expandToolGroups,
  isToolInGroup,
  getToolGroups,
  listToolGroups,
  filterToolsByPolicy
};
