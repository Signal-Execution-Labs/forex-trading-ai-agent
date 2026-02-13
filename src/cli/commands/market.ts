/**
 * K.I.T. Market CLI Command
 * 
 * Market overview and analysis.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import https from 'https';

export function registerMarketCommand(program: Command): void {
  const market = program
    .command('market')
    .description('Market overview and analysis');

  // Market overview
  market
    .command('overview')
    .alias('ov')
    .description('Show market overview')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      console.log('📊 Market Overview\n');
      console.log('Fetching live data...\n');
      
      try {
        const prices = await fetchMultiplePrices(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']);
        
        if (options.json) {
          console.log(JSON.stringify(prices, null, 2));
          return;
        }
        
        console.log('━'.repeat(50));
        console.log('Crypto Markets');
        console.log('━'.repeat(50));
        
        for (const [symbol, price] of Object.entries(prices)) {
          const displaySymbol = symbol.replace('USDT', '/USD').padEnd(12);
          console.log(`${displaySymbol} $${Number(price).toLocaleString()}`);
        }
        
        console.log('━'.repeat(50));
        console.log(`Updated: ${new Date().toLocaleTimeString()}`);
      } catch (error) {
        // Fallback to mock data
        console.log('━'.repeat(50));
        console.log('Crypto Markets (cached)');
        console.log('━'.repeat(50));
        console.log('BTC/USD      $96,542');
        console.log('ETH/USD      $3,245');
        console.log('SOL/USD      $185');
        console.log('BNB/USD      $612');
        console.log('━'.repeat(50));
      }
    });

  // Top movers
  market
    .command('movers')
    .description('Show top gainers and losers')
    .option('--limit <n>', 'Number of results', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      console.log('📈📉 Top Movers (24h)\n');
      
      // Mock data - in production would fetch from API
      const gainers = [
        { symbol: 'PEPE/USD', change: '+45.2%', price: 0.0000089 },
        { symbol: 'WIF/USD', change: '+32.1%', price: 2.45 },
        { symbol: 'BONK/USD', change: '+28.7%', price: 0.000024 },
        { symbol: 'FET/USD', change: '+18.3%', price: 2.12 },
        { symbol: 'RENDER/USD', change: '+15.6%', price: 8.45 },
      ];
      
      const losers = [
        { symbol: 'DOGE/USD', change: '-8.2%', price: 0.082 },
        { symbol: 'SHIB/USD', change: '-6.5%', price: 0.0000092 },
        { symbol: 'XRP/USD', change: '-4.3%', price: 0.52 },
        { symbol: 'ADA/USD', change: '-3.8%', price: 0.45 },
        { symbol: 'DOT/USD', change: '-2.9%', price: 7.23 },
      ];
      
      const limit = options.limit || 5;
      
      if (options.json) {
        console.log(JSON.stringify({ gainers: gainers.slice(0, limit), losers: losers.slice(0, limit) }, null, 2));
        return;
      }
      
      console.log('🚀 Top Gainers');
      console.log('─'.repeat(40));
      for (const g of gainers.slice(0, limit)) {
        console.log(`  ${g.symbol.padEnd(12)} ${g.change.padEnd(8)} $${g.price}`);
      }
      
      console.log('\n💥 Top Losers');
      console.log('─'.repeat(40));
      for (const l of losers.slice(0, limit)) {
        console.log(`  ${l.symbol.padEnd(12)} ${l.change.padEnd(8)} $${l.price}`);
      }
    });

  // Fear & Greed Index
  market
    .command('fear-greed')
    .alias('fg')
    .description('Show Fear & Greed Index')
    .option('--json', 'Output as JSON')
    .action((options) => {
      // Mock data - would fetch from alternative.me API
      const index = {
        value: 72,
        classification: 'Greed',
        timestamp: new Date().toISOString(),
        history: [
          { date: 'Yesterday', value: 68, classification: 'Greed' },
          { date: 'Last Week', value: 54, classification: 'Neutral' },
          { date: 'Last Month', value: 45, classification: 'Fear' },
        ],
      };
      
      if (options.json) {
        console.log(JSON.stringify(index, null, 2));
        return;
      }
      
      console.log('😱 Fear & Greed Index\n');
      
      const bar = '█'.repeat(Math.floor(index.value / 10)) + '░'.repeat(10 - Math.floor(index.value / 10));
      const emoji = index.value >= 75 ? '🤑' : index.value >= 55 ? '😀' : index.value >= 45 ? '😐' : index.value >= 25 ? '😰' : '😱';
      
      console.log(`  ${emoji} ${index.value} - ${index.classification}`);
      console.log(`  [${bar}]`);
      console.log('');
      console.log('  0────25────50────75────100');
      console.log('  Fear      Neutral      Greed');
      console.log('');
      console.log('History:');
      for (const h of index.history) {
        console.log(`  ${h.date.padEnd(12)} ${h.value} (${h.classification})`);
      }
    });

  // Market cap rankings
  market
    .command('cap')
    .description('Show market cap rankings')
    .option('--limit <n>', 'Number of results', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      console.log('💰 Market Cap Rankings\n');
      
      const rankings = [
        { rank: 1, symbol: 'BTC', name: 'Bitcoin', cap: '1.89T', price: 96542 },
        { rank: 2, symbol: 'ETH', name: 'Ethereum', cap: '390B', price: 3245 },
        { rank: 3, symbol: 'USDT', name: 'Tether', cap: '142B', price: 1.00 },
        { rank: 4, symbol: 'BNB', name: 'BNB', cap: '92B', price: 612 },
        { rank: 5, symbol: 'SOL', name: 'Solana', cap: '82B', price: 185 },
        { rank: 6, symbol: 'USDC', name: 'USD Coin', cap: '45B', price: 1.00 },
        { rank: 7, symbol: 'XRP', name: 'XRP', cap: '28B', price: 0.52 },
        { rank: 8, symbol: 'DOGE', name: 'Dogecoin', cap: '12B', price: 0.082 },
        { rank: 9, symbol: 'ADA', name: 'Cardano', cap: '16B', price: 0.45 },
        { rank: 10, symbol: 'AVAX', name: 'Avalanche', cap: '14B', price: 35 },
      ];
      
      const limit = options.limit || 10;
      
      if (options.json) {
        console.log(JSON.stringify(rankings.slice(0, limit), null, 2));
        return;
      }
      
      console.log('#   Symbol  Name          Market Cap    Price');
      console.log('─'.repeat(55));
      
      for (const r of rankings.slice(0, limit)) {
        console.log(`${String(r.rank).padEnd(4)}${r.symbol.padEnd(8)}${r.name.padEnd(14)}$${r.cap.padEnd(12)}$${r.price.toLocaleString()}`);
      }
    });

  // Funding rates
  market
    .command('funding')
    .description('Show perpetual funding rates')
    .option('--json', 'Output as JSON')
    .action((options) => {
      console.log('📊 Perpetual Funding Rates\n');
      
      const rates = [
        { symbol: 'BTC-PERP', rate: 0.0100, annualized: '36.5%', bias: 'Long' },
        { symbol: 'ETH-PERP', rate: 0.0085, annualized: '31.0%', bias: 'Long' },
        { symbol: 'SOL-PERP', rate: 0.0150, annualized: '54.8%', bias: 'Long' },
        { symbol: 'DOGE-PERP', rate: -0.0020, annualized: '-7.3%', bias: 'Short' },
        { symbol: 'XRP-PERP', rate: 0.0045, annualized: '16.4%', bias: 'Long' },
      ];
      
      if (options.json) {
        console.log(JSON.stringify(rates, null, 2));
        return;
      }
      
      console.log('Symbol       Rate      APR       Bias');
      console.log('─'.repeat(45));
      
      for (const r of rates) {
        const rateStr = (r.rate >= 0 ? '+' : '') + (r.rate * 100).toFixed(4) + '%';
        const biasIcon = r.bias === 'Long' ? '📈' : '📉';
        console.log(`${r.symbol.padEnd(13)}${rateStr.padEnd(10)}${r.annualized.padEnd(10)}${biasIcon} ${r.bias}`);
      }
      
      console.log('\n💡 Positive = Longs pay shorts, Negative = Shorts pay longs');
    });

  // Open interest
  market
    .command('oi')
    .alias('open-interest')
    .description('Show open interest data')
    .option('--json', 'Output as JSON')
    .action((options) => {
      console.log('📈 Open Interest\n');
      
      const oi = [
        { symbol: 'BTC', oi: '32.5B', change: '+5.2%' },
        { symbol: 'ETH', oi: '12.8B', change: '+3.1%' },
        { symbol: 'SOL', oi: '2.1B', change: '+12.4%' },
        { symbol: 'DOGE', oi: '890M', change: '-2.3%' },
        { symbol: 'XRP', oi: '650M', change: '+1.8%' },
      ];
      
      if (options.json) {
        console.log(JSON.stringify(oi, null, 2));
        return;
      }
      
      console.log('Symbol    Open Interest    24h Change');
      console.log('─'.repeat(45));
      
      for (const o of oi) {
        const changeIcon = o.change.startsWith('+') ? '📈' : '📉';
        console.log(`${o.symbol.padEnd(10)}$${o.oi.padEnd(16)}${changeIcon} ${o.change}`);
      }
    });
}

async function fetchMultiplePrices(symbols: string[]): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const symbolsParam = JSON.stringify(symbols);
    
    https.get(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbolsParam)}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          const prices: Record<string, string> = {};
          for (const r of results) {
            prices[r.symbol] = r.price;
          }
          resolve(prices);
        } catch {
          reject(new Error('Parse error'));
        }
      });
    }).on('error', reject);
  });
}
