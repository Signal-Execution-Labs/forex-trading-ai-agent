/**
 * K.I.T. System CLI Command
 * 
 * System events, heartbeat, and presence management.
 * 
 * @see OpenClaw docs/concepts/system.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const STATE_FILE = path.join(KIT_HOME, 'state.json');
const PID_FILE = path.join(KIT_HOME, 'gateway.pid');

export interface SystemState {
  lastHeartbeat?: string;
  lastBoot?: string;
  bootCount: number;
  totalUptime: number;
  lastShutdown?: string;
  channels: {
    telegram?: { connected: boolean; lastMessage?: string };
    whatsapp?: { connected: boolean; lastMessage?: string };
    discord?: { connected: boolean; lastMessage?: string };
    slack?: { connected: boolean; lastMessage?: string };
  };
}

export function registerSystemCommand(program: Command): void {
  const system = program
    .command('system')
    .description('System events, heartbeat, and presence');

  // Show system info
  system
    .command('info')
    .description('Show system information')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const state = loadState();
      const isRunning = isGatewayRunning();
      
      const info = {
        version: '2.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        uptime: os.uptime(),
        gatewayRunning: isRunning,
        gatewayPid: isRunning ? getGatewayPid() : null,
        lastBoot: state.lastBoot,
        bootCount: state.bootCount,
        channels: state.channels,
      };
      
      if (options.json) {
        console.log(JSON.stringify(info, null, 2));
        return;
      }
      
      console.log('🖥️ K.I.T. System Info\n');
      console.log(`Version: ${info.version}`);
      console.log(`Node: ${info.nodeVersion}`);
      console.log(`Platform: ${info.platform} (${info.arch})`);
      console.log(`Hostname: ${info.hostname}`);
      console.log(`System Uptime: ${formatUptime(info.uptime)}`);
      console.log('');
      console.log(`Gateway: ${isRunning ? '✅ Running' : '❌ Stopped'}`);
      if (isRunning && info.gatewayPid) {
        console.log(`PID: ${info.gatewayPid}`);
      }
      console.log(`Boot Count: ${info.bootCount}`);
      if (info.lastBoot) {
        console.log(`Last Boot: ${info.lastBoot}`);
      }
      
      console.log('\n📡 Channels:');
      for (const [name, status] of Object.entries(info.channels)) {
        if (status) {
          const connected = status.connected ? '✅' : '❌';
          console.log(`  ${name}: ${connected}`);
        }
      }
    });

  // Trigger heartbeat
  system
    .command('heartbeat')
    .description('Trigger a manual heartbeat check')
    .action(async () => {
      console.log('💓 Triggering heartbeat...');
      
      if (!isGatewayRunning()) {
        console.log('⚠️ Gateway not running. Start with: kit start');
        return;
      }
      
      // TODO: Connect to gateway and trigger heartbeat
      console.log('💡 Heartbeat will be processed by the running gateway.');
      console.log('   Check logs: kit logs tail');
    });

  // Send system event
  system
    .command('event <message>')
    .description('Send a system event to the agent')
    .action(async (message) => {
      console.log(`📤 Sending system event: ${message}`);
      
      if (!isGatewayRunning()) {
        console.log('⚠️ Gateway not running. Start with: kit start');
        return;
      }
      
      // TODO: Connect to gateway and send event
      console.log('💡 System events require WebSocket connection to gateway.');
    });

  // Show presence
  system
    .command('presence')
    .description('Show current presence status')
    .action(() => {
      const state = loadState();
      const isRunning = isGatewayRunning();
      
      console.log('👤 Presence Status\n');
      console.log(`Gateway: ${isRunning ? 'Online' : 'Offline'}`);
      console.log(`Last Heartbeat: ${state.lastHeartbeat || 'Never'}`);
      
      console.log('\nChannel Status:');
      for (const [name, status] of Object.entries(state.channels)) {
        if (status) {
          const icon = status.connected ? '🟢' : '🔴';
          console.log(`  ${icon} ${name}`);
          if (status.lastMessage) {
            console.log(`     Last message: ${status.lastMessage}`);
          }
        }
      }
    });

  // Restart gateway
  system
    .command('restart')
    .description('Restart the gateway')
    .option('--force', 'Force kill if needed')
    .action(async (options) => {
      console.log('🔄 Restarting gateway...');
      
      const pid = getGatewayPid();
      if (pid) {
        try {
          process.kill(pid, options.force ? 'SIGKILL' : 'SIGTERM');
          console.log(`Stopped gateway (PID: ${pid})`);
        } catch {
          console.log('Gateway process not found, starting fresh...');
        }
      }
      
      // Wait a moment
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Starting gateway...');
      console.log('💡 Run: kit start');
    });

  // Show environment
  system
    .command('env')
    .description('Show relevant environment variables')
    .option('--all', 'Show all environment variables')
    .action((options) => {
      console.log('🌍 Environment Variables\n');
      
      const relevantVars = [
        'OPENAI_API_KEY',
        'ANTHROPIC_API_KEY',
        'TELEGRAM_BOT_TOKEN',
        'DISCORD_BOT_TOKEN',
        'SLACK_BOT_TOKEN',
        'MT5_PATH',
        'KIT_HOME',
        'NODE_ENV',
      ];
      
      if (options.all) {
        for (const [key, value] of Object.entries(process.env)) {
          const masked = maskSecret(key, value || '');
          console.log(`${key}=${masked}`);
        }
      } else {
        for (const key of relevantVars) {
          const value = process.env[key];
          if (value) {
            console.log(`✅ ${key}=${maskSecret(key, value)}`);
          } else {
            console.log(`❌ ${key}=<not set>`);
          }
        }
      }
    });
}

function loadState(): SystemState {
  if (!fs.existsSync(STATE_FILE)) {
    return {
      bootCount: 0,
      totalUptime: 0,
      channels: {},
    };
  }
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {
      bootCount: 0,
      totalUptime: 0,
      channels: {},
    };
  }
}

function isGatewayRunning(): boolean {
  const pid = getGatewayPid();
  if (!pid) return false;
  
  try {
    process.kill(pid, 0); // Check if process exists
    return true;
  } catch {
    return false;
  }
}

function getGatewayPid(): number | null {
  if (!fs.existsSync(PID_FILE)) return null;
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8').trim());
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0) parts.push(`${mins}m`);
  
  return parts.length > 0 ? parts.join(' ') : '< 1m';
}

function maskSecret(key: string, value: string): string {
  const secretKeys = ['KEY', 'TOKEN', 'SECRET', 'PASSWORD', 'PASS'];
  const isSecret = secretKeys.some(s => key.toUpperCase().includes(s));
  
  if (isSecret && value.length > 8) {
    return value.slice(0, 4) + '****' + value.slice(-4);
  }
  return value;
}
