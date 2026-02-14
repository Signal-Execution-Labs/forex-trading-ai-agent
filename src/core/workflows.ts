/**
 * K.I.T. Workflow System
 * 
 * Trading-specific workflow runtime similar to Lobster/OpenProse.
 * Supports .kit workflow files with approval gates and resume tokens.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Logger } from './logger.js';
import { getKitHome } from '../config/index.js';

// Helper to get state directory (same as KIT_HOME)
function getStateDir(): string {
  return getKitHome();
}

const logger = new Logger('workflows');

// Workflow file format (.kit)
export interface KitWorkflow {
  name: string;
  version?: string;
  description?: string;
  author?: string;
  
  // Input parameters
  args?: {
    [key: string]: {
      type: 'string' | 'number' | 'boolean' | 'asset' | 'timeframe';
      description?: string;
      default?: unknown;
      required?: boolean;
      choices?: unknown[];
    };
  };
  
  // Environment variables
  env?: {
    [key: string]: string;
  };
  
  // Workflow steps
  steps: WorkflowStep[];
  
  // Global settings
  settings?: {
    timeout?: number;       // Total timeout in seconds
    stopOnError?: boolean;  // Stop on first error
    parallel?: boolean;     // Run independent steps in parallel
    dryRun?: boolean;       // Don't execute trades
  };
}

export interface WorkflowStep {
  id: string;
  name?: string;
  
  // Action type
  action: 
    | 'analyze'       // Run technical analysis
    | 'screen'        // Screen for opportunities
    | 'signal'        // Generate trading signal
    | 'order'         // Place order
    | 'close'         // Close position
    | 'alert'         // Send alert
    | 'wait'          // Wait for condition
    | 'approve'       // Request human approval
    | 'notify'        // Send notification
    | 'log'           // Log to journal
    | 'exec'          // Execute shell command
    | 'llm'           // LLM analysis step
    | 'condition';    // Conditional branch
  
  // Step-specific config
  config?: Record<string, unknown>;
  
  // Input from previous step
  input?: string;  // e.g., "$screen.results" or "$analyze.signals"
  
  // Condition for execution
  when?: string;   // e.g., "$screen.count > 0" or "$approve.approved"
  
  // Approval requirement
  approval?: 'required' | 'optional' | 'none';
  approvalPrompt?: string;
  
  // Error handling
  onError?: 'stop' | 'continue' | 'retry';
  retries?: number;
  
  // Timeout for this step
  timeout?: number;
}

export interface WorkflowRun {
  id: string;
  workflowName: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Input args
  args: Record<string, unknown>;
  
  // Step results
  results: {
    [stepId: string]: {
      status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'approved' | 'rejected';
      output?: unknown;
      error?: string;
      startedAt?: string;
      completedAt?: string;
      approved?: boolean;
    };
  };
  
  // Resume token for paused workflows
  resumeToken?: string;
  pendingApproval?: {
    stepId: string;
    prompt: string;
    preview?: unknown;
  };
}

export interface WorkflowResult {
  ok: boolean;
  status: 'completed' | 'needs_approval' | 'failed' | 'cancelled';
  runId: string;
  output?: unknown;
  error?: string;
  
  // If paused for approval
  requiresApproval?: {
    stepId: string;
    prompt: string;
    preview?: unknown;
    resumeToken: string;
  };
}

/**
 * Workflow Engine - executes .kit workflow files
 */
export class WorkflowEngine {
  private runsDir: string;
  private workflowsDir: string;
  
  constructor() {
    const stateDir = getStateDir();
    this.runsDir = path.join(stateDir, 'workflows', 'runs');
    this.workflowsDir = path.join(stateDir, 'workflows', 'library');
    
    // Ensure directories exist
    if (!fs.existsSync(this.runsDir)) {
      fs.mkdirSync(this.runsDir, { recursive: true });
    }
    if (!fs.existsSync(this.workflowsDir)) {
      fs.mkdirSync(this.workflowsDir, { recursive: true });
    }
  }
  
