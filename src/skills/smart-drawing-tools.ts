/**
 * K.I.T. Skill #98: Smart Drawing Tools
 * 110+ professional drawing tools like TradingView
 * 
 * Categories:
 * - Trend Lines (12 tools)
 * - Fibonacci (15 tools)
 * - Gann (8 tools)
 * - Patterns (18 tools)
 * - Annotations (12 tools)
 * - Shapes (15 tools)
 * - Measurements (10 tools)
 * - Price Tools (10 tools)
 * - Technical (10 tools)
 */

import { Tool } from '../types/tool.js';

// Drawing tool definitions
const DRAWING_CATEGORIES = {
  trendLines: {
    name: 'Trend Lines',
    tools: [
      { id: 'trend_line', name: 'Trend Line', hotkey: 'Alt+T' },
      { id: 'ray', name: 'Ray', hotkey: 'Alt+R' },
      { id: 'extended_line', name: 'Extended Line', hotkey: null },
      { id: 'trend_angle', name: 'Trend Angle', hotkey: null },
      { id: 'horizontal_line', name: 'Horizontal Line', hotkey: 'Alt+H' },
      { id: 'vertical_line', name: 'Vertical Line', hotkey: 'Alt+V' },
      { id: 'cross_line', name: 'Cross Line', hotkey: null },
      { id: 'parallel_channel', name: 'Parallel Channel', hotkey: null },
      { id: 'regression_trend', name: 'Regression Trend', hotkey: null },
      { id: 'pitchfork', name: 'Pitchfork', hotkey: null },
      { id: 'schiff_pitchfork', name: 'Schiff Pitchfork', hotkey: null },
      { id: 'inside_pitchfork', name: 'Inside Pitchfork', hotkey: null }
    ]
  },
  fibonacci: {
    name: 'Fibonacci Tools',
    tools: [
      { id: 'fib_retracement', name: 'Fib Retracement', hotkey: 'Alt+F' },
      { id: 'fib_extension', name: 'Fib Extension', hotkey: null },
      { id: 'fib_channel', name: 'Fib Channel', hotkey: null },
      { id: 'fib_timezone', name: 'Fib Time Zone', hotkey: null },
      { id: 'fib_speed_resistance', name: 'Fib Speed Resistance Fan', hotkey: null },
      { id: 'fib_spiral', name: 'Fib Spiral', hotkey: null },
      { id: 'fib_arc', name: 'Fib Arc', hotkey: null },
      { id: 'fib_circles', name: 'Fib Circles', hotkey: null },
      { id: 'fib_wedge', name: 'Fib Wedge', hotkey: null },
      { id: 'trend_fib_extension', name: 'Trend-Based Fib Extension', hotkey: null },
      { id: 'trend_fib_time', name: 'Trend-Based Fib Time', hotkey: null },
      { id: 'fib_time_extension', name: 'Fib Time Extension', hotkey: null },
      { id: 'auto_fib_retracement', name: 'Auto Fib Retracement', hotkey: null },
      { id: 'auto_fib_extension', name: 'Auto Fib Extension', hotkey: null },
      { id: 'golden_ratio', name: 'Golden Ratio (0.618)', hotkey: null }
    ]
  },
  gann: {
    name: 'Gann Tools',
    tools: [
      { id: 'gann_box', name: 'Gann Box', hotkey: null },
      { id: 'gann_square', name: 'Gann Square', hotkey: null },
      { id: 'gann_fan', name: 'Gann Fan', hotkey: null },
      { id: 'gann_square_fixed', name: 'Gann Square Fixed', hotkey: null },
      { id: 'gann_grid', name: 'Gann Grid', hotkey: null },
      { id: 'gann_hexagon', name: 'Gann Hexagon', hotkey: null },
      { id: 'gann_wheel', name: 'Gann Wheel (360°)', hotkey: null },
      { id: 'gann_angles', name: 'Gann Angles (1x1, 2x1, etc)', hotkey: null }
    ]
  },
  patterns: {
    name: 'Pattern Recognition',
    tools: [
      { id: 'xabcd', name: 'XABCD Pattern', hotkey: null },
      { id: 'cypher', name: 'Cypher Pattern', hotkey: null },
      { id: 'abcd', name: 'ABCD Pattern', hotkey: null },
      { id: 'three_drives', name: 'Three Drives', hotkey: null },
      { id: 'head_shoulders', name: 'Head and Shoulders', hotkey: null },
      { id: 'triangle', name: 'Triangle', hotkey: null },
      { id: 'wedge', name: 'Wedge', hotkey: null },
      { id: 'double_top', name: 'Double Top/Bottom', hotkey: null },
      { id: 'elliott_wave', name: 'Elliott Wave', hotkey: null },
      { id: 'elliott_correction', name: 'Elliott Correction Wave', hotkey: null },
      { id: 'elliott_triple', name: 'Elliott Triple Combo', hotkey: null },
      { id: 'harmonic_bat', name: 'Harmonic Bat', hotkey: null },
      { id: 'harmonic_gartley', name: 'Harmonic Gartley', hotkey: null },
      { id: 'harmonic_butterfly', name: 'Harmonic Butterfly', hotkey: null },
      { id: 'harmonic_crab', name: 'Harmonic Crab', hotkey: null },
      { id: 'cup_handle', name: 'Cup and Handle', hotkey: null },
      { id: 'flag_pennant', name: 'Flag/Pennant', hotkey: null },
      { id: 'channel_pattern', name: 'Channel Pattern', hotkey: null }
    ]
  },
  annotations: {
    name: 'Annotations',
    tools: [
      { id: 'text', name: 'Text', hotkey: null },
      { id: 'anchored_text', name: 'Anchored Text', hotkey: null },
      { id: 'note', name: 'Note', hotkey: null },
      { id: 'callout', name: 'Callout', hotkey: null },
      { id: 'price_label', name: 'Price Label', hotkey: null },
      { id: 'price_note', name: 'Price Note', hotkey: null },
      { id: 'arrow_marker', name: 'Arrow Marker', hotkey: null },
      { id: 'flag_marker', name: 'Flag Marker', hotkey: null },
      { id: 'signpost', name: 'Signpost', hotkey: null },
      { id: 'balloon', name: 'Balloon', hotkey: null },
      { id: 'emoji', name: 'Emoji/Sticker', hotkey: null },
      { id: 'image', name: 'Image', hotkey: null }
    ]
  },
  shapes: {
    name: 'Shapes',
    tools: [
      { id: 'rectangle', name: 'Rectangle', hotkey: null },
      { id: 'rotated_rectangle', name: 'Rotated Rectangle', hotkey: null },
      { id: 'ellipse', name: 'Ellipse', hotkey: null },
      { id: 'circle', name: 'Circle', hotkey: null },
      { id: 'arc', name: 'Arc', hotkey: null },
      { id: 'polyline', name: 'Polyline', hotkey: null },
      { id: 'curve', name: 'Curve', hotkey: null },
      { id: 'arrow', name: 'Arrow', hotkey: null },
      { id: 'price_range', name: 'Price Range', hotkey: null },
      { id: 'date_range', name: 'Date Range', hotkey: null },
      { id: 'date_price_range', name: 'Date and Price Range', hotkey: null },
      { id: 'brush', name: 'Brush', hotkey: null },
      { id: 'highlighter', name: 'Highlighter', hotkey: null },
      { id: 'path', name: 'Path', hotkey: null },
      { id: 'ghost_feed', name: 'Ghost Feed', hotkey: null }
    ]
  },
  measurements: {
    name: 'Measurements',
    tools: [
      { id: 'measure', name: 'Measure', hotkey: null },
      { id: 'long_position', name: 'Long Position', hotkey: 'Alt+L' },
      { id: 'short_position', name: 'Short Position', hotkey: 'Alt+S' },
      { id: 'forecast', name: 'Forecast', hotkey: null },
      { id: 'price_target', name: 'Price Target', hotkey: null },
      { id: 'risk_reward', name: 'Risk/Reward', hotkey: null },
      { id: 'bars_pattern', name: 'Bars Pattern', hotkey: null },
      { id: 'ruler', name: 'Ruler', hotkey: null },
      { id: 'protractor', name: 'Protractor', hotkey: null },
      { id: 'percentage_move', name: 'Percentage Move', hotkey: null }
    ]
  },
  priceTools: {
    name: 'Price Tools',
    tools: [
      { id: 'horizontal_ray', name: 'Horizontal Ray', hotkey: null },
      { id: 'anchored_vwap', name: 'Anchored VWAP', hotkey: null },
      { id: 'fixed_range_vp', name: 'Fixed Range Volume Profile', hotkey: null },
      { id: 'session_vp', name: 'Session Volume Profile', hotkey: null },
      { id: 'price_level', name: 'Price Level', hotkey: null },
      { id: 'time_cycle', name: 'Time Cycle', hotkey: null },
      { id: 'sine_wave', name: 'Sine Wave', hotkey: null },
      { id: 'cyclical_lines', name: 'Cyclical Lines', hotkey: null },
      { id: 'time_price_levels', name: 'Time & Price Levels', hotkey: null },
      { id: 'pivot_point', name: 'Pivot Point', hotkey: null }
    ]
  },
  technical: {
    name: 'Technical Tools',
    tools: [
      { id: 'projection', name: 'Projection', hotkey: null },
      { id: 'flat_top_bottom', name: 'Flat Top/Bottom', hotkey: null },
      { id: 'speed_line', name: 'Speed Line', hotkey: null },
      { id: 'disjoint_channel', name: 'Disjoint Channel', hotkey: null },
      { id: 'polycross', name: 'Polycross', hotkey: null },
      { id: 'time_extension', name: 'Time Extension', hotkey: null },
      { id: 'trend_line_multiple', name: 'Multiple Trend Lines', hotkey: null },
      { id: 'resistance_line', name: 'Resistance Line', hotkey: null },
      { id: 'support_line', name: 'Support Line', hotkey: null },
      { id: 'auto_channel', name: 'Auto Channel', hotkey: null }
    ]
  }
};

