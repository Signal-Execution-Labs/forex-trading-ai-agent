/**
 * Twitter Posting Example
 * 
 * This example shows how to use K.I.T.'s Twitter posting skill to
 * share trading signals, analysis, and performance reports.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Path to the Twitter poster module
const TWITTER_POSTER_PATH = '../skills/twitter-posting/twitter_poster.py';

/**
 * Example 1: Post a trading signal
 */
async function postSignal() {
    console.log('\n🐦 Example 1: Post Trading Signal\n');
    
    const { stdout } = await execAsync(
        `python3 ${TWITTER_POSTER_PATH} signal BTC/USDT LONG 45000 --tp 46000 47000 --sl 44000`
    );
    
    console.log('Result:');
    console.log(stdout);
}

/**
 * Example 2: Post market analysis
 */
async function postAnalysis() {
    console.log('\n🐦 Example 2: Post Market Analysis\n');
    
    const { stdout } = await execAsync(
        `python3 ${TWITTER_POSTER_PATH} analysis ETH/USDT --timeframe 4H --bias BULLISH`
    );
    
    console.log('Result:');
    console.log(stdout);
}

/**
 * Example 3: Post a custom tweet
 */
async function postCustom() {
    console.log('\n🐦 Example 3: Post Custom Tweet\n');
    
    const message = "📊 Market Update: BTC showing strength above $45K. Key levels to watch: Support $44K, Resistance $47K. #Bitcoin #Crypto";
    
    const { stdout } = await execAsync(
        `python3 ${TWITTER_POSTER_PATH} post "${message}"`
    );
    
    console.log('Result:');
    console.log(stdout);
}

/**
 * Example 4: Get posting statistics
 */
async function getStats() {
    console.log('\n🐦 Example 4: Get Posting Statistics\n');
    
    const { stdout } = await execAsync(
        `python3 ${TWITTER_POSTER_PATH} stats`
    );
    
    console.log('Statistics:');
    console.log(stdout);
}

/**
 * Example 5: View tweet history
 */
async function getHistory() {
    console.log('\n🐦 Example 5: Tweet History\n');
    
    const { stdout } = await execAsync(
        `python3 ${TWITTER_POSTER_PATH} history --limit 5`
    );
    
    console.log('Recent tweets:');
    console.log(stdout);
}

/**
 * Example 6: Programmatic usage for auto-posting
 */
function programmaticAutoPostExample() {
    console.log('\n🐦 Example 6: Auto-Posting Setup (TypeScript)\n');
    
    const code = `
import { TwitterPoster, SignalData, AnalysisData, PerformanceData } from 'kit/skills/twitter-posting';

// Initialize with credentials from environment
const twitter = new TwitterPoster({
    credentials: {
        apiKey: process.env.TWITTER_API_KEY,
        apiSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET
    },
    autoPost: {
        signals: true,
        analysis: true,
        performance: true
    },
    rateLimits: {
        maxPerHour: 4,
        maxPerDay: 20,
        minIntervalMinutes: 15
    }
});

// Auto-post when K.I.T. generates a signal
kit.on('signal', async (signal) => {
    if (signal.confidence >= 0.7) {
        const signalData: SignalData = {
            symbol: signal.symbol,
            action: signal.action,
            entryPrice: signal.price,
            takeProfit: signal.targets,
            stopLoss: signal.stopLoss,
            confidence: signal.confidence,
            rsi: signal.indicators?.rsi,
            macdStatus: signal.indicators?.macd
        };
        
        const result = await twitter.postSignal(signalData);
        console.log('Tweet posted:', result.url);
    }
});

// Post daily analysis at 8:00 AM
kit.schedule('0 8 * * *', async () => {
    const pairs = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'];
    
    for (const pair of pairs) {
        const analysis = await kit.analyze(pair, '4H');
        
        const analysisData: AnalysisData = {
            symbol: pair,
            timeframe: '4H',
            trend: analysis.trend,
            bias: analysis.bias,
            support: analysis.support,
            resistance: analysis.resistance,
            rsi: analysis.rsi,
            summary: analysis.summary
        };
        
        await twitter.postAnalysis(analysisData, analysis.chartPath);
        
        // Wait between posts
        await sleep(15 * 60 * 1000); // 15 minutes
    }
});

// Post weekly performance on Sundays at 8 PM
kit.schedule('0 20 * * 0', async () => {
    const performance = await kit.getPerformance('weekly');
    
    const perfData: PerformanceData = {
        period: 'weekly',
        totalTrades: performance.trades,
        wins: performance.wins,
        losses: performance.losses,
        totalPnl: performance.pnl,
        pnlPct: performance.pnlPercent,
        bestTrade: performance.best,
        worstTrade: performance.worst,
        topPerformers: performance.bySymbol.slice(0, 3)
    };
    
    await twitter.postPerformance(perfData, performance.chartPath);
});
`;

    console.log(code);
}

/**
 * Example 7: Tweet templates
 */
function tweetTemplateExamples() {
    console.log('\n🐦 Example 7: Tweet Templates\n');
    
    const templates = {
        signal: `
🟢 {symbol} LONG Signal

📈 Entry: \${entry_price}
🎯 TP1: \${tp1} (+{tp1_pct}%)
🎯 TP2: \${tp2} (+{tp2_pct}%)
🛑 SL: \${stop_loss} ({sl_pct}%)

📊 RSI: {rsi}
📈 MACD: {macd_status}

Confidence: {confidence_emoji} {confidence}%

⚡ Powered by K.I.T.
#{symbol_tag} #Crypto #Trading
`,
        analysis: `
📊 {symbol} {timeframe} Analysis

{summary}

Key Levels:
• Resistance: \${resistance}
• Support: \${support}

📈 RSI: {rsi}
📊 Trend: {trend}

Bias: {bias} {bias_emoji}

#{symbol_tag} #TechnicalAnalysis #Crypto
`,
        performance: `
📈 K.I.T. {period} Performance

📊 Trades: {total_trades}
✅ Wins: {wins} ({win_rate}%)
❌ Losses: {losses}

💰 Total P&L: {pnl_sign}\${pnl} ({pnl_pct}%)

Top Performers:
{top_performers}

#TradingResults #Performance #Crypto
`
    };
    
    console.log('Signal Template:');
    console.log(templates.signal);
    
    console.log('\nAnalysis Template:');
    console.log(templates.analysis);
    
    console.log('\nPerformance Template:');
    console.log(templates.performance);
}

/**
 * Example 8: Chart generation for tweets
 */
function chartGenerationExample() {
    console.log('\n🐦 Example 8: Chart Generation (Conceptual)\n');
    
    const code = `
import { ChartGenerator } from 'kit/skills/twitter-posting/charts';

// Generate a candlestick chart for a signal
const chart = new ChartGenerator();

const chartPath = await chart.generateSignalChart({
    symbol: 'BTC/USDT',
    timeframe: '4H',
    candles: 50,
    indicators: ['ema:20', 'ema:50', 'rsi'],
    signal: {
        entry: 45000,
        targets: [46000, 47000],
        stopLoss: 44000
    },
    theme: 'dark',
    width: 1200,
    height: 800
});

// Post with chart
await twitter.postSignal(signalData, { imagePath: chartPath });
`;

    console.log(code);
}

// Run examples
async function main() {
    console.log('=' .repeat(60));
    console.log('K.I.T. Twitter Posting Examples');
    console.log('=' .repeat(60));
    
    try {
        await postSignal();
        await postAnalysis();
        await postCustom();
        await getStats();
        await getHistory();
        programmaticAutoPostExample();
        tweetTemplateExamples();
        chartGenerationExample();
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
