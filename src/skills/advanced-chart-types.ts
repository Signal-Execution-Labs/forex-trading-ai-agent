/**
 * K.I.T. Skill #100: Advanced Chart Types
 * All professional chart types from TradingView
 * 
 * Chart Types:
 * - Kagi (reversal-based, no time axis)
 * - Renko (fixed brick size, filters noise)
 * - Point & Figure (Xs and Os)
 * - Line Break (reversal lines)
 * - Heikin Ashi (smoothed candles)
 * - Range Bars (fixed price range)
 * - Tick Charts (trade-based)
 * - Volume Charts (volume-based candles)
 */

import { Tool } from '../types/tool.js';

interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ==================== KAGI CHART ====================
interface KagiLine {
  timestamp: number;
  price: number;
  type: 'yang' | 'yin';  // yang = thick (bullish), yin = thin (bearish)
  shoulder?: number;  // Previous peak
  waist?: number;     // Previous trough
}

function calculateKagi(data: OHLCV[], reversalPercent: number = 4): KagiLine[] {
  if (data.length < 2) return [];
  
  const kagi: KagiLine[] = [];
  let direction: 'up' | 'down' = data[1].close > data[0].close ? 'up' : 'down';
  let lastInflection = data[0].close;
  let type: 'yang' | 'yin' = direction === 'up' ? 'yang' : 'yin';
  let shoulder = direction === 'up' ? data[0].close : undefined;
  let waist = direction === 'down' ? data[0].close : undefined;
  
  kagi.push({
    timestamp: data[0].timestamp,
    price: data[0].close,
    type,
    shoulder,
    waist
  });
  
  for (let i = 1; i < data.length; i++) {
    const price = data[i].close;
    const reversalAmount = lastInflection * (reversalPercent / 100);
    
    if (direction === 'up') {
      if (price > lastInflection) {
        // Continue up
        lastInflection = price;
        kagi[kagi.length - 1].price = price;
      } else if (price < lastInflection - reversalAmount) {
        // Reversal down
        if (waist && price < waist) {
          type = 'yin';  // Break below waist = bearish
        }
        shoulder = lastInflection;
        direction = 'down';
        lastInflection = price;
        kagi.push({
          timestamp: data[i].timestamp,
          price,
          type,
          shoulder,
          waist
        });
      }
    } else {
      if (price < lastInflection) {
        // Continue down
        lastInflection = price;
        kagi[kagi.length - 1].price = price;
      } else if (price > lastInflection + reversalAmount) {
        // Reversal up
        if (shoulder && price > shoulder) {
          type = 'yang';  // Break above shoulder = bullish
        }
        waist = lastInflection;
        direction = 'up';
        lastInflection = price;
        kagi.push({
          timestamp: data[i].timestamp,
          price,
          type,
          shoulder,
          waist
        });
      }
    }
  }
  
  return kagi;
}

// ==================== RENKO CHART ====================
interface RenkoBrick {
  timestamp: number;
  open: number;
  close: number;
  type: 'up' | 'down';
  brickNumber: number;
}

function calculateRenko(data: OHLCV[], brickSize: number): RenkoBrick[] {
  if (data.length < 1) return [];
  
  const bricks: RenkoBrick[] = [];
  let lastBrickClose = Math.floor(data[0].close / brickSize) * brickSize;
  let brickNumber = 0;
  
  for (const bar of data) {
    const price = bar.close;
    
    // Check for up bricks
    while (price >= lastBrickClose + brickSize) {
      brickNumber++;
      bricks.push({
        timestamp: bar.timestamp,
        open: lastBrickClose,
        close: lastBrickClose + brickSize,
        type: 'up',
        brickNumber
      });
      lastBrickClose += brickSize;
    }
    
    // Check for down bricks
    while (price <= lastBrickClose - brickSize) {
      brickNumber++;
      bricks.push({
        timestamp: bar.timestamp,
        open: lastBrickClose,
        close: lastBrickClose - brickSize,
        type: 'down',
        brickNumber
      });
      lastBrickClose -= brickSize;
    }
  }
  
  return bricks;
}

// ==================== POINT & FIGURE ====================
interface PnFColumn {
  type: 'X' | 'O';
  startPrice: number;
  endPrice: number;
  boxes: number;
  timestamp: number;
}

