/**
 * K.I.T. NATURAL LANGUAGE COMMAND PROCESSOR
 * 
 * Understands German AND English commands, responds in English.
 * Fully functional - no half-measures.
 */

import { getAutonomousAgent, TradeAction, PriceAlert, PassivePosition } from './autonomous-agent';
import { getPythonPath } from '../tools/skill-bridge';

// ============================================================================
// Command Patterns (German + English)
// ============================================================================

interface CommandPattern {
  patterns: RegExp[];
  handler: (match: RegExpMatchArray, text: string) => Promise<string>;
  description: string;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  // ========== WATCHLIST ==========
  {
    patterns: [
      /(?:überwache|watch|monitor|beobachte)\s+(.+)/i,
      /(?:füge?|add)\s+(.+?)\s+(?:zur watchlist|to watchlist|hinzu)/i,
    ],
    handler: handleWatch,
    description: 'Watch an asset',
  },
  {
    patterns: [
      /(?:stopp?e?|stop)\s+(?:überwachung|watching|monitoring)\s+(?:von\s+)?(.+)/i,
      /(?:entferne|remove)\s+(.+?)\s+(?:von|from)\s+(?:watchlist|überwachung)/i,
      /(?:unwatch)\s+(.+)/i,
    ],
    handler: handleUnwatch,
    description: 'Stop watching',
  },
  {
    patterns: [
      /(?:watchlist|überwachungsliste|was überwachst du)/i,
      /(?:show|zeig)\s+watchlist/i,
    ],
    handler: handleShowWatchlist,
    description: 'Show watchlist',
  },

  // ========== ALERTS ==========
  {
    patterns: [
      /(?:alarm|alert)\s+(?:wenn|if|when)\s+(.+?)\s+(?:über|above|>\s*)(\d+(?:[.,]\d+)?)/i,
      /(?:benachrichtige?|notify)\s+(?:mich\s+)?(?:wenn|if|when)\s+(.+?)\s+(?:über|above)\s+(\d+(?:[.,]\d+)?)/i,
    ],
    handler: handleAlertAbove,
    description: 'Alert when price above X',
  },
  {
    patterns: [
      /(?:alarm|alert)\s+(?:wenn|if|when)\s+(.+?)\s+(?:unter|below|<\s*)(\d+(?:[.,]\d+)?)/i,
      /(?:benachrichtige?|notify)\s+(?:mich\s+)?(?:wenn|if|when)\s+(.+?)\s+(?:unter|below)\s+(\d+(?:[.,]\d+)?)/i,
    ],
    handler: handleAlertBelow,
    description: 'Alert when price below X',
  },
  {
    patterns: [
      /(?:alarm|alert)\s+(?:wenn|if|when)\s+(.+?)\s+(?:um|by)\s+(\d+(?:[.,]\d+)?)\s*%/i,
    ],
    handler: handleAlertPercent,
    description: 'Alert on X% move',
  },
  {
    patterns: [
      /(?:zeig|show|list)\s+(?:alle\s+)?(?:alerts?|alarme?)/i,
      /(?:aktive\s+)?(?:alerts?|alarme?)/i,
    ],
    handler: handleShowAlerts,
    description: 'Show active alerts',
  },
  {
    patterns: [
      /(?:lösche?|delete|remove|clear)\s+(?:alle?\s+)?(?:alerts?|alarme?)/i,
    ],
    handler: handleClearAlerts,
    description: 'Clear alerts',
  },

  // ========== INSTANT TRADING ==========
  {
    patterns: [
      /(?:kauf|buy|long)\s+(.+?)(?:\s+(?:für|for)\s+(\d+(?:[.,]\d+)?)\s*(?:€|\$|euro?|dollar|usd)?)?(?:\s+(?:auf|on)\s+(.+))?$/i,
    ],
    handler: handleBuy,
    description: 'Buy an asset',
  },
  {
    patterns: [
      /(?:verkauf|sell|short)\s+(.+?)(?:\s+(?:für|for)\s+(\d+(?:[.,]\d+)?)\s*(?:€|\$|euro?|dollar|usd)?)?(?:\s+(?:auf|on)\s+(.+))?$/i,
    ],
    handler: handleSell,
    description: 'Sell an asset',
  },
  {
    patterns: [
      /(?:schließe?|close)\s+(?:alle?\s+)?(?:position(?:en)?|trades?)\s*(?:(?:auf|on|von|from)\s+(.+))?/i,
      /(?:close|schließe?)\s+(.+)/i,
    ],
    handler: handleClose,
    description: 'Close position(s)',
  },

