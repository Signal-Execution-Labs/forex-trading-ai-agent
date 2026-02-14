import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { getWorkflowEngine, KitWorkflow } from '../../core/workflows.js';
import { Logger } from '../../core/logger.js';
import { getKitHome } from '../../config/index.js';

// Helper to get state directory (same as KIT_HOME)
function getStateDir(): string {
  return getKitHome();
}

const logger = new Logger('workflow');

/**
 * Workflow Command - Run and manage .kit workflow files
 * 
 * Similar to OpenClaw's Lobster but trading-focused.
 */
export function registerWorkflowCommand(program: Command): void {
  const workflow = program
    .command('workflow')
    .alias('wf')
    .description('Run and manage trading workflows (.kit files)');

  // Run a workflow
  workflow
    .command('run <file>')
    .description('Run a workflow file')
    .option('--args <json>', 'JSON arguments for the workflow')
    .option('--dry-run', 'Simulate without executing trades')
    .option('--verbose', 'Show detailed output')
    .action(async (file: string, options) => {
      const engine = getWorkflowEngine();
      
      console.log(`\n🔄 Running workflow: ${file}\n`);
      
      try {
        // Parse args
        let args: Record<string, unknown> = {};
        if (options.args) {
          args = JSON.parse(options.args);
        }
        
        const result = await engine.run(file, args, { dryRun: options.dryRun });
        
        if (result.status === 'completed') {
          console.log('✅ Workflow completed successfully\n');
          if (options.verbose && result.output) {
            console.log('📤 Output:');
            console.log(JSON.stringify(result.output, null, 2));
          }
        } else if (result.status === 'needs_approval') {
          console.log('⏸️ Workflow paused - approval required\n');
          console.log(`📋 Step: ${result.requiresApproval?.stepId}`);
          console.log(`❓ Prompt: ${result.requiresApproval?.prompt}`);
          console.log(`\n🔑 Resume token: ${result.requiresApproval?.resumeToken}`);
          console.log('\nTo approve: kit workflow resume <token> --approve');
          console.log('To reject:  kit workflow resume <token> --reject');
        } else if (result.status === 'failed') {
          console.log('❌ Workflow failed\n');
          console.log(`Error: ${result.error}`);
        }
        
        console.log(`\n📁 Run ID: ${result.runId}`);
        
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // Resume a paused workflow
  workflow
    .command('resume <token>')
    .description('Resume a paused workflow')
    .option('--approve', 'Approve and continue')
    .option('--reject', 'Reject and cancel')
    .action(async (token: string, options) => {
      if (!options.approve && !options.reject) {
        console.error('❌ Must specify --approve or --reject');
        process.exit(1);
      }
      
      const engine = getWorkflowEngine();
      
      console.log(`\n🔄 Resuming workflow...\n`);
      
      try {
        const result = await engine.resume(token, options.approve);
        
        if (result.status === 'completed') {
          console.log('✅ Workflow completed successfully');
        } else if (result.status === 'needs_approval') {
          console.log('⏸️ Another approval required\n');
          console.log(`📋 Step: ${result.requiresApproval?.stepId}`);
          console.log(`❓ Prompt: ${result.requiresApproval?.prompt}`);
          console.log(`\n🔑 Resume token: ${result.requiresApproval?.resumeToken}`);
        } else if (result.status === 'cancelled') {
          console.log('🚫 Workflow cancelled');
        } else if (result.status === 'failed') {
          console.log('❌ Workflow failed');
          console.log(`Error: ${result.error}`);
        }
        
        console.log(`\n📁 Run ID: ${result.runId}`);
        
      } catch (error) {
        console.error(`❌ Error: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
    });

  // List workflows
  workflow
    .command('list')
    .description('List available workflows')
    .action(async () => {
      const engine = getWorkflowEngine();
      const workflows = engine.listWorkflows();
      
      console.log('\n📋 Available Workflows:\n');
      
      if (workflows.length === 0) {
        console.log('   (no workflows found)');
        console.log('\n💡 Create workflows in: ~/.kit/workflows/library/');
      } else {
        for (const wf of workflows) {
          console.log(`   📄 ${wf.name}`);
          console.log(`      File: ${wf.path}`);
          if (wf.description) {
            console.log(`      ${wf.description}`);
          }
          console.log('');
        }
      }
      
      console.log('');
    });

  // Show run history
  workflow
    .command('history')
    .description('Show workflow run history')
    .option('--limit <n>', 'Number of runs to show', '10')
    .action(async (options) => {
      const engine = getWorkflowEngine();
      const runs = engine.listRuns(parseInt(options.limit, 10));
      
      console.log('\n📜 Workflow Run History:\n');
      
      if (runs.length === 0) {
        console.log('   (no runs found)');
      } else {
        for (const run of runs) {
          const statusIcon = {
            running: '🔄',
            paused: '⏸️',
            completed: '✅',
            failed: '❌',
            cancelled: '🚫',
          }[run.status] || '❓';
          
          console.log(`   ${statusIcon} ${run.id}`);
          console.log(`      Workflow: ${run.workflowName}`);
          console.log(`      Status: ${run.status}`);
          console.log(`      Started: ${run.startedAt}`);
          if (run.completedAt) {
            console.log(`      Completed: ${run.completedAt}`);
          }
          console.log('');
        }
      }
      
      console.log('');
    });

  // Create a new workflow
  workflow
    .command('new <name>')
    .description('Create a new workflow file')
    .option('--template <type>', 'Template type (basic, screener, signal, order)', 'basic')
    .action(async (name: string, options) => {
      const stateDir = getStateDir();
      const workflowsDir = path.join(stateDir, 'workflows', 'library');
      
      if (!fs.existsSync(workflowsDir)) {
        fs.mkdirSync(workflowsDir, { recursive: true });
      }
      
      const fileName = name.endsWith('.kit') ? name : `${name}.kit`;
      const filePath = path.join(workflowsDir, fileName);
      
      if (fs.existsSync(filePath)) {
        console.error(`❌ File already exists: ${filePath}`);
        process.exit(1);
      }
      
      const template = getWorkflowTemplate(options.template, name);
      fs.writeFileSync(filePath, JSON.stringify(template, null, 2));
      
      console.log(`\n✅ Created workflow: ${filePath}\n`);
      console.log('💡 Edit the file to customize your workflow.');
      console.log(`   Run with: kit workflow run ${fileName}`);
      console.log('');
    });

  // Validate a workflow
  workflow
    .command('validate <file>')
    .description('Validate a workflow file')
    .action(async (file: string) => {
      const engine = getWorkflowEngine();
      
      console.log(`\n🔍 Validating: ${file}\n`);
      
      try {
        const workflow = engine.loadWorkflow(file);
        
        console.log('✅ Workflow is valid\n');
        console.log(`   Name: ${workflow.name}`);
        console.log(`   Steps: ${workflow.steps.length}`);
        
        if (workflow.args) {
          console.log(`   Args: ${Object.keys(workflow.args).join(', ')}`);
        }
        
        console.log('\n📋 Steps:');
        for (const step of workflow.steps) {
          const approval = step.approval === 'required' ? ' 🔒' : '';
          console.log(`   ${step.id}: ${step.action}${approval}`);
        }
        
      } catch (error) {
        console.error(`❌ Invalid: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
      
      console.log('');
    });

  // Show examples
  workflow
    .command('examples')
    .description('Show workflow examples')
    .action(async () => {
      console.log('\n📚 K.I.T. Workflow Examples\n');
      
      console.log('━━━ Basic Screener ━━━\n');
      console.log(JSON.stringify(getWorkflowTemplate('screener', 'crypto-screener'), null, 2));
      
      console.log('\n━━━ Signal Generator ━━━\n');
      console.log(JSON.stringify(getWorkflowTemplate('signal', 'btc-signal'), null, 2));
      
      console.log('\n━━━ Order Workflow ━━━\n');
      console.log(JSON.stringify(getWorkflowTemplate('order', 'auto-trader'), null, 2));
      
      console.log('\n💡 Create with: kit workflow new <name> --template <type>');
      console.log('   Templates: basic, screener, signal, order');
      console.log('');
    });
}

function getWorkflowTemplate(type: string, name: string): KitWorkflow {
  const base: KitWorkflow = {
    name,
    version: '1.0.0',
    description: `${name} workflow`,
    steps: [],
  };
  
  switch (type) {
    case 'screener':
      return {
        ...base,
        description: 'Screen for trading opportunities',
        args: {
          market: {
            type: 'string',
            description: 'Market to screen',
            default: 'crypto',
            choices: ['crypto', 'forex', 'stocks'],
          },
          minVolume: {
            type: 'number',
            description: 'Minimum 24h volume',
            default: 1000000,
          },
        },
        steps: [
          {
            id: 'screen',
            name: 'Screen Markets',
            action: 'screen',
            config: {
              market: '$args.market',
              filters: {
                volume24h: { gte: '$args.minVolume' },
                change24h: { gte: 5 },
              },
            },
          },
          {
            id: 'analyze',
            name: 'Analyze Results',
            action: 'analyze',
            input: '$screen.results',
            config: {
              indicators: ['RSI', 'MACD', 'Volume'],
            },
          },
          {
            id: 'notify',
            name: 'Send Results',
            action: 'notify',
            input: '$analyze',
            when: '$screen.count > 0',
            config: {
              message: 'Found ${screen.count} opportunities',
            },
          },
        ],
      };
      
    case 'signal':
      return {
        ...base,
        description: 'Generate trading signals',
        args: {
          asset: {
            type: 'asset',
            description: 'Asset to analyze',
            default: 'BTC/USDT',
          },
          timeframe: {
            type: 'timeframe',
            description: 'Timeframe',
            default: '1h',
          },
        },
        steps: [
          {
            id: 'analyze',
            name: 'Technical Analysis',
            action: 'analyze',
            config: {
              asset: '$args.asset',
              timeframe: '$args.timeframe',
              indicators: ['RSI', 'MACD', 'EMA', 'Volume'],
            },
          },
          {
            id: 'signal',
            name: 'Generate Signal',
            action: 'signal',
            input: '$analyze',
            config: {
              strategy: 'multi-indicator',
              minConfidence: 0.7,
            },
          },
          {
            id: 'approve',
            name: 'Review Signal',
            action: 'approve',
            input: '$signal',
            approval: 'required',
            approvalPrompt: 'Execute this signal?',
          },
          {
            id: 'alert',
            name: 'Send Alert',
            action: 'alert',
            input: '$signal',
            when: '$approve.approved',
            config: {
              channels: ['telegram', 'discord'],
            },
          },
        ],
      };
      
    case 'order':
      return {
        ...base,
        description: 'Automated order workflow',
        args: {
          asset: {
            type: 'asset',
            description: 'Asset to trade',
            required: true,
          },
          side: {
            type: 'string',
            description: 'Buy or sell',
            choices: ['buy', 'sell'],
            required: true,
          },
          amount: {
            type: 'number',
            description: 'Trade amount',
            required: true,
          },
        },
        settings: {
          stopOnError: true,
          dryRun: true,  // Safe by default
        },
        steps: [
          {
            id: 'analyze',
            name: 'Pre-trade Analysis',
            action: 'analyze',
            config: {
              asset: '$args.asset',
              timeframe: '15m',
            },
          },
          {
            id: 'approve',
            name: 'Confirm Trade',
            action: 'approve',
            approval: 'required',
            approvalPrompt: 'Execute ${args.side} ${args.amount} ${args.asset}?',
          },
          {
            id: 'order',
            name: 'Execute Order',
            action: 'order',
            when: '$approve.approved',
            config: {
              asset: '$args.asset',
              side: '$args.side',
              amount: '$args.amount',
              type: 'market',
            },
          },
          {
            id: 'log',
            name: 'Log Trade',
            action: 'log',
            input: '$order',
            config: {
              journal: true,
            },
          },
          {
            id: 'notify',
            name: 'Trade Notification',
            action: 'notify',
            input: '$order',
            config: {
              message: 'Trade executed: ${args.side} ${args.amount} ${args.asset}',
            },
          },
        ],
      };
      
    default: // basic
      return {
        ...base,
        steps: [
          {
            id: 'start',
            name: 'Start',
            action: 'log',
            config: {
              message: 'Workflow started',
            },
          },
          {
            id: 'approve',
            name: 'Approval Gate',
            action: 'approve',
            approval: 'required',
            approvalPrompt: 'Continue workflow?',
          },
          {
            id: 'complete',
            name: 'Complete',
            action: 'notify',
            when: '$approve.approved',
            config: {
              message: 'Workflow completed',
            },
          },
        ],
      };
  }
}