  /**
   * Load a workflow from file
   */
  loadWorkflow(filePath: string): KitWorkflow {
    const fullPath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.workflowsDir, filePath);
    
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Workflow not found: ${fullPath}`);
    }
    
    const content = fs.readFileSync(fullPath, 'utf-8');
    const ext = path.extname(fullPath).toLowerCase();
    
    if (ext === '.json') {
      return JSON.parse(content) as KitWorkflow;
    } else if (ext === '.kit' || ext === '.yaml' || ext === '.yml') {
      // Simple YAML-like parsing for .kit files
      return this.parseKitFile(content);
    } else {
      throw new Error(`Unsupported workflow format: ${ext}`);
    }
  }
  
  /**
   * Parse a .kit workflow file
   */
  private parseKitFile(content: string): KitWorkflow {
    // For now, treat .kit as JSON. In future, add YAML support.
    try {
      return JSON.parse(content) as KitWorkflow;
    } catch {
      throw new Error('Invalid .kit file format. Expected JSON.');
    }
  }
  
  /**
   * Run a workflow
   */
  async run(
    workflow: KitWorkflow | string,
    args: Record<string, unknown> = {},
    options: { dryRun?: boolean } = {}
  ): Promise<WorkflowResult> {
    // Load workflow if string path
    const wf = typeof workflow === 'string' 
      ? this.loadWorkflow(workflow)
      : workflow;
    
    // Validate and merge args with defaults
    const mergedArgs = this.validateArgs(wf, args);
    
    // Create run record
    const run: WorkflowRun = {
      id: this.generateRunId(),
      workflowName: wf.name,
      status: 'running',
      currentStep: 0,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      args: mergedArgs,
      results: {},
    };
    
    // Save initial state
    this.saveRun(run);
    
    logger.info(`Starting workflow: ${wf.name} (${run.id})`);
    
    // Execute steps
    try {
      for (let i = 0; i < wf.steps.length; i++) {
        run.currentStep = i;
        run.updatedAt = new Date().toISOString();
        this.saveRun(run);
        
        const step = wf.steps[i];
        const result = await this.executeStep(step, run, wf, options);
        
        run.results[step.id] = result;
        
        // Check if approval needed
        if (result.status === 'approved' && step.approval === 'required') {
          // Workflow pauses for approval
          run.status = 'paused';
          run.resumeToken = this.generateResumeToken(run.id, step.id);
          run.pendingApproval = {
            stepId: step.id,
            prompt: step.approvalPrompt || `Approve step: ${step.name || step.id}?`,
            preview: result.output,
          };
          
          this.saveRun(run);
          
          return {
            ok: true,
            status: 'needs_approval',
            runId: run.id,
            output: this.collectOutput(run),
            requiresApproval: {
              stepId: step.id,
              prompt: run.pendingApproval.prompt,
              preview: run.pendingApproval.preview,
              resumeToken: run.resumeToken,
            },
          };
        }
        
        // Check for errors
        if (result.status === 'failed') {
          if (step.onError === 'stop' || wf.settings?.stopOnError !== false) {
            run.status = 'failed';
            run.completedAt = new Date().toISOString();
            this.saveRun(run);
            
            return {
              ok: false,
              status: 'failed',
              runId: run.id,
              error: result.error,
              output: this.collectOutput(run),
            };
          }
        }
      }
      
      // Workflow completed
      run.status = 'completed';
      run.completedAt = new Date().toISOString();
      this.saveRun(run);
      
      return {
        ok: true,
        status: 'completed',
        runId: run.id,
        output: this.collectOutput(run),
      };
      
    } catch (error) {
      run.status = 'failed';
      run.completedAt = new Date().toISOString();
      this.saveRun(run);
      
      return {
        ok: false,
        status: 'failed',
        runId: run.id,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  
  /**
   * Resume a paused workflow
   */
  async resume(resumeToken: string, approve: boolean): Promise<WorkflowResult> {
    const { runId, stepId } = this.parseResumeToken(resumeToken);
    
    const run = this.loadRun(runId);
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }
    
    if (run.status !== 'paused') {
      throw new Error(`Run is not paused: ${run.status}`);
    }
    
    // Update approval status
    if (run.results[stepId]) {
      run.results[stepId].approved = approve;
      run.results[stepId].status = approve ? 'approved' : 'rejected';
    }
    
    if (!approve) {
      run.status = 'cancelled';
      run.completedAt = new Date().toISOString();
      run.pendingApproval = undefined;
      run.resumeToken = undefined;
      this.saveRun(run);
      
      return {
        ok: false,
        status: 'cancelled',
        runId: run.id,
        output: this.collectOutput(run),
      };
    }
    
    // Clear approval state
    run.pendingApproval = undefined;
    run.resumeToken = undefined;
    run.status = 'running';
    this.saveRun(run);
    
    // Continue from next step
    const workflow = this.findWorkflowByName(run.workflowName);
    if (!workflow) {
      throw new Error(`Workflow not found: ${run.workflowName}`);
    }
    
    const stepIndex = workflow.steps.findIndex(s => s.id === stepId);
    if (stepIndex === -1) {
      throw new Error(`Step not found: ${stepId}`);
    }
    
    // Continue execution from next step
    for (let i = stepIndex + 1; i < workflow.steps.length; i++) {
      run.currentStep = i;
      run.updatedAt = new Date().toISOString();
      this.saveRun(run);
      
      const step = workflow.steps[i];
      const result = await this.executeStep(step, run, workflow, {});
      
      run.results[step.id] = result;
      
      if (result.status === 'approved' && step.approval === 'required') {
        run.status = 'paused';
        run.resumeToken = this.generateResumeToken(run.id, step.id);
        run.pendingApproval = {
          stepId: step.id,
          prompt: step.approvalPrompt || `Approve step: ${step.name || step.id}?`,
          preview: result.output,
        };
        
        this.saveRun(run);
        
        return {
          ok: true,
          status: 'needs_approval',
          runId: run.id,
          output: this.collectOutput(run),
          requiresApproval: {
            stepId: step.id,
            prompt: run.pendingApproval.prompt,
            preview: run.pendingApproval.preview,
            resumeToken: run.resumeToken,
          },
        };
      }
      
      if (result.status === 'failed') {
        if (step.onError === 'stop' || workflow.settings?.stopOnError !== false) {
          run.status = 'failed';
          run.completedAt = new Date().toISOString();
          this.saveRun(run);
          
          return {
            ok: false,
            status: 'failed',
            runId: run.id,
            error: result.error,
            output: this.collectOutput(run),
          };
        }
      }
    }
    
    run.status = 'completed';
    run.completedAt = new Date().toISOString();
    this.saveRun(run);
    
    return {
      ok: true,
      status: 'completed',
      runId: run.id,
      output: this.collectOutput(run),
    };
  }
  
  /**
   * Execute a single workflow step
   */
  private async executeStep(
    step: WorkflowStep,
    run: WorkflowRun,
    workflow: KitWorkflow,
    options: { dryRun?: boolean }
  ): Promise<WorkflowRun['results'][string]> {
    const startedAt = new Date().toISOString();
    
    logger.debug(`Executing step: ${step.id} (${step.action})`);
    
    // Check condition
    if (step.when) {
      const conditionMet = this.evaluateCondition(step.when, run);
      if (!conditionMet) {
        return {
          status: 'skipped',
          startedAt,
          completedAt: new Date().toISOString(),
        };
      }
    }
    
    // Get input from previous step if specified
    let input: unknown = undefined;
    if (step.input) {
      input = this.resolveReference(step.input, run);
    }
    
    try {
      // Execute based on action type
      let output: unknown;
      
      switch (step.action) {
        case 'analyze':
          output = await this.executeAnalyze(step, input, options);
          break;
        case 'screen':
          output = await this.executeScreen(step, input, options);
          break;
        case 'signal':
          output = await this.executeSignal(step, input, options);
          break;
        case 'order':
          output = await this.executeOrder(step, input, options);
          break;
        case 'close':
          output = await this.executeClose(step, input, options);
          break;
        case 'alert':
          output = await this.executeAlert(step, input, options);
          break;
        case 'wait':
          output = await this.executeWait(step, input, options);
          break;
        case 'approve':
          // Return early - needs human approval
          return {
            status: 'approved',
            output: input || step.config,
            startedAt,
          };
        case 'notify':
          output = await this.executeNotify(step, input, options);
          break;
        case 'log':
          output = await this.executeLog(step, input, options);
          break;
        case 'exec':
          output = await this.executeExec(step, input, options);
          break;
        case 'llm':
          output = await this.executeLLM(step, input, options);
          break;
        case 'condition':
          output = await this.executeCondition(step, input, options);
          break;
        default:
          throw new Error(`Unknown action: ${step.action}`);
      }
      
      return {
        status: 'completed',
        output,
        startedAt,
        completedAt: new Date().toISOString(),
      };
      
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        startedAt,
        completedAt: new Date().toISOString(),
      };
    }
  }
  
  // Step executors
  private async executeAnalyze(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    // Placeholder - integrate with analysis tools
    return {
      action: 'analyze',
      asset: config.asset || 'BTC/USDT',
      timeframe: config.timeframe || '1h',
      indicators: config.indicators || ['RSI', 'MACD', 'EMA'],
      result: {
        trend: 'bullish',
        strength: 0.72,
        signals: [],
      },
    };
  }
  
  private async executeScreen(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    return {
      action: 'screen',
      criteria: config.criteria || {},
      results: [],
      count: 0,
    };
  }
  
  private async executeSignal(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    return {
      action: 'signal',
      type: 'buy',
      asset: 'BTC/USDT',
      confidence: 0.85,
      entry: 42000,
      stopLoss: 41000,
      takeProfit: 44000,
    };
  }
  
  private async executeOrder(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    if (options.dryRun) {
      return { action: 'order', dryRun: true, wouldExecute: input };
    }
    // Placeholder - integrate with trading execution
    return { action: 'order', status: 'simulated', input };
  }
  
  private async executeClose(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    if (options.dryRun) {
      return { action: 'close', dryRun: true, wouldClose: input };
    }
    return { action: 'close', status: 'simulated', input };
  }
  
  private async executeAlert(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    logger.info(`Alert: ${config.message || 'Alert triggered'}`);
    return { action: 'alert', message: config.message, delivered: true };
  }
  
  private async executeWait(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    const seconds = (config.seconds as number) || 5;
    
    if (!options.dryRun) {
      await new Promise(resolve => setTimeout(resolve, seconds * 1000));
    }
    
    return { action: 'wait', seconds, completed: true };
  }
  
  private async executeNotify(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    logger.info(`Notify: ${config.message || JSON.stringify(input)}`);
    return { action: 'notify', message: config.message, delivered: true };
  }
  
  private async executeLog(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    logger.info(`Log: ${config.message || JSON.stringify(input)}`);
    return { action: 'log', logged: true };
  }
  
  private async executeExec(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    if (options.dryRun) {
      return { action: 'exec', dryRun: true, command: config.command };
    }
    // Placeholder - would execute shell command
    return { action: 'exec', command: config.command, output: '' };
  }
  
  private async executeLLM(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    // Placeholder - would call LLM
    return {
      action: 'llm',
      prompt: config.prompt,
      model: config.model || 'default',
      response: 'LLM response placeholder',
    };
  }
  
  private async executeCondition(step: WorkflowStep, input: unknown, options: { dryRun?: boolean }): Promise<unknown> {
    const config = step.config || {};
    return {
      action: 'condition',
      condition: config.condition,
      result: true,
    };
  }
  
  // Helper methods
  private validateArgs(workflow: KitWorkflow, args: Record<string, unknown>): Record<string, unknown> {
    const merged: Record<string, unknown> = {};
    
    if (workflow.args) {
      for (const [key, spec] of Object.entries(workflow.args)) {
        if (args[key] !== undefined) {
          merged[key] = args[key];
        } else if (spec.default !== undefined) {
          merged[key] = spec.default;
        } else if (spec.required) {
          throw new Error(`Missing required argument: ${key}`);
        }
      }
    }
    
    // Pass through extra args
    for (const [key, value] of Object.entries(args)) {
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
    
    return merged;
  }
  
  private evaluateCondition(condition: string, run: WorkflowRun): boolean {
    // Simple condition evaluation
    // Supports: $step.field > value, $step.approved, etc.
    
    try {
      const resolved = condition.replace(/\$(\w+)\.(\w+)/g, (_, stepId, field) => {
        const result = run.results[stepId];
        if (!result) return 'undefined';
        
        if (field === 'approved') return String(result.approved);
        if (field === 'status') return `"${result.status}"`;
        
        const output = result.output as Record<string, unknown>;
        return JSON.stringify(output?.[field] ?? undefined);
      });
      
      // Safe eval using Function
      return new Function(`return ${resolved}`)();
    } catch {
      return false;
    }
  }
  
  private resolveReference(ref: string, run: WorkflowRun): unknown {
    // Resolve $step.field references
    const match = ref.match(/^\$(\w+)(?:\.(\w+))?$/);
    if (!match) return ref;
    
    const [, stepId, field] = match;
    const result = run.results[stepId];
    
    if (!result) return undefined;
    if (!field) return result.output;
    
    const output = result.output as Record<string, unknown>;
    return output?.[field];
  }
  
  private collectOutput(run: WorkflowRun): unknown {
    const output: Record<string, unknown> = {};
    
    for (const [stepId, result] of Object.entries(run.results)) {
      if (result.output !== undefined) {
        output[stepId] = result.output;
      }
    }
    
    return output;
  }
  
  private generateRunId(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const timeStr = date.toISOString().slice(11, 19).replace(/:/g, '');
    const random = crypto.randomBytes(4).toString('hex');
    return `${dateStr}-${timeStr}-${random}`;
  }
  
  private generateResumeToken(runId: string, stepId: string): string {
    const data = { runId, stepId, ts: Date.now() };
    return Buffer.from(JSON.stringify(data)).toString('base64url');
  }
  
  private parseResumeToken(token: string): { runId: string; stepId: string } {
    const data = JSON.parse(Buffer.from(token, 'base64url').toString());
    return { runId: data.runId, stepId: data.stepId };
  }
  
  private saveRun(run: WorkflowRun): void {
    const filePath = path.join(this.runsDir, `${run.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(run, null, 2));
  }
  
  private loadRun(runId: string): WorkflowRun | null {
    const filePath = path.join(this.runsDir, `${runId}.json`);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }
  
  private findWorkflowByName(name: string): KitWorkflow | null {
    // Search in workflows directory
    const files = fs.readdirSync(this.workflowsDir);
    for (const file of files) {
      if (file.endsWith('.kit') || file.endsWith('.json')) {
        try {
          const workflow = this.loadWorkflow(path.join(this.workflowsDir, file));
          if (workflow.name === name) return workflow;
        } catch {
          // Skip invalid files
        }
      }
    }
    return null;
  }
  
  /**
   * List available workflows
   */
  listWorkflows(): { name: string; path: string; description?: string }[] {
    const workflows: { name: string; path: string; description?: string }[] = [];
    
    if (!fs.existsSync(this.workflowsDir)) return workflows;
    
    const files = fs.readdirSync(this.workflowsDir);
    for (const file of files) {
      if (file.endsWith('.kit') || file.endsWith('.json')) {
        try {
          const workflow = this.loadWorkflow(path.join(this.workflowsDir, file));
          workflows.push({
            name: workflow.name,
            path: file,
            description: workflow.description,
          });
        } catch {
          // Skip invalid files
        }
      }
    }
    
    return workflows;
  }
  
  /**
   * Get run history
   */
  listRuns(limit: number = 20): WorkflowRun[] {
    if (!fs.existsSync(this.runsDir)) return [];
    
    const files = fs.readdirSync(this.runsDir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);
    
    return files.map(f => {
      const content = fs.readFileSync(path.join(this.runsDir, f), 'utf-8');
      return JSON.parse(content) as WorkflowRun;
    });
  }
}

// Singleton instance
let workflowEngine: WorkflowEngine | null = null;

export function getWorkflowEngine(): WorkflowEngine {
  if (!workflowEngine) {
    workflowEngine = new WorkflowEngine();
  }
  return workflowEngine;
}