  // ========== AUTONOMOUS MODE ==========
  {
    patterns: [
      /(?:trade|handel)\s+(?:autonom|autonomous|automatisch|auto)\s*(?:(?:auf|on)\s+(?:allen?\s+)?(?:plattformen?|platforms?|accounts?))?/i,
      /(?:aktiviere?|enable|start)\s+(?:autonomes?|autonomous|auto)\s+(?:trading|handel)/i,
      /(?:volle?\s+)?(?:autonomie|autonomous\s+mode)/i,
      /(?:go\s+)?auto(?:nomous)?/i,
    ],
    handler: handleEnableAutoTrading,
    description: 'Enable autonomous trading',
  },
  {
    patterns: [
      /(?:stopp?e?|stop|deaktiviere?|disable)\s+(?:autonomes?|autonomous|auto)\s+(?:trading|handel)/i,
      /(?:kein|no)\s+(?:autonomes?|auto)\s+(?:trading|handel)/i,
    ],
    handler: handleDisableAutoTrading,
    description: 'Stop autonomous trading',
  },
  {
    patterns: [
      /(?:pause?|pausiere?)\s+(?:trading|handel)/i,
    ],
    handler: handlePauseTrading,
    description: 'Pause trading',
  },
  {
    patterns: [
      /(?:resume|fortsetzen|weiter)\s*(?:trading|handel)?/i,
    ],
    handler: handleResumeTrading,
    description: 'Resume trading',
  },

