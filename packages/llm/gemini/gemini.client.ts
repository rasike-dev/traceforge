// packages/llm/gemini/gemini.client.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Get or create the Gemini client instance
 * Lazy initialization ensures .env is loaded before API key check
 */
function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set. Please set it in your .env file or environment variables.');
  }
  return new GoogleGenerativeAI(apiKey);
}

// Lazy singleton - only created when first accessed
let _geminiClient: GoogleGenerativeAI | undefined;

export const geminiClient = new Proxy({} as GoogleGenerativeAI, {
  get(_target, prop) {
    if (!_geminiClient) {
      _geminiClient = getGeminiClient();
    }
    return (_geminiClient as any)[prop];
  },
});

