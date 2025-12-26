import type { AskRequest, AskResponse, EvalScores, RemediationReport } from './types';
import { setCommonSpanAttrs } from './otel';
import { m } from './metrics';
import { performance } from 'perf_hooks';
import { trace, SpanKind, Span } from '@opentelemetry/api';
import { startStageSpan, startStageSpanSync, SPAN_NAMES } from '@traceforge/telemetry';
import type { StageSpanContext } from '@traceforge/telemetry';
import { classifyError, determineFinalStatus, type ErrorClassification, type RequestStatus } from './error-taxonomy';

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
  const hallucination = faithfulness < 0.7 ? 0.8 : 0.1; // Convert to 0..1 scale
  const formatCompliance: 0 | 1 = answer.length > 0 ? 1 : 0;

  // Calculate overall score (weighted average)
  const overall = (faithfulness * 0.3 + relevance * 0.3 + (1 - policyRisk) * 0.2 + (1 - hallucination) * 0.2);

  const reasons: string[] = [];
  if (faithfulness < 0.7) reasons.push('Low faithfulness detected');
  if (relevance < 0.5) reasons.push('Low relevance to context');
  if (policyRisk > 0.7) reasons.push('High policy risk detected');
  if (hallucination > 0.5) reasons.push('Potential hallucination');

  return {
    faithfulness: clamp01(faithfulness),
    relevance: clamp01(relevance),
    policyRisk: clamp01(policyRisk),
    hallucination: clamp01(hallucination),
    overall: clamp01(overall),
    reasons: reasons.length > 0 ? reasons : undefined,
    formatCompliance,
  };
}

function remediate(scores: EvalScores, toolFailed: boolean): RemediationReport {
  const actions: RemediationReport['actions'] = [];
  let finalMode: RemediationReport['finalMode'] = 'NORMAL';

  if (scores.policyRisk > 0.7) {
    actions.push({ type: 'SAFE_MODE', reason: 'Policy risk threshold exceeded' });
    finalMode = 'SAFE';
  } else if (toolFailed) {
    actions.push({ type: 'FALLBACK_TOOL', reason: 'Tool execution failed' });
    finalMode = 'DEGRADED';
  } else if (scores.faithfulness < 0.8) {
    actions.push({ type: 'CLARIFICATION', reason: 'Low faithfulness score' });
    finalMode = 'DEGRADED';
  }

  return {
    triggered: actions.length > 0,
    actions,
    finalMode,
  };
}

export async function orchestrate(req: AskRequest): Promise<AskResponse> {
  const start = performance.now();

  // Note: requestCount will be incremented at the end with final status

  // Root span: traceforge.request (wraps entire orchestration)
  return startStageSpan(
    {
      requestId: req.requestId,
      tenantId: req.tenantId,
      stage: 'request',
      stageAttrs: {}, // Request span has no required stage-specific attrs
    },
    async (span: Span, ctx: StageSpanContext & { updateStatus: (status: RequestStatus) => void }) => {
      // Keep llm_stage for backward compatibility (can remove later)
      span.setAttribute('llm_stage', 'request');

      return await doOrchestrate(req, span, start, ctx);
    }
  );
}

