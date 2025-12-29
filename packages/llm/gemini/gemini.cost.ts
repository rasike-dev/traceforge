// packages/llm/gemini/gemini.cost.ts

export type GeminiModel = 
  | 'gemini-2.5-flash'      // Recommended: fast, cheap, great for apps
  | 'gemini-2.5-pro'        // More reasoning power
  | 'gemini-2.0-flash'      // Also available
  | 'gemini-2.0-flash-001'  // Stable version
  | 'gemini-flash-latest'    // Latest flash
  | 'gemini-pro-latest'     // Latest pro
  | 'gemini-1.5-flash'      // Legacy (may not be available)
  | 'gemini-1.5-pro'        // Legacy
  | 'gemini-pro';            // Legacy

const MODEL_PRICING: Record<GeminiModel, { input: number; output: number }> = {
  // Gemini 2.5 (newest, recommended)
  'gemini-2.5-flash': {
    input: 0.000075 / 1000,  // Fast and cheap
    output: 0.0003 / 1000,
  },
  'gemini-2.5-pro': {
    input: 0.00125 / 1000,  // More reasoning power
    output: 0.005 / 1000,
  },
  // Gemini 2.0
  'gemini-2.0-flash': {
    input: 0.000075 / 1000,
    output: 0.0003 / 1000,
  },
  'gemini-2.0-flash-001': {
    input: 0.000075 / 1000,
    output: 0.0003 / 1000,
  },
  // Latest aliases
  'gemini-flash-latest': {
    input: 0.000075 / 1000,
    output: 0.0003 / 1000,
  },
  'gemini-pro-latest': {
    input: 0.00125 / 1000,
    output: 0.005 / 1000,
  },
  // Legacy (may not be available)
  'gemini-1.5-flash': {
    input: 0.000075 / 1000,
    output: 0.0003 / 1000,
  },
  'gemini-1.5-pro': {
    input: 0.00125 / 1000,
    output: 0.005 / 1000,
  },
  'gemini-pro': {
    input: 0.0005 / 1000,
    output: 0.0015 / 1000,
  },
};

export function calculateGeminiCost(
  model: GeminiModel,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = MODEL_PRICING[model];
  return inputTokens * pricing.input + outputTokens * pricing.output;
}

