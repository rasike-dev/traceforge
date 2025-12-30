import type { AskRequest, AskResponse, EvalScores, RemediationReport } from './types';
import { setCommonSpanAttrs } from './otel';
import { m } from './metrics';
import { performance } from 'perf_hooks';
import { trace, SpanKind, Span, SpanStatusCode } from '@opentelemetry/api';
import { startStageSpan, startStageSpanSync, SPAN_NAMES } from '@traceforge/telemetry';
import type { StageSpanContext } from '@traceforge/telemetry';
import { classifyError, determineFinalStatus, type ErrorClassification, type RequestStatus } from './error-taxonomy';
import { GeminiProvider } from '@traceforge/llm';
import { basicEvaluate } from '@traceforge/evaluator';
import { QdrantRagProvider } from '@traceforge/rag';

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

// Real RAG provider (Phase 1.2)
const qdrantRagProvider = new QdrantRagProvider(
  process.env.QDRANT_URL || 'http://localhost:6333',
  process.env.QDRANT_COLLECTION || 'traceforge_demo',
  5 // default topK
);

async function mockToolCall(breakTool?: boolean) {
  if (breakTool) {
    const err = new Error('Tool timeout');
    (err as any).code = 'TOOL_TIMEOUT';
    throw err;
  }
  return { toolResult: 'tool-ok', toolName: 'weather.mock' };
}

/**
 * Map LLM error to error type (coarse classification)
 */
function mapLLMErrorType(err: any): string {
  if (err.status === 429) return 'RATE_LIMIT';
  if (err.code === 'ETIMEDOUT' || err.message?.includes('timeout')) return 'TIMEOUT';
  if (err.status === 400 && err.message?.includes('context')) return 'LLM_ERROR';
  return 'LLM_ERROR';
}

/**
 * Map LLM error to error code (fine-grained classification)
 */
function mapLLMErrorCode(err: any): string {
  if (err.status === 429) return 'LLM_RATE_LIMIT';
  if (err.message?.includes('context') || err.message?.includes('too large')) return 'LLM_CONTEXT_TOO_LARGE';
  if (err.status >= 500 || err.message?.includes('provider') || err.message?.includes('down')) return 'LLM_PROVIDER_DOWN';
  return 'LLM_PROVIDER_DOWN';
}

// Removed evaluate() wrapper - now using basicEvaluate() directly in evaluation span

/**
 * Remediation logic for Phase 1.1.4
 * Scope: CLARIFICATION only (simple, safe, demo-friendly)
 * Trigger: if eval.overall < 0.75
 */
