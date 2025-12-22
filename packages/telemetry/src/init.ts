import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';

let sdk: NodeSDK | undefined;

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

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 5000),
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'traceforge-api',
      'service.version': '0.1.0',
      'deployment.environment': process.env.NODE_ENV ?? 'dev',
    }),
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