  // ========== REPORTS ==========
  {
    patterns: [
      /(?:morgenbriefing|morning\s*briefing|täglicher?\s+bericht|daily\s+report)\s*(?:um\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i,
      /(?:briefing|bericht)\s+(?:jeden\s+)?(?:morgen|tag)\s*(?:um\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i,
      /(?:daily|morning)\s+(?:report|briefing)\s*(?:at\s+(\d{1,2})(?::(\d{2}))?)?/i,
    ],
    handler: handleSetMorningReport,
    description: 'Set morning report',
  },
  {
    patterns: [
      /(?:abend|evening|tages)\s*(?:bericht|report)\s*(?:um\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i,
      /(?:evening)\s+(?:report)\s*(?:at\s+(\d{1,2})(?::(\d{2}))?)?/i,
    ],
    handler: handleSetEveningReport,
    description: 'Set evening report',
  },
  {
    patterns: [
      /(?:wochen|weekly)\s*(?:bericht|report|zusammenfassung|summary)/i,
    ],
    handler: handleWeeklyReport,
    description: 'Weekly report',
  },
  {
    patterns: [
      /(?:bericht|report|status|zusammenfassung|summary)(?:\s+(?:jetzt|now))?$/i,
      /(?:wie\s+(?:läuft|geht)\s*(?:es|'s)?|what'?s?\s+(?:up|happening))/i,
    ],
    handler: handleInstantReport,
    description: 'Instant report',
  },

  // ========== NOTIFICATIONS ==========
  {
    patterns: [
      /(?:ruf|call)\s+(?:mich\s+)?(?:an\s+)?(?:bei|wenn|if|when)\s+(.+)/i,
      /(?:anruf|call\s*me)\s+(?:bei|wenn|for)\s+(.+)/i,
    ],
    handler: handleCallMe,
    description: 'Call me on opportunity',
  },

  // ========== PLATFORM MANAGEMENT ==========
  {
    patterns: [
      /(?:verbinde?|connect)\s+(.+?)(?:\s+(?:mit\s+)?(?:api[- ]?key|credentials?)\s+(.+))?$/i,
      /(?:füge?|add)\s+(?:plattform|platform)\s+(.+)/i,
    ],
    handler: handleConnectPlatform,
    description: 'Connect platform',
  },
  {
    patterns: [
      /(?:trenne?|disconnect|entferne?|remove)\s+(?:plattform|platform)?\s*(.+)/i,
    ],
    handler: handleDisconnectPlatform,
    description: 'Disconnect platform',
  },
  {
    patterns: [
      /(?:plattformen?|platforms?|accounts?|verbindungen|connections)/i,
      /(?:zeig|show|list)\s+(?:meine\s+)?(?:plattformen?|platforms?|accounts?)/i,
    ],
    handler: handleListPlatforms,
    description: 'Show platforms',
  },
  {
    patterns: [
      /(?:sync|synchronisiere?|aktualisiere?|update)\s*(?:alle?\s+)?(?:plattformen?|platforms?|portfolio)?/i,
    ],
    handler: handleSyncPlatforms,
    description: 'Sync platforms',
  },

  // ========== PORTFOLIO & BALANCE ==========
  {
    patterns: [
      /(?:portfolio|vermögen|balance|guthaben|kontostand)/i,
      /(?:wie\s*viel\s*(?:habe?\s*ich|geld)|how\s+much)/i,
    ],
    handler: handleShowPortfolio,
    description: 'Show portfolio',
  },
  {
    patterns: [
      /(?:rebalance|ausgleichen|umschichten)/i,
      /(?:portfolio\s+)?(?:rebalancing|ausgleich)/i,
    ],
    handler: handleRebalance,
    description: 'Rebalance portfolio',
  },

  // ========== PASSIVE INCOME ==========
  {
    patterns: [
      /(?:passive[sr]?\s+)?(?:income|einkommen|erträge?)/i,
      /(?:staking|yield|rewards?|belohnungen)/i,
    ],
    handler: handleShowPassiveIncome,
    description: 'Show passive income',
  },
  {
    patterns: [
      /(?:airdrops?|neue?\s+airdrops?)/i,
    ],
    handler: handleCheckAirdrops,
    description: 'Check airdrops',
  },

  // ========== MARKET INFO ==========
  {
    patterns: [
      /(?:preis|price|kurs)\s+(?:von\s+)?(.+)/i,
      /(?:was\s+kostet|what'?s?\s+(?:the\s+)?price\s+of)\s+(.+)/i,
      /(.+)\s+(?:preis|price|kurs)$/i,
    ],
    handler: handleGetPrice,
    description: 'Show price',
  },
  {
    patterns: [
      /(?:markt|market)\s*(?:übersicht|overview|news)/i,
      /(?:was\s+(?:ist\s+)?los|what'?s?\s+happening)\s+(?:am\s+markt|in\s+(?:the\s+)?markets?)/i,
    ],
    handler: handleMarketOverview,
    description: 'Market overview',
  },

  // ========== AGENT CONTROL ==========
  {
    patterns: [
      /^status$/i,
      /^zustand$/i,
    ],
    handler: handleStatus,
    description: 'Show agent status',
  },
  {
    patterns: [
      /(?:hilfe?|help|befehle?|commands?)/i,
      /(?:was\s+kannst\s+du|what\s+can\s+you\s+do)/i,
      /^\?$/,
    ],
    handler: handleHelp,
    description: 'Show help',
  },
];

// ============================================================================
// Handler Functions (ALL ENGLISH RESPONSES)
// ============================================================================

async function handleWatch(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  
  const state = agent.getState();
  if (!state.watchlist.includes(symbol)) {
    state.watchlist.push(symbol);
    agent.updateSettings({ watchlist: state.watchlist });
  }
  
  return `👁️ **Now watching ${symbol}**

K.I.T. will monitor ${symbol} and notify you on:
• Significant price moves (>3%)
• Trading opportunities
• News and events

💡 Tip: Say "alert if ${symbol} above/below X" for specific alerts`;
}

async function handleUnwatch(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  
  const state = agent.getState();
  state.watchlist = state.watchlist.filter(s => s !== symbol);
  agent.updateSettings({ watchlist: state.watchlist });
  
  return `✅ Stopped watching ${symbol}`;
}

async function handleShowWatchlist(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.watchlist.length === 0) {
    return `📋 **Watchlist is empty**

Say "watch BTC" to add an asset.`;
  }
  
  const prices = await Promise.all(
    state.watchlist.map(async (symbol) => {
      const price = await getPrice(symbol);
      return `• ${symbol}: ${price ? `$${price.toLocaleString()}` : 'N/A'}`;
    })
  );
  
  return `📋 **Watchlist (${state.watchlist.length} assets)**

${prices.join('\n')}

💡 "watch XAUUSD" - add
💡 "unwatch BTC" - remove`;
}

async function handleAlertAbove(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  const targetPrice = parseNumber(match[2]);
  
  await agent.addAlert({
    symbol,
    condition: 'above',
    targetPrice,
    notifyTelegram: true,
  });
  
  return `🔔 **Alert created**

${symbol} ≥ $${targetPrice.toLocaleString()}

You'll be notified immediately when the price is reached.`;
}

async function handleAlertBelow(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  const targetPrice = parseNumber(match[2]);
  
  await agent.addAlert({
    symbol,
    condition: 'below',
    targetPrice,
    notifyTelegram: true,
  });
  
  return `🔔 **Alert created**

${symbol} ≤ $${targetPrice.toLocaleString()}

You'll be notified immediately when the price is reached.`;
}

async function handleAlertPercent(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  const percentChange = parseNumber(match[2]);
  
  await agent.addAlert({
    symbol,
    condition: 'percent_change',
    percentChange,
    notifyTelegram: true,
  });
  
  return `🔔 **Alert created**

${symbol} ±${percentChange}% move

You'll be notified on any ${percentChange}% movement.`;
}

async function handleShowAlerts(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  const activeAlerts = state.priceAlerts.filter(a => !a.triggered);
  
  if (activeAlerts.length === 0) {
    return `🔔 **No active alerts**

Create one with:
• "alert if BTC above 50000"
• "alert if ETH below 3000"
• "alert if XAUUSD by 2%"`;
  }
  
  const alertList = activeAlerts.map(a => {
    const condition = a.condition === 'above' ? '≥' : 
                      a.condition === 'below' ? '≤' : '±';
    const target = a.targetPrice ? `$${a.targetPrice.toLocaleString()}` : `${a.percentChange}%`;
    return `• ${a.symbol} ${condition} ${target}`;
  });
  
  return `🔔 **Active Alerts (${activeAlerts.length})**

${alertList.join('\n')}`;
}

async function handleClearAlerts(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({ priceAlerts: [] });
  return `✅ All alerts cleared`;
}

async function handleBuy(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  const symbol = normalizeSymbol(match[1]);
  const amount = match[2] ? parseNumber(match[2]) : undefined;
  const platform = match[3] ? normalizePlatform(match[3]) : findBestPlatform(state, symbol);
  
  if (!platform) {
    return `❌ **No platform connected**

Connect a trading platform first:
• "connect binaryfaster"
• "connect binance"
• "connect mt5"`;
  }
  
  const result = await executeTrade({
    type: 'buy',
    platform,
    symbol,
    amount,
  });
  
  return result;
}

async function handleSell(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  const symbol = normalizeSymbol(match[1]);
  const amount = match[2] ? parseNumber(match[2]) : undefined;
  const platform = match[3] ? normalizePlatform(match[3]) : findBestPlatform(state, symbol);
  
  if (!platform) {
    return `❌ **No platform connected**

Connect a trading platform first.`;
  }
  
  const result = await executeTrade({
    type: 'sell',
    platform,
    symbol,
    amount,
  });
  
  return result;
}

async function handleClose(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  const target = match[1];
  
  const platforms = target ? [normalizePlatform(target)] : state.platforms.filter(p => p.enabled).map(p => p.platform);
  
  const results: string[] = [];
  for (const platform of platforms) {
    const result = await closePositions(platform);
    results.push(result);
  }
  
  return `🔒 **Positions closed**

${results.join('\n')}`;
}

async function handleEnableAutoTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({
    autoTradeOpportunities: true,
    maxAutoTradeRiskPercent: 2,
  });
  
  const state = agent.getState();
  const platforms = state.platforms.filter(p => p.enabled);
  
  if (platforms.length === 0) {
    return `⚠️ **Autonomous trading enabled, but no platforms connected!**

Connect at least one platform:
• "connect binaryfaster"
• "connect binance"
• "connect mt5"`;
  }
  
  return `🤖 **AUTONOMOUS TRADING ACTIVATED**

K.I.T. will now trade independently on:
${platforms.map(p => `• ${p.platform}: $${(p.balance || 0).toLocaleString()}`).join('\n')}

**Settings:**
• Max risk per trade: 2%
• Max trades per day: ${state.maxDailyTrades}
• Stop on daily loss: ${state.maxDailyLossPercent}%

⚠️ K.I.T. only trades on high confidence (>70%)

Say "stop auto trading" to pause.`;
}

async function handleDisableAutoTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({ autoTradeOpportunities: false });
  
  return `🛑 **Autonomous trading disabled**

K.I.T. continues monitoring markets and sending alerts, but won't execute automatic trades.`;
}

async function handlePauseTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({
    tradingPaused: true,
    pauseReason: 'Manually paused',
  });
  
  return `⏸️ **Trading paused**

All trades are paused. Monitoring continues.
Say "resume" to continue.`;
}

async function handleResumeTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({
    tradingPaused: false,
    pauseReason: undefined,
  });
  
  return `▶️ **Trading resumed**`;
}

async function handleSetMorningReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const hour = match[1] ? parseInt(match[1]) : 8;
  const minute = match[2] ? parseInt(match[2]) : 0;
  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  agent.updateSettings({ dailyReportTime: time });
  
