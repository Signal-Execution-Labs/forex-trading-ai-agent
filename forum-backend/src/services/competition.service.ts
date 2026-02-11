/**
 * Competition/Tournament Service
 * TradingView-style trading competitions for AI agents
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.ts';

export interface Competition {
  id: string;
  name: string;
  description: string;
  type: 'paper' | 'signal' | 'strategy';
  status: 'upcoming' | 'active' | 'ended';
  startDate: string;
  endDate: string;
  entryFee: number;
  prizePool: number;
  prizes: Prize[];
  rules: CompetitionRules;
  assets: string[];
  maxParticipants: number;
  participants: Participant[];
  leaderboard: LeaderboardEntry[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Prize {
  rank: number;
  amount: number;
  badge?: string;
  title?: string;
}

export interface CompetitionRules {
  startingBalance: number;
  maxLeverage: number;
  maxDrawdown: number;
  minTrades: number;
  maxTrades: number;
  rankBy: 'pnl' | 'pnl_percent' | 'sharpe' | 'win_rate';
  allowShorts: boolean;
  requireStopLoss: boolean;
}

export interface Participant {
  agentId: string;
  joinedAt: string;
  status: 'active' | 'disqualified' | 'withdrawn';
  disqualifyReason?: string;
}

export interface LeaderboardEntry {
  agentId: string;
  rank: number;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  lastUpdated: string;
}

export interface CompetitionTrade {
  id: string;
  competitionId: string;
  agentId: string;
  asset: string;
  direction: 'long' | 'short';
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed';
  pnl?: number;
  openedAt: string;
  closedAt?: string;
}

// Extend db.data type
declare module '../db/database.ts' {
  interface DbSchema {
    competitions?: Competition[];
    competition_trades?: CompetitionTrade[];
  }
}

class CompetitionService {
  async createCompetition(data: Omit<Competition, 'id' | 'status' | 'participants' | 'leaderboard' | 'createdAt' | 'updatedAt'>): Promise<Competition> {
    const competition: Competition = {
      ...data,
      id: uuidv4(),
      status: new Date(data.startDate) > new Date() ? 'upcoming' : 'active',
      participants: [],
      leaderboard: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    (db.data as any).competitions = (db.data as any).competitions || [];
    (db.data as any).competitions.push(competition);
    await db.write();
    return competition;
  }

  async getCompetition(id: string): Promise<Competition | null> {
    const competitions = (db.data as any).competitions || [];
    return competitions.find((c: Competition) => c.id === id) || null;
  }

  async listCompetitions(filters: {
    status?: Competition['status'];
    type?: Competition['type'];
    limit?: number;
    offset?: number;
  } = {}): Promise<{ competitions: Competition[]; total: number }> {
    let competitions = (db.data as any).competitions || [];
    
    if (filters.status) {
      competitions = competitions.filter((c: Competition) => c.status === filters.status);
    }
    if (filters.type) {
      competitions = competitions.filter((c: Competition) => c.type === filters.type);
    }
    
    const total = competitions.length;
    competitions = competitions
      .sort((a: Competition, b: Competition) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20));
    
    return { competitions, total };
  }

  async joinCompetition(competitionId: string, agentId: string): Promise<{ success: boolean; error?: string }> {
    const competitions = (db.data as any).competitions || [];
    const competition = competitions.find((c: Competition) => c.id === competitionId);
    
    if (!competition) return { success: false, error: 'Competition not found' };
    if (competition.status === 'ended') return { success: false, error: 'Competition has ended' };
    if (competition.participants.length >= competition.maxParticipants) {
      return { success: false, error: 'Competition is full' };
    }
    if (competition.participants.some((p: Participant) => p.agentId === agentId)) {
      return { success: false, error: 'Already joined' };
    }
    
    competition.participants.push({
      agentId,
      joinedAt: new Date().toISOString(),
      status: 'active'
    });
    
    competition.leaderboard.push({
      agentId,
      rank: competition.leaderboard.length + 1,
      pnl: 0,
      pnlPercent: 0,
      trades: 0,
      winRate: 0,
      sharpe: 0,
      maxDrawdown: 0,
      lastUpdated: new Date().toISOString()
    });
    
    competition.updatedAt = new Date().toISOString();
    await db.write();
    return { success: true };
  }

  async leaveCompetition(competitionId: string, agentId: string): Promise<{ success: boolean; error?: string }> {
    const competitions = (db.data as any).competitions || [];
    const competition = competitions.find((c: Competition) => c.id === competitionId);
    
    if (!competition) return { success: false, error: 'Competition not found' };
    
    const participant = competition.participants.find((p: Participant) => p.agentId === agentId);
    if (!participant) return { success: false, error: 'Not a participant' };
    
    participant.status = 'withdrawn';
    competition.updatedAt = new Date().toISOString();
    await db.write();
    return { success: true };
  }

  async submitTrade(trade: Omit<CompetitionTrade, 'id' | 'status' | 'openedAt'>): Promise<{ success: boolean; trade?: CompetitionTrade; error?: string }> {
    const competitions = (db.data as any).competitions || [];
    const competition = competitions.find((c: Competition) => c.id === trade.competitionId);
    
    if (!competition) return { success: false, error: 'Competition not found' };
    if (competition.status !== 'active') return { success: false, error: 'Competition not active' };
    
    const participant = competition.participants.find((p: Participant) => p.agentId === trade.agentId && p.status === 'active');
    if (!participant) return { success: false, error: 'Not an active participant' };
    
    if (!competition.assets.includes(trade.asset) && competition.assets.length > 0) {
      return { success: false, error: 'Asset not allowed' };
    }
    if (trade.leverage > competition.rules.maxLeverage) {
      return { success: false, error: `Max leverage is ${competition.rules.maxLeverage}x` };
    }
    if (!competition.rules.allowShorts && trade.direction === 'short') {
      return { success: false, error: 'Short positions not allowed' };
    }
    if (competition.rules.requireStopLoss && !trade.stopLoss) {
      return { success: false, error: 'Stop loss required' };
    }
    
    const newTrade: CompetitionTrade = {
      ...trade,
      id: uuidv4(),
      status: 'open',
      openedAt: new Date().toISOString()
    };
    
    (db.data as any).competition_trades = (db.data as any).competition_trades || [];
    (db.data as any).competition_trades.push(newTrade);
    await db.write();
    
    return { success: true, trade: newTrade };
  }

  async closeTrade(tradeId: string, agentId: string, exitPrice: number): Promise<{ success: boolean; trade?: CompetitionTrade; error?: string }> {
    const trades = (db.data as any).competition_trades || [];
    const trade = trades.find((t: CompetitionTrade) => t.id === tradeId);
    
    if (!trade) return { success: false, error: 'Trade not found' };
    if (trade.agentId !== agentId) return { success: false, error: 'Not your trade' };
    if (trade.status !== 'open') return { success: false, error: 'Trade already closed' };
    
    const priceDiff = trade.direction === 'long' ? exitPrice - trade.entryPrice : trade.entryPrice - exitPrice;
    trade.exitPrice = exitPrice;
    trade.pnl = priceDiff * trade.quantity * trade.leverage;
    trade.status = 'closed';
    trade.closedAt = new Date().toISOString();
    
    await this.updateLeaderboard(trade.competitionId, trade.agentId);
    await db.write();
    return { success: true, trade };
  }

  async updateLeaderboard(competitionId: string, agentId: string): Promise<void> {
    const competitions = (db.data as any).competitions || [];
    const competition = competitions.find((c: Competition) => c.id === competitionId);
    if (!competition) return;
    
    const allTrades = (db.data as any).competition_trades || [];
    const trades = allTrades.filter((t: CompetitionTrade) => 
      t.competitionId === competitionId && t.agentId === agentId && t.status === 'closed');
    
    const entry = competition.leaderboard.find((e: LeaderboardEntry) => e.agentId === agentId);
    if (!entry) return;
    
    const totalPnl = trades.reduce((sum: number, t: CompetitionTrade) => sum + (t.pnl || 0), 0);
    const wins = trades.filter((t: CompetitionTrade) => (t.pnl || 0) > 0).length;
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;
    
    const returns = trades.map((t: CompetitionTrade) => t.pnl || 0);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const stdDev = returns.length > 1 
      ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1))
      : 0;
    const sharpe = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
    
    let peak = competition.rules.startingBalance;
    let maxDrawdown = 0;
    let balance = competition.rules.startingBalance;
    for (const t of trades) {
      balance += t.pnl || 0;
      peak = Math.max(peak, balance);
      maxDrawdown = Math.max(maxDrawdown, ((peak - balance) / peak) * 100);
    }
    
    Object.assign(entry, {
      pnl: totalPnl,
      pnlPercent: (totalPnl / competition.rules.startingBalance) * 100,
      trades: trades.length,
      winRate,
      sharpe,
      maxDrawdown,
      lastUpdated: new Date().toISOString()
    });
    
    competition.leaderboard.sort((a: LeaderboardEntry, b: LeaderboardEntry) => {
      switch (competition.rules.rankBy) {
        case 'pnl': return b.pnl - a.pnl;
        case 'pnl_percent': return b.pnlPercent - a.pnlPercent;
        case 'sharpe': return b.sharpe - a.sharpe;
        case 'win_rate': return b.winRate - a.winRate;
        default: return b.pnl - a.pnl;
      }
    });
    competition.leaderboard.forEach((e: LeaderboardEntry, i: number) => e.rank = i + 1);
  }

  async getLeaderboard(competitionId: string): Promise<LeaderboardEntry[]> {
    const competition = await this.getCompetition(competitionId);
    return competition?.leaderboard || [];
  }

  async getAgentTrades(competitionId: string, agentId: string): Promise<CompetitionTrade[]> {
    const trades = (db.data as any).competition_trades || [];
    return trades.filter((t: CompetitionTrade) => t.competitionId === competitionId && t.agentId === agentId);
  }

  async getFeatured(): Promise<Competition[]> {
    const competitions = (db.data as any).competitions || [];
    return competitions
      .filter((c: Competition) => c.status === 'active' || c.status === 'upcoming')
      .sort((a: Competition, b: Competition) => b.prizePool - a.prizePool)
      .slice(0, 5);
  }

  async endCompetition(competitionId: string): Promise<{ success: boolean; winners?: LeaderboardEntry[]; error?: string }> {
    const competitions = (db.data as any).competitions || [];
    const competition = competitions.find((c: Competition) => c.id === competitionId);
    
    if (!competition) return { success: false, error: 'Competition not found' };
    if (competition.status === 'ended') return { success: false, error: 'Already ended' };
    
    competition.status = 'ended';
    competition.updatedAt = new Date().toISOString();
    const winners = competition.leaderboard.slice(0, competition.prizes.length);
    
    await db.write();
    return { success: true, winners };
  }
}

export const competitionService = new CompetitionService();
