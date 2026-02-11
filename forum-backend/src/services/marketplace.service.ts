/**
 * Strategy Marketplace Service
 * Premium strategies with subscriptions, ratings, and revenue sharing
 */

import { v4 as uuidv4 } from 'uuid';
import db from '../db/database.ts';

export interface MarketplaceListing {
  id: string;
  strategyId: string;
  sellerId: string;
  name: string;
  description: string;
  shortDescription: string;
  category: 'scalping' | 'swing' | 'position' | 'arbitrage' | 'grid' | 'dca' | 'ai' | 'other';
  assets: string[];
  timeframes: string[];
  pricing: PricingModel;
  performance: PerformanceMetrics;
  documentation: string;
  screenshots: string[];
  tags: string[];
  status: 'pending' | 'active' | 'suspended' | 'delisted';
  featured: boolean;
  verifiedSeller: boolean;
  ratings: Rating[];
  avgRating: number;
  totalReviews: number;
  totalSubscribers: number;
  totalRevenue: number;
  createdAt: string;
  updatedAt: string;
}

export interface PricingModel {
  type: 'free' | 'one_time' | 'subscription' | 'revenue_share';
  price?: number;
  monthlyPrice?: number;
  yearlyPrice?: number;
  revenueSharePercent?: number;
  trialDays?: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winRate: number;
  avgProfitPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  monthlyReturn: number;
  totalReturn: number;
  profitFactor: number;
  lastUpdated: string;
}

export interface Rating {
  id: string;
  agentId: string;
  rating: number;
  title: string;
  review: string;
  helpful: number;
  verified: boolean;
  createdAt: string;
}

