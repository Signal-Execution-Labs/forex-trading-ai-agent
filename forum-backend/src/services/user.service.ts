/**
 * User Service - Manages GitHub users in Supabase
 */

import { getSupabase } from '../db/getSupabase().ts';

export interface User {
  id: string;
  github_id: number;
  username: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformConnection {
  id: string;
  user_id: string;
  platform: string;
  name: string;
  credentials: Record<string, any>;
  broker: string | null;
  account_type: string;
  is_active: boolean;
  last_sync_at: string | null;
  created_at: string;
}

export class UserService {
  /**
   * Find or create user by GitHub ID
   */
  static async findOrCreateByGitHub(githubUser: {
    id: number;
    login: string;
    email: string | null;
    name: string | null;
    avatar_url: string;
  }): Promise<User | null> {
    try {
      // First try to find existing user
      const { data: existing, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('github_id', githubUser.id)
        .single();

      if (existing && !findError) {
        // Update user info (name, avatar might have changed)
        const { data: updated, error: updateError } = await supabase
          .from('users')
          .update({
            username: githubUser.login,
            name: githubUser.name,
            avatar_url: githubUser.avatar_url,
            email: githubUser.email,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        return updated || existing;
      }

      // Create new user
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert({
          github_id: githubUser.id,
          username: githubUser.login,
          email: githubUser.email,
          name: githubUser.name,
          avatar_url: githubUser.avatar_url,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating user:', createError);
        return null;
      }

      return newUser;
    } catch (error) {
      console.error('UserService.findOrCreateByGitHub error:', error);
      return null;
    }
  }

  /**
   * Get user by ID
   */
  static async getById(id: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Get user by GitHub ID
   */
  static async getByGitHubId(githubId: number): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('github_id', githubId)
      .single();

    if (error) return null;
    return data;
  }

  // ========================================
  // PLATFORM CONNECTIONS
  // ========================================

  /**
   * Add a platform connection
   */
  static async addConnection(userId: string, connection: {
    platform: string;
    name: string;
    credentials: Record<string, any>;
    broker?: string;
    account_type?: string;
  }): Promise<PlatformConnection | null> {
    const { data, error } = await supabase
      .from('platform_connections')
      .insert({
        user_id: userId,
        platform: connection.platform,
        name: connection.name,
        credentials: connection.credentials,
        broker: connection.broker || null,
        account_type: connection.account_type || 'live',
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding connection:', error);
      return null;
    }

    return data;
  }

  /**
   * Get all connections for a user
   */
  static async getConnections(userId: string): Promise<PlatformConnection[]> {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching connections:', error);
      return [];
    }

    // Don't return full credentials, just indicate they exist
    return (data || []).map(conn => ({
      ...conn,
      credentials: { configured: true }, // Hide actual credentials
    }));
  }

  /**
   * Get a single connection with full credentials (for syncing)
   */
  static async getConnectionWithCredentials(connectionId: string, userId: string): Promise<PlatformConnection | null> {
    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('id', connectionId)
      .eq('user_id', userId) // Security: ensure user owns this connection
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Delete a connection
   */
  static async deleteConnection(connectionId: string, userId: string): Promise<boolean> {
    const { error } = await supabase
      .from('platform_connections')
      .delete()
      .eq('id', connectionId)
      .eq('user_id', userId);

    return !error;
  }

  /**
   * Update last sync time
   */
  static async updateLastSync(connectionId: string): Promise<void> {
    await supabase
      .from('platform_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connectionId);
  }
}
