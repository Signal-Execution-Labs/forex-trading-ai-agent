/**
 * K.I.T. Quick Start Example
 * 
 * Run with: npx ts-node examples/quick-start.ts
 */

import { startKit } from '../src';

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   ██╗  ██╗   ██╗   ████████╗                                     ║
║   ██║ ██╔╝   ██║   ╚══██╔══╝                                     ║
║   █████╔╝    ██║      ██║                                        ║
║   ██╔═██╗    ██║      ██║                                        ║
║   ██║  ██╗██╗██║██╗   ██║                                        ║
║   ╚═╝  ╚═╝╚═╝╚═╝╚═╝   ╚═╝                                        ║
║                                                                   ║
║   Knight Industries Trading - AI Financial Agent Framework        ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
  `);

  // Start K.I.T. with default config
  const gateway = await startKit({
    port: 18799,
    agentName: 'K.I.T.',
  });

  console.log(`
📡 Gateway is running!

Connect with:
  • Dashboard: http://localhost:18800 (run: kit dashboard)
  • WebSocket: ws://localhost:18799
  • CLI:       kit status

Press Ctrl+C to stop.
  `);

  // Keep alive
  process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down K.I.T...');
    await gateway.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Failed to start K.I.T.:', err);
  process.exit(1);
});
