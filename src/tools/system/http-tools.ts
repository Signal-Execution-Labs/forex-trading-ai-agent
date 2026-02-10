/**
 * K.I.T. HTTP Tools
 * Simple HTTP request tool like OpenClaw's web_fetch
 */

export const httpRequestToolDefinition = {
  name: 'http_request',
  description: 'Make HTTP requests to APIs. Use this instead of curl/exec for API calls.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to request' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], description: 'HTTP method (default: GET)' },
      headers: { type: 'object', description: 'Request headers as key-value pairs' },
      body: { type: 'object', description: 'Request body (will be JSON stringified)' },
      timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)' }
    },
    required: ['url']
  }
};

export async function httpRequestToolHandler(params: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}): Promise<any> {
  const { url, method = 'GET', headers = {}, body, timeout = 30000 } = params;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      signal: controller.signal
    };
    
    if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }
    
    return {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      data
    };
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return {
        success: false,
        error: 'Request timeout',
        timeout: true
      };
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

// Convenience tool for JSON APIs
export const jsonApiToolDefinition = {
  name: 'json_api',
  description: 'Simple JSON API call. Automatically handles headers and JSON parsing.',
  parameters: {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'API endpoint URL' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], description: 'HTTP method' },
      data: { type: 'object', description: 'Data to send (for POST/PUT)' },
      auth_token: { type: 'string', description: 'Bearer token for Authorization header' }
    },
    required: ['url']
  }
};

export async function jsonApiToolHandler(params: {
  url: string;
  method?: string;
  data?: any;
  auth_token?: string;
}): Promise<any> {
  const headers: Record<string, string> = {};
  
  if (params.auth_token) {
    headers['Authorization'] = `Bearer ${params.auth_token}`;
  }
  
  return httpRequestToolHandler({
    url: params.url,
    method: params.method || (params.data ? 'POST' : 'GET'),
    headers,
    body: params.data
  });
}

// Pre-configured kitbot.finance tools
const KITBOT_API = 'http://185.45.149.32:3001';

export const kitbotRegisterToolDefinition = {
  name: 'kitbot_register',
  description: 'Register as a bot on kitbot.finance AI trading forum. Returns JWT token for posting.',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Unique bot name' },
      description: { type: 'string', description: 'Bot description' },
      capabilities: { type: 'array', items: { type: 'string' }, description: 'Capabilities like crypto, forex, ml' }
    },
    required: ['name']
  }
};

export async function kitbotRegisterToolHandler(params: {
  name: string;
  description?: string;
  capabilities?: string[];
}): Promise<any> {
  return httpRequestToolHandler({
    url: `${KITBOT_API}/api/agents/register`,
    method: 'POST',
    body: {
      name: params.name,
      description: params.description || '',
      capabilities: params.capabilities || ['trading']
    }
  });
}

export const kitbotPostToolDefinition = {
  name: 'kitbot_post',
  description: 'Create a post on kitbot.finance forum. Requires JWT token from registration.',
  parameters: {
    type: 'object',
    properties: {
      jwt_token: { type: 'string', description: 'JWT token from registration' },
      title: { type: 'string', description: 'Post title' },
      content: { type: 'string', description: 'Post content' },
      category: { type: 'string', enum: ['general', 'strategies', 'signals', 'analysis', 'news', 'help'], description: 'Category' }
    },
    required: ['jwt_token', 'title', 'content']
  }
};

export async function kitbotPostToolHandler(params: {
  jwt_token: string;
  title: string;
  content: string;
  category?: string;
}): Promise<any> {
  return httpRequestToolHandler({
    url: `${KITBOT_API}/api/posts`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.jwt_token}`
    },
    body: {
      title: params.title,
      content: params.content,
      category: params.category || 'general'
    }
  });
}

export const kitbotSignalToolDefinition = {
  name: 'kitbot_signal',
  description: 'Post a trading signal on kitbot.finance',
  parameters: {
    type: 'object',
    properties: {
      jwt_token: { type: 'string', description: 'JWT token from registration' },
      asset: { type: 'string', description: 'Trading pair like BTC/USDT' },
      direction: { type: 'string', enum: ['LONG', 'SHORT'], description: 'Trade direction' },
      entry_price: { type: 'number', description: 'Entry price' },
      target_price: { type: 'number', description: 'Take profit' },
      stop_loss: { type: 'number', description: 'Stop loss' },
      reasoning: { type: 'string', description: 'Analysis reasoning' },
      confidence: { type: 'number', description: 'Confidence 0-100' },
      timeframe: { type: 'string', description: 'Timeframe like 1h, 4h' }
    },
    required: ['jwt_token', 'asset', 'direction', 'entry_price', 'target_price', 'stop_loss']
  }
};

export async function kitbotSignalToolHandler(params: {
  jwt_token: string;
  asset: string;
  direction: 'LONG' | 'SHORT';
  entry_price: number;
  target_price: number;
  stop_loss: number;
  reasoning?: string;
  confidence?: number;
  timeframe?: string;
}): Promise<any> {
  return httpRequestToolHandler({
    url: `${KITBOT_API}/api/signals`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.jwt_token}`
    },
    body: {
      asset: params.asset,
      direction: params.direction,
      entry_price: params.entry_price,
      target_price: params.target_price,
      stop_loss: params.stop_loss,
      reasoning: params.reasoning || 'AI Analysis',
      confidence: params.confidence || 75,
      timeframe: params.timeframe || '1h'
    }
  });
}

// Export all HTTP tools
export const HTTP_TOOLS = [
  httpRequestToolDefinition,
  jsonApiToolDefinition,
  kitbotRegisterToolDefinition,
  kitbotPostToolDefinition,
  kitbotSignalToolDefinition
];

export const HTTP_HANDLERS = {
  http_request: httpRequestToolHandler,
  json_api: jsonApiToolHandler,
  kitbot_register: kitbotRegisterToolHandler,
  kitbot_post: kitbotPostToolHandler,
  kitbot_signal: kitbotSignalToolHandler
};
