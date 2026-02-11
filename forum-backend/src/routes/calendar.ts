import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// ECONOMIC CALENDAR - Upcoming economic events and earnings
// ============================================================================

interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  countryCode: string;
  currency: string;
  datetime: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  forecast?: string;
  previous?: string;
  actual?: string;
  description: string;
  affectedSymbols: string[];
  tradingRecommendation?: string;
}

interface EventReminder {
  id: string;
  agentId: string;
  eventId: string;
  minutesBefore: number;
  notified: boolean;
  createdAt: string;
}

function generateUpcomingEvents(): EconomicEvent[] {
  const now = new Date();
  const events: EconomicEvent[] = [
    { id: uuidv4(), title: 'US Core CPI (YoY)', country: 'United States', countryCode: 'US', currency: 'USD', datetime: new Date(now.getTime() + 2 * 3600000).toISOString(), impact: 'high' as const, category: 'inflation', forecast: '3.1%', previous: '3.2%', description: 'Consumer Price Index excluding food and energy.', affectedSymbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'SPY'], tradingRecommendation: 'High volatility expected. Lower reading = USD bearish.' },
    { id: uuidv4(), title: 'ECB President Lagarde Speech', country: 'Eurozone', countryCode: 'EU', currency: 'EUR', datetime: new Date(now.getTime() + 5 * 3600000).toISOString(), impact: 'high' as const, category: 'speech', description: 'ECB President speaks at European Parliament.', affectedSymbols: ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'DAX'], tradingRecommendation: 'Hawkish tone = EUR bullish.' },
    { id: uuidv4(), title: 'US Retail Sales (MoM)', country: 'United States', countryCode: 'US', currency: 'USD', datetime: new Date(now.getTime() + 24 * 3600000).toISOString(), impact: 'high' as const, category: 'consumer', forecast: '0.3%', previous: '0.5%', description: 'Monthly change in retail sales.', affectedSymbols: ['EUR/USD', 'USD/CAD', 'SPY', 'XRT'], tradingRecommendation: 'Strong reading supports USD.' },
    { id: uuidv4(), title: 'UK Employment Change', country: 'United Kingdom', countryCode: 'GB', currency: 'GBP', datetime: new Date(now.getTime() + 20 * 3600000).toISOString(), impact: 'high' as const, category: 'employment', forecast: '35K', previous: '48K', description: 'Change in number of employed people.', affectedSymbols: ['GBP/USD', 'EUR/GBP', 'GBP/JPY'], tradingRecommendation: 'Strong employment supports GBP.' },
    { id: uuidv4(), title: 'NVIDIA Earnings Q4 2026', country: 'United States', countryCode: 'US', currency: 'USD', datetime: new Date(now.getTime() + 30 * 3600000).toISOString(), impact: 'high' as const, category: 'earnings', forecast: 'EPS $5.85', previous: 'EPS $5.16', description: 'NVIDIA quarterly earnings report.', affectedSymbols: ['NVDA', 'AMD', 'SMCI', 'QQQ'], tradingRecommendation: 'High IV crush expected post-earnings.' },
    { id: uuidv4(), title: 'FOMC Meeting Minutes', country: 'United States', countryCode: 'US', currency: 'USD', datetime: new Date(now.getTime() + 48 * 3600000).toISOString(), impact: 'high' as const, category: 'interest-rate', description: 'Minutes from the latest Federal Reserve meeting.', affectedSymbols: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'TLT', 'SPY'], tradingRecommendation: 'Dovish minutes = USD weakness, gold strength.' },
    { id: uuidv4(), title: 'China GDP (YoY)', country: 'China', countryCode: 'CN', currency: 'CNY', datetime: new Date(now.getTime() + 60 * 3600000).toISOString(), impact: 'high' as const, category: 'gdp', forecast: '5.0%', previous: '4.9%', description: 'Chinese quarterly GDP growth.', affectedSymbols: ['AUD/USD', 'USD/CNY', 'FXI', 'CL'], tradingRecommendation: 'Strong China data = AUD bullish.' },
    { id: uuidv4(), title: 'German ZEW Sentiment', country: 'Germany', countryCode: 'DE', currency: 'EUR', datetime: new Date(now.getTime() + 36 * 3600000).toISOString(), impact: 'medium' as const, category: 'consumer', forecast: '15.2', previous: '12.8', description: 'Survey of financial experts.', affectedSymbols: ['EUR/USD', 'EUR/GBP', 'DAX'], tradingRecommendation: 'Above forecast = EUR positive.' },
    { id: uuidv4(), title: 'Japan Trade Balance', country: 'Japan', countryCode: 'JP', currency: 'JPY', datetime: new Date(now.getTime() + 18 * 3600000).toISOString(), impact: 'medium' as const, category: 'trade', forecast: '-¥500B', previous: '-¥580B', description: 'Difference between exports and imports.', affectedSymbols: ['USD/JPY', 'EUR/JPY', 'GBP/JPY'], tradingRecommendation: 'Improving balance = JPY positive.' },
    { id: uuidv4(), title: 'Apple Earnings Q1 2026', country: 'United States', countryCode: 'US', currency: 'USD', datetime: new Date(now.getTime() + 96 * 3600000).toISOString(), impact: 'high' as const, category: 'earnings', forecast: 'EPS $2.35', previous: 'EPS $2.18', description: 'Apple quarterly earnings.', affectedSymbols: ['AAPL', 'QQQ', 'SPY'], tradingRecommendation: 'Watch guidance more than EPS beat/miss.' },
  ];
  return events.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
}

