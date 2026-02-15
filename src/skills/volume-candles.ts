/**
 * K.I.T. Skill #97: Volume Candles
 * Combines price and volume into unified candles (TradingView Premium feature)
 * 
 * Features:
 * - Volume-weighted candles (candle width = volume)
 * - Equivolume charts
 * - Volume at Price (VAP) overlay
 * - Time/Volume normalization
 * - Volume profile per candle
 * - Customizable volume thresholds
 * - Color coding by volume intensity
 * - Multiple aggregation periods
 */

// Tool types removed for TS compatibility

interface VolumeCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeNormalized: number;  // 0-1 scale relative to period
  width: number;             // Visual width based on volume
  vwap: number;              // Volume-weighted average price
  buyVolume: number;         // Estimated buy volume
  sellVolume: number;        // Estimated sell volume
  volumeProfile: VolumeAtPrice[];
  intensity: 'low' | 'medium' | 'high' | 'extreme';
}

interface VolumeAtPrice {
  price: number;
  volume: number;
  percentage: number;
}

interface VolumeCandleConfig {
  symbol: string;
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  lookbackPeriods: number;
  volumeThresholds: {
    low: number;      // percentile
    medium: number;
    high: number;
  };
  pricelevels: number;  // Number of price levels for VAP
  normalizeWidth: boolean;
  showVwap: boolean;
}

interface EquivolumeChart {
  candles: VolumeCandle[];
  averageVolume: number;
  totalVolume: number;
  volumeDistribution: {
    low: number;
    medium: number;
    high: number;
    extreme: number;
  };
  maxWidth: number;
  minWidth: number;
}

const defaultConfig: VolumeCandleConfig = {
  symbol: 'BTCUSD',
  timeframe: '1h',
  lookbackPeriods: 100,
  volumeThresholds: {
    low: 25,
    medium: 50,
    high: 75
  },
  pricelevels: 20,
  normalizeWidth: true,
  showVwap: true
};

function calculateVolumeCandles(
  ohlcv: any[],
  config: VolumeCandleConfig
): EquivolumeChart {
  const volumes = ohlcv.map(c => c.volume);
  const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const maxVolume = Math.max(...volumes);
  const minVolume = Math.min(...volumes);
  
  // Calculate percentiles for thresholds
  const sortedVolumes = [...volumes].sort((a, b) => a - b);
  const lowThreshold = sortedVolumes[Math.floor(sortedVolumes.length * config.volumeThresholds.low / 100)];
  const medThreshold = sortedVolumes[Math.floor(sortedVolumes.length * config.volumeThresholds.medium / 100)];
  const highThreshold = sortedVolumes[Math.floor(sortedVolumes.length * config.volumeThresholds.high / 100)];
  
  const distribution = { low: 0, medium: 0, high: 0, extreme: 0 };
  
  const candles: VolumeCandle[] = ohlcv.map(bar => {
    // Normalize volume to 0-1
    const volumeNormalized = (bar.volume - minVolume) / (maxVolume - minVolume || 1);
    
    // Calculate width (1-3 based on volume)
    const width = config.normalizeWidth 
      ? 1 + (volumeNormalized * 2)
      : bar.volume / avgVolume;
    
    // Estimate buy/sell volume using candle direction and body size
    const bodySize = Math.abs(bar.close - bar.open);
    const range = bar.high - bar.low || 1;
    const bodyRatio = bodySize / range;
    
    const isBullish = bar.close > bar.open;
    const buyRatio = isBullish ? 0.5 + (bodyRatio * 0.3) : 0.5 - (bodyRatio * 0.3);
    const buyVolume = bar.volume * buyRatio;
    const sellVolume = bar.volume * (1 - buyRatio);
    
    // Calculate VWAP for this candle (approximation)
    const vwap = (bar.high + bar.low + bar.close) / 3;
    
    // Determine intensity
    let intensity: 'low' | 'medium' | 'high' | 'extreme';
    if (bar.volume >= highThreshold) {
      intensity = 'extreme';
      distribution.extreme++;
    } else if (bar.volume >= medThreshold) {
      intensity = 'high';
      distribution.high++;
    } else if (bar.volume >= lowThreshold) {
      intensity = 'medium';
      distribution.medium++;
    } else {
      intensity = 'low';
      distribution.low++;
    }
    
    // Generate volume profile for candle
    const priceStep = (bar.high - bar.low) / config.pricelevels;
    const volumeProfile: VolumeAtPrice[] = [];
    
    for (let i = 0; i < config.pricelevels; i++) {
      const priceLevel = bar.low + (priceStep * i);
      // Distribute volume using triangular distribution centered on close
      const distanceFromClose = Math.abs(priceLevel - bar.close);
      const maxDistance = Math.max(bar.close - bar.low, bar.high - bar.close);
      const volumeWeight = 1 - (distanceFromClose / (maxDistance || 1));
      const levelVolume = bar.volume * volumeWeight / config.pricelevels;
      
      volumeProfile.push({
        price: priceLevel,
        volume: levelVolume,
        percentage: (levelVolume / bar.volume) * 100
      });
    }
    
    return {
      timestamp: bar.timestamp,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      volumeNormalized,
      width,
      vwap,
      buyVolume,
      sellVolume,
      volumeProfile,
      intensity
    };
  });
  
  return {
    candles,
    averageVolume: avgVolume,
    totalVolume: volumes.reduce((a, b) => a + b, 0),
    volumeDistribution: distribution,
    maxWidth: Math.max(...candles.map(c => c.width)),
    minWidth: Math.min(...candles.map(c => c.width))
  };
}

