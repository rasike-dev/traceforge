import type { AskRequest, AskResponse, EvalScores } from './types';
import { tracer, setCommonSpanAttrs, markError } from './otel';
import { m } from './metrics';
import { performance } from 'perf_hooks';
import { trace, SpanStatusCode, SpanKind } from '@opentelemetry/api';

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
  const start = performance.now();

  m.requests.add(1, {
    tenant: req.tenant ?? 'unknown',
  });

  return tracer.startActiveSpan('orchestrator.plan', (planSpan) => {
    try {
      // Set llm_stage inside startActiveSpan callback (required for Datadog metrics)
      planSpan.setAttribute('llm_stage', 'orchestrator.plan');
      setCommonSpanAttrs(planSpan, {
        'app.request_id': req.requestId,
        'app.tenant': req.tenant ?? 'unknown',
        'app.chaos': req.chaos ?? {},
      });

      return doOrchestrate(req, planSpan, start);
    } catch (err) {
      planSpan.recordException(err as Error);
      planSpan.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      planSpan.end();
    }
  });
}

async function doOrchestrate(req: AskRequest, planSpan: any, start: number): Promise<AskResponse> {
  // --- RAG span ---
  // Use SpanKind.CLIENT so Datadog counts it for trace.span.errors
  // INTERNAL spans are often excluded from error stats
  const rag = await tracer.startActiveSpan('rag.retrieve', { kind: SpanKind.CLIENT }, async (span) => {
    try {
      // Set llm_stage inside startActiveSpan callback (required for Datadog metrics)
      span.setAttribute('llm_stage', 'rag.retrieve');
      const t0 = performance.now();
      const result = await mockRag(req.input, req.chaos?.badRag);
      m.ragLatencyMs.record(performance.now() - t0, {
        tenant: req.tenant ?? 'unknown',
        bad_rag: !!req.chaos?.badRag,
      });
      setCommonSpanAttrs(span, {
        'rag.docs': result.docs,
        'rag.bad': !!req.chaos?.badRag,
      });
      
      // Step 4B: Force ONE controlled error for observability test
      // This ensures trace.span.errors increments in Datadog
      const forcedError = new Error('forced error for observability test');
      span.recordException(forcedError);
      span.setStatus({ code: SpanStatusCode.ERROR, message: 'forced error for observability test' });
      
      span.end();
      return result;
    } catch (e) {
      markError(span, e);
      span.end();
      throw e;
    }
  });

  // --- TOOL span ---
  let toolFailed = false;
  const toolName = 'mock.weather';
  await tracer.startActiveSpan('tool.call', async (span) => {
    const t0 = performance.now();
    try {
      // Set attributes inside startActiveSpan callback (required for Datadog metrics)
      span.setAttribute('tool.name', toolName);
      span.setAttribute('tool_name', toolName);
      span.setAttribute('llm_stage', 'tool.call');
      await mockToolCall(req.chaos?.breakTool);
      // Emit tool call success metric (env/service inherited from resource attributes)
      m.toolCalls.add(1, {
        tenant: req.tenant ?? 'unknown',
        tool_name: toolName,
      });
      m.toolLatencyMs.record(performance.now() - t0, {
        tenant: req.tenant ?? 'unknown',
        tool_name: toolName,
        status: 'ok',
      });
      // Set tool.status to "ok" on success
      span.setAttribute('tool.status', 'ok');
      // Update root span with tool name
      const rootSpan = trace.getActiveSpan();
      rootSpan?.setAttribute('tool_name', toolName);
      span.end();
    } catch (e) {
      toolFailed = true;
      m.toolErrors.add(1, {
        tenant: req.tenant ?? 'unknown',
        tool_name: toolName,
        error_type: (e as any)?.code ?? 'UNKNOWN',
      });
      m.toolLatencyMs.record(performance.now() - t0, {
        tenant: req.tenant ?? 'unknown',
        tool_name: toolName,
        status: 'error',
      });
      // Set tool.status to "error" on error
      span.setAttribute('tool.status', 'error');
      // Record exception and set span status to ERROR
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as any)?.message ?? 'tool error' });
      // Update root span with tool name even on error
      const rootSpan = trace.getActiveSpan();
      rootSpan?.setAttribute('tool_name', toolName);
      span.end();
      // NOTE: do not throw - we want degraded-mode to continue
    }
  });

  const prompt = `User: ${req.input}\nContext: ${rag.context}`;

  // --- LLM span ---
  const llm = await tracer.startActiveSpan('llm.generate', async (span) => {
    try {
      // Set llm_stage inside startActiveSpan callback (required for Datadog metrics)
      span.setAttribute('llm_stage', 'llm.generate');
      setCommonSpanAttrs(span, {
        'llm.provider': 'mock',
        'llm.model': 'mock-gemini',
        'llm.token_spike': !!req.chaos?.tokenSpike,
      });

      const t0 = performance.now();
      const res = await mockLlmGenerate(prompt, req.chaos?.tokenSpike);
      
      // Record latency metric
      m.llmLatencyMs.record(performance.now() - t0, {
        tenant: req.tenant ?? 'unknown',
        model: res.modelName,
      });

      // Set span attributes (for traces - filtering, debugging, trace drill-down)
      setCommonSpanAttrs(span, {
        'model': res.modelName,
        'llm.prompt_tokens': res.inputTokens,
        'llm.completion_tokens': res.outputTokens,
        'llm.total_tokens': res.totalTokens,
        'llm.cost_usd_estimate': res.costUsdEstimate,
      });

      // Emit metrics (for dashboards, trends, alerts)
      m.llmTotalTokens.record(res.totalTokens, {
        tenant: req.tenant ?? 'unknown',
        model: res.modelName,
      });
      m.llmCostUsdEstimate.record(res.costUsdEstimate, {
        tenant: req.tenant ?? 'unknown',
        model: res.modelName,
      });

      // Update root span with model name
      const rootSpan = trace.getActiveSpan();
      rootSpan?.setAttribute('model', res.modelName);

      span.end();
      return res;
    } catch (e) {
      markError(span, e);
      span.end();
      throw e;
    }
  });

  // --- EVAL span ---
  const scores = tracer.startActiveSpan('evaluator.score', (span) => {
    try {
      // Set llm_stage inside startActiveSpan callback (required for Datadog metrics)
      span.setAttribute('llm_stage', 'evaluator.score');
      const t0 = performance.now();
      const s = evaluate(llm.text, rag.context, req.chaos);
      m.evalLatencyMs.record(performance.now() - t0, { tenant: req.tenant ?? 'unknown' });
      m.qualityFaithfulness.record(s.faithfulness, { tenant: req.tenant ?? 'unknown' });
      m.qualityPolicyRisk.record(s.policyRisk, { tenant: req.tenant ?? 'unknown' });
      if (s.hallucinationSuspected === 1) {
        m.qualityHallucination.add(1, { tenant: req.tenant ?? 'unknown' });
      }
      setCommonSpanAttrs(span, {
        'eval.faithfulness': s.faithfulness,
        'eval.relevance': s.relevance,
        'eval.policy_risk': s.policyRisk,
        'eval.format_ok': s.formatCompliance,
        'eval.hallucination': s.hallucinationSuspected,
      });
      span.end();
      return s;
    } catch (e) {
      markError(span, e);
      span.end();
      throw e;
    }
  });

  // --- REMEDIATION span ---
  const remediationApplied = tracer.startActiveSpan('remediation.apply', (span) => {
    try {
      // Set llm_stage inside startActiveSpan callback (required for Datadog metrics)
      span.setAttribute('llm_stage', 'remediation.apply');
      const action = remediate(scores, toolFailed);
      setCommonSpanAttrs(span, {
        'remediation.action': action ?? 'NONE',
        'remediation.tool_failed': toolFailed,
      });
      return action;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw err;
    } finally {
      span.end();
    }
  });

  // Remediation counters
  if (remediationApplied === 'FALLBACK_TOOL') m.fallbackTriggered.add(1, { tenant: req.tenant ?? 'unknown' });
  if (remediationApplied === 'SAFE_MODE') m.safeModeTriggered.add(1, { tenant: req.tenant ?? 'unknown' });
  if (remediationApplied === 'ASK_CLARIFY') m.askClarifyTriggered.add(1, { tenant: req.tenant ?? 'unknown' });

  // Update root span with remediation
  const rootSpan = trace.getActiveSpan();
  const remediationTag = remediationApplied === 'FALLBACK_TOOL' ? 'fallback_tool' : 
                         remediationApplied === 'SAFE_MODE' ? 'safe_mode' :
                         remediationApplied === 'ASK_CLARIFY' ? 'ask_clarify' : 'none';
  rootSpan?.setAttribute('remediation', remediationTag);

  // Apply remediation
  let answer = llm.text;
  if (remediationApplied === 'SAFE_MODE') {
    answer = `Safe mode: I can't help with that request. Please rephrase or provide a safer alternative.`;
  } else if (remediationApplied === 'FALLBACK_TOOL') {
    answer = `${answer}\n\n(Note: tool degraded; returned fallback response.)`;
  } else if (remediationApplied === 'ASK_CLARIFY') {
    answer = `I might be missing context. Can you clarify what exactly you mean by: "${req.input}"?`;
  }

  // add a final summary into the plan span
  setCommonSpanAttrs(planSpan, {
    'result.remediation': remediationApplied ?? 'NONE',
    'result.risk_level': scores.policyRisk > 0.7 ? 'high' : scores.policyRisk > 0.3 ? 'medium' : 'low',
    'result.hallucination': scores.hallucinationSuspected,
  });

  // End-to-end latency
  m.endToEndLatencyMs.record(performance.now() - start, {
    tenant: req.tenant ?? 'unknown',
    remediation: remediationApplied ?? 'NONE',
  });

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