async function doOrchestrate(
  req: AskRequest,
  requestSpan: any,
  start: number,
  requestCtx: { updateStatus: (status: RequestStatus) => void }
): Promise<AskResponse> {
  // Track stage errors for final status determination
  const stageErrors: Array<{ stage: string; error: ErrorClassification | null }> = [];
  // --- RAG span: traceforge.rag ---
  const rag = await startStageSpan(
    {
      requestId: req.requestId,
      tenantId: req.tenantId,
      stage: 'rag',
      kind: SpanKind.CLIENT,
      stageAttrs: {
        'rag.provider': 'mock',
        'rag.top_k': 3,
        'rag.docs.count': 0, // Will be updated after result
        'rag.query.length': req.input.text.length,
      },
    },
    async (span: Span, ctx: StageSpanContext & { updateStatus: (status: 'OK' | 'ERROR' | 'DEGRADED') => void }) => {
      const t0 = performance.now();
      
      // Keep llm_stage for backward compatibility
      span.setAttribute('llm_stage', 'rag.retrieve');
      
      const result = await mockRag(req.input.text, req.chaos?.badRag);
      
      // Update stage-specific attributes with actual values
      setCommonSpanAttrs(span, {
        'rag.docs.count': result.docs,
      });
      
      m.ragLatencyMs.record(performance.now() - t0, {
        tenant_id: req.tenantId,
        rag_provider: 'mock',
      });
      
      // Record RAG docs count (gauge-like)
      m.ragDocsCount.add(result.docs, {
        tenant_id: req.tenantId,
        rag_provider: 'mock',
      });
      
      // Empty docs is not an error - status stays OK
      if (result.docs === 0) {
        // Not an error, just empty result
        stageErrors.push({ stage: 'rag', error: null });
      } else {
        stageErrors.push({ stage: 'rag', error: null });
      }
      
      // Force error for observability test (temporary) - remove this later
      const forcedError = new Error('forced error for observability test');
      const errorClass = classifyError('rag', forcedError, { providerDown: true });
      span.setAttribute('error.type', errorClass.type);
      span.setAttribute('error.code', errorClass.code);
      span.setAttribute('error.message', errorClass.message);
      span.recordException(forcedError);
      span.setStatus({ code: 2, message: errorClass.message }); // SpanStatusCode.ERROR = 2
      ctx.updateStatus('ERROR');
      stageErrors.push({ stage: 'rag', error: errorClass });
      
      return result;
    }
  );

  // --- TOOL span: traceforge.tool (repeatable) ---
  let toolFailed = false;
  const toolName = 'mock.weather';
  const toolAttempt = 1;
  const toolTimeoutMs = 5000;
  const toolT0 = performance.now();
  
  try {
    await startStageSpan(
      {
        requestId: req.requestId,
        tenantId: req.tenantId,
        stage: 'tool',
        stageAttrs: {
          'tool.name': toolName,
          'tool.attempt': toolAttempt,
          'tool.timeout_ms': toolTimeoutMs,
          'tool.result': 'SUCCESS',
        },
      },
      async (span: Span, ctx: StageSpanContext & { updateStatus: (status: RequestStatus) => void }) => {
        // Keep llm_stage for backward compatibility
        span.setAttribute('llm_stage', 'tool.call');
        
        await mockToolCall(req.chaos?.breakTool);
        
        // Emit tool call success metric
        m.toolCalls.add(1, {
          tenant_id: req.tenantId,
          tool_name: toolName,
        });
        m.toolLatencyMs.record(performance.now() - toolT0, {
          tenant_id: req.tenantId,
          tool_name: toolName,
          result: 'SUCCESS',
        });
        
        // Update root span with tool name
        requestSpan.setAttribute('tool_name', toolName);
      }
    );
  } catch (e) {
    toolFailed = true;
    const err = e as any;
    
    // Classify the error using taxonomy
    const errorClass = classifyError('tool', e, { timeout: err?.code === 'TOOL_TIMEOUT' });
    
    // Create error span manually to set error taxonomy attributes
    await startStageSpan(
      {
        requestId: req.requestId,
        tenantId: req.tenantId,
        stage: 'tool',
        stageAttrs: {
          'tool.name': toolName,
          'tool.attempt': toolAttempt,
          'tool.timeout_ms': toolTimeoutMs,
          'tool.result': 'FAILURE',
        },
      },
      async (span: Span, ctx: StageSpanContext & { updateStatus: (status: RequestStatus) => void }) => {
        // Keep llm_stage for backward compatibility
        span.setAttribute('llm_stage', 'tool.call');
        
        // Set error taxonomy attributes
        span.setAttribute('error.type', errorClass.type);
        span.setAttribute('error.code', errorClass.code);
        span.setAttribute('error.message', errorClass.message);
        span.recordException(e as Error);
        span.setStatus({ code: 2, message: errorClass.message }); // SpanStatusCode.ERROR = 2
        ctx.updateStatus('ERROR');
        
        // Record error metrics with error_type tag
        m.toolErrors.add(1, {
          tenant_id: req.tenantId,
          tool_name: toolName,
          error_type: errorClass.type,
        });
        
        // Record tool latency on error
        m.toolLatencyMs.record(performance.now() - toolT0, {
          tenant_id: req.tenantId,
          tool_name: toolName,
          result: 'FAILURE',
        });
        
        // Update root span with tool name even on error
        requestSpan.setAttribute('tool_name', toolName);
      }
    );
    
    // Track stage error
    stageErrors.push({ stage: 'tool', error: errorClass });
    // NOTE: do not throw - we want degraded-mode to continue
  }

  const prompt = `User: ${req.input.text}\nContext: ${rag.context}`;

  // --- LLM span: traceforge.llm ---
  const llm = await startStageSpan(
    {
      requestId: req.requestId,
      tenantId: req.tenantId,
      stage: 'llm',
      stageAttrs: {
        'llm.provider': 'mock',
        'llm.model': 'mock-gemini', // Will be updated after result
        'llm.tokens.input': 0, // Will be updated after result
        'llm.tokens.output': 0, // Will be updated after result
        'llm.tokens.total': 0, // Will be updated after result
        'llm.cost.usd': 0, // Will be updated after result
      },
    },
    async (span: Span, ctx: StageSpanContext & { updateStatus: (status: 'OK' | 'ERROR' | 'DEGRADED') => void }) => {
      const t0 = performance.now();
      
      // Keep llm_stage for backward compatibility
      span.setAttribute('llm_stage', 'llm.generate');
      
      const res = await mockLlmGenerate(prompt, req.chaos?.tokenSpike);
      
      // Update stage-specific attributes with actual values
      setCommonSpanAttrs(span, {
        'llm.model': res.modelName,
        'llm.tokens.input': res.inputTokens,
        'llm.tokens.output': res.outputTokens,
        'llm.tokens.total': res.totalTokens,
        'llm.cost.usd': res.costUsdEstimate,
      });
      
      // Record latency metric
      m.llmLatencyMs.record(performance.now() - t0, {
        tenant_id: req.tenantId,
        llm_provider: 'mock',
        llm_model: res.modelName,
      });

      // Emit metrics (for dashboards, trends, alerts)
      m.llmTokensInput.add(res.inputTokens, {
        tenant_id: req.tenantId,
        llm_provider: 'mock',
        llm_model: res.modelName,
      });
      m.llmTokensOutput.add(res.outputTokens, {
        tenant_id: req.tenantId,
        llm_provider: 'mock',
        llm_model: res.modelName,
      });
      m.llmCostUsd.add(res.costUsdEstimate, {
        tenant_id: req.tenantId,
        llm_provider: 'mock',
        llm_model: res.modelName,
      });

      // Update root span with model name
      requestSpan.setAttribute('model', res.modelName);

      return res;
    }
  );

  // --- EVALUATION span: traceforge.evaluation ---
  const scores = startStageSpanSync(
    {
      requestId: req.requestId,
      tenantId: req.tenantId,
      stage: 'evaluation',
      stageAttrs: {
        'eval.faithfulness': 0, // Will be updated after evaluation
        'eval.relevance': 0, // Will be updated after evaluation
        'eval.policy_risk': 0, // Will be updated after evaluation
        'eval.hallucination': 0, // Will be updated after evaluation
        'eval.overall': 0, // Will be updated after evaluation
      },
    },
    (span: Span, ctx: StageSpanContext & { updateStatus: (status: RequestStatus) => void }) => {
      const t0 = performance.now();
      
      // Keep llm_stage for backward compatibility
      span.setAttribute('llm_stage', 'evaluator.score');
      
      const s = evaluate(llm.text, rag.context, req.chaos);
      
      // Update stage-specific attributes with actual values
      setCommonSpanAttrs(span, {
        'eval.faithfulness': s.faithfulness,
        'eval.relevance': s.relevance,
        'eval.policy_risk': s.policyRisk,
        'eval.hallucination': s.hallucination,
        'eval.overall': s.overall,
      });
      
      // Record evaluation scores using single metric with dimension tag
      m.evalScore.add(s.faithfulness, {
        tenant_id: req.tenantId,
        dimension: 'faithfulness',
      });
      m.evalScore.add(s.relevance, {
        tenant_id: req.tenantId,
        dimension: 'relevance',
      });
      m.evalScore.add(s.policyRisk, {
        tenant_id: req.tenantId,
        dimension: 'policy_risk',
      });
      m.evalScore.add(s.hallucination, {
        tenant_id: req.tenantId,
        dimension: 'hallucination',
      });
      m.evalScore.add(s.overall, {
        tenant_id: req.tenantId,
        dimension: 'overall',
      });
      
      return s;
    }
  );

  // --- REMEDIATION span: traceforge.remediation ---
  const remediationApplied = startStageSpanSync(
    {
      requestId: req.requestId,
      tenantId: req.tenantId,
      stage: 'remediation',
      stageAttrs: {
        'remediation.triggered': false, // Will be updated after remediation
        'remediation.action': 'NONE', // Will be updated after remediation
        'remediation.reason': 'No remediation needed', // Will be updated after remediation
      },
    },
    (span: Span, ctx: StageSpanContext & { updateStatus: (status: RequestStatus) => void }) => {
      // Keep llm_stage for backward compatibility
      span.setAttribute('llm_stage', 'remediation.apply');
      
      const action = remediate(scores, toolFailed);
      
      // Determine status based on final mode
      if (action.finalMode === 'DEGRADED') ctx.updateStatus('DEGRADED');
      else if (action.finalMode === 'SAFE') ctx.updateStatus('DEGRADED'); // SAFE is a form of degradation
      
      // Stage-specific attributes
      const remediationAction = action.actions.length > 0 ? action.actions[0].type : 'NONE';
      const remediationReason = action.actions.length > 0 ? action.actions[0].reason : 'No remediation needed';
      
      setCommonSpanAttrs(span, {
        'remediation.triggered': action.triggered,
        'remediation.action': remediationAction,
        'remediation.reason': remediationReason,
      });
      
      // Add span events for remediation actions
      if (action.triggered) {
        for (const act of action.actions) {
          if (act.type === 'FALLBACK_TOOL') {
            span.addEvent('tool.fallback', {
              reason: act.reason,
              action: act.type,
            });
          } else if (act.type === 'SAFE_MODE') {
            span.addEvent('remediation.safe_mode', {
              reason: act.reason,
              action: act.type,
            });
          } else if (act.type === 'CLARIFICATION') {
            span.addEvent('remediation.clarification', {
              reason: act.reason,
              action: act.type,
            });
          }
        }
      }
      
      return action;
    }
  );

  // Remediation counters - use single metric with action tag
  if (remediationApplied.triggered) {
    for (const action of remediationApplied.actions) {
      m.remediationTriggered.add(1, {
        tenant_id: req.tenantId,
        action: action.type,
      });
    }
  }

  // Determine final status using error taxonomy
  const hasUsableResponse = true; // We always produce a response (even if degraded)
  const remediationSucceeded = remediationApplied.triggered && remediationApplied.finalMode !== 'NORMAL';
  const finalStatus = determineFinalStatus(
    stageErrors,
    remediationApplied.triggered,
    remediationSucceeded,
    hasUsableResponse
  );
  
  // Update root span with final status and error info
  requestCtx.updateStatus(finalStatus);
  
  // Set error attributes on root span if there were errors
  const dominantError = stageErrors.find(e => e.error !== null)?.error;
  if (dominantError) {
    requestSpan.setAttribute('traceforge.error.type', dominantError.type);
    requestSpan.setAttribute('traceforge.error.code', dominantError.code);
  }
  
  const remediationTag = remediationApplied.finalMode === 'DEGRADED' ? 'degraded' : 
                         remediationApplied.finalMode === 'SAFE' ? 'safe_mode' : 'normal';
  requestSpan.setAttribute('remediation', remediationTag);

  // Apply remediation
  let answer = llm.text;
  if (remediationApplied.finalMode === 'SAFE') {
    answer = `Safe mode: I can't help with that request. Please rephrase or provide a safer alternative.`;
      } else if (remediationApplied.finalMode === 'DEGRADED' && remediationApplied.actions.some((a: { type: string }) => a.type === 'FALLBACK_TOOL')) {
        answer = `${answer}\n\n(Note: tool degraded; returned fallback response.)`;
      } else if (remediationApplied.finalMode === 'DEGRADED' && remediationApplied.actions.some((a: { type: string }) => a.type === 'CLARIFICATION')) {
    answer = `I might be missing context. Can you clarify what exactly you mean by: "${req.input.text}"?`;
  }

  // Add final summary to root span
  setCommonSpanAttrs(requestSpan, {
    'result.remediation': remediationApplied.finalMode,
    'result.risk_level': scores.policyRisk > 0.7 ? 'high' : scores.policyRisk > 0.3 ? 'medium' : 'low',
    'result.hallucination': scores.hallucination > 0.5,
  });

  // End-to-end latency with final status
  m.requestLatencyMs.record(performance.now() - start, {
    tenant_id: req.tenantId,
    status: finalStatus,
  });
  
  // Request count with status tag (moved here so we have final status)
  m.requestCount.add(1, {
    tenant_id: req.tenantId,
    status: finalStatus,
  });

  // Get trace context for debug field
  const activeSpan = trace.getActiveSpan();
  const spanContext = activeSpan?.spanContext();
  const traceId = spanContext?.traceId;
  const spanId = spanContext?.spanId;

  return {
    requestId: req.requestId,
    tenantId: req.tenantId,
    answer: { text: answer },
    usage: {
      tokensIn: llm.inputTokens,
      tokensOut: llm.outputTokens,
      totalTokens: llm.totalTokens,
      costUsd: llm.costUsdEstimate,
    },
    eval: scores,
    remediation: remediationApplied,
    debug: traceId && spanId ? { traceId, spanId } : undefined,
  };
}

