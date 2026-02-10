import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    });

    it('should have valid agent config', () => {
      expect(DEFAULT_CONFIG.agent?.id).toBe('main');
      expect(DEFAULT_CONFIG.agent?.name).toBe('K.I.T.');
    });

    it('should have valid gateway config', () => {
      expect(DEFAULT_CONFIG.gateway?.host).toBe('127.0.0.1');
      expect(DEFAULT_CONFIG.gateway?.port).toBe(18799);
    });

    it('should have heartbeat enabled by default', () => {
      expect(DEFAULT_CONFIG.heartbeat?.enabled).toBe(true);
      expect(DEFAULT_CONFIG.heartbeat?.every).toBe('30m');
    });

    it('should have cron enabled by default', () => {
      expect(DEFAULT_CONFIG.cron?.enabled).toBe(true);
    });

    it('should have onboarded set to false', () => {
      expect(DEFAULT_CONFIG.onboarded).toBe(false);
    });
  });

  describe('loadConfig', () => {
    it('should return empty config when no files exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = loadConfig();
      
      // loadConfig returns empty object when no file exists
      expect(config).toEqual({});
    });

    it('should parse config file when it exists', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify({
        version: '2.0.0',
        agent: { name: 'Test K.I.T.' },
      }));
      
      const config = loadConfig();
      
      expect(config.version).toBe('2.0.0');
      expect(config.agent?.name).toBe('Test K.I.T.');
    });

    it('should return empty object on parse error', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      
      const config = loadConfig();
      
      expect(config).toEqual({});
    });
  });

  describe('KitConfig type', () => {
    it('should be assignable from DEFAULT_CONFIG', () => {
      const config: KitConfig = { ...DEFAULT_CONFIG };
      expect(config).toBeDefined();
    });

    it('should allow partial config', () => {
      const partialConfig: KitConfig = {
        version: '2.0.0',
        onboarded: true,
      };
      expect(partialConfig.version).toBe('2.0.0');
    });
  });
});