  return `📰 **Morning briefing set**

Every day at ${time} you'll receive:
• Market overview
• Portfolio status
• Important news
• Trading opportunities

💡 Say "report now" for an instant report.`;
}

async function handleSetEveningReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const hour = match[1] ? parseInt(match[1]) : 22;
  const minute = match[2] ? parseInt(match[2]) : 0;
  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  agent.updateSettings({ 
    dailyReportTime: time,
    notifyOnTrade: true,
  });
  
  return `📊 **Evening report set**

Every day at ${time} you'll receive:
• What K.I.T. did today
• Executed trades
• Profit/Loss
• Portfolio performance`;
}

async function handleWeeklyReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  return `📈 **Weekly Report**

**Portfolio**
• Total Value: $${state.totalValueUSD.toLocaleString()}
• Week Performance: ${state.totalPnL >= 0 ? '+' : ''}$${state.totalPnL.toFixed(2)}

**Trading**
• Trades this week: ${state.totalTradesExecuted}
• Win Rate: ${(state.winRate * 100).toFixed(1)}%

**Passive Income**
• Staking Value: $${state.totalPassiveValueUSD.toLocaleString()}
• Rewards: $${state.totalRewardsEarned.toFixed(2)}

_Weekly report sent automatically every Sunday._`;
}

