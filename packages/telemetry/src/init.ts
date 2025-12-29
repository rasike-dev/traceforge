import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

let sdk: NodeSDK | undefined;
let metricReader: PeriodicExportingMetricReader | undefined;

export function initTelemetry() {
  if (sdk) {
    console.log('[Telemetry] SDK already initialized, skipping');
    return;
  }

  const baseEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/v1\/traces$/, '') ??
    'http://localhost:4318';

  console.log('[Telemetry] Initializing OpenTelemetry SDK');
  console.log('[Telemetry] OTLP Endpoint:', `${baseEndpoint}/v1/traces`);

  const traceExporter = new OTLPTraceExporter({
    url: `${baseEndpoint}/v1/traces`,
    // Add headers if needed for Datadog
    headers: {},
  });

  const metricExporter = new OTLPMetricExporter({
    url: `${baseEndpoint}/v1/metrics`,
  });

  metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 5000),
  });

  // Parse OTEL_RESOURCE_ATTRIBUTES if provided
  // Format: "service.name=traceforge-api,service.version=0.1.0,deployment.environment.name=dev"
  const resourceAttributes: Record<string, string> = {};
  if (process.env.OTEL_RESOURCE_ATTRIBUTES) {
    process.env.OTEL_RESOURCE_ATTRIBUTES.split(',').forEach((pair) => {
      const [key, ...valueParts] = pair.split('=');
      if (key && valueParts.length > 0) {
        resourceAttributes[key.trim()] = valueParts.join('=').trim();
      }
    });
  }

  // Default values (used if not provided in OTEL_RESOURCE_ATTRIBUTES)
  const defaultAttributes = {
    'service.name': 'traceforge-api',
    'service.version': '0.1.0',
    'deployment.environment': process.env.NODE_ENV ?? 'dev',
  };

  // Merge: OTEL_RESOURCE_ATTRIBUTES overrides defaults
  const finalAttributes = { ...defaultAttributes, ...resourceAttributes };

  // Use SimpleSpanProcessor for immediate export (good for testing)
  // In production, you might want BatchSpanProcessor for better performance
  const spanProcessor = new SimpleSpanProcessor(traceExporter);

  sdk = new NodeSDK({
    resource: resourceFromAttributes(finalAttributes),
    spanProcessor, // Use immediate export processor
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
  console.log('[TraceForge] Telemetry SDK started successfully');
  console.log('[TraceForge] Service:', finalAttributes['service.name']);
  console.log('[TraceForge] Environment:', finalAttributes['deployment.environment']);
  console.log('[TraceForge] Trace exporter URL:', `${baseEndpoint}/v1/traces`);
  
  // Add export verification logging
  if (process.env.NODE_ENV !== 'production') {
    console.log('[TraceForge] Trace exporter ready - traces will be sent to Datadog Agent');
  }

  // Add shutdown handler to flush traces on exit
  process.on('SIGTERM', async () => {
    console.log('[TraceForge] Flushing traces before shutdown...');
    await sdk?.shutdown();
  });

  process.on('SIGINT', async () => {
    console.log('[TraceForge] Flushing traces before shutdown...');
    await sdk?.shutdown();
  });
}

/**
 * Force flush metrics immediately (useful for testing/verification)
 * This ensures metrics are exported even if the periodic interval hasn't elapsed
 */
export async function forceFlushMetrics(): Promise<void> {
  if (metricReader) {
    await metricReader.forceFlush();
  }
}

/**
 * Force flush traces immediately (useful for testing/verification)
 * SimpleSpanProcessor should export immediately, but this ensures it
 */
export async function forceFlushTraces(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    // Note: shutdown flushes, but we need to restart SDK after
    // For now, SimpleSpanProcessor should handle immediate export
  }
}