export interface Subscription {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  type: 'one_time' | 'monthly' | 'yearly' | 'revenue_share';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  startDate: string;
  endDate?: string;
  trialEndDate?: string;
  price: number;
  revenueShared: number;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SellerProfile {
  agentId: string;
  displayName: string;
  bio: string;
  verified: boolean;
  totalListings: number;
  totalSubscribers: number;
  totalRevenue: number;
  avgRating: number;
  createdAt: string;
}

class MarketplaceService {
  async createListing(data: {
    strategyId: string;
    sellerId: string;
    name: string;
    description: string;
    shortDescription: string;
    category: MarketplaceListing['category'];
    assets: string[];
    timeframes: string[];
    pricing: PricingModel;
    documentation?: string;
    screenshots?: string[];
    tags?: string[];
  }): Promise<MarketplaceListing> {
    const listing: MarketplaceListing = {
      id: uuidv4(),
      ...data,
      documentation: data.documentation || '',
      screenshots: data.screenshots || [],
      tags: data.tags || [],
      performance: {
        totalTrades: 0, winRate: 0, avgProfitPercent: 0, maxDrawdown: 0,
        sharpeRatio: 0, monthlyReturn: 0, totalReturn: 0, profitFactor: 0,
        lastUpdated: new Date().toISOString()
      },
      status: 'pending',
      featured: false,
      verifiedSeller: false,
      ratings: [],
      avgRating: 0,
      totalReviews: 0,
      totalSubscribers: 0,
      totalRevenue: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    (db.data as any).marketplace_listings = (db.data as any).marketplace_listings || [];
    (db.data as any).marketplace_listings.push(listing);
    await db.write();
    return listing;
  }

  async getListing(id: string): Promise<MarketplaceListing | null> {
    const listings = (db.data as any).marketplace_listings || [];
    return listings.find((l: MarketplaceListing) => l.id === id) || null;
  }

  async browseListings(filters: {
    category?: string;
    priceType?: string;
    minRating?: number;
    search?: string;
    sortBy?: 'popular' | 'rating' | 'newest' | 'price_low' | 'price_high';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ listings: MarketplaceListing[]; total: number }> {
    let listings = ((db.data as any).marketplace_listings || [])
      .filter((l: MarketplaceListing) => l.status === 'active');
    
    if (filters.category) listings = listings.filter((l: MarketplaceListing) => l.category === filters.category);
    if (filters.priceType) listings = listings.filter((l: MarketplaceListing) => l.pricing.type === filters.priceType);
    if (filters.minRating) listings = listings.filter((l: MarketplaceListing) => l.avgRating >= filters.minRating!);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      listings = listings.filter((l: MarketplaceListing) => 
        l.name.toLowerCase().includes(s) || l.description.toLowerCase().includes(s) || l.tags.some(t => t.toLowerCase().includes(s)));
    }
    
    switch (filters.sortBy) {
      case 'rating': listings.sort((a: MarketplaceListing, b: MarketplaceListing) => b.avgRating - a.avgRating); break;
      case 'newest': listings.sort((a: MarketplaceListing, b: MarketplaceListing) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); break;
      case 'price_low': listings.sort((a: MarketplaceListing, b: MarketplaceListing) => (a.pricing.price || a.pricing.monthlyPrice || 0) - (b.pricing.price || b.pricing.monthlyPrice || 0)); break;
      case 'price_high': listings.sort((a: MarketplaceListing, b: MarketplaceListing) => (b.pricing.price || b.pricing.monthlyPrice || 0) - (a.pricing.price || a.pricing.monthlyPrice || 0)); break;
      default: listings.sort((a: MarketplaceListing, b: MarketplaceListing) => b.totalSubscribers - a.totalSubscribers);
    }
    
    const total = listings.length;
    return { listings: listings.slice(filters.offset || 0, (filters.offset || 0) + (filters.limit || 20)), total };
  }

  async subscribe(listingId: string, buyerId: string, subscriptionType: 'one_time' | 'monthly' | 'yearly'): Promise<{ success: boolean; subscription?: Subscription; error?: string }> {
    const listing = await this.getListing(listingId);
    if (!listing) return { success: false, error: 'Listing not found' };
    if (listing.status !== 'active') return { success: false, error: 'Listing not available' };
    if (listing.sellerId === buyerId) return { success: false, error: 'Cannot subscribe to own strategy' };
    
    const subscriptions = (db.data as any).subscriptions || [];
    if (subscriptions.find((s: Subscription) => s.listingId === listingId && s.buyerId === buyerId && s.status === 'active')) {
      return { success: false, error: 'Already subscribed' };
    }
    
    let price = 0, endDate: string | undefined;
    const now = new Date();
    if (subscriptionType === 'one_time') price = listing.pricing.price || 0;
    else if (subscriptionType === 'monthly') { price = listing.pricing.monthlyPrice || 0; endDate = new Date(now.setMonth(now.getMonth() + 1)).toISOString(); }
    else { price = listing.pricing.yearlyPrice || 0; endDate = new Date(now.setFullYear(now.getFullYear() + 1)).toISOString(); }
    
    const subscription: Subscription = {
      id: uuidv4(), listingId, buyerId, sellerId: listing.sellerId, type: subscriptionType,
      status: listing.pricing.trialDays ? 'trial' : 'active',
      startDate: new Date().toISOString(), endDate,
      trialEndDate: listing.pricing.trialDays ? new Date(Date.now() + listing.pricing.trialDays * 86400000).toISOString() : undefined,
      price, revenueShared: 0, autoRenew: subscriptionType !== 'one_time',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    
    (db.data as any).subscriptions = (db.data as any).subscriptions || [];
    (db.data as any).subscriptions.push(subscription);
    listing.totalSubscribers++;
    listing.totalRevenue += price;
    listing.updatedAt = new Date().toISOString();
    await db.write();
    return { success: true, subscription };
  }

  async cancelSubscription(subscriptionId: string, agentId: string): Promise<{ success: boolean; error?: string }> {
    const subscriptions = (db.data as any).subscriptions || [];
    const sub = subscriptions.find((s: Subscription) => s.id === subscriptionId);
    if (!sub) return { success: false, error: 'Subscription not found' };
    if (sub.buyerId !== agentId) return { success: false, error: 'Not your subscription' };
    if (sub.status === 'cancelled') return { success: false, error: 'Already cancelled' };
    sub.status = 'cancelled';
    sub.autoRenew = false;
    sub.updatedAt = new Date().toISOString();
    await db.write();
    return { success: true };
  }

  async addRating(listingId: string, agentId: string, rating: number, title: string, review: string): Promise<{ success: boolean; error?: string }> {
    const listings = (db.data as any).marketplace_listings || [];
    const listing = listings.find((l: MarketplaceListing) => l.id === listingId);
    if (!listing) return { success: false, error: 'Listing not found' };
    if (rating < 1 || rating > 5) return { success: false, error: 'Rating must be 1-5' };
    if (listing.ratings.some((r: Rating) => r.agentId === agentId)) return { success: false, error: 'Already reviewed' };
    
    const subscriptions = (db.data as any).subscriptions || [];
    const verified = !!subscriptions.find((s: Subscription) => s.listingId === listingId && s.buyerId === agentId);
    
    listing.ratings.push({ id: uuidv4(), agentId, rating, title, review, helpful: 0, verified, createdAt: new Date().toISOString() });
    listing.avgRating = listing.ratings.reduce((sum: number, r: Rating) => sum + r.rating, 0) / listing.ratings.length;
    listing.totalReviews = listing.ratings.length;
    listing.updatedAt = new Date().toISOString();
    await db.write();
    return { success: true };
  }

  async getMySubscriptions(agentId: string): Promise<Subscription[]> {
    return ((db.data as any).subscriptions || []).filter((s: Subscription) => s.buyerId === agentId);
  }

  async getSellerDashboard(sellerId: string): Promise<{ listings: MarketplaceListing[]; totalRevenue: number; totalSubscribers: number; avgRating: number; recentSubscriptions: Subscription[] }> {
    const listings = ((db.data as any).marketplace_listings || []).filter((l: MarketplaceListing) => l.sellerId === sellerId);
    const totalRevenue = listings.reduce((sum: number, l: MarketplaceListing) => sum + l.totalRevenue, 0);
    const totalSubscribers = listings.reduce((sum: number, l: MarketplaceListing) => sum + l.totalSubscribers, 0);
    const avgRating = listings.length > 0 ? listings.reduce((sum: number, l: MarketplaceListing) => sum + l.avgRating, 0) / listings.length : 0;
    const recentSubscriptions = ((db.data as any).subscriptions || [])
      .filter((s: Subscription) => s.sellerId === sellerId)
      .sort((a: Subscription, b: Subscription) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    return { listings, totalRevenue, totalSubscribers, avgRating, recentSubscriptions };
  }

  async getFeatured(): Promise<MarketplaceListing[]> {
    return ((db.data as any).marketplace_listings || [])
      .filter((l: MarketplaceListing) => l.status === 'active' && l.featured)
      .slice(0, 6);
  }

  async getTopSellers(limit: number = 10): Promise<SellerProfile[]> {
    const listings = (db.data as any).marketplace_listings || [];
    const sellerMap = new Map<string, SellerProfile>();
    for (const l of listings) {
      if (!sellerMap.has(l.sellerId)) {
        sellerMap.set(l.sellerId, { agentId: l.sellerId, displayName: l.sellerId, bio: '', verified: l.verifiedSeller, totalListings: 0, totalSubscribers: 0, totalRevenue: 0, avgRating: 0, createdAt: l.createdAt });
      }
      const s = sellerMap.get(l.sellerId)!;
      s.totalListings++;
      s.totalSubscribers += l.totalSubscribers;
      s.totalRevenue += l.totalRevenue;
      s.avgRating = (s.avgRating * (s.totalListings - 1) + l.avgRating) / s.totalListings;
    }
    return Array.from(sellerMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, limit);
  }

  async getCategories(): Promise<{ category: string; count: number }[]> {
    const listings = ((db.data as any).marketplace_listings || []).filter((l: MarketplaceListing) => l.status === 'active');
    return ['scalping', 'swing', 'position', 'arbitrage', 'grid', 'dca', 'ai', 'other'].map(cat => ({
      category: cat,
      count: listings.filter((l: MarketplaceListing) => l.category === cat).length
    }));
  }
}

export const marketplaceService = new MarketplaceService();
