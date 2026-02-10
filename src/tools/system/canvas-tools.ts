/**
 * K.I.T. Canvas Tools
 * 
 * Tools for presenting visual content to users:
 * - canvas_present: Display HTML, charts, portfolio views
 * - canvas_snapshot: Capture current canvas state
 * - canvas_hide: Hide the canvas
 * - canvas_chart: Show a TradingView chart
 * - canvas_portfolio: Show portfolio visualization
 * - canvas_signals: Show trading signals
 */

import { ToolDefinition, ToolHandler, ToolContext } from './tool-registry';
import { getCanvasManager, ChartConfig, PortfolioViewConfig } from '../../core/canvas-manager';

// ============================================================================
// canvas_present - Show HTML content to user
// ============================================================================

export const canvasPresentToolDefinition: ToolDefinition = {
  name: 'canvas_present',
  description: 'Present HTML content on the canvas for the user to see. Use for dashboards, reports, tables, or custom visualizations.',
  parameters: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'The HTML content to display. Can include CSS and JavaScript.',
      },
      title: {
        type: 'string',
        description: 'Title for the canvas window.',
      },
      width: {
        type: 'number',
        description: 'Width of the canvas in pixels (default: 800).',
      },
      height: {
        type: 'number',
        description: 'Height of the canvas in pixels (default: 600).',
      },
    },
    required: ['html'],
  },
};

export const canvasPresentToolHandler: ToolHandler = async (args, _context) => {
  const { html, title, width, height } = args as {
    html: string;
    title?: string;
    width?: number;
    height?: number;
  };

  const canvasManager = getCanvasManager();
  const content = canvasManager.presentHtml(html, { title, width, height });

  return {
    success: true,
    message: `Canvas presented: ${content.title}`,
    contentId: content.id,
    visible: true,
  };
};

// ============================================================================
// canvas_chart - Show TradingView chart
// ============================================================================

export const canvasChartToolDefinition: ToolDefinition = {
  name: 'canvas_chart',
  description: 'Display a TradingView chart for a trading symbol. Supports stocks, crypto, forex, and indices.',
  parameters: {
    type: 'object',
    properties: {
      symbol: {
        type: 'string',
        description: 'Trading symbol (e.g., "BTCUSD", "AAPL", "EURUSD", "BINANCE:BTCUSDT").',
      },
      interval: {
        type: 'string',
        description: 'Chart interval: "1m", "5m", "15m", "1h", "4h", "1D", "1W", "1M" (default: "1D").',
        enum: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'],
      },
      theme: {
        type: 'string',
        description: 'Chart theme (default: "dark").',
        enum: ['light', 'dark'],
      },
      style: {
        type: 'string',
        description: 'Chart style (default: "candles").',
        enum: ['candles', 'line', 'area', 'bars'],
      },
      studies: {
        type: 'string',
        items: { type: 'string' },
        description: 'Technical indicators to add (e.g., ["RSI", "MACD", "BB"]).',
      },
    },
    required: ['symbol'],
  },
};

export const canvasChartToolHandler: ToolHandler = async (args, _context) => {
  const { symbol, interval, theme, style, studies } = args as {
    symbol: string;
    interval?: string;
    theme?: 'light' | 'dark';
    style?: 'candles' | 'line' | 'area' | 'bars';
    studies?: string[];
  };

  const canvasManager = getCanvasManager();
  
  const config: ChartConfig = {
    symbol,
    interval: interval || 'D',
    theme: theme || 'dark',
    style: style || 'candles',
    studies: studies || [],
  };

  const content = canvasManager.presentChart(config);

  return {
    success: true,
    message: `Chart displayed: ${symbol}`,
    contentId: content.id,
    config,
  };
};

// ============================================================================
// canvas_portfolio - Show portfolio visualization
// ============================================================================

export const canvasPortfolioToolDefinition: ToolDefinition = {
  name: 'canvas_portfolio',
  description: 'Display a visual portfolio overview with holdings, P&L, and allocation.',
  parameters: {
    type: 'object',
    properties: {
      totalValue: {
        type: 'number',
        description: 'Total portfolio value in USD.',
      },
      holdings: {
        type: 'string',
        description: 'JSON array of holdings: [{symbol, amount, value, pnl, pnlPercent, allocation}]',
      },
      performance: {
        type: 'string',
        description: 'JSON object with performance: {day, week, month, total} (percentages)',
      },
    },
    required: ['totalValue', 'holdings'],
  },
};

export const canvasPortfolioToolHandler: ToolHandler = async (args, _context) => {
  const { totalValue, holdings: holdingsJson, performance: perfJson } = args as {
    totalValue: number;
    holdings: string;
    performance?: string;
  };

  let holdings;
  let performance;

  try {
    holdings = typeof holdingsJson === 'string' ? JSON.parse(holdingsJson) : holdingsJson;
    performance = perfJson ? (typeof perfJson === 'string' ? JSON.parse(perfJson) : perfJson) : undefined;
  } catch (error) {
    return {
      success: false,
      error: 'Invalid JSON in holdings or performance parameter',
    };
  }

  const canvasManager = getCanvasManager();
  const content = canvasManager.presentPortfolio({ totalValue, holdings, performance });

  return {
    success: true,
    message: `Portfolio displayed: $${totalValue.toLocaleString()} with ${holdings.length} holdings`,
    contentId: content.id,
  };
};

// ============================================================================
// canvas_signals - Show trading signals
// ============================================================================

export const canvasSignalsToolDefinition: ToolDefinition = {
  name: 'canvas_signals',
  description: 'Display trading signals with buy/sell recommendations.',
  parameters: {
    type: 'object',
    properties: {
      signals: {
        type: 'string',
        description: 'JSON array of signals: [{symbol, type: "buy"|"sell"|"hold", strength, price, target?, stopLoss?, reason}]',
      },
    },
    required: ['signals'],
  },
};

