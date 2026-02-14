/**
 * K.I.T. Terminal UI (TUI) Command
 * 
 * OpenClaw-compatible terminal interface for K.I.T. gateway
 */

import { Command } from 'commander';
import * as readline from 'readline';
import WebSocket from 'ws';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

interface TuiOptions {
  url?: string;
  token?: string;
  session?: string;
  deliver?: boolean;
  thinking?: string;
  historyLimit?: string;
}

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: number;
}

interface TuiState {
  connected: boolean;
  running: boolean;
  model?: string;
  agent?: string;
  session?: string;
  deliver: boolean;
  thinking?: string;
  messages: Message[];
}

const KIT_HOME = path.join(os.homedir(), '.kit');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

function clearLine(): void {
  process.stdout.write('\r\x1b[K');
}

function printHeader(state: TuiState): void {
  console.log(`\n${colors.cyan}${colors.bright}🚗 K.I.T. TUI${colors.reset}`);
  console.log(`${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
  console.log(`${colors.gray}Agent: ${colors.reset}${state.agent || 'main'} ${colors.gray}| Session: ${colors.reset}${state.session || 'main'} ${colors.gray}| Model: ${colors.reset}${state.model || 'default'}`);
  console.log(`${colors.gray}Deliver: ${colors.reset}${state.deliver ? '✓' : '✗'} ${colors.gray}| Thinking: ${colors.reset}${state.thinking || 'off'}`);
  console.log(`${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
}

function printHelp(): void {
  console.log(`
${colors.cyan}${colors.bright}K.I.T. TUI Commands${colors.reset}
${colors.dim}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}

${colors.yellow}Core Commands:${colors.reset}
  /help              Show this help
  /status            Check gateway status
  /exit, /quit       Exit TUI
  /clear             Clear screen

${colors.yellow}Session Controls:${colors.reset}
  /session <key>     Switch session
  /new, /reset       Start new session
  /model <name>      Set model override
  /deliver <on|off>  Toggle message delivery
  /think <level>     Set thinking level (off|minimal|low|medium|high)

${colors.yellow}Trading Commands:${colors.reset}
  /balance           Check portfolio balance
  /positions         Show open positions
  /orders            List pending orders
  /market <symbol>   Get market data
  /price <symbol>    Get current price

${colors.yellow}Keyboard Shortcuts:${colors.reset}
  Ctrl+C             Clear input / Exit (double tap)
  Ctrl+L             Clear screen
  Enter              Send message

${colors.dim}Type any message to chat with K.I.T.${colors.reset}
`);
}

function printMessage(msg: Message): void {
  const timestamp = msg.timestamp 
    ? new Date(msg.timestamp).toLocaleTimeString() 
    : '';
  
  switch (msg.role) {
    case 'user':
      console.log(`\n${colors.green}You${colors.reset} ${colors.gray}${timestamp}${colors.reset}`);
      console.log(msg.content);
      break;
    case 'assistant':
      console.log(`\n${colors.cyan}🚗 K.I.T.${colors.reset} ${colors.gray}${timestamp}${colors.reset}`);
      console.log(msg.content);
      break;
    case 'system':
      console.log(`\n${colors.yellow}[System]${colors.reset} ${msg.content}`);
      break;
    case 'tool':
      console.log(`\n${colors.magenta}[Tool]${colors.reset} ${colors.dim}${msg.content}${colors.reset}`);
      break;
  }
}

async function getGatewayConfig(): Promise<{ url: string; token?: string }> {
  const configPath = path.join(KIT_HOME, 'config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const port = config.gateway?.port || 18799;
      const token = config.gateway?.token;
      return { url: `ws://127.0.0.1:${port}`, token };
    } catch {
      // Fall through to defaults
    }
  }
  
  return { url: 'ws://127.0.0.1:18799' };
}

export function registerTuiCommand(program: Command): void {
  program
    .command('tui')
    .description('Terminal UI - interactive chat with K.I.T. gateway')
    .option('-u, --url <url>', 'Gateway WebSocket URL')
    .option('-t, --token <token>', 'Gateway auth token')
    .option('-s, --session <key>', 'Session key (default: main)')
    .option('-d, --deliver', 'Deliver messages to provider')
    .option('--thinking <level>', 'Thinking level (off|minimal|low|medium|high)')
    .option('--history-limit <n>', 'History entries to load', '100')
    .action(async (options: TuiOptions) => {
      const config = await getGatewayConfig();
      const url = options.url || config.url;
      const token = options.token || config.token;
      
      const state: TuiState = {
        connected: false,
        running: false,
        agent: 'main',
        session: options.session || 'main',
        deliver: !!options.deliver,
        thinking: options.thinking,
        messages: [],
      };
      
      let ws: WebSocket | null = null;
      let reconnectAttempts = 0;
      const maxReconnectAttempts = 5;
      let ctrlCCount = 0;
      let ctrlCTimer: NodeJS.Timeout | null = null;
      
      // Clear screen and show header
      console.clear();
      printHeader(state);
      console.log(`${colors.yellow}Connecting to ${url}...${colors.reset}`);
      
      function connect(): void {
        const wsUrl = token ? `${url}?token=${token}` : url;
        ws = new WebSocket(wsUrl);
        
        ws.on('open', () => {
          state.connected = true;
          reconnectAttempts = 0;
          clearLine();
          console.log(`${colors.green}✓ Connected to K.I.T. Gateway${colors.reset}\n`);
          printHelp();
          
          // Register as TUI client
          ws?.send(JSON.stringify({
            type: 'register',
            mode: 'tui',
            session: state.session,
          }));
          
          // Request history
          ws?.send(JSON.stringify({
            type: 'history',
            session: state.session,
            limit: parseInt(options.historyLimit || '100'),
          }));
          
          showPrompt();
        });
        
        ws.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString());
            handleMessage(msg);
          } catch {
            // Ignore parse errors
          }
        });
        
        ws.on('close', () => {
          state.connected = false;
          console.log(`\n${colors.yellow}Disconnected from gateway${colors.reset}`);
          
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
            console.log(`${colors.gray}Reconnecting in ${delay / 1000}s... (${reconnectAttempts}/${maxReconnectAttempts})${colors.reset}`);
            setTimeout(connect, delay);
          } else {
            console.log(`${colors.red}Max reconnection attempts reached. Exiting.${colors.reset}`);
            process.exit(1);
          }
        });
        
        ws.on('error', (err) => {
          console.log(`\n${colors.red}Connection error: ${err.message}${colors.reset}`);
        });
      }
      
      function handleMessage(msg: any): void {
        switch (msg.type) {
          case 'status':
            state.model = msg.model;
            state.running = msg.running;
            break;
            
          case 'history':
            if (Array.isArray(msg.messages)) {
              console.log(`\n${colors.gray}--- History (${msg.messages.length} messages) ---${colors.reset}`);
              msg.messages.forEach((m: Message) => printMessage(m));
              console.log(`${colors.gray}--- End History ---${colors.reset}\n`);
            }
            break;
            
          case 'message':
            clearLine();
            printMessage({
              role: msg.role || 'assistant',
              content: msg.content,
              timestamp: msg.timestamp || Date.now(),
            });
            if (!state.running) showPrompt();
            break;
            
          case 'stream':
            // Handle streaming response
            if (msg.delta) {
              process.stdout.write(msg.delta);
            }
            if (msg.done) {
              console.log('');
              showPrompt();
            }
            break;
            
          case 'tool':
            clearLine();
            printMessage({
              role: 'tool',
              content: `${msg.name}: ${JSON.stringify(msg.args || {})}`,
              timestamp: Date.now(),
            });
            break;
            
          case 'error':
            clearLine();
            console.log(`\n${colors.red}Error: ${msg.error || msg.message}${colors.reset}`);
            showPrompt();
            break;
            
          case 'running':
            state.running = msg.running;
            if (!msg.running) showPrompt();
            break;
        }
      }
      
      function showPrompt(): void {
        const status = state.connected 
          ? (state.running ? colors.yellow + '●' : colors.green + '●')
          : colors.red + '○';
        process.stdout.write(`\n${status}${colors.reset} ${colors.bright}>${colors.reset} `);
      }
      
      function handleSlashCommand(input: string): boolean {
        const [cmd, ...args] = input.slice(1).split(' ');
        
        switch (cmd.toLowerCase()) {
          case 'help':
            printHelp();
            return true;
            
          case 'exit':
          case 'quit':
            console.log(`\n${colors.cyan}Goodbye!${colors.reset}\n`);
            process.exit(0);
            
          case 'clear':
            console.clear();
            printHeader(state);
            return true;
            
          case 'status':
            ws?.send(JSON.stringify({ type: 'status' }));
            console.log(`${colors.gray}Connected: ${state.connected}, Running: ${state.running}, Model: ${state.model || 'default'}${colors.reset}`);
            return true;
            
          case 'session':
            if (args[0]) {
              state.session = args[0];
              ws?.send(JSON.stringify({ type: 'switch_session', session: args[0] }));
              console.log(`${colors.green}Switched to session: ${args[0]}${colors.reset}`);
            } else {
              console.log(`${colors.gray}Current session: ${state.session}${colors.reset}`);
            }
            return true;
            
          case 'new':
          case 'reset':
            ws?.send(JSON.stringify({ type: 'reset_session', session: state.session }));
            console.log(`${colors.green}Session reset${colors.reset}`);
            return true;
            
          case 'model':
            if (args[0]) {
              state.model = args[0];
              ws?.send(JSON.stringify({ type: 'set_model', model: args[0] }));
              console.log(`${colors.green}Model set to: ${args[0]}${colors.reset}`);
            } else {
              console.log(`${colors.gray}Current model: ${state.model || 'default'}${colors.reset}`);
            }
            return true;
            
          case 'deliver':
            state.deliver = args[0]?.toLowerCase() === 'on';
            console.log(`${colors.green}Deliver: ${state.deliver ? 'on' : 'off'}${colors.reset}`);
            return true;
            
          case 'think':
          case 'thinking':
            state.thinking = args[0] || 'off';
            console.log(`${colors.green}Thinking: ${state.thinking}${colors.reset}`);
            return true;
            
          case 'balance':
          case 'positions':
          case 'orders':
          case 'market':
          case 'price':
            // Forward trading commands to gateway
            ws?.send(JSON.stringify({ 
              type: 'command',
              command: cmd,
              args: args,
            }));
            return true;
            
          default:
            // Forward unknown slash commands to gateway
            ws?.send(JSON.stringify({ 
              type: 'slash_command',
              command: input,
            }));
            return true;
        }
      }
      
      function sendMessage(content: string): void {
        if (!state.connected) {
          console.log(`${colors.red}Not connected to gateway${colors.reset}`);
          return;
        }
        
        ws?.send(JSON.stringify({
          type: 'message',
          content,
          session: state.session,
          deliver: state.deliver,
          thinking: state.thinking,
        }));
        
        state.running = true;
      }
      
      // Start connection
      connect();
      
      // Setup readline interface
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
      
      // Handle Ctrl+C
      rl.on('close', () => {
        console.log(`\n${colors.cyan}Goodbye!${colors.reset}\n`);
        ws?.close();
        process.exit(0);
      });
      
      // Handle Ctrl+L (clear screen)
      process.stdin.on('keypress', (_str, key) => {
        if (key && key.ctrl && key.name === 'l') {
          console.clear();
          printHeader(state);
          showPrompt();
        }
      });
      
      // Read input
      rl.on('line', (input) => {
        const trimmed = input.trim();
        
        if (!trimmed) {
          showPrompt();
          return;
        }
        
        if (trimmed.startsWith('/')) {
          handleSlashCommand(trimmed);
          showPrompt();
        } else {
          // Send as message
          printMessage({
            role: 'user',
            content: trimmed,
            timestamp: Date.now(),
          });
          sendMessage(trimmed);
        }
      });
      
      // Handle Ctrl+C with double-tap to exit
      process.on('SIGINT', () => {
        ctrlCCount++;
        if (ctrlCCount >= 2) {
          console.log(`\n${colors.cyan}Goodbye!${colors.reset}\n`);
          ws?.close();
          process.exit(0);
        }
        
        clearLine();
        console.log(`${colors.gray}Press Ctrl+C again to exit${colors.reset}`);
        showPrompt();
        
        if (ctrlCTimer) clearTimeout(ctrlCTimer);
        ctrlCTimer = setTimeout(() => {
          ctrlCCount = 0;
        }, 1000);
      });
    });
}

export { registerTuiCommand as createTuiCommand };
