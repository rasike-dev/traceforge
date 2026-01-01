/**
 * Telemetry Provider Interface
 * 
 * This abstraction allows switching between different telemetry providers
 * (Datadog, OpenTelemetry, etc.) without changing application code.
 */

export interface Span {
  setAttribute(key: string, value: string | number | boolean): void;
  addEvent(name: string, attributes?: Record<string, any>): void;
  end(): void;
  setStatus(status: { code: number; message?: string }): void;
}

export interface Tracer {
  startSpan(name: string, attributes?: Record<string, any>): Span;
}

export interface TelemetryProvider {
  /**
   * Initialize the telemetry provider
   */
  init(): void;

  /**
   * Get a tracer for creating spans
   */
  getTracer(): Tracer;

  /**
   * Shutdown and flush all pending telemetry data
   */
  shutdown(): Promise<void>;
}

export type TelemetryProviderType = 'datadog' | 'opentelemetry';
