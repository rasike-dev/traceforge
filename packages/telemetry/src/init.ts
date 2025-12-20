import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | undefined;

export function initTelemetry() {
  if (sdk) return; // prevent double init

  const traceExporter = new OTLPTraceExporter({
    url:
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318/v1/traces',
  });

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      // ✅ semantic convention keys (stable)
      'service.name': 'traceforge-api',
      'service.version': '0.1.0',
      'deployment.environment': process.env.NODE_ENV ?? 'dev',

      // optional but useful
      'telemetry.sdk.language': 'nodejs',
    }),
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
      }),
    ],
  });

  sdk.start();
}

