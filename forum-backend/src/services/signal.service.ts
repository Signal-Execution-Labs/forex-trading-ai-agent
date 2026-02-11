import { db, dbHelpers } from '../db/database.ts';
import { Signal } from '../models/types.ts';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { TwitterService } from './twitter.service.ts';

// Event emitter for real-time signal broadcasting
export const signalEvents = new EventEmitter();

export class SignalService {
  static async create(
    agentId: string,
    data: {
      strategy_id?: string;
      asset: string;
      direction: 'LONG' | 'SHORT' | 'NEUTRAL';
      entry_price?: number;
      target_price?: number;
      stop_loss?: number;
      confidence?: number;
      timeframe?: string;
      reasoning?: string;
    }
  ): Promise<Signal> {
    const signal: Signal = {
      id: uuidv4(),
      agent_id: agentId,
      strategy_id: data.strategy_id,
      asset: data.asset,
      direction: data.direction,
      entry_price: data.entry_price,
      target_price: data.target_price,
      stop_loss: data.stop_loss,
      confidence: data.confidence,
      timeframe: data.timeframe,
      reasoning: data.reasoning,
      created_at: new Date().toISOString(),
    };

    db.data!.signals.push(signal);
    await db.write();

    // Emit event for WebSocket broadcasting
    const agent = dbHelpers.findAgent(agentId);
    const enrichedSignal = {
      ...signal,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar_url,
    };
    signalEvents.emit('new_signal', enrichedSignal);

    // Auto-tweet if enabled (fire and forget, don't block signal creation)
    TwitterService.autoTweetSignal(signal)
      .then(result => {
        if (result?.success) {
          console.log(`📢 Auto-tweeted signal ${signal.id}: ${result.tweetUrl}`);
        } else if (result?.error) {
          console.log(`⚠️ Auto-tweet failed for signal ${signal.id}: ${result.error}`);
        }
      })
      .catch(err => console.error('Auto-tweet error:', err));

    return signal;
  }

  static getById(id: string): (Signal & { agent_name?: string; agent_avatar?: string }) | undefined {
    const signal = dbHelpers.findSignal(id);
    if (!signal) return undefined;

    const agent = dbHelpers.findAgent(signal.agent_id);
    return {
      ...signal,
      agent_name: agent?.name,
      agent_avatar: agent?.avatar_url,
    };
  }

  static list(options: {
    page?: number;
    limit?: number;
    agent_id?: string;
    asset?: string;
    direction?: string;
    from_date?: string;
    to_date?: string;
  } = {}): { signals: (Signal & { agent_name?: string; agent_win_rate?: number })[]; total: number } {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 50, 200);
    const offset = (page - 1) * limit;

    let signals = [...db.data!.signals];

    if (options.agent_id) {
      signals = signals.filter(s => s.agent_id === options.agent_id);
    }
    if (options.asset) {
      signals = signals.filter(s => s.asset === options.asset);
    }
    if (options.direction) {
      signals = signals.filter(s => s.direction === options.direction);
    }
    if (options.from_date) {
      signals = signals.filter(s => new Date(s.created_at) >= new Date(options.from_date!));
    }
    if (options.to_date) {
      signals = signals.filter(s => new Date(s.created_at) <= new Date(options.to_date!));
    }

    // Sort by created_at desc
    signals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const total = signals.length;
    const paged = signals.slice(offset, offset + limit);

    // Enrich with agent info
    const enriched = paged.map(s => {
      const agent = dbHelpers.findAgent(s.agent_id);
      return {
        ...s,
        agent_name: agent?.name,
        agent_avatar: agent?.avatar_url,
        agent_win_rate: agent?.win_rate,
      };
    });

    return { signals: enriched, total };
  }

  static async closeSignal(id: string, result: 'WIN' | 'LOSS' | 'BREAKEVEN'): Promise<Signal | undefined> {
    const signal = dbHelpers.findSignal(id);
    if (!signal) return undefined;

    signal.result = result;
    signal.closed_at = new Date().toISOString();
    await db.write();

    const agent = dbHelpers.findAgent(signal.agent_id);
    const enrichedSignal = {
      ...signal,
      agent_name: agent?.name,
    };
    signalEvents.emit('signal_closed', enrichedSignal);

    return signal;
  }

  static getRecentByAgent(agentId: string, limit: number = 10): Signal[] {
    return db.data!.signals
      .filter(s => s.agent_id === agentId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  static getStats(agentId?: string): {
    total_signals: number;
    wins: number;
    losses: number;
    pending: number;
    win_rate: number;
    most_traded_asset: string;
    avg_confidence: number;
  } {
    let signals = agentId 
      ? db.data!.signals.filter(s => s.agent_id === agentId)
      : db.data!.signals;

    const total_signals = signals.length;
    const wins = signals.filter(s => s.result === 'WIN').length;
    const losses = signals.filter(s => s.result === 'LOSS').length;
    const pending = signals.filter(s => !s.result).length;

    // Most traded asset
    const assetCounts: Record<string, number> = {};
    signals.forEach(s => {
      assetCounts[s.asset] = (assetCounts[s.asset] || 0) + 1;
    });
    const most_traded_asset = Object.entries(assetCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    // Average confidence
    const confidenceSignals = signals.filter(s => s.confidence !== undefined);
    const avg_confidence = confidenceSignals.length > 0
      ? Math.round(confidenceSignals.reduce((sum, s) => sum + (s.confidence || 0), 0) / confidenceSignals.length * 100) / 100
      : 0;

    const closedTotal = wins + losses;
    
    return {
      total_signals,
      wins,
      losses,
      pending,
      win_rate: closedTotal > 0 ? Math.round((wins / closedTotal) * 10000) / 100 : 0,
      most_traded_asset,
      avg_confidence,
    };
  }
}
