import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

let sdk: NodeSDK | undefined;
let metricReader: PeriodicExportingMetricReader | undefined;

export function initTelemetry() {
  if (sdk) return;

  const baseEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/v1\/traces$/, '') ??
    'http://localhost:4318';

  const traceExporter = new OTLPTraceExporter({
    url: `${baseEndpoint}/v1/traces`,
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

  sdk = new NodeSDK({
    resource: resourceFromAttributes(finalAttributes),
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  sdk.start();
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

