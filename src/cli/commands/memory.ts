/**
 * K.I.T. Memory CLI Command
 * 
 * Search and manage workspace memory files.
 * 
 * @see OpenClaw docs/concepts/memory.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const WORKSPACE_DIR = path.join(KIT_HOME, 'workspace');
const MEMORY_DIR = path.join(WORKSPACE_DIR, 'memory');
const MEMORY_MD = path.join(WORKSPACE_DIR, 'MEMORY.md');

export function registerMemoryCommand(program: Command): void {
  const memory = program
    .command('memory')
    .description('Search and manage workspace memory');

  // Search memory
  memory
    .command('search <query>')
    .description('Search memory files for a query')
    .option('--days <n>', 'Search last N days of memory', parseInt)
    .option('--json', 'Output as JSON')
    .action((query, options) => {
      const results: Array<{ file: string; line: number; text: string; score: number }> = [];
      const queryLower = query.toLowerCase();
      
      // Search MEMORY.md
      if (fs.existsSync(MEMORY_MD)) {
        searchFile(MEMORY_MD, queryLower, results);
      }
      
      // Search daily memory files
      if (fs.existsSync(MEMORY_DIR)) {
        const files = fs.readdirSync(MEMORY_DIR)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();
        
        const limit = options.days ? options.days : files.length;
        
        for (const file of files.slice(0, limit)) {
          searchFile(path.join(MEMORY_DIR, file), queryLower, results);
        }
      }
      
      // Sort by score (relevance)
      results.sort((a, b) => b.score - a.score);
      
      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }
      
      if (results.length === 0) {
        console.log(`No matches found for: ${query}`);
        return;
      }
      
      console.log(`🔍 Found ${results.length} matches for "${query}":\n`);
      
      for (const result of results.slice(0, 20)) {
        const fileName = path.basename(result.file);
        console.log(`📄 ${fileName}:${result.line}`);
        console.log(`   ${highlightMatch(result.text, query)}`);
        console.log('');
      }
      
      if (results.length > 20) {
        console.log(`... and ${results.length - 20} more matches`);
      }
    });

  // List memory files
  memory
    .command('list')
    .alias('ls')
    .description('List all memory files')
    .option('--days <n>', 'Show last N days', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const files: Array<{ name: string; path: string; size: number; date?: string }> = [];
      
      // Add MEMORY.md
      if (fs.existsSync(MEMORY_MD)) {
        const stat = fs.statSync(MEMORY_MD);
        files.push({
          name: 'MEMORY.md',
          path: MEMORY_MD,
          size: stat.size,
        });
      }
      
      // Add daily files
      if (fs.existsSync(MEMORY_DIR)) {
        const dailyFiles = fs.readdirSync(MEMORY_DIR)
          .filter(f => f.endsWith('.md'))
          .sort()
          .reverse();
        
        const limit = options.days || dailyFiles.length;
        
        for (const file of dailyFiles.slice(0, limit)) {
          const filePath = path.join(MEMORY_DIR, file);
          const stat = fs.statSync(filePath);
          files.push({
            name: file,
            path: filePath,
            size: stat.size,
            date: file.replace('.md', ''),
          });
        }
      }
      
      if (options.json) {
        console.log(JSON.stringify(files, null, 2));
        return;
      }
      
      if (files.length === 0) {
        console.log('No memory files found.');
        console.log('\n💡 Memory files are created as you use K.I.T.');
        return;
      }
      
      console.log('📚 Memory Files:\n');
      
      for (const file of files) {
        const sizeStr = formatSize(file.size);
        console.log(`  ${file.name} (${sizeStr})`);
      }
      
      console.log(`\nTotal: ${files.length} files`);
    });

  // Show today's memory
  memory
    .command('today')
    .description('Show today\'s memory log')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const today = new Date().toISOString().split('T')[0];
      const todayFile = path.join(MEMORY_DIR, `${today}.md`);
      
      if (!fs.existsSync(todayFile)) {
        console.log('No memory log for today yet.');
        return;
      }
      
      const content = fs.readFileSync(todayFile, 'utf8');
      
      if (options.json) {
        console.log(JSON.stringify({ date: today, content }, null, 2));
        return;
      }
      
      console.log(`📅 Memory: ${today}\n`);
      console.log(content);
    });

  // Append to today's memory
  memory
    .command('add <text>')
    .description('Add entry to today\'s memory log')
    .action((text) => {
      // Ensure directories exist
      if (!fs.existsSync(MEMORY_DIR)) {
        fs.mkdirSync(MEMORY_DIR, { recursive: true });
      }
      
      const today = new Date().toISOString().split('T')[0];
      const todayFile = path.join(MEMORY_DIR, `${today}.md`);
      
      // Create file with header if it doesn't exist
      if (!fs.existsSync(todayFile)) {
        fs.writeFileSync(todayFile, `# ${today} - K.I.T. Memory\n\n`);
      }
      
      // Append entry
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
      const entry = `## ${timestamp}\n${text}\n\n`;
      fs.appendFileSync(todayFile, entry);
      
      console.log(`✅ Added to ${today}.md`);
    });

  // Show long-term memory
  memory
    .command('long-term')
    .alias('lt')
    .description('Show MEMORY.md (long-term curated memory)')
    .option('--lines <n>', 'Show last N lines', parseInt)
    .option('--json', 'Output as JSON')
    .action((options) => {
      if (!fs.existsSync(MEMORY_MD)) {
        console.log('No long-term memory file found.');
        console.log('\n💡 Create MEMORY.md in your workspace to store curated memories.');
        return;
      }
      
      let content = fs.readFileSync(MEMORY_MD, 'utf8');
      
      if (options.lines) {
        const lines = content.split('\n');
        content = lines.slice(-options.lines).join('\n');
      }
      
      if (options.json) {
        console.log(JSON.stringify({ content }, null, 2));
        return;
      }
      
      console.log('📚 MEMORY.md (Long-term Memory)\n');
      console.log(content);
    });
}

function searchFile(
  filePath: string, 
  query: string, 
  results: Array<{ file: string; line: number; text: string; score: number }>
): void {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineLower = line.toLowerCase();
      
      if (lineLower.includes(query)) {
        // Calculate simple relevance score
        const occurrences = (lineLower.match(new RegExp(query, 'g')) || []).length;
        const score = occurrences * (line.length < 200 ? 2 : 1);
        
        results.push({
          file: filePath,
          line: i + 1,
          text: line.trim().slice(0, 200),
          score,
        });
      }
    }
  } catch {
    // Skip unreadable files
  }
}

function highlightMatch(text: string, query: string): string {
  // Simple highlight by wrapping matches
  const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
  return text.replace(regex, '\x1b[33m$1\x1b[0m'); // Yellow highlight
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
