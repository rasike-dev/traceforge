// Legacy chaos flags (kept for backward compatibility during transition)
export type ChaosFlags = {
  breakTool?: boolean;
  badRag?: boolean;
  policyRisk?: boolean;
  tokenSpike?: boolean;
};

// A) AskRequest - Public contract
export type AskRequest = {
  requestId: string; // Generated if not provided
  tenantId: string;
  input: { text: string };
  context?: {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, any>;
  };
  options?: {
    trace?: boolean;
    evaluation?: boolean;
    remediation?: boolean;
  };
  // Legacy support during transition
  chaos?: ChaosFlags;
};

// C) EvalScores - Public contract
export type EvalScores = {
  faithfulness: number; // 0..1
  relevance: number; // 0..1
  policyRisk: number; // 0..1
  hallucination: number; // 0..1
  overall: number; // 0..1
  reasons?: string[];
  // Extra fields we keep
  formatCompliance?: 0 | 1;
};

// D) RemediationReport - Public contract
export type RemediationReport = {
  triggered: boolean;
  actions: Array<{
    type: 'SAFE_MODE' | 'FALLBACK_TOOL' | 'CLARIFICATION' | 'RETRY_LLM';
    reason: string;
  }>;
  finalMode: 'NORMAL' | 'SAFE' | 'DEGRADED';
};

// B) AskResponse - Public contract
export type AskResponse = {
  requestId: string;
  tenantId: string;
  answer: { text: string };
  artifacts?: {
    citations?: any[];
    toolResults?: any[];
  };
  usage?: {
    tokensIn: number;
    tokensOut: number;
    totalTokens: number;
    costUsd: number;
  };
  eval?: EvalScores;
  remediation?: RemediationReport;
  debug?: {
    traceId?: string;
    spanId?: string;
  };
};

