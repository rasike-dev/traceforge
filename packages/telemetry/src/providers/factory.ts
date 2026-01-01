/**
 * Telemetry Provider Factory
 * 
 * Selects and initializes the appropriate telemetry provider
 * based on configuration. Uses a loosely coupled architecture
 * that allows switching between providers without code changes.
 */

import type { TelemetryProvider, TelemetryProviderType } from '../types';
import { DatadogProvider } from './datadog.provider';
import { OpenTelemetryProvider } from './opentelemetry.provider';

let currentProvider: TelemetryProvider | null = null;

/**
 * Determine which provider to use based on environment variables
 */
function determineProvider(): TelemetryProviderType {
  // Explicit provider selection
  const explicitProvider = process.env.TELEMETRY_PROVIDER?.toLowerCase();
  if (explicitProvider === 'datadog' || explicitProvider === 'opentelemetry') {
    return explicitProvider as TelemetryProviderType;
  }

  // Auto-detect: If DD_API_KEY is set and no OTLP endpoint, use Datadog
  const ddApiKey = process.env.DD_API_KEY;
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  
  if (ddApiKey && (!otlpEndpoint || otlpEndpoint.includes('datadoghq.com'))) {
    return 'datadog';
  }

  // Default to OpenTelemetry for vendor-neutral setup
  return 'opentelemetry';
}

/**
 * Initialize the selected telemetry provider
 */
export function initTelemetryProvider(): void {
  if (currentProvider) {
    console.log(`[Telemetry] Provider already initialized`);
    return;
  }

  const providerType = determineProvider();
  console.log(`[Telemetry] Initializing provider: ${providerType}`);

  // Create provider instance based on type
  if (providerType === 'datadog') {
    currentProvider = new DatadogProvider();
  } else {
    currentProvider = new OpenTelemetryProvider();
  }

  // Initialize the provider
  currentProvider.init();
}

/**
 * Get the current telemetry provider instance
 */
export function getTelemetryProvider(): TelemetryProvider {
  if (!currentProvider) {
    initTelemetryProvider();
  }
  return currentProvider!;
}

/**
 * Get the current tracer instance
 */
export function getTracer() {
  return getTelemetryProvider().getTracer();
}

/**
 * Shutdown and flush all telemetry data
 */
export async function shutdownTelemetryProvider(): Promise<void> {
  if (currentProvider) {
    await currentProvider.shutdown();
    currentProvider = null;
  }
}

/**
 * Get the current provider type
 */
export function getCurrentProviderType(): TelemetryProviderType | null {
  if (!currentProvider) {
    return null;
  }
  // Determine type based on instance
  return currentProvider instanceof DatadogProvider ? 'datadog' : 'opentelemetry';
}