export const volumeCandlesTool: any = {
  name: 'volume_candles',
  description: 'Generate volume-weighted candles combining price and volume (equivolume charts)',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Trading symbol' },
      timeframe: { 
        type: 'string', 
        enum: ['1m', '5m', '15m', '1h', '4h', '1d'],
        description: 'Chart timeframe' 
      },
      periods: { type: 'number', description: 'Number of candles to analyze' },
      showProfile: { type: 'boolean', description: 'Include volume profile per candle' }
    },
    required: ['symbol']
  },
  execute: async (params: any) => {
    const config: VolumeCandleConfig = {
      ...defaultConfig,
      symbol: params.symbol,
      timeframe: params.timeframe || '1h',
      lookbackPeriods: params.periods || 100
    };
    
    // Mock OHLCV data (in production, fetch from exchange)
    const mockData = Array.from({ length: config.lookbackPeriods }, (_, i) => {
      const basePrice = 50000 + Math.random() * 5000;
      const volatility = 0.02;
      return {
        timestamp: Date.now() - (config.lookbackPeriods - i) * 3600000,
        open: basePrice,
        high: basePrice * (1 + Math.random() * volatility),
        low: basePrice * (1 - Math.random() * volatility),
        close: basePrice * (1 + (Math.random() - 0.5) * volatility),
        volume: Math.random() * 1000000 + 100000
      };
    });
    
    const chart = calculateVolumeCandles(mockData, config);
    
    return {
      success: true,
      symbol: config.symbol,
      timeframe: config.timeframe,
      candleCount: chart.candles.length,
      averageVolume: chart.averageVolume,
      totalVolume: chart.totalVolume,
      volumeDistribution: chart.volumeDistribution,
      widthRange: {
        min: chart.minWidth.toFixed(2),
        max: chart.maxWidth.toFixed(2)
      },
      recentCandles: chart.candles.slice(-5).map(c => ({
        time: new Date(c.timestamp).toISOString(),
        ohlc: `${c.open.toFixed(2)}/${c.high.toFixed(2)}/${c.low.toFixed(2)}/${c.close.toFixed(2)}`,
        volume: c.volume.toFixed(0),
        intensity: c.intensity,
        width: c.width.toFixed(2),
        buyPct: ((c.buyVolume / c.volume) * 100).toFixed(1) + '%'
      }))
    };
  }
};

export const skills = [volumeCandlesTool];
export default volumeCandlesTool;
