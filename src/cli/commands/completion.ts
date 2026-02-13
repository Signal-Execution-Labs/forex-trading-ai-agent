/**
 * K.I.T. Completion CLI Command
 * 
 * Generate shell completion scripts.
 */

import { Command } from 'commander';

export function registerCompletionCommand(program: Command): void {
  program
    .command('completion')
    .description('Generate shell completion script')
    .option('--shell <shell>', 'Shell type (bash, zsh, fish, powershell)', 'bash')
    .action((options) => {
      switch (options.shell.toLowerCase()) {
        case 'bash':
          console.log(generateBashCompletion());
          break;
        case 'zsh':
          console.log(generateZshCompletion());
          break;
        case 'fish':
          console.log(generateFishCompletion());
          break;
        case 'powershell':
        case 'pwsh':
          console.log(generatePowerShellCompletion());
          break;
        default:
          console.error(`Unknown shell: ${options.shell}`);
          console.log('Supported: bash, zsh, fish, powershell');
          process.exit(1);
      }
    });
}

function generateBashCompletion(): string {
  return `# K.I.T. bash completion
# Add to ~/.bashrc: eval "$(kit completion --shell bash)"

_kit_completions() {
    local cur="\${COMP_WORDS[COMP_CWORD]}"
    local commands="onboard start status dashboard config exchanges balance trade chat skills skill models version test tools reset doctor hooks cron sessions memory logs system channels message update portfolio agent alerts watchlist backtest signals news price diagnostics help"
    
    if [ \${COMP_CWORD} -eq 1 ]; then
        COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
    fi
}

complete -F _kit_completions kit
`;
}

function generateZshCompletion(): string {
  return `# K.I.T. zsh completion
# Add to ~/.zshrc: eval "$(kit completion --shell zsh)"

_kit() {
    local commands=(
        'onboard:Interactive setup wizard'
        'start:Start the gateway'
        'status:Check system status'
        'dashboard:Open dashboard'
        'config:View/edit configuration'
        'exchanges:Manage exchanges'
        'balance:Check portfolio balance'
        'trade:Execute trades'
        'chat:Interactive chat'
        'skills:List trading skills'
        'skill:Install skills from KitHub'
        'models:Manage AI providers'
        'version:Show version'
        'test:Run integration tests'
        'tools:Manage tool profiles'
        'reset:Reset configuration'
        'doctor:Diagnose issues'
        'hooks:Manage hooks'
        'cron:Manage cron jobs'
        'sessions:Manage sessions'
        'memory:Search memory'
        'logs:View logs'
        'system:System info'
        'channels:Manage channels'
        'message:Send messages'
        'update:Update K.I.T.'
        'portfolio:View portfolio'
        'agent:Run agent turn'
        'alerts:Manage alerts'
        'watchlist:Manage watchlist'
        'backtest:Run backtests'
        'signals:Manage signals'
        'news:Market news'
        'price:Get price'
        'diagnostics:Debug logging'
        'help:Show help'
    )
    
    _describe 'command' commands
}

compdef _kit kit
`;
}

