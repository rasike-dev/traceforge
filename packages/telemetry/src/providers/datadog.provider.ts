/**
 * Datadog Native Tracer Provider
 * 
 * Uses dd-trace for direct Datadog integration.
 * Also initializes OpenTelemetry SDK for compatibility with start-stage-span
 * which uses OpenTelemetry API (vendor-neutral).
 */

import tracer from 'dd-trace';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NoopSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { TelemetryProvider, Tracer, Span } from '../types';

class DatadogSpan implements Span {
  private span: any;

  constructor(span: any) {
    this.span = span;
  }

  setAttribute(key: string, value: string | number | boolean): void {
    if (this.span) {
      this.span.setTag(key, value);
    }
  }

  addEvent(name: string, attributes?: Record<string, any>): void {
    if (this.span) {
      this.span.addTags(attributes || {});
      // Datadog doesn't have explicit events, so we add as tags
      this.span.setTag(`event.${name}`, true);
    }
  }

  end(): void {
    if (this.span) {
      this.span.finish();
    }
  }

  setStatus(status: { code: number; message?: string }): void {
    if (this.span) {
      // Map status codes: 1=OK, 2=ERROR
      if (status.code === 2) {
        this.span.setTag('error', true);
        if (status.message) {
          this.span.setTag('error.message', status.message);
        }
      }
    }
  }
}

class DatadogTracer implements Tracer {
  startSpan(name: string, attributes?: Record<string, any>): Span {
    const span = tracer.startSpan(name, {
      tags: attributes || {},
    });
    return new DatadogSpan(span);
  }
}

export class DatadogProvider implements TelemetryProvider {
  private initialized = false;
  private otelSdk: NodeSDK | undefined;

  init(): void {
    if (this.initialized) {
      console.log('[Telemetry] Datadog tracer already initialized');
      return;
    }

    const serviceName = process.env.OTEL_SERVICE_NAME || 'traceforge-api';
    const environment = process.env.NODE_ENV || 'production';
    const version = process.env.OTEL_SERVICE_VERSION || '0.1.0';

    console.log('[Telemetry] Initializing Datadog native tracer');
    console.log('[Telemetry] Service:', serviceName);
    console.log('[Telemetry] Environment:', environment);

    // Initialize Datadog tracer (primary - sends directly to Datadog)
    // Note: If already initialized in main.ts, this is a no-op
    try {
      const ddSite = process.env.DD_SITE || 'datadoghq.com';
      
      tracer.init({
        service: serviceName,
        env: environment,
        version: version,
        // Use API key authentication
        apiKey: process.env.DD_API_KEY,
        site: ddSite,
        // Enable debug logging if needed
        debug: process.env.DD_TRACE_DEBUG === 'true',
        // Log startup info
        logInjection: true,
        // Runtime metrics (disabled - requires agent for DogStatsD)
        runtimeMetrics: false,
        // Disable features that require agent connection
        appsec: false, // Disable AppSec (requires agent)
        remoteConfig: false, // Disable remote config (requires agent)
        // Ensure HTTP instrumentation is enabled
        plugins: {
          http: {
            enabled: true,
          },
          express: {
            enabled: true,
          },
        },
        // Send directly to Datadog API (agentless mode)
        // When DD_AGENT_HOST is not set, dd-trace automatically uses the API endpoint
        // Do NOT set hostname/port - let dd-trace use the API endpoint based on site
      });
      
      // Explicitly set agentless mode - unset any agent host
      delete process.env.DD_AGENT_HOST;
      delete process.env.DD_TRACE_AGENT_PORT;
      process.env.DD_TRACE_AGENTLESS = 'true';
      
      console.log('[Telemetry] dd-trace configuration applied');
      console.log('[Telemetry] Mode: Agentless (sending directly to Datadog API)');
      console.log('[Telemetry] Site:', ddSite);
    } catch (err: any) {
      if (err.message?.includes('already initialized')) {
        console.log('[Telemetry] dd-trace already initialized (from main.ts)');
      } else {
        console.error('[Telemetry] Error initializing dd-trace:', err);
        throw err;
      }
    }

    // Also initialize OpenTelemetry SDK with no-op exporter
    // This allows start-stage-span (which uses OpenTelemetry API) to work
    // The actual traces go through dd-trace, but OpenTelemetry API is available
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
      'service.name': serviceName,
      'service.version': version,
      'deployment.environment': environment,
    };

    const finalAttributes = { ...defaultAttributes, ...resourceAttributes };

    // Use NoopSpanProcessor - traces go through dd-trace, not OTLP
    this.otelSdk = new NodeSDK({
      resource: resourceFromAttributes(finalAttributes),
      spanProcessor: new NoopSpanProcessor(), // No-op - dd-trace handles export
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    this.otelSdk.start();

    this.initialized = true;
    console.log('[Telemetry] Datadog tracer initialized successfully');
    console.log('[Telemetry] Traces will be sent directly to Datadog Cloud via dd-trace');
    console.log('[Telemetry] OpenTelemetry API available for compatibility');
  }

  getTracer(): Tracer {
    if (!this.initialized) {
      this.init();
    }
    return new DatadogTracer();
  }

  async shutdown(): Promise<void> {
    console.log('[Telemetry] Flushing Datadog traces...');
    
    // Flush dd-trace
    await new Promise<void>((resolve) => {
      tracer.flush(() => {
        console.log('[Telemetry] Datadog traces flushed');
        resolve();
      });
    });

    // Shutdown OpenTelemetry SDK
    if (this.otelSdk) {
      await this.otelSdk.shutdown();
    }
  }
}
