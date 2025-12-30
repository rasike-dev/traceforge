// packages/rag/src/qdrant/seed-docs.ts

/**
 * Demo documents for TraceForge RAG
 * Covers: OpenTelemetry, TraceForge concepts, SLOs, hallucination detection
 */

export interface SeedDocument {
  id: string;
  text: string;
  source?: string;
}

export const DEMO_DOCUMENTS: SeedDocument[] = [
  {
    id: '1',
    text: 'OpenTelemetry is an open-source observability framework that provides a unified set of APIs, SDKs, and tools to instrument, generate, collect, and export telemetry data (metrics, logs, and traces). It enables developers to understand the behavior and performance of distributed systems by providing standardized instrumentation across different languages and frameworks.',
    source: 'opentelemetry-basics',
  },
  {
    id: '2',
    text: 'OpenTelemetry traces help developers understand request flows across microservices. Each trace contains spans that represent operations, making it possible to identify bottlenecks, errors, and performance issues in distributed systems. Traces are essential for debugging complex interactions between services.',
    source: 'opentelemetry-traces',
  },
  {
    id: '3',
    text: 'TraceForge is an AI observability platform that monitors, evaluates, and remediates AI application quality in real-time. It uses OpenTelemetry for instrumentation and provides automated quality scoring, hallucination detection, and remediation actions to ensure reliable AI responses.',
    source: 'traceforge-overview',
  },
  {
    id: '4',
    text: 'TraceForge evaluates AI responses using multiple dimensions: faithfulness (how much the answer overlaps with provided context), relevance (how much the answer addresses the query), policy risk (detection of unsafe content), and hallucination risk (inverse of faithfulness when context exists). The overall score is a weighted average of these dimensions.',
    source: 'traceforge-evaluation',
  },
  {
    id: '5',
    text: 'Hallucination detection in TraceForge works by comparing the generated answer against the retrieved context. If the answer contains information not present in the context, or if the faithfulness score is low, the system flags potential hallucinations. The evaluator uses keyword overlap and semantic similarity to measure faithfulness.',
    source: 'traceforge-hallucination',
  },
  {
    id: '6',
    text: 'SLO (Service Level Objective) burn rate measures how quickly an error budget is consumed. In TraceForge, the Response Quality SLO tracks the percentage of responses that meet the quality threshold (overall score >= 0.75). When the burn rate exceeds acceptable limits, alerts are triggered to prevent SLO violations.',
    source: 'traceforge-slo',
  },
  {
    id: '7',
    text: 'Remediation in TraceForge automatically triggers when evaluation scores drop below thresholds. The CLARIFICATION action is used when the overall quality score is below 0.75, prompting the system to ask for more information rather than providing potentially unreliable answers. This ensures users receive accurate, trustworthy responses.',
    source: 'traceforge-remediation',
  },
  {
    id: '8',
    text: 'OpenTelemetry spans represent individual operations within a trace. Each span has a name, start time, duration, and attributes. Spans can be nested to show parent-child relationships, making it easy to understand the flow of requests through a distributed system. TraceForge uses standardized span naming conventions for consistency.',
    source: 'opentelemetry-spans',
  },
  {
    id: '9',
    text: 'RAG (Retrieval-Augmented Generation) combines information retrieval with language models. TraceForge uses RAG to provide context to LLMs by retrieving relevant documents from a knowledge base. The retrieved context is then used to generate more accurate, grounded responses that reduce hallucination risk.',
    source: 'traceforge-rag',
  },
  {
    id: '10',
    text: 'Quality thresholds in TraceForge are configurable but default to 0.75 for the overall score. When a response scores below this threshold, remediation is triggered. The threshold balances between allowing some variation in quality while ensuring users receive reliable information. Different thresholds can be set for different use cases.',
    source: 'traceforge-thresholds',
  },
  {
    id: '11',
    text: 'Distributed tracing with OpenTelemetry enables end-to-end visibility across services. By instrumenting each service with OpenTelemetry SDKs, developers can trace requests from entry points through multiple services, databases, and external APIs. This visibility is crucial for understanding system behavior and debugging issues.',
    source: 'opentelemetry-distributed',
  },
  {
    id: '12',
    text: 'Faithfulness scoring in TraceForge measures how much of the generated answer can be verified against the retrieved context. High faithfulness means the answer is well-grounded in the provided information, while low faithfulness indicates the model may be generating information not present in the context, increasing hallucination risk.',
    source: 'traceforge-faithfulness',
  },
  {
    id: '13',
    text: 'Policy risk detection in TraceForge scans responses for potentially unsafe content, including PII (Personally Identifiable Information), sensitive data patterns, and unsafe request patterns. When policy risk exceeds thresholds, the system can trigger SAFE_MODE remediation to prevent exposing sensitive information.',
    source: 'traceforge-policy',
  },
  {
    id: '14',
    text: 'OpenTelemetry metrics complement traces by providing aggregated measurements over time. Common metrics include request counts, latency histograms, error rates, and custom business metrics. TraceForge emits metrics for each stage of the pipeline: RAG latency, LLM tokens, evaluation scores, and remediation triggers.',
    source: 'opentelemetry-metrics',
  },
  {
    id: '15',
    text: 'Error taxonomy in TraceForge categorizes failures into coarse types (RAG_ERROR, TOOL_ERROR, LLM_ERROR) and fine-grained codes (RAG_PROVIDER_DOWN, TOOL_TIMEOUT, LLM_RATE_LIMIT). This taxonomy enables consistent error reporting, better debugging, and targeted remediation strategies based on error type.',
    source: 'traceforge-errors',
  },
  {
    id: '16',
    text: 'Relevance scoring measures how well the generated answer addresses the user query. TraceForge calculates relevance by comparing keyword overlap between the query and answer. High relevance ensures the answer is on-topic and directly addresses what the user asked, while low relevance indicates the answer may be off-topic or generic.',
    source: 'traceforge-relevance',
  },
  {
    id: '17',
    text: 'Qdrant is a vector database optimized for similarity search. TraceForge uses Qdrant for RAG retrieval, storing document embeddings and enabling fast semantic search. The vector database allows the system to find relevant context quickly, even with large knowledge bases containing thousands of documents.',
    source: 'traceforge-qdrant',
  },
  {
    id: '18',
    text: 'Span attributes in OpenTelemetry provide additional context about operations. TraceForge sets mandatory attributes on every span including request_id, tenant_id, stage, and status. Stage-specific attributes like llm.provider, tool.name, and eval.overall provide detailed observability for each pipeline stage.',
    source: 'opentelemetry-attributes',
  },
  {
    id: '19',
    text: 'Remediation actions in TraceForge include CLARIFICATION (ask for more details), SAFE_MODE (refuse unsafe requests), FALLBACK_TOOL (use alternative tool), and RETRY_LLM (retry with different parameters). Each action is triggered based on specific conditions detected during evaluation, ensuring appropriate responses to quality issues.',
    source: 'traceforge-actions',
  },
  {
    id: '20',
    text: 'Observability in AI systems requires monitoring not just technical metrics but also quality metrics. TraceForge provides comprehensive observability by combining traditional metrics (latency, errors) with AI-specific metrics (token usage, cost, quality scores). This dual approach ensures both system reliability and AI response quality.',
    source: 'traceforge-observability',
  },
];
