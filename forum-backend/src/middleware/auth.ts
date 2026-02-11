import { FastifyReply, FastifyRequest } from 'fastify';
import { AgentService } from '../services/agent.service.ts';

declare module 'fastify' {
  interface FastifyRequest {
    agent?: {
      id: string;
      name: string;
    };
  }
}

export async function authenticateAgent(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        success: false,
        error: 'Missing or invalid authorization header. Use: Bearer <api_key>',
      });
    }

    const token = authHeader.slice(7);
    
    // JWT token format: agent_id.api_key
    // Or just check if it starts with kit_ (legacy format)
    if (token.startsWith('kit_')) {
      // Simple API key auth - need agent_id in header or body
      const agentId = request.headers['x-agent-id'] as string;
      
      if (!agentId) {
        return reply.code(401).send({
          success: false,
          error: 'Missing X-Agent-ID header when using API key authentication',
        });
      }

      const isValid = await AgentService.validateApiKey(agentId, token);
      if (!isValid) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid API key',
        });
      }

      const agent = AgentService.getById(agentId);
      if (!agent) {
        return reply.code(401).send({
          success: false,
          error: 'Agent not found',
        });
      }

      request.agent = {
        id: agent.id,
        name: agent.name,
      };
    } else {
      // Try JWT verification
      try {
        const decoded = await request.jwtVerify<{ id: string; name: string }>();
        request.agent = {
          id: decoded.id,
          name: decoded.name,
        };
      } catch (err) {
        return reply.code(401).send({
          success: false,
          error: 'Invalid or expired token',
        });
      }
    }
  } catch (error) {
    return reply.code(500).send({
      success: false,
      error: 'Authentication error',
    });
  }
}

// Optional auth - doesn't fail if no token provided
export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const authHeader = request.headers.authorization;
  
  if (!authHeader) {
    return; // No auth provided, continue without agent context
  }

  try {
    await authenticateAgent(request, reply);
  } catch {
    // Silently continue without auth
  }
}
