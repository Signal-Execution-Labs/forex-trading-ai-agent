/**
 * K.I.T. Agent CLI Command
 * 
 * Run agent turns directly via CLI.
 * 
 * @see OpenClaw docs/agent.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CONFIG_PATH = path.join(KIT_HOME, 'config.json');

export function registerAgentCommand(program: Command): void {
  program
    .command('agent')
    .description('Run an agent turn directly')
    .option('-m, --message <msg>', 'Message to send to the agent')
    .option('-f, --file <path>', 'Read message from file')
    .option('--model <model>', 'Override AI model')
    .option('--stream', 'Stream response as it generates')
    .option('--tools', 'Enable tool use (default: true)')
    .option('--no-tools', 'Disable tool use')
    .option('--session <key>', 'Use specific session key')
    .option('--deliver', 'Deliver response to default channel')
    .option('--to <target>', 'Deliver response to specific target')
    .option('--json', 'Output as JSON')
    .option('--local', 'Run without gateway (embedded mode)')
    .action(async (options) => {
      // Get message
      let message = options.message;
      
      if (options.file) {
        if (!fs.existsSync(options.file)) {
          console.error(`File not found: ${options.file}`);
          process.exit(1);
        }
        message = fs.readFileSync(options.file, 'utf8').trim();
      }
      
      if (!message) {
        // Interactive mode - read from stdin
        console.log('💡 Enter your message (Ctrl+D to send):\n');
        message = await readStdin();
      }
      
      if (!message) {
        console.error('No message provided.');
        console.log('Usage: kit agent --message "Your message"');
        console.log('       kit agent --file prompt.txt');
        process.exit(1);
      }
      
      console.log('🤖 Running agent turn...\n');
      
      if (options.local) {
        await runLocalAgent(message, options);
      } else {
        await runViaGateway(message, options);
      }
    });
}

async function runLocalAgent(message: string, options: any): Promise<void> {
  try {
    // Load config
    const config = loadConfig();
    
    // Import LLM client
    const { createLLMClient } = await import('../../providers/llm-client');
    const client = createLLMClient();
    
    // Note: Tool loading in local mode is limited
    // Full tool access requires running via gateway
    if (options.tools !== false) {
      console.log('💡 For full tool access, use gateway mode: kit start\n');
    }
    
    // Build messages
    const systemPrompt = buildSystemPrompt();
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message },
    ];
    
    // Make request
    console.log('─'.repeat(50));
    
    // Non-streaming response
    const response = await client.chat(messages as any, {
      model: options.model,
    });
    
    if (options.json) {
      console.log(JSON.stringify(response, null, 2));
    } else {
      console.log(response.content || 'No response');
    }
    
    console.log('─'.repeat(50));
    
    // Deliver if requested
    if (options.deliver || options.to) {
      console.log('\n📤 Delivery requested but not implemented in local mode.');
      console.log('   Use gateway mode (without --local) for delivery.');
    }
  } catch (error: any) {
    console.error(`\n❌ Agent error: ${error.message}`);
    process.exit(1);
  }
}

async function runViaGateway(message: string, options: any): Promise<void> {
  console.log('📡 Connecting to gateway...');
  
  // Try to connect to running gateway
  const gatewayUrl = `ws://127.0.0.1:${process.env.KIT_PORT || 18799}`;
  
  console.log(`\n⚠️ Gateway connection not yet implemented.`);
  console.log(`   Gateway URL: ${gatewayUrl}`);
  console.log(`\n💡 For now, use --local flag for embedded mode:`);
  console.log(`   kit agent --local --message "${message.slice(0, 50)}..."`);
  console.log(`\n   Or start interactive chat:`);
  console.log(`   kit chat`);
}

function loadConfig(): any {
  if (!fs.existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function buildSystemPrompt(): string {
  const workspaceDir = path.join(KIT_HOME, 'workspace');
  let systemPrompt = `You are K.I.T. (Knight Industries Trading), an AI financial agent.
You help users with trading, portfolio management, and financial decisions.
You have access to tools for trading, analysis, and data retrieval.

Current time: ${new Date().toISOString()}
`;

  // Load workspace files
  const files = ['SOUL.md', 'AGENTS.md', 'USER.md', 'MEMORY.md'];
  for (const file of files) {
    const filePath = path.join(workspaceDir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.length < 5000) { // Don't include huge files
          systemPrompt += `\n## ${file}\n${content}\n`;
        }
      } catch {
        // Skip unreadable files
      }
    }
  }

  return systemPrompt;
}

async function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) {
      // Interactive terminal
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      
      const lines: string[] = [];
      rl.on('line', (line: string) => lines.push(line));
      rl.on('close', () => resolve(lines.join('\n')));
    } else {
      // Piped input
      let data = '';
      process.stdin.on('data', chunk => data += chunk);
      process.stdin.on('end', () => resolve(data.trim()));
    }
  });
}
