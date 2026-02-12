/**
 * K.I.T. Channels CLI Command
 * 
 * Manage communication channel connections.
 * 
 * @see OpenClaw docs/channels/*.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export interface ChannelStatus {
  name: string;
  enabled: boolean;
  configured: boolean;
  connected?: boolean;
  lastMessage?: string;
}

export function registerChannelsCommand(program: Command): void {
  const channels = program
    .command('channels')
    .description('Manage communication channels (Telegram, WhatsApp, Discord, Slack)');

  // List channels
  channels
    .command('list')
    .alias('ls')
    .description('List all channels and their status')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = loadConfig();
      const statuses = getChannelStatuses(config);
      
      if (options.json) {
        console.log(JSON.stringify(statuses, null, 2));
        return;
      }
      
      console.log('📡 K.I.T. Channels\n');
      
      for (const status of statuses) {
        const emoji = getChannelEmoji(status.name);
        const configStatus = status.configured ? '✅ Configured' : '❌ Not configured';
        const enabledStatus = status.enabled ? '🟢 Enabled' : '🔴 Disabled';
        
        console.log(`${emoji} ${status.name}`);
        console.log(`   ${configStatus}`);
        console.log(`   ${enabledStatus}`);
        console.log('');
      }
      
      console.log('💡 Configure a channel: kit channels setup <channel>');
    });

  // Setup channel
  channels
    .command('setup <channel>')
    .description('Interactive setup for a channel')
    .action(async (channel) => {
      const normalizedChannel = channel.toLowerCase();
      
      switch (normalizedChannel) {
        case 'telegram':
          await setupTelegram();
          break;
        case 'whatsapp':
          await setupWhatsApp();
          break;
        case 'discord':
          await setupDiscord();
          break;
        case 'slack':
          await setupSlack();
          break;
        default:
          console.error(`Unknown channel: ${channel}`);
          console.log('Available: telegram, whatsapp, discord, slack');
          process.exit(1);
      }
    });

  // Enable channel
  channels
    .command('enable <channel>')
    .description('Enable a channel')
    .action((channel) => {
      const config = loadConfig();
      const normalizedChannel = channel.toLowerCase();
      
      if (!config.channels) config.channels = {};
      if (!config.channels[normalizedChannel]) {
        config.channels[normalizedChannel] = {};
      }
      config.channels[normalizedChannel].enabled = true;
      
      saveConfig(config);
      console.log(`✅ Enabled ${channel} channel`);
      console.log('💡 Restart K.I.T. to apply: kit start');
    });

  // Disable channel
  channels
    .command('disable <channel>')
    .description('Disable a channel')
    .action((channel) => {
      const config = loadConfig();
      const normalizedChannel = channel.toLowerCase();
      
      if (!config.channels) config.channels = {};
      if (!config.channels[normalizedChannel]) {
        config.channels[normalizedChannel] = {};
      }
      config.channels[normalizedChannel].enabled = false;
      
      saveConfig(config);
      console.log(`❌ Disabled ${channel} channel`);
    });

  // Show channel info
  channels
    .command('info <channel>')
    .description('Show detailed channel information')
    .action((channel) => {
      const config = loadConfig();
      const normalizedChannel = channel.toLowerCase();
      const channelConfig = config.channels?.[normalizedChannel] || config[normalizedChannel];
      
      if (!channelConfig) {
        console.log(`${channel} is not configured.`);
        console.log(`\n💡 Setup: kit channels setup ${channel}`);
        return;
      }
      
      const emoji = getChannelEmoji(normalizedChannel);
      console.log(`${emoji} ${channel} Channel\n`);
      
      // Show config (mask secrets)
      for (const [key, value] of Object.entries(channelConfig)) {
        const display = typeof value === 'string' && isSecret(key) 
          ? maskValue(value) 
          : String(value);
        console.log(`  ${key}: ${display}`);
      }
    });

  // Test channel
  channels
    .command('test <channel>')
    .description('Test channel connection')
    .option('--message <msg>', 'Test message to send', 'Hello from K.I.T.! 🚗')
    .action(async (channel, options) => {
      console.log(`🧪 Testing ${channel} channel...`);
      
      // TODO: Implement actual channel testing
      console.log(`💡 Channel testing requires the gateway to be running.`);
      console.log(`   Start K.I.T. and check logs: kit start && kit logs tail`);
    });

  // Telegram-specific commands
  const telegram = channels
    .command('telegram')
    .description('Telegram-specific commands');
    
  telegram
    .command('token <token>')
    .description('Set Telegram bot token')
    .action((token) => {
      const config = loadConfig();
      if (!config.telegram) config.telegram = {};
      config.telegram.token = token;
      saveConfig(config);
      console.log('✅ Telegram token saved');
    });
    
  telegram
    .command('chat <chatId>')
    .description('Set allowed chat ID')
    .action((chatId) => {
      const config = loadConfig();
      if (!config.telegram) config.telegram = {};
      config.telegram.chatId = chatId;
      saveConfig(config);
      console.log(`✅ Telegram chat ID set: ${chatId}`);
    });

  // WhatsApp-specific commands
  const whatsapp = channels
    .command('whatsapp')
    .description('WhatsApp-specific commands');
    
  whatsapp
    .command('login')
    .description('Connect WhatsApp via QR code')
    .action(async () => {
      console.log('📱 Starting WhatsApp connection...');
      console.log('💡 This will open a QR code to scan with your phone.');
      console.log('\nRun: kit start');
      console.log('The QR code will appear in the console.');
      console.log('\nThen scan with your phone:');
      console.log('1. Open WhatsApp');
      console.log('2. Go to Settings > Linked Devices');
      console.log('3. Tap "Link a Device"');
      console.log('4. Scan the QR code');
    });

  whatsapp
    .command('logout')
    .description('Disconnect WhatsApp')
    .action(async () => {
      const sessionDir = path.join(KIT_HOME, 'whatsapp-session');
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true });
        console.log('✅ WhatsApp logged out');
      } else {
        console.log('WhatsApp was not logged in.');
      }
    });
}

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config: any): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function getChannelStatuses(config: any): ChannelStatus[] {
  const channels = ['telegram', 'whatsapp', 'discord', 'slack'];
  
  return channels.map(name => ({
    name,
    enabled: config.channels?.[name]?.enabled !== false,
    configured: isChannelConfigured(config, name),
  }));
}

function isChannelConfigured(config: any, channel: string): boolean {
  const channelConfig = config.channels?.[channel] || config[channel];
  if (!channelConfig) return false;
  
  switch (channel) {
    case 'telegram':
      return !!(channelConfig.token || channelConfig.botToken);
    case 'whatsapp':
      // WhatsApp uses session files
      return fs.existsSync(path.join(KIT_HOME, 'whatsapp-session'));
    case 'discord':
      return !!(channelConfig.token || channelConfig.botToken);
    case 'slack':
      return !!(channelConfig.botToken && channelConfig.appToken);
    default:
      return false;
  }
}

function getChannelEmoji(channel: string): string {
  switch (channel.toLowerCase()) {
    case 'telegram': return '📱';
    case 'whatsapp': return '💬';
    case 'discord': return '🎮';
    case 'slack': return '💼';
    default: return '📡';
  }
}

function isSecret(key: string): boolean {
  const secretKeys = ['token', 'secret', 'password', 'key', 'api'];
  return secretKeys.some(s => key.toLowerCase().includes(s));
}

function maskValue(value: string): string {
  if (value.length <= 8) return '****';
  return value.slice(0, 4) + '****' + value.slice(-4);
}

async function setupTelegram(): Promise<void> {
  console.log('📱 Telegram Setup\n');
  console.log('1. Open @BotFather on Telegram');
  console.log('2. Send /newbot and follow the prompts');
  console.log('3. Copy the bot token\n');
  console.log('Then run:');
  console.log('  kit channels telegram token <YOUR_BOT_TOKEN>');
  console.log('  kit channels telegram chat <YOUR_CHAT_ID>\n');
  console.log('💡 Get your chat ID: Send a message to your bot, then visit:');
  console.log('   https://api.telegram.org/bot<TOKEN>/getUpdates');
}

async function setupWhatsApp(): Promise<void> {
  console.log('💬 WhatsApp Setup\n');
  console.log('WhatsApp uses QR code authentication.\n');
  console.log('Run: kit channels whatsapp login');
  console.log('\nThen scan the QR code with your phone:');
  console.log('1. Open WhatsApp on your phone');
  console.log('2. Go to Settings > Linked Devices');
  console.log('3. Tap "Link a Device"');
  console.log('4. Scan the QR code');
}

async function setupDiscord(): Promise<void> {
  console.log('🎮 Discord Setup\n');
  console.log('1. Go to https://discord.com/developers/applications');
  console.log('2. Create a new application');
  console.log('3. Go to "Bot" section and create a bot');
  console.log('4. Copy the bot token\n');
  console.log('Then run:');
  console.log('  kit config set discord.token <YOUR_BOT_TOKEN>\n');
  console.log('5. Invite bot to your server using OAuth2 URL Generator');
  console.log('   Required permissions: Send Messages, Read Message History');
}

async function setupSlack(): Promise<void> {
  console.log('💼 Slack Setup\n');
  console.log('1. Go to https://api.slack.com/apps');
  console.log('2. Create a new app from scratch');
  console.log('3. Enable Socket Mode and get App Token (xapp-...)');
  console.log('4. Go to OAuth & Permissions and install to workspace');
  console.log('5. Copy the Bot Token (xoxb-...)\n');
  console.log('Then run:');
  console.log('  kit config set slack.botToken <BOT_TOKEN>');
  console.log('  kit config set slack.appToken <APP_TOKEN>');
}
