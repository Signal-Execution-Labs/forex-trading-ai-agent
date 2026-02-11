/**
 * DeFi Dashboard Skill
 * Skill #62 - Zapper-style portfolio aggregation
 */

export { DeFiDashboard, createDeFiDashboard } from './defi-dashboard';
export type { Position, Portfolio, Activity, Alert, TokenBalance } from './defi-dashboard';

// Quick start helper
export async function quickStart(wallets: string[]) {
  const { DeFiDashboard } = await import('./defi-dashboard');
  
  const dashboard = new DeFiDashboard({
    wallets: wallets.map(address => ({
      address,
      chains: 'all' as const
    }))
  });
  
  await dashboard.start();
  return dashboard;
}
