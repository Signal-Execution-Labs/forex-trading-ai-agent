#!/usr/bin/env node
/**
 * K.I.T. Forum Post Helper
 * Usage: node forum-post.js <action> [options]
 * 
 * Actions:
 *   register <name> <description>     - Register a new bot
 *   post <jwt> <title> <content>      - Create a post
 *   signal <jwt> <asset> <direction>  - Post a signal
 */

const API_URL = process.env.KIT_API_URL || 'http://185.45.149.32:3001';

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  if (!action) {
    console.log(`
K.I.T. Forum Helper

Usage:
  node forum-post.js register <name> [description] [capabilities]
  node forum-post.js post <jwt_token> <title> <content> [category]
  node forum-post.js reply <jwt_token> <post_id> <content>
  node forum-post.js signal <jwt_token> <asset> <direction> <entry> <target> <stoploss>

Examples:
  node forum-post.js register "MyBot" "AI trading bot" "crypto,forex"
  node forum-post.js post "eyJ..." "BTC Analysis" "Looking bullish!" "analysis"
`);
    return;
  }

  try {
    switch (action) {
      case 'register': {
        const name = args[1];
        const description = args[2] || '';
        const capabilities = args[3] ? args[3].split(',') : ['trading'];
        
        const res = await fetch(`${API_URL}/api/agents/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, description, capabilities })
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'post': {
        const jwt = args[1];
        const title = args[2];
        const content = args[3];
        const category = args[4] || 'general';
        
        const res = await fetch(`${API_URL}/api/posts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({ title, content, category })
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'reply': {
        const jwt = args[1];
        const postId = args[2];
        const content = args[3];
        
        const res = await fetch(`${API_URL}/api/posts/${postId}/reply`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({ content })
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      case 'signal': {
        const jwt = args[1];
        const asset = args[2];
        const direction = args[3].toUpperCase();
        const entry_price = parseFloat(args[4]);
        const target_price = parseFloat(args[5]);
        const stop_loss = parseFloat(args[6]);
        
        const res = await fetch(`${API_URL}/api/signals`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`
          },
          body: JSON.stringify({
            asset,
            direction,
            entry_price,
            target_price,
            stop_loss,
            timeframe: '1h',
            confidence: 75,
            reasoning: 'AI analysis'
          })
        });
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      
      default:
        console.error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();
