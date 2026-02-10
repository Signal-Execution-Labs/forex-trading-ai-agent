/**
 * K.I.T. Signal Parser
 * 
 * Parses trading signals from various text formats:
 * - Telegram channel messages
 * - Discord signals
 * - Custom API formats
 * 
 * @see https://github.com/kayzaa/k.i.t.-bot/issues/23
 */

import { TradingSignal, SignalDirection, SignalConfidence } from './signal-manager';

export interface ParsedSignal {
  symbol: string;
  direction: SignalDirection;
  entryPrice?: number;
  takeProfits: number[];
  stopLoss?: number;
  confidence: SignalConfidence;
  confidenceScore: number;
  reasoning?: string;
  rawMessage: string;
}

export interface ParseResult {
  success: boolean;
  signal?: ParsedSignal;
  error?: string;
}

/**
 * Signal Parser - Parse trading signals from text
 */
export class SignalParser {
  
  /**
   * Parse a signal from text message
   */
  parse(message: string): ParseResult {
    const cleaned = message.trim();
    
    // Try different parsing strategies
    const strategies = [
      () => this.parseStructuredFormat(cleaned),
      () => this.parseEmojiBased(cleaned),
      () => this.parseNaturalLanguage(cleaned)
    ];
    
    for (const strategy of strategies) {
      const result = strategy();
      if (result.success) {
        return result;
      }
    }
    
    return { success: false, error: 'Could not parse signal from message' };
  }
  
  /**
   * Parse structured format (common in Telegram channels)
   * Example:
   * 🟢 BTC/USDT LONG
   * Entry: 42000-42500
   * TP1: 43000
   * TP2: 44000
   * SL: 41000
   */
  private parseStructuredFormat(message: string): ParseResult {
    const lines = message.split('\n').map(l => l.trim()).filter(l => l);
    
    // Extract symbol and direction from first line
    const firstLine = lines[0];
    const symbolMatch = firstLine.match(/([A-Z]+(?:\/[A-Z]+)?)\s*(LONG|SHORT|BUY|SELL)/i);
    
    if (!symbolMatch) {
      return { success: false };
    }
    
    let symbol = symbolMatch[1].toUpperCase();
    // Normalize symbol format
    if (!symbol.includes('/') && !symbol.includes('USDT') && !symbol.includes('USD')) {
      symbol = `${symbol}/USDT`;
    }
    
    const directionStr = symbolMatch[2].toUpperCase();
    const direction: SignalDirection = 
      directionStr === 'LONG' || directionStr === 'BUY' ? 'long' : 'short';
    
    // Extract prices
    let entryPrice: number | undefined;
    const takeProfits: number[] = [];
    let stopLoss: number | undefined;
    
    for (const line of lines) {
      const lower = line.toLowerCase();
      
      // Entry price
      if (lower.includes('entry') || lower.includes('buy') || lower.includes('sell')) {
        const prices = this.extractPrices(line);
        if (prices.length > 0) {
          entryPrice = prices.length === 2 ? (prices[0] + prices[1]) / 2 : prices[0];
        }
      }
      
      // Take profit
      if (lower.includes('tp') || lower.includes('take profit') || lower.includes('target')) {
        const prices = this.extractPrices(line);
        takeProfits.push(...prices);
      }
      
      // Stop loss
      if (lower.includes('sl') || lower.includes('stop') || lower.includes('stoploss')) {
        const prices = this.extractPrices(line);
        if (prices.length > 0) {
          stopLoss = prices[0];
        }
      }
    }
    
    // Calculate confidence based on completeness
    let confidenceScore = 50;
    if (entryPrice) confidenceScore += 15;
    if (takeProfits.length > 0) confidenceScore += 15;
    if (stopLoss) confidenceScore += 15;
    if (takeProfits.length >= 2) confidenceScore += 5;
    
    const confidence = this.scoreToConfidence(confidenceScore);
    
    return {
      success: true,
      signal: {
        symbol,
        direction,
        entryPrice,
        takeProfits,
        stopLoss,
        confidence,
        confidenceScore,
        rawMessage: message
      }
    };
  }
  
  /**
   * Parse emoji-based format
   * Example: 🚀 BTCUSDT 🟢 Entry 42000 TP 43000 SL 41000
   */
  private parseEmojiBased(message: string): ParseResult {
    // Remove emojis for parsing, but check for direction indicators
    const isLong = message.includes('🟢') || message.includes('🚀') || 
                   message.includes('📈') || message.includes('⬆️');
    const isShort = message.includes('🔴') || message.includes('📉') || 
                    message.includes('⬇️') || message.includes('🐻');
    
    if (!isLong && !isShort) {
      return { success: false };
    }
    
    // Extract symbol
    const symbolMatch = message.match(/([A-Z]{2,}(?:USDT?|USD|BUSD)?)/);
    if (!symbolMatch) {
      return { success: false };
    }
    
    let symbol = symbolMatch[1];
    if (!symbol.includes('/')) {
      if (symbol.endsWith('USDT') || symbol.endsWith('USD')) {
        symbol = symbol.replace(/(USDT?|USD)$/, '/$1');
      } else {
        symbol = `${symbol}/USDT`;
      }
    }
    
    const prices = this.extractPrices(message);
    
    return {
      success: true,
      signal: {
        symbol,
        direction: isLong ? 'long' : 'short',
        entryPrice: prices[0],
        takeProfits: prices.slice(1, -1),
        stopLoss: prices[prices.length - 1],
        confidence: 'medium',
        confidenceScore: 60,
        rawMessage: message
      }
    };
  }
  
  /**
   * Parse natural language format
   * Example: "Buy BTC at 42000, target 43000, stop at 41000"
   */
  private parseNaturalLanguage(message: string): ParseResult {
    const lower = message.toLowerCase();
    
    // Direction
    let direction: SignalDirection = 'neutral';
    if (lower.includes('buy') || lower.includes('long') || lower.includes('bullish')) {
      direction = 'long';
    } else if (lower.includes('sell') || lower.includes('short') || lower.includes('bearish')) {
      direction = 'short';
    }
    
    if (direction === 'neutral') {
      return { success: false };
    }
    
    // Symbol
    const symbolMatch = message.match(/\b([A-Z]{2,}(?:\/[A-Z]+)?)\b/);
    if (!symbolMatch) {
      return { success: false };
    }
    
    let symbol = symbolMatch[1];
    if (!symbol.includes('/')) {
      symbol = `${symbol}/USDT`;
    }
    
    // Prices
    const prices = this.extractPrices(message);
    
    return {
      success: true,
      signal: {
        symbol,
        direction,
        entryPrice: prices[0],
        takeProfits: prices.length > 2 ? prices.slice(1, -1) : prices.slice(1),
        stopLoss: prices.length > 2 ? prices[prices.length - 1] : undefined,
        confidence: 'low',
        confidenceScore: 40,
        rawMessage: message
      }
    };
  }
  
  /**
   * Extract prices from text
   */
  private extractPrices(text: string): number[] {
    const matches = text.match(/[\d,]+\.?\d*/g) || [];
    return matches
      .map(m => parseFloat(m.replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);
  }
  
  /**
   * Convert score to confidence level
   */
  private scoreToConfidence(score: number): SignalConfidence {
    if (score >= 85) return 'very-high';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }
}

/**
 * Factory function
 */
export function createSignalParser(): SignalParser {
  return new SignalParser();
}
