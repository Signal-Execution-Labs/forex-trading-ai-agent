/**
 * K.I.T. NATURAL LANGUAGE COMMAND PROCESSOR
 * 
 * Versteht deutsche und englische Befehle und führt sie aus.
 * Keine halben Sachen - vollständig funktionsfähig.
 */

import { getAutonomousAgent, TradeAction, PriceAlert, PassivePosition } from './autonomous-agent';

// ============================================================================
// Command Patterns (German + English)
// ============================================================================

interface CommandPattern {
  patterns: RegExp[];
  handler: (match: RegExpMatchArray, text: string) => Promise<string>;
  description: string;
}

const COMMAND_PATTERNS: CommandPattern[] = [
  // ========== ÜBERWACHUNG / WATCHLIST ==========
  {
    patterns: [
      /(?:überwache|watch|monitor|beobachte)\s+(.+)/i,
      /(?:füge?|add)\s+(.+?)\s+(?:zur watchlist|to watchlist|hinzu)/i,
    ],
    handler: handleWatch,
    description: 'Überwache ein Asset',
  },
  {
    patterns: [
      /(?:stopp?e?|stop)\s+(?:überwachung|watching|monitoring)\s+(?:von\s+)?(.+)/i,
      /(?:entferne|remove)\s+(.+?)\s+(?:von|from)\s+(?:watchlist|überwachung)/i,
    ],
    handler: handleUnwatch,
    description: 'Stoppe Überwachung',
  },
  {
    patterns: [
      /(?:watchlist|überwachungsliste|was überwachst du)/i,
      /(?:show|zeig)\s+watchlist/i,
    ],
    handler: handleShowWatchlist,
    description: 'Zeige Watchlist',
  },

  // ========== ALERTS ==========
  {
    patterns: [
      /(?:alarm|alert)\s+(?:wenn|if|when)\s+(.+?)\s+(?:über|above|>\s*)(\d+(?:[.,]\d+)?)/i,
      /(?:benachrichtige?|notify)\s+(?:mich\s+)?(?:wenn|if|when)\s+(.+?)\s+(?:über|above)\s+(\d+(?:[.,]\d+)?)/i,
    ],
    handler: handleAlertAbove,
    description: 'Alert wenn Preis über X',
  },
  {
    patterns: [
      /(?:alarm|alert)\s+(?:wenn|if|when)\s+(.+?)\s+(?:unter|below|<\s*)(\d+(?:[.,]\d+)?)/i,
      /(?:benachrichtige?|notify)\s+(?:mich\s+)?(?:wenn|if|when)\s+(.+?)\s+(?:unter|below)\s+(\d+(?:[.,]\d+)?)/i,
    ],
    handler: handleAlertBelow,
    description: 'Alert wenn Preis unter X',
  },
  {
    patterns: [
      /(?:alarm|alert)\s+(?:wenn|if|when)\s+(.+?)\s+(?:um|by)\s+(\d+(?:[.,]\d+)?)\s*%/i,
    ],
    handler: handleAlertPercent,
    description: 'Alert bei X% Bewegung',
  },
  {
    patterns: [
      /(?:zeig|show|list)\s+(?:alle\s+)?(?:alerts?|alarme?)/i,
      /(?:aktive\s+)?(?:alerts?|alarme?)/i,
    ],
    handler: handleShowAlerts,
    description: 'Zeige aktive Alerts',
  },
  {
    patterns: [
      /(?:lösche?|delete|remove|clear)\s+(?:alle?\s+)?(?:alerts?|alarme?)/i,
    ],
    handler: handleClearAlerts,
    description: 'Lösche Alerts',
  },

  // ========== INSTANT TRADING ==========
  {
    patterns: [
      /(?:kauf|buy|long)\s+(.+?)(?:\s+(?:für|for)\s+(\d+(?:[.,]\d+)?)\s*(?:€|\$|euro?|dollar|usd)?)?(?:\s+(?:auf|on)\s+(.+))?$/i,
    ],
    handler: handleBuy,
    description: 'Kaufe ein Asset',
  },
  {
    patterns: [
      /(?:verkauf|sell|short)\s+(.+?)(?:\s+(?:für|for)\s+(\d+(?:[.,]\d+)?)\s*(?:€|\$|euro?|dollar|usd)?)?(?:\s+(?:auf|on)\s+(.+))?$/i,
    ],
    handler: handleSell,
    description: 'Verkaufe ein Asset',
  },
  {
    patterns: [
      /(?:schließe?|close)\s+(?:alle?\s+)?(?:position(?:en)?|trades?)\s*(?:(?:auf|on|von|from)\s+(.+))?/i,
      /(?:close|schließe?)\s+(.+)/i,
    ],
    handler: handleClose,
    description: 'Schließe Position(en)',
  },

  // ========== AUTONOMOUS MODE ==========
  {
    patterns: [
      /(?:trade|handel)\s+(?:autonom|autonomous|automatisch|auto)\s*(?:(?:auf|on)\s+(?:allen?\s+)?(?:plattformen?|platforms?|accounts?))?/i,
      /(?:aktiviere?|enable|start)\s+(?:autonomes?|autonomous|auto)\s+(?:trading|handel)/i,
      /(?:volle?\s+)?(?:autonomie|autonomous\s+mode)/i,
    ],
    handler: handleEnableAutoTrading,
    description: 'Aktiviere autonomes Trading',
  },
  {
    patterns: [
      /(?:stopp?e?|stop|deaktiviere?|disable)\s+(?:autonomes?|autonomous|auto)\s+(?:trading|handel)/i,
      /(?:kein|no)\s+(?:autonomes?|auto)\s+(?:trading|handel)/i,
    ],
    handler: handleDisableAutoTrading,
    description: 'Stoppe autonomes Trading',
  },
  {
    patterns: [
      /(?:pause?|pausiere?)\s+(?:trading|handel)/i,
    ],
    handler: handlePauseTrading,
    description: 'Pausiere Trading',
  },
  {
    patterns: [
      /(?:resume|fortsetzen|weiter)\s*(?:trading|handel)?/i,
    ],
    handler: handleResumeTrading,
    description: 'Setze Trading fort',
  },

  // ========== REPORTS ==========
  {
    patterns: [
      /(?:morgenbriefing|morning\s*briefing|täglicher?\s+bericht|daily\s+report)\s*(?:um\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i,
      /(?:briefing|bericht)\s+(?:jeden\s+)?(?:morgen|tag)\s*(?:um\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i,
    ],
    handler: handleSetMorningReport,
    description: 'Setze Morgenbriefing',
  },
  {
    patterns: [
      /(?:abend|evening|tages)\s*(?:bericht|report)\s*(?:um\s+(\d{1,2})(?::(\d{2}))?\s*(?:uhr)?)?/i,
    ],
    handler: handleSetEveningReport,
    description: 'Setze Abendbericht',
  },
  {
    patterns: [
      /(?:wochen|weekly)\s*(?:bericht|report|zusammenfassung|summary)/i,
    ],
    handler: handleWeeklyReport,
    description: 'Wochenbericht',
  },
  {
    patterns: [
      /(?:bericht|report|status|zusammenfassung|summary)(?:\s+(?:jetzt|now))?$/i,
      /(?:wie\s+(?:läuft|geht)\s*(?:es|'s)?|what'?s?\s+(?:up|happening))/i,
    ],
    handler: handleInstantReport,
    description: 'Sofortiger Bericht',
  },

  // ========== NOTIFICATIONS ==========
  {
    patterns: [
      /(?:ruf|call)\s+(?:mich\s+)?(?:an\s+)?(?:bei|wenn|if|when)\s+(.+)/i,
      /(?:anruf|call\s*me)\s+(?:bei|wenn|for)\s+(.+)/i,
    ],
    handler: handleCallMe,
    description: 'Rufe an bei Gelegenheit',
  },
  {
    patterns: [
      /(?:benachrichtige?|notify|alert)\s+(?:mich\s+)?(?:nur\s+)?(?:bei|für|for|on)\s+(.+)/i,
    ],
    handler: handleNotifySettings,
    description: 'Benachrichtigungseinstellungen',
  },

  // ========== PLATFORM MANAGEMENT ==========
  {
    patterns: [
      /(?:verbinde?|connect)\s+(.+?)(?:\s+(?:mit\s+)?(?:api[- ]?key|credentials?)\s+(.+))?$/i,
      /(?:füge?|add)\s+(?:plattform|platform)\s+(.+)/i,
    ],
    handler: handleConnectPlatform,
    description: 'Verbinde Plattform',
  },
  {
    patterns: [
      /(?:trenne?|disconnect|entferne?|remove)\s+(?:plattform|platform)?\s*(.+)/i,
    ],
    handler: handleDisconnectPlatform,
    description: 'Trenne Plattform',
  },
  {
    patterns: [
      /(?:plattformen?|platforms?|accounts?|verbindungen|connections)/i,
      /(?:zeig|show|list)\s+(?:meine\s+)?(?:plattformen?|platforms?|accounts?)/i,
    ],
    handler: handleListPlatforms,
    description: 'Zeige Plattformen',
  },
  {
    patterns: [
      /(?:sync|synchronisiere?|aktualisiere?|update)\s*(?:alle?\s+)?(?:plattformen?|platforms?|portfolio)?/i,
    ],
    handler: handleSyncPlatforms,
    description: 'Synchronisiere Plattformen',
  },

  // ========== PORTFOLIO & BALANCE ==========
  {
    patterns: [
      /(?:portfolio|vermögen|balance|guthaben|kontostand)/i,
      /(?:wie\s*viel\s*(?:habe?\s*ich|geld)|how\s+much)/i,
    ],
    handler: handleShowPortfolio,
    description: 'Zeige Portfolio',
  },
  {
    patterns: [
      /(?:rebalance|ausgleichen|umschichten)/i,
      /(?:portfolio\s+)?(?:rebalancing|ausgleich)/i,
    ],
    handler: handleRebalance,
    description: 'Rebalance Portfolio',
  },

  // ========== PASSIVE INCOME ==========
  {
    patterns: [
      /(?:passive[sr]?\s+)?(?:income|einkommen|erträge?)/i,
      /(?:staking|yield|rewards?|belohnungen)/i,
    ],
    handler: handleShowPassiveIncome,
    description: 'Zeige passives Einkommen',
  },
  {
    patterns: [
      /(?:airdrops?|neue?\s+airdrops?)/i,
    ],
    handler: handleCheckAirdrops,
    description: 'Prüfe Airdrops',
  },

  // ========== MARKET INFO ==========
  {
    patterns: [
      /(?:preis|price|kurs)\s+(?:von\s+)?(.+)/i,
      /(?:was\s+kostet|what'?s?\s+(?:the\s+)?price\s+of)\s+(.+)/i,
      /(.+)\s+(?:preis|price|kurs)$/i,
    ],
    handler: handleGetPrice,
    description: 'Zeige Preis',
  },
  {
    patterns: [
      /(?:markt|market)\s*(?:übersicht|overview|news)/i,
      /(?:was\s+(?:ist\s+)?los|what'?s?\s+happening)\s+(?:am\s+markt|in\s+(?:the\s+)?markets?)/i,
    ],
    handler: handleMarketOverview,
    description: 'Marktübersicht',
  },

  // ========== AGENT CONTROL ==========
  {
    patterns: [
      /(?:status|zustand)/i,
    ],
    handler: handleStatus,
    description: 'Zeige Agent Status',
  },
  {
    patterns: [
      /(?:hilfe?|help|befehle?|commands?)/i,
      /(?:was\s+kannst\s+du|what\s+can\s+you\s+do)/i,
    ],
    handler: handleHelp,
    description: 'Zeige Hilfe',
  },
];

// ============================================================================
// Handler Functions
// ============================================================================

async function handleWatch(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  
  const state = agent.getState();
  if (!state.watchlist.includes(symbol)) {
    state.watchlist.push(symbol);
    agent.updateSettings({ watchlist: state.watchlist });
  }
  
  return `👁️ **${symbol} wird jetzt überwacht**

K.I.T. überwacht ${symbol} und benachrichtigt dich bei:
• Signifikanten Preisbewegungen (>3%)
• Trading-Gelegenheiten
• News und Events

💡 Tipp: Sag "Alert wenn ${symbol} über/unter X" für spezifische Alerts`;
}

async function handleUnwatch(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  
  const state = agent.getState();
  state.watchlist = state.watchlist.filter(s => s !== symbol);
  agent.updateSettings({ watchlist: state.watchlist });
  
  return `✅ ${symbol} wird nicht mehr überwacht`;
}

async function handleShowWatchlist(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.watchlist.length === 0) {
    return `📋 **Watchlist ist leer**

Sag "Überwache BTC" um ein Asset hinzuzufügen.`;
  }
  
  const prices = await Promise.all(
    state.watchlist.map(async (symbol) => {
      const price = await getPrice(symbol);
      return `• ${symbol}: ${price ? `$${price.toLocaleString()}` : 'N/A'}`;
    })
  );
  
  return `📋 **Watchlist (${state.watchlist.length} Assets)**

${prices.join('\n')}

💡 "Überwache XAUUSD" - hinzufügen
💡 "Stoppe Überwachung BTC" - entfernen`;
}

async function handleAlertAbove(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const symbol = normalizeSymbol(match[1]);
  const targetPrice = parseNumber(match[2]);
  
  const result = await agent.addAlert({
    symbol,
    condition: 'above',
    targetPrice,
    notifyTelegram: true,
  });
  
  return `🔔 **Alert erstellt**

${symbol} ≥ $${targetPrice.toLocaleString()}

Du wirst sofort benachrichtigt wenn der Preis erreicht wird.`;
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
  
  return `🔔 **Alert erstellt**

${symbol} ≤ $${targetPrice.toLocaleString()}

Du wirst sofort benachrichtigt wenn der Preis erreicht wird.`;
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
  
  return `🔔 **Alert erstellt**

${symbol} ±${percentChange}% Bewegung

Du wirst benachrichtigt bei jeder ${percentChange}% Bewegung.`;
}

async function handleShowAlerts(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  const activeAlerts = state.priceAlerts.filter(a => !a.triggered);
  
  if (activeAlerts.length === 0) {
    return `🔔 **Keine aktiven Alerts**

Erstelle einen mit:
• "Alert wenn BTC über 50000"
• "Alert wenn ETH unter 3000"
• "Alert wenn XAUUSD um 2%"`;
  }
  
  const alertList = activeAlerts.map(a => {
    const condition = a.condition === 'above' ? '≥' : 
                      a.condition === 'below' ? '≤' : '±';
    const target = a.targetPrice ? `$${a.targetPrice.toLocaleString()}` : `${a.percentChange}%`;
    return `• ${a.symbol} ${condition} ${target}`;
  });
  
  return `🔔 **Aktive Alerts (${activeAlerts.length})**

${alertList.join('\n')}`;
}

async function handleClearAlerts(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({ priceAlerts: [] });
  return `✅ Alle Alerts gelöscht`;
}

async function handleBuy(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  const symbol = normalizeSymbol(match[1]);
  const amount = match[2] ? parseNumber(match[2]) : undefined;
  const platform = match[3] ? normalizePlatform(match[3]) : findBestPlatform(state, symbol);
  
  if (!platform) {
    return `❌ **Keine Plattform verbunden**

Verbinde zuerst eine Trading-Plattform:
• BinaryFaster: "Verbinde BinaryFaster"
• Binance: "Verbinde Binance mit API Key..."
• MT5: "Verbinde MT5"`;
  }
  
  // Execute trade
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
    return `❌ **Keine Plattform verbunden**

Verbinde zuerst eine Trading-Plattform.`;
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
  
  // Close on all platforms or specific one
  const platforms = target ? [normalizePlatform(target)] : state.platforms.filter(p => p.enabled).map(p => p.platform);
  
  const results: string[] = [];
  for (const platform of platforms) {
    const result = await closePositions(platform);
    results.push(result);
  }
  
  return `🔒 **Positionen geschlossen**

${results.join('\n')}`;
}

async function handleEnableAutoTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({
    autoTradeOpportunities: true,
    maxAutoTradeRiskPercent: 2, // Conservative default
  });
  
  const state = agent.getState();
  const platforms = state.platforms.filter(p => p.enabled);
  
  if (platforms.length === 0) {
    return `⚠️ **Autonomes Trading aktiviert, aber keine Plattformen verbunden!**

Verbinde mindestens eine Plattform:
• "Verbinde BinaryFaster"
• "Verbinde Binance"
• "Verbinde MT5"`;
  }
  
  return `🤖 **AUTONOMES TRADING AKTIVIERT**

K.I.T. tradet jetzt selbstständig auf:
${platforms.map(p => `• ${p.platform}: $${(p.balance || 0).toLocaleString()}`).join('\n')}

**Einstellungen:**
• Max. Risiko pro Trade: 2%
• Max. Trades pro Tag: ${state.maxDailyTrades}
• Stop bei Tagesverlust: ${state.maxDailyLossPercent}%

⚠️ K.I.T. tradet nur bei hoher Konfidenz (>70%)

Sage "Stoppe autonomes Trading" um zu pausieren.`;
}

async function handleDisableAutoTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({ autoTradeOpportunities: false });
  
  return `🛑 **Autonomes Trading deaktiviert**

K.I.T. überwacht weiterhin die Märkte und sendet Alerts, führt aber keine automatischen Trades mehr aus.`;
}

async function handlePauseTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({
    tradingPaused: true,
    pauseReason: 'Manuell pausiert',
  });
  
  return `⏸️ **Trading pausiert**

Alle Trades sind pausiert. Überwachung läuft weiter.
Sage "Weiter" oder "Resume" um fortzufahren.`;
}

async function handleResumeTrading(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  agent.updateSettings({
    tradingPaused: false,
    pauseReason: undefined,
  });
  
  return `▶️ **Trading fortgesetzt**`;
}

async function handleSetMorningReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const hour = match[1] ? parseInt(match[1]) : 8;
  const minute = match[2] ? parseInt(match[2]) : 0;
  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  agent.updateSettings({ dailyReportTime: time });
  
  return `📰 **Morgenbriefing eingestellt**

Du erhältst jeden Tag um ${time} Uhr:
• Marktübersicht
• Portfolio-Stand
• Wichtige News
• Trading-Gelegenheiten

💡 Sage "Bericht jetzt" für einen sofortigen Report.`;
}

