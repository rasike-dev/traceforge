// apps/api/src/main.ts
// Load environment variables from .env file (must be first)
// Use explicit path to project root .env file
import { config } from 'dotenv';
import { resolve, join } from 'path';

// Resolve .env path: from dist/ directory, go up to project root
const envPath = resolve(__dirname, '../../../.env');
config({ path: envPath });

import { initTelemetry } from '@traceforge/telemetry';

// MUST be first — before Nest or any HTTP libs load
initTelemetry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { TraceTagsInterceptor } from './telemetry/trace-tags.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TraceTagsInterceptor());

  await app.listen(3000);
}

bootstrap();
