import type { AskRequest, AskResponse, EvalScores } from './types';

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// Mock implementations (Phase A)
async function mockRag(input: string, badRag?: boolean) {
  if (badRag) return { context: 'irrelevant context about something else', docs: 0 };
  return { context: `relevant context for: ${input}`, docs: 3 };
}

async function mockToolCall(breakTool?: boolean) {
  if (breakTool) {
    const err = new Error('Tool timeout');
    (err as any).code = 'TOOL_TIMEOUT';
    throw err;
  }
  return { toolResult: 'tool-ok', toolName: 'mock.weather' };
}

async function mockLlmGenerate(prompt: string, tokenSpike?: boolean) {
  const output = `Answer (mock): ${prompt.slice(0, 200)}...`;
  const inputTokens = tokenSpike ? 3500 : 200;
  const outputTokens = tokenSpike ? 1200 : 120;
  const totalTokens = inputTokens + outputTokens;

  // cheap deterministic estimate (replace later with real pricing model)
  const costUsdEstimate = totalTokens * 0.000001;

  return {
    text: output,
    modelName: 'mock-gemini',
    inputTokens,
    outputTokens,
    totalTokens,
    costUsdEstimate,
  };
}

function evaluate(answer: string, context: string, flags?: AskRequest['chaos']): EvalScores {
  // Rule-based mock scoring (fast + deterministic)
  const relevance = context.includes('relevant') ? 0.9 : 0.3;
  const faithfulness = context.includes('relevant') ? 0.88 : 0.45;

  const policyRisk = flags?.policyRisk ? 0.9 : 0.1;
  const formatCompliance: 0 | 1 = answer.length > 0 ? 1 : 0;

  // "hallucination suspected" when faithfulness low
  const hallucinationSuspected: 0 | 1 = faithfulness < 0.7 ? 1 : 0;

  return {
    faithfulness: clamp01(faithfulness),
    relevance: clamp01(relevance),
    policyRisk: clamp01(policyRisk),
    formatCompliance,
    hallucinationSuspected,
  };
}

function remediate(scores: EvalScores, toolFailed: boolean) {
  if (scores.policyRisk > 0.7) return 'SAFE_MODE';
  if (toolFailed) return 'FALLBACK_TOOL';
  if (scores.faithfulness < 0.8) return 'ASK_CLARIFY';
  return undefined;
}

export async function orchestrate(req: AskRequest): Promise<AskResponse> {
  const rag = await mockRag(req.input, req.chaos?.badRag);

  let toolFailed = false;
  try {
    await mockToolCall(req.chaos?.breakTool);
  } catch {
    toolFailed = true;
  }

  const prompt = `User: ${req.input}\nContext: ${rag.context}`;
  const llm = await mockLlmGenerate(prompt, req.chaos?.tokenSpike);

  const scores = evaluate(llm.text, rag.context, req.chaos);
  const remediationApplied = remediate(scores, toolFailed);

  let answer = llm.text;

  // Apply remediation result deterministically
  if (remediationApplied === 'SAFE_MODE') {
    answer = `Safe mode: I can't help with that request. Please rephrase or provide a safer alternative.`;
  } else if (remediationApplied === 'FALLBACK_TOOL') {
    answer = `${answer}\n\n(Note: tool degraded; returned fallback response.)`;
  } else if (remediationApplied === 'ASK_CLARIFY') {
    answer = `I might be missing context. Can you clarify what exactly you mean by: "${req.input}"?`;
  }

  return {
    requestId: req.requestId,
    answer,
    scores,
    meta: {
      modelName: llm.modelName,
      inputTokens: llm.inputTokens,
      outputTokens: llm.outputTokens,
      totalTokens: llm.totalTokens,
      costUsdEstimate: llm.costUsdEstimate,
      remediationApplied,
    },
  };
}

