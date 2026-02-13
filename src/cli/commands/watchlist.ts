/**
 * K.I.T. Watchlist CLI Command
 * 
 * Manage asset watchlists for tracking.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const WATCHLIST_FILE = path.join(KIT_HOME, 'watchlist.json');

export interface WatchlistItem {
  symbol: string;
  addedAt: string;
  notes?: string;
  targetPrice?: number;
  stopPrice?: number;
  category?: string;
}

interface WatchlistConfig {
  version: number;
  items: WatchlistItem[];
  categories: string[];
}

export function registerWatchlistCommand(program: Command): void {
  const watchlist = program
    .command('watchlist')
    .alias('watch')
    .description('Manage asset watchlist');

  // List watchlist
  watchlist
    .command('list')
    .alias('ls')
    .description('Show watchlist')
    .option('--category <cat>', 'Filter by category')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = loadWatchlist();
      let items = config.items;
      
      if (options.category) {
        items = items.filter(i => i.category === options.category);
      }
      
      if (options.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }
      
      if (items.length === 0) {
        console.log('Watchlist is empty.');
        console.log('\nAdd a symbol:');
        console.log('  kit watchlist add BTC/USD');
        return;
      }
      
      console.log('👀 Watchlist\n');
      
      // Group by category
      const byCategory = new Map<string, WatchlistItem[]>();
      for (const item of items) {
        const cat = item.category || 'Uncategorized';
        if (!byCategory.has(cat)) byCategory.set(cat, []);
        byCategory.get(cat)!.push(item);
      }
      
      for (const [category, catItems] of byCategory) {
        console.log(`📁 ${category}`);
        for (const item of catItems) {
          let details = '';
          if (item.targetPrice) details += ` 🎯 $${item.targetPrice}`;
          if (item.stopPrice) details += ` 🛑 $${item.stopPrice}`;
          if (item.notes) details += ` 📝 ${item.notes}`;
          
          console.log(`   • ${item.symbol}${details}`);
        }
        console.log('');
      }
      
      console.log(`Total: ${items.length} symbols`);
    });

  // Add to watchlist
  watchlist
    .command('add <symbol>')
    .description('Add symbol to watchlist')
    .option('--target <price>', 'Target price', parseFloat)
    .option('--stop <price>', 'Stop price', parseFloat)
    .option('--notes <text>', 'Notes about this symbol')
    .option('--category <cat>', 'Category for organization')
    .action((symbol, options) => {
      const config = loadWatchlist();
      
      // Check if already in watchlist
      const existing = config.items.find(i => 
        i.symbol.toUpperCase() === symbol.toUpperCase()
      );
      
      if (existing) {
        // Update existing
        if (options.target) existing.targetPrice = options.target;
        if (options.stop) existing.stopPrice = options.stop;
        if (options.notes) existing.notes = options.notes;
        if (options.category) existing.category = options.category;
        
        saveWatchlist(config);
        console.log(`✅ Updated: ${symbol.toUpperCase()}`);
      } else {
        // Add new
        const item: WatchlistItem = {
          symbol: symbol.toUpperCase(),
          addedAt: new Date().toISOString(),
          targetPrice: options.target,
          stopPrice: options.stop,
          notes: options.notes,
          category: options.category,
        };
        
        config.items.push(item);
        
        // Add category if new
        if (options.category && !config.categories.includes(options.category)) {
          config.categories.push(options.category);
        }
        
        saveWatchlist(config);
        console.log(`✅ Added: ${symbol.toUpperCase()}`);
      }
    });

  // Remove from watchlist
  watchlist
    .command('remove <symbol>')
    .alias('rm')
    .description('Remove symbol from watchlist')
    .action((symbol) => {
      const config = loadWatchlist();
      const index = config.items.findIndex(i => 
        i.symbol.toUpperCase() === symbol.toUpperCase()
      );
      
      if (index === -1) {
        console.error(`Not in watchlist: ${symbol}`);
        process.exit(1);
      }
      
      config.items.splice(index, 1);
      saveWatchlist(config);
      console.log(`✅ Removed: ${symbol.toUpperCase()}`);
    });

  // Clear watchlist
  watchlist
    .command('clear')
    .description('Clear entire watchlist')
    .option('--category <cat>', 'Clear only specific category')
    .option('--confirm', 'Skip confirmation')
    .action((options) => {
      if (!options.confirm) {
        const target = options.category ? `category "${options.category}"` : 'entire watchlist';
        console.log(`⚠️ This will clear ${target}.`);
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      const config = loadWatchlist();
      
      if (options.category) {
        config.items = config.items.filter(i => i.category !== options.category);
        console.log(`✅ Cleared category: ${options.category}`);
      } else {
        config.items = [];
        console.log('✅ Watchlist cleared');
      }
      
      saveWatchlist(config);
    });

  // Show categories
  watchlist
    .command('categories')
    .description('List all categories')
    .action(() => {
      const config = loadWatchlist();
      
      // Get unique categories from items
      const categories = new Set<string>();
      for (const item of config.items) {
        categories.add(item.category || 'Uncategorized');
      }
      
      if (categories.size === 0) {
        console.log('No categories. Add items to create categories.');
        return;
      }
      
      console.log('📁 Categories:\n');
      for (const cat of categories) {
        const count = config.items.filter(i => (i.category || 'Uncategorized') === cat).length;
        console.log(`   ${cat} (${count})`);
      }
    });

  // Import watchlist
  watchlist
    .command('import <file>')
    .description('Import watchlist from file (JSON or CSV)')
    .action((file) => {
      if (!fs.existsSync(file)) {
        console.error(`File not found: ${file}`);
        process.exit(1);
      }
      
      const content = fs.readFileSync(file, 'utf8');
      const config = loadWatchlist();
      let imported = 0;
      
      if (file.endsWith('.json')) {
        const data = JSON.parse(content);
        const items = Array.isArray(data) ? data : data.items || [];
        for (const item of items) {
          if (item.symbol) {
            config.items.push({
              symbol: item.symbol.toUpperCase(),
              addedAt: item.addedAt || new Date().toISOString(),
              notes: item.notes,
              targetPrice: item.targetPrice,
              stopPrice: item.stopPrice,
              category: item.category,
            });
            imported++;
          }
        }
      } else {
        // CSV - one symbol per line
        const lines = content.split('\n').filter(l => l.trim());
        for (const line of lines) {
          const symbol = line.trim().split(',')[0];
          if (symbol && !symbol.startsWith('#')) {
            config.items.push({
              symbol: symbol.toUpperCase(),
              addedAt: new Date().toISOString(),
            });
            imported++;
          }
        }
      }
      
      saveWatchlist(config);
      console.log(`✅ Imported ${imported} symbols`);
    });

  // Export watchlist
  watchlist
    .command('export <file>')
    .description('Export watchlist to file')
    .action((file) => {
      const config = loadWatchlist();
      
      if (file.endsWith('.json')) {
        fs.writeFileSync(file, JSON.stringify(config.items, null, 2));
      } else {
        // CSV
        const csv = config.items.map(i => i.symbol).join('\n');
        fs.writeFileSync(file, csv);
      }
      
      console.log(`✅ Exported ${config.items.length} symbols to ${file}`);
    });
}

function loadWatchlist(): WatchlistConfig {
  if (!fs.existsSync(WATCHLIST_FILE)) {
    return { version: 1, items: [], categories: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf8'));
  } catch {
    return { version: 1, items: [], categories: [] };
  }
}

function saveWatchlist(config: WatchlistConfig): void {
  fs.mkdirSync(path.dirname(WATCHLIST_FILE), { recursive: true });
  fs.writeFileSync(WATCHLIST_FILE, JSON.stringify(config, null, 2));
}