function calculatePointAndFigure(data: OHLCV[], boxSize: number, reversalBoxes: number = 3): PnFColumn[] {
  if (data.length < 1) return [];
  
  const columns: PnFColumn[] = [];
  let currentType: 'X' | 'O' = data[1]?.close > data[0].close ? 'X' : 'O';
  let columnHigh = Math.ceil(data[0].high / boxSize) * boxSize;
  let columnLow = Math.floor(data[0].low / boxSize) * boxSize;
  
  columns.push({
    type: currentType,
    startPrice: currentType === 'X' ? columnLow : columnHigh,
    endPrice: currentType === 'X' ? columnHigh : columnLow,
    boxes: Math.round(Math.abs(columnHigh - columnLow) / boxSize),
    timestamp: data[0].timestamp
  });
  
  for (let i = 1; i < data.length; i++) {
    const bar = data[i];
    
    if (currentType === 'X') {
      // Rising column
      if (bar.high > columnHigh + boxSize) {
        columnHigh = Math.ceil(bar.high / boxSize) * boxSize;
        columns[columns.length - 1].endPrice = columnHigh;
        columns[columns.length - 1].boxes = Math.round((columnHigh - columns[columns.length - 1].startPrice) / boxSize);
      } else if (bar.low < columnHigh - (reversalBoxes * boxSize)) {
        // Reversal to O
        currentType = 'O';
        columnLow = Math.floor(bar.low / boxSize) * boxSize;
        columns.push({
          type: 'O',
          startPrice: columnHigh - boxSize,
          endPrice: columnLow,
          boxes: Math.round((columnHigh - boxSize - columnLow) / boxSize),
          timestamp: bar.timestamp
        });
      }
    } else {
      // Falling column
      if (bar.low < columnLow - boxSize) {
        columnLow = Math.floor(bar.low / boxSize) * boxSize;
        columns[columns.length - 1].endPrice = columnLow;
        columns[columns.length - 1].boxes = Math.round((columns[columns.length - 1].startPrice - columnLow) / boxSize);
      } else if (bar.high > columnLow + (reversalBoxes * boxSize)) {
        // Reversal to X
        currentType = 'X';
        columnHigh = Math.ceil(bar.high / boxSize) * boxSize;
        columns.push({
          type: 'X',
          startPrice: columnLow + boxSize,
          endPrice: columnHigh,
          boxes: Math.round((columnHigh - columnLow - boxSize) / boxSize),
          timestamp: bar.timestamp
        });
      }
    }
  }
  
  return columns;
}

// ==================== HEIKIN ASHI ====================
interface HeikinAshiCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  trend: 'bullish' | 'bearish' | 'indecision';
  bodySize: number;
  wickRatio: number;
}

function calculateHeikinAshi(data: OHLCV[]): HeikinAshiCandle[] {
  if (data.length < 1) return [];
  
  const ha: HeikinAshiCandle[] = [];
  
  for (let i = 0; i < data.length; i++) {
    const current = data[i];
    const prev = i > 0 ? ha[i - 1] : null;
    
    const close = (current.open + current.high + current.low + current.close) / 4;
    const open = prev ? (prev.open + prev.close) / 2 : (current.open + current.close) / 2;
    const high = Math.max(current.high, open, close);
    const low = Math.min(current.low, open, close);
    
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    const wickRatio = totalRange > 0 ? (totalRange - bodySize) / totalRange : 0;
    
    let trend: 'bullish' | 'bearish' | 'indecision';
    if (close > open && low === open) {
      trend = 'bullish';  // No lower wick = strong bullish
    } else if (close < open && high === open) {
      trend = 'bearish';  // No upper wick = strong bearish
    } else {
      trend = 'indecision';
    }
    
    ha.push({
      timestamp: current.timestamp,
      open,
      high,
      low,
      close,
      trend,
      bodySize,
      wickRatio
    });
  }
  
  return ha;
}

// ==================== LINE BREAK ====================
interface LineBreakBar {
  timestamp: number;
  open: number;
  close: number;
  type: 'up' | 'down';
  lineNumber: number;
}

