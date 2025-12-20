export type ChaosFlags = {
  breakTool?: boolean;
  badRag?: boolean;
  policyRisk?: boolean;
  tokenSpike?: boolean;
};

export type AskRequest = {
  requestId: string;
  input: string;
  tenant?: string;
  chaos?: ChaosFlags;
};

export type EvalScores = {
  faithfulness: number;      // 0..1
  relevance: number;         // 0..1
  policyRisk: number;        // 0..1
  formatCompliance: 0 | 1;
  hallucinationSuspected: 0 | 1;
};

export type OrchestrationMeta = {
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsdEstimate: number;
  remediationApplied?: string;
};

export type AskResponse = {
  requestId: string;
  answer: string;
  scores: EvalScores;
  meta: OrchestrationMeta;
};

