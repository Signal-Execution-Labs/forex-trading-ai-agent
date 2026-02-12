/**
 * Pi Cycle Top/Bottom Indicator
 * Skill #80 | Bitcoin market cycle detection
 */

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Extreme' | 'TOP_SIGNAL' | 'BOTTOM_SIGNAL';
export type PiSignal = 'Safe' | 'Approaching' | 'Danger' | 'Crossed' | 'Accumulation';

export interface PiCycleStatus {
  symbol: string;
  timestamp: Date;
  price: number;
  ma111: number;
  ma350x2: number;
  distance: number; // percentage
  velocity: number; // % per day
  daysToConvergence: number | null;
  signal: PiSignal;
  riskLevel: RiskLevel;
  historicalContext: string;
  bottomIndicator: {
    ma200w: number;
    belowMa200w: boolean;
    monthlyRsi: number;
    isOversold: boolean;
  };
}

export interface HistoricalCrossover {
  date: Date;
  type: 'top' | 'bottom';
  price: number;
  accuracy: string;
}

// Historical Pi Cycle tops
const HISTORICAL_TOPS: HistoricalCrossover[] = [
  { date: new Date('2013-04-09'), type: 'top', price: 230, accuracy: 'Within 3 days' },
  { date: new Date('2013-12-04'), type: 'top', price: 1150, accuracy: 'Within 3 days' },
  { date: new Date('2017-12-16'), type: 'top', price: 19800, accuracy: 'Within 3 days' },
  { date: new Date('2021-04-13'), type: 'top', price: 64000, accuracy: 'Within 3 days (local)' },
  { date: new Date('2021-11-10'), type: 'top', price: 69000, accuracy: 'Within 1 week' }
];

// Historical bottoms
const HISTORICAL_BOTTOMS: HistoricalCrossover[] = [
  { date: new Date('2015-01-14'), type: 'bottom', price: 178, accuracy: 'Within 2 weeks' },
  { date: new Date('2018-12-15'), type: 'bottom', price: 3200, accuracy: 'Within 1 week' },
  { date: new Date('2022-11-21'), type: 'bottom', price: 15500, accuracy: 'Within 1 week' }
];

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

/**
 * Get risk level based on distance to crossover
 */
function getRiskLevel(distance: number, crossed: boolean): RiskLevel {
  if (crossed) return 'TOP_SIGNAL';
  if (distance > 20) return 'Low';
  if (distance > 10) return 'Medium';
  if (distance > 5) return 'High';
  return 'Extreme';
}

/**
 * Get signal based on distance
 */
function getSignal(distance: number, crossed: boolean): PiSignal {
  if (crossed) return 'Crossed';
  if (distance > 20) return 'Safe';
  if (distance > 5) return 'Approaching';
  return 'Danger';
}

/**
 * Get historical context for current situation
 */
function getHistoricalContext(distance: number, velocity: number): string {
  if (distance < 5 && velocity > 0) {
    return 'Similar to Nov 2021 pattern - rapid convergence';
  }
  if (distance < 10) {
    return 'Similar to late 2017 - entering danger zone';
  }
  if (distance < 20) {
    return 'Mid-cycle momentum - monitor closely';
  }
  return 'Early cycle phase - historically safe';
}

/**
 * Calculate Pi Cycle status
 */
export async function getPiCycleStatus(
  symbol: string = 'BTCUSD',
  data?: { 
    prices?: number[]; 
    weeklyPrices?: number[];
    monthlyRsi?: number;
  }
): Promise<PiCycleStatus> {
  // In production, fetch real price data
  // For simulation, use reasonable BTC values
  const prices = data?.prices ?? generateSimulatedPrices();
  const weeklyPrices = data?.weeklyPrices ?? prices.filter((_, i) => i % 7 === 0);
  
  const currentPrice = prices[prices.length - 1];
  const ma111 = calculateSMA(prices, 111);
  const ma350 = calculateSMA(prices, 350);
  const ma350x2 = ma350 * 2;
  
  // Calculate distance (negative means not crossed yet)
  const distance = ((ma350x2 - ma111) / ma350x2) * 100;
  const crossed = ma111 > ma350x2;
  
  // Calculate velocity (rate of convergence)
  // Compare to yesterday's values
  const prevPrices = prices.slice(0, -1);
  const prevMa111 = calculateSMA(prevPrices, 111);
  const prevMa350x2 = calculateSMA(prevPrices, 350) * 2;
  const prevDistance = ((prevMa350x2 - prevMa111) / prevMa350x2) * 100;
  const velocity = prevDistance - distance; // Positive = converging
  
  // Estimate days to convergence
  let daysToConvergence: number | null = null;
  if (velocity > 0 && distance > 0) {
    daysToConvergence = Math.round(distance / velocity);
  }
  
  // Bottom indicator (200 week MA + monthly RSI)
  const ma200w = calculateSMA(weeklyPrices, 200);
  const belowMa200w = currentPrice < ma200w;
  const monthlyRsi = data?.monthlyRsi ?? 55; // Default neutral
  const isOversold = monthlyRsi < 30 && belowMa200w;
  
  return {
    symbol,
    timestamp: new Date(),
    price: currentPrice,
    ma111,
    ma350x2,
    distance: Math.abs(distance),
    velocity,
    daysToConvergence,
    signal: isOversold ? 'Accumulation' : getSignal(Math.abs(distance), crossed),
    riskLevel: isOversold ? 'BOTTOM_SIGNAL' : getRiskLevel(Math.abs(distance), crossed),
    historicalContext: getHistoricalContext(Math.abs(distance), velocity),
    bottomIndicator: {
      ma200w,
      belowMa200w,
      monthlyRsi,
      isOversold
    }
  };
}

/**
 * Generate simulated BTC prices for demo
 */
function generateSimulatedPrices(): number[] {
  const basePrice = 98000; // Current-ish BTC price
  const prices: number[] = [];
  
  // Generate 400 days of prices
  for (let i = 0; i < 400; i++) {
    const trend = i / 400 * 0.3; // Gradual uptrend
    const noise = (Math.random() - 0.5) * 0.02;
    const price = basePrice * (0.7 + trend + noise);
    prices.push(price);
  }
  
  return prices;
}

/**
 * Get historical crossovers
 */
export function getHistoricalCrossovers(): HistoricalCrossover[] {
  return [...HISTORICAL_TOPS, ...HISTORICAL_BOTTOMS].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

/**
 * Set Pi Cycle alert
 */
export interface PiCycleAlert {
  symbol: string;
  threshold: number; // percentage distance
  notify: ('telegram' | 'email' | 'webhook')[];
  webhookUrl?: string;
}

const alerts: PiCycleAlert[] = [];

export function setPiCycleAlert(alert: PiCycleAlert): void {
  alerts.push(alert);
  console.log(`Pi Cycle alert set for ${alert.symbol} at ${alert.threshold}%`);
}

export function getAlerts(): PiCycleAlert[] {
  return [...alerts];
}

/**
 * Check if any alerts should fire
 */
export async function checkAlerts(): Promise<{ fired: PiCycleAlert[]; status: PiCycleStatus }[]> {
  const results: { fired: PiCycleAlert[]; status: PiCycleStatus }[] = [];
  
  for (const alert of alerts) {
    const status = await getPiCycleStatus(alert.symbol);
    
    if (status.distance <= alert.threshold) {
      results.push({ fired: [alert], status });
    }
  }
  
  return results;
}

// Export default
export default {
  getPiCycleStatus,
  getHistoricalCrossovers,
  setPiCycleAlert,
  getAlerts,
  checkAlerts
};
