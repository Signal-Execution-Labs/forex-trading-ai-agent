/**
 * K.I.T. Risk CLI Command
 * 
 * Risk management tools.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Command } from 'commander';

const KIT_HOME = path.join(os.homedir(), '.kit');
const RISK_CONFIG_FILE = path.join(KIT_HOME, 'risk-config.json');

export interface RiskConfig {
  maxPositionSize: number;      // % of portfolio per trade
  maxDailyLoss: number;         // % max daily drawdown
  maxOpenPositions: number;
  defaultStopLoss: number;      // % from entry
  defaultTakeProfit: number;    // % from entry
  riskRewardRatio: number;
  maxLeverage: number;
}

export function registerRiskCommand(program: Command): void {
  const risk = program
    .command('risk')
    .description('Risk management tools');

  // Show risk settings
  risk
    .command('settings')
    .description('Show current risk settings')
    .option('--json', 'Output as JSON')
    .action((options) => {
      const config = loadRiskConfig();
      
      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
        return;
      }
      
      console.log('⚠️ Risk Management Settings\n');
      console.log('━'.repeat(45));
      console.log(`Max Position Size:    ${config.maxPositionSize}% of portfolio`);
      console.log(`Max Daily Loss:       ${config.maxDailyLoss}%`);
      console.log(`Max Open Positions:   ${config.maxOpenPositions}`);
      console.log(`Default Stop Loss:    ${config.defaultStopLoss}%`);
      console.log(`Default Take Profit:  ${config.defaultTakeProfit}%`);
      console.log(`Risk/Reward Ratio:    1:${config.riskRewardRatio}`);
      console.log(`Max Leverage:         ${config.maxLeverage}x`);
      console.log('━'.repeat(45));
      console.log('\n💡 Update with: kit risk set <setting> <value>');
    });

  // Set risk parameter
  risk
    .command('set <setting> <value>')
    .description('Update a risk setting')
    .action((setting, value) => {
      const config = loadRiskConfig();
      const numValue = parseFloat(value);
      
      const settingMap: Record<string, keyof RiskConfig> = {
        'position-size': 'maxPositionSize',
        'daily-loss': 'maxDailyLoss',
        'max-positions': 'maxOpenPositions',
        'stop-loss': 'defaultStopLoss',
        'take-profit': 'defaultTakeProfit',
        'risk-reward': 'riskRewardRatio',
        'leverage': 'maxLeverage',
      };
      
      const key = settingMap[setting];
      if (!key) {
        console.error(`Unknown setting: ${setting}`);
        console.log('Available: position-size, daily-loss, max-positions, stop-loss, take-profit, risk-reward, leverage');
        process.exit(1);
      }
      
      (config as any)[key] = numValue;
      saveRiskConfig(config);
      console.log(`✅ Updated ${setting} to ${numValue}`);
    });

  // Position size calculator
  risk
    .command('calc')
    .description('Calculate position size')
    .requiredOption('--capital <amount>', 'Account capital', parseFloat)
    .requiredOption('--risk <percent>', 'Risk per trade (%)', parseFloat)
    .requiredOption('--entry <price>', 'Entry price', parseFloat)
    .requiredOption('--stop <price>', 'Stop loss price', parseFloat)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const { capital, risk: riskPercent, entry, stop } = options;
      
      const riskAmount = capital * (riskPercent / 100);
      const stopDistance = Math.abs(entry - stop);
      const stopPercent = (stopDistance / entry) * 100;
      const positionSize = riskAmount / stopDistance;
      const positionValue = positionSize * entry;
      const leverage = positionValue / capital;
      
      const result = {
        capital,
        riskPercent,
        riskAmount,
        entry,
        stop,
        stopDistance,
        stopPercent: stopPercent.toFixed(2),
        positionSize: positionSize.toFixed(6),
        positionValue: positionValue.toFixed(2),
        leverage: leverage.toFixed(2),
      };
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      
      console.log('📊 Position Size Calculator\n');
      console.log('━'.repeat(45));
      console.log(`Capital:           $${capital.toLocaleString()}`);
      console.log(`Risk:              ${riskPercent}% ($${riskAmount.toLocaleString()})`);
      console.log(`Entry Price:       $${entry.toLocaleString()}`);
      console.log(`Stop Loss:         $${stop.toLocaleString()} (${stopPercent.toFixed(2)}%)`);
      console.log('━'.repeat(45));
      console.log(`Position Size:     ${positionSize.toFixed(6)} units`);
      console.log(`Position Value:    $${positionValue.toLocaleString()}`);
      console.log(`Effective Leverage: ${leverage.toFixed(2)}x`);
      console.log('━'.repeat(45));
      
      if (leverage > 10) {
        console.log('\n⚠️ WARNING: High leverage detected!');
      }
    });

  // Risk/Reward calculator
  risk
    .command('rr')
    .alias('risk-reward')
    .description('Calculate risk/reward ratio')
    .requiredOption('--entry <price>', 'Entry price', parseFloat)
    .requiredOption('--stop <price>', 'Stop loss', parseFloat)
    .requiredOption('--target <price>', 'Target price', parseFloat)
    .option('--json', 'Output as JSON')
    .action((options) => {
      const { entry, stop, target } = options;
      
      const risk = Math.abs(entry - stop);
      const reward = Math.abs(target - entry);
      const ratio = reward / risk;
      const riskPercent = (risk / entry) * 100;
      const rewardPercent = (reward / entry) * 100;
      
      const result = {
        entry,
        stop,
        target,
        risk,
        reward,
        ratio: ratio.toFixed(2),
        riskPercent: riskPercent.toFixed(2),
        rewardPercent: rewardPercent.toFixed(2),
        recommendation: ratio >= 2 ? 'Good' : ratio >= 1.5 ? 'Acceptable' : 'Poor',
      };
      
      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }
      
      console.log('📊 Risk/Reward Calculator\n');
      console.log('━'.repeat(45));
      console.log(`Entry:    $${entry.toLocaleString()}`);
      console.log(`Stop:     $${stop.toLocaleString()} (-${riskPercent.toFixed(2)}%)`);
      console.log(`Target:   $${target.toLocaleString()} (+${rewardPercent.toFixed(2)}%)`);
      console.log('━'.repeat(45));
      console.log(`Risk:     $${risk.toLocaleString()}`);
      console.log(`Reward:   $${reward.toLocaleString()}`);
      console.log(`R:R Ratio: 1:${ratio.toFixed(2)}`);
      console.log('━'.repeat(45));
      
      const emoji = ratio >= 2 ? '✅' : ratio >= 1.5 ? '⚠️' : '❌';
      console.log(`\n${emoji} ${result.recommendation} trade setup`);
    });

  // Check portfolio risk
  risk
    .command('check')
    .description('Check current portfolio risk')
    .option('--json', 'Output as JSON')
    .action((options) => {
      // Mock portfolio risk analysis
      const analysis = {
        totalPositions: 5,
        totalExposure: 45000,
        portfolioValue: 100000,
        exposurePercent: 45,
        unrealizedPnl: 2340,
        atRisk: 4500,
        atRiskPercent: 4.5,
        correlationRisk: 'Medium',
        concentrationRisk: 'Low',
        overallRisk: 'Moderate',
      };
      
      if (options.json) {
        console.log(JSON.stringify(analysis, null, 2));
        return;
      }
      
      console.log('⚠️ Portfolio Risk Analysis\n');
      console.log('━'.repeat(45));
      console.log(`Total Positions:     ${analysis.totalPositions}`);
      console.log(`Total Exposure:      $${analysis.totalExposure.toLocaleString()} (${analysis.exposurePercent}%)`);
      console.log(`Portfolio Value:     $${analysis.portfolioValue.toLocaleString()}`);
      console.log(`Unrealized P&L:      $${analysis.unrealizedPnl.toLocaleString()}`);
      console.log('━'.repeat(45));
      console.log(`Capital at Risk:     $${analysis.atRisk.toLocaleString()} (${analysis.atRiskPercent}%)`);
      console.log(`Correlation Risk:    ${analysis.correlationRisk}`);
      console.log(`Concentration Risk:  ${analysis.concentrationRisk}`);
      console.log('━'.repeat(45));
      console.log(`\n📊 Overall Risk Level: ${analysis.overallRisk}`);
    });

  // Daily loss limit status
  risk
    .command('daily')
    .description('Check daily loss limit status')
    .action(() => {
      console.log('📅 Daily Risk Status\n');
      
      // Mock daily stats
      const dailyPnl = -1250;
      const maxLoss = 2000;
      const used = Math.abs(dailyPnl);
      const remaining = maxLoss - used;
      const usedPercent = (used / maxLoss) * 100;
      
      console.log(`Daily P&L:        ${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toLocaleString()}`);
      console.log(`Max Daily Loss:   $${maxLoss.toLocaleString()}`);
      console.log(`Remaining:        $${remaining.toLocaleString()}`);
      console.log('');
      
      const bar = '█'.repeat(Math.floor(usedPercent / 10)) + '░'.repeat(10 - Math.floor(usedPercent / 10));
      console.log(`Usage: [${bar}] ${usedPercent.toFixed(0)}%`);
      
      if (usedPercent >= 80) {
        console.log('\n⚠️ WARNING: Approaching daily loss limit!');
      }
    });
}

function loadRiskConfig(): RiskConfig {
  const defaults: RiskConfig = {
    maxPositionSize: 5,
    maxDailyLoss: 2,
    maxOpenPositions: 5,
    defaultStopLoss: 2,
    defaultTakeProfit: 4,
    riskRewardRatio: 2,
    maxLeverage: 10,
  };
  
  if (!fs.existsSync(RISK_CONFIG_FILE)) {
    return defaults;
  }
  
  try {
    const saved = JSON.parse(fs.readFileSync(RISK_CONFIG_FILE, 'utf8'));
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function saveRiskConfig(config: RiskConfig): void {
  fs.mkdirSync(path.dirname(RISK_CONFIG_FILE), { recursive: true });
  fs.writeFileSync(RISK_CONFIG_FILE, JSON.stringify(config, null, 2));
}
