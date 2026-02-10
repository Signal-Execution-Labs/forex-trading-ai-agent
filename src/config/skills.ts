/**
 * K.I.T. Trading Skills Configuration
 * All 37+ skills organized by category
 */

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  category: 'trading' | 'analysis' | 'portfolio' | 'defi' | 'automation' | 'risk' | 'reporting';
  status: 'ready' | 'beta' | 'coming';
  icon: string;
}

export const TRADING_SKILLS: SkillInfo[] = [
  // Trading Skills
  {
    id: 'binary-options',
    name: 'Binary Options',
    description: 'Trade CALL/PUT on BinaryFaster',
    category: 'trading',
    status: 'ready',
    icon: '🎯',
  },
  {
    id: 'metatrader',
    name: 'MetaTrader 5',
    description: 'Forex trading via MT5',
    category: 'trading',
    status: 'ready',
    icon: '📈',
  },
  {
    id: 'auto-trader',
    name: 'Auto Trader',
    description: 'Automated strategy execution',
    category: 'trading',
    status: 'ready',
    icon: '🤖',
  },
  {
    id: 'signal-copier',
    name: 'Signal Copier',
    description: 'Copy trades from signal providers',
    category: 'trading',
    status: 'ready',
    icon: '📡',
  },
  {
    id: 'copy-trader',
    name: 'Copy Trader',
    description: 'Mirror successful traders',
    category: 'trading',
    status: 'ready',
    icon: '👥',
  },
  {
    id: 'options-trader',
    name: 'Options Trader',
    description: 'Options strategies and Greeks',
    category: 'trading',
    status: 'ready',
    icon: '📊',
  },
  {
    id: 'stock-trader',
    name: 'Stock Trader',
    description: 'Equities and ETF trading',
    category: 'trading',
    status: 'ready',
    icon: '🏛️',
  },
  
  // Analysis Skills
  {
    id: 'market-analysis',
    name: 'Market Analysis',
    description: 'Technical and fundamental analysis',
    category: 'analysis',
    status: 'ready',
    icon: '🔍',
  },
  {
    id: 'sentiment-analyzer',
    name: 'Sentiment Analyzer',
    description: 'Social media & news sentiment',
    category: 'analysis',
    status: 'ready',
    icon: '💭',
  },
  {
    id: 'whale-tracker',
    name: 'Whale Tracker',
    description: 'Track large wallet movements',
    category: 'analysis',
    status: 'ready',
    icon: '🐋',
  },
  {
    id: 'news-tracker',
    name: 'News Tracker',
    description: 'Real-time market news alerts',
    category: 'analysis',
    status: 'ready',
    icon: '📰',
  },
  {
    id: 'ai-predictor',
    name: 'AI Predictor',
    description: 'ML-based price predictions',
    category: 'analysis',
    status: 'beta',
    icon: '🧠',
  },
  {
    id: 'backtester',
    name: 'Backtester',
    description: 'Test strategies on historical data',
    category: 'analysis',
    status: 'ready',
    icon: '⏪',
  },
  
  // Portfolio Skills
  {
    id: 'portfolio-tracker',
    name: 'Portfolio Tracker',
    description: 'Track all assets across exchanges',
    category: 'portfolio',
    status: 'ready',
    icon: '💼',
  },
  {
    id: 'multi-asset',
    name: 'Multi-Asset Manager',
    description: 'Manage diverse asset portfolio',
    category: 'portfolio',
    status: 'ready',
    icon: '🎨',
  },
  {
    id: 'rebalancer',
    name: 'Portfolio Rebalancer',
    description: 'Auto-rebalance to target allocation',
    category: 'portfolio',
    status: 'ready',
    icon: '⚖️',
  },
  {
    id: 'dividend-manager',
    name: 'Dividend Manager',
    description: 'Track and reinvest dividends',
    category: 'portfolio',
    status: 'ready',
    icon: '💵',
  },
  
  // DeFi Skills
  {
    id: 'defi-connector',
    name: 'DeFi Connector',
    description: 'Connect to DeFi protocols',
    category: 'defi',
    status: 'ready',
    icon: '🔗',
  },
  {
    id: 'defi-yield',
    name: 'DeFi Yield',
    description: 'Yield farming optimization',
    category: 'defi',
    status: 'ready',
    icon: '🌾',
  },
  {
    id: 'arbitrage-finder',
    name: 'Arbitrage Finder',
    description: 'Find cross-exchange opportunities',
    category: 'defi',
    status: 'ready',
    icon: '💱',
  },
  {
    id: 'arbitrage-hunter',
    name: 'Arbitrage Hunter',
    description: 'Execute arbitrage automatically',
    category: 'defi',
    status: 'beta',
    icon: '🏹',
  },
  {
    id: 'smart-router',
    name: 'Smart Router',
    description: 'Best route for swaps',
    category: 'defi',
    status: 'ready',
    icon: '🛤️',
  },
  {
    id: 'wallet-connector',
    name: 'Wallet Connector',
    description: 'Connect hardware & software wallets',
    category: 'defi',
    status: 'ready',
    icon: '👛',
  },
  
  // Risk Skills
  {
    id: 'risk-calculator',
    name: 'Risk Calculator',
    description: 'Position sizing and risk metrics',
    category: 'risk',
    status: 'ready',
    icon: '🧮',
  },
  {
    id: 'risk-ai',
    name: 'Risk AI',
    description: 'AI-powered risk assessment',
    category: 'risk',
    status: 'beta',
    icon: '🛡️',
  },
  {
    id: 'lot-size-calculator',
    name: 'Lot Size Calculator',
    description: 'Calculate optimal lot sizes',
    category: 'risk',
    status: 'ready',
    icon: '📐',
  },
  {
    id: 'pip-calculator',
    name: 'Pip Calculator',
    description: 'Forex pip value calculator',
    category: 'risk',
    status: 'ready',
    icon: '💹',
  },
  {
    id: 'alert-system',
    name: 'Alert System',
    description: 'Price and condition alerts',
    category: 'risk',
    status: 'ready',
    icon: '🔔',
  },
  
  // Automation Skills
  {
    id: 'task-scheduler',
    name: 'Task Scheduler',
    description: 'Schedule recurring tasks',
    category: 'automation',
    status: 'ready',
    icon: '⏰',
  },
  {
    id: 'quant-engine',
    name: 'Quant Engine',
    description: 'Build custom trading algorithms',
    category: 'automation',
    status: 'beta',
    icon: '🔬',
  },
  {
    id: 'session-timer',
    name: 'Session Timer',
    description: 'Market session tracking',
    category: 'automation',
    status: 'ready',
    icon: '🌍',
  },
  
  // Reporting Skills
  {
    id: 'tax-tracker',
    name: 'Tax Tracker',
    description: 'Track gains for tax reporting',
    category: 'reporting',
    status: 'ready',
    icon: '📋',
  },
  {
    id: 'trade-journal',
    name: 'Trade Journal',
    description: 'Log and analyze all trades',
    category: 'reporting',
    status: 'ready',
    icon: '📓',
  },
  {
    id: 'performance-report',
    name: 'Performance Report',
    description: 'Detailed P&L reports',
    category: 'reporting',
    status: 'ready',
    icon: '📊',
  },
  {
    id: 'compliance',
    name: 'Compliance',
    description: 'Regulatory compliance tracking',
    category: 'reporting',
    status: 'ready',
    icon: '✅',
  },
  
  // Exchange Connectors
  {
    id: 'exchange-connector',
    name: 'Exchange Connector',
    description: 'Connect Binance, Coinbase, Kraken+',
    category: 'trading',
    status: 'ready',
    icon: '🔌',
  },
  {
    id: 'payment-processor',
    name: 'Payment Processor',
    description: 'PayPal, Wise, Revolut integration',
    category: 'portfolio',
    status: 'ready',
    icon: '💳',
  },
];

export const SKILLS_BY_CATEGORY = {
  trading: TRADING_SKILLS.filter(s => s.category === 'trading'),
  analysis: TRADING_SKILLS.filter(s => s.category === 'analysis'),
  portfolio: TRADING_SKILLS.filter(s => s.category === 'portfolio'),
  defi: TRADING_SKILLS.filter(s => s.category === 'defi'),
  risk: TRADING_SKILLS.filter(s => s.category === 'risk'),
  automation: TRADING_SKILLS.filter(s => s.category === 'automation'),
  reporting: TRADING_SKILLS.filter(s => s.category === 'reporting'),
};

export const READY_SKILLS = TRADING_SKILLS.filter(s => s.status === 'ready');
export const BETA_SKILLS = TRADING_SKILLS.filter(s => s.status === 'beta');

export function getSkillById(id: string): SkillInfo | undefined {
  return TRADING_SKILLS.find(s => s.id === id);
}
