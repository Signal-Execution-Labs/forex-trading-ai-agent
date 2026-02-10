/**
 * kitbot.finance Forum Tools
 * Allows K.I.T. to post directly to the forum without shell commands
 */

// Use localhost if on VPS, external IP otherwise
const FORUM_API = process.env.FORUM_API_URL || 'http://localhost:3001';

// K.I.T.'s pre-registered credentials
const KIT_CREDENTIALS = {
  agentId: 'bfd5bc79-ef0f-4c32-8206-c5472320f8df',
  apiKey: 'kit_c92de68bf8fe46489f3441a1d925b8d3'
};

let cachedJwt: string | null = null;

async function getJwt(): Promise<string> {
  if (cachedJwt) return cachedJwt;
  
  const res = await fetch(`${FORUM_API}/api/agents/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: KIT_CREDENTIALS.apiKey })
  });
  
  const data = await res.json();
  if (data.success && data.data?.token) {
    cachedJwt = data.data.token;
    return cachedJwt;
  }
  throw new Error(`Auth failed: ${JSON.stringify(data)}`);
}

export const forumTools = {
  forum_post: {
    name: 'forum_post',
    description: 'Post a message to kitbot.finance forum. Categories: general, signals, strategies, analysis',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Post title' },
        content: { type: 'string', description: 'Post content (supports markdown)' },
        category: { 
          type: 'string', 
          enum: ['general', 'signals', 'strategies', 'analysis'],
          description: 'Post category'
        }
      },
      required: ['title', 'content']
    },
    execute: async (params: { title: string; content: string; category?: string }) => {
      try {
        const jwt = await getJwt();
        
        const res = await fetch(`${FORUM_API}/api/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({
            title: params.title,
            content: params.content,
            category: params.category || 'general'
          })
        });
        
        const data = await res.json();
        
        if (data.success) {
          return {
            success: true,
            message: `Posted "${params.title}" to kitbot.finance!`,
            postId: data.data?.id,
            url: `https://kitbot.finance/kitview/#/post/${data.data?.id}`
          };
        } else {
          return { success: false, error: data.error || 'Unknown error' };
        }
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  },

  forum_signal: {
    name: 'forum_signal',
    description: 'Post a trading signal to kitbot.finance',
    parameters: {
      type: 'object',
      properties: {
        pair: { type: 'string', description: 'Trading pair (e.g., BTC/USDT)' },
        direction: { type: 'string', enum: ['LONG', 'SHORT'], description: 'Trade direction' },
        entry: { type: 'number', description: 'Entry price' },
        stopLoss: { type: 'number', description: 'Stop loss price' },
        takeProfit: { type: 'number', description: 'Take profit price' },
        confidence: { type: 'number', description: 'Confidence 0-100' },
        reasoning: { type: 'string', description: 'Why this trade?' }
      },
      required: ['pair', 'direction', 'entry']
    },
    execute: async (params: { 
      pair: string; 
      direction: 'LONG' | 'SHORT'; 
      entry: number;
      stopLoss?: number;
      takeProfit?: number;
      confidence?: number;
      reasoning?: string;
    }) => {
      const title = `📊 ${params.direction} ${params.pair} @ ${params.entry}`;
      const content = `
## Signal: ${params.direction} ${params.pair}

| Parameter | Value |
|-----------|-------|
| Entry | ${params.entry} |
| Stop Loss | ${params.stopLoss || 'TBD'} |
| Take Profit | ${params.takeProfit || 'TBD'} |
| Confidence | ${params.confidence || 50}% |

### Reasoning
${params.reasoning || 'Technical analysis signal'}

---
*Posted by K.I.T. - Künstliche Intelligenz Trading*
      `.trim();

      return forumTools.forum_post.execute({ title, content, category: 'signals' });
    }
  },

  forum_reply: {
    name: 'forum_reply',
    description: 'Reply to a post on kitbot.finance forum',
    parameters: {
      type: 'object',
      properties: {
        postId: { type: 'string', description: 'ID of the post to reply to' },
        content: { type: 'string', description: 'Reply content' }
      },
      required: ['postId', 'content']
    },
    execute: async (params: { postId: string; content: string }) => {
      try {
        const jwt = await getJwt();
        
        const res = await fetch(`${FORUM_API}/api/posts/${params.postId}/comments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({ content: params.content })
        });
        
        const data = await res.json();
        
        if (data.success) {
          return { success: true, message: 'Reply posted!' };
        } else {
          return { success: false, error: data.error || 'Unknown error' };
        }
      } catch (err) {
        return { success: false, error: String(err) };
      }
    }
  }
};

export default forumTools;
