/**
 * K.I.T. Basic Bot Example
 * 
 * A simple example showing how to create a trading bot with K.I.T.
 * 
 * Usage:
 *   npx ts-node examples/basic-bot.ts
 */

import { KitAgent, ExchangeManager, StrategyEngine } from '../src';

async function main() {
  console.log('🚗 K.I.T. Basic Bot Starting...\n');

  // 1. Create the agent
  const agent = new KitAgent({
    name: 'MyTradingBot',
    model: 'claude-opus-4-5-20251101',
  });

  // 2. Connect to exchanges
  const exchanges = new ExchangeManager();
  
  await exchanges.connect('binance', {
    apiKey: process.env.BINANCE_API_KEY!,
    secret: process.env.BINANCE_SECRET!,
    sandbox: true, // Use testnet
  });

  console.log('✓ Connected to Binance (testnet)');

  // 3. Define a simple strategy
  const strategy = {
    name: 'SimpleMA',
    symbol: 'BTC/USDT',
    timeframe: '1h',
    
    // Buy when price crosses above 20 MA
    shouldBuy: async (data: any) => {
      const prices = data.closes;
      const ma20 = prices.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const currentPrice = prices[prices.length - 1];
      return currentPrice > ma20;
    },
    
    // Sell when price crosses below 20 MA
    shouldSell: async (data: any) => {
      const prices = data.closes;
      const ma20 = prices.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
      const currentPrice = prices[prices.length - 1];
      return currentPrice < ma20;
    },
    
    // Risk management
    riskPerTrade: 0.02, // 2% per trade
    stopLoss: 0.02,     // 2% stop loss
    takeProfit: 0.04,   // 4% take profit
  };

  // 4. Create strategy engine
  const engine = new StrategyEngine({
    exchange: exchanges.get('binance'),
    strategy,
    paperTrading: true, // Start with paper trading
  });

  // 5. Handle events
  engine.on('signal', (signal) => {
    console.log(`📊 Signal: ${signal.action} ${signal.symbol} @ ${signal.price}`);
  });

  engine.on('trade', (trade) => {
    console.log(`⚡ Trade executed: ${trade.side} ${trade.amount} ${trade.symbol}`);
  });

  engine.on('error', (error) => {
    console.error('❌ Error:', error.message);
  });

  // 6. Start the bot
  console.log('\n🚀 Starting strategy...\n');
  await engine.start();

  // Keep running
  console.log('Bot is running. Press Ctrl+C to stop.\n');
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await engine.stop();
    await exchanges.disconnectAll();
    console.log('Goodbye! 👋');
    process.exit(0);
  });
}

main().catch(console.error);