function generateFishCompletion(): string {
  return `# K.I.T. fish completion
# Add to ~/.config/fish/completions/kit.fish

complete -c kit -f
complete -c kit -n "__fish_use_subcommand" -a "onboard" -d "Interactive setup wizard"
complete -c kit -n "__fish_use_subcommand" -a "start" -d "Start the gateway"
complete -c kit -n "__fish_use_subcommand" -a "status" -d "Check system status"
complete -c kit -n "__fish_use_subcommand" -a "dashboard" -d "Open dashboard"
complete -c kit -n "__fish_use_subcommand" -a "config" -d "View/edit configuration"
complete -c kit -n "__fish_use_subcommand" -a "exchanges" -d "Manage exchanges"
complete -c kit -n "__fish_use_subcommand" -a "balance" -d "Check portfolio balance"
complete -c kit -n "__fish_use_subcommand" -a "trade" -d "Execute trades"
complete -c kit -n "__fish_use_subcommand" -a "chat" -d "Interactive chat"
complete -c kit -n "__fish_use_subcommand" -a "skills" -d "List trading skills"
complete -c kit -n "__fish_use_subcommand" -a "skill" -d "Install skills from KitHub"
complete -c kit -n "__fish_use_subcommand" -a "models" -d "Manage AI providers"
complete -c kit -n "__fish_use_subcommand" -a "version" -d "Show version"
complete -c kit -n "__fish_use_subcommand" -a "test" -d "Run integration tests"
complete -c kit -n "__fish_use_subcommand" -a "tools" -d "Manage tool profiles"
complete -c kit -n "__fish_use_subcommand" -a "reset" -d "Reset configuration"
complete -c kit -n "__fish_use_subcommand" -a "doctor" -d "Diagnose issues"
complete -c kit -n "__fish_use_subcommand" -a "hooks" -d "Manage hooks"
complete -c kit -n "__fish_use_subcommand" -a "cron" -d "Manage cron jobs"
complete -c kit -n "__fish_use_subcommand" -a "sessions" -d "Manage sessions"
complete -c kit -n "__fish_use_subcommand" -a "memory" -d "Search memory"
complete -c kit -n "__fish_use_subcommand" -a "logs" -d "View logs"
complete -c kit -n "__fish_use_subcommand" -a "system" -d "System info"
complete -c kit -n "__fish_use_subcommand" -a "channels" -d "Manage channels"
complete -c kit -n "__fish_use_subcommand" -a "message" -d "Send messages"
complete -c kit -n "__fish_use_subcommand" -a "update" -d "Update K.I.T."
complete -c kit -n "__fish_use_subcommand" -a "portfolio" -d "View portfolio"
complete -c kit -n "__fish_use_subcommand" -a "agent" -d "Run agent turn"
complete -c kit -n "__fish_use_subcommand" -a "alerts" -d "Manage alerts"
complete -c kit -n "__fish_use_subcommand" -a "watchlist" -d "Manage watchlist"
complete -c kit -n "__fish_use_subcommand" -a "backtest" -d "Run backtests"
complete -c kit -n "__fish_use_subcommand" -a "signals" -d "Manage signals"
complete -c kit -n "__fish_use_subcommand" -a "news" -d "Market news"
complete -c kit -n "__fish_use_subcommand" -a "price" -d "Get price"
complete -c kit -n "__fish_use_subcommand" -a "diagnostics" -d "Debug logging"
complete -c kit -n "__fish_use_subcommand" -a "help" -d "Show help"
`;
}

function generatePowerShellCompletion(): string {
  return `# K.I.T. PowerShell completion
# Add to $PROFILE: . (kit completion --shell powershell)

Register-ArgumentCompleter -Native -CommandName kit -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    
    $commands = @(
        @{Name='onboard'; Description='Interactive setup wizard'}
        @{Name='start'; Description='Start the gateway'}
        @{Name='status'; Description='Check system status'}
        @{Name='dashboard'; Description='Open dashboard'}
        @{Name='config'; Description='View/edit configuration'}
        @{Name='exchanges'; Description='Manage exchanges'}
        @{Name='balance'; Description='Check portfolio balance'}
        @{Name='trade'; Description='Execute trades'}
        @{Name='chat'; Description='Interactive chat'}
        @{Name='skills'; Description='List trading skills'}
        @{Name='skill'; Description='Install skills from KitHub'}
        @{Name='models'; Description='Manage AI providers'}
        @{Name='version'; Description='Show version'}
        @{Name='test'; Description='Run integration tests'}
        @{Name='tools'; Description='Manage tool profiles'}
        @{Name='reset'; Description='Reset configuration'}
        @{Name='doctor'; Description='Diagnose issues'}
        @{Name='hooks'; Description='Manage hooks'}
        @{Name='cron'; Description='Manage cron jobs'}
        @{Name='sessions'; Description='Manage sessions'}
        @{Name='memory'; Description='Search memory'}
        @{Name='logs'; Description='View logs'}
        @{Name='system'; Description='System info'}
        @{Name='channels'; Description='Manage channels'}
        @{Name='message'; Description='Send messages'}
        @{Name='update'; Description='Update K.I.T.'}
        @{Name='portfolio'; Description='View portfolio'}
        @{Name='agent'; Description='Run agent turn'}
        @{Name='alerts'; Description='Manage alerts'}
        @{Name='watchlist'; Description='Manage watchlist'}
        @{Name='backtest'; Description='Run backtests'}
        @{Name='signals'; Description='Manage signals'}
        @{Name='news'; Description='Market news'}
        @{Name='price'; Description='Get price'}
        @{Name='diagnostics'; Description='Debug logging'}
        @{Name='help'; Description='Show help'}
    )
    
    $commands | Where-Object { $_.Name -like "$wordToComplete*" } | ForEach-Object {
        [System.Management.Automation.CompletionResult]::new($_.Name, $_.Name, 'ParameterValue', $_.Description)
    }
}
`;
}
