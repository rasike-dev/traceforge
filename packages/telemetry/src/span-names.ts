/**
 * Span name taxonomy - single source of truth
 * All span names must come from here to prevent drift
 */
export const SPAN_NAMES = {
  REQUEST: 'traceforge.request',
  RAG: 'traceforge.rag',
  TOOL: 'traceforge.tool',
  LLM: 'traceforge.llm',
  EVALUATION: 'traceforge.evaluation',
  REMEDIATION: 'traceforge.remediation',
} as const;

/**
 * Stage enum - matches the taxonomy
 */
export type Stage = 'request' | 'rag' | 'tool' | 'llm' | 'evaluation' | 'remediation';

/**
 * Status enum
 */
export type SpanStatus = 'OK' | 'ERROR' | 'DEGRADED';

/**
 * Get span name for a stage
 */
export function getSpanName(stage: Stage): string {
  const mapping: Record<Stage, string> = {
    request: SPAN_NAMES.REQUEST,
    rag: SPAN_NAMES.RAG,
    tool: SPAN_NAMES.TOOL,
    llm: SPAN_NAMES.LLM,
    evaluation: SPAN_NAMES.EVALUATION,
    remediation: SPAN_NAMES.REMEDIATION,
  };
  return mapping[stage];
}