// Removed remediate() function - now using inline remediation logic in remediation span
// Phase 1.1.4: Only CLARIFICATION remediation is implemented (triggered when overall < 0.75)

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
  // --- RAG span: traceforge.rag (real Qdrant integration) ---
  const ragTopK = 5;
  const rag = await startStageSpan(
    {
      requestId: req.requestId,
      tenantId: req.tenantId,
      stage: 'rag',
      kind: SpanKind.CLIENT,
      stageAttrs: {
        'rag.provider': 'qdrant',
        'rag.top_k': ragTopK,
        'rag.docs.count': 0, // Will be updated after result
        'rag.query.length': req.input.text.length,
      },
    },
    async (span: Span, ctx: StageSpanContext & { updateStatus: (status: RequestStatus) => void }) => {
      const t0 = performance.now();
      
      // Keep llm_stage for backward compatibility
      span.setAttribute('llm_stage', 'rag.retrieve');
      
      try {
        // Use real Qdrant RAG provider
        const result = await qdrantRagProvider.retrieve({
          query: req.input.text,
          topK: ragTopK,
        });
        
        // Update stage-specific attributes with actual values
        setCommonSpanAttrs(span, {
          'traceforge.status': 'OK',
          'rag.docs.count': result.docs,
        });
        
        const latencyMs = performance.now() - t0;
        
        // Record RAG latency metric
        m.ragLatencyMs.record(latencyMs, {
          tenant_id: req.tenantId,
          rag_provider: 'qdrant',
        });
        
        // Record RAG docs count (gauge-like)
        m.ragDocsCount.add(result.docs, {
          tenant_id: req.tenantId,
          rag_provider: 'qdrant',
        });
        
        // Empty docs is not an error - status stays OK
        if (result.docs === 0) {
          // Not an error, just empty result
          stageErrors.push({ stage: 'rag', error: null });
        } else {
          stageErrors.push({ stage: 'rag', error: null });
        }
        
        return result;
      } catch (err) {
        // RAG retrieval failed - classify error and mark span
        const errorClass = classifyError('rag', err, { providerDown: true });
        
        span.setAttribute('error.type', errorClass.type);
        span.setAttribute('error.code', errorClass.code);
        span.setAttribute('error.message', errorClass.message);
        span.setAttribute('traceforge.status', 'ERROR');
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: errorClass.message });
        ctx.updateStatus('ERROR');
        stageErrors.push({ stage: 'rag', error: errorClass });
        
        // Return empty result on error (don't fail the request)
        const latencyMs = performance.now() - t0;
        m.ragLatencyMs.record(latencyMs, {
          tenant_id: req.tenantId,
          rag_provider: 'qdrant',
        });
        m.ragDocsCount.add(0, {
          tenant_id: req.tenantId,
          rag_provider: 'qdrant',
        });
        
        return {
          context: '',
          docs: 0,
        };
      }
    }
  );

  // --- TOOL span: traceforge.tool (repeatable) ---
  let toolFailed = false;
  // Tool naming convention: <category>* (e.g., weather*, vector_db*, document_lookup*, payment*, search*)
  // This supports wildcard filtering in SLOs: tool_name:weather*, tool_name:vector_db*, etc.
  const toolName = 'weather.mock'; // Matches tool_name:weather* pattern for SLO filtering
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
      kind: SpanKind.CLIENT, // LLM calls are external (CLIENT)
      stageAttrs: {
        'llm.provider': 'google', // Will be updated after result
        'llm.model': 'gemini-pro', // Will be updated after result
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
      
      try {
        // Initialize Gemini provider (singleton pattern from gemini.client.ts)
        const geminiProvider = new GeminiProvider();
        
        // Generate response from Gemini
        const geminiResult = await geminiProvider.generate({
          prompt: prompt,
        });
        
        // Adapt Gemini result to orchestrator's expected format
        const res = {
          text: geminiResult.text,
          modelName: 'gemini-pro', // Updated to match provider default
          inputTokens: geminiResult.tokens.input,
          outputTokens: geminiResult.tokens.output,
          totalTokens: geminiResult.tokens.total,
          costUsdEstimate: geminiResult.costUsd,
        };
        
        const latencyMs = performance.now() - t0;
        
        // Update stage-specific attributes with actual values
        setCommonSpanAttrs(span, {
          'traceforge.status': 'OK',
          'llm.provider': 'google',
          'llm.model': res.modelName,
          'llm.tokens.input': res.inputTokens,
          'llm.tokens.output': res.outputTokens,
          'llm.tokens.total': res.totalTokens,
          'llm.cost.usd': res.costUsdEstimate,
          // Promoted attribute for root span
          'model': res.modelName,
        });
        
        // Record latency metric
        m.llmLatencyMs.record(latencyMs, {
          tenant_id: req.tenantId,
          llm_provider: 'google',
          llm_model: res.modelName,
        });

        // Emit metrics (for dashboards, trends, alerts)
        m.llmTokensInput.add(res.inputTokens, {
          tenant_id: req.tenantId,
          llm_provider: 'google',
          llm_model: res.modelName,
        });
        m.llmTokensOutput.add(res.outputTokens, {
          tenant_id: req.tenantId,
          llm_provider: 'google',
          llm_model: res.modelName,
        });
        m.llmCostUsd.add(res.costUsdEstimate, {
          tenant_id: req.tenantId,
          llm_provider: 'google',
          llm_model: res.modelName,
        });

        // Update root span with model name
        requestSpan.setAttribute('model', res.modelName);
        
        // Update status to OK
        ctx.updateStatus('OK');

        return res;
      } catch (err: any) {
        const latencyMs = performance.now() - t0;
        
        // Classify error using taxonomy (canonical error mapping)
        const errorClass = classifyError('llm', err, {
          rateLimit: err.status === 429 || err.message?.includes('rate limit'),
          providerDown: err.status >= 500 || err.message?.includes('provider') || err.message?.includes('down'),
        });
        
        // Update span attributes for error
        setCommonSpanAttrs(span, {
          'traceforge.status': 'ERROR',
          'error.type': errorClass.type,
          'error.code': errorClass.code,
          'error.message': errorClass.message,
        });
        
        // Record exception
        span.recordException(err);
        span.setStatus({ code: 2, message: errorClass.message }); // SpanStatusCode.ERROR = 2
        
        // Still record latency metric (even on error)
        m.llmLatencyMs.record(latencyMs, {
          tenant_id: req.tenantId,
          llm_provider: 'google',
          llm_model: 'gemini-1.5-flash',
        });
        
        // Update status to ERROR
        ctx.updateStatus('ERROR');
        
        // Re-throw to maintain error handling flow
        throw err;
      }
    }
  );

  // --- EVALUATION span: traceforge.evaluation ---
  let scores: EvalScores;
  let evaluationError: Error | null = null;
  
  try {
    scores = startStageSpanSync(
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
        
        try {
          // Use real deterministic evaluator
          const evalScores = basicEvaluate({
            query: req.input.text,
            context: rag.context || '',
            answer: llm.text,
          });
          
          // Apply chaos flags if present (for testing)
          let policyRisk = evalScores.policy_risk;
          if (req.chaos?.policyRisk) {
            policyRisk = 0.9; // Force high policy risk for testing
          }
          
          const s: EvalScores = {
            faithfulness: clamp01(evalScores.faithfulness),
            relevance: clamp01(evalScores.relevance),
            policyRisk: clamp01(policyRisk),
            hallucination: clamp01(evalScores.hallucination),
            overall: clamp01(evalScores.overall),
            reasons: [],
            formatCompliance: llm.text.length > 0 ? 1 : 0,
          };
          
          // Generate reasons
          if (s.faithfulness < 0.7) s.reasons?.push('Low faithfulness detected');
          if (s.relevance < 0.5) s.reasons?.push('Low relevance to context');
          if (s.policyRisk > 0.7) s.reasons?.push('High policy risk detected');
          if (s.hallucination > 0.5) s.reasons?.push('Potential hallucination');
          if (s.reasons && s.reasons.length === 0) s.reasons = undefined;
          
          // Update stage-specific attributes with actual values
          setCommonSpanAttrs(span, {
            'traceforge.status': 'OK',
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
        } catch (err) {
          // Evaluation failed - classify error and mark span
          const errorClass = classifyError('evaluation', err);
          
          span.setAttribute('error.type', errorClass.type);
          span.setAttribute('error.code', errorClass.code);
          span.setAttribute('error.message', errorClass.message);
          span.setAttribute('traceforge.status', 'ERROR');
          span.recordException(err as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: errorClass.message });
          
          // Return safe defaults
          const fallbackScores: EvalScores = {
            faithfulness: 0.5,
            relevance: 0.5,
            policyRisk: 0.1,
            hallucination: 0.3,
            overall: 0.5,
            reasons: ['Evaluation engine failure'],
            formatCompliance: llm.text.length > 0 ? 1 : 0,
          };
          
          // Still emit metrics with fallback scores
          m.evalScore.add(fallbackScores.faithfulness, {
            tenant_id: req.tenantId,
            dimension: 'faithfulness',
          });
          m.evalScore.add(fallbackScores.relevance, {
            tenant_id: req.tenantId,
            dimension: 'relevance',
          });
          m.evalScore.add(fallbackScores.policyRisk, {
            tenant_id: req.tenantId,
            dimension: 'policy_risk',
          });
          m.evalScore.add(fallbackScores.hallucination, {
            tenant_id: req.tenantId,
            dimension: 'hallucination',
          });
          m.evalScore.add(fallbackScores.overall, {
            tenant_id: req.tenantId,
            dimension: 'overall',
          });
          
          evaluationError = err as Error;
          return fallbackScores;
        }
      }
    );
  } catch (err) {
    // Outer catch for span creation failure (shouldn't happen, but be safe)
    console.error('[Orchestrator] Evaluation span creation failed:', err);
    evaluationError = err as Error;
    scores = {
      faithfulness: 0.5,
      relevance: 0.5,
      policyRisk: 0.1,
      hallucination: 0.3,
      overall: 0.5,
      reasons: ['Evaluation stage failure'],
      formatCompliance: llm.text.length > 0 ? 1 : 0,
    };
  }

  // --- REMEDIATION span: traceforge.remediation ---
  let remediationApplied: RemediationReport;
  let clarificationMessage: string | undefined;
  
  remediationApplied = startStageSpanSync(
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
      
      const overall = scores.overall;
      
      // Phase 1.1.4: Simple trigger rule - if overall < 0.75, trigger CLARIFICATION
      if (overall >= 0.75) {
        // No remediation needed
        setCommonSpanAttrs(span, {
          'traceforge.status': 'OK',
          'remediation.triggered': false,
          'remediation.action': 'NONE',
          'remediation.reason': 'Quality score above threshold',
        });
        
        const result: RemediationReport = {
          triggered: false,
          actions: [],
          finalMode: 'NORMAL',
        };
        return result;
      }
      
      // ---- Remediation triggered (CLARIFICATION only for Phase 1.1) ----
      const remediationAction: RemediationReport['actions'][0] = {
        type: 'CLARIFICATION',
        reason: `Low overall quality score (${overall.toFixed(2)} < 0.75)`,
      };
      
      setCommonSpanAttrs(span, {
        'traceforge.status': 'OK', // Span itself is OK, request becomes DEGRADED
        'remediation.triggered': true,
        'remediation.action': 'CLARIFICATION',
        'remediation.reason': remediationAction.reason,
      });
      
      // Span event (important for traces)
      span.addEvent('remediation.clarification', {
        reason: 'eval.overall below threshold',
        action: 'CLARIFICATION',
        score: overall,
      });
      
      // Metric
      m.remediationTriggered.add(1, {
        tenant_id: req.tenantId,
        action: 'CLARIFICATION',
      });
      
      // Promote remediation to root span
      requestSpan.setAttribute('remediation', 'CLARIFICATION');
      
      // Update request status to DEGRADED
      ctx.updateStatus('DEGRADED');
      
      // Generate clarification message (demo-friendly)
      clarificationMessage = 'I may not have enough reliable information. Could you clarify or provide more details?';
      
      const result: RemediationReport = {
        triggered: true,
        actions: [remediationAction],
        finalMode: 'DEGRADED',
      };
      return result;
    }
  );

  // Note: Remediation metric is now emitted inside the span callback above
  // This ensures it's only emitted when remediation is actually triggered

  // Determine final status using error taxonomy
  const hasUsableResponse = true; // We always produce a response (even if degraded)
  const remediationSucceeded = remediationApplied.triggered && remediationApplied.finalMode !== 'NORMAL';
  
  // If remediation was triggered, status should be DEGRADED (already set in remediation span)
  // Otherwise, determine from stage errors
  let finalStatus: RequestStatus;
  if (remediationApplied.triggered) {
    finalStatus = 'DEGRADED'; // Remediation triggered = DEGRADED
  } else {
    finalStatus = determineFinalStatus(
      stageErrors,
      remediationApplied.triggered,
      remediationSucceeded,
      hasUsableResponse
    );
  }
  
  // Update root span with final status and error info
  requestCtx.updateStatus(finalStatus);
  
  // CRITICAL: Set traceforge.status on root span (powers SLOs, error budgets, dashboards)
  requestSpan.setAttribute('traceforge.status', finalStatus);
  
  // Set error attributes on root span if there were errors
  const dominantError = stageErrors.find(e => e.error !== null)?.error;
  if (dominantError) {
    requestSpan.setAttribute('traceforge.error.type', dominantError.type);
    requestSpan.setAttribute('traceforge.error.code', dominantError.code);
  }
  
  // Promote remediation to root span (Phase 1.1.4 requirement)
  if (remediationApplied.triggered && remediationApplied.actions.some((a: { type: string }) => a.type === 'CLARIFICATION')) {
    requestSpan.setAttribute('remediation', 'CLARIFICATION');
  } else {
    requestSpan.setAttribute('remediation', 'none');
  }

  // Apply remediation - use clarification message if remediation was triggered
  const answer = clarificationMessage || llm.text;

  // Add final summary to root span
  setCommonSpanAttrs(requestSpan, {
    'result.remediation': remediationApplied.finalMode,
    'result.risk_level': scores.policyRisk > 0.7 ? 'high' : scores.policyRisk > 0.3 ? 'medium' : 'low',
    'result.hallucination': scores.hallucination > 0.5,
  });

  // Determine remediation tag value for metric
  const remediationTag = remediationApplied.triggered && remediationApplied.actions.length > 0
    ? remediationApplied.actions[0].type
    : 'none';

  // End-to-end latency with final status and remediation
  m.requestLatencyMs.record(performance.now() - start, {
    tenant_id: req.tenantId,
    status: finalStatus,
    remediation: remediationTag,
  });
  
  // Request count with status tag (moved here so we have final status)
  m.requestCount.add(1, {
    tenant_id: req.tenantId,
    status: finalStatus,
  });

  // Quality SLO metric: increment if overall score meets threshold (>= 0.75)
  const qualityThreshold = 0.75;
  if (scores.overall >= qualityThreshold) {
    m.qualityOk.add(1, {
      tenant_id: req.tenantId,
      status: finalStatus,
    });
  }

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

