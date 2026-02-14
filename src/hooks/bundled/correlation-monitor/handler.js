/**
 * Correlation Monitor Hook
 * 
 * Tracks correlation between portfolio assets and alerts on significant changes.
 * Helps maintain diversification and avoid concentrated risk.
 */

const fs = require('fs');
const path = require('path');

// Correlation threshold for alerts
const HIGH_CORRELATION_THRESHOLD = 0.8;
const CORRELATION_CHANGE_THRESHOLD = 0.2;

// Cache for previous correlations
let previousCorrelations = new Map();

/**
 * Calculate Pearson correlation coefficient between two arrays
 */
function calculateCorrelation(x, y) {
  if (x.length !== y.length || x.length < 2) return 0;
  
  const n = x.length;
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((total, xi, i) => total + xi * y[i], 0);
  const sumX2 = x.reduce((total, xi) => total + xi * xi, 0);
  const sumY2 = y.reduce((total, yi) => total + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  if (denominator === 0) return 0;
  return numerator / denominator;
}

/**
 * Generate mock returns for demo (in production, fetch from API)
 */
function getMockReturns(symbol, days = 30) {
  const returns = [];
  let seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  
  for (let i = 0; i < days; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const dailyReturn = ((seed / 0x7fffffff) - 0.5) * 0.05;
    returns.push(dailyReturn);
  }
  return returns;
}

/**
 * Build correlation matrix for portfolio assets
 */
function buildCorrelationMatrix(symbols) {
  const matrix = {};
  const returns = {};
  
  // Get returns for each symbol
  for (const symbol of symbols) {
    returns[symbol] = getMockReturns(symbol);
  }
  
  // Calculate pairwise correlations
  for (let i = 0; i < symbols.length; i++) {
    matrix[symbols[i]] = {};
    for (let j = 0; j < symbols.length; j++) {
      if (i === j) {
        matrix[symbols[i]][symbols[j]] = 1.0;
      } else {
        const corr = calculateCorrelation(
          returns[symbols[i]],
          returns[symbols[j]]
        );
        matrix[symbols[i]][symbols[j]] = Math.round(corr * 100) / 100;
      }
    }
  }
  
  return matrix;
}

/**
 * Find high correlation pairs
 */
function findHighCorrelations(matrix, threshold = HIGH_CORRELATION_THRESHOLD) {
  const alerts = [];
  const symbols = Object.keys(matrix);
  
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const corr = matrix[symbols[i]][symbols[j]];
      if (Math.abs(corr) >= threshold) {
        alerts.push({
          pair: [symbols[i], symbols[j]],
          correlation: corr,
          type: corr > 0 ? 'positive' : 'negative'
        });
      }
    }
  }
  
  return alerts;
}

/**
 * Check for significant correlation changes
 */
function findCorrelationChanges(matrix) {
  const changes = [];
  const symbols = Object.keys(matrix);
  
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const pairKey = `${symbols[i]}-${symbols[j]}`;
      const currentCorr = matrix[symbols[i]][symbols[j]];
      const prevCorr = previousCorrelations.get(pairKey);
      
      if (prevCorr !== undefined) {
        const change = Math.abs(currentCorr - prevCorr);
        if (change >= CORRELATION_CHANGE_THRESHOLD) {
          changes.push({
            pair: [symbols[i], symbols[j]],
            previous: prevCorr,
            current: currentCorr,
            change: Math.round(change * 100) / 100
          });
        }
      }
      
      previousCorrelations.set(pairKey, currentCorr);
    }
  }
  
  return changes;
}

/**
 * Hook handler - runs on portfolio:changed and market:close
 */
module.exports = async function handler(event, context) {
  const { eventName, payload } = event;
  const timestamp = new Date().toISOString();
  
  // Get portfolio symbols (from payload or default demo)
  let symbols = payload?.symbols || ['BTC', 'ETH', 'SOL', 'AAPL', 'GOOGL', 'EURUSD'];
  
  if (symbols.length < 2) {
    return { skipped: true, reason: 'Need at least 2 assets for correlation' };
  }
  
  // Build correlation matrix
  const matrix = buildCorrelationMatrix(symbols);
  
  // Find issues
  const highCorrelations = findHighCorrelations(matrix);
  const correlationChanges = findCorrelationChanges(matrix);
  
  // Build report
  const report = {
    timestamp,
    event: eventName,
    assets: symbols.length,
    matrix,
    alerts: {
      highCorrelations: highCorrelations.length,
      significantChanges: correlationChanges.length
    },
    details: {
      highCorrelations,
      correlationChanges
    }
  };
  
  // Log alerts
  if (highCorrelations.length > 0) {
    console.log(`⚠️ [Correlation Monitor] High correlations detected:`);
    for (const alert of highCorrelations) {
      console.log(`   ${alert.pair[0]} ↔ ${alert.pair[1]}: ${alert.correlation} (${alert.type})`);
    }
  }
  
  if (correlationChanges.length > 0) {
    console.log(`📊 [Correlation Monitor] Significant correlation changes:`);
    for (const change of correlationChanges) {
      console.log(`   ${change.pair[0]} ↔ ${change.pair[1]}: ${change.previous} → ${change.current}`);
    }
  }
  
  // Save report to workspace
  try {
    const reportsDir = path.join(process.cwd(), 'workspace', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const dateStr = new Date().toISOString().split('T')[0];
    const reportPath = path.join(reportsDir, `correlation_${dateStr}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  } catch (err) {
    // Silently fail if can't write
  }
  
  return {
    success: true,
    alerts: highCorrelations.length + correlationChanges.length,
    report
  };
};
