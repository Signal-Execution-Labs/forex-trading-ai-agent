/**
 * Test Script: TTS Tools
 * Run with: npx ts-node scripts/test-tts.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Import the tool handlers
import {
  ttsSpeakToolHandler,
  ttsVoicesToolHandler,
  ttsPlayToolHandler,
} from '../src/tools/system/tts-tools';

import { ToolContext } from '../src/tools/system/tool-registry';

// Test context
const testContext: ToolContext = {
  workspaceDir: path.join(os.homedir(), '.kit', 'workspace'),
  configDir: path.join(os.homedir(), '.kit'),
  agentId: 'test',
};

async function testTTSTools() {
  console.log('🧪 Testing TTS Tools...\n');
  
  let allPassed = true;

  // Test 1: List voices
  console.log('1️⃣ Testing tts_voices tool...');
  try {
    const voicesResult = await ttsVoicesToolHandler({}, testContext) as any;
    
    if (voicesResult.success && voicesResult.providers) {
      console.log('   Available providers:');
      for (const [provider, info] of Object.entries(voicesResult.providers) as any) {
        console.log(`   - ${provider}: ${info.available ? '✅ Available' : '❌ No API key'}`);
        if (info.voices) {
          console.log(`     Voices: ${info.voices.slice(0, 5).join(', ')}${info.voices.length > 5 ? '...' : ''}`);
        }
      }
      console.log('   ✅ tts_voices works\n');
    } else {
      console.log('   ❌ tts_voices failed:', voicesResult);
      allPassed = false;
    }
  } catch (error) {
    console.log('   ❌ Error:', error);
    allPassed = false;
  }

  // Test 2: Check local TTS availability
  console.log('2️⃣ Checking local TTS availability...');
  const platform = os.platform();
  let localTTSAvailable = false;
  
  try {
    if (platform === 'darwin') {
      await execAsync('which say');
      console.log('   macOS: "say" command available');
      localTTSAvailable = true;
    } else if (platform === 'linux') {
      try {
        await execAsync('which espeak-ng');
        console.log('   Linux: "espeak-ng" available');
        localTTSAvailable = true;
      } catch {
        await execAsync('which espeak');
        console.log('   Linux: "espeak" available');
        localTTSAvailable = true;
      }
    } else if (platform === 'win32') {
      // Windows SAPI is always available
      console.log('   Windows: SAPI available (built-in)');
      localTTSAvailable = true;
    }
    
    if (localTTSAvailable) {
      console.log('   ✅ Local TTS is available\n');
    }
  } catch {
    console.log('   ⚠️ Local TTS not available on this system');
    console.log('   (This is OK if you have ElevenLabs or OpenAI API keys)\n');
  }

  // Test 3: Test tts_speak with local provider
  console.log('3️⃣ Testing tts_speak (local provider)...');
  try {
    // Ensure output directory exists
    const audioDir = path.join(testContext.configDir, 'audio');
    if (!fs.existsSync(audioDir)) {
      fs.mkdirSync(audioDir, { recursive: true });
    }

    const speakResult = await ttsSpeakToolHandler({
      text: 'Hello, this is a test of the K.I.T. text to speech system.',
      provider: 'local',
      filename: 'test_local',
    }, testContext) as any;

    if (speakResult.success) {
      console.log('   ✅ Local TTS generated successfully');
      console.log('   Audio file:', speakResult.audioPath);
      console.log('   File size:', speakResult.fileSize, 'bytes');
      
      // Clean up test file
      if (fs.existsSync(speakResult.audioPath)) {
        fs.unlinkSync(speakResult.audioPath);
        console.log('   🧹 Test file cleaned up\n');
      }
    } else {
      console.log('   ⚠️ Local TTS failed:', speakResult.error);
      console.log('   (This may be expected if no local TTS engine is installed)\n');
    }
  } catch (error) {
    console.log('   ⚠️ Local TTS error:', error);
    console.log('   (Continuing with other tests...)\n');
  }

  // Test 4: Test with ElevenLabs (if API key available)
  console.log('4️⃣ Testing ElevenLabs TTS...');
  if (process.env.ELEVENLABS_API_KEY) {
    try {
      const elevenResult = await ttsSpeakToolHandler({
        text: 'Hello from ElevenLabs.',
        provider: 'elevenlabs',
        voice: 'adam',
        filename: 'test_elevenlabs',
      }, testContext) as any;

      if (elevenResult.success) {
        console.log('   ✅ ElevenLabs TTS works!');
        console.log('   Audio file:', elevenResult.audioPath);
        
        // Clean up
        if (fs.existsSync(elevenResult.audioPath)) {
          fs.unlinkSync(elevenResult.audioPath);
          console.log('   🧹 Test file cleaned up\n');
        }
      } else {
        console.log('   ❌ ElevenLabs failed:', elevenResult.error);
        allPassed = false;
      }
    } catch (error) {
      console.log('   ❌ ElevenLabs error:', error);
      allPassed = false;
    }
  } else {
    console.log('   ⏭️ Skipped (ELEVENLABS_API_KEY not set)\n');
  }

  // Test 5: Test with OpenAI TTS (if API key available)
  console.log('5️⃣ Testing OpenAI TTS...');
  if (process.env.OPENAI_API_KEY) {
    try {
      const openaiResult = await ttsSpeakToolHandler({
        text: 'Hello from OpenAI.',
        provider: 'openai',
        voice: 'onyx',
        filename: 'test_openai',
      }, testContext) as any;

      if (openaiResult.success) {
        console.log('   ✅ OpenAI TTS works!');
        console.log('   Audio file:', openaiResult.audioPath);
        
        // Clean up
        if (fs.existsSync(openaiResult.audioPath)) {
          fs.unlinkSync(openaiResult.audioPath);
          console.log('   🧹 Test file cleaned up\n');
        }
      } else {
        console.log('   ❌ OpenAI TTS failed:', openaiResult.error);
        allPassed = false;
      }
    } catch (error) {
      console.log('   ❌ OpenAI TTS error:', error);
      allPassed = false;
    }
  } else {
    console.log('   ⏭️ Skipped (OPENAI_API_KEY not set)\n');
  }

  // Test 6: Test error handling
  console.log('6️⃣ Testing error handling...');
  try {
    const errorResult = await ttsSpeakToolHandler({
      text: '', // Empty text should fail
    }, testContext) as any;

    if (!errorResult.success && errorResult.error) {
      console.log('   ✅ Empty text correctly rejected');
      console.log('   Error message:', errorResult.error, '\n');
    } else {
      console.log('   ❌ Should have failed for empty text\n');
      allPassed = false;
    }
  } catch (error) {
    console.log('   ✅ Error correctly thrown for invalid input\n');
  }

  // Summary
  console.log('═'.repeat(50));
  if (allPassed) {
    console.log('✅ All TTS tests passed!');
  } else {
    console.log('⚠️ Some tests failed (check output above)');
  }
  console.log('═'.repeat(50));
  
  return allPassed;
}

// Run tests
testTTSTools()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
