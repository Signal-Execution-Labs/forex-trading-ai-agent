/**
 * Social Activity Feed Skill
 * Skill #63 - Follow wallets, track whales, copy trades
 */

export { SocialFeed, createSocialFeed } from './social-feed';

// Quick start helper
export async function quickStart(wallets: string[]) {
  const { SocialFeed } = await import('./social-feed');
  
  const feed = new SocialFeed({
    following: wallets.map(address => ({
      address,
      label: `Wallet ${address.slice(0, 8)}`,
      tags: [],
      notify: true,
      addedAt: new Date()
    }))
  });
  
  await feed.start();
  return feed;
}
