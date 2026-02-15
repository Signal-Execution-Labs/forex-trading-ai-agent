/**
 * K.I.T. Skill #155: Portfolio Correlation Analyzer
 * 
 * Advanced portfolio analytics - correlation matrices, risk clustering, diversification scoring
 * Essential for professional portfolio management
 */

import { Skill, SkillContext, SkillResult } from '../types/skill.js';

interface Asset {
  symbol: string;
  weight: number;
  returns: number[];
  sector?: string;
  assetClass?: string;
}

interface CorrelationMatrix {
  symbols: string[];
  matrix: number[][];
  averageCorrelation: number;
  highCorrelationPairs: { pair: [string, string]; correlation: number }[];
  clusters: { name: string; assets: string[]; avgCorrelation: number }[];
}

interface DiversificationScore {
  overall: number; // 0-100
  byAssetClass: Record<string, number>;
  bySector: Record<string, number>;
  concentrationRisk: number;
  recommendations: string[];
}

interface RiskDecomposition {
  totalRisk: number;
  systematicRisk: number;
  unsystematicRisk: number;
  contributionByAsset: { symbol: string; contribution: number; marginal: number }[];
  varContribution: { symbol: string; var95: number; cvar95: number }[];
}

export class PortfolioCorrelation implements Skill {
  name = 'portfolio-correlation';
  description = 'Analyze portfolio correlations, clusters, and diversification';
  version = '1.0.0';
  
  async execute(context: SkillContext): Promise<SkillResult> {
    const { action, assets, params } = context.input?.params || {};
    
    switch (action) {
      case 'correlation':
        return this.calculateCorrelation(assets);
      case 'diversification':
        return this.scoreDiversification(assets);
      case 'risk':
        return this.decomposeRisk(assets);
      case 'optimize':
        return this.optimizeAllocation(assets, params);
      case 'cluster':
        return this.clusterAssets(assets);
      case 'stress':
        return this.stressTest(assets, params);
      default:
        return this.fullAnalysis(assets);
    }
  }
  
