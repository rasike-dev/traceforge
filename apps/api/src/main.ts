// apps/api/src/main.ts
// Load environment variables from .env file (must be first)
// Use explicit path to project root .env file
import { config } from 'dotenv';
import { resolve } from 'path';

// Resolve .env path: from dist/ directory, go up to project root
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

// CRITICAL: Initialize dd-trace FIRST if using Datadog provider
// This MUST happen before any other imports (especially NestJS/Express)
// dd-trace needs to instrument the HTTP framework before it loads
if (process.env.TELEMETRY_PROVIDER === 'datadog' || 
    (process.env.DD_API_KEY && !process.env.TELEMETRY_PROVIDER)) {
  try {
    // CRITICAL: Set agentless mode BEFORE importing/initializing dd-trace
    // These environment variables must be set before tracer.init() is called
    delete process.env.DD_AGENT_HOST;
    delete process.env.DD_TRACE_AGENT_PORT;
    process.env.DD_TRACE_AGENTLESS = 'true';
    
    const tracer = require('dd-trace');
    const serviceName = process.env.OTEL_SERVICE_NAME || 'traceforge-api';
    const environment = process.env.NODE_ENV || 'production';
    
    // For Cloud Run, send directly to Datadog API (agentless mode)
    const ddSite = process.env.DD_SITE || 'datadoghq.com';
    
    tracer.init({
      service: serviceName,
      env: environment,
      version: process.env.OTEL_SERVICE_VERSION || '0.1.0',
      apiKey: process.env.DD_API_KEY,
      site: ddSite,
      logInjection: true,
      runtimeMetrics: false, // Disable runtime metrics (requires agent for DogStatsD)
      debug: process.env.DD_TRACE_DEBUG === 'true',
      // Disable features that require agent connection
      appsec: false, // Disable AppSec (requires agent)
      remoteConfig: false, // Disable remote config (requires agent)
      // Send directly to Datadog API (no local agent)
      // When DD_AGENT_HOST is not set and DD_TRACE_AGENTLESS=true, dd-trace uses API endpoint
    });
    
    console.log('[Telemetry] dd-trace initialized (early) for auto-instrumentation');
    console.log('[Telemetry] DD_TRACE_AGENTLESS:', process.env.DD_TRACE_AGENTLESS);
    console.log('[Telemetry] DD_AGENT_HOST:', process.env.DD_AGENT_HOST || 'NOT SET (agentless)');
    console.log('[Telemetry] DD_SITE:', ddSite);
    console.log('[Telemetry] DD_API_KEY:', process.env.DD_API_KEY ? 'SET' : 'NOT SET');
  } catch (err: any) {
    console.error('[Telemetry] Failed to initialize dd-trace early:', err?.message || err);
  }
}

// Initialize telemetry provider (Datadog or OpenTelemetry)
// This MUST be before Nest or any HTTP libs load
import { initTelemetry } from '@traceforge/telemetry';
initTelemetry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TraceTagsInterceptor } from './telemetry/trace-tags.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Serve static files for config UI
  const express = require('express');
  const path = require('path');
  const staticPath = path.join(__dirname, '../public/config-ui');
  app.use('/config', express.static(staticPath));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TraceTagsInterceptor());

  // Enable CORS for config UI
  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 TraceForge API listening on port ${port}`);
  console.log(`📝 Configuration UI available at http://localhost:${port}/config`);
}

bootstrap();
