import { trace, SpanStatusCode, SpanKind, Span } from '@opentelemetry/api';
import type { Stage, SpanStatus } from './span-names';
import { getSpanName } from './span-names';
import { validateStageAttrs } from './span-attrs';
import type { RagSpanAttrs, ToolSpanAttrs, LlmSpanAttrs, EvaluationSpanAttrs, RemediationSpanAttrs } from './span-attrs';

const tracer = trace.getTracer('traceforge.core', '0.1.0');

/**
 * Context passed to span callback
 */
export interface StageSpanContext {
  requestId: string;
  tenantId: string;
  stage: Stage;
  status: SpanStatus;
}

/**
 * Options for starting a stage span
 */
export interface StartStageSpanOptions {
  kind?: SpanKind;
  requestId: string;
  tenantId: string;
  stage: Stage;
  stageAttrs: Record<string, unknown>;
  isDev?: boolean;
}


/**
 * Set mandatory attributes on a span
 */
function setMandatoryAttrs(
  span: Span,
  requestId: string,
  tenantId: string,
  stage: Stage,
  status: SpanStatus,
  error?: { type?: string; code?: string; message?: string }
): void {
  // Identity & scope
  span.setAttribute('traceforge.request_id', requestId);
  span.setAttribute('traceforge.tenant_id', tenantId);
  span.setAttribute('traceforge.stage', stage);
  span.setAttribute('traceforge.status', status);

  // Environment (from resource attributes, but ensure on span)
  const serviceName = process.env.OTEL_SERVICE_NAME || 'traceforge-api';
  const deploymentEnv = process.env.OTEL_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'dev';
  span.setAttribute('service.name', serviceName);
  span.setAttribute('deployment.environment', deploymentEnv);

  // Error attributes (only when error) - Phase 1 Step 3: error taxonomy
  if (error && (status === 'ERROR' || error.type || error.code || error.message)) {
    if (error.type) span.setAttribute('error.type', error.type);
    if (error.code) span.setAttribute('error.code', error.code);
    if (error.message) span.setAttribute('error.message', error.message);
  }
}

/**
 * Set stage-specific attributes on a span
 */
function setStageAttrs(span: Span, attrs: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null) continue;
    span.setAttribute(
      key,
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
        ? value
        : JSON.stringify(value)
    );
  }
}

/**
 * Mark span as error
 */
function markSpanError(span: Span, err: unknown): { type: string; message: string } {
  const e = err as any;
  span.recordException(e as Error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: e?.message ?? 'error' });
  return {
    type: e?.code ?? 'UNKNOWN',
    message: e?.message ?? 'error',
  };
}

/**
 * Start a stage span with enforced attributes
 * 
 * This is the single source of truth for creating spans.
 * It ensures:
 * - Correct span name from taxonomy
 * - All mandatory attributes are set
 * - Stage-specific required attributes are validated (in dev)
 * - Error handling is consistent
 * 
 * The callback can update status by calling updateStatus() on the context.
 * If the callback throws, the span is automatically marked as ERROR.
 * 
 * @example
 * ```ts
 * const result = await startStageSpan({
 *   requestId: req.requestId,
 *   tenantId: req.tenantId,
 *   stage: 'rag',
 *   stageAttrs: {
 *     'rag.provider': 'mock',
 *     'rag.top_k': 3,
 *     'rag.docs.count': result.docs,
 *     'rag.query.length': req.input.text.length,
 *   },
 *   async (span, ctx) => {
 *     // Your stage logic here
 *     const result = await mockRag(req.input.text);
 *     // Optionally update status
 *     ctx.updateStatus('DEGRADED');
 *     return result;
 *   }
 * });
 * ```
 */
export async function startStageSpan<T>(
  options: StartStageSpanOptions,
  callback: (span: Span, ctx: StageSpanContext & { updateStatus: (status: SpanStatus) => void }) => Promise<T>
): Promise<T> {
  const { requestId, tenantId, stage, stageAttrs, kind = SpanKind.INTERNAL, isDev = process.env.NODE_ENV !== 'production' } = options;

  // Validate stage-specific attributes in dev mode
  validateStageAttrs(stage, stageAttrs, isDev);

  const spanName = getSpanName(stage);
  let status: SpanStatus = 'OK';
  let error: { type?: string; message?: string } | undefined;

  return tracer.startActiveSpan(spanName, { kind }, async (span) => {
    try {
      // Set mandatory attributes immediately
      setMandatoryAttrs(span, requestId, tenantId, stage, status);

      // Set stage-specific attributes
      setStageAttrs(span, stageAttrs);

      // Create context with updateStatus helper
      const ctx: StageSpanContext & { updateStatus: (status: SpanStatus) => void } = {
        requestId,
        tenantId,
        stage,
        status,
        updateStatus: (newStatus: SpanStatus) => {
          status = newStatus;
          setMandatoryAttrs(span, requestId, tenantId, stage, status, error);
        },
      };

      // Execute callback
      const result = await callback(span, ctx);

      // Final status update
      setMandatoryAttrs(span, requestId, tenantId, stage, status, error);

      span.end();
      return result;
    } catch (err) {
      error = markSpanError(span, err);
      status = 'ERROR';
      setMandatoryAttrs(span, requestId, tenantId, stage, status, error);
      span.end();
      throw err; // Re-throw to maintain existing error handling
    }
  });
}

/**
 * Synchronous version for stages that don't need async
 */
export function startStageSpanSync<T>(
  options: StartStageSpanOptions,
  callback: (span: Span, ctx: StageSpanContext & { updateStatus: (status: SpanStatus) => void }) => T
): T {
  const { requestId, tenantId, stage, stageAttrs, kind = SpanKind.INTERNAL, isDev = process.env.NODE_ENV !== 'production' } = options;

  // Validate stage-specific attributes in dev mode
  validateStageAttrs(stage, stageAttrs, isDev);

  const spanName = getSpanName(stage);
  let status: SpanStatus = 'OK';
  let error: { type?: string; message?: string } | undefined;

  return tracer.startActiveSpan(spanName, { kind }, (span) => {
    try {
      // Set mandatory attributes immediately
      setMandatoryAttrs(span, requestId, tenantId, stage, status);

      // Set stage-specific attributes
      setStageAttrs(span, stageAttrs);

      // Create context with updateStatus helper
      const ctx: StageSpanContext & { updateStatus: (status: SpanStatus) => void } = {
        requestId,
        tenantId,
        stage,
        status,
        updateStatus: (newStatus: SpanStatus) => {
          status = newStatus;
          setMandatoryAttrs(span, requestId, tenantId, stage, status, error);
        },
      };

      // Execute callback
      const result = callback(span, ctx);

      // Final status update
      setMandatoryAttrs(span, requestId, tenantId, stage, status, error);

      span.end();
      return result;
    } catch (err) {
      error = markSpanError(span, err);
      status = 'ERROR';
      setMandatoryAttrs(span, requestId, tenantId, stage, status, error);
      span.end();
      throw err; // Re-throw to maintain existing error handling
    }
  });
}