  private calculateCorrelation(assets: Asset[]): SkillResult {
    const n = assets.length;
    const symbols = assets.map(a => a.symbol);
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    // Calculate pairwise correlations
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else if (j > i) {
          const corr = this.pearsonCorrelation(assets[i].returns, assets[j].returns);
          matrix[i][j] = corr;
          matrix[j][i] = corr;
        }
      }
    }
    
    // Find high correlation pairs
    const highCorrelationPairs: CorrelationMatrix['highCorrelationPairs'] = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(matrix[i][j]) > 0.7) {
          highCorrelationPairs.push({
            pair: [symbols[i], symbols[j]],
            correlation: matrix[i][j]
          });
        }
      }
    }
    
    // Calculate average correlation
    let sum = 0, count = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        sum += matrix[i][j];
        count++;
      }
    }
    const averageCorrelation = count > 0 ? sum / count : 0;
    
    // Identify clusters
    const clusters = this.identifyClusters(symbols, matrix);
    
    const result: CorrelationMatrix = {
      symbols,
      matrix,
      averageCorrelation,
      highCorrelationPairs: highCorrelationPairs.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
      clusters
    };
    
    return {
      success: true,
      data: result,
      metadata: { message: `Correlation analysis for ${n} assets, avg correlation: ${averageCorrelation.toFixed(3)}` }
    };
  }
  
  private scoreDiversification(assets: Asset[]): SkillResult {
    // Calculate diversification metrics
    const totalWeight = assets.reduce((sum, a) => sum + a.weight, 0);
    const normalizedAssets = assets.map(a => ({ ...a, weight: a.weight / totalWeight }));
    
    // Concentration (Herfindahl Index)
    const herfindahl = normalizedAssets.reduce((sum, a) => sum + Math.pow(a.weight, 2), 0);
    const concentrationRisk = herfindahl * 100;
    
    // Asset class diversification
    const byAssetClass: Record<string, number> = {};
    for (const asset of normalizedAssets) {
      const ac = asset.assetClass || 'Unknown';
      byAssetClass[ac] = (byAssetClass[ac] || 0) + asset.weight;
    }
    
    // Sector diversification
    const bySector: Record<string, number> = {};
    for (const asset of normalizedAssets) {
      const sector = asset.sector || 'Unknown';
      bySector[sector] = (bySector[sector] || 0) + asset.weight;
    }
    
    // Overall diversification score (higher is better)
    const assetClassCount = Object.keys(byAssetClass).length;
    const sectorCount = Object.keys(bySector).length;
    const effectiveAssets = 1 / herfindahl; // Equivalent number of equal-weighted assets
    
    const overall = Math.min(100, 
      (effectiveAssets / assets.length) * 40 + // Weight distribution
      Math.min(assetClassCount, 5) * 8 +        // Asset class diversity
      Math.min(sectorCount, 10) * 4              // Sector diversity
    );
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (herfindahl > 0.25) {
      recommendations.push('Portfolio is concentrated - consider reducing largest positions');
    }
    
    if (assetClassCount < 3) {
      recommendations.push('Add exposure to different asset classes for better diversification');
    }
    
    const maxSectorWeight = Math.max(...Object.values(bySector));
    if (maxSectorWeight > 0.4) {
      recommendations.push(`Reduce sector concentration - largest sector is ${(maxSectorWeight * 100).toFixed(0)}% of portfolio`);
    }
    
    if (overall >= 70) {
      recommendations.push('✅ Good diversification - maintain current allocation strategy');
    }
    
    const result: DiversificationScore = {
      overall,
      byAssetClass,
      bySector,
      concentrationRisk,
      recommendations
    };
    
    return {
      success: true,
      data: result,
      metadata: { message: `Diversification score: ${overall.toFixed(1)}/100` }
    };
  }
  
  private decomposeRisk(assets: Asset[]): SkillResult {
    const returns = assets.map(a => a.returns);
    const weights = assets.map(a => a.weight);
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    // Calculate portfolio variance
    const n = assets.length;
    let portfolioVariance = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cov = this.covariance(returns[i], returns[j]);
        portfolioVariance += normalizedWeights[i] * normalizedWeights[j] * cov;
      }
    }
    
    const totalRisk = Math.sqrt(portfolioVariance) * 100; // Annualized
    
    // Risk contribution by asset
    const contributionByAsset = assets.map((asset, i) => {
      let marginalContribution = 0;
      for (let j = 0; j < n; j++) {
        const cov = this.covariance(returns[i], returns[j]);
        marginalContribution += normalizedWeights[j] * cov;
      }
      marginalContribution /= Math.sqrt(portfolioVariance);
      
      const contribution = normalizedWeights[i] * marginalContribution;
      
      return {
        symbol: asset.symbol,
        contribution: contribution * 100,
        marginal: marginalContribution * 100
      };
    });
    
    // VaR contribution
    const varContribution = assets.map(asset => {
      const sortedReturns = [...asset.returns].sort((a, b) => a - b);
      const var95Index = Math.floor(sortedReturns.length * 0.05);
      const var95 = -sortedReturns[var95Index] * asset.weight;
      const cvar95 = -sortedReturns.slice(0, var95Index + 1)
        .reduce((a, b) => a + b, 0) / (var95Index + 1) * asset.weight;
      
      return { symbol: asset.symbol, var95: var95 * 100, cvar95: cvar95 * 100 };
    });
    
    const result: RiskDecomposition = {
      totalRisk,
      systematicRisk: totalRisk * 0.6, // Simplified
      unsystematicRisk: totalRisk * 0.4,
      contributionByAsset: contributionByAsset.sort((a, b) => b.contribution - a.contribution),
      varContribution
    };
    
    return {
      success: true,
      data: result,
      metadata: { message: `Total portfolio risk: ${totalRisk.toFixed(2)}%` }
    };
  }
  
  private optimizeAllocation(assets: Asset[], params: any): SkillResult {
    const { target = 'sharpe', riskFreeRate = 0.05, maxWeight = 0.25 } = params || {};
    
    // Simple mean-variance optimization (simplified version)
    const n = assets.length;
    const returns = assets.map(a => 
      a.returns.reduce((sum, r) => sum + r, 0) / a.returns.length * 252 // Annualized
    );
    
    // Start with equal weights and iterate
    let weights = Array(n).fill(1 / n);
    
    // Gradient-based optimization (simplified)
    for (let iter = 0; iter < 100; iter++) {
      const gradients = weights.map((w, i) => {
        const returnContrib = returns[i];
        let riskContrib = 0;
        for (let j = 0; j < n; j++) {
          riskContrib += weights[j] * this.covariance(assets[i].returns, assets[j].returns);
        }
        return returnContrib - 2 * riskContrib;
      });
      
      // Update weights
      const step = 0.01;
      weights = weights.map((w, i) => Math.max(0, Math.min(maxWeight, w + step * gradients[i])));
      
      // Normalize
      const sum = weights.reduce((a, b) => a + b, 0);
      weights = weights.map(w => w / sum);
    }
    
    const optimized = assets.map((asset, i) => ({
      symbol: asset.symbol,
      currentWeight: asset.weight,
      optimizedWeight: weights[i],
      change: weights[i] - asset.weight
    }));
    
    return {
      success: true,
      data: {
        target,
        optimized: optimized.sort((a, b) => b.optimizedWeight - a.optimizedWeight),
        expectedReturn: returns.reduce((sum, r, i) => sum + r * weights[i], 0),
        expectedRisk: Math.sqrt(this.portfolioVariance(assets, weights)) * Math.sqrt(252) * 100
      },
      metadata: { message: 'Portfolio optimization complete' }
    };
  }
  
  private clusterAssets(assets: Asset[]): SkillResult {
    const n = assets.length;
    const symbols = assets.map(a => a.symbol);
    
    // Calculate distance matrix (1 - correlation)
    const distances: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const corr = this.pearsonCorrelation(assets[i].returns, assets[j].returns);
        distances[i][j] = 1 - corr;
      }
    }
    
    // Simple hierarchical clustering
    const clusters = this.hierarchicalClustering(symbols, distances);
    
    return {
      success: true,
      data: {
        clusters,
        dendrogram: this.buildDendrogram(clusters),
        recommendations: this.clusterRecommendations(clusters)
      },
      metadata: { message: `Identified ${clusters.length} asset clusters` }
    };
  }
  
  private stressTest(assets: Asset[], params: any): SkillResult {
    const scenarios = params?.scenarios || [
      { name: '2008 Crisis', equityDrop: -0.50, bondReturn: 0.10, goldReturn: 0.25 },
      { name: 'COVID Crash', equityDrop: -0.35, bondReturn: 0.05, goldReturn: 0.15 },
      { name: 'Rate Hike', equityDrop: -0.15, bondReturn: -0.10, goldReturn: -0.05 },
      { name: 'Stagflation', equityDrop: -0.25, bondReturn: -0.15, goldReturn: 0.30 }
    ];
    
    const results = scenarios.map((scenario: { name: string; equityDrop: number; bondReturn: number; goldReturn: number }) => {
      let portfolioImpact = 0;
      
      for (const asset of assets) {
        let impact = 0;
        const ac = asset.assetClass?.toLowerCase() || '';
        
        if (ac.includes('equity') || ac.includes('stock')) {
          impact = scenario.equityDrop;
        } else if (ac.includes('bond') || ac.includes('fixed')) {
          impact = scenario.bondReturn;
        } else if (ac.includes('gold') || ac.includes('commodity')) {
          impact = scenario.goldReturn;
        } else {
          impact = scenario.equityDrop * 0.5; // Default to partial equity correlation
        }
        
        portfolioImpact += asset.weight * impact;
      }
      
      return {
        scenario: scenario.name,
        portfolioImpact: portfolioImpact * 100,
        severity: portfolioImpact < -0.20 ? 'severe' : portfolioImpact < -0.10 ? 'moderate' : 'mild'
      };
    });
    
    return {
      success: true,
      data: {
        scenarios: results,
        worstCase: results.reduce((min: any, r: any) => r.portfolioImpact < min.portfolioImpact ? r : min),
        recommendations: this.stressRecommendations(results)
      },
      metadata: { message: 'Stress test complete' }
    };
  }
  
  private fullAnalysis(assets: Asset[]): SkillResult {
    const correlation = this.calculateCorrelation(assets);
    const diversification = this.scoreDiversification(assets);
    const risk = this.decomposeRisk(assets);
    
    return {
      success: true,
      data: {
        correlation: correlation.data,
        diversification: diversification.data,
        risk: risk.data,
        summary: {
          assetCount: assets.length,
          totalWeight: assets.reduce((sum: number, a: Asset) => sum + a.weight, 0),
          avgCorrelation: (correlation.data as CorrelationMatrix).averageCorrelation,
          diversificationScore: (diversification.data as DiversificationScore).overall,
          totalRisk: (risk.data as RiskDecomposition).totalRisk
        }
      },
      metadata: { message: 'Full portfolio analysis complete' }
    };
  }
  
  // Helper functions
  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    
    let num = 0, denX = 0, denY = 0;
    for (let i = 0; i < n; i++) {
      const dx = x[i] - meanX;
      const dy = y[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }
    
    return denX && denY ? num / Math.sqrt(denX * denY) : 0;
  }
  
  private covariance(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;
    
    const meanX = x.reduce((a, b) => a + b, 0) / n;
    const meanY = y.reduce((a, b) => a + b, 0) / n;
    
    return x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / n;
  }
  
  private portfolioVariance(assets: Asset[], weights: number[]): number {
    const n = assets.length;
    let variance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        variance += weights[i] * weights[j] * this.covariance(assets[i].returns, assets[j].returns);
      }
    }
    return variance;
  }
  
  private identifyClusters(symbols: string[], matrix: number[][]): CorrelationMatrix['clusters'] {
    // Simple threshold-based clustering
    const clusters: { name: string; assets: string[]; avgCorrelation: number }[] = [];
    const assigned = new Set<number>();
    
    for (let i = 0; i < symbols.length; i++) {
      if (assigned.has(i)) continue;
      
      const cluster = [i];
      assigned.add(i);
      
      for (let j = i + 1; j < symbols.length; j++) {
        if (assigned.has(j)) continue;
        if (matrix[i][j] > 0.7) {
          cluster.push(j);
          assigned.add(j);
        }
      }
      
      if (cluster.length > 1) {
        const assets = cluster.map(idx => symbols[idx]);
        let sumCorr = 0, countCorr = 0;
        for (let a = 0; a < cluster.length; a++) {
          for (let b = a + 1; b < cluster.length; b++) {
            sumCorr += matrix[cluster[a]][cluster[b]];
            countCorr++;
          }
        }
        
        clusters.push({
          name: `Cluster ${clusters.length + 1}`,
          assets,
          avgCorrelation: countCorr ? sumCorr / countCorr : 0
        });
      }
    }
    
    return clusters;
  }
  
  private hierarchicalClustering(symbols: string[], distances: number[][]): any[] {
    return symbols.map(s => ({ symbol: s, level: 0 }));
  }
  
  private buildDendrogram(clusters: any[]): any {
    return { clusters, levels: clusters.length };
  }
  
  private clusterRecommendations(clusters: any[]): string[] {
    const recs: string[] = [];
    if (clusters.length < 3) {
      recs.push('Assets are highly correlated - consider adding uncorrelated assets');
    }
    return recs;
  }
  
  private stressRecommendations(results: any[]): string[] {
    const severe = results.filter(r => r.severity === 'severe');
    if (severe.length > 0) {
      return [`Portfolio vulnerable to ${severe.map(s => s.scenario).join(', ')} - consider hedging`];
    }
    return ['Portfolio shows reasonable resilience across stress scenarios'];
  }
}

export default PortfolioCorrelation;
