# TraceForge - Production Deployment Information

## 🌐 Live Production Service

**Service URL:** https://traceforge-api-oymutya24a-uc.a.run.app

**Deployment Platform:** Google Cloud Run (Serverless)

**Region:** us-central1

**Status:** ✅ Live and Operational

---

## 🏗️ Architecture

**Observability Stack:**
- **Telemetry Provider:** OpenTelemetry SDK
- **Agent:** Datadog Agent (Sidecar Pattern)
- **Protocol:** OTLP (OpenTelemetry Protocol)
- **Observability Platform:** Datadog

**Architecture Flow:**
```
TraceForge API → OTLP (localhost:4318) → Datadog Agent Sidecar → Datadog Cloud
```

**Key Features:**
- ✅ Real Gemini LLM Integration (gemini-2.5-flash)
- ✅ Real RAG Backend (Qdrant vector database)
- ✅ Deterministic Evaluation System
- ✅ Automatic Remediation (CLARIFICATION)
- ✅ Full Observability (Traces + Metrics)

---

## 🧪 How to Test

### 1. Health Check
```bash
curl https://traceforge-api-oymutya24a-uc.a.run.app/health
```

**Expected Response:**
```json
{"ok": true}
```

### 2. Send a Request
```bash
curl -X POST https://traceforge-api-oymutya24a-uc.a.run.app/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is OpenTelemetry and why is it important for observability?",
    "tenant": "judge-demo"
  }'
```

**Expected Response:**
```json
{
  "requestId": "...",
  "tenantId": "judge-demo",
  "answer": {
    "text": "..."
  },
  "usage": {
    "tokensIn": 123,
    "tokensOut": 456,
    "totalTokens": 579,
    "costUsd": 0.000123
  },
  "eval": {
    "faithfulness": 0.85,
    "relevance": 0.90,
    "policyRisk": 0.0,
    "hallucination": 0.15,
    "overall": 0.88
  },
  "remediation": {
    "triggered": false,
    "actions": [],
    "finalMode": "OK"
  },
  "debug": {
    "traceId": "...",
    "spanId": "..."
  }
}
```

### 3. Test Remediation Trigger (Low Quality Response)
```bash
curl -X POST https://traceforge-api-oymutya24a-uc.a.run.app/v1/ask \
  -H "Content-Type: application/json" \
  -d '{
    "input": "What is the exact internal algorithm TraceForge uses to detect hallucinations? Give the full formula and thresholds used in production.",
    "tenant": "judge-remediation-test"
  }'
```

**Expected:** `remediation.triggered: true`, `finalMode: "DEGRADED"`

---

## 📊 Observability in Datadog

### Access Information
- **Platform:** Datadog
- **Service Name:** `traceforge-api`
- **Environment:** `production`

### View Traces
**APM Service Page:**
https://app.datadoghq.com/apm/service/traceforge-api

**Filters to Use:**
- Service: `traceforge-api`
- Environment: `production`
- Time Range: Last 15 minutes

### View Metrics
**Metrics Explorer:**
https://app.datadoghq.com/metric/explorer

**Key Metrics to Query:**
- `traceforge.request.count` - Total requests
- `traceforge.request.latency_ms` - Request latency (P95, P99)
- `traceforge.llm.tokens.input` - LLM input tokens
- `traceforge.llm.tokens.output` - LLM output tokens
- `traceforge.llm.cost.usd` - LLM costs
- `traceforge.eval.score` - Evaluation scores (by dimension)
- `traceforge.remediation.triggered` - Remediation actions
- `traceforge.request.quality_ok` - Quality SLO metric

### View SLOs
**Response Quality SLO:**
- Metric: `traceforge.request.quality_ok` / `traceforge.request.count`
- Threshold: ≥ 0.75 overall score
- Query: `sum:traceforge.request.quality_ok{service:traceforge-api}.as_count() / sum:traceforge.request.count{service:traceforge-api}.as_count()`

---

