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
- **Faithfulness scoring**: Detects when responses don't match context
- **Relevance assessment**: Ensures retrieved context matches the query
- **Policy risk detection**: Identifies potential compliance violations
- **Hallucination detection**: Flags suspicious outputs automatically

### 🛡️ Automatic Remediation
- **Safe mode**: Activates when policy risks are detected
- **Fallback tools**: Switches to backup tools when primary tools fail
- **Clarification requests**: Asks users for clarification when quality is low
- **Configurable thresholds**: Fine-tune when remediation triggers

### 💰 Cost & Performance Tracking
- **Token monitoring**: Track input, output, and total tokens per request
- **Cost estimation**: Real-time USD cost calculation
- **Performance metrics**: Latency tracking for every stage
- **Multi-tenant support**: Isolate metrics by tenant

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
- **Observability**: OpenTelemetry (traces + metrics)
- **Package Manager**: pnpm workspaces

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- pnpm 10.26+

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

### Running the API

```bash
# Start the API server (development mode)
cd apps/api
pnpm start:dev

# The API will be available at http://localhost:3000
```

### Environment Variables

Configure OpenTelemetry endpoint (optional):

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
export OTEL_METRIC_EXPORT_INTERVAL_MS=5000
export NODE_ENV=development
```

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

**Query Parameters** (for chaos testing):
- `breakTool=true` - Simulate tool failure
- `badRag=true` - Simulate poor RAG retrieval
- `policyRisk=true` - Simulate policy violation
- `tokenSpike=true` - Simulate high token usage

**Response**:

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "answer": "The weather today is sunny with a high of 75°F...",
  "scores": {
    "faithfulness": 0.88,
    "relevance": 0.9,
    "policyRisk": 0.1,
    "formatCompliance": 1,
    "hallucinationSuspected": 0
  },
  "meta": {
    "modelName": "mock-gemini",
    "inputTokens": 200,
    "outputTokens": 120,
    "totalTokens": 320,
    "costUsdEstimate": 0.00032,
    "remediationApplied": null
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

OpenTelemetry initialization and configuration. Sets up distributed tracing and metrics collection.

**Key exports**:
- `initTelemetry()` - Initialize OpenTelemetry SDK

### Other Packages

- **evaluator**: Quality scoring algorithms
- **llm**: LLM provider abstractions (currently mocked, ready for real providers)
- **rag**: RAG retrieval implementations (currently mocked, ready for real vector DBs)
- **remediation**: Remediation strategy implementations
- **tools**: Tool execution framework (currently mocked, ready for real tool integrations)

---

## 🎯 Use Cases

TraceForge is perfect for:

- ✅ **Enterprise AI Applications**: Need observability, compliance, and reliability
- ✅ **Production AI Services**: Require quality guarantees and cost tracking
- ✅ **Multi-Tenant SaaS**: Need tenant isolation and per-tenant metrics
- ✅ **High-Stakes Applications**: Where failures are costly and quality matters
- ✅ **Compliance-Critical Systems**: Policy enforcement and auditability required

---

## 🔮 Roadmap

### Phase A (Current)
- ✅ Core orchestration engine
- ✅ OpenTelemetry integration
- ✅ Mock implementations (RAG, LLM, Tools)
- ✅ Basic evaluation and remediation
- ✅ Multi-tenant support

### Phase B (Coming Soon)
- 🔄 Real LLM provider integrations (OpenAI, Anthropic, Google)
- 🔄 Real RAG implementations (Pinecone, Weaviate, Qdrant)
- 🔄 Real tool integrations (custom tool execution)
- 🔄 Advanced evaluation models (LLM-as-judge, embedding-based)
- 🔄 Webhook support for external remediation

### Phase C (Future)
- 📋 Dashboard for observability visualization
- 📋 Alerting and notification system
- 📋 Advanced remediation strategies
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

ISC License

---

## 🙏 Acknowledgments

- Built with [NestJS](https://nestjs.com/)
- Observability powered by [OpenTelemetry](https://opentelemetry.io/)
- Package management with [pnpm](https://pnpm.io/)

---

## 📞 Support

For questions, issues, or feature requests, please open an issue on GitHub.

---

**Built with ❤️ for reliable, observable, and production-ready AI applications.**

