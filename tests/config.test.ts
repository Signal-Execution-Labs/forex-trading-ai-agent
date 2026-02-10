import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, DEFAULT_CONFIG, KitConfig } from '../src/config';
import * as fs from 'fs';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

describe('Config', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_CONFIG', () => {
    it('should have required fields', () => {
      expect(DEFAULT_CONFIG.version).toBeDefined();
      expect(DEFAULT_CONFIG.agent).toBeDefined();
      expect(DEFAULT_CONFIG.gateway).toBeDefined();
      expect(DEFAULT_CONFIG.ai).toBeDefined();
    });

    it('should have valid agent config', () => {
      expect(DEFAULT_CONFIG.agent.id).toBe('main');
      expect(DEFAULT_CONFIG.agent.name).toBe('K.I.T.');
    });

    it('should have valid gateway config', () => {
      expect(DEFAULT_CONFIG.gateway.host).toBe('127.0.0.1');
      expect(DEFAULT_CONFIG.gateway.port).toBe(18799);
    });

    it('should have trading disabled by default', () => {
      expect(DEFAULT_CONFIG.trading.enabled).toBe(false);
      expect(DEFAULT_CONFIG.trading.autoTrade).toBe(false);
    });

    it('should have risk management settings', () => {
      expect(DEFAULT_CONFIG.trading.riskManagement).toBeDefined();
      expect(DEFAULT_CONFIG.trading.riskManagement.maxPositionSize).toBe(0.1);
      expect(DEFAULT_CONFIG.trading.riskManagement.maxDailyLoss).toBe(0.02);
      expect(DEFAULT_CONFIG.trading.riskManagement.stopLossPercent).toBe(0.02);
    });

    it('should have heartbeat enabled by default', () => {
      expect(DEFAULT_CONFIG.heartbeat.enabled).toBe(true);
      expect(DEFAULT_CONFIG.heartbeat.every).toBe('30m');
    });
  });

  describe('loadConfig', () => {
    it('should return config with defaults when no files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = loadConfig();
      
      expect(config.agent.name).toBe(DEFAULT_CONFIG.agent.name);
      expect(config.gateway.port).toBe(DEFAULT_CONFIG.gateway.port);
    });

    it('should return valid config structure', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = loadConfig();
      
      // Verify config has all required sections
      expect(config.agent).toBeDefined();
      expect(config.gateway).toBeDefined();
      expect(config.ai).toBeDefined();
      expect(config.trading).toBeDefined();
      expect(config.heartbeat).toBeDefined();
      expect(config.cron).toBeDefined();
      expect(config.memory).toBeDefined();
      expect(config.workspace).toBeDefined();
      expect(config.channels).toBeDefined();
      expect(config.logging).toBeDefined();
    });
  });

  describe('KitConfig type', () => {
    it('should be assignable from DEFAULT_CONFIG', () => {
      const config: KitConfig = { ...DEFAULT_CONFIG };
      expect(config).toBeDefined();
    });
  });
});
