import { context, propagation, trace, SpanStatusCode } from '@opentelemetry/api';

export const tracer = trace.getTracer('traceforge.core', '0.1.0');

export function setCommonSpanAttrs(span: any, attrs: Record<string, unknown>) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    span.setAttribute(k, typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : JSON.stringify(v));
  }
}

/**
 * Sets mandatory attributes on ALL spans (root + children)
 * Must be called on every span to ensure consistent taxonomy
 */
export function setMandatorySpanAttrs(
  span: any,
  requestId: string,
  tenantId: string,
  stage: 'request' | 'rag' | 'tool' | 'llm' | 'evaluation' | 'remediation',
  status: 'OK' | 'ERROR' | 'DEGRADED' = 'OK',
  error?: { type?: string; message?: string }
) {
  // Identity & scope
  span.setAttribute('traceforge.request_id', requestId);
  span.setAttribute('traceforge.tenant_id', tenantId);
  span.setAttribute('traceforge.stage', stage);
  
  // Environment (from resource attributes, but ensure on span)
  const serviceName = process.env.OTEL_SERVICE_NAME || 'traceforge-api';
  const deploymentEnv = process.env.OTEL_DEPLOYMENT_ENVIRONMENT || process.env.NODE_ENV || 'dev';
  span.setAttribute('service.name', serviceName);
  span.setAttribute('deployment.environment', deploymentEnv);
  
  // Outcomes
  span.setAttribute('traceforge.status', status);
  
  // Error attributes (only when error)
  if (error && (status === 'ERROR' || error.type || error.message)) {
    if (error.type) span.setAttribute('error.type', error.type);
    if (error.message) span.setAttribute('error.message', error.message);
  }
}

export function markError(span: any, err: unknown) {
  const e = err as any;
  span.recordException(e);
  span.setStatus({ code: SpanStatusCode.ERROR, message: e?.message ?? 'error' });
}

export function getTraceContext() {
  // Useful for log correlation: capture current traceparent into a string
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier; // will include "traceparent" when tracing is active
}

