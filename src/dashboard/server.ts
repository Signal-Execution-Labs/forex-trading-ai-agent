/**
 * K.I.T. Dashboard Server
 * Express Server with WebSocket support for real-time updates
 */

import express, { Express, Request, Response } from 'express';
import { createServer, Server as HttpServer } from 'http';
import path from 'path';
import cors from 'cors';
import { setupApiRoutes } from './api';
import { setupWebSocket, broadcastUpdate } from './websocket';
import { Logger } from '../utils/logger';

const logger = new Logger('DashboardServer');

export interface DashboardConfig {
  port: number;
  host: string;
  enableCors: boolean;
}

export class DashboardServer {
  private app: Express;
  private server: HttpServer;
  private config: DashboardConfig;
  private isRunning: boolean = false;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      port: config.port || parseInt(process.env.DASHBOARD_PORT || '3000'),
      host: config.host || process.env.DASHBOARD_HOST || 'localhost',
      enableCors: config.enableCors ?? true,
    };

    this.app = express();
    this.server = createServer(this.app);
    this.setupMiddleware();
    this.setupRoutes();
    setupWebSocket(this.server);
  }

  private setupMiddleware(): void {
    // CORS
    if (this.config.enableCors) {
      this.app.use(cors());
    }

    // JSON parsing
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, _res: Response, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });

    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));
  }

  private setupRoutes(): void {
    // API routes
    setupApiRoutes(this.app);

    // Serve dashboard for all other routes (SPA fallback)
    this.app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: any) => {
      logger.error('Server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server.listen(this.config.port, this.config.host, () => {
          this.isRunning = true;
          logger.info(`🖥️  Dashboard running at http://${this.config.host}:${this.config.port}`);
          resolve();
        });

        this.server.on('error', (error: Error) => {
          logger.error('Server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.isRunning) {
        resolve();
        return;
      }

      this.server.close(() => {
        this.isRunning = false;
        logger.info('Dashboard server stopped');
        resolve();
      });
    });
  }

  getApp(): Express {
    return this.app;
  }

  getServer(): HttpServer {
    return this.server;
  }

  broadcast(event: string, data: any): void {
    broadcastUpdate(event, data);
  }
}

// Export singleton instance factory
let dashboardInstance: DashboardServer | null = null;

export function getDashboard(config?: Partial<DashboardConfig>): DashboardServer {
  if (!dashboardInstance) {
    dashboardInstance = new DashboardServer(config);
  }
  return dashboardInstance;
}

// Start if run directly
if (require.main === module) {
  const dashboard = getDashboard();
  dashboard.start().catch((error) => {
    logger.error('Failed to start dashboard:', error);
    process.exit(1);
  });
}
