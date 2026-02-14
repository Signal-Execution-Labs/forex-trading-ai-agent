/**
 * News Sentiment Monitor Hook
 * 
 * Monitors news sentiment for portfolio assets.
 * Alerts on significant sentiment shifts that could affect positions.
 */

const fs = require('fs');
const path = require('path');

// Sentiment thresholds
const BEARISH_THRESHOLD = 0.35;
const BULLISH_THRESHOLD = 0.65;
const SENTIMENT_CHANGE_ALERT = 0.2;

// Cache for previous sentiment
let previousSentiment = new Map();

/**
 * Simple keyword-based sentiment analysis (demo)
 * In production, use AI or news API with sentiment
 */
function analyzeSentiment(text) {
  const bullishWords = [
    'surge', 'rally', 'bullish', 'breakout', 'soar', 'gain', 'profit',
    'upgrade', 'beat', 'exceeds', 'growth', 'partnership', 'launch',
    'adoption', 'record', 'ATH', 'pump', 'moon', 'buy'
  ];
  
  const bearishWords = [
    'crash', 'dump', 'bearish', 'plunge', 'fall', 'loss', 'downgrade',
    'miss', 'concern', 'warning', 'risk', 'decline', 'drop', 'sell',
    'hack', 'scam', 'lawsuit', 'investigation', 'ban', 'regulation'
  ];
  
  const lowerText = text.toLowerCase();
  let score = 0.5; // neutral baseline
  
  for (const word of bullishWords) {
    if (lowerText.includes(word)) score += 0.05;
  }
  
  for (const word of bearishWords) {
    if (lowerText.includes(word)) score -= 0.05;
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Get mock news for demo (in production, fetch from news API)
 */
function getMockNews(symbol) {
  const headlines = {
    BTC: [
      { title: 'Bitcoin ETF sees record inflows', sentiment: 0.75 },
      { title: 'Institutional adoption continues', sentiment: 0.7 },
      { title: 'Fed rate concerns weigh on crypto', sentiment: 0.4 }
    ],
    ETH: [
      { title: 'Ethereum upgrade boosts performance', sentiment: 0.8 },
      { title: 'DeFi TVL reaches new highs', sentiment: 0.7 },
      { title: 'Gas fees spike concerns users', sentiment: 0.35 }
    ],
    SOL: [
      { title: 'Solana network stability improves', sentiment: 0.65 },
      { title: 'New ecosystem projects launch', sentiment: 0.7 }
    ],
    AAPL: [
      { title: 'Apple announces new product line', sentiment: 0.7 },
      { title: 'Supply chain challenges persist', sentiment: 0.4 }
    ],
    GOOGL: [
      { title: 'Google AI advancements impress', sentiment: 0.75 },
      { title: 'Regulatory scrutiny increases', sentiment: 0.35 }
    ]
  };
  
  return headlines[symbol] || [
    { title: `${symbol} trading normally`, sentiment: 0.5 }
  ];
}

/**
 * Calculate aggregate sentiment for a symbol
 */
function getAggregateSentiment(symbol) {
  const news = getMockNews(symbol);
  if (news.length === 0) return 0.5;
  
  const avg = news.reduce((sum, item) => sum + item.sentiment, 0) / news.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Classify sentiment score
 */
function classifySentiment(score) {
  if (score >= BULLISH_THRESHOLD) return 'bullish';
  if (score <= BEARISH_THRESHOLD) return 'bearish';
  return 'neutral';
}

/**
 * Get sentiment emoji
 */
function getSentimentEmoji(classification) {
  switch (classification) {
    case 'bullish': return '🟢';
    case 'bearish': return '🔴';
    default: return '🟡';
  }
}

/**
 * Check for sentiment changes
 */
function checkSentimentChanges(symbol, currentSentiment) {
  const prevSentiment = previousSentiment.get(symbol);
  previousSentiment.set(symbol, currentSentiment);
  
  if (prevSentiment === undefined) return null;
  
  const change = currentSentiment - prevSentiment;
  if (Math.abs(change) >= SENTIMENT_CHANGE_ALERT) {
    return {
      symbol,
      previous: prevSentiment,
      current: currentSentiment,
      change: Math.round(change * 100) / 100,
      direction: change > 0 ? 'improving' : 'deteriorating'
    };
  }
  
  return null;
}

/**
 * Hook handler - runs on market:open and signal:received
 */
module.exports = async function handler(event, context) {
  const { eventName, payload } = event;
  const timestamp = new Date().toISOString();
  
  // Get symbols to monitor
  let symbols = payload?.symbols || ['BTC', 'ETH', 'SOL', 'AAPL', 'GOOGL'];
  
  // If signal received, prioritize that symbol
  if (eventName === 'signal:received' && payload?.symbol) {
    symbols = [payload.symbol];
  }
  
  // Analyze sentiment for each symbol
  const results = [];
  const alerts = [];
  const changes = [];
  
  for (const symbol of symbols) {
    const sentiment = getAggregateSentiment(symbol);
    const classification = classifySentiment(sentiment);
    const news = getMockNews(symbol);
    
    const result = {
      symbol,
      sentiment,
      classification,
      emoji: getSentimentEmoji(classification),
      headlines: news.length
    };
    
    results.push(result);
    
    // Alert on bearish sentiment
    if (classification === 'bearish') {
      alerts.push({
        symbol,
        sentiment,
        reason: 'Bearish news sentiment detected'
      });
    }
    
    // Check for sentiment changes
    const change = checkSentimentChanges(symbol, sentiment);
    if (change) {
      changes.push(change);
    }
  }
  
  // Log findings
  if (eventName === 'market:open') {
    console.log(`📰 [News Sentiment] Morning scan for ${symbols.length} assets:`);
    for (const r of results) {
      console.log(`   ${r.emoji} ${r.symbol}: ${r.sentiment} (${r.classification})`);
    }
  }
  
  if (alerts.length > 0) {
    console.log(`⚠️ [News Sentiment] Bearish alerts:`);
    for (const alert of alerts) {
      console.log(`   🔴 ${alert.symbol}: ${alert.reason}`);
    }
  }
  
  if (changes.length > 0) {
    console.log(`📊 [News Sentiment] Sentiment shifts:`);
    for (const c of changes) {
      const arrow = c.direction === 'improving' ? '↗️' : '↘️';
      console.log(`   ${arrow} ${c.symbol}: ${c.previous} → ${c.current} (${c.direction})`);
    }
  }
  
  // Save report
  try {
    const reportsDir = path.join(process.cwd(), 'workspace', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const dateStr = new Date().toISOString().split('T')[0];
    const reportPath = path.join(reportsDir, `sentiment_${dateStr}.json`);
    
    const report = { timestamp, event: eventName, results, alerts, changes };
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  } catch (err) {
    // Silently fail
  }
  
  return {
    success: true,
    scanned: symbols.length,
    alerts: alerts.length,
    sentimentShifts: changes.length,
    results
  };
};