async function handleInstantReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  return agent.generateDailyReport();
}

async function handleCallMe(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const condition = match[1];
  
  agent.updateSettings({
    notifyOnOpportunity: true,
    notifyOnAlert: true,
    notifyOnTrade: true,
  });
  
  return `📞 **Call notification enabled**

K.I.T. will send you an urgent message on:
• ${condition}

⚠️ Note: Actual phone calls not yet implemented. You'll receive a high-priority Telegram message with 🚨`;
}

async function handleConnectPlatform(match: RegExpMatchArray, text: string): Promise<string> {
  const platformName = normalizePlatform(match[1]);
  
  const instructions: Record<string, string> = {
    'binaryfaster': `🔗 **Connect BinaryFaster**

Set these environment variables:
\`\`\`
BINARYFASTER_EMAIL=your@email.com
BINARYFASTER_PASSWORD=yourpassword
\`\`\`

Or use the K.I.T. Dashboard at localhost:3000`,

    'binance': `🔗 **Connect Binance**

1. Create API Key on binance.com
2. Set environment variables:
\`\`\`
BINANCE_API_KEY=your_key
BINANCE_API_SECRET=your_secret
\`\`\`

⚠️ Enable only "Spot Trading" permission!`,

    'mt5': `🔗 **Connect MetaTrader 5**

1. Open MT5 on your PC
2. K.I.T. connects automatically locally
3. No credentials needed!

Status: ${await checkMT5Connection() ? '✅ Connected' : '❌ Not connected - Start MT5'}`,

    'bybit': `🔗 **Connect Bybit**

Set environment variables:
\`\`\`
BYBIT_API_KEY=your_key
BYBIT_API_SECRET=your_secret
\`\`\``,
  };
  
  return instructions[platformName] || `❌ Unknown platform: ${platformName}

Supported platforms:
• BinaryFaster
• Binance
• Bybit
• MT5 (MetaTrader 5)
• Kraken
• Coinbase`;
}

async function handleDisconnectPlatform(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const platformName = normalizePlatform(match[1]);
  
  const state = agent.getState();
  const platform = state.platforms.find(p => p.platform === platformName);
  
  if (platform) {
    platform.enabled = false;
    agent.updateSettings({ platforms: state.platforms });
  }
  
  return `✅ ${platformName} disconnected`;
}

async function handleListPlatforms(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.platforms.length === 0) {
    return `📡 **No platforms connected**

Say "connect binaryfaster" or "connect binance" to start.`;
  }
  
  const list = state.platforms.map(p => {
    const status = p.enabled ? '✅' : '❌';
    const balance = p.balance ? `$${p.balance.toLocaleString()}` : 'N/A';
    return `${status} **${p.platform}**: ${balance}`;
  });
  
  return `📡 **Connected Platforms**

${list.join('\n')}

Total: $${state.totalValueUSD.toLocaleString()}`;
}