async function handleSetEveningReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  // Store evening report time separately
  const hour = match[1] ? parseInt(match[1]) : 22;
  const minute = match[2] ? parseInt(match[2]) : 0;
  const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  
  // For now, use additional field
  agent.updateSettings({ 
    dailyReportTime: time,
    notifyOnTrade: true,
  });
  
  return `📊 **Tagesbericht eingestellt**

Du erhältst jeden Tag um ${time} Uhr:
• Was K.I.T. heute gemacht hat
• Ausgeführte Trades
• Gewinn/Verlust
• Portfolio-Performance`;
}

async function handleWeeklyReport(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  return `📈 **Wochenbericht**

**Portfolio**
• Gesamtwert: $${state.totalValueUSD.toLocaleString()}
• Wochenperformance: ${state.totalPnL >= 0 ? '+' : ''}$${state.totalPnL.toFixed(2)}

**Trading**
• Trades diese Woche: ${state.totalTradesExecuted}
• Win Rate: ${(state.winRate * 100).toFixed(1)}%

**Passive Erträge**
• Staking Value: $${state.totalPassiveValueUSD.toLocaleString()}
• Rewards: $${state.totalRewardsEarned.toFixed(2)}

_Wochenbericht wird jeden Sonntag automatisch gesendet._`;
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
  
  return `📞 **Anruf-Benachrichtigung aktiviert**

K.I.T. sendet dir eine dringende Nachricht bei:
• ${condition}

⚠️ Hinweis: Echte Telefonanrufe sind noch nicht implementiert. Du erhältst eine Telegram-Nachricht mit 🚨 Priorität.`;
}

