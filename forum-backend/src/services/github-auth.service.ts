/**
 * GitHub OAuth Service for KitHub
 * Handles GitHub OAuth authentication flow
 */

// GitHub OAuth credentials - loaded from environment
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';
const KITHUB_REDIRECT_URI = process.env.KITHUB_REDIRECT_URI || 'https://kithub.finance/auth/callback.html';

interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  created_at: string;
  public_repos: number;
  followers: number;
}

interface GitHubAccessToken {
  access_token: string;
  token_type: string;
  scope: string;
}

export class GitHubAuthService {
  /**
   * Get the GitHub OAuth authorization URL
   */
  static getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: KITHUB_REDIRECT_URI,
      scope: 'read:user user:email',
      state: state || this.generateState(),
    });
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  static async exchangeCode(code: string): Promise<GitHubAccessToken | null> {
    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: KITHUB_REDIRECT_URI,
        }),
      });

      if (!response.ok) {
        console.error('GitHub token exchange failed:', response.status);
        return null;
      }

      const data = await response.json();
      if (data.error) {
        console.error('GitHub OAuth error:', data.error_description || data.error);
        return null;
      }

      return data as GitHubAccessToken;
    } catch (error) {
      console.error('GitHub token exchange error:', error);
      return null;
    }
  }

  /**
   * Get GitHub user profile using access token
   */
  static async getUser(accessToken: string): Promise<GitHubUser | null> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'KitHub-Finance',
        },
      });

      if (!response.ok) {
        console.error('GitHub user fetch failed:', response.status);
        return null;
      }

      return await response.json() as GitHubUser;
    } catch (error) {
      console.error('GitHub user fetch error:', error);
      return null;
    }
  }

  /**
   * Verify account is at least 1 week old (anti-spam)
   */
  static isAccountOldEnough(user: GitHubUser, minDays: number = 7): boolean {
    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= minDays;
  }

  /**
   * Generate random state for CSRF protection
   */
  static generateState(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Check if GitHub OAuth is configured
   */
  static isConfigured(): boolean {
    return GITHUB_CLIENT_ID.length > 0 && GITHUB_CLIENT_SECRET.length > 0;
  }
}
