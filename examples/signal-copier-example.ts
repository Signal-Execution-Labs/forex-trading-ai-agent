/**
 * K.I.T. Signal Copier Example
 * 
 * Copy trading signals from Telegram channels and execute automatically.
 * 
 * Usage:
 *   npx ts-node examples/signal-copier-example.ts
 */

import { SignalCopier, ExchangeManager } from '../src';

async function main() {
  console.log('🚗 K.I.T. Signal Copier Starting...\n');

  // 1. Connect to exchanges
  const exchanges = new ExchangeManager();
  
  // Binance for crypto
  await exchanges.connect('binance', {
    apiKey: process.env.BINANCE_API_KEY!,
    secret: process.env.BINANCE_SECRET!,
  });

  console.log('✓ Connected to Binance');

  // 2. Create signal copier
  const copier = new SignalCopier({
    // Telegram channels to monitor
    channels: [
      {
        type: 'telegram',
        id: '@CryptoSignalsPro',
        markets: ['crypto'],
        autoExecute: true,
      },
      {
        type: 'telegram',
        id: '@ForexVIPSignals',
        markets: ['forex'],
        autoExecute: true,
      },
    ],
    
    // Risk settings
    settings: {
      maxRiskPerTrade: 0.02,      // 2% per trade
      maxTradesPerDay: 10,
      executionDelayMax: 30,      // Skip if signal > 30s old
      requireConfirmation: false,
    },
    
    // Route signals to correct exchange
    routing: {
      crypto: 'binance',
      forex: 'mt5',
      binary: 'binaryfaster',
    },
  });

  // 3. Handle events
  copier.on('signal', (signal) => {
    console.log(`📡 Signal detected: ${signal.symbol} ${signal.direction}`);
    console.log(`   Source: ${signal.source}`);
    console.log(`   Entry: ${signal.entry || 'Market'}`);
    console.log(`   TP: ${signal.takeProfit?.join(', ') || 'None'}`);
    console.log(`   SL: ${signal.stopLoss || 'None'}`);
  });

  copier.on('executed', (trade) => {
    console.log(`✅ Trade executed!`);
    console.log(`   Symbol: ${trade.symbol}`);
    console.log(`   Side: ${trade.side}`);
    console.log(`   Amount: ${trade.amount}`);
    console.log(`   Exchange: ${trade.exchange}`);
  });

  copier.on('skipped', (reason) => {
    console.log(`⏭️ Signal skipped: ${reason.message}`);
  });

  copier.on('error', (error) => {
    console.error(`❌ Error: ${error.message}`);
  });

  // 4. Start copying
  console.log('\n🚀 Starting signal copier...\n');
  console.log('Monitoring channels:');
  console.log('  • @CryptoSignalsPro (crypto)');
  console.log('  • @ForexVIPSignals (forex)');
  console.log('\nWaiting for signals...\n');

  await copier.start({
    telegramApiId: parseInt(process.env.TELEGRAM_API_ID!),
    telegramApiHash: process.env.TELEGRAM_API_HASH!,
    telegramPhone: process.env.TELEGRAM_PHONE!,
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await copier.stop();
    await exchanges.disconnectAll();
    console.log('Goodbye! 👋');
    process.exit(0);
  });
}

main().catch(console.error);
