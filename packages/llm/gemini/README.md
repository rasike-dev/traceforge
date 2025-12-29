# Gemini LLM Provider

Production-grade Gemini provider for TraceForge.

## Structure

- `gemini.client.ts` - SDK initialization (fail-fast if API key missing)
- `gemini.cost.ts` - Explicit cost model with per-token pricing
- `gemini.provider.ts` - Core provider interface
- `index.ts` - Clean exports

## Usage

```typescript
import { GeminiProvider } from '@traceforge/llm/gemini';

const provider = new GeminiProvider();

const res = await provider.generate({
  prompt: 'Explain what observability means in distributed systems.',
  model: 'gemini-1.5-flash', // optional, defaults to gemini-1.5-flash
});

// Result structure:
// {
//   text: string;
//   tokens: { input: number; output: number; total: number };
//   costUsd: number;
// }
```

## Environment Variables

**Required:**
- `GEMINI_API_KEY` - Your Google Gemini API key (must be set, fails fast if missing)

## Supported Models

- `gemini-1.5-flash` (default) - Fast and cost-effective

## Pricing

Pricing is calculated per-token:
- `gemini-1.5-flash`: $0.000075 per 1K input tokens, $0.0003 per 1K output tokens

## Testing

Quick sanity test (requires `GEMINI_API_KEY`):

```bash
export GEMINI_API_KEY=your_key_here
npx ts-node packages/llm/gemini/test-gemini.ts
```

Expected output:
- ✅ Non-empty text
- ✅ Tokens > 0
- ✅ Cost > 0