interface Drawing {
  id: string;
  toolId: string;
  symbol: string;
  timeframe: string;
  points: { x: number; y: number; timestamp: number; price: number }[];
  style: {
    color: string;
    lineWidth: number;
    lineStyle: 'solid' | 'dashed' | 'dotted';
    fillColor?: string;
    fillOpacity?: number;
  };
  locked: boolean;
  visible: boolean;
  extendLeft: boolean;
  extendRight: boolean;
  showLabels: boolean;
  createdAt: number;
  updatedAt: number;
}

interface DrawingTemplate {
  name: string;
  toolId: string;
  style: Drawing['style'];
  settings: Record<string, any>;
}

// In-memory storage (in production, use database)
const drawings: Map<string, Drawing[]> = new Map();
const templates: Map<string, DrawingTemplate> = new Map();

function getTotalToolCount(): number {
  return Object.values(DRAWING_CATEGORIES).reduce(
    (sum, cat) => sum + cat.tools.length, 0
  );
}

export const listDrawingToolsTool: Tool = {
  name: 'drawing_tools_list',
  description: 'List all 110+ available smart drawing tools by category',
  parameters: {
    type: 'object',
    properties: {
      category: { 
        type: 'string',
        enum: Object.keys(DRAWING_CATEGORIES),
        description: 'Filter by category' 
      }
    }
  },
  execute: async (params) => {
    if (params.category) {
      const cat = DRAWING_CATEGORIES[params.category as keyof typeof DRAWING_CATEGORIES];
      if (!cat) return { error: 'Invalid category' };
      return {
        category: cat.name,
        toolCount: cat.tools.length,
        tools: cat.tools
      };
    }
    
    return {
      totalTools: getTotalToolCount(),
      categories: Object.entries(DRAWING_CATEGORIES).map(([key, cat]) => ({
        id: key,
        name: cat.name,
        toolCount: cat.tools.length,
        tools: cat.tools.slice(0, 3).map(t => t.name) // Preview first 3
      }))
    };
  }
};

