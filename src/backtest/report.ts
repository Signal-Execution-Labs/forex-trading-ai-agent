/**
 * K.I.T. Backtest Report Generator
 * Generates HTML and JSON reports from backtest results
 */

import { Logger } from '../core/logger';
import { BacktestResult } from './engine';
import { BacktestTrade, EquityPoint, PerformanceMetrics } from './metrics';

export interface ReportConfig {
  title?: string;
  outputDir?: string;
  includeCharts?: boolean;
  includeTrades?: boolean;
  includeEquityCurve?: boolean;
}

export class ReportGenerator {
  private logger: Logger;

  constructor() {
    this.logger = new Logger('ReportGenerator');
  }

  /**
   * Generate complete HTML report
   */
  async generateHTML(result: BacktestResult, config: ReportConfig = {}): Promise<string> {
    const title = config.title || `K.I.T. Backtest Report - ${result.data.symbol}`;
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    ${this.getStyles()}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 K.I.T. Backtest Report</h1>
      <p class="subtitle">${result.data.symbol} | ${result.data.exchange} | ${result.data.timeframe}</p>
      <p class="date">Generated: ${new Date().toISOString()}</p>
    </header>

    <section class="summary-cards">
      ${this.generateSummaryCards(result.metrics)}
    </section>

    <section class="section">
      <h2>📊 Performance Overview</h2>
      ${this.generatePerformanceTable(result.metrics)}
    </section>

    <section class="section">
      <h2>📈 Equity Curve</h2>
      <div class="chart-container">
        <canvas id="equityChart"></canvas>
      </div>
    </section>

    <section class="section">
      <h2>📉 Drawdown</h2>
      <div class="chart-container">
        <canvas id="drawdownChart"></canvas>
      </div>
    </section>

    <section class="section">
      <h2>📊 Monthly Returns</h2>
      <div class="chart-container">
        <canvas id="monthlyChart"></canvas>
      </div>
    </section>

    <section class="section">
      <h2>🎯 Strategy Breakdown</h2>
      ${this.generateStrategyTable(result.strategyMetrics)}
    </section>

    <section class="section">
      <h2>⚙️ Configuration</h2>
      ${this.generateConfigTable(result.config)}
    </section>

    ${config.includeTrades !== false ? `
    <section class="section">
      <h2>📋 Trade List</h2>
      ${this.generateTradeTable(result.trades)}
    </section>
    ` : ''}

    <footer>
      <p>K.I.T. Trading Bot - Backtesting Framework</p>
      <p>Execution time: ${result.executionTime}ms</p>
    </footer>
  </div>

  <script>
    ${this.generateChartScripts(result)}
  </script>
</body>
</html>`;

    return html;
  }

  /**
   * Generate JSON report
   */
  generateJSON(result: BacktestResult): string {
    const report = {
      meta: {
        generated: new Date().toISOString(),
        executionTime: result.executionTime,
        version: '1.0.0'
      },
      data: result.data,
      config: result.config,
      metrics: result.metrics,
      strategyMetrics: Object.fromEntries(result.strategyMetrics),
      trades: result.trades.map(t => ({
        ...t,
        entryTime: t.entryTime.toISOString(),
        exitTime: t.exitTime.toISOString()
      })),
      equityCurve: result.equityCurve.map(e => ({
        ...e,
        timestamp: e.timestamp.toISOString()
      }))
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate Markdown report
   */
  generateMarkdown(result: BacktestResult): string {
    const m = result.metrics;
    
    return `# K.I.T. Backtest Report

## Overview
- **Symbol:** ${result.data.symbol}
- **Exchange:** ${result.data.exchange}
- **Timeframe:** ${result.data.timeframe}
- **Period:** ${result.data.startDate.toISOString().split('T')[0]} to ${result.data.endDate.toISOString().split('T')[0]}
- **Total Candles:** ${result.data.totalCandles.toLocaleString()}

## Performance Summary

| Metric | Value |
|--------|-------|
| Total Trades | ${m.totalTrades} |
| Win Rate | ${(m.winRate * 100).toFixed(2)}% |
| Profit Factor | ${m.profitFactor.toFixed(2)} |
| Total P&L | $${m.totalPnL.toFixed(2)} (${m.totalPnLPercent.toFixed(2)}%) |
| Net Profit | $${m.netProfit.toFixed(2)} |
| Max Drawdown | ${m.maxDrawdownPercent.toFixed(2)}% |
| Sharpe Ratio | ${m.sharpeRatio.toFixed(2)} |
| Sortino Ratio | ${m.sortinoRatio.toFixed(2)} |
| Calmar Ratio | ${m.calmarRatio.toFixed(2)} |

## Risk Metrics

| Metric | Value |
|--------|-------|
| Max Drawdown | $${m.maxDrawdown.toFixed(2)} (${m.maxDrawdownPercent.toFixed(2)}%) |
| Max DD Duration | ${m.maxDrawdownDuration.toFixed(0)} days |
| Recovery Factor | ${m.recoveryFactor.toFixed(2)} |
| Expectancy | $${m.expectancy.toFixed(2)} per trade |

## Trade Statistics

| Metric | Value |
|--------|-------|
| Winning Trades | ${m.winningTrades} |
| Losing Trades | ${m.losingTrades} |
| Avg Win | $${m.avgWin.toFixed(2)} (${m.avgWinPercent.toFixed(2)}%) |
| Avg Loss | $${m.avgLoss.toFixed(2)} (${m.avgLossPercent.toFixed(2)}%) |
| Largest Win | $${m.largestWin.toFixed(2)} |
| Largest Loss | $${m.largestLoss.toFixed(2)} |
| Avg Holding Period | ${m.avgHoldingPeriod.toFixed(1)} hours |
| Max Consecutive Wins | ${m.maxConsecutiveWins} |
| Max Consecutive Losses | ${m.maxConsecutiveLosses} |

## Capital

| Metric | Value |
|--------|-------|
| Initial Capital | $${m.initialCapital.toLocaleString()} |
| Final Capital | $${m.finalCapital.toLocaleString()} |
| Total Return | ${m.totalReturn.toFixed(2)}% |
| Annualized Return | ${m.annualizedReturn.toFixed(2)}% |
| Total Fees | $${m.totalFees.toFixed(2)} |

## Strategy Performance

${this.generateStrategyMarkdown(result.strategyMetrics)}

---
*Generated by K.I.T. Trading Bot | ${new Date().toISOString()}*
`;
  }

  /**
   * Save report to file
   */
  async saveReport(result: BacktestResult, filePath: string): Promise<void> {
    const fs = await import('fs');
    const path = await import('path');

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const ext = path.extname(filePath).toLowerCase();
    let content: string;

    switch (ext) {
      case '.html':
        content = await this.generateHTML(result);
        break;
      case '.json':
        content = this.generateJSON(result);
        break;
      case '.md':
        content = this.generateMarkdown(result);
        break;
      default:
        throw new Error(`Unsupported report format: ${ext}`);
    }

    fs.writeFileSync(filePath, content, 'utf-8');
    this.logger.info(`✅ Report saved to ${filePath}`);
  }

  /**
   * Print summary to console
   */
  printSummary(result: BacktestResult): void {
    const m = result.metrics;
    
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           K.I.T. BACKTEST RESULTS                           ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Symbol:          ${result.data.symbol.padEnd(42)}║`);
    console.log(`║  Period:          ${result.data.startDate.toISOString().split('T')[0]} to ${result.data.endDate.toISOString().split('T')[0]}              ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total Trades:    ${m.totalTrades.toString().padEnd(42)}║`);
    console.log(`║  Win Rate:        ${(m.winRate * 100).toFixed(2).padEnd(40)}% ║`);
    console.log(`║  Profit Factor:   ${m.profitFactor.toFixed(2).padEnd(42)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    const pnlStr = m.totalPnL >= 0 ? `+$${m.totalPnL.toFixed(2)}` : `-$${Math.abs(m.totalPnL).toFixed(2)}`;
    console.log(`║  Total P&L:       ${pnlStr.padEnd(42)}║`);
    console.log(`║  Return:          ${m.totalReturn.toFixed(2).padEnd(40)}% ║`);
    console.log(`║  Max Drawdown:    ${m.maxDrawdownPercent.toFixed(2).padEnd(40)}% ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Sharpe Ratio:    ${m.sharpeRatio.toFixed(2).padEnd(42)}║`);
    console.log(`║  Sortino Ratio:   ${m.sortinoRatio.toFixed(2).padEnd(42)}║`);
    console.log(`║  Expectancy:      $${m.expectancy.toFixed(2).padEnd(41)}║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Initial Capital: $${m.initialCapital.toLocaleString().padEnd(41)}║`);
    console.log(`║  Final Capital:   $${m.finalCapital.toLocaleString().padEnd(41)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('\n');
  }

  // ===== PRIVATE HELPER METHODS =====

  private getStyles(): string {
    return `
      :root {
        --primary: #2563eb;
        --success: #16a34a;
        --danger: #dc2626;
        --warning: #ca8a04;
        --bg: #0f172a;
        --card-bg: #1e293b;
        --text: #e2e8f0;
        --text-muted: #94a3b8;
        --border: #334155;
      }
      
      * { box-sizing: border-box; margin: 0; padding: 0; }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }
      
      .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 2rem;
      }
      
      header {
        text-align: center;
        margin-bottom: 2rem;
        padding-bottom: 2rem;
        border-bottom: 1px solid var(--border);
      }
      
      h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
      h2 { font-size: 1.5rem; margin-bottom: 1rem; color: var(--primary); }
      
      .subtitle { font-size: 1.25rem; color: var(--text-muted); }
      .date { font-size: 0.875rem; color: var(--text-muted); margin-top: 0.5rem; }
      
      .summary-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 2rem;
      }
      
      .card {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 1.5rem;
        border: 1px solid var(--border);
      }
      
      .card-label { font-size: 0.875rem; color: var(--text-muted); }
      .card-value { font-size: 1.75rem; font-weight: 700; margin-top: 0.25rem; }
      .card-value.positive { color: var(--success); }
      .card-value.negative { color: var(--danger); }
      
      .section {
        background: var(--card-bg);
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        border: 1px solid var(--border);
      }
      
      .chart-container {
        position: relative;
        height: 300px;
        width: 100%;
      }
      
      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 1rem;
      }
      
      th, td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid var(--border);
      }
      
      th { color: var(--text-muted); font-weight: 600; }
      
      tr:hover { background: rgba(255,255,255,0.02); }
      
      .profit { color: var(--success); }
      .loss { color: var(--danger); }
      
      footer {
        text-align: center;
        padding: 2rem;
        color: var(--text-muted);
        font-size: 0.875rem;
      }
      
      @media (max-width: 768px) {
        .container { padding: 1rem; }
        h1 { font-size: 1.75rem; }
        .card-value { font-size: 1.25rem; }
      }
    `;
  }

  private generateSummaryCards(m: PerformanceMetrics): string {
    const cards = [
      { label: 'Total Return', value: `${m.totalReturn.toFixed(2)}%`, class: m.totalReturn >= 0 ? 'positive' : 'negative' },
      { label: 'Win Rate', value: `${(m.winRate * 100).toFixed(1)}%`, class: m.winRate >= 0.5 ? 'positive' : 'negative' },
      { label: 'Profit Factor', value: m.profitFactor.toFixed(2), class: m.profitFactor >= 1 ? 'positive' : 'negative' },
      { label: 'Sharpe Ratio', value: m.sharpeRatio.toFixed(2), class: m.sharpeRatio >= 1 ? 'positive' : 'negative' },
      { label: 'Max Drawdown', value: `${m.maxDrawdownPercent.toFixed(1)}%`, class: 'negative' },
      { label: 'Total Trades', value: m.totalTrades.toString(), class: '' }
    ];

    return cards.map(c => `
      <div class="card">
        <div class="card-label">${c.label}</div>
        <div class="card-value ${c.class}">${c.value}</div>
      </div>
    `).join('');
  }

  private generatePerformanceTable(m: PerformanceMetrics): string {
    return `
      <table>
        <tr><th>Metric</th><th>Value</th><th>Metric</th><th>Value</th></tr>
        <tr>
          <td>Total P&L</td>
          <td class="${m.totalPnL >= 0 ? 'profit' : 'loss'}">$${m.totalPnL.toFixed(2)}</td>
          <td>Net Profit</td>
          <td class="${m.netProfit >= 0 ? 'profit' : 'loss'}">$${m.netProfit.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Gross Profit</td>
          <td class="profit">$${m.grossProfit.toFixed(2)}</td>
          <td>Gross Loss</td>
          <td class="loss">$${m.grossLoss.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Winning Trades</td>
          <td>${m.winningTrades}</td>
          <td>Losing Trades</td>
          <td>${m.losingTrades}</td>
        </tr>
        <tr>
          <td>Average Win</td>
          <td class="profit">$${m.avgWin.toFixed(2)} (${m.avgWinPercent.toFixed(2)}%)</td>
          <td>Average Loss</td>
          <td class="loss">$${m.avgLoss.toFixed(2)} (${m.avgLossPercent.toFixed(2)}%)</td>
        </tr>
        <tr>
          <td>Largest Win</td>
          <td class="profit">$${m.largestWin.toFixed(2)}</td>
          <td>Largest Loss</td>
          <td class="loss">$${m.largestLoss.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Max Consecutive Wins</td>
          <td>${m.maxConsecutiveWins}</td>
          <td>Max Consecutive Losses</td>
          <td>${m.maxConsecutiveLosses}</td>
        </tr>
        <tr>
          <td>Sortino Ratio</td>
          <td>${m.sortinoRatio.toFixed(2)}</td>
          <td>Calmar Ratio</td>
          <td>${m.calmarRatio.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Expectancy</td>
          <td>$${m.expectancy.toFixed(2)}</td>
          <td>Recovery Factor</td>
          <td>${m.recoveryFactor.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Avg Holding Period</td>
          <td>${m.avgHoldingPeriod.toFixed(1)} hours</td>
          <td>Trades Per Day</td>
          <td>${m.tradesPerDay.toFixed(2)}</td>
        </tr>
        <tr>
          <td>Annualized Return</td>
          <td class="${m.annualizedReturn >= 0 ? 'profit' : 'loss'}">${m.annualizedReturn.toFixed(2)}%</td>
          <td>Total Fees</td>
          <td>$${m.totalFees.toFixed(2)}</td>
        </tr>
      </table>
    `;
  }

  private generateStrategyTable(strategyMetrics: Map<string, PerformanceMetrics>): string {
    if (strategyMetrics.size === 0) {
      return '<p>No strategy data available</p>';
    }

    let rows = '';
    for (const [name, m] of strategyMetrics) {
      rows += `
        <tr>
          <td>${name}</td>
          <td>${m.totalTrades}</td>
          <td>${(m.winRate * 100).toFixed(1)}%</td>
          <td class="${m.totalPnL >= 0 ? 'profit' : 'loss'}">$${m.totalPnL.toFixed(2)}</td>
          <td>${m.profitFactor.toFixed(2)}</td>
          <td>${m.sharpeRatio.toFixed(2)}</td>
          <td>${m.maxDrawdownPercent.toFixed(1)}%</td>
        </tr>
      `;
    }

    return `
      <table>
        <tr>
          <th>Strategy</th>
          <th>Trades</th>
          <th>Win Rate</th>
          <th>P&L</th>
          <th>Profit Factor</th>
          <th>Sharpe</th>
          <th>Max DD</th>
        </tr>
        ${rows}
      </table>
    `;
  }

  private generateConfigTable(config: any): string {
    return `
      <table>
        <tr><th>Parameter</th><th>Value</th></tr>
        <tr><td>Initial Capital</td><td>$${config.initialCapital.toLocaleString()}</td></tr>
        <tr><td>Fee Rate</td><td>${(config.feeRate * 100).toFixed(2)}%</td></tr>
        <tr><td>Slippage</td><td>${(config.slippage * 100).toFixed(3)}%</td></tr>
        <tr><td>Max Positions</td><td>${config.maxPositions}</td></tr>
        <tr><td>Position Sizing</td><td>${config.positionSizing} (${config.positionSize}${config.positionSizing === 'percent' ? '%' : ''})</td></tr>
        <tr><td>Stop Loss</td><td>${config.useStopLoss ? config.stopLossPercent + '%' : 'Disabled'}</td></tr>
        <tr><td>Take Profit</td><td>${config.useTakeProfit ? config.takeProfitPercent + '%' : 'Disabled'}</td></tr>
        <tr><td>Shorts Allowed</td><td>${config.allowShorts ? 'Yes' : 'No'}</td></tr>
        <tr><td>Leverage</td><td>${config.leverage}x</td></tr>
      </table>
    `;
  }

  private generateTradeTable(trades: BacktestTrade[]): string {
    if (trades.length === 0) {
      return '<p>No trades executed</p>';
    }

    const rows = trades.slice(-100).map(t => `
      <tr>
        <td>${t.entryTime.toISOString().replace('T', ' ').substr(0, 19)}</td>
        <td>${t.symbol}</td>
        <td>${t.side.toUpperCase()}</td>
        <td>${t.strategy}</td>
        <td>$${t.entryPrice.toFixed(2)}</td>
        <td>$${t.exitPrice.toFixed(2)}</td>
        <td class="${t.pnl >= 0 ? 'profit' : 'loss'}">$${t.pnl.toFixed(2)}</td>
        <td class="${t.pnlPercent >= 0 ? 'profit' : 'loss'}">${t.pnlPercent.toFixed(2)}%</td>
      </tr>
    `).join('');

    return `
      <p style="color: var(--text-muted); margin-bottom: 1rem;">Showing last ${Math.min(100, trades.length)} of ${trades.length} trades</p>
      <table>
        <tr>
          <th>Entry Time</th>
          <th>Symbol</th>
          <th>Side</th>
          <th>Strategy</th>
          <th>Entry</th>
          <th>Exit</th>
          <th>P&L</th>
          <th>P&L %</th>
        </tr>
        ${rows}
      </table>
    `;
  }

  private generateStrategyMarkdown(strategyMetrics: Map<string, PerformanceMetrics>): string {
    if (strategyMetrics.size === 0) return 'No strategy data available\n';

    let md = '| Strategy | Trades | Win Rate | P&L | Sharpe |\n';
    md += '|----------|--------|----------|-----|--------|\n';

    for (const [name, m] of strategyMetrics) {
      md += `| ${name} | ${m.totalTrades} | ${(m.winRate * 100).toFixed(1)}% | $${m.totalPnL.toFixed(2)} | ${m.sharpeRatio.toFixed(2)} |\n`;
    }

    return md;
  }

  private generateChartScripts(result: BacktestResult): string {
    // Prepare data for charts
    const equityData = result.equityCurve.map(e => ({
      x: e.timestamp.toISOString(),
      y: e.equity
    }));

    const drawdownData = result.equityCurve.map(e => ({
      x: e.timestamp.toISOString(),
      y: -e.drawdownPercent
    }));

    // Monthly returns calculation
    const monthlyReturns = this.calculateMonthlyReturns(result.equityCurve);

    return `
      // Equity Chart
      new Chart(document.getElementById('equityChart'), {
        type: 'line',
        data: {
          datasets: [{
            label: 'Equity',
            data: ${JSON.stringify(equityData)},
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.1)',
            fill: true,
            tension: 0.1,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', time: { unit: 'day' }, grid: { color: '#334155' } },
            y: { grid: { color: '#334155' } }
          },
          plugins: { legend: { display: false } }
        }
      });

      // Drawdown Chart
      new Chart(document.getElementById('drawdownChart'), {
        type: 'line',
        data: {
          datasets: [{
            label: 'Drawdown %',
            data: ${JSON.stringify(drawdownData)},
            borderColor: '#dc2626',
            backgroundColor: 'rgba(220, 38, 38, 0.3)',
            fill: true,
            tension: 0.1,
            pointRadius: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { type: 'time', time: { unit: 'day' }, grid: { color: '#334155' } },
            y: { grid: { color: '#334155' } }
          },
          plugins: { legend: { display: false } }
        }
      });

      // Monthly Returns Chart
      new Chart(document.getElementById('monthlyChart'), {
        type: 'bar',
        data: {
          labels: ${JSON.stringify(monthlyReturns.map(m => m.month))},
          datasets: [{
            label: 'Monthly Return %',
            data: ${JSON.stringify(monthlyReturns.map(m => m.return))},
            backgroundColor: ${JSON.stringify(monthlyReturns.map(m => m.return >= 0 ? '#16a34a' : '#dc2626'))}
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { grid: { color: '#334155' } },
            x: { grid: { color: '#334155' } }
          },
          plugins: { legend: { display: false } }
        }
      });
    `;
  }

  private calculateMonthlyReturns(equityCurve: EquityPoint[]): { month: string; return: number }[] {
    if (equityCurve.length === 0) return [];

    const monthlyData = new Map<string, { start: number; end: number }>();

    for (const point of equityCurve) {
      const month = point.timestamp.toISOString().substr(0, 7); // YYYY-MM
      const existing = monthlyData.get(month);
      
      if (!existing) {
        monthlyData.set(month, { start: point.equity, end: point.equity });
      } else {
        existing.end = point.equity;
      }
    }

    const returns: { month: string; return: number }[] = [];
    
    for (const [month, data] of monthlyData) {
      const monthReturn = ((data.end - data.start) / data.start) * 100;
      returns.push({ month, return: parseFloat(monthReturn.toFixed(2)) });
    }

    return returns;
  }
}