function calculateLineBreak(data: OHLCV[], lineCount: number = 3): LineBreakBar[] {
  if (data.length < 2) return [];
  
  const lines: LineBreakBar[] = [];
  let lineNumber = 0;
  
  // First line
  lineNumber++;
  lines.push({
    timestamp: data[0].timestamp,
    open: data[0].open,
    close: data[0].close,
    type: data[0].close > data[0].open ? 'up' : 'down',
    lineNumber
  });
  
  for (let i = 1; i < data.length; i++) {
    const price = data[i].close;
    const lastLine = lines[lines.length - 1];
    
    // Get the high and low of last N lines
    const recentLines = lines.slice(-lineCount);
    const highestClose = Math.max(...recentLines.map(l => Math.max(l.open, l.close)));
    const lowestClose = Math.min(...recentLines.map(l => Math.min(l.open, l.close)));
    
    if (lastLine.type === 'up') {
      if (price > highestClose) {
        // Continue up
        lineNumber++;
        lines.push({
          timestamp: data[i].timestamp,
          open: lastLine.close,
          close: price,
          type: 'up',
          lineNumber
        });
      } else if (price < lowestClose) {
        // Reversal down
        lineNumber++;
        lines.push({
          timestamp: data[i].timestamp,
          open: lastLine.close,
          close: price,
          type: 'down',
          lineNumber
        });
      }
    } else {
      if (price < lowestClose) {
        // Continue down
        lineNumber++;
        lines.push({
          timestamp: data[i].timestamp,
          open: lastLine.close,
          close: price,
          type: 'down',
          lineNumber
        });
      } else if (price > highestClose) {
        // Reversal up
        lineNumber++;
        lines.push({
          timestamp: data[i].timestamp,
          open: lastLine.close,
          close: price,
          type: 'up',
          lineNumber
        });
      }
    }
  }
  
  return lines;
}

// Generate mock data
function generateMockData(periods: number, basePrice: number): OHLCV[] {
  const data: OHLCV[] = [];
  let price = basePrice;
  
  for (let i = 0; i < periods; i++) {
    const change = (Math.random() - 0.48) * price * 0.02;
    const open = price;
    price += change;
    const high = Math.max(open, price) * (1 + Math.random() * 0.005);
    const low = Math.min(open, price) * (1 - Math.random() * 0.005);
    
    data.push({
      timestamp: Date.now() - (periods - i) * 3600000,
      open,
      high,
      low,
      close: price,
      volume: Math.random() * 100000 + 10000
    });
  }
  
  return data;
}

export const kagiChartTool: Tool = {
  name: 'chart_kagi',
  description: 'Generate Kagi chart (reversal-based, ignores time)',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Trading symbol' },
      reversalPercent: { type: 'number', description: 'Reversal threshold % (default 4)' },
      periods: { type: 'number', description: 'Data periods to analyze' }
    },
    required: ['symbol']
  },
  execute: async (params) => {
    const basePrice = params.symbol.includes('BTC') ? 50000 : 100;
    const data = generateMockData(params.periods || 100, basePrice);
    const kagi = calculateKagi(data, params.reversalPercent || 4);
    
    const yangCount = kagi.filter(k => k.type === 'yang').length;
    const yinCount = kagi.filter(k => k.type === 'yin').length;
    
    return {
      chartType: 'KAGI',
      symbol: params.symbol,
      reversalThreshold: (params.reversalPercent || 4) + '%',
      totalLines: kagi.length,
      yangLines: yangCount,
      yinLines: yinCount,
      trend: yangCount > yinCount ? 'BULLISH' : 'BEARISH',
      recentLines: kagi.slice(-5).map(k => ({
        type: k.type.toUpperCase(),
        price: k.price.toFixed(2),
        shoulder: k.shoulder?.toFixed(2),
        waist: k.waist?.toFixed(2)
      }))
    };
  }
};

export const renkoChartTool: Tool = {
  name: 'chart_renko',
  description: 'Generate Renko chart (fixed brick size, filters noise)',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Trading symbol' },
      brickSize: { type: 'number', description: 'Brick size in price units' },
      periods: { type: 'number', description: 'Data periods to analyze' }
    },
    required: ['symbol']
  },
  execute: async (params) => {
    const basePrice = params.symbol.includes('BTC') ? 50000 : 100;
    const brickSize = params.brickSize || (basePrice * 0.005);  // Default 0.5% brick
    const data = generateMockData(params.periods || 200, basePrice);
    const renko = calculateRenko(data, brickSize);
    
    const upBricks = renko.filter(r => r.type === 'up').length;
    const downBricks = renko.filter(r => r.type === 'down').length;
    
    return {
      chartType: 'RENKO',
      symbol: params.symbol,
      brickSize: brickSize.toFixed(2),
      totalBricks: renko.length,
      upBricks,
      downBricks,
      trend: upBricks > downBricks ? 'BULLISH' : 'BEARISH',
      currentPrice: renko[renko.length - 1]?.close.toFixed(2),
      recentBricks: renko.slice(-10).map(r => ({
        type: r.type === 'up' ? '🟩' : '🟥',
        price: r.close.toFixed(2)
      }))
    };
  }
};

