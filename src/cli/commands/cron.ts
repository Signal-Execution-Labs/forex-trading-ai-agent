/**
 * K.I.T. Cron CLI Command
 * 
 * Manage scheduled cron jobs.
 * Jobs can run AI prompts on a schedule.
 * 
 * @see OpenClaw docs/automation/cron-jobs.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const CRON_FILE = path.join(KIT_HOME, 'cron.json');

export interface CronJob {
  id: string;
  name: string;
  schedule: {
    kind: 'at' | 'every' | 'cron';
    at?: string;      // ISO timestamp for 'at'
    everyMs?: number; // milliseconds for 'every'
    expr?: string;    // cron expression for 'cron'
    tz?: string;      // timezone
  };
  payload: {
    kind: 'systemEvent' | 'agentTurn';
    text?: string;    // for systemEvent
    message?: string; // for agentTurn
  };
  enabled: boolean;
  createdAt: string;
  lastRun?: string;
  nextRun?: string;
}

interface CronConfig {
  version: number;
  jobs: CronJob[];
}

function loadCronConfig(): CronConfig {
  if (!fs.existsSync(CRON_FILE)) {
    return { version: 1, jobs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(CRON_FILE, 'utf8'));
  } catch {
    return { version: 1, jobs: [] };
  }
}

function saveCronConfig(config: CronConfig): void {
  fs.writeFileSync(CRON_FILE, JSON.stringify(config, null, 2));
}

function generateId(): string {
  return `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function registerCronCommand(program: Command): void {
  const cron = program
    .command('cron')
    .description('Manage scheduled cron jobs');

  // List jobs
  cron
    .command('list')
    .alias('ls')
    .description('List all cron jobs')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = loadCronConfig();
      
      if (options.json) {
        console.log(JSON.stringify(config.jobs, null, 2));
        return;
      }
      
      if (config.jobs.length === 0) {
        console.log('No cron jobs configured.');
        console.log('\nAdd a job:');
        console.log('  kit cron add --name "Daily Report" --every 24h --message "Give me a daily summary"');
        return;
      }
      
      console.log('📅 Cron Jobs:\n');
      
      for (const job of config.jobs) {
        const status = job.enabled ? '✅' : '❌';
        const schedule = formatSchedule(job.schedule);
        console.log(`${status} ${job.name} (${job.id})`);
        console.log(`   Schedule: ${schedule}`);
        console.log(`   Payload: ${job.payload.kind === 'systemEvent' ? job.payload.text : job.payload.message}`);
        if (job.lastRun) console.log(`   Last run: ${job.lastRun}`);
        console.log('');
      }
    });

  // Add job
  cron
    .command('add')
    .description('Add a new cron job')
    .requiredOption('--name <name>', 'Job name')
    .option('--at <time>', 'Run once at specific time (ISO timestamp)')
    .option('--every <interval>', 'Run every interval (e.g., 30m, 1h, 24h)')
    .option('--cron <expr>', 'Cron expression (e.g., "0 9 * * *")')
    .option('--tz <timezone>', 'Timezone (e.g., Europe/Berlin)')
    .option('--message <msg>', 'Agent turn message')
    .option('--event <text>', 'System event text')
    .option('--disabled', 'Create job in disabled state')
    .action((options) => {
      // Validate schedule
      if (!options.at && !options.every && !options.cron) {
        console.error('Error: Must specify --at, --every, or --cron');
        process.exit(1);
      }
      
      // Validate payload
      if (!options.message && !options.event) {
        console.error('Error: Must specify --message or --event');
        process.exit(1);
      }
      
      const config = loadCronConfig();
      
      const job: CronJob = {
        id: generateId(),
        name: options.name,
        schedule: {
          kind: options.at ? 'at' : (options.every ? 'every' : 'cron'),
          ...(options.at && { at: options.at }),
          ...(options.every && { everyMs: parseInterval(options.every) }),
          ...(options.cron && { expr: options.cron }),
          ...(options.tz && { tz: options.tz }),
        },
        payload: {
          kind: options.message ? 'agentTurn' : 'systemEvent',
          ...(options.message && { message: options.message }),
          ...(options.event && { text: options.event }),
        },
        enabled: !options.disabled,
        createdAt: new Date().toISOString(),
      };
      
      config.jobs.push(job);
      saveCronConfig(config);
      
      console.log(`✅ Created cron job: ${job.name} (${job.id})`);
      console.log(`   Schedule: ${formatSchedule(job.schedule)}`);
      console.log('\n💡 Restart K.I.T. to apply: kit start');
    });

  // Remove job
  cron
    .command('remove <id>')
    .alias('rm')
    .description('Remove a cron job')
    .action((id) => {
      const config = loadCronConfig();
      const index = config.jobs.findIndex(j => j.id === id || j.name === id);
      
      if (index === -1) {
        console.error(`Error: Job not found: ${id}`);
        process.exit(1);
      }
      
      const job = config.jobs[index];
      config.jobs.splice(index, 1);
      saveCronConfig(config);
      
      console.log(`✅ Removed cron job: ${job.name}`);
    });

  // Enable/disable job
  cron
    .command('enable <id>')
    .description('Enable a cron job')
    .action((id) => {
      const config = loadCronConfig();
      const job = config.jobs.find(j => j.id === id || j.name === id);
      
      if (!job) {
        console.error(`Error: Job not found: ${id}`);
        process.exit(1);
      }
      
      job.enabled = true;
      saveCronConfig(config);
      console.log(`✅ Enabled: ${job.name}`);
    });

  cron
    .command('disable <id>')
    .description('Disable a cron job')
    .action((id) => {
      const config = loadCronConfig();
      const job = config.jobs.find(j => j.id === id || j.name === id);
      
      if (!job) {
        console.error(`Error: Job not found: ${id}`);
        process.exit(1);
      }
      
      job.enabled = false;
      saveCronConfig(config);
      console.log(`❌ Disabled: ${job.name}`);
    });

  // Run job immediately
  cron
    .command('run <id>')
    .description('Run a cron job immediately')
    .action(async (id) => {
      const config = loadCronConfig();
      const job = config.jobs.find(j => j.id === id || j.name === id);
      
      if (!job) {
        console.error(`Error: Job not found: ${id}`);
        process.exit(1);
      }
      
      console.log(`⏳ Running job: ${job.name}...`);
      console.log('💡 Note: This requires the gateway to be running.');
      console.log('   The job will be triggered via the cron system.');
      
      // TODO: Connect to gateway and trigger job
      console.log('\n⚠️ Manual execution not yet implemented.');
      console.log('   Jobs run automatically when the gateway is running.');
    });
}

function formatSchedule(schedule: CronJob['schedule']): string {
  switch (schedule.kind) {
    case 'at':
      return `Once at ${schedule.at}`;
    case 'every':
      return `Every ${formatInterval(schedule.everyMs!)}`;
    case 'cron':
      return `Cron: ${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ''}`;
    default:
      return 'Unknown';
  }
}

function parseInterval(str: string): number {
  const match = str.match(/^(\d+)(ms|s|m|h|d)?$/);
  if (!match) throw new Error(`Invalid interval: ${str}`);
  
  const value = parseInt(match[1]);
  const unit = match[2] || 'm';
  
  switch (unit) {
    case 'ms': return value;
    case 's': return value * 1000;
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    default: return value * 60 * 1000;
  }
}

function formatInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${ms / 1000}s`;
  if (ms < 3600000) return `${ms / 60000}m`;
  if (ms < 86400000) return `${ms / 3600000}h`;
  return `${ms / 86400000}d`;
}