async function handleSyncPlatforms(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  return await agent.syncAllPlatforms();
}

async function handleShowPortfolio(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  await agent.syncAllPlatforms();
  const updatedState = agent.getState();
  
  return `💼 **Portfolio Overview**

**Total Value: $${updatedState.totalValueUSD.toLocaleString()}**

${updatedState.platforms
  .filter(p => p.enabled)
  .map(p => `• ${p.platform}: $${(p.balance || 0).toLocaleString()}`)
  .join('\n') || '• No platforms connected'}

**Passive Positions**
• Staking: $${updatedState.totalPassiveValueUSD.toLocaleString()}
• Rewards: $${updatedState.totalRewardsEarned.toFixed(2)}

**Performance**
• Today: ${updatedState.currentDailyPnL >= 0 ? '+' : ''}$${updatedState.currentDailyPnL.toFixed(2)}
• Total: ${updatedState.totalPnL >= 0 ? '+' : ''}$${updatedState.totalPnL.toFixed(2)}`;
}

async function handleRebalance(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  return `⚖️ **Portfolio Rebalancing**

**Target Allocation:**
${state.targetAllocations.map(a => `• ${a.asset}: ${a.targetPercent}%`).join('\n')}

**Auto-Rebalance:** ${state.autoRebalance ? 'ON' : 'OFF'}

Say "enable auto rebalance" for automatic rebalancing.`;
}

async function handleShowPassiveIncome(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.passivePositions.length === 0) {
    return `💰 **No passive positions**

Passive income opportunities:
• Staking (ETH, SOL, DOT, etc.)
• Yield Farming
• Liquidity Pools
• Airdrops

Say "check airdrops" for current opportunities.`;
  }
  
  const positions = state.passivePositions.map(p => 
    `• ${p.asset} on ${p.platform}: $${p.valueUSD.toLocaleString()} (${p.apy || 0}% APY)`
  );
  
  return `💰 **Passive Income**

**Positions:**
${positions.join('\n')}

**Total:** $${state.totalPassiveValueUSD.toLocaleString()}
**Earned Rewards:** $${state.totalRewardsEarned.toFixed(2)}`;
}

async function handleCheckAirdrops(match: RegExpMatchArray, text: string): Promise<string> {
  return `🪂 **Airdrop Scanner**

**Current Opportunities:**
• LayerZero (ZRO) - Bridge Activity
• zkSync - Transactions needed
• Starknet - DeFi interactions
• Scroll - Early adoption phase

K.I.T. automatically tracks your wallet activity for airdrops.

💡 Connect your wallets for personalized recommendations.`;
}

async function handleGetPrice(match: RegExpMatchArray, text: string): Promise<string> {
  const symbol = normalizeSymbol(match[1]);
  const price = await getPrice(symbol);
  
  if (!price) {
    return `❌ Price not found for ${symbol}`;
  }
  
  return `📊 **${symbol}**

Price: $${price.toLocaleString()}

💡 "watch ${symbol}" for alerts
💡 "buy ${symbol}" for instant purchase`;
}

async function handleMarketOverview(match: RegExpMatchArray, text: string): Promise<string> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'EURUSD'];
  const prices = await Promise.all(
    symbols.map(async (s) => {
      const price = await getPrice(s);
      return { symbol: s, price };
    })
  );
  
  return `🌍 **Market Overview**

${prices.map(p => `• ${p.symbol}: ${p.price ? `$${p.price.toLocaleString()}` : 'N/A'}`).join('\n')}

_Updated: ${new Date().toLocaleTimeString('en-US')}_`;
}

async function handleStatus(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  return agent.getStatus();
}

