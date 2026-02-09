/**
 * K.I.T. Portfolio Tracker Example
 * 
 * Track your portfolio across multiple exchanges and get real-time updates.
 * 
 * Usage:
 *   npx ts-node examples/portfolio-tracker-example.ts
 */

import { PortfolioTracker, ExchangeManager } from '../src';

async function main() {
  console.log('🚗 K.I.T. Portfolio Tracker Starting...\n');

  // 1. Connect to exchanges
  const exchanges = new ExchangeManager();
  
  // Add your exchanges
  await exchanges.connect('binance', {
    apiKey: process.env.BINANCE_API_KEY!,
    secret: process.env.BINANCE_SECRET!,
  });

  await exchanges.connect('kraken', {
    apiKey: process.env.KRAKEN_API_KEY!,
    secret: process.env.KRAKEN_SECRET!,
  });

  console.log('✓ Connected to Binance');
  console.log('✓ Connected to Kraken');

  // 2. Create portfolio tracker
  const tracker = new PortfolioTracker({
    exchanges: exchanges.getAll(),
    baseCurrency: 'USD',
    updateInterval: 60000, // Update every minute
  });

  // 3. Handle events
  tracker.on('update', (portfolio) => {
    console.clear();
    console.log('═══════════════════════════════════════════');
    console.log('        🚗 K.I.T. Portfolio Tracker        ');
    console.log('═══════════════════════════════════════════\n');
    
    console.log(`Total Value: $${portfolio.totalValue.toLocaleString()}`);
    console.log(`24h Change:  ${portfolio.change24h >= 0 ? '+' : ''}${portfolio.change24h.toFixed(2)}%\n`);
    
    console.log('Holdings:');
    console.log('─────────────────────────────────────────');
    
    for (const asset of portfolio.assets) {
      const change = asset.change24h >= 0 ? `+${asset.change24h.toFixed(2)}%` : `${asset.change24h.toFixed(2)}%`;
      const changeColor = asset.change24h >= 0 ? '\x1b[32m' : '\x1b[31m';
      console.log(
        `${asset.symbol.padEnd(8)} ${asset.amount.toFixed(4).padStart(12)} ` +
        `$${asset.value.toLocaleString().padStart(10)} ` +
        `${changeColor}${change.padStart(8)}\x1b[0m`
      );
    }
    
    console.log('─────────────────────────────────────────');
    console.log(`\nLast updated: ${new Date().toLocaleTimeString()}`);
  });

  tracker.on('alert', (alert) => {
    console.log(`\n🔔 ALERT: ${alert.message}\n`);
  });

  // 4. Set up alerts
  tracker.addAlert({
    type: 'price',
    symbol: 'BTC',
    condition: 'above',
    value: 50000,
    message: 'BTC crossed $50,000!',
  });

  tracker.addAlert({
    type: 'change',
    symbol: 'ETH',
    condition: 'below',
    value: -5,
    message: 'ETH dropped more than 5%!',
  });

  tracker.addAlert({
    type: 'portfolio',
    condition: 'below',
    value: -10,
    message: 'Portfolio down more than 10%!',
  });

  // 5. Start tracking
  console.log('🚀 Starting portfolio tracker...\n');
  await tracker.start();

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down...');
    await tracker.stop();
    await exchanges.disconnectAll();
    console.log('Goodbye! 👋');
    process.exit(0);
  });
}

main().catch(console.error);
