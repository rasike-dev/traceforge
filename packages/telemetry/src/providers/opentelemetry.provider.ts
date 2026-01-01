/**
 * OpenTelemetry Provider
 * 
 * Uses OpenTelemetry SDK (existing implementation)
 * Can be used for multi-vendor support or when not using Datadog
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { trace, context, Span as OTelSpan } from '@opentelemetry/api';
import type { TelemetryProvider, Tracer, Span } from '../types';

class OpenTelemetrySpan implements Span {
  private span: OTelSpan;

  constructor(span: OTelSpan) {
    this.span = span;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    this.span.setAttribute(key, value);
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    this.span.addEvent(name, attributes);
  }

  end(): void {
    this.span.end();
  }

  setStatus(status: { code: number; message?: string }): void {
    // OpenTelemetry status codes: 1=OK, 2=ERROR
    if (status.code === 2) {
      this.span.setStatus({ code: 2, message: status.message });
    } else {
      this.span.setStatus({ code: 1 });
    }
  }

  recordException(error: Error): void {
    this.span.recordException(error);
  }
}

class OpenTelemetryTracer implements Tracer {
  private otelTracer = trace.getTracer('traceforge.core', '0.1.0');

  startSpan(name: string, attributes?: Record<string, any>): Span {
    const span = this.otelTracer.startSpan(name, {
      attributes: attributes || {},
    });
    return new OpenTelemetrySpan(span);
  }

  startActiveSpan<T>(
    name: string,
    options: { kind?: number } = {},
    callback: (span: Span) => T | Promise<T>
  ): T | Promise<T> {
    return this.otelTracer.startActiveSpan(name, options, async (otelSpan) => {
      const span = new OpenTelemetrySpan(otelSpan);
      return callback(span);
    });
  }
}

export class OpenTelemetryProvider implements TelemetryProvider {
  private sdk: NodeSDK | undefined;
  private metricReader: PeriodicExportingMetricReader | undefined;
  private initialized = false;

  init(): void {
    if (this.initialized) {
      console.log('[Telemetry] OpenTelemetry SDK already initialized');
      return;
    }

    // Determine base endpoint
    // Default to localhost:4318 for Datadog Agent sidecar
    let baseEndpoint =
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/v1\/traces$/, '')?.replace(/\/api\/v2\/traces$/, '') ??
      'http://localhost:4318';
    
    // Use standard OTLP endpoints (no authentication headers for local agent)
    const traceUrl = `${baseEndpoint}/v1/traces`;
    const metricUrl = `${baseEndpoint}/v1/metrics`;

    console.log('[Telemetry] Initializing OpenTelemetry SDK');
    console.log('[Telemetry] Provider: OpenTelemetry');
    console.log('[Telemetry] OTLP Trace Endpoint:', traceUrl);
    console.log('[Telemetry] OTLP Metric Endpoint:', metricUrl);
    console.log('[Telemetry] Target: Datadog Agent (sidecar)');

    const traceExporter = new OTLPTraceExporter({
      url: traceUrl,
      concurrencyLimit: 10,
    });

    const metricExporter = new OTLPMetricExporter({
      url: metricUrl,
    });

    this.metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL_MS ?? 5000),
    });

    // Parse resource attributes
    const resourceAttributes: Record<string, string> = {};
    if (process.env.OTEL_RESOURCE_ATTRIBUTES) {
      process.env.OTEL_RESOURCE_ATTRIBUTES.split(',').forEach((pair) => {
        const [key, ...valueParts] = pair.split('=');
        if (key && valueParts.length > 0) {
          resourceAttributes[key.trim()] = valueParts.join('=').trim();
        }
      });
    }

    const defaultAttributes = {
      'service.name': 'traceforge-api',
      'service.version': '0.1.0',
      'deployment.environment': process.env.NODE_ENV ?? 'dev',
    };

    const finalAttributes = { ...defaultAttributes, ...resourceAttributes };

    const spanProcessor = new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 1000, // Reduced from 5000ms to 1000ms for faster export
      exportTimeoutMillis: 30000,
    });
    
    // Add error handler to log export failures
    traceExporter.export = ((originalExport) => {
      return function (spans, resultCallback) {
        originalExport.call(this, spans, (result) => {
          if (result.code !== 0) {
            console.error('[Telemetry] OTLP export failed:', result);
          } else {
            console.log('[Telemetry] OTLP export successful:', spans.length, 'spans');
          }
          resultCallback(result);
        });
      };
    })(traceExporter.export);

    this.sdk = new NodeSDK({
      resource: resourceFromAttributes(finalAttributes),
      spanProcessor,
      metricReader: this.metricReader,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    this.sdk.start();
    this.initialized = true;
    
    console.log('[TraceForge] OpenTelemetry SDK started successfully');
    console.log('[TraceForge] Service:', finalAttributes['service.name']);
    console.log('[TraceForge] Environment:', finalAttributes['deployment.environment']);
    console.log('[TraceForge] Trace exporter URL:', traceUrl);
  }

  getTracer(): Tracer {
    if (!this.initialized) {
      this.init();
    }
    return new OpenTelemetryTracer();
  }

  async shutdown(): Promise<void> {
    console.log('[Telemetry] Flushing OpenTelemetry traces...');
    if (this.sdk) {
      await this.sdk.shutdown();
    }
    if (this.metricReader) {
      await this.metricReader.forceFlush();
    }
    console.log('[Telemetry] OpenTelemetry traces flushed');
  }
}
