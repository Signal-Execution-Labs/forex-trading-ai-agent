/**
 * K.I.T. Sessions CLI Command
 * 
 * List and manage conversation sessions.
 * 
 * @see OpenClaw docs/concepts/sessions.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const SESSIONS_DIR = path.join(KIT_HOME, 'sessions');

export interface SessionEntry {
  id: string;
  key: string;
  startedAt: string;
  lastMessageAt?: string;
  messageCount: number;
  channel?: string;
  userId?: string;
}

interface SessionMetadata {
  key: string;
  startedAt: string;
  channel?: string;
  userId?: string;
  messageCount: number;
}

export function registerSessionsCommand(program: Command): void {
  const sessions = program
    .command('sessions')
    .description('List and manage conversation sessions');

  // List sessions
  sessions
    .command('list')
    .alias('ls')
    .description('List all sessions')
    .option('--active <minutes>', 'Only show sessions active within N minutes', parseInt)
    .option('--channel <channel>', 'Filter by channel (telegram, whatsapp, discord)')
    .option('--limit <n>', 'Limit number of results', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      // Ensure sessions directory exists
      if (!fs.existsSync(SESSIONS_DIR)) {
        console.log('No sessions found.');
        console.log('\n💡 Sessions are created when you chat with K.I.T.');
        return;
      }

      const sessions = loadSessions();
      
      // Apply filters
      let filtered = sessions;
      
      if (options.active) {
        const cutoff = Date.now() - options.active * 60 * 1000;
        filtered = filtered.filter(s => 
          s.lastMessageAt && new Date(s.lastMessageAt).getTime() > cutoff
        );
      }
      
      if (options.channel) {
        filtered = filtered.filter(s => 
          s.channel?.toLowerCase() === options.channel.toLowerCase()
        );
      }
      
      // Sort by last message (newest first)
      filtered.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
      
      if (options.limit) {
        filtered = filtered.slice(0, options.limit);
      }
      
      if (options.json) {
        console.log(JSON.stringify(filtered, null, 2));
        return;
      }
      
      if (filtered.length === 0) {
        console.log('No sessions found matching criteria.');
        return;
      }
      
      console.log(`📋 Sessions (${filtered.length}):\n`);
      
      for (const session of filtered) {
        const channelEmoji = getChannelEmoji(session.channel);
        const lastMsg = session.lastMessageAt 
          ? formatTimeAgo(new Date(session.lastMessageAt)) 
          : 'never';
        
        console.log(`${channelEmoji} ${session.key}`);
        console.log(`   Messages: ${session.messageCount} | Last: ${lastMsg}`);
        console.log(`   Started: ${session.startedAt}`);
        console.log('');
      }
    });

  // Show session details
  sessions
    .command('show <key>')
    .description('Show session details and history')
    .option('--messages <n>', 'Number of messages to show', parseInt)
    .option('--json', 'Output as JSON')
    .action((key, options) => {
      const sessionFile = path.join(SESSIONS_DIR, `${sanitizeKey(key)}.json`);
      
      if (!fs.existsSync(sessionFile)) {
        console.error(`Session not found: ${key}`);
        process.exit(1);
      }
      
      try {
        const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
        
        if (options.json) {
          console.log(JSON.stringify(data, null, 2));
          return;
        }
        
        console.log(`📋 Session: ${key}\n`);
        console.log(`Started: ${data.startedAt || 'Unknown'}`);
        console.log(`Channel: ${data.channel || 'Unknown'}`);
        console.log(`Messages: ${data.messages?.length || 0}`);
        
        if (data.messages && data.messages.length > 0) {
          const limit = options.messages || 10;
          const messages = data.messages.slice(-limit);
          
          console.log(`\n📝 Last ${messages.length} messages:\n`);
          
          for (const msg of messages) {
            const role = msg.role === 'user' ? '👤' : '🤖';
            const content = typeof msg.content === 'string' 
              ? msg.content.slice(0, 200) 
              : '[complex content]';
            console.log(`${role} ${content}${content.length >= 200 ? '...' : ''}`);
            console.log('');
          }
        }
      } catch (error) {
        console.error(`Error reading session: ${error}`);
        process.exit(1);
      }
    });

  // Clear session
  sessions
    .command('clear <key>')
    .description('Clear a session (delete messages)')
    .option('--confirm', 'Skip confirmation prompt')
    .action((key, options) => {
      const sessionFile = path.join(SESSIONS_DIR, `${sanitizeKey(key)}.json`);
      
      if (!fs.existsSync(sessionFile)) {
        console.error(`Session not found: ${key}`);
        process.exit(1);
      }
      
      if (!options.confirm) {
        console.log(`⚠️ This will delete all messages in session: ${key}`);
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      fs.unlinkSync(sessionFile);
      console.log(`✅ Cleared session: ${key}`);
    });

  // Clear all sessions
  sessions
    .command('clear-all')
    .description('Clear all sessions')
    .option('--confirm', 'Skip confirmation prompt')
    .action((options) => {
      if (!options.confirm) {
        console.log('⚠️ This will delete ALL sessions!');
        console.log('   Use --confirm to proceed.');
        return;
      }
      
      if (fs.existsSync(SESSIONS_DIR)) {
        const files = fs.readdirSync(SESSIONS_DIR);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(path.join(SESSIONS_DIR, file));
          }
        }
        console.log(`✅ Cleared ${files.length} sessions`);
      } else {
        console.log('No sessions to clear.');
      }
    });
}

function loadSessions(): SessionEntry[] {
  const sessions: SessionEntry[] = [];
  
  if (!fs.existsSync(SESSIONS_DIR)) {
    return sessions;
  }
  
  const files = fs.readdirSync(SESSIONS_DIR);
  
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    
    try {
      const filePath = path.join(SESSIONS_DIR, file);
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      sessions.push({
        id: file.replace('.json', ''),
        key: data.key || file.replace('.json', ''),
        startedAt: data.startedAt || 'Unknown',
        lastMessageAt: data.lastMessageAt || getLastMessageTime(data.messages),
        messageCount: data.messages?.length || 0,
        channel: data.channel,
        userId: data.userId,
      });
    } catch {
      // Skip invalid files
    }
  }
  
  return sessions;
}

function getLastMessageTime(messages?: any[]): string | undefined {
  if (!messages || messages.length === 0) return undefined;
  const last = messages[messages.length - 1];
  return last.timestamp || last.createdAt;
}

function sanitizeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getChannelEmoji(channel?: string): string {
  switch (channel?.toLowerCase()) {
    case 'telegram': return '📱';
    case 'whatsapp': return '💬';
    case 'discord': return '🎮';
    case 'slack': return '💼';
    case 'dashboard': return '🖥️';
    default: return '💭';
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
