/**
 * Test script for K.I.T. Onboarding Flow
 * Simulates user going through the entire onboarding process
 */

import { ToolEnabledChatHandler, getToolEnabledChatHandler } from './src/gateway/tool-enabled-chat';

// Mock callbacks
const sendChunk = (chunk: string) => {};
const sendToolCall = (name: string, args: any) => {};
const sendToolResult = (name: string, result: any) => {};

async function testOnboarding() {
  console.log('='.repeat(60));
  console.log('K.I.T. ONBOARDING TEST');
  console.log('='.repeat(60));
  
  const handler = new ToolEnabledChatHandler();
  const sessionId = 'test-session-' + Date.now();
  
  // Clear any existing API keys to test fresh onboarding
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.GROQ_API_KEY;
  delete process.env.XAI_API_KEY;
  
  const steps = [
    // Step 1: Start with trigger word
    { input: 'setup', expected: 'Step 1/12', desc: 'Start setup - should show provider selection' },
    // Step 2: Select OpenAI
    { input: '1', expected: 'Step 2/12', desc: 'Select OpenAI - should show model selection' },
    // Step 3: Select model
    { input: '2', expected: 'Step 3/12', desc: 'Select gpt-4o-mini - should ask for API key' },
    // Step 4: Enter API key (fake)
    { input: 'sk-proj-test12345678901234567890', expected: 'Step 4/12', desc: 'Enter API key - should show channel selection' },
    // Step 5: Skip channel
    { input: '4', expected: 'Step 6/12', desc: 'Skip channel - should show platform selection' },
    // Step 6: Select MT5
    { input: '2', expected: 'local', desc: 'Select MT5 - should ask to confirm ready (no credentials!)' },
    // Step 7: Confirm MT5 ready
    { input: 'ready', expected: 'Add another', desc: 'Confirm MT5 ready - should ask add more' },
    // Step 8: No more platforms
    { input: '2', expected: 'Step 7/12', desc: 'No more platforms - should show wallet selection' },
    // Step 9: Select MetaMask
    { input: '1', expected: 'Browser Extension', desc: 'Select MetaMask - should ask to confirm ready (NO seed phrase!)' },
    // Step 10: Confirm wallet ready
    { input: 'ready', expected: 'Add another', desc: 'Confirm MetaMask ready - should ask add more' },
    // Step 11: No more wallets
    { input: '2', expected: 'Step 8/12', desc: 'No more wallets - should show skills selection' },
    // Step 12: Select all skills
    { input: '10', expected: 'ALL skills', desc: 'Select all skills - should show name prompt' },
    // Step 13: Enter name
    { input: 'TestUser', expected: 'Step 10/12', desc: 'Enter name - should show goals selection' },
    // Step 14: Select goal
    { input: '1', expected: 'Step 11/12', desc: 'Select goal - should show risk selection' },
    // Step 15: Select risk
    { input: '2', expected: 'Step 12/12', desc: 'Select risk - should show style selection' },
    // Step 16: Select style (complete!)
    { input: '2', expected: 'Welcome', desc: 'Select style - should show completion message' },
  ];
  
  let allPassed = true;
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    console.log(`\n--- Step ${i + 1}: ${step.desc} ---`);
    console.log(`Input: "${step.input}"`);
    
    try {
      const response = await handler.processMessage(
        sessionId,
        step.input,
        sendChunk,
        sendToolCall,
        sendToolResult
      );
      
      console.log(`Response (first 200 chars):\n${response.substring(0, 200)}...`);
      
      if (response.includes(step.expected)) {
        console.log(`✅ PASS - Found expected: "${step.expected}"`);
      } else {
        console.log(`❌ FAIL - Expected to find: "${step.expected}"`);
        console.log(`Full response:\n${response}`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ERROR: ${error}`);
      allPassed = false;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  if (allPassed) {
    console.log('✅ ALL TESTS PASSED!');
  } else {
    console.log('❌ SOME TESTS FAILED - Review above');
  }
  console.log('='.repeat(60));
}

testOnboarding().catch(console.error);
