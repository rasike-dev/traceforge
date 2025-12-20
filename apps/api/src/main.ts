// apps/api/src/main.ts
import { initTelemetry } from '@traceforge/telemetry';

// MUST be first — before Nest or any HTTP libs load
initTelemetry();

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // prepares for log correlation later
  });

  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3000);
}

bootstrap();
