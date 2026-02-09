/**
 * K.I.T. Dashboard WebSocket
 * Real-time updates for prices, positions, and trades
 */

import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { Logger } from '../utils/logger';

const logger = new Logger('DashboardWebSocket');

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

interface PriceUpdate {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume24h: number;
}

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

// Price simulation state
const priceState: Record<string, { price: number; basePrice: number }> = {
  'BTC/USDT': { price: 43280, basePrice: 43000 },
  'ETH/USDT': { price: 2345, basePrice: 2300 },
  'SOL/USDT': { price: 96.2, basePrice: 98 },
  'AVAX/USDT': { price: 35.8, basePrice: 35 },
  'DOT/USDT': { price: 7.25, basePrice: 7.2 },
};

export function setupWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    const clientIp = req.socket.remoteAddress;
    logger.info(`Client connected from ${clientIp}`);
    clients.add(ws);

    // Send initial data
    sendInitialData(ws);

    ws.on('message', (message: Buffer) => {
      try {
        const parsed = JSON.parse(message.toString());
        handleMessage(ws, parsed);
      } catch (error) {
        logger.error('Failed to parse message:', error);
        ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      logger.info(`Client disconnected from ${clientIp}`);
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      logger.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  // Start price update simulation
  startPriceSimulation();

  logger.info('WebSocket server initialized');
  return wss;
}

function sendInitialData(ws: WebSocket): void {
  // Send current prices
  const prices: PriceUpdate[] = Object.entries(priceState).map(([symbol, state]) => ({
    symbol,
    price: state.price,
    change: state.price - state.basePrice,
    changePercent: ((state.price - state.basePrice) / state.basePrice) * 100,
    volume24h: Math.random() * 1000000000,
  }));

  sendToClient(ws, 'prices', prices);
  sendToClient(ws, 'connected', { message: 'Connected to K.I.T. Dashboard' });
}

function handleMessage(ws: WebSocket, message: any): void {
  switch (message.type) {
    case 'subscribe':
      logger.debug(`Client subscribed to: ${message.channel}`);
      sendToClient(ws, 'subscribed', { channel: message.channel });
      break;

    case 'unsubscribe':
      logger.debug(`Client unsubscribed from: ${message.channel}`);
      sendToClient(ws, 'unsubscribed', { channel: message.channel });
      break;

    case 'ping':
      sendToClient(ws, 'pong', { timestamp: Date.now() });
      break;

    default:
      logger.warn(`Unknown message type: ${message.type}`);
  }
}

function sendToClient(ws: WebSocket, type: string, data: any): void {
  if (ws.readyState === WebSocket.OPEN) {
    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(message));
  }
}

export function broadcastUpdate(type: string, data: any): void {
  const message: WebSocketMessage = {
    type,
    data,
    timestamp: Date.now(),
  };
  const messageStr = JSON.stringify(message);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

function startPriceSimulation(): void {
  setInterval(() => {
    const updates: PriceUpdate[] = [];

    Object.entries(priceState).forEach(([symbol, state]) => {
      // Simulate price movement
      const volatility = state.price * 0.001; // 0.1% volatility per tick
      const change = (Math.random() - 0.5) * volatility * 2;
      state.price = Math.max(state.price + change, state.price * 0.9);

      updates.push({
        symbol,
        price: state.price,
        change: state.price - state.basePrice,
        changePercent: ((state.price - state.basePrice) / state.basePrice) * 100,
        volume24h: Math.random() * 1000000000,
      });
    });

    broadcastUpdate('priceUpdate', updates);
  }, 2000); // Update every 2 seconds

  // Simulate occasional trade updates
  setInterval(() => {
    if (Math.random() > 0.7) {
      const symbols = Object.keys(priceState);
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const state = priceState[symbol];

      broadcastUpdate('tradeExecuted', {
        id: `trade-${Date.now()}`,
        symbol,
        side: Math.random() > 0.5 ? 'buy' : 'sell',
        size: Math.random() * 2,
        price: state.price,
        strategy: ['TrendFollower', 'Momentum', 'MeanReversion'][Math.floor(Math.random() * 3)],
        timestamp: Date.now(),
      });
    }
  }, 5000);

  // Simulate position updates
  setInterval(() => {
    broadcastUpdate('positionUpdate', {
      timestamp: Date.now(),
      message: 'Positions recalculated',
    });
  }, 10000);

  logger.info('Price simulation started');
}

export function getConnectedClients(): number {
  return clients.size;
}

export function closeAllConnections(): void {
  clients.forEach((client) => {
    client.close();
  });
  clients.clear();

  if (wss) {
    wss.close();
    wss = null;
  }
}