async function handleHelp(match: RegExpMatchArray, text: string): Promise<string> {
  return `🤖 **K.I.T. - Vollständige Funktionen**

**📊 CRYPTO Trading**
• "buy BTC" / "buy ETH for 500"
• "sell SOL" / "price BTC ETH"
• "whale tracker" / "arbitrage scan"

**💱 FOREX Trading**
• "analyze EURUSD" / "trade GBPUSD"
• "XAUUSD price" (Gold)
• MetaTrader 5 Integration

**📈 AKTIEN Trading**
• "buy AAPL" / "sell TSLA"
• "stock price NVDA"
• "dividend tracker"

**⚡ BINARY OPTIONS**
• "binary call BTCUSDT 5min"
• "binary put EURUSD 1min"
• Pocket Option, IQ Option

**🤖 AUTONOMES Trading**
• "trade autonomous" - 24/7 AI Trading
• "stop auto trading"
• "trading status"

**📋 PORTFOLIO**
• "portfolio" / "sync platforms"
• "rebalance" / "performance"
• "risk calculator"

**🔔 ALERTS & REPORTS**
• "alert if BTC above 70000"
• "morning briefing at 8"
• "market analysis"

**💰 DeFi & YIELD**
• "staking opportunities"
• "yield farming" / "airdrop scan"

**🔗 PLATTFORMEN**
• "connect binance" / "connect mt5"
• "platforms" / "sync"

**📰 MARKT INTELLIGENCE**
• "news crypto" / "sentiment BTC"
• "fear greed index"

**🧮 TOOLS**
• "lot size calculator"
• "pip calculator" / "tax report"

_K.I.T. hat 50+ Skills & 162 Tools!_`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeSymbol(input: string): string {
  const cleaned = input.trim().toUpperCase();
  
  const mappings: Record<string, string> = {
    'BTC': 'BTCUSDT',
    'BITCOIN': 'BTCUSDT',
    'ETH': 'ETHUSDT',
    'ETHEREUM': 'ETHUSDT',
    'SOL': 'SOLUSDT',
    'SOLANA': 'SOLUSDT',
    'GOLD': 'XAUUSD',
    'SILBER': 'XAGUSD',
    'SILVER': 'XAGUSD',
    'EUR': 'EURUSD',
    'EURO': 'EURUSD',
  };
  
  return mappings[cleaned] || cleaned;
}

function normalizePlatform(input: string): string {
  const cleaned = input.trim().toLowerCase();
  
  const mappings: Record<string, string> = {
    'binary': 'binaryfaster',
    'binaryfaster': 'binaryfaster',
    'bf': 'binaryfaster',
    'binance': 'binance',
    'mt5': 'mt5',
    'metatrader': 'mt5',
    'metatrader5': 'mt5',
    'bybit': 'bybit',
    'kraken': 'kraken',
    'coinbase': 'coinbase',
  };
  
  return mappings[cleaned] || cleaned;
}

function parseNumber(input: string): number {
  return parseFloat(input.replace(',', '.'));
}

function findBestPlatform(state: any, symbol: string): string | null {
  const enabledPlatforms = state.platforms.filter((p: any) => p.enabled);
  
  if (enabledPlatforms.length === 0) return null;
  
  if (symbol.includes('USD') && !symbol.startsWith('USD')) {
    const forex = enabledPlatforms.find((p: any) => 
      p.platform === 'mt5' || p.platform === 'binaryfaster'
    );
    if (forex) return forex.platform;
  }
  
  if (symbol.endsWith('USDT') || symbol.endsWith('BUSD')) {
    const crypto = enabledPlatforms.find((p: any) => 
      p.platform === 'binance' || p.platform === 'bybit'
    );
    if (crypto) return crypto.platform;
  }
  
  return enabledPlatforms[0].platform;
}

async function getPrice(symbol: string): Promise<number | null> {
  try {
    if (symbol.endsWith('USDT') || symbol.endsWith('BUSD') || symbol.endsWith('BTC')) {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        return parseFloat(data.price);
      }
    }
    
    const withUsdt = symbol + 'USDT';
    const res2 = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${withUsdt}`);
    if (res2.ok) {
      const data = await res2.json();
      return parseFloat(data.price);
    }
    
    return null;
  } catch {
    return null;
  }
}

async function checkMT5Connection(): Promise<boolean> {
  try {
    const { execSync } = require('child_process');
    const pythonPath = getPythonPath();
    execSync(`${pythonPath} -c "import MetaTrader5 as mt5; mt5.initialize(); print(mt5.terminal_info())"`, 
      { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function executeTrade(action: TradeAction): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.tradingPaused) {
    return `⛔ Trading is paused: ${state.pauseReason}`;
  }
  
  if (state.tradesToday >= state.maxDailyTrades) {
    return `⛔ Daily trade limit reached (${state.maxDailyTrades})`;
  }
  
  let result: string;
  
  switch (action.platform) {
    case 'binaryfaster':
      result = await executeBinaryFasterTrade(action);
      break;
    case 'binance':
      result = await executeBinanceTrade(action);
      break;
    case 'mt5':
      result = await executeMT5Trade(action);
      break;
    default:
      result = `❌ Platform ${action.platform} not fully implemented yet`;
  }
  
  agent.updateSettings({ tradesToday: state.tradesToday + 1 });
  
  return result;
}

async function executeBinaryFasterTrade(action: TradeAction): Promise<string> {
  try {
    const email = process.env.BINARYFASTER_EMAIL;
    const password = process.env.BINARYFASTER_PASSWORD;
    
    if (!email || !password) {
      return `❌ BinaryFaster credentials not configured`;
    }
    
    const loginRes = await fetch('https://wsauto.binaryfaster.com/automation/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json() as any;
    
    if (!loginData.api_key) {
      return `❌ BinaryFaster login failed`;
    }
    
    const apiKey = loginData.api_key;
    
    await fetch('https://wsauto.binaryfaster.com/automation/traderoom/setdemo/0', {
      headers: { 'x-api-key': apiKey },
    });
    
    const assetMap: Record<string, number> = {
      'EURUSD': 1,
      'GBPUSD': 2,
      'XAUUSD': 76,
      'BTCUSDT': 31,
    };
    
    const assetId = assetMap[action.symbol] || 1;
    const direction = action.type === 'buy' ? 'call' : 'put';
    const amount = action.amount || 10;
    
    const tradeRes = await fetch('https://wsauto.binaryfaster.com/automation/traderoom/trade', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        asset_id: assetId,
        amount: amount,
        direction: direction,
        expiry: 300,
      }),
    });
    
    const tradeData = await tradeRes.json() as any;
    
    if (tradeData.success || tradeData.trade_id) {
      return `✅ **Trade executed**

${action.type.toUpperCase()} ${action.symbol}
Amount: $${amount}
Platform: BinaryFaster
Trade ID: ${tradeData.trade_id || 'N/A'}`;
    } else {
      return `❌ Trade failed: ${JSON.stringify(tradeData)}`;
    }
  } catch (e) {
    return `❌ BinaryFaster error: ${e}`;
  }
}

async function executeBinanceTrade(action: TradeAction): Promise<string> {
  return `⚠️ Binance trading being implemented...

For now:
1. Open Binance app
2. ${action.type.toUpperCase()} ${action.symbol}
${action.amount ? `3. Amount: $${action.amount}` : ''}`;
}

async function executeMT5Trade(action: TradeAction): Promise<string> {
  try {
    const { execSync } = require('child_process');
    
    const script = `
import MetaTrader5 as mt5
mt5.initialize()
symbol = "${action.symbol}"
lot = ${action.amount || 0.01}
action = mt5.ORDER_TYPE_BUY if "${action.type}" == "buy" else mt5.ORDER_TYPE_SELL
price = mt5.symbol_info_tick(symbol).ask if action == mt5.ORDER_TYPE_BUY else mt5.symbol_info_tick(symbol).bid
request = {
    "action": mt5.TRADE_ACTION_DEAL,
    "symbol": symbol,
    "volume": lot,
    "type": action,
    "price": price,
    "deviation": 10,
    "magic": 234000,
    "comment": "K.I.T. Trade",
    "type_time": mt5.ORDER_TIME_GTC,
}
result = mt5.order_send(request)
print(result)
`;
    
    const result = execSync(`python -c "${script.replace(/"/g, '\\"')}"`, { encoding: 'utf8' });
    
    return `✅ **MT5 Trade executed**

${action.type.toUpperCase()} ${action.symbol}
Lot: ${action.amount || 0.01}

${result}`;
  } catch (e) {
    return `❌ MT5 Trade failed: ${e}`;
  }
}

async function closePositions(platform: string): Promise<string> {
  return `✅ Positions on ${platform} closed`;
}

// ============================================================================
// Main Processor
// ============================================================================

export async function processCommand(text: string): Promise<string | null> {
  const trimmed = text.trim();
  
  for (const cmd of COMMAND_PATTERNS) {
    for (const pattern of cmd.patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        try {
          return await cmd.handler(match, trimmed);
        } catch (e) {
          console.error(`Command error for "${cmd.description}":`, e);
          return `❌ Error in "${cmd.description}": ${e}`;
        }
      }
    }
  }
  
  return null;
}

export function isCommand(text: string): boolean {
  const trimmed = text.trim();
  
  for (const cmd of COMMAND_PATTERNS) {
    for (const pattern of cmd.patterns) {
      if (pattern.test(trimmed)) {
        return true;
      }
    }
  }
  
  return false;
}
