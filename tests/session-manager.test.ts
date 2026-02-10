import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager, createSessionManager, Session, Message } from '../src/gateway/session-manager';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockRejectedValue(new Error('File not found')),
  mkdir: vi.fn().mockResolvedValue(undefined),
}));

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    manager = new SessionManager({
      transcriptsDir: '.kit/test-transcripts',
      maxMessages: 10,
      autoSave: false, // Disable auto-save for tests
    });
  });

  describe('getOrCreate', () => {
    it('should create a new session when none exists', async () => {
      const session = await manager.getOrCreate('test-session');
      
      expect(session).toBeDefined();
      expect(session.key).toBe('test-session');
      expect(session.messages).toEqual([]);
    });

    it('should return existing session on subsequent calls', async () => {
      const session1 = await manager.getOrCreate('test-session');
      const session2 = await manager.getOrCreate('test-session');
      
      expect(session1).toBe(session2);
    });

    it('should apply options to new session', async () => {
      const session = await manager.getOrCreate('test-session', {
        displayName: 'Test Display',
        channel: 'telegram',
        metadata: { custom: 'data' },
      });
      
      expect(session.displayName).toBe('Test Display');
      expect(session.channel).toBe('telegram');
      expect(session.metadata).toEqual({ custom: 'data' });
    });
  });

  describe('addMessage', () => {
    it('should add a message to a session', async () => {
      const message = await manager.addMessage('test-session', 'user', 'Hello!');
      
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello!');
      expect(message.timestamp).toBeDefined();
    });

    it('should include metadata in message', async () => {
      const message = await manager.addMessage('test-session', 'assistant', 'Hi!', { model: 'gpt-4' });
      
      expect(message.metadata).toEqual({ model: 'gpt-4' });
    });

    it('should trim messages when exceeding maxMessages', async () => {
      // Add more than maxMessages
      for (let i = 0; i < 15; i++) {
        await manager.addMessage('test-session', 'user', `Message ${i}`);
      }
      
      const session = manager.get('test-session');
      expect(session?.messages.length).toBe(10); // maxMessages = 10
    });
  });

  describe('getHistory', () => {
    it('should return all messages', async () => {
      await manager.addMessage('test-session', 'user', 'Hello');
      await manager.addMessage('test-session', 'assistant', 'Hi there!');
      
      const history = await manager.getHistory('test-session');
      
      expect(history.length).toBe(2);
    });

    it('should limit messages when limit is provided', async () => {
      for (let i = 0; i < 5; i++) {
        await manager.addMessage('test-session', 'user', `Message ${i}`);
      }
      
      const history = await manager.getHistory('test-session', 3);
      
      expect(history.length).toBe(3);
    });
  });

  describe('clearSession', () => {
    it('should clear all messages from session', async () => {
      await manager.addMessage('test-session', 'user', 'Hello');
      await manager.clearSession('test-session');
      
      const session = manager.get('test-session');
      expect(session?.messages).toEqual([]);
    });
  });

  describe('list', () => {
    it('should list all sessions', async () => {
      await manager.getOrCreate('session-1');
      await manager.getOrCreate('session-2');
      
      const sessions = manager.list();
      
      expect(sessions.length).toBe(2);
    });

    it('should filter by channel', async () => {
      await manager.getOrCreate('session-1', { channel: 'telegram' });
      await manager.getOrCreate('session-2', { channel: 'discord' });
      
      const sessions = manager.list({ channel: 'telegram' });
      
      expect(sessions.length).toBe(1);
      expect(sessions[0].channel).toBe('telegram');
    });

    it('should limit results', async () => {
      await manager.getOrCreate('session-1');
      await manager.getOrCreate('session-2');
      await manager.getOrCreate('session-3');
      
      const sessions = manager.list({ limit: 2 });
      
      expect(sessions.length).toBe(2);
    });
  });

  describe('createSessionManager factory', () => {
    it('should create manager with agentId', () => {
      const manager = createSessionManager('test-agent');
      expect(manager).toBeInstanceOf(SessionManager);
    });

    it('should create manager with config', () => {
      const manager = createSessionManager('test-agent', { maxMessages: 50 });
      expect(manager).toBeInstanceOf(SessionManager);
    });
  });
});
