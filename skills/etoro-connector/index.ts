/**
 * K.I.T. eToro Connector Skill
 * 
 * Integrates with eToro's public APIs for:
 * - Real-time market data
 * - CopyTrader discovery and execution
 * - Portfolio analytics
 * - Social trading features
 */

export { 
  EtoroClient,
  topTraders,
  traderInfo,
  marketOverview 
} from './etoro-client';

export default {
  name: 'etoro-connector',
  description: 'eToro API integration for social trading and market data',
  version: '1.0.0',
  
  commands: {
    'etoro:discover': 'Discover top Popular Investors',
    'etoro:profile': 'Get trader profile details',
    'etoro:markets': 'Get real-time market data',
    'etoro:portfolio': 'Portfolio analytics',
    'etoro:social': 'Social feed from copied traders',
    'etoro:copy': 'Start copying a trader',
    'etoro:smartcopy': 'AI-recommended copy portfolio'
  }
};
