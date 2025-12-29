// packages/llm/gemini/gemini.provider.ts

import { geminiClient } from './gemini.client';
import { calculateGeminiCost, GeminiModel } from './gemini.cost';

export interface GeminiGenerateInput {
  prompt: string;
  model?: GeminiModel;
}

export interface GeminiGenerateOutput {
  text: string;
  tokens: {
    input: number;
    output: number;
    total: number;
  };
  costUsd: number;
}

export class GeminiProvider {
  // Recommended models (Free Tier Friendly):
  // - gemini-2.5-flash: newest, fast, cheap, great for apps (default)
  // - gemini-2.5-pro: more reasoning power
  // - gemini-2.0-flash: also available
  // Note: Provider will automatically fallback to available models if requested one fails
  private readonly defaultModel: GeminiModel = 'gemini-2.5-flash';

  async generate(input: GeminiGenerateInput): Promise<GeminiGenerateOutput> {
    const requestedModel = input.model ?? this.defaultModel;

    // Fallback model candidates (try in order until one works)
    // Based on actual available models from API
    const modelCandidates: GeminiModel[] = [
      requestedModel,
      'gemini-2.5-flash',      // Newest, recommended
      'gemini-2.0-flash',      // Also available
      'gemini-2.0-flash-001',  // Stable version
      'gemini-flash-latest',   // Latest alias
      'gemini-2.5-pro',        // Pro version
      'gemini-pro-latest',     // Pro latest
    ];

    let lastError: any;
    let actualModelUsed: GeminiModel | null = null;

    // Try each model candidate until one succeeds
    for (const modelName of modelCandidates) {
      try {
        // The SDK automatically handles the 'models/' prefix
        const model = geminiClient.getGenerativeModel({
          model: modelName,
        });

        const result = await model.generateContent(input.prompt);
        const response = result.response;

        const text = response.text();

        // ---- Token usage (Gemini SDK dependent) ----
        const usage = response.usageMetadata;

        if (!usage) {
          throw new Error('Gemini response missing usageMetadata');
        }

        const inputTokens = usage.promptTokenCount ?? 0;
        const outputTokens = usage.candidatesTokenCount ?? 0;
        const totalTokens = inputTokens + outputTokens;

        actualModelUsed = modelName;
        const costUsd = calculateGeminiCost(modelName, inputTokens, outputTokens);

        // Log if we used a fallback model
        if (modelName !== requestedModel && process.env.NODE_ENV !== 'production') {
          console.log(`[GeminiProvider] Used fallback model: ${modelName} (requested: ${requestedModel})`);
        }

        return {
          text,
          tokens: {
            input: inputTokens,
            output: outputTokens,
            total: totalTokens,
          },
          costUsd,
        };
      } catch (err: any) {
        lastError = err;
        
        // If it's a 404 (model not found) or 429 with limit: 0 (no quota), try the next candidate
        const is404 = err?.status === 404 || err?.message?.includes('not found');
        const is429NoQuota = err?.status === 429 && err?.message?.includes('limit: 0');
        
        if (is404 || is429NoQuota) {
          const reason = is404 ? 'not found (404)' : 'no quota (429, limit: 0)';
          console.log(`[GeminiProvider] Model ${modelName} ${reason}, trying next candidate...`);
          continue;
        }
        
        // For 429 with retry delay, wait and retry the same model (or throw if last candidate)
        if (err?.status === 429 && !err?.message?.includes('limit: 0')) {
          const retryDelay = err?.errorDetails?.find((d: any) => d['@type']?.includes('RetryInfo'))?.retryDelay;
          if (retryDelay && modelName === modelCandidates[modelCandidates.length - 1]) {
            // Last candidate, throw with retry info
            throw new Error(`Rate limited. Retry after ${retryDelay}. Error: ${err?.message}`);
          }
          // Not last candidate, try next one
          console.log(`[GeminiProvider] Model ${modelName} rate limited, trying next candidate...`);
          continue;
        }
        
        // For other errors (auth, rate limit, etc.), throw immediately
        // Log full error details for debugging (always log in dev)
        console.error('[GeminiProvider] Error details for model', modelName, ':', {
          message: err?.message,
          status: err?.status,
          code: err?.code,
          errorDetails: err?.errorDetails,
          response: err?.response,
          url: err?.config?.url || err?.url,
          fullError: err,
        });
        throw err;
      }
    }

    // If we exhausted all candidates, throw the last error with full details
    console.error('[GeminiProvider] All model candidates failed. Last error:', {
      message: lastError?.message,
      status: lastError?.status,
      code: lastError?.code,
      errorDetails: lastError?.errorDetails,
      response: lastError?.response,
      url: lastError?.config?.url || lastError?.url,
      fullError: lastError,
    });
    
    throw new Error(
      `All model candidates failed. Last error: ${lastError?.message || 'Unknown error'}. ` +
      `Tried: ${modelCandidates.join(', ')}. ` +
      `Status: ${lastError?.status}, Details: ${JSON.stringify(lastError?.errorDetails || {})}`
    );
  }
}