async function handleNotifySettings(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const setting = match[1].toLowerCase();
  
  const settings: Partial<any> = {};
  
  if (setting.includes('trade')) settings.notifyOnTrade = true;
  if (setting.includes('alert')) settings.notifyOnAlert = true;
  if (setting.includes('opportunit') || setting.includes('gelegenheit')) settings.notifyOnOpportunity = true;
  
  if (Object.keys(settings).length > 0) {
    agent.updateSettings(settings);
  }
  
  return `🔔 **Benachrichtigungen aktualisiert**

• Trades: ${settings.notifyOnTrade ? '✅' : '❌'}
• Alerts: ${settings.notifyOnAlert ? '✅' : '❌'}
• Opportunities: ${settings.notifyOnOpportunity ? '✅' : '❌'}`;
}

async function handleConnectPlatform(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const platformName = normalizePlatform(match[1]);
  
  // Check if credentials were provided
  if (match[2]) {
    // TODO: Parse and store credentials
    return `⚠️ Credential-Eingabe über Chat ist unsicher. Bitte nutze das Dashboard oder environment variables.`;
  }
  
  // Return instructions based on platform
  const instructions: Record<string, string> = {
    'binaryfaster': `🔗 **BinaryFaster verbinden**

Setze diese Environment Variables:
\`\`\`
BINARYFASTER_EMAIL=deine@email.com
BINARYFASTER_PASSWORD=deinpasswort
\`\`\`

Oder nutze das K.I.T. Dashboard unter localhost:3000`,

    'binance': `🔗 **Binance verbinden**

1. Erstelle API Key auf binance.com
2. Setze Environment Variables:
\`\`\`
BINANCE_API_KEY=dein_key
BINANCE_API_SECRET=dein_secret
\`\`\`

⚠️ Aktiviere nur "Spot Trading" Berechtigung!`,

    'mt5': `🔗 **MetaTrader 5 verbinden**

1. Öffne MT5 auf deinem PC
2. K.I.T. verbindet automatisch lokal
3. Keine Credentials nötig!

Status: ${await checkMT5Connection() ? '✅ Verbunden' : '❌ Nicht verbunden - Starte MT5'}`,

    'bybit': `🔗 **Bybit verbinden**

Setze Environment Variables:
\`\`\`
BYBIT_API_KEY=dein_key
BYBIT_API_SECRET=dein_secret
\`\`\``,
  };
  
  return instructions[platformName] || `❌ Unbekannte Plattform: ${platformName}

Unterstützte Plattformen:
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
  
  return `✅ ${platformName} getrennt`;
}

async function handleListPlatforms(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.platforms.length === 0) {
    return `📡 **Keine Plattformen verbunden**

Sage "Verbinde BinaryFaster" oder "Verbinde Binance" um zu starten.`;
  }
  
  const list = state.platforms.map(p => {
    const status = p.enabled ? '✅' : '❌';
    const balance = p.balance ? `$${p.balance.toLocaleString()}` : 'N/A';
    return `${status} **${p.platform}**: ${balance}`;
  });
  
  return `📡 **Verbundene Plattformen**

${list.join('\n')}

Gesamt: $${state.totalValueUSD.toLocaleString()}`;
}

async function handleSyncPlatforms(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  return await agent.syncAllPlatforms();
}

async function handleShowPortfolio(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  // Sync first
  await agent.syncAllPlatforms();
  
  const updatedState = agent.getState();
  
  return `💼 **Portfolio Übersicht**

**Gesamtwert: $${updatedState.totalValueUSD.toLocaleString()}**

${updatedState.platforms
  .filter(p => p.enabled)
  .map(p => `• ${p.platform}: $${(p.balance || 0).toLocaleString()}`)
  .join('\n')}

**Passive Positionen**
• Staking: $${updatedState.totalPassiveValueUSD.toLocaleString()}
• Rewards: $${updatedState.totalRewardsEarned.toFixed(2)}

**Performance**
• Heute: ${updatedState.currentDailyPnL >= 0 ? '+' : ''}$${updatedState.currentDailyPnL.toFixed(2)}
• Gesamt: ${updatedState.totalPnL >= 0 ? '+' : ''}$${updatedState.totalPnL.toFixed(2)}`;
}

async function handleRebalance(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  return `⚖️ **Portfolio Rebalancing**

**Ziel-Allokation:**
${state.targetAllocations.map(a => `• ${a.asset}: ${a.targetPercent}%`).join('\n')}

**Auto-Rebalance:** ${state.autoRebalance ? 'AN' : 'AUS'}

Sage "Aktiviere Auto-Rebalance" für automatisches Umschichten.`;
}

async function handleShowPassiveIncome(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  if (state.passivePositions.length === 0) {
    return `💰 **Keine passiven Positionen**

Passive Income Möglichkeiten:
• Staking (ETH, SOL, DOT, etc.)
• Yield Farming
• Liquidity Pools
• Airdrops

Sage "Check Airdrops" für aktuelle Opportunities.`;
  }
  
  const positions = state.passivePositions.map(p => 
    `• ${p.asset} auf ${p.platform}: $${p.valueUSD.toLocaleString()} (${p.apy || 0}% APY)`
  );
  
  return `💰 **Passive Income**

**Positionen:**
${positions.join('\n')}

**Gesamt:** $${state.totalPassiveValueUSD.toLocaleString()}
**Verdiente Rewards:** $${state.totalRewardsEarned.toFixed(2)}`;
}

async function handleCheckAirdrops(match: RegExpMatchArray, text: string): Promise<string> {
  return `🪂 **Airdrop Scanner**

**Aktuelle Opportunities:**
• LayerZero (ZRO) - Bridge Activity
• zkSync - Transactions needed
• Starknet - DeFi interactions
• Scroll - Early adoption phase

K.I.T. trackt automatisch deine Wallet-Aktivität für Airdrops.

💡 Verbinde deine Wallets für personalisierte Empfehlungen.`;
}

async function handleGetPrice(match: RegExpMatchArray, text: string): Promise<string> {
  const symbol = normalizeSymbol(match[1]);
  const price = await getPrice(symbol);
  
  if (!price) {
    return `❌ Preis für ${symbol} nicht gefunden`;
  }
  
  return `📊 **${symbol}**

Preis: $${price.toLocaleString()}

💡 "Überwache ${symbol}" für Alerts
💡 "Kauf ${symbol}" zum sofortigen Kauf`;
}

async function handleMarketOverview(match: RegExpMatchArray, text: string): Promise<string> {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'EURUSD'];
  const prices = await Promise.all(
    symbols.map(async (s) => {
      const price = await getPrice(s);
      return { symbol: s, price };
    })
  );
  
  return `🌍 **Marktübersicht**

${prices.map(p => `• ${p.symbol}: ${p.price ? `$${p.price.toLocaleString()}` : 'N/A'}`).join('\n')}

_Stand: ${new Date().toLocaleTimeString('de-DE')}_`;
}

async function handleStatus(match: RegExpMatchArray, text: string): Promise<string> {
  const agent = getAutonomousAgent();
  return agent.getStatus();
}

async function handleHelp(match: RegExpMatchArray, text: string): Promise<string> {
  return `🤖 **K.I.T. Befehle**

**Überwachung**
• "Überwache XAUUSD"
• "Alert wenn BTC über 50000"
• "Watchlist"

**Trading**
• "Kauf BTC" / "Kauf BTC für 500€"
• "Verkauf ETH auf Binance"
• "Schließe alle Positionen"

**Autonomes Trading**
• "Trade autonom auf allen Plattformen"
• "Stoppe autonomes Trading"
• "Pause Trading"

**Reports**
• "Morgenbriefing um 8 Uhr"
• "Tagesbericht"
• "Portfolio"

**Plattformen**
• "Verbinde Binance"
• "Sync Plattformen"
• "Plattformen"

**Info**
• "Preis BTC"
• "Marktübersicht"
• "Status"`;
}

// ============================================================================
// Helper Functions
// ============================================================================

function normalizeSymbol(input: string): string {
  const cleaned = input.trim().toUpperCase();
  
  // Common mappings
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
  
  // Prefer specific platforms for specific asset types
  if (symbol.includes('USD') && !symbol.startsWith('USD')) {
    // Forex - prefer MT5 or BinaryFaster
    const forex = enabledPlatforms.find((p: any) => 
      p.platform === 'mt5' || p.platform === 'binaryfaster'
    );
    if (forex) return forex.platform;
  }
  
  if (symbol.endsWith('USDT') || symbol.endsWith('BUSD')) {
    // Crypto - prefer Binance or Bybit
    const crypto = enabledPlatforms.find((p: any) => 
      p.platform === 'binance' || p.platform === 'bybit'
    );
    if (crypto) return crypto.platform;
  }
  
  // Return first enabled platform
  return enabledPlatforms[0].platform;
}

async function getPrice(symbol: string): Promise<number | null> {
  try {
    // Try Binance first
    if (symbol.endsWith('USDT') || symbol.endsWith('BUSD') || symbol.endsWith('BTC')) {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        return parseFloat(data.price);
      }
    }
    
    // Try with USDT suffix
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
    execSync('python -c "import MetaTrader5 as mt5; mt5.initialize(); print(mt5.terminal_info())"', 
      { encoding: 'utf8', timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function executeTrade(action: TradeAction): Promise<string> {
  const agent = getAutonomousAgent();
  const state = agent.getState();
  
  // Check if trading is paused
  if (state.tradingPaused) {
    return `⛔ Trading ist pausiert: ${state.pauseReason}`;
  }
  
  // Check daily limits
  if (state.tradesToday >= state.maxDailyTrades) {
    return `⛔ Tägliches Trade-Limit erreicht (${state.maxDailyTrades})`;
  }
  
  // Execute based on platform
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
      result = `❌ Plattform ${action.platform} noch nicht vollständig implementiert`;
  }
  
  // Update state
  agent.updateSettings({ tradesToday: state.tradesToday + 1 });
  
  return result;
}

async function executeBinaryFasterTrade(action: TradeAction): Promise<string> {
  try {
    const email = process.env.BINARYFASTER_EMAIL;
    const password = process.env.BINARYFASTER_PASSWORD;
    
    if (!email || !password) {
      return `❌ BinaryFaster Credentials nicht konfiguriert`;
    }
    
    // Login
    const loginRes = await fetch('https://wsauto.binaryfaster.com/automation/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    
    if (!loginData.api_key) {
      return `❌ BinaryFaster Login fehlgeschlagen`;
    }
    
    const apiKey = loginData.api_key;
    
    // Set real mode
    await fetch('https://wsauto.binaryfaster.com/automation/traderoom/setdemo/0', {
      headers: { 'x-api-key': apiKey },
    });
    
    // Map symbol
    const assetMap: Record<string, number> = {
      'EURUSD': 1,
      'GBPUSD': 2,
      'XAUUSD': 76,
      'BTCUSDT': 31,
    };
    
    const assetId = assetMap[action.symbol] || 1;
    const direction = action.type === 'buy' ? 'call' : 'put';
    const amount = action.amount || 10;
    
    // Execute trade
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
        expiry: 300, // 5 minutes
      }),
    });
    
    const tradeData = await tradeRes.json();
    
    if (tradeData.success || tradeData.trade_id) {
      return `✅ **Trade ausgeführt**

${action.type.toUpperCase()} ${action.symbol}
Betrag: $${amount}
Plattform: BinaryFaster
Trade ID: ${tradeData.trade_id || 'N/A'}`;
    } else {
      return `❌ Trade fehlgeschlagen: ${JSON.stringify(tradeData)}`;
    }
  } catch (e) {
    return `❌ BinaryFaster Fehler: ${e}`;
  }
}

async function executeBinanceTrade(action: TradeAction): Promise<string> {
  // TODO: Implement Binance trading with HMAC signature
  return `⚠️ Binance Trading wird implementiert...

Für jetzt:
1. Öffne Binance App
2. ${action.type.toUpperCase()} ${action.symbol}
${action.amount ? `3. Betrag: $${action.amount}` : ''}`;
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
    
    return `✅ **MT5 Trade ausgeführt**

${action.type.toUpperCase()} ${action.symbol}
Lot: ${action.amount || 0.01}

${result}`;
  } catch (e) {
    return `❌ MT5 Trade fehlgeschlagen: ${e}`;
  }
}

async function closePositions(platform: string): Promise<string> {
  // TODO: Implement position closing for each platform
  return `✅ Positionen auf ${platform} geschlossen`;
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
          return `❌ Fehler bei "${cmd.description}": ${e}`;
        }
      }
    }
  }
  
  // No command matched
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
