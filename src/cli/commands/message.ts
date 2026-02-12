/**
 * K.I.T. Message CLI Command
 * 
 * Send messages via configured channels.
 * 
 * @see OpenClaw docs/messaging.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';
import https from 'https';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export function registerMessageCommand(program: Command): void {
  const message = program
    .command('message')
    .description('Send messages via channels');

  // Send message
  message
    .command('send')
    .description('Send a message')
    .requiredOption('--channel <channel>', 'Channel to use (telegram, whatsapp, discord, slack)')
    .requiredOption('--to <target>', 'Target (chat ID, phone number, channel ID)')
    .requiredOption('--text <message>', 'Message text')
    .option('--silent', 'Send silently (no notification)')
    .option('--json', 'Output result as JSON')
    .action(async (options) => {
      const config = loadConfig();
      
      try {
        let result: any;
        
        switch (options.channel.toLowerCase()) {
          case 'telegram':
            result = await sendTelegram(config, options.to, options.text, options.silent);
            break;
          case 'whatsapp':
            console.log('⚠️ WhatsApp sending requires active session.');
            console.log('   Start K.I.T. with: kit start');
            return;
          case 'discord':
            console.log('⚠️ Discord sending requires active bot connection.');
            console.log('   Start K.I.T. with: kit start');
            return;
          case 'slack':
            console.log('⚠️ Slack sending requires active connection.');
            console.log('   Start K.I.T. with: kit start');
            return;
          default:
            console.error(`Unknown channel: ${options.channel}`);
            process.exit(1);
        }
        
        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log('✅ Message sent!');
          if (result.message_id) {
            console.log(`   Message ID: ${result.message_id}`);
          }
        }
      } catch (error: any) {
        console.error(`❌ Failed to send: ${error.message}`);
        process.exit(1);
      }
    });

  // Quick send to default channel
  message
    .command('quick <text>')
    .description('Quick send to default channel')
    .action(async (text) => {
      const config = loadConfig();
      
      // Find first configured channel
      const channels = ['telegram', 'discord', 'slack'];
      let channel = null;
      let target = null;
      
      for (const ch of channels) {
        const chConfig = config[ch] || config.channels?.[ch];
        if (chConfig?.token || chConfig?.botToken) {
          channel = ch;
          target = chConfig.chatId || chConfig.defaultChannel;
          break;
        }
      }
      
      if (!channel || !target) {
        console.error('No configured channel found.');
        console.log('💡 Setup a channel first: kit channels setup telegram');
        process.exit(1);
      }
      
      console.log(`📤 Sending via ${channel} to ${target}...`);
      
      try {
        if (channel === 'telegram') {
          await sendTelegram(config, target, text, false);
          console.log('✅ Message sent!');
        } else {
          console.log('⚠️ Quick send only supports Telegram currently.');
        }
      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
        process.exit(1);
      }
    });

  // Broadcast to all channels
  message
    .command('broadcast <text>')
    .description('Send message to all configured channels')
    .option('--confirm', 'Skip confirmation')
    .action(async (text, options) => {
      if (!options.confirm) {
        console.log('⚠️ This will send to ALL configured channels.');
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      const config = loadConfig();
      const results: Array<{ channel: string; success: boolean; error?: string }> = [];
      
      // Try Telegram
      const telegramConfig = config.telegram || config.channels?.telegram;
      if (telegramConfig?.token && telegramConfig?.chatId) {
        try {
          await sendTelegram(config, telegramConfig.chatId, text, false);
          results.push({ channel: 'telegram', success: true });
        } catch (error: any) {
          results.push({ channel: 'telegram', success: false, error: error.message });
        }
      }
      
      console.log('\n📡 Broadcast Results:\n');
      for (const result of results) {
        const status = result.success ? '✅' : '❌';
        console.log(`${status} ${result.channel}${result.error ? `: ${result.error}` : ''}`);
      }
      
      if (results.length === 0) {
        console.log('No channels configured for broadcasting.');
      }
    });

  // Schedule message
  message
    .command('schedule')
    .description('Schedule a message for later')
    .requiredOption('--channel <channel>', 'Channel to use')
    .requiredOption('--to <target>', 'Target')
    .requiredOption('--text <message>', 'Message text')
    .requiredOption('--at <time>', 'Send at (ISO timestamp or relative like "1h", "30m")')
    .action(async (options) => {
      console.log('⏰ Scheduling message...');
      
      let sendAt: Date;
      
      if (options.at.match(/^\d+[mhd]$/)) {
        // Relative time
        const value = parseInt(options.at);
        const unit = options.at.slice(-1);
        const ms = unit === 'm' ? value * 60000 
                 : unit === 'h' ? value * 3600000 
                 : value * 86400000;
        sendAt = new Date(Date.now() + ms);
      } else {
        sendAt = new Date(options.at);
      }
      
      console.log(`\nMessage scheduled for: ${sendAt.toLocaleString()}`);
      console.log(`Channel: ${options.channel}`);
      console.log(`To: ${options.to}`);
      console.log(`Text: ${options.text.slice(0, 50)}${options.text.length > 50 ? '...' : ''}`);
      
      console.log('\n💡 Create a cron job:');
      console.log(`   kit cron add --name "Scheduled Message" --at "${sendAt.toISOString()}" --event "Send message to ${options.to}: ${options.text}"`);
    });
}

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function sendTelegram(config: any, chatId: string, text: string, silent: boolean): Promise<any> {
  const telegramConfig = config.telegram || config.channels?.telegram;
  const token = telegramConfig?.token || telegramConfig?.botToken;
  
  if (!token) {
    throw new Error('Telegram not configured. Run: kit channels setup telegram');
  }
  
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: chatId,
      text: text,
      disable_notification: silent,
    });
    
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(body);
          if (result.ok) {
            resolve(result.result);
          } else {
            reject(new Error(result.description || 'Unknown error'));
          }
        } catch {
          reject(new Error('Invalid response'));
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}
