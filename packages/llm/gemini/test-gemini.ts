/**
 * Quick sanity test for GeminiProvider
 * 
 * Usage:
 *   export GEMINI_API_KEY=your_key_here
 *   npx ts-node packages/llm/gemini/test-gemini.ts
 * 
 * Expected:
 *   ✅ Non-empty text
 *   ✅ Tokens > 0
 *   ✅ Cost > 0
 */

import { GeminiProvider } from './gemini.provider';

async function test() {
  const provider = new GeminiProvider();

  const res = await provider.generate({
    prompt: 'Explain what observability means in distributed systems.',
  });

  console.log('=== Gemini Provider Test ===');
  console.log('Text:', res.text.substring(0, 200) + '...');
  console.log('Tokens:', res.tokens);
  console.log('Cost USD:', res.costUsd);
  console.log('✅ Test passed!');
}

test().catch((err) => {
  console.error('❌ Test failed:', err.message);
  process.exit(1);
});