## 🔍 What to Look For

### In Traces (Datadog APM)
1. **Span Hierarchy:**
   - `traceforge.request` (root)
     - `traceforge.rag` (RAG retrieval)
     - `traceforge.tool` (tool calls)
     - `traceforge.llm` (LLM generation)
     - `traceforge.evaluation` (quality scoring)
     - `traceforge.remediation` (if triggered)

2. **Span Attributes:**
   - `traceforge.status` (OK, DEGRADED, ERROR)
   - `llm.provider`, `llm.model`
   - `eval.overall`, `eval.faithfulness`, etc.
   - `remediation.action` (if triggered)

### In Metrics (Datadog Metrics)
1. **Request Metrics:**
   - Request count, latency (histogram)
   - Quality SLO compliance

2. **LLM Metrics:**
   - Token usage (input/output)
   - Cost tracking
   - Latency

3. **Evaluation Metrics:**
   - Scores by dimension (faithfulness, relevance, etc.)

4. **Remediation Metrics:**
   - Trigger count by action type

---

## 🎯 Key Demonstrations

### 1. Full Observability
- ✅ Distributed tracing with custom spans
- ✅ Custom metrics for all stages
- ✅ Real-time monitoring in Datadog

### 2. Production-Grade LLM Integration
- ✅ Real Gemini API calls
- ✅ Token counting and cost calculation
- ✅ Error handling and fallback

### 3. RAG Integration
- ✅ Real Qdrant vector database
- ✅ Document retrieval metrics
- ✅ Latency tracking

### 4. Quality Assurance
- ✅ Deterministic evaluation system
- ✅ Multi-dimensional scoring
- ✅ Quality SLO tracking

### 5. Automatic Remediation
- ✅ Low-quality detection
- ✅ Automatic CLARIFICATION action
- ✅ Status degradation handling

### 6. Vendor-Neutral Architecture
- ✅ OpenTelemetry SDK (not locked to Datadog)
- ✅ OTLP protocol
- ✅ Can switch observability vendors easily

---

## 📈 Performance Characteristics

**Metrics Export:** Every 5 seconds (continuous)
**Trace Export:** Real-time (on request completion)
**Latency:** P95 typically < 3 seconds (includes LLM call)
**Availability:** Cloud Run auto-scaling (0 to N instances)

---

## 🔐 Security & Configuration

**API Keys:**
- Gemini API Key: Configured (for LLM calls)
- Datadog API Key: Configured (for observability)

**Environment:**
- Production environment
- Resource limits: 1 CPU, 512Mi memory
- Timeout: 300 seconds

---

## 📝 Submission Notes

**What Makes This Production-Ready:**
1. ✅ Real LLM integration (not mocked)
2. ✅ Real RAG backend (not mocked)
3. ✅ Full observability (traces + metrics)
4. ✅ Automatic quality assurance
5. ✅ Remediation system
6. ✅ Vendor-neutral architecture
7. ✅ Deployed to cloud (not just local)

**Innovation Highlights:**
- Loosely coupled telemetry (can switch vendors)
- Deterministic evaluation for consistent demos
- Automatic remediation based on quality scores
- Comprehensive observability for AI orchestration

---

## 🚀 Quick Start for Judges

1. **Test the API:**
   ```bash
   curl -X POST https://traceforge-api-oymutya24a-uc.a.run.app/v1/ask \
     -H "Content-Type: application/json" \
     -d '{"input": "What is observability?", "tenant": "judge-test"}'
   ```

2. **View in Datadog:**
   - Go to: https://app.datadoghq.com/apm/service/traceforge-api
   - Filter: `env:production`
   - Look for the trace from your request

3. **Check Metrics:**
   - Go to: https://app.datadoghq.com/metric/explorer
   - Search: `traceforge.request.count`
   - Filter: `service:traceforge-api`

---

**Last Updated:** 2026-01-01
**Deployment Status:** ✅ Live
**Observability:** ✅ Active

