/**
 * Error Taxonomy - Phase 1 Step 3
 * Canonical error classification for all failures
 */

/**
 * Canonical request status (used everywhere)
 */
export type RequestStatus = 'OK' | 'DEGRADED' | 'ERROR';

/**
 * Error type (coarse, bounded)
 */
export type ErrorType =
  | 'RAG_ERROR'
  | 'TOOL_ERROR'
  | 'LLM_ERROR'
  | 'EVALUATION_ERROR'
  | 'REMEDIATION_ERROR'
  | 'VALIDATION_ERROR'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'UNKNOWN';

/**
 * Error code (fine-grained, still bounded)
 */
export type ErrorCode =
  // RAG errors
  | 'RAG_EMPTY_RESULT'
  | 'RAG_PROVIDER_DOWN'
  | 'RAG_TIMEOUT'
  // Tool errors
  | 'TOOL_TIMEOUT'
  | 'TOOL_BAD_RESPONSE'
  | 'TOOL_UNAVAILABLE'
  // LLM errors
  | 'LLM_RATE_LIMIT'
  | 'LLM_CONTEXT_TOO_LARGE'
  | 'LLM_PROVIDER_DOWN'
  // Evaluation errors
  | 'EVAL_MODEL_FAILURE'
  // Policy/Remediation errors
  | 'POLICY_VIOLATION'
  | 'REMEDIATION_FALLBACK_FAILED'
  // Generic
  | 'UNKNOWN';

/**
 * Error classification result
 */
export interface ErrorClassification {
  type: ErrorType;
  code: ErrorCode;
  message: string;
}

/**
 * Map error to taxonomy based on stage and error details
 */
export function classifyError(
  stage: 'rag' | 'tool' | 'llm' | 'evaluation' | 'remediation',
  error: unknown,
  context?: { timeout?: boolean; rateLimit?: boolean; providerDown?: boolean; emptyResult?: boolean }
): ErrorClassification {
  const e = error as any;
  const errMessage = e?.message ?? 'Unknown error';
  const errCode = e?.code;

  switch (stage) {
    case 'rag':
      if (context?.timeout) {
        return { type: 'TIMEOUT', code: 'RAG_TIMEOUT', message: errMessage };
      }
      if (context?.providerDown) {
        return { type: 'RAG_ERROR', code: 'RAG_PROVIDER_DOWN', message: errMessage };
      }
      if (context?.emptyResult) {
        return { type: 'RAG_ERROR', code: 'RAG_EMPTY_RESULT', message: errMessage };
      }
      return { type: 'RAG_ERROR', code: 'RAG_PROVIDER_DOWN', message: errMessage };

    case 'tool':
      if (errCode === 'TOOL_TIMEOUT' || context?.timeout) {
        return { type: 'TIMEOUT', code: 'TOOL_TIMEOUT', message: errMessage };
      }
      if (context?.providerDown) {
        return { type: 'TOOL_ERROR', code: 'TOOL_UNAVAILABLE', message: errMessage };
      }
      // Non-2xx or tool failure
      return { type: 'TOOL_ERROR', code: 'TOOL_BAD_RESPONSE', message: errMessage };

    case 'llm':
      if (context?.rateLimit) {
        return { type: 'RATE_LIMIT', code: 'LLM_RATE_LIMIT', message: errMessage };
      }
      if (context?.providerDown) {
        return { type: 'LLM_ERROR', code: 'LLM_PROVIDER_DOWN', message: errMessage };
      }
      // Context too large or other LLM errors
      return { type: 'LLM_ERROR', code: 'LLM_CONTEXT_TOO_LARGE', message: errMessage };

    case 'evaluation':
      return { type: 'EVALUATION_ERROR', code: 'EVAL_MODEL_FAILURE', message: errMessage };

    case 'remediation':
      return { type: 'REMEDIATION_ERROR', code: 'REMEDIATION_FALLBACK_FAILED', message: errMessage };

    default:
      return { type: 'UNKNOWN', code: 'UNKNOWN', message: errMessage };
  }
}

/**
 * Determine final request status based on stage failures and remediation
 */
export function determineFinalStatus(
  stageErrors: Array<{ stage: string; error: ErrorClassification | null }>,
  remediationTriggered: boolean,
  remediationSucceeded: boolean,
  hasUsableResponse: boolean
): RequestStatus {
  // If no usable response can be produced → ERROR
  if (!hasUsableResponse) {
    return 'ERROR';
  }

  // If any stage failed but remediation succeeded → DEGRADED
  const hasStageErrors = stageErrors.some(e => e.error !== null);
  if (hasStageErrors && remediationSucceeded) {
    return 'DEGRADED';
  }

  // If remediation triggered and succeeded → DEGRADED
  if (remediationTriggered && remediationSucceeded) {
    return 'DEGRADED';
  }

  // If remediation triggered but failed → ERROR (unless we still return something)
  if (remediationTriggered && !remediationSucceeded && !hasUsableResponse) {
    return 'ERROR';
  }

  // If any stage failed but we have a response → DEGRADED
  if (hasStageErrors && hasUsableResponse) {
    return 'DEGRADED';
  }

  // Otherwise → OK
  return 'OK';
}

