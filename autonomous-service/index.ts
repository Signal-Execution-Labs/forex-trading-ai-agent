/**
 * K.I.T. Autonomous Service
 * Standalone service for 24/7 autonomous financial monitoring
 * 
 * Deploys to Render/Railway/any Node.js host
 */

import express from 'express';

// Configuration from environment
const CONFIG = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  heartbeatMs: parseInt(process.env.HEARTBEAT_MS || '60000'),
  port: parseInt(process.env.PORT || '3000'),
};

// State
interface AgentState {
  running: boolean;
  lastHeartbeat: string;
  watchlist: string[];
  prices: Map<string, { price: number; lastUpdate: string }>;
  alerts: Array<{ id: string; symbol: string; condition: string; target: number; triggered: boolean }>;
  passiveIncome: Array<{ platform: string; asset: string; value: number; apy: number }>;
}

const state: AgentState = {
  running: false,
  lastHeartbeat: '',
  watchlist: ['BTCUSDT', 'ETHUSDT', 'XAUUSD', 'EURUSD', 'SOLUSDT'],
  prices: new Map(),
  alerts: [],
  passiveIncome: [],
};

// Telegram notification
async function sendTelegram(message: string): Promise<void> {
  if (!CONFIG.telegramToken || !CONFIG.telegramChatId) return;
  
  try {
    await fetch(`https://api.telegram.org/bot${CONFIG.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CONFIG.telegramChatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    console.error('Telegram error:', e);
  }
}

// Fetch prices from Binance
async function fetchPrices(): Promise<void> {
  for (const symbol of state.watchlist) {
    try {
      // Skip forex symbols
      if (!symbol.endsWith('USDT') && !symbol.endsWith('BTC')) continue;
      
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
      const data = await res.json() as { price: string };
      const price = parseFloat(data.price);
      
      const prev = state.prices.get(symbol);
      state.prices.set(symbol, { price, lastUpdate: new Date().toISOString() });
      
      // Check for significant moves
      if (prev) {
        const change = ((price - prev.price) / prev.price) * 100;
        if (Math.abs(change) > 3) {
          await sendTelegram(`📊 *${symbol}* ${change > 0 ? '📈' : '📉'} ${change.toFixed(2)}%\nPrice: $${price.toLocaleString()}`);
        }
      }
    } catch (e) {
      // Skip errors for individual symbols
    }
  }
}

// Check price alerts
async function checkAlerts(): Promise<void> {
  for (const alert of state.alerts) {
    if (alert.triggered) continue;
    
    const priceData = state.prices.get(alert.symbol);
    if (!priceData) continue;
    
    let triggered = false;
    if (alert.condition === 'above' && priceData.price >= alert.target) triggered = true;
    if (alert.condition === 'below' && priceData.price <= alert.target) triggered = true;
    
    if (triggered) {
      alert.triggered = true;
      await sendTelegram(`🚨 *ALERT TRIGGERED*\n\n${alert.symbol} is now ${alert.condition} $${alert.target}\nCurrent: $${priceData.price.toLocaleString()}`);
    }
  }
}

// Heartbeat
async function heartbeat(): Promise<void> {
  if (!state.running) return;
  
  state.lastHeartbeat = new Date().toISOString();
  console.log(`[${state.lastHeartbeat}] Heartbeat - monitoring ${state.watchlist.length} symbols`);
  
  await fetchPrices();
  await checkAlerts();
}

// Express app
const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({
    service: 'K.I.T. Autonomous Agent',
    status: state.running ? 'running' : 'stopped',
    lastHeartbeat: state.lastHeartbeat,
    watchlist: state.watchlist,
    alerts: state.alerts.length,
    passivePositions: state.passiveIncome.length,
  });
});

// Start agent
app.post('/start', async (req, res) => {
  if (state.running) {
    return res.json({ success: false, message: 'Already running' });
  }
  
  state.running = true;
  await sendTelegram(`🤖 *K.I.T. Autonomous Agent STARTED*\n\n✅ Monitoring ${state.watchlist.length} symbols\n✅ Heartbeat: ${CONFIG.heartbeatMs / 1000}s`);
  
  // Start heartbeat loop
  setInterval(heartbeat, CONFIG.heartbeatMs);
  heartbeat();
  
  res.json({ success: true, message: 'Autonomous agent started' });
});

// Stop agent
app.post('/stop', async (req, res) => {
  state.running = false;
  await sendTelegram('🛑 *K.I.T. Autonomous Agent STOPPED*');
  res.json({ success: true, message: 'Autonomous agent stopped' });
});

// Add alert
app.post('/alert', (req, res) => {
  const { symbol, condition, target } = req.body;
  const alert = {
    id: `alert_${Date.now()}`,
    symbol,
    condition,
    target,
    triggered: false,
  };
  state.alerts.push(alert);
  res.json({ success: true, alert });
});

// Add passive income
app.post('/passive', (req, res) => {
  const { platform, asset, value, apy } = req.body;
  state.passiveIncome.push({ platform, asset, value, apy });
  res.json({ success: true, total: state.passiveIncome.length });
});

// Get status
app.get('/status', (req, res) => {
  const prices = Object.fromEntries(state.prices);
  const totalPassive = state.passiveIncome.reduce((s, p) => s + p.value, 0);
  
  res.json({
    running: state.running,
    lastHeartbeat: state.lastHeartbeat,
    watchlist: state.watchlist,
    prices,
    alerts: state.alerts,
    passiveIncome: state.passiveIncome,
    totalPassiveValue: totalPassive,
  });
});

// Daily report
app.get('/report', async (req, res) => {
  const prices = Object.fromEntries(state.prices);
  const totalPassive = state.passiveIncome.reduce((s, p) => s + p.value, 0);
  
  const report = `📊 *K.I.T. Daily Report*
📅 ${new Date().toLocaleDateString()}

💰 *Passive Income*
Total Staked: $${totalPassive.toLocaleString()}
Positions: ${state.passiveIncome.length}

📈 *Market Prices*
${Object.entries(prices).map(([s, p]) => `• ${s}: $${(p as any).price.toLocaleString()}`).join('\n')}

🔔 *Alerts*
Active: ${state.alerts.filter(a => !a.triggered).length}
Triggered: ${state.alerts.filter(a => a.triggered).length}

_K.I.T. - Your Wealth is My Mission_ 🤖`;

  await sendTelegram(report);
  res.json({ success: true, report });
});

// Start server
app.listen(CONFIG.port, () => {
  console.log(`🤖 K.I.T. Autonomous Service running on port ${CONFIG.port}`);
  console.log(`   Telegram: ${CONFIG.telegramToken ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`   Heartbeat: ${CONFIG.heartbeatMs}ms`);
});