export const canvasSignalsToolHandler: ToolHandler = async (args, _context) => {
  const { signals: signalsJson } = args as { signals: string };

  let signals;
  try {
    signals = typeof signalsJson === 'string' ? JSON.parse(signalsJson) : signalsJson;
  } catch (error) {
    return {
      success: false,
      error: 'Invalid JSON in signals parameter',
    };
  }

  const canvasManager = getCanvasManager();
  const html = canvasManager.generateSignalHtml(signals);
  const content = canvasManager.presentHtml(html, { title: 'Trading Signals', width: 600, height: 500 });

  return {
    success: true,
    message: `Displayed ${signals.length} trading signals`,
    contentId: content.id,
  };
};

// ============================================================================
// canvas_table - Show data table
// ============================================================================

export const canvasTableToolDefinition: ToolDefinition = {
  name: 'canvas_table',
  description: 'Display a data table with headers and rows.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'Title of the table.',
      },
      headers: {
        type: 'string',
        description: 'JSON array of column headers: ["Column1", "Column2", ...]',
      },
      rows: {
        type: 'string',
        description: 'JSON array of row arrays: [["val1", "val2"], ["val3", "val4"], ...]',
      },
      theme: {
        type: 'string',
        description: 'Table theme (default: "dark").',
        enum: ['light', 'dark'],
      },
    },
    required: ['title', 'headers', 'rows'],
  },
};

export const canvasTableToolHandler: ToolHandler = async (args, _context) => {
  const { title, headers: headersJson, rows: rowsJson, theme } = args as {
    title: string;
    headers: string;
    rows: string;
    theme?: 'light' | 'dark';
  };

  let headers;
  let rows;

  try {
    headers = typeof headersJson === 'string' ? JSON.parse(headersJson) : headersJson;
    rows = typeof rowsJson === 'string' ? JSON.parse(rowsJson) : rowsJson;
  } catch (error) {
    return {
      success: false,
      error: 'Invalid JSON in headers or rows parameter',
    };
  }

  const canvasManager = getCanvasManager();
  const html = canvasManager.generateTableHtml(title, headers, rows, { theme: theme || 'dark' });
  const content = canvasManager.presentHtml(html, { title, width: 700, height: 500 });

  return {
    success: true,
    message: `Table displayed: ${title} (${rows.length} rows)`,
    contentId: content.id,
  };
};

// ============================================================================
// canvas_snapshot - Capture canvas state
// ============================================================================

export const canvasSnapshotToolDefinition: ToolDefinition = {
  name: 'canvas_snapshot',
  description: 'Get information about the current canvas state.',
  parameters: {
    type: 'object',
    properties: {
      includeHistory: {
        type: 'boolean',
        description: 'Include canvas history in the response (default: false).',
      },
    },
    required: [],
  },
};

export const canvasSnapshotToolHandler: ToolHandler = async (args, _context) => {
  const { includeHistory } = args as { includeHistory?: boolean };

  const canvasManager = getCanvasManager();
  const state = canvasManager.getState();

  const result: Record<string, unknown> = {
    visible: state.visible,
    content: state.content ? {
      id: state.content.id,
      type: state.content.type,
      title: state.content.title,
      width: state.content.width,
      height: state.content.height,
      createdAt: state.content.createdAt,
      updatedAt: state.content.updatedAt,
    } : null,
  };

  if (includeHistory) {
    result.history = state.history.map(h => ({
      id: h.id,
      type: h.type,
      title: h.title,
      createdAt: h.createdAt,
    }));
  }

  return result;
};

// ============================================================================
// canvas_hide - Hide the canvas
// ============================================================================

export const canvasHideToolDefinition: ToolDefinition = {
  name: 'canvas_hide',
  description: 'Hide the canvas from view.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const canvasHideToolHandler: ToolHandler = async (_args, _context) => {
  const canvasManager = getCanvasManager();
  const wasVisible = canvasManager.hide();

  return {
    success: true,
    message: wasVisible ? 'Canvas hidden' : 'Canvas was already hidden',
    visible: false,
  };
};

// ============================================================================
// canvas_back - Go back to previous canvas content
// ============================================================================

export const canvasBackToolDefinition: ToolDefinition = {
  name: 'canvas_back',
  description: 'Navigate back to the previous canvas content.',
  parameters: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export const canvasBackToolHandler: ToolHandler = async (_args, _context) => {
  const canvasManager = getCanvasManager();
  const content = canvasManager.goBack();

  if (content) {
    return {
      success: true,
      message: `Navigated back to: ${content.title}`,
      contentId: content.id,
    };
  }

  return {
    success: false,
    message: 'No previous content in history',
  };
};

// ============================================================================
// Export all definitions and handlers
// ============================================================================

export const CANVAS_TOOLS = [
  canvasPresentToolDefinition,
  canvasChartToolDefinition,
  canvasPortfolioToolDefinition,
  canvasSignalsToolDefinition,
  canvasTableToolDefinition,
  canvasSnapshotToolDefinition,
  canvasHideToolDefinition,
  canvasBackToolDefinition,
];

export const CANVAS_HANDLERS: Record<string, ToolHandler> = {
  canvas_present: canvasPresentToolHandler,
  canvas_chart: canvasChartToolHandler,
  canvas_portfolio: canvasPortfolioToolHandler,
  canvas_signals: canvasSignalsToolHandler,
  canvas_table: canvasTableToolHandler,
  canvas_snapshot: canvasSnapshotToolHandler,
  canvas_hide: canvasHideToolHandler,
  canvas_back: canvasBackToolHandler,
};
