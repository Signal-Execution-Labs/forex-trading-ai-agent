/**
 * K.I.T. Supported Channels
 * All communication channels like OpenClaw
 */

export interface ChannelInfo {
  id: string;
  name: string;
  description: string;
  status: 'ready' | 'beta' | 'coming';
  requiresToken?: boolean;
  requiresQR?: boolean;
  setupCommand?: string;
  icon: string;
}

export const SUPPORTED_CHANNELS: ChannelInfo[] = [
  // Ready channels
  {
    id: 'telegram',
    name: 'Telegram',
    description: 'Most popular - works on mobile & desktop',
    status: 'ready',
    requiresToken: true,
    setupCommand: 'kit telegram setup <token>',
    icon: '📱',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    description: 'Scan QR code like WhatsApp Web',
    status: 'ready',
    requiresQR: true,
    setupCommand: 'kit whatsapp login',
    icon: '💬',
  },
  {
    id: 'discord',
    name: 'Discord',
    description: 'Great for communities and servers',
    status: 'ready',
    requiresToken: true,
    setupCommand: 'kit discord setup <token>',
    icon: '🎮',
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Enterprise workplace communication',
    status: 'beta',
    requiresToken: true,
    setupCommand: 'kit slack setup',
    icon: '💼',
  },
  {
    id: 'signal',
    name: 'Signal',
    description: 'Secure encrypted messaging',
    status: 'beta',
    requiresQR: true,
    setupCommand: 'kit signal login',
    icon: '🔒',
  },
  
  // Beta channels
  {
    id: 'msteams',
    name: 'Microsoft Teams',
    description: 'Enterprise collaboration',
    status: 'beta',
    requiresToken: true,
    icon: '🏢',
  },
  {
    id: 'googlechat',
    name: 'Google Chat',
    description: 'Google Workspace integration',
    status: 'beta',
    requiresToken: true,
    icon: '📧',
  },
  {
    id: 'matrix',
    name: 'Matrix',
    description: 'Decentralized communication',
    status: 'beta',
    requiresToken: true,
    icon: '🌐',
  },
  
  // Coming soon
  {
    id: 'imessage',
    name: 'iMessage',
    description: 'Apple Messages (requires Mac)',
    status: 'coming',
    icon: '🍎',
  },
  {
    id: 'line',
    name: 'LINE',
    description: 'Popular in Asia',
    status: 'coming',
    icon: '🟢',
  },
  {
    id: 'twitch',
    name: 'Twitch',
    description: 'Streaming platform chat',
    status: 'coming',
    icon: '🎬',
  },
  {
    id: 'mattermost',
    name: 'Mattermost',
    description: 'Self-hosted Slack alternative',
    status: 'coming',
    icon: '💭',
  },
  {
    id: 'nostr',
    name: 'Nostr',
    description: 'Decentralized social protocol',
    status: 'coming',
    icon: '⚡',
  },
];

export const READY_CHANNELS = SUPPORTED_CHANNELS.filter(c => c.status === 'ready');
export const BETA_CHANNELS = SUPPORTED_CHANNELS.filter(c => c.status === 'beta');
export const COMING_CHANNELS = SUPPORTED_CHANNELS.filter(c => c.status === 'coming');

export function getChannelById(id: string): ChannelInfo | undefined {
  return SUPPORTED_CHANNELS.find(c => c.id === id);
}
