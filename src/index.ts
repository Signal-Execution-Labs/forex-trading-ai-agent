/**
 * K.I.T. - Künstliche Intelligenz Trading
 * Main Entry Point
 */

import dotenv from 'dotenv';
import { TradingEngine } from './core/engine';
import { ExchangeManager } from './exchanges/manager';
import { StrategyManager } from './strategies/manager';
import { RiskManager } from './risk/manager';
import { Logger } from './core/logger';

dotenv.config();

const logger = new Logger('K.I.T.');

async function main() {
  logger.info('🤖 K.I.T. - Künstliche Intelligenz Trading startet...');
  
  try {
    // Initialize components
    const exchangeManager = new ExchangeManager();
    const strategyManager = new StrategyManager();
    const riskManager = new RiskManager();
    
    // Create trading engine
    const engine = new TradingEngine({
      exchanges: exchangeManager,
      strategies: strategyManager,
      risk: riskManager,
    });
    
    // Start the engine
    await engine.start();
    
    logger.info('✅ K.I.T. läuft!');
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('🛑 Shutdown signal received...');
      await engine.stop();
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('❌ Startup failed:', error);
    process.exit(1);
  }
}

main();
