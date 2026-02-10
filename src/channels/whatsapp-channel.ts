/**
 * K.I.T. WhatsApp Channel
 * Bidirectional WhatsApp messaging using Baileys (WhatsApp Web protocol)
 * No API keys needed - just scan QR code like WhatsApp Web!
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import makeWASocket, { 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket,
  proto,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');
const WHATSAPP_AUTH_DIR = path.join(KIT_HOME, 'credentials', 'whatsapp');

export interface WhatsAppMessage {
  messageId: string;
  chatId: string;  // JID
  senderId: string;
  senderName?: string;
  senderPhone?: string;
  text: string;
  timestamp: Date;
  isGroup: boolean;
  quotedMessage?: {
    text: string;
    senderId: string;
  };
}

export interface WhatsAppChannelConfig {
  allowedNumbers?: string[];  // E.164 format: +1234567890
  selfChatMode?: boolean;     // If running on personal number
}

export class WhatsAppChannel extends EventEmitter {
  private config: WhatsAppChannelConfig;
  private socket: WASocket | null = null;
  private messageHandler: ((msg: WhatsAppMessage) => Promise<string>) | null = null;
  private isConnected: boolean = false;
  private qrCallback: ((qr: string) => void) | null = null;

  constructor(config: WhatsAppChannelConfig = {}) {
    super();
    this.config = config;
  }

  /**
   * Start WhatsApp connection
   */
  async start(handler: (msg: WhatsAppMessage) => Promise<string>): Promise<void> {
    this.messageHandler = handler;

    // Ensure auth directory exists
    if (!fs.existsSync(WHATSAPP_AUTH_DIR)) {
      fs.mkdirSync(WHATSAPP_AUTH_DIR, { recursive: true });
    }

    // Load auth state
    const { state, saveCreds } = await useMultiFileAuthState(WHATSAPP_AUTH_DIR);

    // Simple logger for Baileys
    const logger = {
      level: 'silent' as const,
      trace: () => {},
      debug: () => {},
      info: () => {},
      warn: console.warn,
      error: console.error,
      fatal: console.error,
      child: () => logger,
    };

    // Create socket
    this.socket = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger as any),
      },
      printQRInTerminal: true,
      browser: ['K.I.T.', 'Chrome', '120.0.0'],
      logger: logger as any,
    });

    // Handle connection events
    this.socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n📱 Scan this QR code with WhatsApp:');
        // QR is printed by Baileys with printQRInTerminal: true
        this.emit('qr', qr);
        if (this.qrCallback) {
          this.qrCallback(qr);
        }
      }

      if (connection === 'close') {
        const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
        const shouldReconnect = reason !== DisconnectReason.loggedOut;
        
        console.log(`[WhatsApp] Connection closed: ${reason}`);
        this.isConnected = false;
        this.emit('disconnected', reason);

        if (shouldReconnect) {
          console.log('[WhatsApp] Reconnecting...');
          setTimeout(() => this.start(handler), 3000);
        } else {
          console.log('[WhatsApp] Logged out - delete auth and rescan QR');
        }
      }

      if (connection === 'open') {
        console.log('✅ WhatsApp connected!');
        this.isConnected = true;
        this.emit('connected');
        
        // Save config
        this.saveConfig();
      }
    });

    // Save credentials when updated
    this.socket.ev.on('creds.update', saveCreds);

    // Handle incoming messages
    this.socket.ev.on('messages.upsert', async (m) => {
      for (const msg of m.messages) {
        // Skip status broadcasts and own messages
        if (msg.key.remoteJid === 'status@broadcast') continue;
        if (msg.key.fromMe) continue;
        if (!msg.message) continue;

        // Extract text
        const text = msg.message.conversation || 
                    msg.message.extendedTextMessage?.text ||
                    msg.message.imageMessage?.caption ||
                    msg.message.videoMessage?.caption ||
                    '';

        if (!text.trim()) continue;

        // Parse sender info
        const chatId = msg.key.remoteJid!;
        const isGroup = chatId.endsWith('@g.us');
        const senderId = isGroup 
          ? msg.key.participant || '' 
          : chatId;
        
        // Extract phone number
        const senderPhone = senderId.split('@')[0];
        
        // Check allowlist
        if (this.config.allowedNumbers && this.config.allowedNumbers.length > 0) {
          const normalizedPhone = '+' + senderPhone.replace(/\D/g, '');
          if (!this.config.allowedNumbers.includes(normalizedPhone) && 
              !this.config.allowedNumbers.includes(senderPhone)) {
            console.log(`[WhatsApp] Ignoring message from non-allowed number: ${senderPhone}`);
            continue;
          }
        }

        // Build message object
        const whatsappMsg: WhatsAppMessage = {
          messageId: msg.key.id!,
          chatId,
          senderId,
          senderPhone,
          text,
          timestamp: new Date((msg.messageTimestamp as number) * 1000),
          isGroup,
        };

        // Handle quoted messages
        const quoted = msg.message.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quoted) {
          whatsappMsg.quotedMessage = {
            text: quoted.conversation || quoted.extendedTextMessage?.text || '',
            senderId: msg.message.extendedTextMessage?.contextInfo?.participant || '',
          };
        }

        // Emit and process
        this.emit('message', whatsappMsg);

        if (this.messageHandler) {
          try {
            console.log(`[WhatsApp] Message from ${senderPhone}: ${text}`);
            
            // Send typing indicator
            await this.socket?.sendPresenceUpdate('composing', chatId);
            
            const response = await this.messageHandler(whatsappMsg);
            
            if (response && response.trim()) {
              await this.sendMessage(chatId, response);
            }
            
            // Clear typing
            await this.socket?.sendPresenceUpdate('paused', chatId);
          } catch (error) {
            console.error('[WhatsApp] Handler error:', error);
            await this.sendMessage(chatId, '❌ Sorry, I encountered an error.');
          }
        }
      }
    });
  }

  /**
   * Stop WhatsApp connection
   */
  stop(): void {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
    }
    this.isConnected = false;
    console.log('[WhatsApp] Stopped');
  }

  /**
   * Send a message
   */
  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      console.error('[WhatsApp] Not connected');
      return false;
    }

    try {
      // Split long messages (WhatsApp limit ~65536 but practical limit is lower)
      const chunks = this.chunkText(text, 4000);
      
      for (const chunk of chunks) {
        await this.socket.sendMessage(chatId, { text: chunk });
      }
      
      return true;
    } catch (error) {
      console.error('[WhatsApp] Send error:', error);
      return false;
    }
  }

  /**
   * Send a message with media
   */
  async sendMedia(chatId: string, mediaPath: string, caption?: string): Promise<boolean> {
    if (!this.socket || !this.isConnected) {
      return false;
    }

    try {
      const buffer = fs.readFileSync(mediaPath);
      const ext = path.extname(mediaPath).toLowerCase();
      
      let messageContent: any;
      
      if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        messageContent = { image: buffer, caption };
      } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
        messageContent = { video: buffer, caption };
      } else if (['.mp3', '.ogg', '.wav', '.m4a'].includes(ext)) {
        messageContent = { audio: buffer, ptt: true }; // PTT = voice note
      } else {
        messageContent = { 
          document: buffer, 
          fileName: path.basename(mediaPath),
          caption 
        };
      }

      await this.socket.sendMessage(chatId, messageContent);
      return true;
    } catch (error) {
      console.error('[WhatsApp] Media send error:', error);
      return false;
    }
  }

  /**
   * Set QR code callback
   */
  onQR(callback: (qr: string) => void): void {
    this.qrCallback = callback;
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }

  /**
   * Chunk text for WhatsApp limits
   */
  private chunkText(text: string, maxLength: number): string[] {
    if (text.length <= maxLength) return [text];
    
    const chunks: string[] = [];
    let remaining = text;
    
    while (remaining.length > 0) {
      if (remaining.length <= maxLength) {
        chunks.push(remaining);
        break;
      }
      
      // Find a good break point
      let breakPoint = remaining.lastIndexOf('\n', maxLength);
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = remaining.lastIndexOf(' ', maxLength);
      }
      if (breakPoint === -1 || breakPoint < maxLength / 2) {
        breakPoint = maxLength;
      }
      
      chunks.push(remaining.slice(0, breakPoint));
      remaining = remaining.slice(breakPoint).trim();
    }
    
    return chunks;
  }

  /**
   * Save WhatsApp config
   */
  private saveConfig(): void {
    let config: any = {};
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }

    if (!config.channels) config.channels = {};
    config.channels.whatsapp = {
      ...config.channels.whatsapp,
      enabled: true,
      connectedAt: new Date().toISOString(),
      allowedNumbers: this.config.allowedNumbers,
    };

    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  }

  /**
   * Logout and delete credentials
   */
  async logout(): Promise<void> {
    this.stop();
    
    if (fs.existsSync(WHATSAPP_AUTH_DIR)) {
      fs.rmSync(WHATSAPP_AUTH_DIR, { recursive: true });
    }
    
    console.log('[WhatsApp] Logged out and credentials deleted');
  }
}

/**
 * Create WhatsApp channel from config
 */
export function createWhatsAppChannel(): WhatsAppChannel | null {
  let config: any = {};
  if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  }

  const whatsapp = config.channels?.whatsapp;
  
  return new WhatsAppChannel({
    allowedNumbers: whatsapp?.allowedNumbers,
    selfChatMode: whatsapp?.selfChatMode,
  });
}

/**
 * Check if WhatsApp credentials exist
 */
export function hasWhatsAppCredentials(): boolean {
  const credsPath = path.join(WHATSAPP_AUTH_DIR, 'creds.json');
  return fs.existsSync(credsPath);
}
