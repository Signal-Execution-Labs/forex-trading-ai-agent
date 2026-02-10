/**
 * Social Trading Example
 * 
 * This example shows how to use K.I.T.'s social trading skill to
 * copy signals from various sources like Telegram bots, Discord, etc.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Path to the social trader module
const SOCIAL_TRADER_PATH = '../skills/social-trading/social_trader.py';

/**
 * Example 1: Add a Telegram signal source
 */
async function addTelegramSource() {
    console.log('\n👥 Example 1: Add Telegram Signal Source\n');
    
    const { stdout } = await execAsync(
        `python3 ${SOCIAL_TRADER_PATH} add telegram @CryptoSignalsVIP --name "Crypto VIP Signals"`
    );
    
    console.log(stdout);
}

/**
 * Example 2: List all configured sources
 */
async function listSources() {
    console.log('\n👥 Example 2: List Signal Sources\n');
    
    const { stdout } = await execAsync(
        `python3 ${SOCIAL_TRADER_PATH} sources`
    );
    
    console.log(stdout);
}

/**
 * Example 3: Test signal parsing
 */
async function testSignalParsing() {
    console.log('\n👥 Example 3: Test Signal Parsing\n');
    
    const testSignals = [
        // Format 1: Simple
        'BUY BTC/USDT @ 45000 TP: 46000 SL: 44000',
        
        // Format 2: Emoji-based
        '🟢 LONG ETH/USDT Entry: $2,450 Target: $2,650 Stop: $2,380',
        
        // Format 3: Crypto bot style
        '🚀 #BTC #LONG Entry Zone: 44800-45200 Targets: 46000 / 47000 Stop Loss: 44000',
        
        // Format 4: Forex style
        'EUR/USD SELL Entry: 1.0850 TP: 1.0750 SL: 1.0900'
    ];
    
    for (const signal of testSignals) {
        console.log(`\nInput: "${signal}"`);
        
        try {
            const { stdout } = await execAsync(
                `python3 ${SOCIAL_TRADER_PATH} test "${signal}"`
            );
            console.log(stdout);
        } catch (error) {
            console.log('❌ Could not parse');
        }
    }
}

/**
 * Example 4: Get performance statistics
 */
async function getStats() {
    console.log('\n👥 Example 4: Get Statistics\n');
    
    const { stdout } = await execAsync(
        `python3 ${SOCIAL_TRADER_PATH} stats`
    );
    
    console.log(stdout);
}

/**
 * Example 5: Programmatic usage
 */
function programmaticExample() {
    console.log('\n👥 Example 5: Programmatic Usage (TypeScript)\n');
    
    // This is how you'd use social trading in your own code
    const code = `
import { SocialTrader, SignalParser } from 'kit/skills/social-trading';

// Initialize trader
const trader = new SocialTrader({
    configPath: './config/social-trading.yaml'
});

// Add a signal source
trader.addSource({
    name: 'My Telegram Channel',
    type: 'telegram',
    channelId: '@MySignals',
    scaleFactor: 0.5,  // Copy at 50% size
    maxPositionPct: 5   // Max 5% per signal
});

// Process incoming signal
const result = trader.processSignal(
    '🟢 BTC/USDT LONG Entry: 45000 TP: 47000 SL: 44000',
    'My Telegram Channel'
);

if (result.status === 'ready') {
    console.log('Signal ready to execute:', result.signal);
    
    if (!result.needsConfirmation) {
        // Auto-execute
        trader.execute(result.signal);
    }
}
`;
    
    console.log(code);
}

/**
 * Example 6: Real-time signal monitoring simulation
 */
function realtimeMonitoringExample() {
    console.log('\n👥 Example 6: Real-time Monitoring (Conceptual)\n');
    
    const code = `
// Real-time signal monitoring example
const { SocialTrader } = require('kit/skills/social-trading');

const trader = new SocialTrader();

// Start listening to all configured sources
trader.startListening({
    onSignal: (signal, source) => {
        console.log(\`📥 Signal from \${source.name}\`);
        console.log(\`   \${signal.action} \${signal.symbol} @ \${signal.entryPrice}\`);
        
        // Process automatically
        const result = trader.processSignal(signal, source);
        
        if (result.needsConfirmation) {
            // Send notification for manual confirmation
            notify(\`New signal requires confirmation: \${signal.symbol}\`);
        } else {
            // Auto-execute
            trader.execute(result);
            notify(\`Executed: \${signal.action} \${signal.symbol}\`);
        }
    },
    onError: (error, source) => {
        console.error(\`Error from \${source.name}: \${error.message}\`);
    }
});

// Listen for graceful shutdown
process.on('SIGINT', () => {
    trader.stopListening();
    process.exit(0);
});
`;

    console.log(code);
}

// Run examples
async function main() {
    console.log('=' .repeat(60));
    console.log('K.I.T. Social Trading Examples');
    console.log('=' .repeat(60));
    
    try {
        await addTelegramSource();
        await listSources();
        await testSignalParsing();
        await getStats();
        programmaticExample();
        realtimeMonitoringExample();
    } catch (error) {
        console.error('Error:', error);
    }
}

main();
