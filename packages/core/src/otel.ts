import { context, propagation, trace, SpanStatusCode } from '@opentelemetry/api';

export const tracer = trace.getTracer('traceforge.core', '0.1.0');

export function setCommonSpanAttrs(span: any, attrs: Record<string, unknown>) {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    span.setAttribute(k, typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : JSON.stringify(v));
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

