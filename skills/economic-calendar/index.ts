/**
 * K.I.T. Economic Calendar Trading Skill
 * Skill #55
 */

export {
  EconomicCalendar,
  NFPStraddleStrategy,
  CPIBreakoutStrategy,
  FOMCFadeStrategy,
  createEconomicCalendar
} from './economic-calendar';

// Quick start
export async function quickCalendar() {
  const { createEconomicCalendar } = await import('./economic-calendar');
  
  const calendar = createEconomicCalendar({
    sources: ['forexfactory'],
    timezone: 'Europe/Berlin',
    minImpact: 'high'
  });
  
  await calendar.refresh();
  
  const upcoming = await calendar.getUpcoming({ hours: 48 });
  console.log('📅 Upcoming High-Impact Events:');
  for (const event of upcoming) {
    console.log(`  • ${event.name} (${event.currency}) - ${event.datetime.toLocaleString()}`);
  }
  
  return calendar;
}

// Get next high-impact event
export async function nextHighImpact() {
  const { createEconomicCalendar } = await import('./economic-calendar');
  
  const calendar = createEconomicCalendar({ minImpact: 'high' });
  await calendar.refresh();
  
  const events = await calendar.getUpcoming({ hours: 168 }); // 1 week
  return events[0] || null;
}

// Check exposure helper
export async function checkPositionExposure(positions: Array<{ symbol: string; size: number }>) {
  const { createEconomicCalendar } = await import('./economic-calendar');
  
  const calendar = createEconomicCalendar({ minImpact: 'high' });
  await calendar.refresh();
  
  return calendar.checkExposure(positions);
}