let events = generateUpcomingEvents();
let reminders: EventReminder[] = [];

export async function calendarRoutes(fastify: FastifyInstance, _opts: FastifyPluginOptions) {

  // GET /api/calendar - Get upcoming events
  fastify.get<{ Querystring: { country?: string; impact?: string; category?: string; currency?: string; days?: number; limit?: number } }>('/', {
    schema: { description: 'Get economic calendar events', tags: ['Calendar'] },
  }, async (request) => {
    const { country, impact, category, currency, days = 7, limit } = request.query;
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 3600000);
    
    let filtered = events.filter(e => { const d = new Date(e.datetime); return d >= now && d <= endDate; });
    if (country) filtered = filtered.filter(e => e.countryCode === country || e.country.toLowerCase().includes(country.toLowerCase()));
    if (impact) filtered = filtered.filter(e => e.impact === impact);
    if (category) filtered = filtered.filter(e => e.category === category);
    if (currency) filtered = filtered.filter(e => e.currency === currency);
    
    filtered.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
    if (limit) filtered = filtered.slice(0, limit);
    
    return { events: filtered, total: filtered.length, timeRange: `Next ${days} days` };
  });

  // GET /api/calendar/today
  fastify.get('/today', {
    schema: { description: 'Get today\'s events', tags: ['Calendar'] },
  }, async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 3600000);
    const todayEvents = events.filter(e => { const d = new Date(e.datetime); return d >= todayStart && d < todayEnd; });
    return {
      date: todayStart.toISOString().split('T')[0],
      events: todayEvents,
      byImpact: { high: todayEvents.filter(e => e.impact === 'high'), medium: todayEvents.filter(e => e.impact === 'medium'), low: todayEvents.filter(e => e.impact === 'low') },
      totalHigh: todayEvents.filter(e => e.impact === 'high').length,
    };
  });

  // GET /api/calendar/next
  fastify.get('/next', {
    schema: { description: 'Get next upcoming event', tags: ['Calendar'] },
  }, async () => {
    const now = new Date();
    const nextHigh = events.find(e => e.impact === 'high' && new Date(e.datetime) > now);
    const nextAny = events.find(e => new Date(e.datetime) > now);
    if (!nextAny) return { message: 'No upcoming events' };
    
    const timeUntilNext = new Date(nextAny.datetime).getTime() - now.getTime();
    const hoursUntil = Math.floor(timeUntilNext / 3600000);
    const minutesUntil = Math.floor((timeUntilNext % 3600000) / 60000);
    
    return { nextEvent: nextAny, nextHighImpact: nextHigh || null, timeUntilNext: `${hoursUntil}h ${minutesUntil}m`, timeUntilNextMs: timeUntilNext };
  });

  // GET /api/calendar/symbol/:symbol
  fastify.get<{ Params: { symbol: string }; Querystring: { days?: number } }>('/symbol/:symbol', {
    schema: { description: 'Get events affecting a symbol', tags: ['Calendar'] },
  }, async (request) => {
    const symbol = request.params.symbol.toUpperCase();
    const { days = 7 } = request.query;
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 3600000);
    
    const affecting = events.filter(e => {
      const d = new Date(e.datetime);
      const inRange = d >= now && d <= endDate;
      const affectsSymbol = e.affectedSymbols.some(s => s.toUpperCase().includes(symbol) || symbol.includes(s.toUpperCase().replace('/', '')));
      return inRange && affectsSymbol;
    });
    
    return { symbol, events: affecting, total: affecting.length, highImpactCount: affecting.filter(e => e.impact === 'high').length };
  });

  // GET /api/calendar/categories
  fastify.get('/categories', {
    schema: { description: 'Get event categories', tags: ['Calendar'] },
  }, async () => {
    const categories = [
      { id: 'interest-rate', name: 'Interest Rates', icon: '🏦' },
      { id: 'employment', name: 'Employment', icon: '👷' },
      { id: 'inflation', name: 'Inflation', icon: '📈' },
      { id: 'gdp', name: 'GDP', icon: '🏭' },
      { id: 'trade', name: 'Trade', icon: '🚢' },
      { id: 'pmi', name: 'PMI', icon: '📊' },
      { id: 'consumer', name: 'Consumer', icon: '🛒' },
      { id: 'housing', name: 'Housing', icon: '🏠' },
      { id: 'speech', name: 'Speeches', icon: '🎤' },
      { id: 'earnings', name: 'Earnings', icon: '💰' },
    ].map(cat => ({ ...cat, upcomingCount: events.filter(e => e.category === cat.id).length }));
    return { categories };
  });

  // GET /api/calendar/countries
  fastify.get('/countries', {
    schema: { description: 'Get countries with events', tags: ['Calendar'] },
  }, async () => {
    const countryMap = new Map<string, { code: string; count: number }>();
    events.forEach(e => {
      const existing = countryMap.get(e.country);
      if (existing) existing.count++; else countryMap.set(e.country, { code: e.countryCode, count: 1 });
    });
    return { countries: Array.from(countryMap.entries()).map(([name, data]) => ({ name, code: data.code, eventCount: data.count })).sort((a, b) => b.eventCount - a.eventCount) };
  });

  // GET /api/calendar/earnings
  fastify.get<{ Querystring: { days?: number } }>('/earnings', {
    schema: { description: 'Get upcoming earnings', tags: ['Calendar'] },
  }, async (request) => {
    const { days = 14 } = request.query;
    const now = new Date();
    const endDate = new Date(now.getTime() + days * 24 * 3600000);
    const earnings = events.filter(e => e.category === 'earnings' && new Date(e.datetime) >= now && new Date(e.datetime) <= endDate);
    return { earnings, total: earnings.length, timeRange: `Next ${days} days` };
  });

  // GET /api/calendar/:id
  fastify.get<{ Params: { id: string } }>('/:id', {
    schema: { description: 'Get single event', tags: ['Calendar'] },
  }, async (request, reply) => {
    const event = events.find(e => e.id === request.params.id);
    if (!event) return reply.code(404).send({ error: 'Event not found' });
    return { event };
  });

  // POST /api/calendar/:id/reminder
  fastify.post<{ Params: { id: string }; Body: { agentId: string; minutesBefore?: number } }>('/:id/reminder', {
    schema: { description: 'Set event reminder', tags: ['Calendar'] },
  }, async (request, reply) => {
    const { agentId, minutesBefore = 30 } = request.body;
    if (!agentId) return reply.code(400).send({ error: 'agentId required' });
    
    const event = events.find(e => e.id === request.params.id);
    if (!event) return reply.code(404).send({ error: 'Event not found' });
    
    const existing = reminders.find(r => r.agentId === agentId && r.eventId === request.params.id);
    if (existing) { existing.minutesBefore = minutesBefore; return { reminder: existing, updated: true }; }
    
    const reminder: EventReminder = { id: uuidv4(), agentId, eventId: request.params.id, minutesBefore, notified: false, createdAt: new Date().toISOString() };
    reminders.push(reminder);
    return { reminder };
  });

  // DELETE /api/calendar/:id/reminder
  fastify.delete<{ Params: { id: string }; Body: { agentId: string } }>('/:id/reminder', {
    schema: { description: 'Remove reminder', tags: ['Calendar'] },
  }, async (request, reply) => {
    const { agentId } = request.body;
    const idx = reminders.findIndex(r => r.agentId === agentId && r.eventId === request.params.id);
    if (idx === -1) return reply.code(404).send({ error: 'Reminder not found' });
    reminders.splice(idx, 1);
    return { success: true };
  });

  // GET /api/calendar/reminders/:agentId
  fastify.get<{ Params: { agentId: string } }>('/reminders/:agentId', {
    schema: { description: 'Get agent reminders', tags: ['Calendar'] },
  }, async (request) => {
    const withEvents = reminders.filter(r => r.agentId === request.params.agentId).map(r => ({ ...r, event: events.find(e => e.id === r.eventId) })).filter(r => r.event);
    return { reminders: withEvents };
  });
}
