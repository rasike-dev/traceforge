import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { trace } from '@opentelemetry/api';

@Injectable()
export class TraceTagsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const span = trace.getActiveSpan();

    if (span) {
      // These become searchable tags in Datadog
      span.setAttribute('env', process.env.NODE_ENV ?? 'dev');
      span.setAttribute('service', 'traceforge-api'); // optional; service is usually auto
      // Set defaults so it always exists
      span.setAttribute('remediation', 'none');
      span.setAttribute('model', 'unknown');
      span.setAttribute('tool_name', 'none');
    }

    return next.handle().pipe(
      tap({
        error: (err) => {
          const s = trace.getActiveSpan();
          if (s) {
            s.setAttribute('error', true);
            s.recordException(err);
          }
        },
      }),
    );
  }
}

