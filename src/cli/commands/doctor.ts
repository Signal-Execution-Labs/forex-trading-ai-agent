/**
 * K.I.T. Doctor - Comprehensive Diagnostics
 * 
 * Inspired by OpenClaw's diagnostics system
 */

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const KIT_HOME = path.join(os.homedir(), '.kit');

interface DiagnosticResult {
  name: string;
  status: 'pass' | 'warn' | 'fail' | 'skip';
  message: string;
  details?: string[];
  fix?: string;
}

export function createDoctorCommand(): Command {
  const cmd = new Command('doctor')
    .description('Comprehensive system diagnostics and troubleshooting')
    .option('-v, --verbose', 'Show detailed output for all checks')
    .option('-f, --fix', 'Attempt to auto-fix issues where possible')
    .option('--json', 'Output results as JSON')
    .option('--category <cat>', 'Run specific category (system, ai, trading, network)')
    .action(async (options) => {
      const results: DiagnosticResult[] = [];
      
      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    🔍 K.I.T. Doctor                            ║
║              Comprehensive System Diagnostics                  ║
╚═══════════════════════════════════════════════════════════════╝
`);
      
      const category = options.category?.toLowerCase();
      
      // ═══════════════════════════════════════════════════════════
      // SYSTEM CHECKS
      // ═══════════════════════════════════════════════════════════
      if (!category || category === 'system') {
        console.log('📦 SYSTEM\n');
        
        // Node.js version
        const nodeVersion = process.version;
        const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0], 10);
        if (nodeMajor >= 18) {
          results.push({ name: 'Node.js', status: 'pass', message: `${nodeVersion} (required: ≥18)` });
          console.log(`   ✅ Node.js: ${nodeVersion}`);
        } else {
          results.push({ name: 'Node.js', status: 'fail', message: `${nodeVersion} (required: ≥18)`, fix: 'Upgrade Node.js to v18 or newer' });
          console.log(`   ❌ Node.js: ${nodeVersion} (too old, need ≥18)`);
        }
        
        // Python (for MT5)
        const isWindows = os.platform() === 'win32';
        const pythonCmd = isWindows ? 'python' : 'python3';
        try {
          const { execSync } = await import('child_process');
          const pyVersion = execSync(`${pythonCmd} --version`, { encoding: 'utf8' }).trim();
          results.push({ name: 'Python', status: 'pass', message: pyVersion });
          console.log(`   ✅ Python: ${pyVersion}`);
          
          // Check MT5 package (Windows only)
          if (isWindows) {
            try {
              execSync(`${pythonCmd} -c "import MetaTrader5"`, { stdio: 'pipe' });
              results.push({ name: 'MetaTrader5', status: 'pass', message: 'Python package installed' });
              console.log('   ✅ MetaTrader5: Python package installed');
            } catch {
              results.push({ 
                name: 'MetaTrader5', 
                status: 'warn', 
                message: 'Not installed', 
                fix: 'pip install MetaTrader5' 
              });
              console.log('   ⚠️  MetaTrader5: Not installed (pip install MetaTrader5)');
            }
          }
        } catch {
          results.push({ name: 'Python', status: 'warn', message: 'Not found', fix: 'Install Python 3.8+' });
          console.log('   ⚠️  Python: Not found (optional, needed for MT5)');
        }
        
        // Disk space
        try {
          const stats = fs.statfsSync(KIT_HOME);
          const freeGB = (stats.bsize * stats.bfree) / (1024 ** 3);
          if (freeGB > 1) {
            results.push({ name: 'Disk Space', status: 'pass', message: `${freeGB.toFixed(1)} GB free` });
            console.log(`   ✅ Disk Space: ${freeGB.toFixed(1)} GB free`);
          } else {
            results.push({ name: 'Disk Space', status: 'warn', message: `${freeGB.toFixed(1)} GB free (low)` });
            console.log(`   ⚠️  Disk Space: ${freeGB.toFixed(1)} GB free (low)`);
          }
        } catch {
          results.push({ name: 'Disk Space', status: 'skip', message: 'Could not check' });
        }
        
        // Memory
        const totalMemGB = os.totalmem() / (1024 ** 3);
        const freeMemGB = os.freemem() / (1024 ** 3);
        const memUsage = ((totalMemGB - freeMemGB) / totalMemGB * 100).toFixed(0);
        if (freeMemGB > 0.5) {
          results.push({ name: 'Memory', status: 'pass', message: `${freeMemGB.toFixed(1)} GB free (${memUsage}% used)` });
          console.log(`   ✅ Memory: ${freeMemGB.toFixed(1)} GB free (${memUsage}% used)`);
        } else {
          results.push({ name: 'Memory', status: 'warn', message: `${freeMemGB.toFixed(1)} GB free (${memUsage}% used)` });
          console.log(`   ⚠️  Memory: ${freeMemGB.toFixed(1)} GB free (high usage)`);
        }
        
        console.log('');
      }
      
      // ═══════════════════════════════════════════════════════════
      // CONFIGURATION CHECKS
      // ═══════════════════════════════════════════════════════════
      if (!category || category === 'config' || category === 'system') {
        console.log('⚙️  CONFIGURATION\n');
        
        // Config file
        const configPath = path.join(KIT_HOME, 'config.json');
        let config: any = null;
        
        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            results.push({ name: 'Config File', status: 'pass', message: configPath });
            console.log(`   ✅ Config: Found (${configPath})`);
            
            // Validate config structure
            const requiredKeys = ['ai', 'gateway'];
            const missingKeys = requiredKeys.filter(k => !config[k]);
            if (missingKeys.length > 0) {
              results.push({ name: 'Config Structure', status: 'warn', message: `Missing: ${missingKeys.join(', ')}` });
              console.log(`   ⚠️  Config Structure: Missing keys: ${missingKeys.join(', ')}`);
            } else {
              results.push({ name: 'Config Structure', status: 'pass', message: 'Valid' });
              console.log('   ✅ Config Structure: Valid');
            }
          } catch (err) {
            results.push({ name: 'Config File', status: 'fail', message: 'Invalid JSON', fix: 'Check config.json for syntax errors' });
            console.log('   ❌ Config: Invalid JSON (syntax error)');
          }
        } else {
          results.push({ name: 'Config File', status: 'fail', message: 'Not found', fix: 'Run: kit onboard' });
          console.log('   ❌ Config: Not found (run: kit onboard)');
        }
        
        // Workspace
        const workspacePath = path.join(KIT_HOME, 'workspace');
        if (fs.existsSync(workspacePath)) {
          results.push({ name: 'Workspace', status: 'pass', message: workspacePath });
          console.log(`   ✅ Workspace: Found`);
          
          // Check workspace files
          const workspaceFiles = ['SOUL.md', 'USER.md', 'AGENTS.md', 'MEMORY.md'];
          const foundFiles = workspaceFiles.filter(f => fs.existsSync(path.join(workspacePath, f)));
          const missingFiles = workspaceFiles.filter(f => !fs.existsSync(path.join(workspacePath, f)));
          
          if (missingFiles.length === 0) {
            results.push({ name: 'Workspace Files', status: 'pass', message: `All ${workspaceFiles.length} files present` });
            console.log(`   ✅ Workspace Files: All ${workspaceFiles.length} files present`);
          } else {
            results.push({ name: 'Workspace Files', status: 'warn', message: `Missing: ${missingFiles.join(', ')}` });
            console.log(`   ⚠️  Workspace Files: Missing: ${missingFiles.join(', ')}`);
            
            if (options.fix) {
              console.log('      🔧 Auto-fixing: Creating missing files...');
              for (const file of missingFiles) {
                const filePath = path.join(workspacePath, file);
                const templates: Record<string, string> = {
                  'SOUL.md': '# K.I.T. Soul\n\nI am K.I.T., your AI Financial Agent.\n',
                  'USER.md': '# User Profile\n\n- Name: User\n- Risk Tolerance: Medium\n',
                  'AGENTS.md': '# Agents Configuration\n\nThis is K.I.T. workspace.\n',
                  'MEMORY.md': '# K.I.T. Memory\n\n## Recent Events\n\n',
                };
                fs.writeFileSync(filePath, templates[file] || `# ${file}\n`);
                console.log(`         ✅ Created ${file}`);
              }
            }
          }
        } else {
          results.push({ name: 'Workspace', status: 'fail', message: 'Not found', fix: 'Run: kit onboard' });
          console.log('   ❌ Workspace: Not found (run: kit onboard)');
        }
        
        // Onboarding status
        const onboardingPath = path.join(KIT_HOME, 'onboarding.json');
        if (fs.existsSync(onboardingPath)) {
          try {
            const onboarding = JSON.parse(fs.readFileSync(onboardingPath, 'utf8'));
            if (onboarding.completed) {
              results.push({ name: 'Onboarding', status: 'pass', message: 'Completed' });
              console.log('   ✅ Onboarding: Completed');
            } else {
              results.push({ name: 'Onboarding', status: 'warn', message: `Step ${onboarding.currentStep || '?'} of 13` });
              console.log(`   ⚠️  Onboarding: Incomplete (step ${onboarding.currentStep || '?'}/13)`);
            }
          } catch {
            results.push({ name: 'Onboarding', status: 'warn', message: 'Corrupted state file' });
          }
        }
        
        console.log('');
      }
      
      // ═══════════════════════════════════════════════════════════
      // AI PROVIDER CHECKS
      // ═══════════════════════════════════════════════════════════
      if (!category || category === 'ai') {
        console.log('🧠 AI PROVIDERS\n');
        
        const configPath = path.join(KIT_HOME, 'config.json');
        let config: any = null;
        
        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch {}
        }
        
        if (!config?.ai) {
          results.push({ name: 'AI Config', status: 'fail', message: 'No AI configuration found' });
          console.log('   ❌ No AI configuration found');
        } else {
          // Support both config formats: simple (provider/model) and advanced (defaultProvider/providers)
          const defaultProvider = config.ai.defaultProvider || config.ai.provider;
          const defaultModel = config.ai.defaultModel || config.ai.model;
          const providers = config.ai.providers || {};
          
          console.log(`   Default: ${defaultProvider || 'none'}`);
          console.log(`   Model: ${defaultModel || 'default'}\n`);
          
          // Check environment variables for API keys
          const envKeys: Record<string, string | undefined> = {
            openai: process.env.OPENAI_API_KEY,
            anthropic: process.env.ANTHROPIC_API_KEY,
            google: process.env.GOOGLE_API_KEY,
            openrouter: process.env.OPENROUTER_API_KEY,
            groq: process.env.GROQ_API_KEY,
            xai: process.env.XAI_API_KEY,
            mistral: process.env.MISTRAL_API_KEY,
            deepseek: process.env.DEEPSEEK_API_KEY,
          };
          
          // If using simple config format, check env var for that provider
          if (defaultProvider && !Object.keys(providers).length) {
            const envKey = envKeys[defaultProvider];
            if (envKey) {
              results.push({ name: `AI: ${defaultProvider}`, status: 'pass', message: 'API key from environment' });
              console.log(`   ✅ ${defaultProvider}: API key configured (from ENV)`);
            } else {
              results.push({ name: `AI: ${defaultProvider}`, status: 'warn', message: 'No API key found', fix: `Set ${defaultProvider.toUpperCase()}_API_KEY environment variable` });
              console.log(`   ⚠️  ${defaultProvider}: No API key (set ${defaultProvider.toUpperCase()}_API_KEY)`);
            }
          } else {
            // Check each configured provider
            for (const [name, providerConfig] of Object.entries(providers) as [string, any][]) {
              const configKey = providerConfig?.apiKey;
              const envKey = envKeys[name];
              const hasKey = !!(configKey || envKey);
              const keySource = configKey ? 'config' : (envKey ? 'ENV' : 'none');
              const keyPreview = configKey ? `${configKey.substring(0, 8)}...` : (envKey ? `${envKey.substring(0, 8)}...` : 'not set');
              
              if (hasKey) {
                results.push({ name: `AI: ${name}`, status: 'pass', message: `API key from ${keySource}` });
                console.log(`   ✅ ${name}: API key configured (${keyPreview} from ${keySource})`);
                
                // Validate key format
                const key = configKey || envKey || '';
                let keyValid = true;
                let keyFormat = '';
                
                if (name === 'anthropic' && !key.startsWith('sk-ant-')) {
                  keyValid = false;
                  keyFormat = 'Expected: sk-ant-...';
                } else if (name === 'openai' && !key.startsWith('sk-')) {
                  keyValid = false;
                  keyFormat = 'Expected: sk-...';
                } else if (name === 'google' && !key.startsWith('AIza')) {
                  keyValid = false;
                  keyFormat = 'Expected: AIza...';
                }
                
                if (!keyValid && options.verbose) {
                  console.log(`      ⚠️  Key format looks unusual. ${keyFormat}`);
                }
              } else {
                results.push({ name: `AI: ${name}`, status: 'warn', message: 'No API key' });
                console.log(`   ⚠️  ${name}: No API key configured`);
              }
            }
          }
          
          // Check if default provider has API key (from config or env)
          if (defaultProvider) {
            const providerKey = providers[defaultProvider]?.apiKey || envKeys[defaultProvider];
            if (!providerKey) {
              console.log(`\n   ⚠️  Default provider "${defaultProvider}" has no API key!`);
              console.log(`      Set ${defaultProvider.toUpperCase()}_API_KEY environment variable`);
            }
          }
        }
        
        console.log('');
      }
      
      // ═══════════════════════════════════════════════════════════
      // TRADING CHECKS
      // ═══════════════════════════════════════════════════════════
      if (!category || category === 'trading') {
        console.log('📈 TRADING\n');
        
        const configPath = path.join(KIT_HOME, 'config.json');
        let config: any = null;
        
        if (fs.existsSync(configPath)) {
          try {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          } catch {}
        }
        
        const exchanges = config?.exchanges || {};
        const exchangeCount = Object.keys(exchanges).length;
        
        if (exchangeCount === 0) {
          results.push({ name: 'Exchanges', status: 'warn', message: 'None configured' });
          console.log('   ⚠️  Exchanges: None configured');
          console.log('      Add exchanges in kit onboard or config.json');
        } else {
          console.log(`   📊 ${exchangeCount} exchange(s) configured:\n`);
          
          for (const [id, ex] of Object.entries(exchanges) as [string, any][]) {
            const enabled = ex.enabled !== false;
            const type = ex.type || 'crypto';
            const hasCredentials = !!(ex.apiKey || ex.login);
            
            const status = enabled && hasCredentials ? '✅' : '⚠️';
            const issues: string[] = [];
            
            if (!enabled) issues.push('disabled');
            if (!hasCredentials) issues.push('no credentials');
            
            results.push({ 
              name: `Exchange: ${id}`, 
              status: enabled && hasCredentials ? 'pass' : 'warn',
              message: `${type} - ${issues.length ? issues.join(', ') : 'ready'}`
            });
            
            console.log(`   ${status} ${id} (${type})${issues.length ? ` - ${issues.join(', ')}` : ''}`);
          }
        }
        
        // Check for skills
        const skillsDir = path.join(__dirname, '../../../skills');
        if (fs.existsSync(skillsDir)) {
          const skills = fs.readdirSync(skillsDir).filter(f => 
            fs.statSync(path.join(skillsDir, f)).isDirectory()
          );
          results.push({ name: 'Skills', status: 'pass', message: `${skills.length} skills installed` });
          console.log(`\n   ✅ Skills: ${skills.length} installed`);
        }
        
        console.log('');
      }
      
      // ═══════════════════════════════════════════════════════════
      // NETWORK CHECKS
      // ═══════════════════════════════════════════════════════════
      if (!category || category === 'network') {
        console.log('🌐 NETWORK\n');
        
        // Gateway status
        try {
          const { loadConfig } = await import('../../config');
          const config = loadConfig();
          const ws = await import('ws');
          
          const gatewayUrl = `ws://${config.gateway?.host || '127.0.0.1'}:${config.gateway?.port || 18799}`;
          console.log(`   Gateway URL: ${gatewayUrl}`);
          
          const connected = await new Promise<boolean>((resolve) => {
            const client = new ws.default(gatewayUrl);
            const timeout = setTimeout(() => {
              client.close();
              resolve(false);
            }, 3000);
            
            client.on('open', () => {
              clearTimeout(timeout);
              client.close();
              resolve(true);
            });
            
            client.on('error', () => {
              clearTimeout(timeout);
              resolve(false);
            });
          });
          
          if (connected) {
            results.push({ name: 'Gateway', status: 'pass', message: 'Online' });
            console.log('   ✅ Gateway: Online');
          } else {
            results.push({ name: 'Gateway', status: 'warn', message: 'Offline', fix: 'Run: kit start' });
            console.log('   ⚠️  Gateway: Offline (run: kit start)');
          }
        } catch (err: any) {
          results.push({ name: 'Gateway', status: 'skip', message: err.message });
          console.log(`   ⚠️  Gateway: ${err.message}`);
        }
        
        // Internet connectivity
        try {
          const https = await import('https');
          const online = await new Promise<boolean>((resolve) => {
            const req = https.get('https://api.anthropic.com', { timeout: 5000 }, () => resolve(true));
            req.on('error', () => resolve(false));
            req.on('timeout', () => { req.destroy(); resolve(false); });
          });
          
          if (online) {
            results.push({ name: 'Internet', status: 'pass', message: 'Connected' });
            console.log('   ✅ Internet: Connected (API endpoints reachable)');
          } else {
            results.push({ name: 'Internet', status: 'fail', message: 'No connection' });
            console.log('   ❌ Internet: Cannot reach API endpoints');
          }
        } catch {
          results.push({ name: 'Internet', status: 'warn', message: 'Check failed' });
        }
        
        console.log('');
      }
      
      // ═══════════════════════════════════════════════════════════
      // SUMMARY
      // ═══════════════════════════════════════════════════════════
      const passed = results.filter(r => r.status === 'pass').length;
      const warned = results.filter(r => r.status === 'warn').length;
      const failed = results.filter(r => r.status === 'fail').length;
      
      console.log('═'.repeat(60));
      console.log(`
📊 SUMMARY

   ✅ Passed:  ${passed}
   ⚠️  Warnings: ${warned}
   ❌ Failed:  ${failed}
`);
      
      if (options.json) {
        console.log('\n--- JSON Output ---\n');
        console.log(JSON.stringify({ results, summary: { passed, warned, failed } }, null, 2));
      }
      
      // Show fixes for failures
      const fixes = results.filter(r => r.status === 'fail' && r.fix);
      if (fixes.length > 0) {
        console.log('🔧 SUGGESTED FIXES\n');
        for (const fix of fixes) {
          console.log(`   • ${fix.name}: ${fix.fix}`);
        }
        console.log('');
      }
      
      // Final verdict
      if (failed === 0 && warned === 0) {
        console.log('🎉 All checks passed! K.I.T. is healthy.\n');
      } else if (failed === 0) {
        console.log('✨ K.I.T. is functional with minor warnings.\n');
      } else {
        console.log('⚠️  Some issues need attention. See fixes above.\n');
      }
    });
    
  return cmd;
}