export const createDrawingTool: Tool = {
  name: 'drawing_create',
  description: 'Create a new drawing on a chart',
  parameters: {
    type: 'object',
    properties: {
      toolId: { type: 'string', description: 'Drawing tool ID (e.g., fib_retracement)' },
      symbol: { type: 'string', description: 'Chart symbol' },
      timeframe: { type: 'string', description: 'Chart timeframe' },
      points: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            timestamp: { type: 'number' },
            price: { type: 'number' }
          }
        },
        description: 'Anchor points for the drawing'
      },
      color: { type: 'string', description: 'Line color (hex)' },
      lineWidth: { type: 'number', description: 'Line width (1-5)' }
    },
    required: ['toolId', 'symbol', 'points']
  },
  execute: async (params) => {
    const drawing: Drawing = {
      id: `draw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      toolId: params.toolId,
      symbol: params.symbol,
      timeframe: params.timeframe || '1h',
      points: params.points.map((p: any, i: number) => ({
        x: i,
        y: p.price,
        timestamp: p.timestamp || Date.now() - (params.points.length - i) * 3600000,
        price: p.price
      })),
      style: {
        color: params.color || '#2196F3',
        lineWidth: params.lineWidth || 2,
        lineStyle: 'solid'
      },
      locked: false,
      visible: true,
      extendLeft: false,
      extendRight: params.toolId.includes('ray') || params.toolId.includes('extended'),
      showLabels: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const key = `${params.symbol}_${params.timeframe}`;
    const chartDrawings = drawings.get(key) || [];
    chartDrawings.push(drawing);
    drawings.set(key, chartDrawings);
    
    return {
      success: true,
      drawingId: drawing.id,
      tool: drawing.toolId,
      symbol: drawing.symbol,
      pointCount: drawing.points.length,
      message: `Drawing created: ${drawing.toolId} on ${drawing.symbol}`
    };
  }
};

export const getDrawingsTool: Tool = {
  name: 'drawing_get',
  description: 'Get all drawings for a chart',
  parameters: {
    type: 'object',
    properties: {
      symbol: { type: 'string', description: 'Chart symbol' },
      timeframe: { type: 'string', description: 'Chart timeframe' }
    },
    required: ['symbol']
  },
  execute: async (params) => {
    const key = `${params.symbol}_${params.timeframe || '1h'}`;
    const chartDrawings = drawings.get(key) || [];
    
    return {
      symbol: params.symbol,
      timeframe: params.timeframe || '1h',
      drawingCount: chartDrawings.length,
      drawings: chartDrawings.map(d => ({
        id: d.id,
        tool: d.toolId,
        points: d.points.length,
        visible: d.visible,
        locked: d.locked,
        createdAt: new Date(d.createdAt).toISOString()
      }))
    };
  }
};

export const skills = [listDrawingToolsTool, createDrawingTool, getDrawingsTool];
export default { listDrawingToolsTool, createDrawingTool, getDrawingsTool };
