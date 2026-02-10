/**
 * Test script for web_search and web_fetch tools
 * Run with: npx ts-node test-web-tools.ts
 */

import { webSearchToolHandler, webFetchToolHandler } from './src/tools/system/web-tools';
import { ToolContext } from './src/tools/system/tool-registry';
import * as dotenv from 'dotenv';

// Load env
dotenv.config();

const mockContext: ToolContext = {
  workspaceDir: process.cwd(),
  configDir: process.cwd(),
  agentId: 'test',
};

async function testWebSearch() {
  console.log('\n=== Testing web_search ===\n');
  
  // Check if API key exists
  if (!process.env.BRAVE_API_KEY) {
    console.log('⚠️  BRAVE_API_KEY not set - skipping live search test');
    console.log('   Set BRAVE_API_KEY in .env to test live search\n');
    return false;
  }
  
  try {
    const result = await webSearchToolHandler({
      query: 'Bitcoin price today',
      count: 3,
    }, mockContext);
    
    console.log('✅ web_search result:');
    console.log(JSON.stringify(result, null, 2));
    return true;
  } catch (error) {
    console.error('❌ web_search failed:', error);
    return false;
  }
}

async function testWebFetch() {
  console.log('\n=== Testing web_fetch ===\n');
  
  try {
    const result = await webFetchToolHandler({
      url: 'https://httpbin.org/html',
      extractMode: 'markdown',
      maxChars: 5000,
    }, mockContext);
    
    console.log('✅ web_fetch result:');
    const r = result as any;
    console.log({
      url: r.url,
      finalUrl: r.finalUrl,
      title: r.title,
      contentType: r.contentType,
      charCount: r.charCount,
      truncated: r.truncated,
      contentPreview: r.content?.slice(0, 500) + '...',
    });
    return true;
  } catch (error) {
    console.error('❌ web_fetch failed:', error);
    return false;
  }
}

async function testWebFetchMarkdownConversion() {
  console.log('\n=== Testing web_fetch markdown conversion ===\n');
  
  try {
    const result = await webFetchToolHandler({
      url: 'https://example.com',
      extractMode: 'markdown',
    }, mockContext);
    
    console.log('✅ web_fetch (example.com) result:');
    const r = result as any;
    console.log({
      url: r.url,
      title: r.title,
      charCount: r.charCount,
    });
    console.log('\nContent:\n', r.content);
    return true;
  } catch (error) {
    console.error('❌ web_fetch markdown conversion failed:', error);
    return false;
  }
}

async function main() {
  console.log('🧪 K.I.T. Web Tools Test\n');
  console.log('========================');
  
  const results = {
    webFetch: await testWebFetch(),
    webFetchMarkdown: await testWebFetchMarkdownConversion(),
    webSearch: await testWebSearch(),
  };
  
  console.log('\n========================');
  console.log('📊 Test Results:');
  console.log('========================');
  
  for (const [test, passed] of Object.entries(results)) {
    console.log(`  ${passed ? '✅' : '❌'} ${test}`);
  }
  
  const allPassed = Object.values(results).every(r => r);
  console.log(`\n${allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'}\n`);
  
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
