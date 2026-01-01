# TraceForge 🔥

> **The Complete AI Orchestration Platform with Built-in Observability, Evaluation, and Remediation**

TraceForge is a production-ready, enterprise-grade orchestration framework for building reliable AI applications. Unlike traditional AI orchestration tools, TraceForge provides **deep observability**, **automatic quality evaluation**, and **intelligent remediation** out of the box—all while orchestrating RAG, LLM, and tool calls.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-11.0-E0234E.svg)](https://nestjs.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10.26-F69220.svg)](https://pnpm.io/)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-enabled-000000.svg)](https://opentelemetry.io/)

---

## 🎯 Why TraceForge?

### The Problem with Traditional AI Orchestration

Most AI orchestration tools are **blind**. They execute workflows but provide no insight into:
- ❌ **What went wrong** when responses are incorrect
- ❌ **Why costs spiked** on certain requests
- ❌ **Where hallucinations occur** in the pipeline
- ❌ **How to automatically fix** issues when they happen

### The TraceForge Solution

TraceForge is the **first orchestration platform** that combines:

1. **🔍 Deep Observability**: Every RAG retrieval, LLM call, and tool execution is automatically traced with OpenTelemetry
2. **📊 Quality Evaluation**: Built-in scoring for faithfulness, relevance, policy compliance, and hallucination detection
3. **🛡️ Intelligent Remediation**: Automatic fallback strategies when tools fail, policy violations occur, or quality degrades
4. **💰 Cost Tracking**: Real-time token usage and cost estimation per request
5. **🏗️ Production-Ready**: Designed for enterprise scale with multi-tenant support

---

## ✨ Key Features

### 🔄 Intelligent Orchestration
- **Multi-stage pipeline**: RAG → Tools → LLM → Evaluation → Remediation
- **Graceful degradation**: Continue serving requests even when components fail
- **Request tracking**: Full traceability with unique request IDs

### 📈 Built-in Observability
- **OpenTelemetry integration**: Automatic distributed tracing
- **Custom metrics**: Latency, token usage, costs, quality scores
- **Span attributes**: Rich context on every operation
- **Error tracking**: Automatic error capture and attribution

### 🎯 Quality Evaluation
- **Faithfulness scoring**: Detects when responses don't match context (0-1 scale)
- **Relevance assessment**: Ensures retrieved context matches the query (0-1 scale)
- **Policy risk detection**: Identifies potential compliance violations (0-1 scale)
- **Hallucination detection**: Flags suspicious outputs automatically (0-1 scale)
- **Overall quality score**: Weighted composite (threshold: 0.75 for remediation)
- **Automatic evaluation**: Runs on every request with full observability

### 🛡️ Automatic Remediation
- **CLARIFICATION**: Requests user clarification when quality is low (`overall < 0.75`)
- **Status degradation**: Root span marked as `DEGRADED` when remediation triggers
- **Observable remediation**: Full tracing and metrics for all remediation actions
- **Configurable thresholds**: Quality threshold (0.75) can be adjusted
- **Future strategies**: SAFE_MODE, FALLBACK_TOOL, RETRY_LLM (coming soon)

### 💰 Cost & Performance Tracking
- **Token monitoring**: Track input, output, and total tokens per request (real Gemini API)
- **Cost estimation**: Real-time USD cost calculation based on actual model pricing
- **Performance metrics**: Latency tracking for every stage (RAG, LLM, evaluation, remediation)
- **Multi-tenant support**: Isolate metrics by tenant ID
- **Model fallback tracking**: Automatic fallback to available models with cost transparency

---

## 🏗️ Architecture

TraceForge is built as a **monorepo** using pnpm workspaces, enabling code sharing and independent versioning across packages.

```
traceforge/
├── apps/
│   └── api/              # NestJS REST API server
├── packages/
│   ├── core/             # Orchestration engine
│   ├── telemetry/        # OpenTelemetry initialization
│   ├── evaluator/        # Quality evaluation logic
│   ├── llm/              # LLM provider abstractions
│   ├── rag/              # RAG retrieval implementations
│   ├── remediation/      # Remediation strategies
│   ├── tools/            # Tool execution framework
│   └── config/           # Shared configuration
```

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: NestJS (for API layer)
- **Build Tool**: tsup (for packages)
- **Observability**: OpenTelemetry SDK → OTLP → Datadog Agent (Sidecar) → Datadog Cloud
- **LLM Provider**: Google Gemini (real API integration, gemini-2.5-flash)
- **Vector Database**: Qdrant (keyword search, embeddings coming soon)
- **Package Manager**: pnpm workspaces
- **Deployment**: Google Cloud Run (Serverless)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 10.26+
- Docker (for Qdrant vector database)
- Datadog account (for observability)

### Installation

```bash
# Clone the repository
git clone https://github.com/rasike-dev/traceforge.git
cd traceforge

# Install dependencies
pnpm install

# Build all packages
pnpm -r build
```

### Environment Setup

1. **Get API Keys**:

   **Google Gemini API Key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Copy the key

   **Datadog API Key**:
   - Go to [Datadog API Keys](https://app.datadoghq.com/organization-settings/api-keys)
   - Create a new API key
   - Copy the key

2. **Create `.env` file** in the project root:

```bash
# Required: Google Gemini API Key
GEMINI_API_KEY=your-gemini-api-key-here

# Required: Datadog API Key (for Datadog Agent)
DD_API_KEY=your-datadog-api-key-here

# Optional: OpenTelemetry Configuration
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
OTEL_METRIC_EXPORT_INTERVAL_MS=5000
NODE_ENV=development
```

2. **Start Qdrant (Vector Database)**:

```bash
# Run Qdrant in Docker
docker run -p 6333:6333 -p 6334:6334 qdrant/qdrant

# Seed Qdrant with demo documents
cd packages/rag
pnpm tsx src/qdrant/seed.ts
```

3. **Start Datadog Agent** (for observability):

```bash
# Start Datadog Agent with OpenTelemetry receiver
docker run -d \
  --name traceforge-datadog-agent \
  -e DD_API_KEY=your_datadog_api_key \
  -e DD_SITE=datadoghq.com \
  -e DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT=0.0.0.0:4318 \
  -p 4318:4318 \
  -p 8126:8126 \
  gcr.io/datadoghq/agent:latest

# Or use docker-compose (if available)
docker-compose -f docker-compose.local.yml up -d
```

**Note**: The Datadog Agent will receive traces and metrics on `localhost:4318` (OTLP endpoint).

### Running the API

```bash
# Set environment variables for OpenTelemetry
export TELEMETRY_PROVIDER=opentelemetry
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_SERVICE_NAME=traceforge-api
export OTEL_METRIC_EXPORT_INTERVAL_MS=5000

# Start the API server (development mode)
pnpm --filter api run start:dev

# The API will be available at http://localhost:3000
```

**Note**: Make sure Qdrant and Datadog Agent are running before starting the API.

### Production Deployment

**🌐 Live Production Service:**
- **URL:** https://traceforge-api-oymutya24a-uc.a.run.app
- **Platform:** Google Cloud Run (Serverless)
- **Region:** us-central1
- **Status:** ✅ Live and Operational

**Architecture:**
- OpenTelemetry SDK → OTLP (localhost:4318) → Datadog Agent Sidecar → Datadog Cloud
- Real Gemini LLM integration (gemini-2.5-flash)
- Real Qdrant RAG backend
- Full observability (traces + metrics exported every 5 seconds)

**Test Production:**
```bash
# Health check
curl https://traceforge-api-oymutya24a-uc.a.run.app/health

# Send a request
curl -X POST https://traceforge-api-oymutya24a-uc.a.run.app/v1/ask \
  -H "Content-Type: application/json" \
  -d '{"input": "What is observability?", "tenant": "production-test"}'
```

**View Observability in Datadog:**
- **APM Service:** https://app.datadoghq.com/apm/service/traceforge-api
- **Environment:** `production`
- **Filter:** `env:production`

For detailed production information and judge submission details, see [JUDGE_SUBMISSION_INFO.md](./JUDGE_SUBMISSION_INFO.md).

---

## 📡 API Reference

### Health Check

```bash
GET /health
```

Returns: `{ "ok": true }`

### Ask Endpoint

```bash
POST /v1/ask
Content-Type: application/json

{
  "input": "What's the weather today?",
  "tenant": "acme-corp"  # optional
}
```

**Query Parameters** (for testing):
- `breakTool=true` - Simulate tool failure
- `badRag=true` - Simulate poor RAG retrieval
- `policyRisk=true` - Simulate policy violation
- `tokenSpike=true` - Simulate high token usage

**Note**: All parameters are optional. The system will use real Gemini API and Qdrant RAG by default.

**Response**:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "answer": "The weather today is sunny with a high of 75°F...",
  "scores": {
    "faithfulness": 0.88,
    "relevance": 0.9,
    "policy_risk": 0.1,
    "hallucination": 0.12,
    "overall": 0.85
  },
  "meta": {
    "modelName": "gemini-2.5-flash",
    "inputTokens": 200,
    "outputTokens": 120,
    "totalTokens": 320,
    "costUsdEstimate": 0.00032,
    "remediation": null,
    "ragDocs": 3
  }
}
```

**Response with Remediation** (when quality is low):

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440001",
  "answer": "I may not have enough reliable information. Could you clarify or provide more details?",
  "scores": {
    "faithfulness": 0.45,
    "relevance": 0.5,
    "policy_risk": 0.1,
    "hallucination": 0.55,
    "overall": 0.65
  },
  "meta": {
    "modelName": "gemini-2.5-flash",
    "inputTokens": 180,
    "outputTokens": 95,
    "totalTokens": 275,
    "costUsdEstimate": 0.00028,
    "remediation": "CLARIFICATION",
    "ragDocs": 0
  }
}
```

---

## 🔬 Understanding the Orchestration Flow

```
User Request
    ↓
[RAG Retrieval] ───→ Context + Docs Count
    ↓
[Tool Execution] ───→ Tool Results (or failure)
    ↓
[LLM Generation] ───→ Answer + Token Usage + Cost
    ↓
[Evaluation] ───→ Quality Scores (faithfulness, relevance, policy risk, hallucination)
    ↓
[Remediation] ───→ Apply fixes if needed (safe mode, fallback, clarification)
    ↓
Response to User
```

Every stage is:
- ✅ **Traced** with OpenTelemetry spans
- ✅ **Monitored** with custom metrics
- ✅ **Scored** for quality
- ✅ **Remediated** if issues are detected

---

## 🎨 What Makes TraceForge Unique?

### 1. **Observability-First Design**

Unlike LangChain, LlamaIndex, or other orchestration frameworks that treat observability as an afterthought, TraceForge **bakes observability into the core**. Every operation is automatically traced, metered, and logged.

### 2. **Quality Evaluation Built-In**

Traditional tools require you to build custom evaluation logic. TraceForge provides **production-ready evaluation** that runs on every request, scoring:
- Faithfulness (how well the answer matches context)
- Relevance (how well context matches the query)
- Policy compliance (safety and compliance checks)
- Hallucination detection (flagging suspicious outputs)

### 3. **Intelligent Remediation**

When something goes wrong, TraceForge doesn't just fail—it **automatically tries to fix it**:
- Tool failures → Fallback to alternative tools
- Policy violations → Safe mode activation
- Low quality → Request clarification from user

### 4. **Multi-Tenant Ready**

Built with enterprise needs in mind, TraceForge supports:
- Tenant isolation
- Per-tenant metrics
- Per-tenant cost tracking
- Per-tenant quality monitoring

### 5. **Cost Transparency**

Every request provides:
- Exact token counts (input/output/total)
- USD cost estimates
- Performance metrics
- Quality scores

This enables **data-driven optimization** and **cost accountability**.

---

## 🛠️ Development

### Building Packages

```bash
# Build all packages
pnpm -r build

# Build a specific package
cd packages/core
pnpm build

# Watch mode for development
pnpm dev
```

### Testing the Demo Scenario

Run the included demo script to see good vs. bad paths with remediation:

```bash
# Run demo scenario (good path + bad path with remediation)
./demo-scenario.sh
```

This script demonstrates:
- ✅ **Good path**: High quality response → `status=OK`, no remediation
- ⚠️ **Bad path**: Low quality response → `status=DEGRADED`, `remediation=CLARIFICATION`

### Running Tests

```bash
# Run API tests
cd apps/api
pnpm test

# Run with coverage
pnpm test:cov

# E2E tests
pnpm test:e2e
```

### Code Quality

```bash
# Lint
pnpm lint

# Format
pnpm format
```

---

## 📦 Package Details

### `@traceforge/core`

The orchestration engine that coordinates RAG, tools, LLM, evaluation, and remediation. This is the heart of TraceForge.

**Key exports**:
- `orchestrate()` - Main orchestration function
- Types: `AskRequest`, `AskResponse`, `EvalScores`

### `@traceforge/telemetry`

OpenTelemetry initialization and configuration with vendor-neutral abstraction. Supports both Datadog native tracer and OpenTelemetry SDK.

**Key exports**:
- `initTelemetry()` - Initialize telemetry provider (auto-detects or uses TELEMETRY_PROVIDER)
- Provider abstraction for switching between Datadog and OpenTelemetry

**Features**:
- Loosely coupled architecture (can switch observability vendors)
- OpenTelemetry SDK with OTLP export
- Automatic provider detection (DD_API_KEY → Datadog, else OpenTelemetry)
- Continuous metrics export (configurable interval, default 5 seconds)

### `@traceforge/evaluator`

Deterministic quality evaluation system that scores LLM responses on multiple dimensions.

**Key exports**:
- `basicEvaluate()` - Evaluates responses for faithfulness, relevance, policy risk, hallucination, and overall quality
- Types: `BasicEvaluationInput`, `BasicEvaluationScores`

**Evaluation Dimensions**:
- **Faithfulness**: How well the answer matches retrieved context
- **Relevance**: How well the answer matches the query
- **Policy Risk**: Detection of unsafe or non-compliant content
- **Hallucination**: Likelihood of fabricated information
- **Overall**: Weighted composite score (threshold: 0.75 for remediation)

### `@traceforge/llm`

LLM provider implementations with real Google Gemini integration.

**Key exports**:
- `GeminiProvider` - Real Google Gemini API integration
- Automatic model fallback (gemini-2.5-flash → gemini-2.0-flash → gemini-1.5-pro)
- Token usage tracking and cost calculation

**Supported Models**:
- `gemini-2.5-flash` (default, fast and cost-effective)
- `gemini-2.0-flash` (fallback)
- `gemini-1.5-pro` (fallback for complex tasks)
- `gemini-pro` (legacy fallback)

### `@traceforge/rag`

RAG retrieval implementations with real Qdrant vector database integration.

**Key exports**:
- `QdrantRagProvider` - Real Qdrant integration for document retrieval
- Keyword-based search (Phase 1.2, embeddings coming soon)
- Automatic collection initialization and seeding

**Features**:
- Local Qdrant Docker setup
- 20 pre-seeded demo documents
- Keyword matching with relevance scoring
- Top-K document retrieval

### Other Packages

- **remediation**: Remediation strategy implementations (CLARIFICATION currently implemented)
- **tools**: Tool execution framework (mock implementations, ready for real integrations)

---

## 🎯 Use Cases

TraceForge is perfect for:

- ✅ **Enterprise AI Applications**: Need observability, compliance, and reliability
- ✅ **Production AI Services**: Require quality guarantees and cost tracking
- ✅ **Multi-Tenant SaaS**: Need tenant isolation and per-tenant metrics
- ✅ **High-Stakes Applications**: Where failures are costly and quality matters
- ✅ **Compliance-Critical Systems**: Policy enforcement and auditability required

---

## 📊 Observability & Monitoring

TraceForge provides comprehensive observability out of the box with pre-configured Datadog dashboards, monitors, and SLOs. The system uses **OpenTelemetry SDK** with **OTLP protocol** for vendor-neutral observability, forwarding to Datadog via a sidecar agent pattern.

### Observability Architecture

**Local Development:**
```
TraceForge API → OTLP (localhost:4318) → Datadog Agent (Docker) → Datadog Cloud
```

**Production (Cloud Run):**
```
TraceForge API → OTLP (localhost:4318) → Datadog Agent (Sidecar) → Datadog Cloud
```

**Key Features:**
- ✅ Vendor-neutral (OpenTelemetry SDK, not locked to Datadog)
- ✅ Continuous metrics export (every 5 seconds)
- ✅ Real-time trace export (on request completion)
- ✅ Automatic provider detection
- ✅ Can switch observability vendors by changing exporter endpoint

### Distributed Tracing

Every request creates a complete trace with spans for:
- `traceforge.request` - Root span for the entire request
- `traceforge.rag` - RAG retrieval stage
- `traceforge.tool` - Tool execution stage
- `traceforge.llm` - LLM generation stage
- `traceforge.evaluation` - Quality evaluation stage
- `traceforge.remediation` - Remediation stage (if triggered)

### Custom Metrics

All metrics are exported to Datadog via OpenTelemetry OTLP protocol. Metrics are continuously pushed every 5 seconds (configurable via `OTEL_METRIC_EXPORT_INTERVAL_MS`):

**Request Metrics**:
- `traceforge.request.count` - Total requests handled
- `traceforge.request.latency_ms` - End-to-end request latency (histogram)
- `traceforge.request.quality_ok` - Requests meeting quality threshold (≥ 0.75)

**RAG Metrics**:
- `traceforge.rag.latency_ms` - RAG retrieval latency (histogram)
- `traceforge.rag.docs.count` - Number of documents retrieved (up/down counter)

**LLM Metrics**:
- `traceforge.llm.latency_ms` - LLM generation latency (histogram)
- `traceforge.llm.tokens.input` - Input tokens consumed (counter)
- `traceforge.llm.tokens.output` - Output tokens generated (counter)
- `traceforge.llm.cost.usd` - Estimated cost in USD (counter)

**Evaluation Metrics**:
- `traceforge.eval.score` - Evaluation scores (up/down counter) with dimension tags: `faithfulness`, `relevance`, `policy_risk`, `hallucination`, `overall`

**Remediation Metrics**:
- `traceforge.remediation.triggered` - Remediation actions triggered (counter) with action tags: `CLARIFICATION`, `SAFE_MODE`, `FALLBACK_TOOL`, `RETRY_LLM`

**Tool Metrics**:
- `traceforge.tool.calls` - Successful tool calls (counter)
- `traceforge.tool.errors` - Tool call errors (counter)
- `traceforge.tool.latency_ms` - Tool execution latency (histogram)

### Service Level Objectives (SLOs)

TraceForge includes comprehensive SLO tracking with 9 pre-configured SLOs in Datadog:

**Performance SLOs**:
- **Request Availability** (7d, 99.5% target): Percentage of requests with status OK or DEGRADED
- **Request Latency P95** (30d, 95% target): Time slices where p95 latency ≤ 2000ms
- **Endpoint Latency** (7d, 99.9% target): P95 latency < 1s for `/v1/ask` route

**Quality SLOs**:
- **Response Quality** (30d, 95% target): Percentage of responses with overall quality score ≥ 0.75

**Tool Reliability SLOs** (30d, 99% target each):
- Tool Reliability for `weather*` tools
- Tool Reliability for `search*` tools
- Tool Reliability for `payment*` tools
- Tool Reliability for `document_lookup*` tools
- Tool Reliability for `vector_db*` tools

All SLO configurations are available in `datadog/slos.json` for easy import into Datadog.

---

## 🔮 Roadmap

### Phase 1.1: Core Observability ✅ COMPLETE
- ✅ Real Gemini LLM provider integration
- ✅ LLM tracing and metrics (latency, tokens, cost)
- ✅ Evaluation system (faithfulness, relevance, policy risk, hallucination)
- ✅ Remediation system (CLARIFICATION action)
- ✅ OpenTelemetry integration with Datadog
- ✅ Multi-tenant support

### Phase 1.2: Real RAG Integration ✅ COMPLETE
- ✅ Qdrant vector database setup
- ✅ Real RAG provider with keyword search
- ✅ RAG tracing and metrics
- ✅ 20 pre-seeded demo documents

### Phase 1.3: Production Monitoring ✅ COMPLETE
- ✅ Datadog monitors and alerts (cost, quality degradation)
- ✅ Comprehensive SLO tracking (9 SLOs: availability, latency, quality, tool reliability)
- ✅ Pre-configured Datadog dashboards (4 dashboards)
- ✅ Quality SLO metric tracking (`traceforge.request.quality_ok`)

### Phase 1.4: Production Deployment ✅ COMPLETE
- ✅ Google Cloud Run deployment with sidecar pattern
- ✅ OpenTelemetry + Datadog Agent sidecar architecture
- ✅ Continuous metrics export (every 5 seconds)
- ✅ Real-time trace export to Datadog
- ✅ Production service live and operational

### Phase 2: Enhanced RAG (Coming Soon)
- 🔄 Embedding-based semantic search
- 🔄 Hybrid search (keyword + semantic)
- 🔄 Reranking for better relevance
- 🔄 Additional vector database support (Pinecone, Weaviate)

### Phase 3: Advanced Features (Future)
- 📋 Additional LLM providers (OpenAI, Anthropic)
- 📋 Advanced evaluation models (LLM-as-judge, embedding-based)
- 📋 Additional remediation strategies (SAFE_MODE, FALLBACK_TOOL, RETRY_LLM)
- 📋 Real tool integrations (custom tool execution)
- 📋 Webhook support for external remediation
- 📋 Dashboard for observability visualization
- 📋 Alerting and notification system
- 📋 A/B testing framework
- 📋 Cost optimization recommendations

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

MIT License

See [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Observability powered by [OpenTelemetry](https://opentelemetry.io/)
- Package management with [pnpm](https://pnpm.io/)

---

### Datadog Configuration

TraceForge includes pre-configured Datadog resources for immediate observability:

**Monitors** (`datadog/monitors.json`, `datadog/monitors1.json`):
- **LLM Cost Alert**: Monitors average cost per request (warning: $0.02, critical: $0.05)
- **AI Quality Degradation**: Alerts when overall quality score < 0.75

**Dashboards** (`datadog/*.json`):
- **LLM System Overview**: Request volume, latency, token usage, cost, tool metrics
- **Cost & Token Economics**: Cost tracking by model, token usage breakdown
- **Reliability & SLOs**: SLO status, error budgets, availability metrics
- **TraceForensics**: Distributed tracing and span analysis

**Import Instructions**:
1. **Monitors**: Import via Datadog API or UI:
   - `datadog/monitors.json` - LLM Cost Per Request alert
   - `datadog/monitors1.json` - AI Quality Degradation alert
2. **SLOs**: Import `datadog/slos.json` via Datadog SLO API (contains all 9 SLOs)
3. **Dashboards**: Import dashboard JSON files via Datadog Dashboard API or UI

**Monitor Details**:
- **LLM Cost Monitor**: Alerts when average cost per request exceeds thresholds (warning: $0.02, critical: $0.05)
- **Quality Degradation Monitor**: Alerts when overall evaluation score falls below 0.75 threshold

## 📚 Additional Resources

For detailed monitoring and observability setup, see:
- **Datadog Configuration**: All monitors, SLOs, and dashboards in `datadog/` directory
- **Datadog Agent Setup**: `docker-compose.local.yml` for local development
- **Production Deployment**: `cloud-run-service.yaml` for Cloud Run with sidecar
- **Judge Submission Info**: `JUDGE_SUBMISSION_INFO.md` for production service details

### Documentation Files

- **[METRICS_AND_SPANS.md](./METRICS_AND_SPANS.md)** - Complete reference for all metrics and spans
- **[RESPONSE_QUALITY_SLO.md](./RESPONSE_QUALITY_SLO.md)** - Response Quality SLO calculation guide
- **[P95_LATENCY_QUERIES.md](./P95_LATENCY_QUERIES.md)** - P95 latency query examples
- **[LLM_TOKEN_USAGE_QUERIES.md](./LLM_TOKEN_USAGE_QUERIES.md)** - LLM token usage calculation
- **[LLM_TOKEN_SPIKE_EVENTS.md](./LLM_TOKEN_SPIKE_EVENTS.md)** - Token spike detection guide
- **[PROMPT_VS_COMPLETION_TOKENS.md](./PROMPT_VS_COMPLETION_TOKENS.md)** - Token breakdown queries
- **[TOOL_NAMING_CONVENTION.md](./TOOL_NAMING_CONVENTION.md)** - Tool naming for wildcard queries
- **[JUDGE_SUBMISSION_INFO.md](./JUDGE_SUBMISSION_INFO.md)** - Production deployment information for judges

## 📞 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**Built with ❤️ for reliable, observable, and production-ready AI applications.**

