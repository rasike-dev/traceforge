import type { Stage, SpanStatus } from './span-names';

/**
 * Base attributes required for ALL spans
 */
export interface BaseSpanAttrs {
  traceforge: {
    request_id: string;
    tenant_id: string;
    stage: Stage;
    status: SpanStatus;
  };
  'service.name': string;
  'deployment.environment': string;
  'error.type'?: string;
  'error.message'?: string;
}

/**
 * Stage-specific required attributes
 * Each stage must provide these attributes
 */
export interface RagSpanAttrs {
  'rag.provider': string;
  'rag.top_k': number;
  'rag.docs.count': number;
  'rag.query.length': number;
}

export interface ToolSpanAttrs {
  'tool.name': string;
  'tool.attempt': number;
  'tool.timeout_ms': number;
  'tool.result': 'SUCCESS' | 'FAILURE' | 'FALLBACK';
}

export interface LlmSpanAttrs {
  'llm.provider': string;
  'llm.model': string;
  'llm.tokens.input': number;
  'llm.tokens.output': number;
  'llm.tokens.total': number;
  'llm.cost.usd': number;
}

export interface EvaluationSpanAttrs {
  'eval.faithfulness': number;
  'eval.relevance': number;
  'eval.policy_risk': number;
  'eval.hallucination': number;
  'eval.overall': number;
}

export interface RemediationSpanAttrs {
  'remediation.triggered': boolean;
  'remediation.action': 'SAFE_MODE' | 'FALLBACK_TOOL' | 'CLARIFICATION' | 'RETRY_LLM' | 'NONE';
  'remediation.reason': string;
}

/**
 * Union type for stage-specific attributes
 */
export type StageSpecificAttrs =
  | { stage: 'rag'; attrs: RagSpanAttrs }
  | { stage: 'tool'; attrs: ToolSpanAttrs }
  | { stage: 'llm'; attrs: LlmSpanAttrs }
  | { stage: 'evaluation'; attrs: EvaluationSpanAttrs }
  | { stage: 'remediation'; attrs: RemediationSpanAttrs }
  | { stage: 'request'; attrs?: Record<string, unknown> }; // Request span has no required stage-specific attrs

/**
 * Validate that all required attributes are present
 * Throws in dev mode if missing
 */
export function validateStageAttrs(
  stage: Stage,
  attrs: Record<string, unknown>,
  isDev: boolean = process.env.NODE_ENV !== 'production'
): void {
  if (!isDev) return; // Only validate in dev mode

  const missing: string[] = [];

  switch (stage) {
    case 'rag': {
      const required: (keyof RagSpanAttrs)[] = ['rag.provider', 'rag.top_k', 'rag.docs.count', 'rag.query.length'];
      for (const key of required) {
        if (attrs[key] === undefined || attrs[key] === null) {
          missing.push(key);
        }
      }
      break;
    }
    case 'tool': {
      const required: (keyof ToolSpanAttrs)[] = ['tool.name', 'tool.attempt', 'tool.timeout_ms', 'tool.result'];
      for (const key of required) {
        if (attrs[key] === undefined || attrs[key] === null) {
          missing.push(key);
        }
      }
      break;
    }
    case 'llm': {
      const required: (keyof LlmSpanAttrs)[] = [
        'llm.provider',
        'llm.model',
        'llm.tokens.input',
        'llm.tokens.output',
        'llm.tokens.total',
        'llm.cost.usd',
      ];
      for (const key of required) {
        if (attrs[key] === undefined || attrs[key] === null) {
          missing.push(key);
        }
      }
      break;
    }
    case 'evaluation': {
      const required: (keyof EvaluationSpanAttrs)[] = [
        'eval.faithfulness',
        'eval.relevance',
        'eval.policy_risk',
        'eval.hallucination',
        'eval.overall',
      ];
      for (const key of required) {
        if (attrs[key] === undefined || attrs[key] === null) {
          missing.push(key);
        }
      }
      break;
    }
    case 'remediation': {
      const required: (keyof RemediationSpanAttrs)[] = ['remediation.triggered', 'remediation.action', 'remediation.reason'];
      for (const key of required) {
        if (attrs[key] === undefined || attrs[key] === null) {
          missing.push(key);
        }
      }
      break;
    }
    case 'request':
      // Request span has no required stage-specific attrs
      break;
  }

  if (missing.length > 0) {
    const error = new Error(
      `Missing required attributes for stage '${stage}': ${missing.join(', ')}`
    );
    console.error('[TraceForge] Validation error:', error.message);
    console.error('[TraceForge] Provided attributes:', Object.keys(attrs));
    throw error;
  }
}

