/**
 * Onboarding Complete Hook Handler
 * Fires when onboarding wizard completes successfully
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HookHandler } from '../../types.js';

interface OnboardingData {
  userName?: string;
  tradingStyle?: string;
  riskLevel?: string;
  markets?: string[];
  exchanges?: string[];
}

const handler: HookHandler = async (ctx) => {
  const kitHome = path.join(
    process.env.HOME || process.env.USERPROFILE || '',
    '.kit'
  );
  const statePath = path.join(kitHome, 'state', 'onboarded.json');
  const logPath = path.join(kitHome, 'logs', 'onboarding.log');
  
  // Ensure directories exist
  for (const p of [path.dirname(statePath), path.dirname(logPath)]) {
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  }
  
  const data: OnboardingData = ctx.data || {};
  const now = ctx.timestamp;
  
  // Create onboarded state
  const onboardedState = {
    completedAt: now.toISOString(),
    userName: data.userName || 'Trader',
    tradingStyle: data.tradingStyle || 'balanced',
    riskLevel: data.riskLevel || 'medium',
    markets: data.markets || ['crypto'],
    exchanges: data.exchanges || [],
    version: '2.0.0',
  };
  
  fs.writeFileSync(statePath, JSON.stringify(onboardedState, null, 2));
  
  // Log completion
  const logEntry = {
    event: 'onboarding_complete',
    timestamp: now.toISOString(),
    ...onboardedState,
  };
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
  
  // Push welcome message
  if (ctx.messages) {
    const name = data.userName || 'there';
    ctx.messages.push(
`🎉 Welcome to K.I.T., ${name}!

Your AI financial agent is ready. Here's what's next:

🚀 Quick Start:
   • kit start     — Launch dashboard & gateway
   • kit status    — Check system health
   • kit balance   — View portfolio

💡 First Day Tips:
   • Start with paper trading to test strategies
   • Set up 2FA on all connected exchanges
   • Review your risk settings in the dashboard

📚 Learn more: https://github.com/kayzaa/k.i.t.-bot

"Your wealth is my mission." 🚗`
    );
  }
};

export default handler;
