import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('traceforge.core', '0.1.0');

export const m = {
  requests: meter.createCounter('traceforge.requests', {
    description: 'Total /v1/ask requests handled by orchestrator',
  }),

  endToEndLatencyMs: meter.createHistogram('traceforge.request.end_to_end_latency_ms', {
    description: 'End-to-end orchestrator latency in ms',
    unit: 'ms', // OpenTelemetry unit: milliseconds. Datadog may require manual unit override in UI for custom OTEL metrics.
  }),

  ragLatencyMs: meter.createHistogram('traceforge.rag.latency_ms', {
    description: 'RAG latency in ms',
    unit: 'ms',
  }),

  toolLatencyMs: meter.createHistogram('traceforge.tool.latency_ms', {
    description: 'Tool call latency in ms',
    unit: 'ms',
  }),

  llmLatencyMs: meter.createHistogram('traceforge.llm.latency_ms', {
    description: 'LLM generation latency in ms',
    unit: 'ms',
  }),

  evalLatencyMs: meter.createHistogram('traceforge.eval.latency_ms', {
    description: 'Evaluator latency in ms',
    unit: 'ms',
  }),

  toolErrors: meter.createCounter('traceforge.tool.errors', {
    description: 'Tool call errors',
  }),

  fallbackTriggered: meter.createCounter('traceforge.fallback.triggered', {
    description: 'Fallback responses triggered',
  }),

  safeModeTriggered: meter.createCounter('traceforge.safe_mode.triggered', {
    description: 'Safe mode triggered due to policy risk',
  }),

  askClarifyTriggered: meter.createCounter('traceforge.ask_clarify.triggered', {
    description: 'Ask-clarify remediation triggered due to low faithfulness',
  }),

  llmTotalTokens: meter.createHistogram('traceforge.llm.total_tokens', {
    description: 'Total tokens used by model call',
    unit: 'tokens',
  }),

  llmCostUsdEstimate: meter.createHistogram('traceforge.llm.cost_usd_estimate', {
    description: 'Estimated model cost per request in USD',
    unit: 'USD',
  }),

  qualityFaithfulness: meter.createHistogram('traceforge.eval.faithfulness_score', {
    description: 'Faithfulness score (0-1)',
  }),

  qualityPolicyRisk: meter.createHistogram('traceforge.eval.policy_risk_score', {
    description: 'Policy risk score (0-1)',
  }),

  qualityHallucination: meter.createCounter('traceforge.eval.hallucination_suspected', {
    description: 'Count of responses suspected of hallucination',
  }),
};

