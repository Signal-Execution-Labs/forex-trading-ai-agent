/**
 * GitHub OAuth Routes for KitHub
 * /api/auth/github/* endpoints
 */

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GitHubAuthService } from '../services/github-auth.service.ts';
import { UserService } from '../services/user.service.ts';

export async function githubAuthRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/auth/github/status (alias: /check)
   * Check if GitHub OAuth is configured
   */
  const statusHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const configured = GitHubAuthService.isConfigured();
    return {
      configured,
      authUrl: configured ? GitHubAuthService.getAuthUrl() : null,
    };
  };

  fastify.get('/status', {
    schema: {
      description: 'Check GitHub OAuth configuration status',
      tags: ['Auth'],
      response: {
        200: {
          type: 'object',
          properties: {
            configured: { type: 'boolean' },
            authUrl: { type: 'string' },
          },
        },
      },
    },
  }, statusHandler);

  // Alias for backwards compatibility
  fastify.get('/check', {
    schema: {
      description: 'Alias for /status - Check GitHub OAuth configuration',
      tags: ['Auth'],
    },
  }, statusHandler);

  /**
   * GET /api/auth/github/login
   * Redirect to GitHub OAuth
   */
  fastify.get('/login', {
    schema: {
      description: 'Redirect to GitHub OAuth authorization',
      tags: ['Auth'],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!GitHubAuthService.isConfigured()) {
      return reply.status(503).send({ 
        error: 'GitHub OAuth not configured',
        message: 'Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables',
      });
    }

    const state = GitHubAuthService.generateState();
    const authUrl = GitHubAuthService.getAuthUrl(state);
    
    return reply.redirect(authUrl);
  });

  /**
   * POST /api/auth/github/callback
   * Exchange authorization code for tokens and user info
   */
  fastify.post('/callback', {
    schema: {
      description: 'Exchange GitHub authorization code for access token and user info',
      tags: ['Auth'],
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', description: 'Authorization code from GitHub' },
          state: { type: 'string', description: 'State for CSRF protection' },
          source: { type: 'string', description: 'Source app (kitbot or kithub)' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { code: string; state?: string; source?: string } }>, reply: FastifyReply) => {
    const { code, state, source } = request.body;

    if (!GitHubAuthService.isConfigured()) {
      return reply.status(503).send({
        error: 'not_configured',
        message: 'GitHub OAuth not configured on server',
      });
    }

    // Exchange code for access token
    const tokenData = await GitHubAuthService.exchangeCode(code, source);
    if (!tokenData) {
      return reply.status(400).send({
        error: 'invalid_code',
        message: 'Failed to exchange authorization code. It may have expired.',
      });
    }

    // Get user profile
    const githubUser = await GitHubAuthService.getUser(tokenData.access_token);
    if (!githubUser) {
      return reply.status(400).send({
        error: 'user_fetch_failed',
        message: 'Failed to fetch GitHub user profile',
      });
    }

    // Check account age (min 7 days)
    const accountAgeDays = Math.floor(
      (Date.now() - new Date(githubUser.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (!GitHubAuthService.isAccountOldEnough(githubUser, 7)) {
      return reply.status(403).send({
        error: 'account_too_new',
        message: `GitHub account must be at least 7 days old. Your account is ${accountAgeDays} days old.`,
        accountAge: accountAgeDays,
        requiredAge: 7,
      });
    }

    // Find or create user in database
    const dbUser = await UserService.findOrCreateByGitHub({
      id: githubUser.id,
      login: githubUser.login,
      email: githubUser.email,
      name: githubUser.name,
      avatar_url: githubUser.avatar_url,
    });

    console.log('GitHub login - dbUser:', dbUser ? `created/found with ID ${dbUser.id}` : 'FAILED to create');

    // Generate JWT token with userId for authenticated routes
    const jwtToken = fastify.jwt.sign({
      userId: dbUser?.id,  // Supabase UUID for journal routes
      githubId: githubUser.id,
      login: githubUser.login,
      name: githubUser.name,
      avatar: githubUser.avatar_url,
    }, { expiresIn: '30d' });

    return {
      success: true,
      user: {
        id: dbUser?.id || `github_${githubUser.id}`,  // Use DB UUID if available
        githubId: githubUser.id,
        login: githubUser.login,
        name: githubUser.name,
        email: githubUser.email,
        avatar_url: githubUser.avatar_url,
        accountAgeDays,
      },
      token: jwtToken,
    };
  });

  /**
   * GET /api/auth/github/me
   * Get current user from JWT token
   */
  fastify.get('/me', {
    schema: {
      description: 'Get current authenticated user',
      tags: ['Auth'],
      security: [{ bearerAuth: [] }],
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      return request.user;
    } catch (err) {
      return reply.status(401).send({ error: 'Invalid or expired token' });
    }
  });
}
