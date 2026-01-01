/**
 * Main Telemetry Initialization
 * 
 * This is a compatibility layer that uses the provider factory
 * to initialize the appropriate telemetry backend.
 * 
 * Supports:
 * - Datadog native tracer (dd-trace) - for direct Datadog integration
 * - OpenTelemetry SDK - for vendor-neutral observability
 * 
 * Provider selection:
 * - Set TELEMETRY_PROVIDER=datadog to force Datadog
 * - Set TELEMETRY_PROVIDER=opentelemetry to force OpenTelemetry
 * - Auto-detects based on DD_API_KEY and OTEL_EXPORTER_OTLP_ENDPOINT
 */

import { initTelemetryProvider, shutdownTelemetryProvider } from './providers/factory';

// Main initialization function (backward compatible)
export function initTelemetry() {
  initTelemetryProvider();
}

// Shutdown handlers
process.on('SIGTERM', async () => {
  console.log('[TraceForge] Flushing traces before shutdown...');
  await shutdownTelemetryProvider();
});

process.on('SIGINT', async () => {
  console.log('[TraceForge] Flushing traces before shutdown...');
  await shutdownTelemetryProvider();
});

/**
 * Force flush metrics immediately (useful for testing/verification)
 */
export async function forceFlushMetrics(): Promise<void> {
  // Implementation depends on provider - for now, just log
  console.log('[Telemetry] Force flush metrics requested');
}

/**
 * Force flush traces immediately (useful for testing/verification)
 */
export async function forceFlushTraces(): Promise<void> {
  await shutdownTelemetryProvider();
}