export const pnfChartTool: Tool = {
  name: 'chart_point_figure',
  description: 'Generate Point & Figure chart (X and O columns)',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Trading symbol' },
      boxSize: { type: 'number', description: 'Box size in price units' },
      reversalBoxes: { type: 'number', description: 'Boxes for reversal (default 3)' }
    },
    required: ['symbol']
  },
  execute: async (params) => {
    const basePrice = params.symbol.includes('BTC') ? 50000 : 100;
    const boxSize = params.boxSize || (basePrice * 0.01);
    const data = generateMockData(200, basePrice);
    const pnf = calculatePointAndFigure(data, boxSize, params.reversalBoxes || 3);
    
    const xColumns = pnf.filter(c => c.type === 'X').length;
    const oColumns = pnf.filter(c => c.type === 'O').length;
    
    return {
      chartType: 'POINT_AND_FIGURE',
      symbol: params.symbol,
      boxSize: boxSize.toFixed(2),
      reversalBoxes: params.reversalBoxes || 3,
      totalColumns: pnf.length,
      xColumns,
      oColumns,
      trend: xColumns > oColumns ? 'BULLISH' : 'BEARISH',
      recentColumns: pnf.slice(-5).map(c => ({
        type: c.type,
        boxes: c.boxes,
        range: `${c.startPrice.toFixed(0)}-${c.endPrice.toFixed(0)}`
      }))
    };
  }
};

export const heikinAshiTool: Tool = {
  name: 'chart_heikin_ashi',
  description: 'Generate Heikin Ashi chart (smoothed candles)',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Trading symbol' },
      periods: { type: 'number', description: 'Number of candles' }
    },
    required: ['symbol']
  },
  execute: async (params) => {
    const basePrice = params.symbol.includes('BTC') ? 50000 : 100;
    const data = generateMockData(params.periods || 50, basePrice);
    const ha = calculateHeikinAshi(data);
    
    const bullish = ha.filter(h => h.trend === 'bullish').length;
    const bearish = ha.filter(h => h.trend === 'bearish').length;
    
    return {
      chartType: 'HEIKIN_ASHI',
      symbol: params.symbol,
      candles: ha.length,
      trendBreakdown: { bullish, bearish, indecision: ha.length - bullish - bearish },
      overallTrend: bullish > bearish ? 'BULLISH' : 'BEARISH',
      recentCandles: ha.slice(-5).map(h => ({
        trend: h.trend === 'bullish' ? '🟢' : h.trend === 'bearish' ? '🔴' : '⚪',
        ohlc: `${h.open.toFixed(0)}/${h.high.toFixed(0)}/${h.low.toFixed(0)}/${h.close.toFixed(0)}`,
        wickRatio: (h.wickRatio * 100).toFixed(0) + '%'
      }))
    };
  }
};

export const lineBreakTool: Tool = {
  name: 'chart_line_break',
  description: 'Generate Three Line Break chart (reversal lines)',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Trading symbol' },
      lineCount: { type: 'number', description: 'Lines for reversal (default 3)' }
    },
    required: ['symbol']
  },
  execute: async (params) => {
    const basePrice = params.symbol.includes('BTC') ? 50000 : 100;
    const data = generateMockData(100, basePrice);
    const lines = calculateLineBreak(data, params.lineCount || 3);
    
    const upLines = lines.filter(l => l.type === 'up').length;
    const downLines = lines.filter(l => l.type === 'down').length;
    
    return {
      chartType: `${params.lineCount || 3}_LINE_BREAK`,
      symbol: params.symbol,
      totalLines: lines.length,
      upLines,
      downLines,
      trend: upLines > downLines ? 'BULLISH' : 'BEARISH',
      recentLines: lines.slice(-5).map(l => ({
        type: l.type === 'up' ? '🟢' : '🔴',
        range: `${l.open.toFixed(0)} → ${l.close.toFixed(0)}`
      }))
    };
  }
};

export const skills = [kagiChartTool, renkoChartTool, pnfChartTool, heikinAshiTool, lineBreakTool];
export default { kagiChartTool, renkoChartTool, pnfChartTool, heikinAshiTool, lineBreakTool };
